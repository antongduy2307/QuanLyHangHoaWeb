# Inventory + Customer Core Investigation

## 1. Summary

Phase 2 should migrate the inventory and customer/debt core before sales, returns, orders, reporting, or attendance. These two domains are the foundation for later transactional flows:

- Inventory provides product identity, sellable units, prices, and stock balances.
- Customer provides customer identity, opening balances, debt ledger history, and standalone debt payments.

The desktop implementation is already separated reasonably well into SQLAlchemy models, repositories, services, DTOs, mappers, validators, controllers, UI, and tests. The service/model rules can be adapted, but they should not be copied blindly. The web backend must redesign persistence and transaction handling for PostgreSQL, concurrent users, API schemas, row locking, and future sales/returns/attendance integrations.

No backend code should be implemented in this investigation step.

## 2. Desktop Files Inspected

Inventory files:

- `QuanLyHangHoa/modules/inventory/models.py`
- `QuanLyHangHoa/modules/inventory/repository.py`
- `QuanLyHangHoa/modules/inventory/service.py`
- `QuanLyHangHoa/modules/inventory/dto.py`
- `QuanLyHangHoa/modules/inventory/mappers.py`
- `QuanLyHangHoa/modules/inventory/validators.py`
- `QuanLyHangHoa/core/enums.py`
- `QuanLyHangHoa/tests/test_inventory_service.py`
- `QuanLyHangHoa/tests/test_inventory_transactions.py`
- `QuanLyHangHoa/tests/test_product_search_ui.py` as UI-only behavior reference

Customer/debt files:

- `QuanLyHangHoa/modules/customer/models.py`
- `QuanLyHangHoa/modules/customer/repository.py`
- `QuanLyHangHoa/modules/customer/service.py`
- `QuanLyHangHoa/modules/customer/controller.py`
- `QuanLyHangHoa/modules/customer/dto.py`
- `QuanLyHangHoa/modules/customer/mappers.py`
- `QuanLyHangHoa/modules/customer/validators.py`
- `QuanLyHangHoa/core/migrations.py`
- `QuanLyHangHoa/tests/test_customer_service.py`
- `QuanLyHangHoa/tests/test_customer_history.py`
- `QuanLyHangHoa/tests/test_customer_list_search.py` as UI-only behavior reference
- `QuanLyHangHoa/tests/test_customer_ui.py` as UI-only behavior reference
- `QuanLyHangHoa/tests/test_ledger_ordering_migration.py`
- `QuanLyHangHoa/tests/test_customer_invoice_payment_migration.py`

Related files were intentionally not included as Phase 2 implementation targets:

- Sales, returns, orders, reporting, attendance, and all `ui/` modules.

## 3. Inventory Business Rules to Preserve

Product identity and validation:

- `product_code_base` is required, trimmed, uppercased, unique, and indexed.
- `product_name` is required, trimmed, and indexed.
- `unit_mode` is required and currently supports `BAO_KG` and `BICH`.
- `BAO_KG` products may enable `BAO`, `KG`, or both sellable prices.
- `BICH` products may enable only `BICH`.
- At least one sellable price must be enabled.
- Enabled prices must be greater than zero.
- Product unit mode cannot be changed after creation in the current desktop service.

Price behavior:

- `product_prices` is unique by `(product_id, unit_type)`.
- Updating product prices toggles `is_enabled` on existing unit rows instead of deleting historical price rows.
- Disabled unit prices should remain stored so re-enabling a unit can reuse the row.

Stock behavior:

- `BAO_KG` stock is stored canonically only in `InventoryBalance.on_hand_bao_decimal`.
- `KG` is a derived sell/reporting unit using `BAO_TO_KG_RATIO = 25`.
- `BICH` stock is stored canonically only in `InventoryBalance.on_hand_bich_integer`.
- Negative stock is allowed and must persist.
- `get_available_quantity(product, KG)` derives kilograms from bag balance.
- Increasing/decreasing stock accepts the requested unit type and converts to canonical storage as needed.

Receipts and adjustments:

- Inventory receipts can contain multiple products.
- Receipt codes are generated with `NKYYYYMMDD-###` in the desktop implementation.
- Receipt line quantity must be greater than zero at save time.
- Inventory adjustment records `old_quantity`, `new_quantity`, and computed `delta_quantity`.
- `old_quantity` can be negative and must reflect the true pre-adjustment balance.
- `new_quantity` must be non-negative.
- Adjustment can move stock from negative to non-negative.

