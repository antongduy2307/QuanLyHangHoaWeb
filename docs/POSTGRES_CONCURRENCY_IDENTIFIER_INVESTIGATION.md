# PostgreSQL Concurrency + Identifier Investigation

## 1. Summary

Batch 2 correctly established inventory/customer service behavior, but it is not yet safe to expose through concurrent FastAPI CRUD endpoints. The current implementation uses SQLite service tests and simple read-then-write ORM operations. That is enough for preserving desktop business rules, but not enough for multi-user web writes against PostgreSQL.

The next implementation batch should add PostgreSQL-safe identifier and locking foundations before API CRUD endpoints. The highest-priority fix is standalone debt payment grouping: the current `max(ref_id) + 1` implementation can create duplicate references under concurrent requests. The best project fit is an explicit `debt_payments` table with a PostgreSQL identity primary key, referenced by customer ledger rows through `ref_type = 'DEBT_PAYMENT'` and `ref_id = debt_payments.id`.

This investigation does not implement code.

## 2. Current Risky Areas Found

Files inspected:

- `backend/app/application/inventory_service.py`
- `backend/app/application/customer_service.py`
- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/app/infrastructure/db/models/inventory.py`
- `backend/app/infrastructure/db/models/customer.py`
- `backend/tests/service/test_inventory_service.py`
- `backend/tests/service/test_customer_service.py`
- `docker-compose.yml`
- Phase 2 investigation and implementation docs

### Product code creation and reactivation

Current flow:

- Normalize code.
- Query product by `product_code_base`.
- If active, reject.
- If inactive, validate name/unit mode and reactivate.
- If missing, insert new product and flush.

Risk:

- Two concurrent creates for the same new code can both see no row and try to insert. The unique index protects the database, but the service currently does not translate `IntegrityError` into a domain/API conflict.
- Reactivating an inactive product is not protected by a row lock. Two requests can both reactivate/sync prices concurrently.

### Product price sync

Current flow:

- Load existing price rows.
- Enable/update submitted units.
- Disable omitted units.

Risk:

- Two concurrent updates can overwrite each other's `is_enabled` and `price` decisions.
- Product rows and existing price rows are not locked during sync.

### Inventory balance get/create/update

Current flow:

- If relationship has no balance, add a new `InventoryBalance`.
- Stock mutation reads current balance and writes current plus delta.

Risk:

- Concurrent lazy creation can collide on unique `inventory_balances.product_id`.
- Concurrent stock updates can lose one update if both sessions read the same balance before either writes.
- SQLite tests do not exercise `SELECT ... FOR UPDATE`, unique retry, or transaction isolation behavior.

### Stock increase/decrease

Current flow:

- Load product.
- Get/create balance.
- Convert KG to BAO when needed.
- Assign `balance.quantity = old + delta`.

Risk:

- This is a classic lost-update pattern under web concurrency unless the balance row is locked or an atomic SQL update is used.

### Customer ledger writes and recompute

Current flow:

- Append ledger rows.
- Recompute all ledger `balance_after` rows for the customer in timeline order.
- Assign `customer.current_balance`.

Risk:

- Concurrent payments or edits for the same customer can interleave ledger appends and recomputes.
- `balance_after` snapshots can be wrong even when final `current_balance` seems plausible.
- Customer row and customer ledger rows are not locked during mutation/recompute.

### Debt payment `ref_id` generation

Current flow:

- `select max(CustomerBalanceLedger.ref_id) where ref_type = 'DEBT_PAYMENT'`
- Return `max + 1`.

Risk:

- Two concurrent debt payments can compute the same `ref_id`.
- Deleting/editing a payment groups ledger rows by `(customer_id, ref_type, ref_id)`, so duplicate `ref_id` values for the same customer would corrupt edits/deletes.
- Even if duplicate ids happen across different customers, the identifier semantics become fragile for future global admin views and import/cutover tooling.

### Customer deletion/deactivation

Current flow:

- Check ledger existence.
- Hard-delete if no ledger history; otherwise deactivate.

Risk:

- A concurrent ledger insert can happen after the history check but before delete. PostgreSQL FK constraints help if the ledger insert commits first, but the service should lock the customer row during delete/deactivate decisions.

### Future receipt/invoice/return code generation

Current state:

- Receipt, invoice, return, and order code generation are not implemented yet.
- Desktop behavior uses sequential document-like identifiers in some flows.

Risk:

- Prefix/latest-code lookup patterns from the desktop app are unsafe under concurrency.
- Future document identifiers should be designed now around PostgreSQL sequences or locked counters, not query-latest-plus-one.

## 3. Recommended Debt Payment Identifier Strategy

### Options considered

#### PostgreSQL sequence only

Use a sequence such as `debt_payment_ref_id_seq`, call `nextval(...)`, and store the returned value in `customer_balance_ledgers.ref_id`.

Pros:

- Simple and fast.
- PostgreSQL guarantees uniqueness under concurrency.
- Minimal schema change.

Cons:

- The ledger still has no parent record for payment metadata.
- Edit/delete workflows need to query ledger rows directly.
- Harder to add idempotency keys, created-by user, audit status, external receipt number, or API resource URLs later.

#### Dedicated counter table

Use a table such as `document_counters(counter_name, next_value)` and update the target row with `SELECT ... FOR UPDATE`.

Pros:

- Flexible for receipt/invoice/return codes with date prefixes.
- Can centralize document number generation.

Cons:

- More moving parts for a simple debt payment reference.
- Easy to overuse before document-number requirements are final.
- Requires careful transaction handling and retry logic.

#### UUID/grouping column

Add a UUID grouping value to ledger rows and use it for debt payment edit/delete grouping.

Pros:

- Safe under concurrency without a sequence.
- Good for public API ids if exposed as opaque ids.

Cons:

- Existing `ref_id bigint` schema and desktop import semantics are numeric.
- Does not by itself provide a payment parent object.
- Makes future import comparisons less direct.

#### Explicit `debt_payments` table

Create `debt_payments` with an identity `id`, customer FK, amount, note, payment datetime, created/updated timestamps, and status fields if needed. Ledger rows keep `ref_type = 'DEBT_PAYMENT'` and set `ref_id = debt_payments.id`.

Pros:

- Best API resource model: `/customers/{id}/debt-payments/{payment_id}` can address a real row.
- PostgreSQL identity safely generates ids under concurrency.
- Clean place for payment metadata, idempotency, audit fields, source imports, and future receipt numbers.
- Ledger rows remain append-only audit effects tied to a parent payment.
- Edit/delete can lock the payment row first, then append/remove ledger rows in a controlled transaction.

Cons:

- Requires a schema migration and service rewrite before CRUD endpoints.
- Existing Batch 2 tests must be updated to expect a payment parent.

### Recommendation

Use an explicit `debt_payments` table.

Keep `customer_balance_ledgers.ref_type/ref_id` as the generic ledger reference mechanism, but for standalone debt payments make `ref_id` point to `debt_payments.id`. This keeps the ledger model compatible with future invoice, return, adjustment, and import references while giving standalone payments a real concurrency-safe parent.

Suggested initial table:

```text
debt_payments
  id bigint primary key generated by default as identity
  customer_id bigint not null references customers(id)
  amount numeric(14, 2) not null check (amount > 0)
  payment_datetime timestamptz not null
  note text null
  is_deleted boolean not null default false
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()
```

Indexes:

- `(customer_id, payment_datetime, id)`
- `(customer_id, is_deleted)`

Ledger behavior:

- Create payment: insert `debt_payments`, append one `DEBT_PAYMENT` ledger with `ref_id = debt_payments.id`.
- Edit payment: lock payment row, append rollback ledger, update payment metadata, append replacement ledger.
- Delete payment: lock payment row, either soft-delete payment and remove/rewrite ledger rows according to preserved desktop semantics, or keep payment with `is_deleted = true` and remove all ledger rows for that payment reference as Batch 2 currently requires.

For future receipt/invoice/return codes, use either PostgreSQL sequences or a dedicated document counter table. Do not reuse `max(code) + 1`.

## 4. Recommended Transaction/Locking Strategy

Use explicit service transaction boundaries once API routes are added. A route should open a request-scoped session and call one service method inside one transaction. Each mutating service method should assume it owns the transaction scope or be wrapped by a `unit_of_work` helper.

### Product row updates

Patterns:

- For update/delete/reactivate, load product with `SELECT ... FOR UPDATE`.
- For create, rely on the unique index for `product_code_base`; catch `IntegrityError` and retry lookup or return a conflict.
- For reactivation by code, lock the found inactive product row before checking name/unit mode and syncing prices.
- Lock price rows during price sync with `SELECT ... FOR UPDATE` filtered by `product_id`.

Repository methods to add:

- `get_product_for_update(session, product_id)`
- `get_product_by_code_base_for_update(session, product_code_base)`
- `load_product_prices_for_update(session, product_id)`

### Inventory balance updates

Patterns:

- Lock the product row when validating product mode and active status.
- Lock the balance row with `SELECT ... FOR UPDATE` before applying stock delta.
- For lazy balance creation:
  - Try insert.
  - On unique violation for `product_id`, roll back to savepoint, reload balance with `FOR UPDATE`, then apply the mutation.
- Alternative: create inventory balance at product creation only and remove lazy creation from mutating stock paths. This is simpler and preferable once product creation is stable.

Repository methods to add:

- `get_inventory_balance_for_update(session, product_id)`
- `create_inventory_balance(session, product)`

Avoid:

- Read `old_balance`, compute in Python, write back without a lock.

### Customer ledger writes and recompute

Patterns:

- Lock the customer row first with `SELECT ... FOR UPDATE`.
- Lock existing ledger rows for that customer before recompute:
  - `SELECT ... FROM customer_balance_ledgers WHERE customer_id = :id ORDER BY ... FOR UPDATE`
- Append new ledger rows in the same transaction.
- Flush new rows to obtain ids before recompute.
- Recompute all affected rows and `customers.current_balance` before commit.

Repository methods to add:

- `get_customer_for_update(session, customer_id)`
- `list_customer_ledgers_for_update(session, customer_id)`
- `find_debt_payment_ledgers_for_update(session, customer_id, payment_id)`

Ordering rule:

- Use `transaction_datetime ASC NULLS LAST`, `display_order ASC`, `id ASC` or define a consistent fallback to `created_at`.
- Batch 2 currently orders by `transaction_datetime`, `display_order`, `id`. The investigation doc says legacy behavior falls back to `created_at` when transaction datetime is missing. Before API work, choose and test one PostgreSQL ordering rule.

### Debt payment create/edit/delete

With the recommended `debt_payments` table:

- Create:
  - Lock customer row.
  - Insert debt payment row.
  - Append payment ledger using new payment id.
  - Lock/recompute customer ledgers.
- Edit:
  - Lock debt payment row.
  - Lock customer row.
  - Lock payment's existing ledger rows.
  - Append rollback and replacement ledgers.
  - Update payment metadata.
  - Recompute customer ledgers.
- Delete:
  - Lock debt payment row.
  - Lock customer row.
  - Lock payment ledger rows.
  - Remove all ledger rows for payment reference to preserve Batch 2 behavior, or mark them voided if audit policy changes later.
  - Mark payment deleted if keeping a parent audit row.
  - Recompute customer ledgers.

### Customer deletion/deactivation

Patterns:

- Lock customer row.
- Check ledger/history inside the same transaction.
- If history exists, set `is_active = false`.
- If no history, hard-delete.
- Future invoice/return tables must be included in the history check before API delete is exposed broadly.

### Future document/reference identifiers

Recommended pattern:

- Numeric internal ids: PostgreSQL identity columns.
- Human-visible document codes: a dedicated `document_counters` table with locked rows, or PostgreSQL sequences per document type/date partition if date gaps are acceptable.
- Never generate document numbers by querying the latest existing code and incrementing in application code.

## 5. Recommended PostgreSQL Test Strategy

### Docker compose

The repo already has a PostgreSQL 16 service in root `docker-compose.yml`:

- user: `quanlyhanghoa`
- password: `quanlyhanghoa_dev`
- database: `quanlyhanghoa_web`
- port: `5432`

Add a separate test database strategy instead of running destructive tests against the dev database:

- Preferred: create a second compose service or initialization script for `quanlyhanghoa_web_test`.
- Acceptable: tests connect to a configurable `TEST_DATABASE_URL`, create/drop schemas around each test session.

Suggested environment:

```text
DATABASE_URL=postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5432/quanlyhanghoa_web
TEST_DATABASE_URL=postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5432/quanlyhanghoa_web_test
```

### Pytest markers

Add markers:

- `unit`: pure/domain or SQLite-backed fast behavior tests.
- `integration`: PostgreSQL-backed tests requiring `TEST_DATABASE_URL`.
- `postgres`: tests that must run only against PostgreSQL.
- `concurrency`: tests that open multiple sessions/threads/tasks and assert locking behavior.

Default local command:

```powershell
pytest -m "not postgres and not concurrency"
```

PostgreSQL command:

```powershell
pytest -m "postgres"
```

Full database command:

```powershell
pytest
```

### Fixtures

Recommended fixtures:

- `postgres_engine`
  - Requires `TEST_DATABASE_URL`.
  - Skips with a clear message if unavailable.
- `migrated_postgres_db`
  - Runs Alembic `upgrade head` once per test session.
  - Drops/recreates the test schema or database before migration.
- `postgres_session`
  - Opens a transaction per test.
  - Rolls back after each test.
- `two_sessions`
  - Opens two independent sessions for lock/lost-update tests.

### Keep SQLite-style tests

Keep current SQLite service tests for fast rule coverage:

- validation rules,
- price compatibility,
- Decimal conversion,
- ledger event semantics,
- delete/deactivate branches.

Add PostgreSQL tests for behavior SQLite cannot prove:

- unique conflict translation,
- `SELECT ... FOR UPDATE`,
- balance lost-update prevention,
- debt payment id generation under concurrent sessions,
- Alembic live upgrade,
- numeric/timestamp behavior against PostgreSQL.

### Required concurrency tests

Add tests for:

- concurrent create product with same code: one success, one conflict; no duplicate products.
- concurrent reactivation of same inactive product: deterministic final prices or conflict policy.
- concurrent stock increments on same product: final balance equals sum of both deltas.
- concurrent customer debt payments: distinct payment ids and correct final balance.
- concurrent debt payment edit/delete conflict: one transaction wins; the other sees conflict/retries or fails cleanly.

## 6. Suggested Schema/Service Changes

Schema:

- Add `debt_payments` table.
- Keep `customer_balance_ledgers.ref_type/ref_id`, with `DEBT_PAYMENT` rows referencing `debt_payments.id`.
- Consider adding a partial or normal index on ledger payment references:
  - `(ref_type, ref_id)`
  - existing `(customer_id, ref_type, ref_id)` remains useful.
- Consider `transaction_datetime NOT NULL` for new API-created ledger rows while allowing nullable legacy/import rows only if necessary.
- Add an explicit model for future document counters only when receipts/invoices/returns are in scope.

Repositories:

- Add lock-specific repository methods rather than adding lock flags everywhere.
- Keep non-locking read methods for list/detail views.
- Add debt payment repository methods:
  - `add_debt_payment`
  - `get_debt_payment_for_update`
  - `list_debt_payments`
  - `mark_debt_payment_deleted`

Services:

- Replace `_next_debt_payment_ref_id` with debt payment row insertion.
- Wrap each mutating method in a transaction boundary.
- Translate SQLAlchemy `IntegrityError` into domain exceptions suitable for HTTP 409/422 mapping.
- Lock customer rows before ledger writes and recomputes.
- Lock inventory balance rows before stock writes.
- Prefer creating inventory balances during product creation to reduce lazy-create races.

API preparation:

- Do not expose CRUD endpoints until locking and identifier changes are in place.
- When API routes are added, ensure request handlers never call multiple mutating service methods in separate transactions for one business action.

## 7. Recommended Next Implementation Batch

Do not proceed directly to API CRUD endpoints.

Recommended next batch: **Phase 2 Batch 3: PostgreSQL-safe debt payment and locking foundation**.

Scope:

1. Add PostgreSQL integration test infrastructure:
   - `TEST_DATABASE_URL`.
   - pytest markers.
   - Alembic-upgraded PostgreSQL fixture that skips clearly when PostgreSQL is unavailable.
2. Add `debt_payments` model and Alembic migration.
3. Update customer service to create/edit/delete debt payments through the parent table.
4. Add lock-specific repository methods for customer, ledger, product, product prices, and inventory balance.
5. Update inventory stock mutation to lock balance rows.
6. Add PostgreSQL integration/concurrency tests for:
   - debt payment id uniqueness,
   - concurrent customer payments,
   - concurrent stock increments.
7. Keep existing SQLite service tests for fast behavior coverage.

Reasoning:

- API endpoints would multiply the surface area of unsafe write behavior.
- Fixing identifiers and locking first gives later API tests a stable persistence contract.
- The repo already has Docker compose, but live PostgreSQL verification was blocked by local environment/auth issues. The next batch should make PostgreSQL tests explicit and skippable rather than relying on ad hoc manual attempts.

## 8. Explicit Out-of-Scope Items

Out of scope for this investigation:

- Implementing code.
- Adding FastAPI CRUD endpoints.
- Adding React/frontend code.
- Changing desktop reference files under `QuanLyHangHoa/`.
- Implementing sales, returns, orders, reporting, or attendance.
- Implementing receipts or inventory adjustments.
- Executing data import from `app.db` or `attendance.db`.
- Finalizing human-visible invoice/receipt/return code formats.
- Designing authentication/authorization.
- Deciding audit retention policy for deleted debt payment ledger rows beyond preserving current Batch 2 semantics.

