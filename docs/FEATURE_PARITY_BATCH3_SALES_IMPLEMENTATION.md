# Feature Parity Batch 3: Sales/Invoice P0/P1 Implementation

## Summary

Batch 3 tightens sales/invoice parity without redesigning the UI. The web app now searches invoices on the backend by invoice code or customer snapshot name, avoids invoice code collisions when imported invoice codes exist without document counters, preserves paid amount on PATCH when omitted, and keeps inactive historical customer/product invoice edits working while new invoice creation stays active-only.

## Parity Decisions

- Invoice codes remain `HDYYYYMMDD-###`.
- Document counters are still used, but code generation now seeds from existing invoice rows for the target business date before incrementing. This avoids collisions after imports or manual data repair.
- Backend invoice search now matches desktop context search by invoice code and customer snapshot name.
- Date-range filtering is supported by backend query params and used by the frontend list.
- Existing invoice edits may keep already-linked inactive customer/product records.
- New invoice creation still rejects inactive customers and inactive products.
- Rounding behavior is intentionally retained: calculated line totals are quantized to two currency decimals with `ROUND_HALF_UP`; supplied manual `line_total` is preserved and can derive unit price.
- The frontend still sends full update payloads from the edit form. Backend PATCH now additionally preserves `paid_amount` if that field is omitted by API callers.

## Backend Changes

- Added existing-code scan to document code generation before incrementing counters.
- Expanded `SalesRepository.list_invoices(...)` search from invoice-code-only to invoice code or customer snapshot name.
- Added optional backend date range filters for invoice list.
- Changed `InvoiceUpdateRequest.paid_amount` to optional and route handling to preserve the existing paid amount when omitted.
- Kept sales service rollback/reapply behavior unchanged.

## Frontend Changes

- Invoice list query now sends `search`, `date_from`, and `date_to` to the backend.
- Removed local code/customer/status filtering from the invoice list; status search is intentionally not supported in this parity batch.
- Updated invoice search placeholder to `Ma hoa don hoac khach hang`.
- Invoice edit form now merges the current historical inactive customer/product from the invoice payload into otherwise active-only selectors.

## Tests

- Backend tests cover:
  - Same-day sequential `HDYYYYMMDD-###` codes.
  - Different invoice dates using separate counters.
  - Existing imported invoice code collision avoidance.
  - Backend search by invoice code and customer snapshot name.
  - New inactive customer/product rejection.
  - Existing inactive customer/product invoice edit.
  - Default calculated line-total rounding.
  - Manual line-total override and derived unit-price behavior.
  - PATCH preserving `paid_amount` when omitted.
  - Existing update/delete rollback and reapply behavior.
- Frontend tests cover:
  - Invoice search/date filters being sent to backend query params.
  - Inactive historical invoice detail rendering.
  - Inactive historical invoice edit selector preservation.
  - Existing validation and backend error display behavior.

## Known Divergences Retained

- Status search is no longer implied in the invoice list placeholder and is not implemented in backend search.
- The edit UI continues to submit a full invoice payload. Partial update support is backend-only for omitted `paid_amount`.
- Rounding remains currency-cent `ROUND_HALF_UP` in web for calculated line totals. This is documented as the chosen web behavior even though the desktop audit found no explicit service-layer quantization.
- Walk-in label remains `Khach le` in web.
- Validation text remains mixed English/ASCII; message localization is deferred.

## Files Changed

- `backend/app/application/document_service.py`
- `backend/app/infrastructure/db/repositories/documents.py`
- `backend/app/infrastructure/db/repositories/sales.py`
- `backend/app/application/sales_service.py`
- `backend/app/api/routes/sales.py`
- `backend/app/schemas/sales.py`
- `backend/tests/service/test_sales_service.py`
- `backend/tests/api/test_sales_api.py`
- `frontend/src/api/sales.ts`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/sales/InvoiceListPage.tsx`
- `frontend/src/features/sales/InvoiceForm.tsx`
- `frontend/src/app/App.test.tsx`

## Next Batch Recommendation

Batch 4 should focus on returns parity P0/P1: return code-generation edge tests, backend return search by code/customer/source invoice, inactive historical return edit coverage, and the return ledger display-order decision.