Deletion/reactivation:

- Product delete mode is `hard_delete` only when there is no history.
- Product history includes invoice items, return items, inventory receipt items, and inventory adjustment items.
- A product with history is deactivated by setting `is_active = false`.
- Active product lists exclude inactive products by default.
- Product recreation with the same inactive code and same normalized name/reactivation-compatible unit mode reactivates the old row.
- Recreation with the same inactive code but different name or unit mode is rejected.
- Active duplicate product codes are rejected.

DTO/read behavior:

- Inventory list rows include active flag, display stock, and enabled price summary.
- UI search currently searches by product name only, not product code. This is a UI behavior reference, not necessarily an API restriction.

## 4. Customer/Debt Business Rules to Preserve

Customer identity and validation:

- `customer_name` is required and trimmed.
- `phone`, `address`, and `note` are optional and normalized to `None` when blank.
- `current_balance` can be positive, zero, or negative.
- `total_sales` must not be negative.
- `is_walk_in` exists for walk-in customer semantics, but Phase 2 should not implement sales behavior.
- `is_active` soft delete is used when history exists.

Opening balance:

- Creating a customer with non-zero initial balance creates an `OPENING_BALANCE` ledger row.
- Desktop uses `1900-01-01 00:00:00` as the opening balance transaction datetime.
- Opening balance affects `current_balance` but not `total_sales`.
- Updating a customer target balance before trade/debt history creates a balance adjustment that also uses opening-balance ordering semantics.

Customer balance ledger:

- Balance changes must be represented by `CustomerBalanceLedger`; `current_balance` is a derived snapshot maintained by service code.
- Ledger rows include `event_type`, `ref_type`, `ref_id`, `source_ref_type`, `source_ref_id`, `display_order`, `amount_delta`, `balance_after`, `transaction_datetime`, `created_at`, and `note`.
- `amount_delta` cannot be zero for normal balance adjustments.
- `balance_after` is recomputed by ordering ledgers by:
  1. `transaction_datetime ASC`
  2. `display_order ASC`
  3. `id ASC`
- `effective_transaction_datetime` falls back to `created_at` when `transaction_datetime` is missing.
- Balance can go negative, including from overpayment.
- Standalone debt payments use `event_type = DEBT_PAYMENT`, `ref_type = DEBT_PAYMENT`, and negative `amount_delta`.
- Debt payments reduce balance but do not change `total_sales`.

Debt payment edit/delete behavior:

- Editing a debt payment does not mutate the original ledger in place.
- Editing appends a rollback ledger with `event_type = DEBT_PAYMENT_EDIT_ROLLBACK`, then appends a replacement `DEBT_PAYMENT` ledger with the same `ref_id`.
- Updating debt payment datetime updates all ledgers for the debt payment reference and recomputes balances.
- Deleting a debt payment removes all ledgers for the debt payment `ref_id` and recomputes later balance snapshots.
- Invalid debt payment amounts of zero or negative are rejected.
- Attempting to edit a non-debt-payment ledger is rejected.

Deletion:

- Unused customers can be hard-deleted.
- Customers with business history are deactivated and excluded from default active customer lists.
- Customer history includes ledgers now and later will include invoices and returns.

Search/sort/read behavior:

- Customer lists can sort by name, balance, and sales ascending/descending.
- Customer list can filter only customers with positive debt.
- Inactive customers are hidden by default.
- Phone duplicate checking currently exists in controller logic and should be replaced by API/service validation.

Legacy/migration behavior:

- Desktop migrations backfill `source_ref_type`, `source_ref_id`, and `display_order`.
- Legacy overpayment notes like `Overpayment from invoice <code>` are interpreted as invoice-linked debt payments.
- Phase 2 should not implement invoice migration logic yet, but import validation must detect ledger rows that depend on future sales migration.

## 5. Reusable Code vs Code Requiring Redesign

Reusable or directly adaptable:

- Enum concepts from `core/enums.py`: `UnitMode`, `UnitType`, `BAO_TO_KG_RATIO`, and allowed unit mapping.
- Domain validation concepts: required product code/name/customer name, unit-price compatibility, non-zero ledger deltas, positive debt payment amounts.
- Inventory model field intent and constraints.
- Customer model field intent and ledger ordering semantics.
- Service method behavior for:
  - product create/update/delete/reactivate,
  - price sync,
  - canonical stock conversion,
  - receipt and adjustment behavior,
  - customer create/update/delete,
  - opening balance,
  - standalone debt payment create/update/delete,
  - ledger recomputation.
