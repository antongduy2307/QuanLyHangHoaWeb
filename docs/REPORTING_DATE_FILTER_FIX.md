# Reporting Date Filter Fix

## Root Cause

`GET /api/reports/dashboard-summary` failed on PostgreSQL because report queries compared `date(...)` SQL expressions to ISO date strings. PostgreSQL treated the right-hand side as `VARCHAR`, producing:

`operator does not exist: date = character varying`

The same pattern existed in daily sales/returns totals and inclusive date-range filters.

## Files Changed

- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/tests/integration/test_reports_postgres.py`
- `docs/REPORTING_DATE_FILTER_FIX.md`

## Date Filtering Approach

Report filters now use half-open UTC datetime ranges instead of string date comparisons:

- daily range: `column >= start_of_day` and `column < next_day`
- monthly range: `column >= first_day_of_month` and `column < first_day_of_next_month`
- inclusive user date ranges: `column >= date_from_start` and `column < date_to_plus_one_start`

This avoids PostgreSQL date/string operator mismatches and keeps filtering index-friendly on timestamp columns.

## Tests Run/Results

From `backend/`:

- `pytest tests/api/test_reports_api.py` - passed, 11 passed
- `pytest` - passed, 227 passed and 18 skipped
- `python -m compileall app tests` - passed
- `pytest -m postgres` - 18 skipped because `TEST_DATABASE_URL` is not set in this environment

## Local Verification Command

With a PostgreSQL test database available:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://user:password@localhost:5432/test_db"
pytest -m postgres
```

For the default local test suite:

```powershell
pytest
```
