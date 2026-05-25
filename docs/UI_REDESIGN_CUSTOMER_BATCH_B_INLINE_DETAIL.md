# UI Redesign Customer Batch B: Inline Detail

Date: 2026-05-22

Scope: frontend-only inline customer detail under the customer list row. No backend behavior changes were made.

## Summary

Batch B adds desktop-style inline customer detail directly under the selected customer row in the redesigned customer list.

Implemented:

- row click now toggles an inline detail row beneath the selected customer
- inline detail uses three tabs:
  - `Thong tin chung`
  - `Lich su ban/tra hang`
  - `No can thu tu khach`
- general tab shows:
  - customer profile summary
  - current balance
  - total sales
  - quick links to open full detail and edit
- sales/returns history tab shows:
  - customer-filtered invoices
  - customer-filtered returns
  - item summary, code, time, amount, and open links
- debt tab keeps current customer debt workflows inline:
  - balance-adjustment form
  - standalone debt-payment create/edit/delete
  - debt timeline built from customer ledger rows

## Behavior Preserved

- customer backend/API logic remains unchanged
- customer search, positive-debt filter, and inactive filter semantics remain unchanged
- balance adjustment still posts to the existing balance-adjustment endpoint
- debt payment CRUD still uses the existing customer debt-payment endpoints
- ledger ordering remains server-driven from `transaction_datetime`, `display_order`, and `id`
- customer detail route still exists and remains linked from the inline panel

## Frontend API Surface Extended

No backend work was required.

Frontend sales/returns list clients were extended to pass optional `customer_id` because the backend list routes already support it:

- `frontend/src/api/sales.ts`
- `frontend/src/api/returns.ts`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/returns/returnQueries.ts`

This was required to render customer-specific invoice/return history inline without changing server behavior.

## Files Changed

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerInlineDetailPanel.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\invoiceQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\returnQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\sales.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\returns.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`

## Test Coverage Added / Updated

- selecting a customer row renders inline detail beneath that row
- inline tabs render
- selected customer fetches invoice and return history with `customer_id`
- debt tab renders inline debt controls and timeline
- existing customer list/detail behavior remains covered

## Notes

- The debt timeline uses fields already exposed by the current customer ledger API and does not require backend schema expansion.
- Inline create/edit modal redesign is still deferred.
- Full customer detail page remains available for deep-linking and as a fallback workflow.
