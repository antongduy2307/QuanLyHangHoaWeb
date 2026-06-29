# Attendance Feature Investigation

## Scope

This document investigates the legacy desktop attendance/cham cong feature from `../QuanLyHangHoa/` and translates it into a concrete implementation plan for the web app in `./`.

Constraints followed during this investigation:

- Read-only inspection of the desktop reference.
- No database writes.
- No destructive commands.
- No attendance implementation in the web app in this task.

## Executive Summary

The legacy attendance feature is already more than a simple day-marking screen. In the current desktop repo it includes:

- employee management;
- daily attendance entry for two teams: `blow` and `cut`;
- 10-day payroll periods;
- draft/finalized day records;
- piecework rules for both teams;
- special CUT quota bonus logic;
- extra CUT work for blow-team workers (`VK`) in the merged desktop app;
- attendance reporting for 10-day and monthly views;
- settings for work types and cut work items;
- product-to-attendance synchronization from the main inventory DB;
- cross-database inventory effect reconciliation for finalized production records.

The strongest web-design conclusion is this:

- The new web app should not preserve the old split-database model.
- Attendance should live in the same PostgreSQL database as inventory/sales/customers.
- Product-linked CUT work and attendance-to-inventory effects should be modeled with real foreign keys and single-transaction writes.

The second major conclusion is that the legacy feature has two layers:

1. Original chamcong behavior from `_reference_chamcong/`.
2. Later desktop evolution in `modules/attendance/` that added decimal quantities, product-linked CUT work, extra CUT work, and inventory synchronization.

The web plan should treat `modules/attendance/` as the effective legacy behavior to port, while still recording where it diverged from the older reference module.

## Old Files Inspected

Desktop attendance/reference files inspected:

- `../QuanLyHangHoa/_reference_chamcong/models.py`
- `../QuanLyHangHoa/_reference_chamcong/services.py`
- `../QuanLyHangHoa/_reference_chamcong/attendance_service.py`
- `../QuanLyHangHoa/_reference_chamcong/MERGE_NOTES.md`
- `../QuanLyHangHoa/_reference_chamcong/summary.md`

Current desktop attendance module files inspected:

- `../QuanLyHangHoa/modules/attendance/db.py`
- `../QuanLyHangHoa/modules/attendance/models.py`
- `../QuanLyHangHoa/modules/attendance/dto.py`
- `../QuanLyHangHoa/modules/attendance/repository.py`
- `../QuanLyHangHoa/modules/attendance/service.py`
- `../QuanLyHangHoa/modules/attendance/blow_work.py`
- `../QuanLyHangHoa/modules/attendance/cut_bonus.py`
- `../QuanLyHangHoa/modules/attendance/report_service.py`
- `../QuanLyHangHoa/modules/attendance/settings_service.py`
- `../QuanLyHangHoa/modules/attendance/product_sync_service.py`
- `../QuanLyHangHoa/modules/attendance/inventory_effect_service.py`
- `../QuanLyHangHoa/modules/attendance/inventory_diagnostic_service.py`
- `../QuanLyHangHoa/modules/attendance/seed.py`
- `../QuanLyHangHoa/modules/attendance/ui/page.py`
- `../QuanLyHangHoa/modules/attendance/ui/employee_tab.py`
- `../QuanLyHangHoa/modules/attendance/ui/day_entry_tab.py`
- `../QuanLyHangHoa/modules/attendance/ui/report_tab.py`
- `../QuanLyHangHoa/modules/settings/ui/page.py`
- `../QuanLyHangHoa/modules/settings/backup_service.py`
- `../QuanLyHangHoa/modules/inventory/models.py`

Desktop tests inspected:

- `../QuanLyHangHoa/tests/test_attendance_batch1.py`
- `../QuanLyHangHoa/tests/test_attendance_day_entry.py`
- `../QuanLyHangHoa/tests/test_attendance_employee_management.py`
- `../QuanLyHangHoa/tests/test_attendance_report.py`
- `../QuanLyHangHoa/tests/test_attendance_settings.py`
- `../QuanLyHangHoa/tests/test_attendance_product_sync.py`
- `../QuanLyHangHoa/tests/test_attendance_inventory_integration.py`
- `../QuanLyHangHoa/tests/test_attendance_inventory_diagnostics.py`
- `../QuanLyHangHoa/tests/test_attendance_inventory_diagnostics_ui.py`
- `../QuanLyHangHoa/tests/test_smoke.py`

## Old Attendance Database Inspected

