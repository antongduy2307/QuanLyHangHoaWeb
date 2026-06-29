# PostgreSQL Locking + Debt Payment Batch 3 Implementation

## Summary

Phase 2 Batch 3 adds the persistence foundation needed before exposing inventory/customer write behavior through FastAPI APIs. The main change is replacing temporary debt payment `max(ref_id) + 1` behavior with a real `debt_payments` parent table whose PostgreSQL identity `id` is used by customer ledger rows as `ref_id`.

This batch also adds explicit repository methods for row-locking query paths and introduces PostgreSQL integration test fixtures that skip clearly when `TEST_DATABASE_URL` is unavailable.

No FastAPI CRUD endpoints, React UI, sales, returns, orders, reporting, attendance, receipts, adjustments, auth, document counters, or import execution were implemented.

The desktop reference repository under `QuanLyHangHoa/` was not modified.

## Files Created or Modified

Backend models and migrations:

- `backend/app/infrastructure/db/models/customer.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/alembic/versions/20260515_0002_debt_payments.py`

Repositories and services:

- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/app/application/inventory_service.py`
- `backend/app/application/customer_service.py`
- `backend/app/schemas/customers.py`

Tests and pytest configuration:

- `backend/pyproject.toml`
- `backend/tests/conftest.py`
- `backend/tests/integration/test_postgres_schema.py`
- `backend/tests/integration/test_customer_debt_payment_postgres.py`
- `backend/tests/integration/test_inventory_stock_postgres.py`
- `backend/tests/service/test_customer_service.py`
- `backend/tests/unit/test_db_metadata.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`

Documentation:

- `docs/POSTGRES_LOCKING_DEBT_PAYMENT_BATCH3_IMPLEMENTATION.md`

## `debt_payments` Schema Details

New table:

- `id`: bigint primary key with PostgreSQL identity
- `customer_id`: bigint FK to `customers.id`, required
- `amount`: `numeric(14, 2)`, required
- `payment_datetime`: timezone-aware timestamp, required
- `note`: text nullable
- `is_deleted`: boolean, required, default false
- `created_at`: timezone-aware timestamp, required
- `updated_at`: timezone-aware timestamp, required

Constraints and indexes:

- `ck_debt_payments_amount_positive`: `amount > 0`
- `ix_debt_payments_customer_timeline`: `(customer_id, payment_datetime, id)`
- `ix_debt_payments_customer_deleted`: `(customer_id, is_deleted)`
- generated FK index on `customer_id`

Ledger semantics:

- Standalone debt payment ledgers still use `ref_type = "DEBT_PAYMENT"`.
- `customer_balance_ledgers.ref_id` now points to `debt_payments.id`.
- The old `max(ref_id) + 1` approach has been removed.

## Service Behavior Changes

Customer service:

- `create_debt_payment` now:
  - locks the customer row;
  - inserts a `DebtPayment` parent row;
  - appends a `DEBT_PAYMENT` ledger using the parent id as `ref_id`;
  - recomputes the customer balance;
  - returns a structured `DebtPaymentResult` with both payment and ledger data.
- `edit_debt_payment` now:
  - accepts a debt payment id;
  - locks the payment and customer rows;
  - locks existing ledger rows for that payment;
  - appends rollback and replacement ledger rows using the same payment id;
  - updates payment metadata;
  - recomputes the customer balance.
- `delete_debt_payment` now:
  - accepts a debt payment id;
  - locks the payment and customer rows;
  - locks all ledger rows for that payment;
  - marks `DebtPayment.is_deleted = true`;
  - removes all ledger rows for that payment reference to preserve Batch 2 behavior;
  - recomputes customer balance.

Inventory service:

- Product creation creates the inventory balance immediately.
- Product update/delete and stock mutations use lock-specific repository read paths.
- Stock mutation locks the product and inventory balance row before applying Decimal balance changes.
- Negative stock remains allowed.

## Locking Strategy Implemented

Inventory repository now includes:

- `get_product_for_update`
- `get_product_by_code_base_for_update`
- `load_product_prices_for_update`
- `get_inventory_balance_for_update`
- `create_inventory_balance`

Customer repository now includes:

- `get_customer_for_update`
- `list_customer_ledgers_for_update`
- `get_debt_payment_for_update`
- `list_debt_payment_ledgers_for_update`
- `add_debt_payment`
- `list_debt_payments`

These methods use SQLAlchemy `with_for_update()`. SQLite-backed tests ignore row locks safely, while PostgreSQL will emit `SELECT ... FOR UPDATE` in live integration paths.

Remaining concurrency work:

- Product duplicate creation still relies on the unique index; a later API batch should translate `IntegrityError` into HTTP 409/domain conflict responses.
- True multi-session concurrency tests were not added in this batch because no PostgreSQL test database was available locally.

## PostgreSQL Test Strategy

Added pytest markers:

- `integration`
- `postgres`
- `concurrency`

Added fixtures in `backend/tests/conftest.py`:

- `test_database_url`: reads `TEST_DATABASE_URL` and skips PostgreSQL tests if missing.
- `postgres_engine`: verifies reachability and runs Alembic `upgrade head` against the test database.
- `postgres_session`: opens a transaction-scoped SQLAlchemy session and rolls it back after each test.

Added PostgreSQL-marked integration tests:

- Alembic upgrade creates `debt_payments`.
- PostgreSQL customer debt payment service uses distinct parent ids and recomputes balance.
- PostgreSQL inventory stock updates exercise the locked balance path.

In this environment, these tests skipped because `TEST_DATABASE_URL` was not set. That is intentional; fast SQLite behavior tests still run by default.

## Commands Run and Results

From `backend/`:

- `pytest`
  - Result: `47 passed, 3 skipped in 1.44s`
  - Skips: PostgreSQL integration tests skipped because `TEST_DATABASE_URL` is not set.
- `python -m compileall app tests`
  - Result: passed.
- `alembic upgrade head --sql`
  - Result: passed; rendered SQL for both `20260515_0001` and `20260515_0002`, including `debt_payments`.
- `pytest -m postgres`
  - Result: `3 skipped, 47 deselected`; skipped because `TEST_DATABASE_URL` is not set.
- `alembic upgrade head`
  - Result: failed because the reachable local PostgreSQL server rejected the configured `quanlyhanghoa` password.

Environment check:

- `docker ps`
  - Result: Docker config access was denied and the Docker engine pipe was unavailable.

## Skipped Tests and Environment Caveats

- PostgreSQL live upgrade and PostgreSQL integration tests were not executed against a real database in this environment.
- The new PostgreSQL fixtures are ready, but they require `TEST_DATABASE_URL`.
- SQLite service tests still validate business behavior, but SQLite does not prove row-locking, lost-update prevention, or PostgreSQL timestamp/numeric behavior under concurrency.

## Recommended Next Batch

Proceed to Phase 2 Batch 4 only after either:

1. a reachable PostgreSQL test database is configured and `pytest -m postgres` passes, or
2. the API batch explicitly keeps PostgreSQL concurrency caveats open.

Recommended Batch 4:

- Add API-facing Pydantic request/response schemas.
- Add FastAPI inventory/customer routes using one transaction per mutating request.
- Translate SQLAlchemy integrity errors into domain/API conflict errors.
- Add API tests for product writes, stock mutations, customer writes, debt payment create/edit/delete, and validation failures.

Recommended PostgreSQL follow-up:

- Add true concurrency tests with two independent sessions for stock increments and debt payment creation once `TEST_DATABASE_URL` is available.
