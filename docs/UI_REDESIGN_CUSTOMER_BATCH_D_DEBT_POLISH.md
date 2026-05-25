# UI Redesign Customer Batch D: Debt Polish

Date: 2026-05-22

Scope: frontend-only polish for the debt workflow inside inline customer detail. No backend logic was changed.

## Summary

Batch D improves the clarity and readability of the `No can thu tu khach` tab while preserving all current customer debt behavior.

Implemented:

- clearer primary payment action label:
  - `Thanh toan`
- clearer create-payment submit label:
  - `Ghi nhan thanh toan`
- payment form balance preview:
  - current balance
  - estimated balance after payment
- balance-adjustment preview:
  - current balance
  - target balance
  - estimated delta
- balance status helper on the debt summary bar:
  - customer owes
  - customer prepaid
  - balanced
- improved section labels and table headers for:
  - payment list
  - debt timeline
- slightly improved spacing and visual grouping inside the debt tab

## Behavior Preserved

- payment amount remains positive-only
- overpayment and negative-balance behavior remains allowed
- payment create/edit/delete still uses the existing customer debt-payment endpoints
- balance adjustment still uses the existing target-balance correction endpoint
- ledger ordering logic was not changed
- no backend customer, ledger, or debt logic was modified

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerInlineDetailPanel.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\DebtPaymentForm.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`

## Coverage

- inline debt tab still renders debt controls
- inline debt tab now covers payment preview
- inline debt tab now covers target-balance preview
- existing customer debt workflow tests remain green
