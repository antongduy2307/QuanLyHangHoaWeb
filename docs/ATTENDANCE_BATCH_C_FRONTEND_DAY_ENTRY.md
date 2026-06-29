# Attendance Batch C Frontend Day Entry

## Summary

Batch C adds the frontend attendance manager UI for Batch A/B backend APIs.

Implemented:

- new `/attendance` route
- navigation entry: `Chấm công`
- attendance page using the existing brown/cream shell
- `Nhân viên` tab
- `Chấm công` tab
- employee CRUD UI with role-based mutation control
- day-entry UI for blow and cut teams
- absent toggle, draft/finalize actions, validation display, and locked-period error display
- attendance API client and React Query hooks
- frontend tests for routing, nav, employee flows, day-entry flows, and role behavior

Deferred:

- reports tab
- inventory sync
- import
- employee self-service portal

## Routes

Added:

- `/attendance`

Role access:

- allowed: `owner`, `admin`, `attendance_manager`, `read_only`
- forbidden: `employee`

Design decision:

- attendance is mounted as its own route instead of requiring the full admin shell path
- this lets `attendance_manager` access attendance without inheriting the rest of the admin module permissions

## UI Behavior

## Navigation

Added `Chấm công` navigation link to:

- sidebar navigation
- redesigned top navigation shell

Role-aware nav behavior:

- `owner`, `admin`, `read_only`: existing admin links plus attendance
- `attendance_manager`: attendance link only in the redesigned top shell path

## Attendance page

The page uses the existing redesigned brown/cream shell via `InventoryModuleShell`.

Tabs:

- `Nhân viên`
- `Chấm công`

Deferred:

- `Báo cáo`

## Employee tab

Implemented:

- search by employee name
- team filter:
  - `Tất cả`
  - `Tổ thổi`
  - `Tổ cắt`
- include inactive toggle
- create employee dialog
- edit employee dialog
- delete employee action

Role behavior:

- `owner`, `admin`, `attendance_manager`: mutate
- `read_only`: view only

Delete behavior follows backend result:

- hard delete if no history
- deactivate if history exists

## Day-entry tab

Implemented:

- date picker
- employee status list for selected date
- employee selection loads day-entry detail
- status labels:
  - `Chưa chấm`
  - `Nháp`
  - `Đã lưu`
  - `Nghỉ`

### Blow team form

Implemented:

- renders work types from API
- checkbox inputs for tick work
- number inputs for quantity work
- `0.5` step quantity support
- glove exclusivity enforced in UI using `exclusive_group`
- optional `VK / Làm thêm cắt` section when cut work items are available
- client-side total preview

### Cut team form

Implemented:

- cut work item search input
- selectable bag-type add flow
- selected rows with decimal quantity input
- client-side total preview using the same split-quota rule shape as backend

### Common form behavior

- absent checkbox
- absent visually disables work inputs
- `Lưu nháp` button
- `Lưu chính thức` button
- React Query invalidation after save
- backend validation errors displayed
- locked-period errors displayed

## API Client Changes

Added frontend attendance client:

- employee list/create/get/update/delete
- attendance reference
- work type list
- cut work item list
- day-entry list/detail/save

Added React Query hooks for:

- employees
- reference
- work types
- cut work items
- day-entry list
- day-entry detail
- employee mutations
- day-entry save mutation

## Role Behavior

Frontend role behavior in Batch C:

- `owner`: full attendance UI
- `admin`: full attendance UI
- `attendance_manager`: full attendance UI
- `read_only`: page access but no mutation controls
- `employee`: blocked by route guard

## Tests Run / Results

Commands run:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`
  - passed
  - `84 passed`
- `npm.cmd run build`
  - passed
  - Vite bundle-size warning only
- `npm.cmd run lint`
  - passed

Backend commands were not run in this batch because the backend was not changed.

## Deferred Items

Still deferred after Batch C:

- reports tab
- inventory sync
- import from `attendance.db`
- employee self-service portal
- Excel / print
- payroll payout / advance / deduction flows
