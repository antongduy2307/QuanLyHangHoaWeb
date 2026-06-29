# Operational CRUD Batch 5: Reporting Implementation

## Summary

Batch 5 adds a read-only reporting foundation across backend and frontend. Reports are served by small backend endpoints under `/api/reports` so dashboard totals, date buckets, debt ordering, and inventory snapshots are computed close to the database instead of being inferred from frontend list pages.

## Backend Endpoints Added

- `GET /api/reports/dashboard-summary`
  - Product/customer counts, positive customer debt, inventory item count, today/month sales and returns totals, today invoice count, and positive-debt customer count.
- `GET /api/reports/customer-debts`
  - Customer debt rows sorted by largest positive/current balance first.
- `GET /api/reports/inventory-summary`
  - Product identity, unit mode, active state, canonical balance value/unit, and enabled/disabled prices.
- `GET /api/reports/sales-summary?date_from=&date_to=`
  - Sales totals, paid totals, invoice count, average invoice total, and by-day rows.
- `GET /api/reports/returns-summary?date_from=&date_to=`
  - Return totals, return count, and by-day rows.

## Backend Files

- `backend/app/api/routes/reports.py`
- `backend/app/application/reporting_service.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/schemas/reports.py`
- `backend/app/main.py`
- `backend/tests/api/test_reports_api.py`

## Frontend Screens Added

- Dashboard now calls `/reports/dashboard-summary` and renders operational cards:
  - today sales
  - month sales
  - current debt
  - customers with debt
  - today invoices
  - today returns
- Reports page now renders read-only sections for:
  - sales summary with date range
  - returns summary with date range
  - customer debt table
  - inventory summary table

## Frontend Files

- `frontend/src/api/reports.ts`
- `frontend/src/api/types.ts`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/reports/ReportsPlaceholder.tsx`
- `frontend/src/features/reports/reportQueries.ts`
- `frontend/src/app/App.test.tsx`

## Auth Policy

Report endpoints use the same read-only operational policy as inventory/sales/returns read APIs:

- Allowed: `owner`, `admin`, `read_only`
- Denied: `employee`, `attendance_manager`
- Local auth bypass still works through the existing shared auth dependency when `APP_ENV=local` and `AUTH_BYPASS=true`.

Reports are read-only. No mutation endpoints were added.

## Tests Run/Results

From `backend/`:

- `pytest` - passed, 227 passed and 16 skipped
- `python -m compileall app tests` - passed

From `frontend/`:

- `npm.cmd test` - passed, 140 tests
- `npm.cmd run build` - passed
- `npm.cmd run lint` - passed

## Caveats/Next Steps

- Reporting date filters are inclusive by calendar date.
- `total_inventory_items` is currently a product count because inventory uses mixed units (`BAO`, `KG`, `BICH`) that should not be summed into one physical quantity.
- No export, charting, attendance reporting, or advanced accounting logic was added in this batch.
- PostgreSQL-specific smoke coverage remains conditional on the existing `TEST_DATABASE_URL` test environment.
