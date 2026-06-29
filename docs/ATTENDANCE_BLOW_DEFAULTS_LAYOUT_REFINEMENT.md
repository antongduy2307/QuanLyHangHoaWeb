## Summary

This refinement narrows the default blow-team seed to the six core legacy work types and keeps the two configurable extras out of new day-entry flows. The attendance page also tightens the left status panel so it fits its content instead of leaving a large empty block under the employee list.

## Legacy Files Inspected

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\seed.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\blow_work.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\settings_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\attendance.db`

## Exact Defaults

Active default blow work types now seeded:

- `Thừa máy`
- `Máy nhỏ`
- `Máy to`
- `Phụ cắt`
- `Phụ găng 1 máy`
- `Phụ găng 2 máy`

Behavior kept from prior batches:

- `Thừa máy` uses `quantity_excess_over_quota` with quota `3`
- `Phụ găng 1 máy` and `Phụ găng 2 máy` share `exclusive_group=glove`
- seeding is idempotent and does not overwrite existing user-edited values

Removed from the default seed:

- `thông ca`
- `cắt thêm bao`

If those two work types already exist in a dev database, the seed path marks them inactive instead of deleting them. Historical records remain intact, but they no longer appear in active blow day-entry options.

## Conflict Resolution

There is a source conflict between the legacy desktop seed and the inspected legacy `attendance.db`.

- `seed.py` reflects the six core defaults
- the inspected `attendance.db` also contains `thông ca` and `cắt thêm bao` as active blow work types

This refinement follows the current task requirement:

- keep desktop parity for the six core defaults
- treat `thông ca` and `cắt thêm bao` as deferred configurable extras
- do not seed them by default
- hide them from new blow day-entry entry when they already exist

## Endpoint And UI Behavior

Backend:

- `POST /api/attendance/work-types/seed-defaults`
- allowed roles: `owner`, `admin`, `attendance_manager`
- forbidden: `read_only`, `employee`

Frontend:

- the attendance page still exposes the seed-defaults action for writable roles
- when no blow work types exist, the page can seed them once and then reload through React Query invalidation
- the blow day-entry form renders only the six active defaults

## Layout Refinement

The left `Danh sách trạng thái` panel is explicitly pinned to content height:

- the attendance grid already aligns items to the top
- the list panel now also uses `align-self: start`
- `height: fit-content` remains in place

This keeps the brown/cream shell unchanged while removing the stretched empty area below the employee rows.

## Tests Run / Results

- `python -m compileall app tests`
  - passed
- `uv run pytest`
  - passed
- `npm.cmd test -- --run`
  - passed
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed

## Files In Scope

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\attendance_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_attendance_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_attendance_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\attendance.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\types.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\attendance\AttendancePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\attendance\AttendancePage.test.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\attendance\attendanceQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\tests\appTestHarness.ts`

