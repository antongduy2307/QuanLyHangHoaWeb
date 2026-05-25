# Inventory List Toolbar Cleanup

## Summary

Simplified the `/inventory/products` toolbar so it now exposes only the list-level actions that still belong on the product list:

- `Tạo mới`
- `Xóa`

Removed from the list toolbar:

- `Sửa`
- `Nhập kho`
- `Điều chỉnh kho`
- `Tải lại`

All product-level edit and stock workflows remain available from the unified product detail screen.

## Files Changed

- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/app/App.test.tsx`

## Visual Changes

- Inventory list toolbar now shows only `Tạo mới` and `Xóa`
- `Xóa` stays disabled until one or more rows are selected
- No other list layout, filters, row navigation, or selection interactions changed

## Commands / Results

From `frontend/`:

- `npm.cmd test -- --run`
  - passed: `148`
  - skipped: `34`
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed
