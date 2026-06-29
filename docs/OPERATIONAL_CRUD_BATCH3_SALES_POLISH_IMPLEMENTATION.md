# Operational CRUD Batch 3: Sales Invoice Polish

## Summary

Improved the sales invoice workflow for daily use:

- Invoice list client-side search and date filtering.
- Row-level view/edit actions.
- Better product and customer selector labels.
- Quick-add line action.
- Per-line total estimates and clearer form total summary.
- Create/update/delete success messages.
- Detail summary polish for payment method and remaining amount.

No backend code changes were required. Search and date range filtering are frontend-side over currently loaded rows so the UI can match invoice code, customer name, and status consistently.

## Files Changed

- `frontend/src/app/App.test.tsx`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoiceEditPage.tsx`
- `frontend/src/features/sales/InvoiceForm.tsx`
- `frontend/src/features/sales/InvoiceListPage.tsx`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/sales/invoiceSchemas.ts`
- `docs/OPERATIONAL_CRUD_BATCH3_SALES_POLISH_IMPLEMENTATION.md`

## UI Behavior

Invoice list:

- Search filters currently loaded rows by invoice code, customer snapshot name, backend status, and localized status label.
- Date range filters currently loaded rows in the browser.
- Empty state now says no invoice matches the current filters.
- Each row has `Xem`; owner/admin also see `Sua`.

Invoice form:

- Product options show product code, name, and enabled unit prices.
- Customer options show name plus phone when available.
- `Them nhanh hang dau tien` adds a line prefilled with the first product and default enabled unit/price.
- Each line shows a line estimate.
- Overall summary shows estimated total and paid amount.
- Validation now reports independent line-level errors together instead of stopping after the first missing product.

Invoice detail:

- Displays payment method and remaining amount.
- Create/update/delete routes surface success messages after navigation.
- Edit/delete buttons remain owner/admin gated.

## API Endpoints Used

- `GET /api/sales/invoices`
- `GET /api/sales/invoices/{invoice_id}`
- `POST /api/sales/invoices`
- `PATCH /api/sales/invoices/{invoice_id}`
- `DELETE /api/sales/invoices/{invoice_id}`
- Existing customer and product list APIs for form selectors.

## Limitations

- Search and date range filtering are frontend-side only for the loaded invoice rows.
- Server-side invoice filters may be needed later for large datasets.
- No reporting, attendance, production auth, or desktop reference changes were made.

## Tests Run

Targeted during implementation:

```powershell
npm.cmd test -- src\app\App.test.tsx
```

Result:

```text
125 passed
```

Full requested frontend checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

```text
npm.cmd test: 126 passed
npm.cmd run build: passed
npm.cmd run lint: passed
```

## Next Steps

- Add backend date range and customer-name invoice filters if server-side filtering becomes necessary for large datasets.
- Continue operational polish for returns or reporting in a separate scoped batch.
