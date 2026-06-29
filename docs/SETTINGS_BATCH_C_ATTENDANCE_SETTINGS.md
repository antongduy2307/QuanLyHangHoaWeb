## Summary

Batch C replaces the `Chấm công` placeholder inside `/settings` with a real attendance settings editor tied to the existing attendance module.

This batch includes:

- backend mutation routes for blow work types and CUT work items
- frontend attendance settings editor under `/settings`
- live query invalidation so `/attendance` day-entry reflects settings changes immediately
- read-only diagnostics summary
- snapshot-safe behavior for historical attendance records

## APIs Added

### Work types

- `POST /api/attendance/work-types`
- `PATCH /api/attendance/work-types/{work_type_id}`
- existing `GET /api/attendance/work-types`
- existing `POST /api/attendance/work-types/seed-defaults`

### CUT work items

- `POST /api/attendance/cut-work-items`
- `PATCH /api/attendance/cut-work-items/{bag_type_id}`
- existing `GET /api/attendance/cut-work-items`
- existing `GET /api/attendance/cut-products/search`
- existing `POST /api/attendance/cut-work-items/from-product`

### Diagnostics

- existing `GET /api/attendance/inventory-diagnostics`

## UI Behavior

Inside `/settings` → `Chấm công`:

- `Tổ thổi`
  - list work types
  - create work type
  - edit work type
  - deactivate / reactivate
  - seed default blow work types
- `Tổ cắt`
  - list CUT work items
  - search products and create linked CUT items
  - edit quota / excess price
  - toggle active
  - toggle excluded
  - toggle legacy
- `Diagnostics`
  - read-only issue summary
  - issue table

## Safety Rules

- no destructive delete paths were added
- work type changes affect future day-entry only
- CUT item config changes affect future CUT / VK entries only
- historical day-entry records continue to use stored snapshots
- inactive blow work types disappear from new day-entry but stay visible in historical records
- excluded / legacy / inactive CUT items are not selectable for new day-entry

## Diagnostics Behavior

The settings screen shows read-only attendance inventory diagnostics:

- missing effects
- product mismatch
- quantity mismatch
- effect exists for non-final records

No repair action was added in this batch.

## Integration Notes

Attendance settings are wired to the real day-entry workflow:

- settings mutations invalidate the shared attendance query space
- `/attendance` refreshes updated work types and CUT items automatically
- blow preview/save uses updated work type config
- CUT / VK preview/save uses updated bag type quota and excess price

## Tests Run / Results

Backend:

- `uv run pytest`
  - passed
- `python -m compileall app tests`
  - attempted
  - Python source compiled, but writing some `__pycache__` files still hit the existing workspace permission issue

Frontend:

- `npm.cmd test -- --run`
  - passed
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed

## Deferred Items

- backup/import actions
- user/role management UI
- payroll payout/advance/deduction settings
- diagnostics repair actions
- report/dashboard settings
