# Frontend Batch 7: Sales Invoice Create UI

## Summary

Implemented the first sales invoice mutation screen in the React admin frontend. Owner/admin users can now open `/sales/invoices/new`, select products and customers, validate invoice inputs, submit to the existing sales API, and land on the created invoice detail screen.

No backend changes were made. The desktop reference repository was not modified.

## Files Changed

- `frontend/src/api/types.ts`
  - Added invoice create request types.
- `frontend/src/api/sales.ts`
  - Added `POST /api/sales/invoices`.
- `frontend/src/features/sales/invoiceQueries.ts`
  - Added create invoice mutation and invalidation for invoices, products, and customers.
- `frontend/src/features/sales/invoiceSchemas.ts`
  - Added invoice form state, validation, decimal-safe estimate helpers, and API payload conversion.
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
  - Added invoice create page.
- `frontend/src/features/sales/InvoiceListPage.tsx`
  - Enabled the create action for owner/admin users.
- `frontend/src/app/router.tsx`
  - Added `/sales/invoices/new` protected by owner/admin role guard.
- `frontend/src/styles.css`
  - Added line item panel styling and select styling.
- `frontend/src/app/App.test.tsx`
  - Added invoice create UI tests and sales API mocks.
- `docs/FRONTEND_BATCH7_SALES_INVOICE_CREATE_IMPLEMENTATION.md`
  - Added this report.

## UI Behavior

- Owner/admin users see `Tao hoa don` on the invoice list.
- Read-only users can still view invoices but cannot access the create route.
- Employee and attendance-manager users remain blocked by the admin shell.
- The create form loads active products from inventory and active customers from customer APIs.
- Users can create either:
  - walk-in invoices with a snapshot name; or
  - customer invoices linked to a selected customer.
- Invoice items support:
  - product selection;
  - unit choices derived from enabled product prices;
  - quantity;
  - unit price seeded from the selected product/unit price;
  - add/remove item rows.
- On success, the frontend invalidates affected query groups and redirects to the created invoice detail page.

## API Endpoints Used

- `GET /api/inventory/products`
- `GET /api/customers`
- `POST /api/sales/invoices`
- `GET /api/sales/invoices/{invoice_id}` after redirect

All requests use the existing authenticated API client.

## Validation Behavior

Client-side validation covers:

- invoice datetime is required;
- at least one invoice item is required;
- product is required per line;
- unit type is required and must match product unit mode;
- quantity must be positive;
- unit price must be non-negative;
- paid amount must be non-negative;
- walk-in invoices must be fully paid or overpaid based on the displayed estimate;
- customer invoices can be unpaid.

Decimal fields are kept as strings in payloads. The displayed estimate uses scaled integer arithmetic and remains advisory; the backend remains authoritative for final totals and side effects.

## Tests Added

Added coverage for:

- read-only access denial for create route;
- owner/admin create access;
- required item validation;
- BAO/KG and BICH unit options based on selected products;
- walk-in unpaid validation failure;
- customer unpaid invoice submit;
- successful create and redirect;
- backend validation error display;
- invoice list create action visibility by role.

## Commands Run

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 69 tests.
- `npm.cmd run build`: passed, TypeScript build and Vite production build completed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Caveats and Next Steps

- Invoice update/delete UI remains out of scope.
- Return mutation UI remains out of scope.
- The create form is intentionally simple and does not yet include product search or customer search inside selectors.
- Future batches should add invoice edit/delete and return create workflows using the same service-backed API behavior.