- Tests can be rewritten as pytest service/API tests, preserving expected outcomes.

Requires redesign:

- Repository session lifecycle. Desktop repositories lazily own sessions and can be rebound with `use_session()`. Web backend should use request-scoped sessions and explicit transaction boundaries.
- Controller layer. Desktop controllers prepare UI-specific read models and should not be ported as backend controllers. FastAPI routers and application services should replace them.
- DTO/mappers that contain display strings such as `on_hand_display` and `enabled_price_summary`. The API should return structured values; display formatting belongs mostly in the frontend.
- Receipt/document code generation. Desktop queries latest code by prefix, which can race under concurrent web users. Use PostgreSQL sequences, locked counter rows, or a dedicated document-number service.
- `time_ns()` debt payment reference generation. Replace with database identity, UUID, or a sequence-backed business reference.
- SQLite-specific SQL, `create_all`, and manual migration helpers. Web must use Alembic revisions.
- Any PyQt/PySide UI code, widget behavior, table behavior, and desktop QSettings code.
- Customer history that depends on sales/returns should be deferred. Only customer ledger/debt endpoints should be in Phase 2.

## 6. Proposed PostgreSQL Schema Outline

Use SQLAlchemy 2.x models with Alembic migrations. Suggested names are plural snake_case tables matching desktop names where practical to simplify import mapping.

### Enums

Prefer PostgreSQL enum types or check-constrained strings. For migration flexibility, check-constrained strings are acceptable initially.

- `unit_mode`: `BAO_KG`, `BICH`
- `unit_type`: `BAO`, `KG`, `BICH`

### products

- `id`: bigint primary key
- `product_code_base`: varchar(64), not null, unique
- `product_name`: varchar(255), not null, indexed
- `unit_mode`: enum/string, not null
- `is_active`: boolean, not null, default true, indexed
- `created_at`: timestamptz, not null, default now
- `updated_at`: timestamptz, not null, default now

Constraints:

- trimmed code not blank
- trimmed name not blank
- unique `product_code_base`

### product_prices

- `id`: bigint primary key
- `product_id`: bigint, FK `products.id`, not null, on delete cascade
- `unit_type`: enum/string, not null
- `price`: numeric(14, 2), not null, default 0
- `is_enabled`: boolean, not null, default true

Constraints:

- unique `(product_id, unit_type)`
- `price >= 0`
- service-level rule: enabled prices must be `> 0`
- service-level rule: unit type must match product unit mode

### inventory_balances

- `id`: bigint primary key
- `product_id`: bigint, FK `products.id`, not null, unique, on delete cascade
- `on_hand_bao_decimal`: numeric(14, 3), nullable
- `on_hand_bich_integer`: numeric(14, 3), nullable
- `updated_at`: timestamptz, not null, default now

Constraints:

- exactly one canonical quantity column is non-null
- negative values are allowed
- service-level rule: `BAO_KG` uses `on_hand_bao_decimal`, `BICH` uses `on_hand_bich_integer`

### inventory_receipts

Phase 2 can include this if stock receipt behavior is part of product core.

- `id`: bigint primary key
- `receipt_code`: varchar(64), not null, unique
- `created_at`: timestamptz, not null, default now
- `note`: text, nullable

### inventory_receipt_items

- `id`: bigint primary key
- `receipt_id`: bigint, FK `inventory_receipts.id`, not null, on delete cascade
- `product_id`: bigint, FK `products.id`, not null, restrict delete
- `quantity`: numeric(14, 3), not null
- `note`: text, nullable

Constraints:

- `quantity > 0`

### inventory_adjustments

- `id`: bigint primary key
- `created_at`: timestamptz, not null, default now
- `note`: text, nullable

### inventory_adjustment_items

- `id`: bigint primary key
- `adjustment_id`: bigint, FK `inventory_adjustments.id`, not null, on delete cascade
- `product_id`: bigint, FK `products.id`, not null, restrict delete
- `old_quantity`: numeric(14, 3), not null
- `new_quantity`: numeric(14, 3), not null
- `delta_quantity`: numeric(14, 3), not null
- `note`: text, nullable

Constraints:

- `new_quantity >= 0`
- `old_quantity` may be negative

### customers

