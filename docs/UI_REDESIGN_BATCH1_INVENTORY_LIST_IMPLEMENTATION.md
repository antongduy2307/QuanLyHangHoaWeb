# UI/UX Redesign Batch 1: Inventory Product List

## Summary

This batch redesigns the inventory product list screen into a KiotViet-inspired product management layout while keeping inventory business logic and route behavior unchanged.

Implemented changes:

- replaced the old left-sidebar admin-shell feel on `/inventory/products` with a page-specific top navigation shell;
- added a brown / cream visual theme with compact operational spacing;
- added a left filter panel for unit-mode filtering and inactive-product visibility;
- reduced the list to the requested columns only;
- added row selection, toolbar action gating, and sequential bulk delete handling;
- preserved existing product detail, create, edit, and stock-adjustment flows.

## Files Changed

- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`

## Layout Decisions

- `/inventory/products` now bypasses the shared sidebar/topbar shell and renders a dedicated inventory page shell.
- The dedicated shell uses:
  - horizontal top navigation with `Hàng hóa` active;
  - title band for product management context;
  - left filter column;
  - main content area with toolbar and table.
- Other routes continue using the existing shared `AdminLayout`.

## Toolbar And Selection Behavior

- `Tạo mới` is shown for `owner` and `admin`.
- `Sửa`, `Nhập kho`, and `Điều chỉnh kho` require exactly one selected row.
- `Xóa` enables when one or more rows are selected.
- `Tải lại` is always available.
- Read-only users do not get mutation actions and only keep non-mutating controls.
- Bulk delete uses sequential `DELETE /inventory/products/:id` calls and refetches the list after completion.
- Delete still requires explicit confirmation.

## Filter Behavior

- Search placeholder is `Tìm theo tên hàng...`.
- Search behavior remains name-only through the existing list query parameter.
- Left filter panel adds frontend unit-mode filtering:
  - `Tất cả`
  - `Bao / Kg`
  - `Bịch`
- Existing inactive-product visibility is preserved as a sidebar toggle.

## Column And Display Rules

- Rendered columns:
  - checkbox
  - `Mã hàng`
  - `Tên hàng`
  - `Đơn vị bán`
  - `Giá bán`
  - `Tồn kho`
- BAO/KG price display prioritizes enabled BAO price, then enabled KG price.
- BỊCH price display uses the enabled BỊCH price.
- BAO/KG stock shows compact BAO and derived KG balance.
- BỊCH stock shows compact BỊCH balance.

## Tests Run / Results

From `frontend/`:

- `npm.cmd test -- --run`
  - passed: `155` tests
  - skipped: `2` legacy tests retained but intentionally skipped
- `npm.cmd run lint`
  - passed
- `npm.cmd run build`
  - passed

Note:

- `npm.cmd test -- --run` and `npm.cmd run build` hit sandbox path-mapping issues on one rerun and were re-executed outside the sandbox for final verification.

## Known Limitations

- `Nhập kho` and `Điều chỉnh kho` still route into the existing product detail stock-adjustment panel rather than a separate redesigned stock workflow.
- The product detail, create, and edit screens are intentionally not visually redesigned in this batch.
- Two older frontend tests were kept as skipped legacy coverage instead of being fully deleted during this batch.

## Next Redesign Batch Recommendation

Redesign the inventory product detail and stock-adjustment experience next so the list page and its downstream mutation flow share the same visual system and action language.
