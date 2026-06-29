# Attendance Batch A Backend Foundation

## Summary

Batch A adds the backend attendance foundation for the web app:

- attendance domain enums for employee team and record status
- PostgreSQL/Alembic schema for attendance employees and 10-day periods
- SQLAlchemy models, repositories, services, and API schemas
- `/api/attendance` routes for employees, periods, and reference data
- attendance-specific auth policy for owner/admin/attendance_manager/read_only/employee
- backend tests for employee CRUD/search/filtering, period generation, metadata, migration, and auth access

## Schema Added

Tables:

- `attendance_employees`
- `attendance_periods`

### `attendance_employees`

Fields:

- `id`
- `display_name`
- `team`
- `is_active`
- `user_id` nullable FK to `users.id`
- `legacy_employee_id` nullable
- `created_at`
- `updated_at`

Constraints and indexes:

- required non-blank `display_name`
- `team IN ('blow', 'cut')`
- global unique `display_name`
- unique nullable `user_id`
- index on `display_name`
- index on `(team, is_active)`

Decision:

- Batch A uses a global unique `display_name`, matching the legacy desktop app's unique-name behavior.
- It does not use "unique among active employees only" because the desktop reference treats names as globally unique and the stricter rule is safer for parity and future imports.

### `attendance_periods`

Fields:

- `id`
- `start_date`
- `end_date`
- `locked`
- `legacy_period_id` nullable
- `created_at`
- `updated_at`

Constraints and indexes:

- unique `(start_date, end_date)`
- `start_date <= end_date`
- indexes on `start_date`, `end_date`, and `locked`

## API Routes

Base prefix:

- `/api/attendance`

Implemented endpoints:

- `GET /api/attendance/reference`
- `GET /api/attendance/employees`
- `POST /api/attendance/employees`
- `GET /api/attendance/employees/{employee_id}`
- `PATCH /api/attendance/employees/{employee_id}`
- `DELETE /api/attendance/employees/{employee_id}`
- `GET /api/attendance/periods`
- `POST /api/attendance/periods/ensure-for-date`
- `PATCH /api/attendance/periods/{period_id}`

Reference response includes:

- `teams`
- `record_statuses`

## Period Logic

The backend period service implements the legacy 10-day cycle:

- days `1-10`
- days `11-20`
- days `21-end of month`

Behavior:

- `calculate_period_bounds(date)` returns the proper cycle bounds
- `ensure_period_for_date(date)` creates the period if it does not exist
- repeated ensure calls for dates inside the same period are idempotent
- leap-year February is covered by calendar month-end logic

## Auth Policy

Batch A attendance policy:

- `owner`: read/write
- `admin`: read/write
- `attendance_manager`: read/write
- `read_only`: read only
- `employee`: forbidden

This is scoped only to attendance routes.
It does not change the existing admin-shell or non-attendance route policy.

## Delete Behavior

Current Batch A behavior:

- attendance employees hard delete when deleted

Deferred parity behavior:

- legacy desktop deactivates employees who have attendance history instead of hard deleting them
- Batch A does not yet create `attendance_daily_records`
- because no attendance-history table exists yet, Batch A cannot detect historical attendance rows
- this deactivation-on-history rule is deferred to Batch B when daily records are introduced

## Tests Run / Results

Commands run:

```powershell
python -m compileall app tests
uv run pytest
uv run pytest -m postgres
```

Results:

- `python -m compileall app tests`
  - passed
- `uv run pytest`
  - passed
  - `332 passed, 27 skipped`
- `uv run pytest -m postgres`
  - no failing postgres tests
  - `27 skipped, 332 deselected`
  - the postgres-marked tests were skipped because `TEST_DATABASE_URL` was not available/reachable in this run

Known warning during pytest:

- `.pytest_cache` write warnings due local filesystem permissions
- did not cause test failures

## Deferred Items

Intentionally deferred out of Batch A:

- daily attendance records
- deactivate-on-history delete behavior
- blow/cut work calculations
- work types and CUT work items
- reports
- inventory sync
- attendance import from legacy SQLite
- employee self-service portal
- Excel export and print
- payroll payout / advance / deduction flows
