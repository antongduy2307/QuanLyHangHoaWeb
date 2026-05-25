# UI Redesign Customer Batch C: Create/Edit Modal

Date: 2026-05-22

Scope: frontend-only redesign of customer create/edit into modal style. Backend behavior remains unchanged.

## Summary

Batch C replaces list-driven create/edit navigation with desktop-style modal dialogs while preserving the existing customer backend workflows.

Implemented:

- `Tao khach` from the customer list now opens an in-place create modal
- `Sua khach hang` from inline customer detail now opens an in-place edit modal
- create modal fields:
  - `Ten khach hang`
  - `Dien thoai`
  - `Dia chi`
  - `Ghi chu`
  - `So du ban dau`
- edit modal fields:
  - `Ten khach hang`
  - `Dien thoai`
  - `Dia chi`
  - `Ghi chu`
  - `Cong no muc tieu`
- edit modal does not expose manual `total_sales` editing
- standalone create/edit routes remain available and now reuse the same modal component as fallback entrypoints

## Behavior Preserved

- customer profile update still uses the existing customer update endpoint
- target current balance still uses the existing balance-adjustment endpoint
- no direct balance mutation is performed on the frontend
- manual `total_sales` editing remains disallowed
- React Query invalidation continues to refetch:
  - customer list
  - customer detail
  - customer ledger
  - debt payments

## Implementation Notes

- A reusable `CustomerFormDialog` now owns create/edit form behavior
- edit flow is intentionally split into:
  1. profile update request
  2. conditional balance-adjustment request when target balance changed
- no backend contract changes were required

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerFormDialog.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerInlineDetailPanel.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`

## Coverage

- create button visibility remains role-aware
- create modal opens from the customer list
- create modal submits to existing create endpoint
- edit modal opens from inline customer detail
- edit modal still uses balance-adjustment endpoint for target balance changes
- existing route-based create/edit tests remain covered
