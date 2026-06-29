# Feature Parity Batch 2: Inventory P0/P1 Implementation

## Summary

Batch 2 closes the highest-risk inventory parity gaps without redesigning the UI. The web app now supports set-to-actual stock adjustments through the existing audit/movement model, exposes derived KG balances for `BAO_KG` products, keeps inventory search name-only to match desktop behavior, and hardens inactive historical product handling for invoice and return edits.

## Parity Decisions

- Implemented set-to-target stock adjustment instead of documenting delta-only behavior.
- Retained the existing unified `stock_adjustments` and movement-history model rather than adding a separate receipt document model in this batch.
- Added `STOCK_SET` as an audited stock adjustment movement type.
- Kept product search name-only to match the desktop inventory list. The frontend placeholder now says `Ten hang hoa` instead of code+name.
- Retained active-only selection for new sales and quick returns, while allowing existing historical invoice/return edits to continue using their already-linked inactive products.

## Receipt / Set-Adjustment Decision

Desktop has richer receipt/adjustment semantics, including setting stock toward an actual counted quantity. The minimal web parity implementation maps that operational need to:

- `POST /api/inventory/products/{product_id}/stock/set`
- Payload: `target_quantity`, `unit_type`, optional `note`, optional `adjustment_datetime`
- Backend computes the delta from current balance in the requested unit.
- For `BAO_KG`, BAO remains canonical storage and KG remains derived through the 25 KG/BAO conversion.
- Negative target stock is allowed, matching existing negative stock behavior.
- The adjustment is audited as `STOCK_SET` in product movement history.

This intentionally does not add a full warehouse receipt document model, multi-warehouse tracking, or transfer flow.

## Backend Changes

- Added `InventoryService.set_stock_to_target(...)`.
- Added `POST /api/inventory/products/{product_id}/stock/set`.
- Added `StockSetRequest`.
- Added `derived_kg_balance` to inventory balance responses.
- Extended stock adjustment movement type validation to include `STOCK_SET`.
- Added migration `20260519_0006_stock_set_adjustments.py`.
- Updated invoice edit normalization so an existing invoice can still be edited with its historical inactive product.
- Updated quick return edit normalization so an existing quick return can still be edited with its historical inactive product.

## Frontend Changes

- Added inventory API/type/query support for set-to-target stock.
- Product detail now displays `BAO` and derived `KG` balance for `BAO_KG` products.
- Product list now displays compact `BAO | KG` balance for `BAO_KG` products.
- Product detail adds owner/admin-only `Dat ton thuc te` next to existing increase/decrease stock actions.
- Movement labels include `STOCK_SET` as `Dat ton thuc te`.
- Inventory search placeholder now reflects name-only search.

## Tests

- Backend service tests cover:
  - Set-to-target stock delta calculation and audit rows.
  - KG target conversion to canonical BAO.
  - Negative stock target.
  - Unchanged target validation.
  - Product name-only search.
  - Historical invoice edit with inactive product.
  - Historical quick return edit with inactive product.
  - New quick return rejection for inactive products.
- Backend API tests cover:
  - Derived KG response fields.
  - Set-stock endpoint, movement history, and negative target behavior.
  - Read-only denial for set-stock writes.
- Frontend tests cover:
  - Derived KG display.
  - `Dat ton thuc te` visibility/action/refetch.
  - Read-only hiding of stock mutation buttons.
  - `STOCK_SET` movement label display.

## Known Divergences Intentionally Retained

- No full receipt document model was added.
- Stock set adjustments are represented as audit rows in the unified movement history, not as desktop receipt records.
- Existing increase/decrease stock endpoints remain available.
- Product code search remains intentionally unsupported in the inventory list to match desktop name-only search.
- UI remains minimal; no layout or UX redesign was attempted.

## Files Changed

- `backend/app/application/inventory_service.py`
- `backend/app/api/routes/inventory.py`
- `backend/app/schemas/inventory.py`
- `backend/app/infrastructure/db/models/inventory.py`
- `backend/alembic/versions/20260519_0006_stock_set_adjustments.py`
- `backend/app/application/sales_service.py`
- `backend/app/application/return_service.py`
- `backend/tests/service/test_inventory_service.py`
- `backend/tests/service/test_sales_service.py`
- `backend/tests/service/test_return_service.py`
- `backend/tests/api/test_inventory_api.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`
- `frontend/src/api/inventory.ts`
- `frontend/src/api/types.ts`
- `frontend/src/features/inventory/productQueries.ts`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/app/App.test.tsx`

## Next Parity Batch

- Sales/invoice parity P0/P1, especially search/filter and code-generation edge tests.
- Returns parity P0/P1, including search/filter and return ledger ordering decision.
- Keep receipt document modeling deferred unless operations require it before replacement cutover.