### DB path

The desktop attendance DB is a standalone SQLite file.

- Code path: `modules/attendance/db.py`
- Runtime path: `LOCALAPPDATA/QuanLyHangHoa/attendance.db`
- Main desktop DB remains separate as `app.db`

The desktop app also backs up both databases together from Settings.

### Schema source

No checked-in live `attendance.db` file was found in the repo for safe row inspection.
Schema and sample behavior were reconstructed from:

- SQLAlchemy models;
- schema upgrade code;
- seed defaults;
- tests that create representative attendance data.

### Attendance tables found

Legacy/current attendance schema:

- `employees`
- `periods`
- `employee_shift_periods`
- `daily_records`
- `work_types`
- `work_logs`
- `bag_types`
- `cut_logs`
- `extra_cut_work_logs`

### Columns and relationships

`employees`

- `id`
- `name` unique
- `team` enum: `blow`, `cut`
- `is_active`

Relations:

- one-to-many `employee_shift_periods`
- one-to-many `daily_records`

`periods`

- `id`
- `start_date`
- `end_date`
- `locked`
- `created_at`

Constraints:

- `start_date <= end_date`
- unique `(start_date, end_date)`

`employee_shift_periods`

- `id`
- `employee_id`
- `period_id`
- `shift` enum: `day`, `night`

Constraints:

- unique `(employee_id, period_id)`

Note:

- model and legacy service exist;
- UI support is incomplete and not a major active feature in the merged desktop app.

`daily_records`

- `id`
- `employee_id`
- `date`
- `period_id`
- `is_absent`
- `status` enum: `draft`, `done`
- `total_amount_snapshot`

Constraints:

- unique `(employee_id, date)`
- non-negative total snapshot

`work_types`

- `id`
- `name`
- `team`
- `input_type` enum: `tick`, `quantity`
- `unit_price`
- `config_json`
- `is_active`

Constraints:

- `team` effectively restricted to `blow`
- unique `(team, name)`

`work_logs`

- `id`
- `daily_record_id`
- `work_type_id`
- `quantity` numeric in current module
- `unit_price_snapshot`
- `amount_snapshot`

Constraints:

- unique `(daily_record_id, work_type_id)`
- quantity minimum `0.5` in current module

`bag_types`

- `id`
- `name` unique
- `unit_price`
- `quota_quantity`
- `excess_unit_price`
- `is_active`
- `is_product_linked`
- `source_product_id`
- `source_product_name_snapshot`
- `is_excluded_from_attendance`
- `is_legacy`

Current module also creates a partial unique index on `source_product_id`.

`cut_logs`

- `id`
- `daily_record_id`
- `bag_type_id`
- `quantity`
- `unit_price_snapshot`
- `quota_quantity_snapshot`
- `excess_unit_price_snapshot`
- `amount_snapshot`

Constraints:

- unique `(daily_record_id, bag_type_id)`

Important behavior note:

- In the current merged desktop app, CUT money is primarily represented by `daily_records.total_amount_snapshot`.
- `cut_logs.amount_snapshot` is written as `0` in current save flow.
- That means historical CUT line-item money is not authoritative. Daily-record total is authoritative.

`extra_cut_work_logs`

- `id`
- `daily_record_id`
- `bag_type_id`
- `quantity`
- `excess_unit_price_snapshot`
- `amount_snapshot`
- `created_at`
- `updated_at`

This is a merged-desktop extension and was not present in the older `_reference_chamcong` model.

### Relationship to main sales/inventory DB

The attendance DB does not foreign-key into `app.db` because it is a separate SQLite file.

Instead, the current desktop app bridges attendance to inventory through:

- `bag_types.source_product_id` in `attendance.db`
- `inventory_stock_effects` in the main `app.db`
- reconciliation services that copy finalized attendance production into stock increases

Observed linkage:

- no direct link to customers;
- no direct link to invoices/orders/sales rows;
- direct product link only for CUT and extra CUT work;
- finalized production can increase inventory stock in the main DB.

### Safe sample records available from code/tests

Because no live attendance DB is checked in, only code-defined sample/default rows were available.

Seed defaults from `modules/attendance/seed.py`:

Default blow work types:

- `Thừa máy`
- `Máy nhỏ`
- `Máy to`
- `Phụ cắt`
- `Phụ găng 1 máy`
- `Phụ găng 2 máy`

Default bag types:

- `Bao 25kg`
- `Bao 50kg`
- `Bao PP`

Important caveat:

- Those seed bag types are not enough for current CUT entry by themselves.
- Current CUT entry requires bag types to be product-linked, not excluded, not legacy, and configured with both `quota_quantity > 0` and `excess_unit_price > 0`.

## Legacy Feature Map

### 1. Employee/worker management

Found behavior:

- create employee with unique name;
- assign employee to exactly one team: `blow` or `cut`;
- active/inactive status;
- list with search;
- filter to include inactive;
- edit name/team/status;
- batch delete selection in current desktop UI.

Delete behavior:

- if employee has no `daily_records`, hard delete;
- if employee has history, switch to inactive instead of deleting.

No evidence found for:

- departments beyond team;
- wage grade tables;
- employee code/number requirement;
- employee-auth linkage in desktop;
- audit trail on employee changes.

### 2. Team/group management

Actual legacy structure is simple:

- team is an enum on employee, not a separate team table.

Teams found:

- `blow`
- `cut`

No separate dynamic team/group CRUD was found.
If the web app later needs more than two teams, that is a product decision beyond legacy parity.

### 3. Daily attendance

Behavior found:

- one `daily_record` per employee per date;
- status is `draft` or `done`;
- absent day is stored explicitly via `is_absent`;
- entry form changes by employee team;
- existing logs are cleared and rebuilt on save;
- both draft save and finalize are supported;
- current desktop save flow allows reopening/replacing an existing `done` day record unless the period is locked.

Observed status labels:

- no record: `Chưa chấm`
- draft: `Nháp`
- done: `Đã lưu`
- absent: `Nghỉ`

No explicit attendance delete flow was found.
Practical replacement behavior is:

- re-save the day;
- or mark absent and save, which clears work rows and sets total `0`.

### 4. Shift/session

Found:

- `EmployeeShiftPeriod`
- shift enum `day` / `night`
- legacy service for assigning shift per period

But:

- current merged desktop app does not expose this as a completed primary workflow;
- no active payroll/report rule was found that materially depends on shift in the current module.

Recommendation:

- keep shift support out of Batch A unless the business explicitly confirms it is still used.

### 5. Work type

For blow team only:

- work types are configurable in settings;
- each work type has:
  - name
  - input type `tick` or `quantity`
  - unit price
  - active flag

Legacy rule smell:

- some business logic is name-driven, especially `Thừa máy` and glove work names;
- this is risky for import and future editing.

### 6. Piecework / khoan

Found in two places:

- blow quantity work pricing;
- cut quota bonus logic.

Blow:

- quantity work usually pays `quantity * unit_price`;
- `Thừa máy` is special and only pays for quantity above quota `3`.

CUT:

- current merged desktop app treats CUT pay as bonus over quota, not simple `quantity * unit_price`;
- rule uses `quota_quantity` and `excess_unit_price`;
- results are snapped into `daily_records.total_amount_snapshot`.

### 7. Cutting team / to cat logic

This is a major legacy/business area.

Found behavior:

- CUT workers enter bag/product-linked quantities;
- selectable bag types are filtered;
- current valid CUT bag types must be:
  - active
  - product-linked
  - not excluded from attendance
  - not legacy
  - `quota_quantity > 0`
  - `excess_unit_price > 0`

Merged desktop evolution:

- bag types are one-way synchronized from main inventory products;
- manual bag types without valid product linkage are deactivated or marked legacy;
- historical bag types can still be displayed when loading existing history.

### 8. Salary calculation

No separate payroll ledger/payout table was found.

The legacy system calculates pay indirectly through:

- `daily_records.total_amount_snapshot`
- report totals per period/month
- legacy helper `calculate_period_total`
- older reference helper `calculate_kpi` for blow team monthly bonus

Important distinction:

- salary summary exists as derived reporting;
- payroll settlement/disbursement workflow does not appear implemented as a durable domain model.

### 9. Advances / deductions

No evidence found for:

- salary advances
- payroll deductions
- penalties ledger
- payout records

If the business needs those, they are new scope, not legacy parity.

### 10. Reports / summary

Found report surfaces:

- 10-day report tab
- monthly report tab

10-day report:

- grouped by employee;
- dynamic work columns per employee;
- total per employee per day;
- total for whole day;
- total row at end;
- future dates in current period are hidden.

Monthly report:

- calendar-month range, not 10-day periods;
- dynamic detail columns;
- total amount and paid workday count.

Inactive employee handling:

- inactive employees still appear in reports if they have history in the selected period/month.

### 11. Export / print

Buttons exist:

