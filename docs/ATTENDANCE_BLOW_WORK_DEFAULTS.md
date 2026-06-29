# Attendance Blow Work Defaults

## Summary

This batch ports the legacy desktop blow-team work settings into the web app as idempotent defaults.

Implemented:

- exact default blow work seed set
- idempotent backend seeding action
- no overwrite of existing work type values
- frontend attendance button to create default blow work types
- automatic one-time frontend seed attempt when no blow work types exist

## Legacy Files Inspected

Desktop/reference sources inspected:

- `QuanLyHangHoa/modules/attendance/seed.py`
- `QuanLyHangHoa/modules/attendance/service.py`
- `QuanLyHangHoa/modules/attendance/blow_work.py`
- `QuanLyHangHoa/modules/attendance/settings_service.py`
- legacy attendance DB:
  - [attendance.db](/E:/QuanLyHangHoaWeb/QuanLyHangHoa/attendance.db)
- related legacy tests:
  - `QuanLyHangHoa/tests/test_attendance_day_entry.py`
  - `QuanLyHangHoa/tests/test_attendance_report.py`

## Exact Defaults

Final default blow work types used by the web app:

1. `Thừa máy`
   - `input_type=quantity`
   - `pricing_rule=quantity_excess_over_quota`
   - `quota_quantity=3`
   - `unit_price=80000`
   - `exclusive_group=null`
   - `is_active=true`

2. `Máy nhỏ`
   - `input_type=quantity`
   - `pricing_rule=quantity_full`
   - `quota_quantity=null`
   - `unit_price=30000`
   - `exclusive_group=null`
   - `is_active=true`

3. `Máy to`
   - `input_type=quantity`
   - `pricing_rule=quantity_full`
   - `quota_quantity=null`
   - `unit_price=40000`
   - `exclusive_group=null`
   - `is_active=true`

4. `Phụ cắt`
   - `input_type=quantity`
   - `pricing_rule=quantity_full`
   - `quota_quantity=null`
   - `unit_price=50000`
   - `exclusive_group=null`
   - `is_active=true`

5. `Phụ găng 1 máy`
   - `input_type=tick`
   - `pricing_rule=flat_tick`
   - `quota_quantity=null`
   - `unit_price=30000`
   - `exclusive_group=glove`
   - `is_active=true`

6. `Phụ găng 2 máy`
   - `input_type=tick`
   - `pricing_rule=flat_tick`
   - `quota_quantity=null`
   - `unit_price=50000`
   - `exclusive_group=glove`
   - `is_active=true`

7. `thông ca`
   - `input_type=quantity`
   - `pricing_rule=quantity_full`
   - `quota_quantity=null`
   - `unit_price=130000`
   - `exclusive_group=null`
   - `is_active=true`

8. `cắt thêm bao`
   - `input_type=quantity`
   - `pricing_rule=quantity_full`
   - `quota_quantity=null`
   - `unit_price=10000`
   - `exclusive_group=null`
   - `is_active=true`

## Conflict Resolution

Conflict found:

- `seed.py` defines only the first six blow work types.
- the actual legacy `attendance.db` currently contains eight active blow work types:
  - the seed six
  - plus `thông ca`
  - plus `cắt thêm bao`

Decision:

- prefer the actual legacy `attendance.db` over `seed.py` for current behavior
- therefore the web default seed includes all eight active legacy blow work types

Other rule confirmations:

- `Thừa máy` special rule is confirmed in legacy code/tests and uses quota `3`
- glove exclusivity is confirmed in legacy code/tests and is modeled as `exclusive_group=glove`

## Endpoint Behavior

Added endpoint:

- `POST /api/attendance/work-types/seed-defaults`

Allowed:

- `owner`
- `admin`
- `attendance_manager`

Forbidden:

- `read_only`
- `employee`

Behavior:

- creates only missing default blow work types
- does not duplicate rows
- does not overwrite existing user-edited values
- returns:
  - created count
  - skipped count
  - created names
  - skipped names

## Frontend Behavior

Added attendance UI support:

- button:
  - `Tạo công việc tổ thổi mặc định`
- available only for mutation roles
- hidden for `read_only`

Also added safe auto-seed behavior:

- when attendance page loads and there are zero blow work types
- and the current user can mutate attendance
- frontend attempts the seed endpoint once automatically

This is safe because:

- backend seeding is idempotent
- backend does not overwrite existing values

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
  - `367 passed, 27 skipped`
- `npm.cmd test -- --run`
  - passed
  - `85 passed`
- `npm.cmd run build`
  - passed
  - Vite chunk-size warning only
- `npm.cmd run lint`
  - passed

## Notes

- This batch focuses only on blow-team defaults.
- CUT work setup was intentionally not redesigned here.
- Existing CUT work behavior remains unchanged.
