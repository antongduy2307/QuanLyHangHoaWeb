# UI Redesign Customer Batch A: List

Date: 2026-05-22

Scope: frontend-only redesign of the Customer list page. No backend changes were made.

## Summary

Batch A redesigns the Customer list toward the desktop/KiotViet workflow while preserving the existing customer API behavior.

Implemented:

- brown/cream customer list shell aligned with the inventory/sales visual system
- left filter rail with:
  - `Tao khach`
  - `Sap xep`
  - `Chi hien khach dang no`
  - `Hien khach ngung dung`
- main content area with:
  - search bar
  - compact customer table
- reduced table columns to:
  - `Ten khach`
  - `Dien thoai`
  - `Cong no`
  - `Tong mua`
- first-row aggregate summary for current filtered result set
- frontend-side sorting only, leaving backend query semantics unchanged
- clickable row selection with selected-row highlight
- inactive customer visual marker when inactive rows are included
- owner/admin create visibility preserved
- `read_only` remains view-only

## Behavior Preserved

- backend search still uses the existing `search` query and matches name/phone server-side
- existing backend filters remain unchanged:
  - `only_positive_debt`
  - `include_inactive`
- customer detail navigation remains via customer-name link
- no backend API contract changes
- no customer detail, ledger, or debt-form redesign included

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`

## Test Coverage Added / Updated

- redesigned customer-list columns render
- search still calls backend query
- filter toggles still preserve backend query params
- summary row totals render from current result set
- frontend-side sorting works
- selected row highlight works
- inactive customer state/label renders
- `read_only` still cannot create

## Notes

- Sorting is intentionally frontend-side in Batch A.
- Search placeholder is now list-focused, but server-side search semantics remain unchanged.
- Inline detail expansion is deferred to a later batch.