- `id`: bigint primary key
- `customer_name`: varchar(255), not null, indexed
- `phone`: varchar(32), nullable, indexed
- `address`: varchar(255), nullable
- `note`: text, nullable
- `current_balance`: numeric(14, 2), not null, default 0
- `total_sales`: numeric(14, 2), not null, default 0
- `is_walk_in`: boolean, not null, default false
- `is_active`: boolean, not null, default true, indexed
- `created_at`: timestamptz, not null, default now
- `updated_at`: timestamptz, not null, default now

Constraints:

- trimmed customer name not blank
- `total_sales >= 0`
- no unique constraint on phone initially unless product requirements confirm it

### customer_balance_ledgers

- `id`: bigint primary key
- `customer_id`: bigint, FK `customers.id`, not null, on delete cascade
- `event_type`: varchar(50), not null
- `ref_type`: varchar(50), not null
- `ref_id`: bigint, not null
- `source_ref_type`: varchar(50), nullable
- `source_ref_id`: bigint, nullable
- `display_order`: integer, not null, default 0
- `amount_delta`: numeric(14, 2), not null
- `balance_after`: numeric(14, 2), not null
- `transaction_datetime`: timestamptz, nullable
- `created_at`: timestamptz, not null, default now
- `note`: text, nullable

Indexes:

- `(customer_id, transaction_datetime, display_order, id)` for recomputation/history
- `(customer_id, ref_type, ref_id)` for reference lookup
- `(customer_id, event_type)` for debt payment lookup
- `(customer_id, source_ref_type, source_ref_id)` for future invoice-linked payment lookup

Constraints:

- event/ref type not blank
- `amount_delta != 0` may be enforced for normal write paths; keep DB check optional because legacy/import rows may need cleanup first

## 7. Proposed Backend Package/Module Structure

Keep the current skeleton and add domain modules without UI concepts:

```text
backend/app/
  api/
    routes/
      inventory.py
      customers.py
  application/
    inventory_service.py
    customer_service.py
  domain/
    enums.py
    exceptions.py
    inventory.py
    customer.py
  infrastructure/
    db/
      models/
        inventory.py
        customer.py
      repositories/
        inventory.py
        customer.py
      base.py
      session.py
  schemas/
    inventory.py
    customers.py
  importers/
    app_db_inventory_customer_validator.py
tests/
  service/
    test_inventory_service.py
    test_customer_service.py
  api/
    test_inventory_api.py
    test_customer_api.py
  migration/
    test_app_db_inventory_customer_validation.py
```

Design notes:

- API routers should depend on a request-scoped SQLAlchemy session.
- Application services should own transactions and row locking.
- Repositories should be thin persistence/query helpers.
- Pydantic schemas should expose structured values, not desktop display strings.
- Domain helpers should hold pure calculations like unit compatibility and `BAO <-> KG` conversion.

## 8. Proposed API Endpoints

Inventory:

- `GET /api/inventory/products`
  - query: `include_inactive`, `search`, `unit_mode`, `sort`
- `POST /api/inventory/products`
  - create product with enabled prices
- `GET /api/inventory/products/{product_id}`
- `PATCH /api/inventory/products/{product_id}`
  - update name and enabled prices; do not allow unit mode change in milestone 1
- `DELETE /api/inventory/products/{product_id}`
  - returns `{action: "hard_deleted" | "deactivated"}`
- `POST /api/inventory/products/{product_id}/reactivate`
  - optional explicit endpoint if create-by-code reactivation is not desired in API semantics
- `GET /api/inventory/products/{product_id}/balance`
- `POST /api/inventory/receipts`
  - optional within first milestone if stock receipt behavior is included
- `POST /api/inventory/adjustments`
  - optional within first milestone if stock adjustment behavior is included

Customer:

- `GET /api/customers`
  - query: `include_inactive`, `search`, `only_positive_debt`, `sort`
- `POST /api/customers`
  - create customer with optional opening balance
- `GET /api/customers/{customer_id}`
- `PATCH /api/customers/{customer_id}`
  - update profile and optional target balance adjustment
- `DELETE /api/customers/{customer_id}`
  - returns `{action: "hard_deleted" | "deactivated"}`
- `GET /api/customers/{customer_id}/ledger`
  - raw ledger timeline
- `GET /api/customers/{customer_id}/debt-payments`
  - standalone debt payment history
- `POST /api/customers/{customer_id}/debt-payments`
  - create standalone debt payment
- `PATCH /api/customers/{customer_id}/debt-payments/{ledger_id}`
  - edit amount/note/date through rollback/replacement semantics
