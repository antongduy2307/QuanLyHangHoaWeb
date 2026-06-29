# Attendance Batch D Reports

## Summary

Batch D adds attendance report endpoints and the frontend `Báo cáo` tab under `/attendance`.

Implemented:

- backend period report endpoint
- backend monthly report endpoint
- period and monthly attendance report render models
- frontend `Báo cáo` tab in `/attendance`
- compact report tables for:
  - kỳ 10 ngày
  - tháng
- team selector plus period/month controls
- inclusion of inactive employees when they have history in range
- monthly paid-workday counting using `total_amount_snapshot > 0`

Still deferred:

- Excel export
- print
- inventory sync
- import from legacy `attendance.db`

## Backend Endpoints

Added:

- `GET /api/attendance/reports/period?team=&period_id=`
- `GET /api/attendance/reports/monthly?team=&month=YYYY-MM`

Behavior:

- groups records by employee
- includes per-day totals for period report
- includes per-employee totals
- includes grand total
- includes detail labels where practical:
  - blow: work type names and `VK`
  - cut: bag type names
- includes inactive employees if they have records inside the requested range
- monthly report counts paid workdays where `total_amount_snapshot > 0`

## Frontend UI

Attendance page now has three tabs:

- `Nhân viên`
- `Chấm công`
- `Báo cáo`

Report tab features:

- mode switch:
  - `Kỳ 10 ngày`
  - `Tháng`
- team selector:
  - `Tổ thổi`
  - `Tổ cắt`
- period selector for 10-day report
- month picker for monthly report
- compact tables with:
  - detail columns
  - employee totals
  - grand total
- summary line above the table

Export / print:

- still deferred
- no active export/print behavior in this batch

## API Client Changes

Added frontend attendance report client methods:

- period report fetch
- monthly report fetch

Added React Query hooks:

- attendance periods list
- attendance period report
- attendance monthly report

Extended attendance test harness with mocked:

- period report response
- monthly report response

## Role Behavior

Attendance report tab uses the same attendance route guard as the rest of `/attendance`:

- `owner`: allowed
- `admin`: allowed
- `attendance_manager`: allowed
- `read_only`: allowed
- `employee`: forbidden

## Tests Run / Results

Commands run:

```powershell
pytest
python -m compileall app tests
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `python -m compileall app tests`
  - passed
- `uv run pytest`
  - passed
  - `351 passed, 27 skipped`
- `uv run pytest -m postgres`
  - no failures
  - `27 skipped, 351 deselected`
  - postgres-marked tests were skipped because `TEST_DATABASE_URL` was not available/reachable in this run
- `npm.cmd test -- --run`
  - passed
  - `85 passed`
- `npm.cmd run build`
  - passed
  - Vite chunk-size warning only
- `npm.cmd run lint`
  - passed

## Deferred Items

Still deferred after Batch D:

- Excel export
- print
- inventory sync / diagnostics
- import from legacy attendance DB
- employee self-service portal
- payroll payout / advance / deduction flows
