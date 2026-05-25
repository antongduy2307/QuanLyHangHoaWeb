# UI Redesign Customer Batch F: Shell Alignment

Date: 2026-05-22

## Summary

Batch F aligns Customer with the redesigned brown/cream application shell already used by Inventory, Sales, and Orders.

`/customers` and its visible fallback routes no longer render inside the old `AdminLayout` sidebar/top-bar chrome. They now use the shared top-navigation shell with:

- horizontal top navigation
- brown/cream theme
- shared app identity
- active `Khach hang` navigation state

Customer Batch A-E content remains intact:

- left filter rail
- search bar
- customer table and summary row
- inline detail row with tabs
- create/edit modal
- debt tab
- sales/returns history tab

## Shell Decision

- Reused the existing shared `InventoryModuleShell` rather than introducing a new shell component.
- Extended `AdminLayout` bypass logic so customer routes render as full-bleed redesign surfaces.
- Normalized the shared top-shell labels to the existing ASCII copy style already used in the rest of the frontend.

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\layouts\AdminLayout.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\InventoryModuleShell.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`

## Route Behavior

- `/customers`
  - uses redesigned top shell
  - keeps customer list + inline detail behavior
- `/customers/new`
  - uses redesigned top shell
  - shows shared create modal component
- `/customers/:id`
  - uses redesigned top shell
  - keeps standalone detail fallback
- `/customers/:id/edit`
  - uses redesigned top shell
  - shows shared edit modal component

## Preserved Customer Behavior

- customer search by name/phone
- `only_positive_debt`
- `include_inactive`
- frontend-side sort behavior
- row selection
- inline detail tabs
- create/edit modal behavior
- target balance adjustment via existing endpoint
- debt payment create/edit/delete via existing endpoints
- ledger ordering/recompute semantics
- role guards

## Tests Run / Results

Frontend:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

All passed.

## Known Limitations

- The dashboard, reports, and settings pages are still separate surfaces and were not redesigned in this batch.
- Customer standalone detail remains a fallback page rather than being fully merged into the inline-detail-only workflow.