- `PATCH /api/customers/{customer_id}/debt-payments/{ledger_id}/datetime`
  - optional separate endpoint if timestamp editing remains distinct
- `DELETE /api/customers/{customer_id}/debt-payments/{ledger_id}`
  - delete all ledger rows for the payment reference and recompute balances

Do not add sales, returns, orders, reporting, or attendance endpoints in Phase 2.

## 9. Transaction/Concurrency Risks

Product code creation/reactivation:

- Two concurrent creates with the same code can race. Rely on unique constraint and handle integrity errors.
- Reactivation must lock the matching product row before checking name/unit compatibility and updating prices.

Price sync:

- Concurrent price updates can overwrite enabled flags. Lock the product row and existing price rows before syncing prices.

Inventory balance:

- Concurrent stock increases/decreases can lose updates if both read the same balance then write new values.
- Use `SELECT ... FOR UPDATE` on the product balance row during stock changes, receipts, and adjustments.
- Ensure `get_or_create_balance` is safe under concurrency using unique constraint on `product_id` and retry-on-integrity-error logic.

Receipt/document code generation:

- Desktop prefix-based latest-code lookup is unsafe under concurrency.
- Use a database-backed sequence/counter table or PostgreSQL sequence per document type.
- Phase 2 can defer receipt/adjustment documents if code generation is not ready, but balance mutation tests should still define the target behavior.

Customer balance ledger:

- Concurrent payments or adjustments for the same customer can corrupt `balance_after` snapshots.
- Lock the customer row and relevant ledger rows during any ledger write/recompute.
- Recompute should run inside the same transaction as ledger mutation.
- Consider using an append-only ledger plus materialized `current_balance`; keep `balance_after` snapshots for audit/read compatibility.

Debt payment reference identifiers:

- Desktop `time_ns()` is not appropriate for multi-user web use.
- Use a PostgreSQL sequence, UUID, or a dedicated `debt_payment_id` grouping column.
- Recommended redesign: add `payment_ref_id` or keep `ref_id` sequence-backed for `DEBT_PAYMENT` references.

Timestamp ordering:

- Multiple ledger rows can share the same business timestamp. `display_order` and `id` must remain part of ordering.
- Use `timestamptz` consistently or clearly document local-business timestamp behavior.

Deletes:

- Hard delete must not remove rows referenced by future sales/returns/attendance.
- For Phase 2 before those modules exist, schema should still anticipate restrict/cascade behavior for later tables.

## 10. Data Import/Validation Risks

Import validation should read existing `app.db` without mutating it.

Products:

- Detect blank product codes/names.
- Detect duplicate `product_code_base` after trim/uppercase normalization.
- Validate `unit_mode` values are known.
- Check inactive products with duplicate codes and historical rows.
- Check products missing inventory balance rows.

Product prices:

- Validate each product has at least one enabled price when active.
- Validate price unit type is allowed by product unit mode.
- Validate enabled prices are greater than zero.
- Detect duplicate `(product_id, unit_type)` rows.

Inventory balances:

- Validate exactly one canonical quantity column is populated per product.
- Validate `BAO_KG` uses `on_hand_bao_decimal`.
- Validate `BICH` uses `on_hand_bich_integer`.
- Preserve negative values.
- Validate numeric precision fits PostgreSQL `numeric(14, 3)`.

Customers:

- Detect blank customer names.
- Validate balances and total sales fit `numeric(14, 2)`.
- Preserve inactive customers.
- Preserve optional phone/address/note.
- Decide whether phone duplicate warnings are informational or blocking.

Customer balance ledger:

- Validate all ledger rows reference existing customers.
- Validate event/ref type are non-blank.
- Validate amount and balance values fit `numeric(14, 2)`.
- Validate transaction ordering can recompute the stored `balance_after` values.
- Validate `customers.current_balance` equals recomputed final ledger balance.
- Detect missing `transaction_datetime` values and define fallback behavior.
- Detect legacy rows missing `source_ref_type`, `source_ref_id`, and `display_order`.
- Detect invoice/return-linked ledger rows but do not migrate sales/returns yet; mark them as dependencies for later phases.

General:

- Produce row counts, warning counts, and blocking error counts.
- Import validation should be idempotent and read-only.
- Do not migrate actual data in Phase 2 implementation until schema and invariant tests are stable.

## 11. Recommended Implementation Plan in Small Steps

