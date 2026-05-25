# Dashboard Batch 3: Sales Timeseries

Date: 2026-05-25

## Summary

Batch 3 adds sales revenue timeseries support for the dashboard.

Backend:

- Added `GET /api/reports/sales-timeseries`
- Query params:
  - `period`: `today | yesterday | last_7_days | this_month | last_month`
  - `granularity`: `hour | day`

Response buckets:

- `label`
- `start_datetime`
- `end_datetime`
- `sales_total`
- `invoice_count`

Frontend:

- Added dashboard section: `Doanh thu theo thời gian`
- Added period selector:
  - `Hôm nay`
  - `Hôm qua`
  - `7 ngày qua`
  - `Tháng này`
  - `Tháng trước`
- Uses:
  - `hour` granularity for `today` and `yesterday`
  - `day` granularity for the other periods
- Rendered as a simple brown/cream bar chart list without adding a new dependency

## Files Changed

Backend:

- `backend/app/api/routes/reports.py`
- `backend/app/application/reporting_service.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/schemas/reports.py`
- `backend/tests/api/test_reports_api.py`
- `backend/tests/integration/test_reports_postgres.py`

Frontend:

- `frontend/src/api/types.ts`
- `frontend/src/api/reports.ts`
- `frontend/src/features/reports/reportQueries.ts`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/tests/appTestHarness.ts`
- `frontend/src/styles.css`

## Tests

Added coverage for:

- backend hourly timeseries buckets
- backend daily timeseries buckets
- frontend period selector calling the timeseries API with the selected period
- dashboard chart/timeseries rendering
