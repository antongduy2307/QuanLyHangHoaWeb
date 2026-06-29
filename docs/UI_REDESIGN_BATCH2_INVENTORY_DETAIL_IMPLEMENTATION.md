# UI/UX Redesign Batch 2: Inventory Detail And Stock Adjustment

## Summary

Batch 2 redesigns the inventory product detail flow on `/inventory/products/:productId` so it matches the Batch 1 inventory list shell and visual language.

Implemented outcomes:

- product detail now uses the same brown / cream inventory module shell as the redesigned list;
- summary information is grouped into identity, price, and stock sections;
- owner/admin actions are grouped into one operational action area;
- stock adjustment is redesigned into one mode-based workflow without changing backend endpoints;
- movement history is restyled into a compact operational table with readable labels and preserved source links.

No backend logic was changed.

## Files Changed

- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`

## Layout Decisions

- Added a shared inventory module shell so `/inventory/products` and `/inventory/products/:productId` use one top navigation and hero pattern.
- The shared admin sidebar/topbar shell is bypassed for:
  - `/inventory/products`
  - `/inventory/products/:productId`
- Product detail is split into:
  - main content column for identity, price, stock, and movement history;
  - right action column for owner/admin operational actions and stock adjustment;
  - read-only users collapse to a single-column detail view without an empty action rail.

## Stock Adjustment UX

- Kept the existing endpoints:
  - `POST /inventory/products/:id/stock/increase`
  - `POST /inventory/products/:id/stock/decrease`
  - `POST /inventory/products/:id/stock/set`
- Replaced scattered stock buttons with one mode-based panel:
  - `Nhập kho`
  - `Xuất kho`
  - `Đặt tồn thực tế`
- The panel updates form labeling by mode:
  - `Số lượng` for increase/decrease
  - `Tồn thực tế` for set-to-actual
- Unit selector remains constrained by `unit_mode`:
  - `BAO_KG` => `BAO` or `KG`
  - `BICH` => `BICH`
- Success and error feedback stays inline on the detail page.
- Existing React Query invalidation behavior remains in place, so product detail, movement history, and cached product list data are refreshed after successful stock mutations.

## Movement History Behavior

- Movement labels now render as:
  - `SALE` => `Bán hàng`
  - `RETURN` => `Trả hàng`
  - `STOCK_INCREASE` => `Nhập kho`
  - `STOCK_DECREASE` => `Xuất kho`
  - `STOCK_SET` => `Đặt tồn thực tế`
  - `IMPORT` => `Nhập dữ liệu`
  - `MANUAL` => `Điều chỉnh thủ công`
- Invoice and return movement sources still link to their existing detail routes.
- Stock adjustment sources remain text-only references.
- Filtering behavior for movement history was preserved.

## Tests Run / Results

From `frontend/`:

- `npm.cmd test -- --run`
  - passed: `159`
  - skipped: `2`
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed

## Known Limitations

- Product create and product edit pages still use the older form layout and were intentionally left unchanged in this batch.
- The detail page reuses the current movement-history data model; no new stock-document model was introduced.
- Two older frontend tests remain intentionally skipped as legacy coverage carried from the previous batch.

## Visual Review

The redesigned detail flow is ready for local visual review now.

Recommended manual path:

- open `/inventory/products`
- select any product
- open `/inventory/products/:productId`
- verify action shortcuts, mode switching, and movement history readability on desktop and mobile widths
