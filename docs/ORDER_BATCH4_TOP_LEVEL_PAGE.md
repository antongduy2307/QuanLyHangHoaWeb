# Order Batch 4 Top-Level Page

## Summary

Implemented the top-level `Đặt hàng` page at `/orders` and repurposed the primary navigation entry from `Trả hàng` to `Đặt hàng`.

This batch adds:

- `/orders` route
- top-level navigation entry `Đặt hàng`
- `Khách hàng` sub-tab for active orders
- `Tổng số lượng hàng cần làm` sub-tab for grouped production quantities
- lightweight owner/admin actions on the active order list:
  - prepared toggle
  - delete

Return list/detail/edit routes remain accessible directly under `/returns`, but `Trả hàng` is no longer a top-level nav item because return creation now lives inside Sales POS tabs.

## Route And Nav Decision

- Added `/orders` route.
- Updated both the redesign shell navigation and the legacy sidebar shell navigation to show `Đặt hàng`.
- Kept existing `/returns`, `/returns/:id`, and `/returns/:id/edit` routes intact.

## Page Behavior

### Khách hàng tab

- Loads active orders from `GET /api/orders`
- Displays:
  - `Ngày đặt`
  - `Tên khách hàng`
  - `Ngày cần giao`
  - `Ghi chú`
  - `Trạng thái`
- Owner/admin additionally see:
  - prepared toggle
  - delete action
- Read-only users can view but do not see mutation actions.

### Tổng số lượng hàng cần làm tab

- Loads grouped rows from `GET /api/orders/quantity-summary`
- Displays:
  - `Mã hàng`
  - `Tên hàng`
  - `Đơn vị`
  - `Tổng số lượng cần làm`
  - `Tồn kho hiện tại`
- Supports:
  - product-name search
  - default quantity-desc sort
  - optional name sort

## Styling

- Reused the existing brown/cream shell and table styling
- Kept the page structure close to the desktop layout instead of introducing a major redesign

## Files Changed

- `frontend/src/api/types.ts`
- `frontend/src/api/orders.ts`
- `frontend/src/features/orders/orderQueries.ts`
- `frontend/src/features/orders/OrderListPage.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/domain/routes.ts`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/layouts/Sidebar.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`
- `docs/ORDER_BATCH4_TOP_LEVEL_PAGE.md`

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `184` passed, `34` skipped
- `npm.cmd run build`: passed
- `npm.cmd run lint`: passed

## Notes

- Sales-from-order conversion is still not implemented.
- The top-level order page is intentionally list/summary focused for this batch.
- Return routes still exist, but the primary user entrypoint for return creation remains the Sales POS mixed-tab flow.
