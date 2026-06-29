# Inventory + Customer Service Batch 2 Implementation

## Summary

Phase 2 Batch 2 adds the backend service foundation for inventory product core and customer/debt core. The work stays below the API layer: no FastAPI CRUD routes, frontend UI, sales, returns, orders, reporting, attendance, receipts, adjustments, or data import execution were implemented.

The desktop reference repository under `QuanLyHangHoa/` was not modified.

## Files Created or Modified

Backend domain and application files:

- `backend/app/domain/__init__.py`
- `backend/app/domain/customer.py`
- `backend/app/domain/inventory.py`
- `backend/app/domain/money.py`
- `backend/app/domain/quantity.py`
- `backend/app/domain/exceptions.py`
- `backend/app/application/__init__.py`
- `backend/app/application/inventory_service.py`
- `backend/app/application/customer_service.py`
- `backend/app/schemas/inventory.py`
- `backend/app/schemas/customers.py`

Persistence foundation files:

- `backend/app/infrastructure/db/repositories/__init__.py`
- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/app/infrastructure/db/models/inventory.py`
- `backend/app/infrastructure/db/models/customer.py`
- `backend/alembic/versions/20260515_0001_inventory_customer_schema.py`

Tests:

- `backend/tests/service/test_inventory_service.py`
- `backend/tests/service/test_customer_service.py`

Documentation:

- `docs/INVENTORY_CUSTOMER_SERVICE_BATCH2_IMPLEMENTATION.md`

## Service Behavior Implemented

Inventory service:

- Creates and updates products with normalized product code and name.
- Enforces `BAO_KG` and `BICH` unit modes.
- Enforces valid enabled price combinations:
  - `BAO_KG` supports `BAO`, `KG`, or both.
  - `BICH` supports only `BICH`.
- Requires at least one enabled price and rejects non-positive enabled prices.
- Rejects active duplicate product codes.
- Reactivates an inactive product only when code, name, and unit mode match.
- Rejects recreation of inactive product codes with a different name or unit mode.
- Rejects product unit-mode changes after creation.
- Disables removed price rows instead of deleting them.
- Creates inventory balance rows lazily.
- Supports stock increase/decrease for `BAO`, `KG`, and `BICH`.
- Converts `KG` to canonical `BAO` quantity using `BAO_TO_KG_RATIO = 25`.
- Allows negative stock.
- Hard-deletes unused products; history detection remains a future-compatible placeholder in this batch.

Customer service:

- Creates and updates customers with trimmed names and blank optional fields normalized to `None`.
- Allows positive, zero, and negative current balances.
- Rejects negative `total_sales`.
- Creates an `OPENING_BALANCE` ledger row for non-zero opening balances.
- Uses `1900-01-01 00:00:00` for opening-balance transaction time.
- Creates standalone `DEBT_PAYMENT` ledger rows with negative deltas.
- Rejects zero or negative debt payment amounts.
- Allows overpayment to make customer balance negative.
- Edits debt payments by appending rollback and replacement ledgers.
- Deletes debt payments by removing all ledger rows for the payment reference and recomputing the customer balance.
- Recomputes ledger `balance_after` in `transaction_datetime`, `display_order`, `id` order.
- Hard-deletes unused customers and deactivates customers with ledger history.

## Repository Design

Repositories are thin SQLAlchemy query helpers. They receive an explicit `Session` per method and do not own global sessions.

Inventory repository supports product lookup, product listing, product creation, product price loading, inventory balance loading/creation, and a future-compatible product history placeholder.

Customer repository supports customer lookup/listing, customer creation, ordered ledger loading, debt-payment ledger lookup, and ledger-history detection.

## Schema and Portability Notes

Batch 1 schema models remain PostgreSQL-oriented. For service tests, model primary-key types use a SQLite variant so the same SQLAlchemy models can run against an in-memory SQLite engine without changing production PostgreSQL intent.

Blank-string check constraints use SQL-standard `trim(...)` instead of PostgreSQL-specific `btrim(...)` so the metadata can be exercised in lightweight tests.

## Tests Added

Inventory service tests cover:

- `BAO_KG` products with `BAO`, `KG`, and both prices.
- `BICH` products with `BICH` price.
- Invalid unit/price combinations.
- Missing and non-positive enabled prices.
- Product code/name normalization.
- Product name and price updates.
- Disabled price row retention.
- Unit-mode change rejection.
- Active duplicate code rejection.
- Unused product hard delete.
- Inactive product reactivation and conflict rejection.
- `BAO`, `KG`, and `BICH` stock changes.
- Negative stock.
- `KG` conversion using the 25 kg per bao ratio.
- Inactive products excluded from default listing.

Customer service tests cover:

- Optional field normalization.
- Positive and negative opening balances.
- Opening-balance ledger creation.
- Blank name and negative `total_sales` rejection.
- Profile updates and note clearing.
- Standalone debt payment ledger behavior.
- Zero/negative debt payment rejection.
- Overpayment producing negative balance.
- Debt payment edit rollback/replacement behavior.
- Debt payment deletion and recomputation.
- Hard delete for unused customers.
- Deactivation for customers with ledger history.
- Ledger recomputation ordering by datetime, display order, and id.
- Customer list filtering for inactive rows and positive debt.

## Commands Run and Results

From `backend/`:

- `pytest`
  - Result: `45 passed in 2.88s`
- `python -m compileall app tests`
  - Result: success
- `alembic upgrade head`
  - Result: failed because local PostgreSQL authentication rejected the configured `quanlyhanghoa` credentials.

Environment check:

- `docker ps`
  - Result: Docker daemon/config was unavailable, so PostgreSQL could not be started through `docker-compose.yml` in this environment.

## Caveats

- Service tests use SQLite in memory for fast domain/service behavior validation. They do not prove PostgreSQL row locking, isolation, concurrent updates, or numeric behavior under production load.
- `InventoryRepository.product_has_history` is intentionally a placeholder because sales, receipt, adjustment, and return history tables are out of scope for this batch.
- Debt payment `ref_id` generation currently uses a simple `max(ref_id) + 1` query. That is acceptable for the service foundation tests, but must be replaced or protected with PostgreSQL-safe sequencing/locking before concurrent production use.
- No API request/response schemas or FastAPI CRUD routes were added.
- No import execution from the desktop `app.db` was added.

## Recommended Next Batch

Implement Phase 2 Batch 3 as API-facing inventory/customer CRUD endpoints:

- Add request/response schemas for product, price, inventory balance, customer, and debt payment operations.
- Add FastAPI routes that call the new services through request-scoped sessions.
- Add API tests for validation errors, inactive filtering, debt payment edits/deletes, and stock operations.
- Add PostgreSQL-backed migration/test execution once local Docker or a valid PostgreSQL database is available.
