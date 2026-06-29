# Inventory + Customer Schema Batch 1 Implementation

## Summary

Implemented Phase 2 Batch 1 backend foundation for inventory and customer/debt schema. This batch adds domain enums/exceptions, PostgreSQL-ready SQLAlchemy models, one Alembic revision, and lightweight tests for domain constants, metadata registration, and migration script presence.

No services, repositories, CRUD APIs, receipts, adjustments, sales, returns, orders, reporting, attendance, import execution, or frontend UI were implemented.

## Files Created

- `backend/app/domain/__init__.py`
- `backend/app/domain/enums.py`
- `backend/app/domain/exceptions.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/app/infrastructure/db/models/inventory.py`
- `backend/app/infrastructure/db/models/customer.py`
- `backend/alembic/versions/20260515_0001_inventory_customer_schema.py`
- `backend/tests/unit/test_domain_enums.py`
- `backend/tests/unit/test_db_metadata.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`
- `docs/INVENTORY_CUSTOMER_SCHEMA_BATCH1_IMPLEMENTATION.md`

## Files Modified

- `backend/app/infrastructure/db/base.py`

The base module now imports the model package after `Base` is declared so the inventory/customer tables are registered in `Base.metadata` for Alembic and metadata tests.

## Schema Decisions

- Used string/check-constrained enum-compatible columns for `unit_mode` and `unit_type` instead of PostgreSQL enum types. This keeps early migrations flexible while preserving valid values.
- Used `BigInteger` primary keys with PostgreSQL identity columns.
- Used timezone-aware timestamps via `DateTime(timezone=True)`.
- Used `numeric(14, 2)` for money values and `numeric(14, 3)` for quantities.
- Preserved negative inventory and customer balances where required by desktop behavior.
- Did not add receipt or adjustment tables in this batch because the requested scope was only products, prices, balances, customers, and customer ledgers.

## Constraints and Indexes Added

Inventory:

- `products`
  - non-blank product code check
  - non-blank product name check
  - valid unit mode check
  - unique index on `product_code_base`
  - indexes on `product_name` and `is_active`
- `product_prices`
  - foreign key to `products`
  - unique `(product_id, unit_type)`
  - valid unit type check
  - `price >= 0`
  - index on `product_id`
- `inventory_balances`
  - foreign key to `products`
  - unique `product_id`
  - exactly one canonical quantity column must be non-null

Customer/debt:

- `customers`
  - non-blank customer name check
  - `total_sales >= 0`
  - indexes on `customer_name`, `phone`, and `is_active`
- `customer_balance_ledgers`
  - foreign key to `customers`
  - non-blank `event_type`
  - non-blank `ref_type`
  - timeline index on `(customer_id, transaction_datetime, display_order, id)`
  - reference index on `(customer_id, ref_type, ref_id)`
  - event index on `(customer_id, event_type)`
  - source reference index on `(customer_id, source_ref_type, source_ref_id)`

## Commands Run

From `backend/`:

```powershell
pytest
python -m compileall app tests
alembic upgrade head
alembic upgrade head --sql
```

From repository root:

```powershell
docker compose ps
```

## Test Results

- `pytest`: passed, `11 passed in 2.04s`.
- `python -m compileall app tests`: passed.
- `alembic upgrade head --sql`: passed and rendered PostgreSQL DDL for the migration.

## Alembic Live Database Result

`alembic upgrade head` was attempted against the configured database URL. It did not complete because the reachable PostgreSQL server on `localhost:5432` rejected the configured local development credentials for user `quanlyhanghoa`.

`docker compose ps` also could not confirm the project database because Docker was not reachable in this environment:

- Docker config read access was denied.
- Docker engine pipe was not found.

Because the live development database was not available with the configured credentials, this batch relies on:

- metadata tests,
- migration script tests,
- successful offline Alembic SQL rendering.

## Caveats and Next Steps

- No business services or CRUD APIs exist yet.
- No import validation from `app.db` exists yet.
- No real PostgreSQL upgrade was applied in this environment due to local database/Docker availability.
- The next batch should add repositories and service-level behavior around product/customer creation, price sync, inventory balance updates, customer opening balances, and standalone debt payments.
- Before live migration testing, start a PostgreSQL instance matching `.env.example` or update `DATABASE_URL` to a reachable test database.