- `Xuất Excel`
- `In bảng công`

Current behavior:

- placeholder only;
- no real export/print implementation found in current module or old reference.

### 12. Edit/delete/audit behavior

Found:

- day-entry save clears and rebuilds line rows;
- current save flow can overwrite prior finalized records unless period is locked;
- employee delete falls back to deactivate;
- no audit/version history table;
- no who-changed-it metadata;
- no soft-delete for daily records.

Conclusion:

- legacy data correction is overwrite-based, not audit-based.

## Business Rules

## Period logic

Attendance periods are fixed 10-day cycles:

- day `1-10`
- day `11-20`
- day `21-end of month`

If a selected date does not already belong to an existing period, the system auto-creates that period.

The `locked` field exists and service logic respects it, but active UI for lock management is incomplete.

## Blow-team rules

Input types:

- `tick`: saves quantity `1` when selected and pays one unit price
- `quantity`: accepts decimals in `0.5` increments in the current module

General blow calculation:

- normal quantity work: `quantity * unit_price`
- tick work: `unit_price`

Special `Thừa máy` rule:

- quota is fixed at `3`
- pay only for excess over `3`
- examples confirmed by tests:
  - `2` => `0`
  - `3` => `0`
  - `5` at `30000` => `(5 - 3) * 30000 = 60000`
  - `8.5` at `80000` => `(8.5 - 3) * 80000 = 440000`

Glove exclusivity:

- `Phụ găng 1 máy` and `Phụ găng 2 máy` cannot both exist in the same day record.

Extra CUT work for blow team (`VK`):

- present only in merged desktop module, not the older reference module;
- uses bag type `excess_unit_price`;
- amount = `quantity * excess_unit_price`;
- does not depend on bag quota;
- displayed in reports as `VK`;
- monthly report sums `VK` as money, not as quantity.

Absent rule:

- absent clears logs and sets total `0`.

## CUT-team rules

Current merged desktop rule is quota bonus logic.

Per selected bag type:

- quantity can be decimal and non-negative;
- rows with zero quantity are ignored;
- rows are merged by `bag_type_id` before calculation.

Bag validity for new CUT entry:

- active;
- product-linked;
- not excluded from attendance;
- not legacy;
- `quota_quantity > 0`;
- `excess_unit_price > 0`.

CUT bonus calculation from `cut_bonus.py`:

1. Filter out zero-quantity items.
2. Compute `total_quantity`.
3. Compute `quota_avg = average(quota_quantity of active items)`.
4. If `total_quantity <= quota_avg`, total bonus is `0`.
5. If any single item reaches or exceeds its original quota:
   - that item pays `max(0, quantity - quota) * price`
   - any item below its own quota pays `quantity * price`
6. Otherwise, split quota evenly:
   - each item pays `max(0, quantity - quota / item_count) * price`

Rounding:

- CUT totals are quantized with `ROUND_HALF_UP` before converting to integer money.

Important storage detail:

- CUT row snapshots keep quota and excess price snapshots;
- current service stores row `amount_snapshot=0` and relies on `daily_records.total_amount_snapshot` for the real daily pay total.

## Status and modification rules

Found behavior in current merged desktop module:

- saving always sets record back to `draft` first;
- then clears logs and rebuilds them;
- finalize changes status to `done`;
- draft keeps status `draft`;
- locked periods reject edits.

This is different from lower-level old reference services, which treated finalized records as non-editable.
For web parity, the effective behavior to port is the higher-level current desktop save flow.

## Paid workday counting

Reports count workdays by employee-day with `total_amount_snapshot > 0`.

That means:

- absent day does not count;
- zero-pay day does not count;
- extra CUT-only `VK` day does count if total > 0.

## Inactive employee handling

Entry screens:

- only active employees are shown for normal attendance entry.

Reports:

- include inactive employees when they have history in the selected period/month.

## Product-linked work rules

Current desktop evolution adds strong product coupling for CUT:

- products from the main DB can generate/update linked `bag_types`;
- duplicate active product names are treated as unsafe and skipped with warnings;
- linked rows preserve attendance-specific config such as quota, excess price, exclusion;
- missing/inactive products deactivate linked bag types;
- historical rows become `legacy` instead of being deleted.

## Inventory synchronization rules

Only for merged desktop evolution:

