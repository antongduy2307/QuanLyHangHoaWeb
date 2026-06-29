# Operational CRUD Batch 4: Returns Polish Implementation

## Summary

Batch 4 improves the daily return workflow in the frontend without backend changes. The return list now has client-side search and date filters for the currently loaded rows, clearer empty states, and role-gated row actions. The return form now exposes richer source invoice, source item, product, and customer labels; shows per-line and document total estimates; keeps decimal values as strings; and surfaces handling-mode constraints more clearly. Return create, update, and delete flows now show simple inline success feedback after redirects.

## Files Changed

- `frontend/src/features/returns/ReturnListPage.tsx`
- `frontend/src/features/returns/ReturnForm.tsx`
- `frontend/src/features/returns/returnSchemas.ts`
- `frontend/src/features/returns/ReturnCreatePage.tsx`
- `frontend/src/features/returns/ReturnEditPage.tsx`
- `frontend/src/features/returns/ReturnDetailPage.tsx`
- `frontend/src/app/App.test.tsx`
- `docs/OPERATIONAL_CRUD_BATCH4_RETURNS_POLISH_IMPLEMENTATION.md`

## UI Improvements

- Return list adds filters for return code, customer name, handling mode, source invoice id, and optional from/to return dates.
- Return list distinguishes between no returns and no rows matching active filters.
- Return rows now expose `Xem` for all roles and `Sua` only for owner/admin.
- Source invoice options show invoice code, customer name, invoice date/time, and total amount.
- Linked return source item options show product code, product name, unit, quantity, and line total.
- Quick-return product options show product code, product name, unit mode, and enabled unit prices.
- Customer options show customer name plus phone when available.
- Return detail now includes a clearer document summary, source invoice reference, handling mode, return type, and item table.

## Filter/Search Behavior

Filtering is frontend-side only and applies to rows returned by `GET /api/returns`. No backend query contract was changed.

Search matches:

- `return_code`
- `customer_snapshot_name`
- raw `handling_mode`
- localized handling-mode label
- `source_invoice_id`

Date filters compare the return date portion of `return_datetime` against optional from/to dates.

## Validation/Feedback Behavior

- Per-line validation can now show missing product, missing unit, invalid quantity, and invalid price together instead of stopping at the first missing product.
- Linked returns still require a source invoice and source invoice line.
- Walk-in returns continue to reject `STORE_CREDIT`.
- Store credit text explains that a customer-backed return is required.
- Per-line subtotal and return total estimates are calculated with existing scaled integer helpers and string decimal inputs.
- Create/update/delete success messages are passed through route state and displayed inline after redirects.
- Backend validation and API/network errors continue to render inline through existing API error handling.

## Tests Run/Results

From `frontend/`:

- `npm.cmd test` - passed, 133 tests
- `npm.cmd run build` - passed
- `npm.cmd run lint` - passed

Backend was not changed, so backend tests were not run for this batch.

## Caveats/Next Steps

- Return list filtering remains client-side because the current frontend query uses the existing list endpoint without backend filter parameters.
- Detail source invoice display uses the stored source invoice id from the return document; it does not fetch and expand the full source invoice on the detail page.
- A future batch can add backend-level return search/date filtering if return volume grows beyond what client-side filtering can handle comfortably.