1. Add domain enums and exception types.
   - Port `UnitMode`, `UnitType`, `BAO_TO_KG_RATIO`, and validation errors.

2. Add PostgreSQL models and Alembic migration for products, prices, balances, customers, and ledgers.
   - Keep receipts/adjustments in the same migration only if the first implementation milestone includes stock documents.

3. Add repository methods.
   - Implement simple CRUD/load methods.
   - Keep session ownership outside repositories.
   - Add row-locking methods where services need concurrency protection.

4. Add inventory service.
   - Product create/update/delete/reactivate.
   - Price sync.
   - Balance get/increase/decrease.
   - Optional receipts/adjustments.

5. Add customer service.
   - Customer create/update/delete.
   - Opening balance ledger creation.
   - Balance adjustment.
   - Debt payment create/update/delete.
   - Ledger recomputation under row lock.

6. Add Pydantic schemas.
   - Keep API request/response payloads structured.
   - Avoid desktop display-only strings.

7. Add API routes.
   - Inventory product/balance endpoints first.
   - Customer and standalone debt payment endpoints second.

8. Add import validation command or service.
   - Read `app.db`.
   - Validate products, prices, balances, customers, and ledgers only.
   - Write a machine-readable report and concise human summary.

9. Defer sales, returns, orders, reporting, attendance, and React UI.

## 12. Recommended Tests for the Implementation Phase

Port or rewrite first as pytest service tests:

Inventory:

- create `BAO_KG` product with BAO-only, KG-only, and both prices.
- create `BICH` product with BICH price.
- reject invalid unit/price combinations.
- update product name.
- update enabled prices and ensure disabled rows remain stored.
- reject unit mode change.
- hard-delete unused product.
- deactivate product with receipt/adjustment history.
- reactivate inactive product with same code/name/unit mode.
- reject inactive-code recreation with different name.
- reject inactive-code recreation with different unit mode.
- reject active duplicate product code.
- active list excludes inactive products.
- `bao_to_kg` and `kg_to_bao` conversion.
- stock increase/decrease for BAO, KG, and BICH.
- negative stock persists.
- adjustment records negative `old_quantity` correctly.

Customer:

- create customer with address/note.
- create customer with opening balance and one opening ledger.
- update customer profile and clear note.
- update target balance creates adjustment ledger.
- balance adjustment does not change total sales.
- standalone debt payment creates `DEBT_PAYMENT` ledger and reduces balance.
- overpayment can make balance negative.
- debt payment invalid zero/negative amount fails.
- rapid debt payments get distinct reference ids.
- debt payment transaction datetime is preserved.
- edit debt payment appends rollback and replacement ledgers.
- edit debt payment can change note/date.
- edit invalid/non-debt ledger fails.
- delete debt payment removes all ledgers for the reference and recomputes later `balance_after`.
- unused customer hard-deletes.
- customer with ledger history deactivates.
- ledger recomputation order by `transaction_datetime`, `display_order`, `id`.

API tests:

- health still passes.
- product create/list/get/update/delete endpoint behavior.
- product balance endpoint returns structured canonical and derived quantities.
- customer create/list/get/update/delete endpoint behavior.
- debt payment create/update/delete endpoint behavior.
- validation errors return consistent HTTP error shape.

Migration/import validation tests:

- detects duplicate normalized product code.
- detects invalid product price unit.
- detects missing inventory balance.
- accepts negative inventory balance.
- detects customer current balance mismatch from ledger recomputation.
- detects missing/legacy ledger ordering metadata.
- reports sales/returns-dependent ledger rows as deferred dependencies.

Concurrency tests:

- two concurrent product creates with same code result in one success and one conflict.
- two concurrent stock updates on same product do not lose updates.
- two concurrent debt payments on same customer produce correct final balance and ordered ledger snapshots.

## 13. Explicit Out-of-Scope Items

Do not implement in this milestone:

- Sales invoices.
- Returns.
- Orders.
- Reporting.
- Attendance.
- Attendance-to-inventory stock effects.
- React frontend.
- PyQt/PySide UI code.
- Desktop controllers as web controllers.
- Desktop packaging, updater, installer, or QSettings behavior.
- Full data import/cutover execution.
- Legacy invoice payment migration execution.
- Customer trade history that requires invoices/returns.
- Product search UI behavior beyond API query support.

The Phase 2 implementation should produce a backend-only foundation for inventory and customer/debt, with tests and import validation strong enough to support later sales/returns/attendance migration.