- finalized (`done`) and non-absent production records create inventory effects;
- draft or absent records should not have active inventory effects;
- re-save reconciles by rolling back old effects for the same `daily_record_id` and applying new ones;
- CUT logs for `BAO_KG` products increase stock in `BAO`;
- linked `BICH` products increase stock in `BICH`;
- missing product link or missing main product raises validation errors;
- diagnostics service can detect missing effects, stale effects, product mismatch, quantity mismatch.

## What Was Not Found

Not found in inspected legacy code:

- attendance-half-day or fractional attendance-day concepts separate from piece quantity;
- overtime tables;
- payroll payout approval flow;
- advances/deductions ledger;
- bonus/penalty engine beyond the specific `Thừa máy`, CUT quota, and optional blow extra CUT logic;
- audit history for edits/deletes;
- real export/print pipeline.

## Legacy UI and Workflow

## Main attendance surfaces

Current desktop attendance page:

- `Nhân viên`
- `Chấm công`
- `Báo cáo`

Separate settings area:

- attendance price/config tab under global Settings
- inventory diagnostics panel under Settings

## Employee flow

Observed workflow:

- search employee list;
- optionally include inactive employees;
- add employee;
- edit employee;
- delete selected employees;
- hard delete if no history, otherwise deactivate.

## Day-entry flow

Observed workflow:

1. Select attendance date.
2. Employee list loads active employees with current status labels.
3. Select employee.
4. Form switches by team:
   - blow work form
   - cut quantity form
5. Optional absent toggle.
6. Save draft or finalize.
7. Record reloads with snapshots.

Blow UI details:

- quantity inputs use decimal half-step controls;
- tick work uses checkbox;
- extra CUT work can be toggled;
- extra CUT section hides while absent is checked.

CUT UI details:

- search box to add bag types into a selected table;
- only valid bag types appear for new selection;
- historical inactive/legacy bag types can still load when reopening existing records;
- decimal quantities are supported.

## Reporting flow

10-day tab:

- choose team;
- choose period;
- view grouped report.

Monthly tab:

- choose team;
- choose calendar month;
- view month summary.

Buttons:

- export and print are placeholders only.

## Validation found

- employee name required and unique;
- team must be valid;
- inactive employee cannot be saved;
- blow payload cannot contain cut rows;
- cut payload cannot contain blow rows;
- extra CUT is blow-only;
- quantity must be numeric;
- blow quantity must be in `0.5` increments;
- duplicate blow work types rejected;
- glove type pair rejected together;
- negative quantities rejected;
- invalid/new CUT rows rejected if bag type is excluded, manual, legacy, not linked, or missing quota/price;
- locked periods reject changes.

## Web App Current State

## Backend

Existing backend foundations:

- FastAPI app with route modules for auth, inventory, customers, sales, returns, orders, history, reports
- SQLAlchemy 2.x models
- Alembic migrations through orders schema
- PostgreSQL session wiring

Attendance-specific backend state found:

- no attendance models;
- no attendance repositories/services;
- no attendance routes;
- no attendance schemas;
- no attendance importer from `attendance.db`.

Auth/role state:

- roles already include `attendance_manager` and `employee`
- current admin APIs are not exposed to those roles

## Frontend

Current admin frontend includes:

- dashboard
- inventory
- customers
- history
- sales
- orders
- returns
- reports placeholder
- settings placeholder

Attendance-specific frontend state found:

- no attendance routes;
- no attendance sidebar item;
- no attendance screens;
- admin shell only allows `owner`, `admin`, `read_only`.

Practical implication:

- `attendance_manager` and `employee` roles exist in auth/domain but currently have no usable web surface.

## Current data model surfaces relevant to attendance design

Useful existing web model patterns:

- products and prices already model unit modes/types cleanly;
- inventory balances already track `BAO` vs `BICH` style quantities;
- invoices/orders use snapshot fields;
- auth already supports role-based access.

These patterns fit attendance well:

- use snapshot pricing on attendance logs;
- FK CUT work items to `products` in one database;
- optionally FK attendance employees to `users` for employee portal login.

## Target Web Schema Proposal

## Design principles

- Use one PostgreSQL database.
- Do not preserve the legacy separate `attendance.db`.
- Replace name-driven rules with explicit rule fields where feasible.
- Preserve enough snapshot fields to reproduce legacy money and imports exactly.
- Keep payroll summary derived at first; do not add payout/disbursement tables until needed.

## Proposed attendance tables

### `attendance_employees`

Fields:

- `id`
- `display_name`
- `team` enum: `blow`, `cut`
- `is_active`
- `user_id` nullable unique FK to `users.id`
- `legacy_employee_id` nullable
- timestamps

Why:

