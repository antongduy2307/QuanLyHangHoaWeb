# Operational CRUD Batch 6: Inventory Movements Implementation

## Summary

Batch 6 adds inventory traceability for product stock changes. Operators can inspect movement history from the product detail page and see why stock changed, including sales, returns, and direct stock adjustments.

## Movement Model Approach

The implementation uses a hybrid model:

- Sales movements are derived from invoice item rows.
- Return movements are derived from return item rows.
- Manual stock increase/decrease adjustments are persisted in a new `stock_adjustments` table.

This avoids a broad inventory architecture redesign while preserving future auditability for direct manual adjustments.

## Derived vs Persisted Logic

Derived document movements:

- `SALE`: from `invoices` + `invoice_items`, shown as negative quantity delta.
- `RETURN`: from `return_invoices` + `return_invoice_items`, shown as positive quantity delta.

Persisted manual movements:

- `STOCK_INCREASE`
- `STOCK_DECREASE`

Manual rows store product, datetime, unit, positive quantity, signed quantity delta, balance after adjustment, note, and created timestamp. Sales and returns call inventory balance changes with adjustment logging disabled so they do not create duplicate manual rows.

## Backend Files Changed

- `backend/alembic/versions/20260519_0005_stock_adjustments.py`
- `backend/app/api/routes/inventory.py`
- `backend/app/application/inventory_service.py`
- `backend/app/application/sales_service.py`
- `backend/app/application/return_service.py`
- `backend/app/infrastructure/db/models/inventory.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/app/schemas/inventory.py`
- `backend/tests/api/test_inventory_api.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`

## Frontend Files Changed

- `frontend/src/api/inventory.ts`
- `frontend/src/api/types.ts`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/features/inventory/productQueries.ts`
- `frontend/src/app/App.test.tsx`

## Migration Notes

Added Alembic revision `20260519_0005` creating `stock_adjustments`.

The migration is additive and does not backfill old direct stock adjustments because previous adjustments were not stored. Existing sales and returns remain visible through derived document history.

## UI Behavior

- Product detail now shows an inventory movement history table.
- Operators can filter movements by type and date range.
- Invoice sources link to invoice detail.
- Return sources link to return detail.
- Manual stock adjustment now requires a reason/note in the UI.
- Successful stock increase/decrease shows inline feedback and refetches product detail plus movement history.

## Tests Run/Results

From `backend/`:

- `pytest` - passed, 230 passed and 18 skipped
- `python -m compileall app tests` - passed
- `alembic upgrade head` - passed, upgraded `20260517_0004 -> 20260519_0005`

From `frontend/`:

- `npm.cmd test` - passed, 141 tests
- `npm.cmd run build` - passed
- `npm.cmd run lint` - passed

## Limitations/Future Improvements

- Historical manual adjustments before this batch cannot be reconstructed because they were not previously persisted.
- `balance_after` is available for persisted stock adjustments; derived sales/return rows show `null` for now.
- Actor/user is included in the response shape but is currently `null` because stock adjustment endpoints do not yet persist the acting user.
- A future revision can add a unified persisted inventory ledger for every stock-affecting event if stronger audit guarantees are needed.
