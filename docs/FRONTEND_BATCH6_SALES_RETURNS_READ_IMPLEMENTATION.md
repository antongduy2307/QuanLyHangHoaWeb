# Frontend Batch 6: Sales/Returns Read Screens

## Summary

Implemented read-first sales invoice and return screens in the React admin frontend. The frontend now has typed API clients, TanStack Query hooks, list pages, detail pages, routes, loading/error/empty states, and read-only document presentation for sales and returns.

No backend changes were made. The desktop reference repository was not modified.

## Files Changed

- `frontend/src/api/types.ts`
  - Added invoice, invoice item, return invoice, and return invoice item response types.
- `frontend/src/api/sales.ts`
  - Added invoice list/detail API calls.
- `frontend/src/api/returns.ts`
  - Added return list/detail API calls.
- `frontend/src/domain/documents.ts`
  - Added quantity, unit, invoice status, and return handling mode display helpers.
- `frontend/src/features/sales/invoiceQueries.ts`
  - Added invoice list/detail query hooks.
- `frontend/src/features/sales/InvoiceListPage.tsx`
  - Replaced placeholder with a real invoice list.
- `frontend/src/features/sales/InvoiceDetailPage.tsx`
  - Added invoice detail read screen.
- `frontend/src/features/returns/returnQueries.ts`
  - Added return list/detail query hooks.
- `frontend/src/features/returns/ReturnListPage.tsx`
  - Replaced placeholder with a real return list.
- `frontend/src/features/returns/ReturnDetailPage.tsx`
  - Added return detail read screen.
- `frontend/src/app/router.tsx`
  - Added invoice and return detail routes.
- `frontend/src/app/App.test.tsx`
  - Added sales/returns read-screen API mocks and tests.

## UI Behavior

Sales:

- `/sales/invoices` loads invoice rows through `GET /api/sales/invoices`.
- Each row links to `/sales/invoices/:invoiceId`.
- The list displays invoice code, datetime, customer snapshot name, total amount, paid amount, and status.
- The create invoice button is present but disabled because mutation workflows are out of scope.
- `/sales/invoices/:invoiceId` loads document detail and renders header fields plus item rows.

Returns:

- `/returns` loads return rows through `GET /api/returns`.
- Each row links to `/returns/:returnId`.
- The list displays return code, datetime, customer snapshot name, total amount, handling mode, and source invoice id.
- The create return button is present but disabled because mutation workflows are out of scope.
- `/returns/:returnId` loads document detail and renders header fields plus item rows.

Both modules show loading, backend error, and empty states. They are protected by the existing admin shell, so `owner`, `admin`, and `read_only` can view while `employee` and `attendance_manager` remain blocked.

## API Endpoints Used

Sales:

- `GET /api/sales/invoices`
- `GET /api/sales/invoices/{invoice_id}`

Returns:

- `GET /api/returns`
- `GET /api/returns/{return_id}`

All requests use the existing authenticated API client with bearer token injection, refresh-on-401 handling, and backend error parsing.

## Tests Added

Added coverage for:

- Invoice list loading, success, empty, and error states.
- Invoice detail header and item rendering.
- Invoice detail error state.
- Return list loading, success, empty, and error states.
- Return detail header and item rendering.
- Return detail error state.
- `read_only` document viewing.
- Disabled/no mutation controls for this read-first batch.

## Commands Run

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 60 tests.
- `npm.cmd run build`: passed, TypeScript build and Vite production build completed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Caveats and Next Steps

- Invoice create/update/delete UI remains out of scope.
- Return create/update/delete UI remains out of scope.
- The read screens currently use the existing list endpoints without search/filter controls.
- Future batches should add sales/returns mutation workflows and richer document filtering once the read screens are stable.