- legacy employees are not the same concept as auth users;
- optional linking supports future employee portal.

### `attendance_periods`

Fields:

- `id`
- `start_date`
- `end_date`
- `locked`
- `legacy_period_id` nullable
- timestamps

Constraints:

- unique `(start_date, end_date)`
- `start_date <= end_date`

### `attendance_daily_records`

Fields:

- `id`
- `employee_id` FK
- `work_date`
- `period_id` FK
- `status` enum: `draft`, `done`
- `is_absent`
- `total_amount_snapshot`
- `legacy_daily_record_id` nullable
- `created_by_user_id` nullable
- `updated_by_user_id` nullable
- timestamps

Constraints:

- unique `(employee_id, work_date)`
- non-negative total snapshot

### `attendance_work_types`

Fields:

- `id`
- `name`
- `team` enum, constrained to `blow` for parity
- `input_type` enum: `tick`, `quantity`
- `pricing_rule` enum:
  - `flat_tick`
  - `quantity_full`
  - `quantity_excess_over_quota`
- `quota_quantity` nullable numeric
- `unit_price`
- `is_active`
- `legacy_work_type_id` nullable
- timestamps

Why:

- removes brittle dependence on name `Thừa máy`.

### `attendance_work_logs`

Fields:

- `id`
- `daily_record_id` FK
- `work_type_id` FK
- `quantity`
- `unit_price_snapshot`
- `amount_snapshot`
- timestamps

Constraints:

- unique `(daily_record_id, work_type_id)`
- non-negative quantity

### `attendance_bag_types`

Fields:

- `id`
- `name`
- `product_id` nullable FK to `products.id`
- `source_product_name_snapshot`
- `quota_quantity`
- `excess_unit_price`
- `is_active`
- `is_product_linked`
- `is_excluded_from_attendance`
- `is_legacy`
- `legacy_bag_type_id` nullable
- timestamps

Constraints:

- unique active product link if `product_id` is set

### `attendance_cut_logs`

Fields:

- `id`
- `daily_record_id` FK
- `bag_type_id` FK
- `quantity`
- `quota_quantity_snapshot`
- `excess_unit_price_snapshot`
- `bonus_amount_snapshot`
- `legacy_unit_price_snapshot` nullable
- `legacy_cut_log_id` nullable
- timestamps

Why:

- web schema should store real per-line computed bonus even though current desktop CUT rows do not.
- keep optional legacy unit price snapshot for import fidelity.

### `attendance_extra_cut_logs`

Fields:

- `id`
- `daily_record_id` FK
- `bag_type_id` FK
- `quantity`
- `excess_unit_price_snapshot`
- `amount_snapshot`
- `legacy_extra_cut_log_id` nullable
- timestamps

Recommendation:

- keep this table if the business confirms merged-desktop `VK` behavior is required.
- If not required, drop from MVP and explicitly document that decision.

### Optional later: `attendance_shift_assignments`

Fields:

- `id`
- `employee_id` FK
- `period_id` FK
- `shift`

Recommendation:

- do not include in Batch A unless business confirms active usage.

### Inventory bridge table

Recommended for parity and idempotent reconciliation:

`inventory_stock_effects`

Fields:

- `id`
- `source_type`
- `source_id`
- `source_line_type`
- `source_line_id`
- `attendance_employee_id`
- `attendance_work_date`
- `attendance_bag_type_id`
- `product_id` FK
- `quantity_delta`
- `unit_type`
- `movement_datetime`
- `note`
- timestamps

Reason:

- the current web app already has manual `stock_adjustments`, but attendance reconciliation needs a separate idempotent source-effect table;
- this is the cleanest way to preserve rollback/reapply semantics.

## Target relationships

- `attendance_daily_records.employee_id -> attendance_employees.id`
- `attendance_daily_records.period_id -> attendance_periods.id`
- `attendance_work_logs.daily_record_id -> attendance_daily_records.id`
- `attendance_work_logs.work_type_id -> attendance_work_types.id`
- `attendance_cut_logs.daily_record_id -> attendance_daily_records.id`
- `attendance_cut_logs.bag_type_id -> attendance_bag_types.id`
- `attendance_extra_cut_logs.daily_record_id -> attendance_daily_records.id`
- `attendance_extra_cut_logs.bag_type_id -> attendance_bag_types.id`
- `attendance_bag_types.product_id -> products.id` nullable
- optional `attendance_employees.user_id -> users.id`

## API Plan

Recommended backend route groups:

## Employees/workers

