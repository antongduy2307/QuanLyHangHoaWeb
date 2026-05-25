# History Batch B Frontend List

Date: 2026-05-23

## Scope

Implemented the frontend History list page on top of the existing backend endpoint:

- `GET /api/history`
- route: `/history`

This batch is frontend-only and read-only.

Non-goals:

- no write actions
- no export
- no detail drawer

## What Was Added

### Route and Navigation

- added `/history` route
- added `Lịch sử` navigation entry to:
  - sidebar navigation
  - redesigned brown/cream top navigation shell
- configured `/history` to use the redesigned full-bleed shell

### API Client and Query

Added frontend history API support with these params:

- `date_from`
- `date_to`
- `event_type`
- `customer_id`
- `product_id`
- `search`

### UI

Added a brown/cream History page with:

- left filter rail
  - date range
  - event type
  - keyword/code search
- main table columns
  - `Thời gian`
  - `Loại giao dịch`
  - `Mã chứng từ`
  - `Khách hàng`
  - `Sản phẩm`
  - `Giá trị / Số lượng`
  - `Trạng thái`
  - `Mở`

### Event Labels

Mapped event labels:

- `SALES_INVOICE` -> `Hóa đơn bán hàng`
- `RETURN_INVOICE` -> `Phiếu trả hàng`
- `DEBT_PAYMENT` -> `Thanh toán công nợ`
- `BALANCE_ADJUSTMENT` -> `Điều chỉnh công nợ`
- `STOCK_MOVEMENT` -> `Biến động tồn kho`
- `ORDER` -> `Đặt hàng`

### Open Links

Used `open_target` to render links when the target page already exists:

- invoice detail
- return detail
- customer detail
- product detail

Orders currently render without an open link because there is no dedicated order detail route in the frontend shell yet.

### States

Implemented:

- loading
- error
- empty
- no results

## Files Changed

- `frontend/src/api/history.ts`
- `frontend/src/api/types.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/domain/routes.ts`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/history/historyQueries.ts`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/layouts/Sidebar.tsx`
- `frontend/src/styles.css`

## Verification

Executed:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results are captured from the final verification run for this batch.
