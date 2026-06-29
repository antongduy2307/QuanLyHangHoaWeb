## Summary

Batch B replaces the old `/settings` placeholder with a real brown/cream settings shell.

This batch stays intentionally safe:

- no business-setting mutation
- no backup/import execution
- no user-management actions
- no attendance settings editor yet

## Routes

- `/settings` now renders a dedicated settings shell instead of the old placeholder
- it is no longer just a child placeholder inside the admin layout route tree

## Sections

Implemented section tabs:

- `Tổng quan hệ thống`
- `Chấm công`
- `Sao lưu / nhập dữ liệu`
- `Người dùng & phân quyền`

Current content:

- `Tổng quan hệ thống`
  - safe overview cards only
  - no secrets, no database URL, no auth token internals, no CORS config
- `Chấm công`
  - read-only placeholder for upcoming attendance settings
- `Sao lưu / nhập dữ liệu`
  - read-only placeholder
- `Người dùng & phân quyền`
  - read-only placeholder

## Role Behavior

- `owner`
  - can view all sections
- `admin`
  - can view all sections
- `read_only`
  - limited to `Tổng quan hệ thống`
- `attendance_manager`
  - limited to `Chấm công`
- `employee`
  - forbidden

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\router.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\settings\SettingsPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\settings\SettingsPage.test.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`

## Tests Run / Results

- `npm.cmd test -- --run`
  - passed
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed

## Deferred Items

- real attendance settings editor
- backup/import actions
- user/role management actions
- backend system-overview API
