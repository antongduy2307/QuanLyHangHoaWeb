# Frontend Batch 8: Sales Invoice Edit/Delete UI

## Summary

Implemented sales invoice edit and delete workflows in the React admin frontend. Owner/admin users can now edit an existing invoice through a reused invoice form and delete invoices from the detail page with confirmation. Read-only users can still view invoice data but do not see mutation controls.

No backend changes were made. The desktop reference repository was not modified.

## Files Changed

- `frontend/src/api/sales.ts`
  - Added `PATCH /api/sales/invoices/{invoice_id}`.
  - Added `DELETE /api/sales/invoices/{invoice_id}`.
- `frontend/src/features/sales/invoiceQueries.ts`
  - Added update/delete invoice mutations and cache invalidation.
- `frontend/src/features/sales/invoiceSchemas.ts`
  - Added invoice-to-form conversion and datetime normalization for edit prefill.
- `frontend/src/features/sales/InvoiceForm.tsx`
  - Added reusable invoice form used by create and edit flows.
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
  - Simplified to use the reusable form.
- `frontend/src/features/sales/InvoiceEditPage.tsx`
  - Added edit screen for `/sales/invoices/:invoiceId/edit`.
- `frontend/src/features/sales/InvoiceDetailPage.tsx`
  - Added owner/admin edit/delete controls and delete error handling.
- `frontend/src/app/router.tsx`
  - Added protected edit route.
- `frontend/src/app/App.test.tsx`
  - Added edit/delete tests and updated sales API mocks.
- `docs/FRONTEND_BATCH8_SALES_INVOICE_EDIT_DELETE_IMPLEMENTATION.md`
  - Added this report.

## UI Behavior

- `/sales/invoices/:invoiceId/edit` is available only to `owner` and `admin`.
- `read_only` users see access denied for the edit route.
- Employee and attendance-manager users remain blocked by the admin shell.
- The edit page loads invoice detail and pre-fills:
  - invoice datetime;
  - customer/walk-in mode;
  - customer snapshot name;
  - paid amount;
  - payment method;
  - note;
  - invoice item product, unit, quantity, and unit price.
- The invoice code is displayed during edit and is preserved by the backend.
- The detail page shows `Sua hoa don` and `Xoa hoa don` only to owner/admin.
- Delete requires browser confirmation.
- Delete success redirects to `/sales/invoices`.
- Delete failure is displayed on the detail page.

## API Endpoints Used

- `GET /api/sales/invoices/{invoice_id}`
- `PATCH /api/sales/invoices/{invoice_id}`
- `DELETE /api/sales/invoices/{invoice_id}`
- Supporting selector data:
  - `GET /api/inventory/products`
  - `GET /api/customers`

All requests use the existing authenticated API client.

## Validation Behavior

The edit form uses the same validation as create:

- invoice datetime is required;
- at least one invoice item is required;
- product is required per line;
- unit type is required and must match product unit mode;
- quantity must be positive;
- unit price must be non-negative;
- paid amount must be non-negative;
- walk-in invoices must be fully paid or overpaid based on the displayed estimate;
- customer invoices can be unpaid.

The displayed total estimate is advisory. Backend totals and stock/customer effects remain authoritative.

## Tests Added

Added coverage for:

- owner/admin access to edit page;
- read-only denial for edit page;
- edit prefill from existing invoice;
- edit validation for invalid quantity;
- successful PATCH and redirect;
- backend edit validation error display;
- detail-page edit/delete controls by role;
- delete confirmation cancel with no API call;
- delete confirmation confirm with `DELETE` and redirect;
- delete backend error display.

## Commands Run

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 78 tests.
- `npm.cmd run build`: passed, TypeScript build and Vite production build completed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Caveats and Next Steps

- Return create/update/delete UI remains out of scope.
- Invoice list row-level edit actions were not added; users can edit from invoice detail.
- The invoice form still uses simple selectors without search/typeahead.
- Future batches should implement return mutation UI and eventually add richer document filters.