- `GET /api/attendance/employees`
- `POST /api/attendance/employees`
- `GET /api/attendance/employees/{employeeId}`
- `PATCH /api/attendance/employees/{employeeId}`
- `DELETE /api/attendance/employees/{employeeId}`

Behavior:

- delete should preserve legacy semantics:
  - hard delete when no history
  - otherwise deactivate

## Teams / reference data

Because legacy only has enum teams, this can be lightweight:

- `GET /api/attendance/reference`

Returns:

- teams
- shifts if enabled
- status enums
- work input types

## Work types

- `GET /api/attendance/work-types`
- `POST /api/attendance/work-types`
- `PATCH /api/attendance/work-types/{workTypeId}`

## CUT work items / bag types

- `GET /api/attendance/cut-work-items`
- `POST /api/attendance/cut-work-items`
- `PATCH /api/attendance/cut-work-items/{bagTypeId}`
- `POST /api/attendance/cut-work-items/sync-products`
- `GET /api/attendance/cut-work-items/incomplete`

## Day entry

- `GET /api/attendance/day-entry?date=YYYY-MM-DD`
  - list employees and status for date
- `GET /api/attendance/day-entry/{employeeId}?date=YYYY-MM-DD`
  - load day-entry DTO
- `PUT /api/attendance/day-entry/{employeeId}?date=YYYY-MM-DD&finalize=false`
- `PUT /api/attendance/day-entry/{employeeId}?date=YYYY-MM-DD&finalize=true`

Payload should support:

- `is_absent`
- `blow_work[]`
- `cut_work[]`
- optional `extra_cut_work[]`

## Periods

- `GET /api/attendance/periods`
- `POST /api/attendance/periods/ensure-for-date`
- `PATCH /api/attendance/periods/{periodId}`

Recommendation:

- do not expose free-form overlapping period create in MVP;
- keep the legacy 10-day generation rule.

## Reports

- `GET /api/attendance/reports/period?team=blow&periodId=...`
- `GET /api/attendance/reports/monthly?team=cut&month=2026-05`

## Inventory diagnostics

Only if attendance-to-inventory sync is included:

- `GET /api/attendance/inventory-diagnostics`
- `POST /api/attendance/inventory-diagnostics/{dailyRecordId}/reconcile`

## Recommended Authorization Model

Suggested role use:

- `owner`, `admin`: full attendance settings + employee + reports + diagnostics
- `attendance_manager`: full attendance module except global app settings/admin auth
- `employee`: future self-service portal only, limited to own day-entry/review if enabled
- `read_only`: optional report-only access if business wants it

Current web app needs:

- new route guards for `attendance_manager`
- separate non-admin attendance shell if employees will use it directly

## Recommended Implementation Batches

## Batch A: backend schema/service for workers and periods

Deliver:

- attendance DB tables in PostgreSQL
- employee CRUD
- period generation service
- reference enums/routes
- no inventory sync yet

Why first:

- isolates identity and period model from money logic.

## Batch B: backend attendance and calculation logic

Deliver:

- daily record save flow
- blow calculation
- CUT quota logic
- absent handling
- draft/finalize behavior
- report DTO builders

Verification:

- port day-entry calculation tests first

## Batch C: frontend attendance entry UI

Deliver:

- attendance manager UI for employee list
- day-entry screen
- team-specific forms
- draft/finalize flow
- date picker and status list

Recommendation:

- start with manager/admin entry UI, not employee self-service portal.

## Batch D: payroll/report UI

Deliver:

- 10-day report UI
- monthly report UI
- summary cards

Explicitly defer unless requested:

- real Excel export
- print pipeline

## Batch E: product-linked CUT work and inventory effects

Deliver:

- product sync service
- cut-work item settings
- inventory stock effects
- diagnostics/reconcile endpoints

Why later:

- highest cross-domain risk;
- depends on stable attendance core and inventory conventions.

## Batch F: legacy import, permissions, polish, tests

Deliver:

- import from `attendance.db`
- role-specific access
- inactive-history edge cases
- mobile/tablet review if employee portal is in scope
- regression suite for import parity

## Risks

## 1. Name-driven legacy rules

High risk:

- `Thừa máy`
- glove work type names

Current desktop logic still depends on names for some calculations and exclusions.
The web port should replace that with explicit rule fields during migration, while mapping legacy names during import.

## 2. CUT pay is not line-authoritative in current desktop data

High risk:

- current merged desktop stores real CUT total on `daily_records.total_amount_snapshot`
- `cut_logs.amount_snapshot` is not reliable

