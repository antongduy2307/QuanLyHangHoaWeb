# Attendance Batch F Legacy Import Rehearsal

## Summary

Batch F prepares legacy `attendance.db` import safely through investigation and dry-run tooling only.

Implemented:

- located the legacy attendance database
- inspected a repo/dev copy read-only
- documented legacy schema, counts, relationships, and safe anonymized samples
- created a dry-run rehearsal script:
  - [attendance_import_dry_run.py](/E:/QuanLyHangHoaWeb/QuanLyHangHoaWeb/backend/scripts/attendance_import_dry_run.py)

Not implemented in this batch:

- production import
- disposable target import apply path
- frontend changes
- modifications to the legacy desktop app or legacy DB

## DB Availability

Legacy attendance DB was found in two places:

- runtime path:
  - `C:\Users\Admin\AppData\Local\QuanLyHangHoa\attendance.db`
- repo/dev copy:
  - [attendance.db](/E:/QuanLyHangHoaWeb/QuanLyHangHoa/attendance.db)

For this batch, investigation and dry-run rehearsal used the repo/dev copy to avoid touching the runtime file beyond existence checks.

## Legacy Schema / Counts

Source inspected:

- [attendance.db](/E:/QuanLyHangHoaWeb/QuanLyHangHoa/attendance.db)

Expected tables were all present.

Row counts:

- `employees`: `24`
- `periods`: `2`
- `employee_shift_periods`: `0`
- `daily_records`: `206`
- `work_types`: `8`
- `work_logs`: `234`
- `bag_types`: `62`
- `cut_logs`: `114`
- `extra_cut_work_logs`: `0`

Status counts:

- `done`: `205`
- `draft`: `1`

Absent rows:

- `0`

Employee team counts:

- `blow`: `9`
- `cut`: `15`

Legacy payroll sums:

- `SUM(daily_records.total_amount_snapshot) = 46371000`
- `SUM(cut_logs.amount_snapshot) = 0`
- `SUM(extra_cut_work_logs.amount_snapshot) = 0`

Important implication:

- `daily_records.total_amount_snapshot` remains authoritative for CUT totals in import validation.

## Columns / Nullable Fields / FK-Like Relationships

## `employees`

Columns:

- `id`
- `name`
- `team`
- `is_active`

Nullable:

- none

FK-like relationships:

- referenced by `employee_shift_periods.employee_id`
- referenced by `daily_records.employee_id`

## `periods`

Columns:

- `id`
- `start_date`
- `end_date`
- `locked`
- `created_at`

Nullable:

- none

FK-like relationships:

- referenced by `employee_shift_periods.period_id`
- referenced by `daily_records.period_id`

## `employee_shift_periods`

Columns:

- `id`
- `employee_id`
- `period_id`
- `shift`

Nullable:

- none

FK-like relationships:

- `employee_id -> employees.id`
- `period_id -> periods.id`

Actual row count is zero in this source snapshot.

## `daily_records`

Columns:

- `id`
- `employee_id`
- `date`
- `period_id`
- `is_absent`
- `status`
- `total_amount_snapshot`

Nullable:

- none

FK-like relationships:

- `employee_id -> employees.id`
- `period_id -> periods.id`

## `work_types`

Columns:

- `id`
- `name`
- `team`
- `input_type`
- `unit_price`
- `config_json`
- `is_active`

Nullable:

- `config_json`

FK-like relationships:

- referenced by `work_logs.work_type_id`

Observed names:

- `Thừa máy`
- `Máy nhỏ`
- `Máy to`
- `Phụ cắt`
- `Phụ găng 1 máy`
- `Phụ găng 2 máy`
- `thông ca`
- `cắt thêm bao`

## `work_logs`

Columns:

- `id`
- `daily_record_id`
- `work_type_id`
- `quantity`
- `unit_price_snapshot`
- `amount_snapshot`

Nullable:

- none

FK-like relationships:

- `daily_record_id -> daily_records.id`
- `work_type_id -> work_types.id`

## `bag_types`

Columns:

- `id`
- `name`
- `unit_price`
- `is_active`
- `quota_quantity`
- `excess_unit_price`
- `is_product_linked`
- `source_product_id`
- `source_product_name_snapshot`
- `is_excluded_from_attendance`
- `is_legacy`

Nullable:

- `source_product_id`
- `source_product_name_snapshot`

Observed bag-type state mix:

- manual active/non-legacy: `9`
- manual legacy: `9`
- product-linked active selectable: `32`
- product-linked excluded: `12`

Product link readiness:

- linked bag types total: `44`
- linked bag types with `source_product_id`: `44`
- linked bag types missing `source_product_id`: `0`

## `cut_logs`

Columns:

- `id`
- `daily_record_id`
- `bag_type_id`
- `quantity`
- `unit_price_snapshot`
- `quota_quantity_snapshot`
- `excess_unit_price_snapshot`
- `amount_snapshot`

Nullable:

- `quota_quantity_snapshot`
- `excess_unit_price_snapshot`

FK-like relationships:

- `daily_record_id -> daily_records.id`
- `bag_type_id -> bag_types.id`

## `extra_cut_work_logs`

Columns:

- `id`
- `daily_record_id`
- `bag_type_id`
- `quantity`
- `excess_unit_price_snapshot`
- `amount_snapshot`
- `created_at`
- `updated_at`

Nullable:

- none

FK-like relationships:

- `daily_record_id -> daily_records.id`
- `bag_type_id -> bag_types.id`

Actual row count is zero in this source snapshot.

## Safe Anonymized Sample Rows

Examples from the source snapshot:

- `employees`
  - `id=1`, `name='vĩ***'`, `team='blow'`, `is_active=1`
  - `id=2`, `name='1***'`, `team='cut'`, `is_active=1`

- `daily_records`
  - `id=2`, `employee_id='employee#2'`, `date='2026-05-08'`, `status='done'`, `total_amount_snapshot=150000`
  - `id=3`, `employee_id='employee#1'`, `date='2026-05-03'`, `status='done'`, `total_amount_snapshot=540000`

- `work_logs`
  - `daily_record_id=3`, `work_type_id=1`, `quantity=4`, `amount_snapshot=320000`

- `cut_logs`
  - `daily_record_id=2`, `bag_type_id=4`, `quantity=30`, `quota_quantity_snapshot=20`, `excess_unit_price_snapshot=15000`, `amount_snapshot=0`

- product-linked `bag_types`
  - `id=17`, `name='19t'`, `source_product_id=1`, `is_excluded_from_attendance=0`, `is_legacy=0`
  - `id=18`, `name='c400'`, `source_product_id=2`, `is_excluded_from_attendance=1`, `is_legacy=0`

## Mapping Plan

Legacy to web mapping:

- `employees -> attendance_employees`
- `periods -> attendance_periods`
- `daily_records -> attendance_daily_records`
- `work_types -> attendance_work_types`
- `work_logs -> attendance_work_logs`
- `bag_types -> attendance_bag_types`
- `cut_logs -> attendance_cut_logs`
- `extra_cut_work_logs -> attendance_extra_cut_logs`

Special mappings:

- `employees.team`
  - legacy `blow -> blow`
  - legacy `cut -> cut`

- `daily_records.status`
  - legacy `draft -> draft`
  - legacy `done -> done`

- `work_types.name -> pricing_rule`
  - `Thừa máy -> quantity_excess_over_quota`, quota `3`
  - `Phụ găng 1 máy -> flat_tick`, `exclusive_group=glove`
  - `Phụ găng 2 máy -> flat_tick`, `exclusive_group=glove`
  - other quantity work types default to `quantity_full` unless later source evidence contradicts this

- CUT amount caveat
  - use `daily_records.total_amount_snapshot` as authoritative
  - do not trust `cut_logs.amount_snapshot` for imported CUT money checks

- Product links
  - map `bag_types.source_product_id` to `attendance_bag_types.product_id` only when product import mapping exists and is validated
  - otherwise preserve:
    - `source_product_name_snapshot`
    - `is_product_linked`
    - and import as legacy/unlinked if needed for safety

## Dry-Run Tool

Created:

- [attendance_import_dry_run.py](/E:/QuanLyHangHoaWeb/QuanLyHangHoaWeb/backend/scripts/attendance_import_dry_run.py)

Behavior:

- opens source SQLite using read-only URI mode
- inspects expected tables
- collects:
  - row counts
  - columns
  - foreign keys
  - anonymized sample rows
  - mapping warnings
- never writes by default
- `--apply` is intentionally disabled in this script to prevent accidental non-disposable imports

Example usage:

```powershell
.venv\Scripts\python.exe scripts\attendance_import_dry_run.py --source-db E:\QuanLyHangHoaWeb\QuanLyHangHoa\attendance.db
```

Optional JSON output:

```powershell
.venv\Scripts\python.exe scripts\attendance_import_dry_run.py --source-db E:\QuanLyHangHoaWeb\QuanLyHangHoa\attendance.db --output-json attendance_dry_run.json
```

## Risks

- Legacy work type and employee names may still need normalization review before final import.
  - no duplicate employee names were found in this snapshot
  - but mojibake-safe normalization should still be part of the real importer

- `daily_records.total_amount_snapshot` and `cut_logs.amount_snapshot` disagree by design.
  - importer validation must use daily-record totals for CUT payroll parity

- `extra_cut_work_logs` has zero rows in this snapshot.
  - the import path still needs to support it, but the current source cannot prove it with real data

- Product-linked bag types exist and all linked rows in this snapshot have `source_product_id`.
  - real import still depends on a validated product ID mapping from the sales/inventory import

- Inventory effects must not be recreated blindly.
  - only recreate attendance inventory effects after product links are validated against the imported product universe

- Attendance import must be coordinated with main `app.db` import.
  - specifically for product IDs and any future effect reconstruction

## Validation Checklist

After a disposable import, verify:

- employee count
- period count
- daily record count
- total payroll by period
- total payroll by month
- total payroll by employee
- blow totals
- cut totals
- absent day count
- finalized vs draft count
- inventory effect count if product-linked import is enabled
- source `SUM(total_amount_snapshot)` vs target `SUM(total_amount_snapshot)`

Useful source anchors from this snapshot:

- employee count: `24`
- period count: `2`
- daily record count: `206`
- finalized count: `205`
- draft count: `1`
- absent count: `0`
- total payroll sum: `46371000`
- CUT totals by period:
  - period `1`: `8036000`
  - period `2`: `12255000`
- blow totals by period:
  - period `1`: `14290000`
  - period `2`: `11790000`

## Next Step

Next implementation step:

- build a disposable-target importer that:
  - reads source attendance.db in read-only mode
  - loads a validated product ID mapping from the main import process
  - imports attendance tables into a disposable PostgreSQL database
  - does not recreate inventory effects unless product-link validation passes

## Readiness

Ready for real import implementation:

- `attendance.db` source is available
- schema and counts are understood
- a dry-run rehearsal tool now exists

Not ready for production import:

- no disposable-target apply importer exists yet
- no validated product ID mapping handoff is implemented yet
- no production cutover safeguards or rollback flow are defined for attendance import
