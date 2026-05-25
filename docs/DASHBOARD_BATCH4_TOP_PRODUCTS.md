# Dashboard Batch 4: Top Products By Revenue

Date: 2026-05-25

## Summary

Batch 4 adds top-selling products by revenue to the dashboard overview.

Backend:

- Added `GET /api/reports/top-products`
- Query params:
  - `period`: `today | yesterday | last_7_days | this_month | last_month`
  - `limit`: default `10`
  - `metric`: `revenue`
- Aggregates from `invoice_items` joined to `invoices`
- Sorts by revenue descending

Response rows:

- `product_id`
- `product_code`
- `product_name`
- `unit_type`
- `total_quantity`
- `total_revenue`
- `invoice_count`

Frontend:

- Added dashboard section: `Top hàng bán chạy`
- Reused the existing dashboard period options:
  - `Hôm nay`
  - `Hôm qua`
  - `7 ngày qua`
  - `Tháng này`
  - `Tháng trước`
- Rendered a compact brown/cream table with:
  - `Hạng`
  - `Mã hàng`
  - `Tên hàng`
  - `Đơn vị`
  - `Số lượng`
  - `Doanh thu`

## Files Changed

Backend:

- `backend/app/api/routes/reports.py`
- `backend/app/application/reporting_service.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/schemas/reports.py`
- `backend/tests/api/test_reports_api.py`
- `backend/tests/integration/test_reports_postgres.py`

Frontend:

- `frontend/src/api/reports.ts`
- `frontend/src/api/types.ts`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/reports/reportQueries.ts`
- `frontend/src/styles.css`

## Tests

Added coverage for:

- backend top-products revenue aggregation
- backend descending revenue sort
- backend period filtering
- backend limit filtering
- frontend section rendering
- frontend selected-period API calls
- frontend empty state rendering
- frontend revenue ordering