Import logic must treat daily-record total as authoritative for CUT payroll parity.

## 3. Split-database cross-DB inconsistency in desktop

High risk in legacy, lower risk in web if designed well.

Desktop has:

- `attendance.db`
- `app.db`

Current desktop docs already acknowledge partial-failure scenarios between attendance commit and inventory effect commit.
The web should eliminate this by using one PostgreSQL transaction.

## 4. Product-linking ambiguity

Risks:

- duplicate product names
- renamed products
- deleted or inactive products
- manual legacy bag types with history

The desktop app handles these with warnings, deactivation, and `legacy` flags.
The web importer must preserve the same repair posture instead of deleting rows.

## 5. Missing live attendance DB in repo

Investigation risk:

- no checked-in real `attendance.db` sample was available for row-level production inspection

Mitigation:

- port tests before import;
- request a copied production `attendance.db` later for import rehearsal only.

## 6. Scope confusion between original reference and merged desktop evolution

Risk:

- `_reference_chamcong` is older and simpler
- `modules/attendance` is the active merged behavior

Decision:

- web implementation should target `modules/attendance` parity unless the business explicitly wants the older reference behavior.

## 7. Permissions and shell separation in the web app

Current web app exposes only the admin shell.

Risk:

- `attendance_manager` and `employee` roles exist but have no actual screens/routes

Recommendation:

- define whether attendance lives inside admin shell, separate manager shell, or separate employee portal before frontend Batch C starts.

## 8. Mojibake / encoding issues in legacy desktop source

Risk:

- some inspected desktop source files contain broken Vietnamese string literals
- business rule interpretation remains mostly recoverable, but UI text import or copy-forward would be risky if taken verbatim

Recommendation:

- do not copy legacy UI strings blindly into the web app
- normalize text explicitly in web schemas/translations

## Recommended Web MVP Order

Recommended first shipping slice:

1. Attendance employees
2. 10-day periods
3. Blow day-entry
4. CUT day-entry with explicit quota logic
5. 10-day + monthly reports
6. Attendance manager role access

Recommended explicit deferrals:

- shift assignment UI
- employee self-service portal
- real Excel export
- print
- inventory sync
- diagnostics/reconcile
- import from legacy attendance DB

## Final Recommendations

- Treat `modules/attendance/` as the effective legacy source of truth.
- Keep the web attendance schema in the same PostgreSQL database as inventory.
- Replace name-coupled rules with explicit calculation-rule fields.
- Port tests before import.
- Keep inventory sync out of the first attendance delivery batch.
- Make CUT/product sync a later, separately verified batch.

## Confirmation

During this task:

- no application code was implemented for the new web app;
- no database data was modified;
- no destructive commands were run;
- only this investigation document was added.

## Remaining Broken Text Found During Investigation

One interpretation pass was used during investigation; legacy source text was not modified in this task.

Remaining broken text observed:

| File path | Line | Current broken text | Intended text | Manual repair note |
| --- | --- | --- | --- | --- |
| `../QuanLyHangHoa/modules/attendance/service.py` | 120 | `Phá»¥ gÄƒng 1 mÃ¡y` | `Phụ găng 1 máy` | Repair legacy string literals before reusing as UI labels or rule keys. |
| `../QuanLyHangHoa/modules/attendance/service.py` | 142 | `Máº·t hÃ ng cáº¯t nÃ y chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh...` | `Mặt hàng cắt này chưa được cấu hình...` | Do not copy this message verbatim into web validations. |
| `../QuanLyHangHoa/modules/attendance/report_service.py` | 74 | `Thá»«a mÃ¡y` | `Thừa máy` | Replace mojibake names with normalized UTF-8 before any name-based migration mapping. |
| `../QuanLyHangHoa/modules/attendance/ui/report_tab.py` | 26 | `Tá»• thá»•i` | `Tổ thổi` | Repair UI labels in legacy only if the desktop app itself needs cleanup; for web, rewrite clean strings directly. |
| `../QuanLyHangHoa/modules/attendance/ui/page.py` | 20 | `NhÃ¢n viÃªn` | `Nhân viên` | Avoid using these legacy literals as translation source. |
| `../QuanLyHangHoa/modules/attendance/ui/employee_tab.py` | 22 | `TÃ¬m theo tÃªn nhÃ¢n viÃªn` | `Tìm theo tên nhân viên` | Re-enter clean Vietnamese manually instead of relying on automated byte fixes. |
