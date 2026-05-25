# Dashboard Batch 1: Overview Backend

Date: 2026-05-25

## Summary

Batch 1 adds a backend-only dashboard overview payload at:

- `GET /api/reports/overview`

This endpoint is intended for the future `Tổng quan` card surface and keeps the same read policy as the existing reports endpoints.

## Response Fields

The endpoint returns:

- `today_invoice_count`
- `today_sales_total`
- `today_return_count`
- `today_return_total`
- `this_month_sales_total`
- `last_month_sales_total`
- `last_7_days_sales_total`
- `current_customer_debt`
- `positive_debt_customer_count`

## Implementation Notes

- Reused the existing reports auth policy:
  - allowed: `owner`, `admin`, `read_only`
  - forbidden: `employee`, `attendance_manager`
- Reused existing date-bound report logic where possible.
- Added the missing repository query for:
  - today return count
- Used existing sales summary range logic for:
  - this month
  - last month
  - trailing 7 days

## Files Changed

- `backend/app/api/routes/reports.py`
- `backend/app/application/reporting_service.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/schemas/reports.py`
- `backend/tests/api/test_reports_api.py`
- `backend/tests/integration/test_reports_postgres.py`

## Tests Added / Updated

- API test for overview today counts/totals and debt metrics
- API test for previous-month total behavior
- Postgres integration test for overview access and trailing/today metrics
- Postgres protected-endpoint smoke updated to include `/api/reports/overview`

## No Frontend Changes

This batch is backend only.

- No dashboard UI was implemented.
- No frontend API client was added yet.
