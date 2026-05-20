# Inventory Movements Union Type Fix

## Root cause

`GET /api/inventory/products/{product_id}/movements` combines invoice item, return item, and stock adjustment movement rows with `UNION ALL`.

The invoice and return branches used untyped `NULL` literals for `balance_after`, while the stock adjustment branch returned `stock_adjustments.balance_after` as `NUMERIC(14, 3)`. PostgreSQL inferred incompatible union column types and failed with:

```text
psycopg.errors.DatatypeMismatch: UNION types text and numeric cannot be matched
```

SQLite was permissive enough that the issue did not surface there.

## Files changed

- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/tests/api/test_inventory_api.py`
- `backend/tests/integration/test_inventory_movements_postgres.py`
- `docs/INVENTORY_MOVEMENTS_UNION_TYPE_FIX.md`

## Typing approach

`InventoryRepository.list_product_movements` now casts the projected `UNION ALL` columns that can be inferred inconsistently to a common SQL type:

- `movement_id`: `BIGINT`
- `movement_datetime`: native `DateTime(timezone=True)` columns in all branches
- `movement_type`: `String(32)`
- `quantity_delta`: `Numeric(14, 3)`
- `unit_type`: `String(16)`
- `balance_after`: nullable `Numeric(14, 3)`
- `source_type`: `String(32)`
- `source_id`: `BIGINT`
- `note`: nullable `Text`
- `actor`: nullable `Text`
- `created_at`: native `DateTime(timezone=True)` columns in all branches

The timestamp columns already come from matching model columns in all branches. They are left uncast so SQLite keeps returning values through its normal datetime processor, while PostgreSQL still receives compatible timestamp columns. The null/numeric/text/string columns are explicitly typed to keep PostgreSQL inference stable for mixed invoice, return, and stock adjustment history rows.

## Tests

Regression coverage was added for:

- mixed invoice, return, and stock adjustment movement rows on SQLite-backed API tests;
- PostgreSQL-marked mixed movement endpoint coverage to catch the previous datatype mismatch.

## Local verification commands

From `backend`:

```powershell
pytest
python -m compileall app tests
pytest -m postgres
```

`pytest -m postgres` requires `TEST_DATABASE_URL`.
