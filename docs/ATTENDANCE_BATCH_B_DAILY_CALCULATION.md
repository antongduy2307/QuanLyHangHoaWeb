# Attendance Batch B Daily Calculation

## Summary

Batch B adds daily attendance records and calculation logic to the backend.

Implemented:

- attendance daily record schema
- attendance work types and work logs
- attendance CUT work items and CUT logs
- attendance extra CUT logs for `VK` parity
- day-entry save/load services and APIs
- draft/finalize behavior
- absent handling
- locked period enforcement
- blow tick/quantity calculation
- explicit excess-over-quota work rule for `Thừa máy`
- glove exclusivity
- CUT quota bonus logic
- employee delete deactivates when attendance history exists

Still out of scope:

- frontend
- inventory sync
- import from legacy attendance DB
- reports
- payroll payout / advances / deductions

## Schema Added

New tables:

- `attendance_daily_records`
- `attendance_work_types`
- `attendance_bag_types`
- `attendance_work_logs`
- `attendance_cut_logs`
- `attendance_extra_cut_logs`

### `attendance_daily_records`

Fields:

- `employee_id`
- `work_date`
- `period_id`
- `status`
- `is_absent`
- `total_amount_snapshot`
- `legacy_daily_record_id`
- timestamps

Key rules:

- one record per employee/date
- unique `(employee_id, work_date)`
- status in `draft`, `done`
- total cannot be negative

### `attendance_work_types`

Fields:

- `name`
- `team`
- `input_type`
- `pricing_rule`
- `quota_quantity`
- `unit_price`
- `exclusive_group`
- `is_active`
- `legacy_work_type_id`
- timestamps

Batch B design decision:

- `team` is constrained to `blow` for parity with the desktop reference
- `pricing_rule` is explicit, so `Thừa máy` behavior is no longer name-driven

Supported pricing rules:

- `flat_tick`
- `quantity_full`
- `quantity_excess_over_quota`

### `attendance_bag_types`

Fields:

- `name`
- `product_id` nullable
- `source_product_name_snapshot`
- `quota_quantity`
- `excess_unit_price`
- `is_active`
- `is_product_linked`
- `is_excluded_from_attendance`
- `is_legacy`
- `legacy_bag_type_id`
- timestamps

### Log tables

`attendance_work_logs`

- quantity
- unit price snapshot
- amount snapshot

`attendance_cut_logs`

- quantity
- quota snapshot
- excess price snapshot
- amount snapshot

`attendance_extra_cut_logs`

- quantity
- excess price snapshot
- amount snapshot

## Business Logic Implemented

## Daily record lifecycle

- one record per employee/date
- save with `finalize=false` stores `status=draft`
- save with `finalize=true` stores `status=done`
- existing save clears and rebuilds child logs
- locked period blocks edits

## Absent behavior

- `is_absent=true` clears work logs, cut logs, and extra cut logs
- `total_amount_snapshot=0`

## Blow logic

Supported input types:

- `tick`
- `quantity`

Rules:

- tick work saves quantity `1`
- quantity work supports decimal values in `0.5` increments
- `quantity_full` pays `quantity * unit_price`
- `flat_tick` pays one `unit_price`
- `quantity_excess_over_quota` pays only excess over quota

`Thừa máy` parity:

- implemented through explicit pricing rule plus quota
- tested with quota `3`

## Glove exclusivity

- work types can carry `exclusive_group`
- Batch B uses `glove` exclusivity for parity
- two glove-tagged work types cannot be saved in the same day record

## CUT bonus logic

Implemented from the desktop rule:

1. ignore zero-quantity rows
2. compute total quantity
3. compute average quota across active rows
4. if total quantity is at or below average quota, total bonus is zero
5. if any row reaches its original quota, rows at quota use excess-only while rows below quota use full quantity times price
6. otherwise use split-quota calculation across rows

`total_amount_snapshot` is authoritative.

Batch B also stores per-line `amount_snapshot` for CUT logs, but the authoritative daily total remains the daily record field.

## `VK` parity

Batch B includes `attendance_extra_cut_logs`.

Behavior:

- only allowed for blow-team day entry
- amount is `quantity * excess_unit_price`
- included in daily total

## Inactive employee behavior

- inactive employees cannot be saved
- employee delete now deactivates instead of hard deleting when attendance history exists

## API Routes

Existing Batch A routes remain.

New/extended Batch B attendance routes:

- `GET /api/attendance/work-types`
- `GET /api/attendance/cut-work-items`
- `GET /api/attendance/day-entry?date=YYYY-MM-DD`
- `GET /api/attendance/day-entry/{employee_id}?date=YYYY-MM-DD`
- `PUT /api/attendance/day-entry/{employee_id}?date=YYYY-MM-DD&finalize=false|true`

Response behavior:

- day-entry list returns active employees for the date plus status
- day-entry detail returns options and saved logs for the selected employee/date

## Test Coverage Added

Added coverage for:

- absent clears logs and total
- period lock blocks edits
- blow tick + quantity logic
- `Thừa máy` excess-over-quota rule with quota `3`
- glove exclusivity
- CUT split-quota bonus scenarios
- decimal quantity handling
- blow `VK` / extra CUT parity
- inactive employee save rejection
- delete with daily-record history deactivates
- API read/write flow for day entry
- migration and metadata coverage for new tables

## Commands Run / Results

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
  - `348 passed, 27 skipped`
- `uv run pytest -m postgres`
  - no failing postgres tests
  - `27 skipped, 348 deselected`
  - postgres-marked tests were skipped because `TEST_DATABASE_URL` was not available/reachable in this run

Known warning:

- `.pytest_cache` permission warnings in the local workspace
- did not affect pass/fail results

## Deferred Items

Still deferred after Batch B:

- attendance reports
- inventory sync / diagnostics
- product-sync workflows
- import from legacy attendance DB
- frontend day-entry screens
- employee portal
