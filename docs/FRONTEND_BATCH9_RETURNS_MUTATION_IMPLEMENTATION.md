# Frontend Batch 9: Returns Mutation UI

## Summary

Implemented return create, edit, and delete workflows in the React admin frontend. Owner/admin users can now create quick or invoice-linked returns, edit existing returns through a reusable return form, and delete returns from the detail page with confirmation. Read-only users can continue to view return list/detail screens but cannot access mutation routes or controls.

No backend changes were made. The desktop reference repository was not modified.

## Files Changed

- `frontend/src/api/types.ts`
  - Added return handling and return mutation payload types.
- `frontend/src/api/returns.ts`
  - Added `POST /api/returns`.
  - Added `PATCH /api/returns/{return_id}`.
  - Added `DELETE /api/returns/{return_id}`.
- `frontend/src/features/returns/returnQueries.ts`
  - Added create/update/delete return mutations and cache invalidation.
- `frontend/src/features/returns/returnSchemas.ts`
  - Added return form state, prefill conversion, validation, payload mapping, and Decimal-safe estimates.
- `frontend/src/features/returns/ReturnForm.tsx`
  - Added reusable return form for create and edit flows.
- `frontend/src/features/returns/ReturnCreatePage.tsx`
  - Added create screen for `/returns/new`.
- `frontend/src/features/returns/ReturnEditPage.tsx`
  - Added edit screen for `/returns/:returnId/edit`.
- `frontend/src/features/returns/ReturnListPage.tsx`
  - Added owner/admin create action.
- `frontend/src/features/returns/ReturnDetailPage.tsx`
  - Added owner/admin edit/delete controls and delete error handling.
- `frontend/src/app/router.tsx`
  - Added protected return create/edit routes.
- `frontend/src/app/App.test.tsx`
  - Added return mutation tests and expanded return API mocks.

## UI Behavior

- `/returns/new` is available only to `owner` and `admin`.
- `/returns/:returnId/edit` is available only to `owner` and `admin`.
- `read_only` users see access denied for mutation routes and no mutation controls on list/detail pages.
- Return form supports:
  - quick returns;
  - linked returns with source invoice and source invoice item selectors;
  - walk-in or customer handling for quick returns;
  - `REFUND_NOW` and `STORE_CREDIT` handling modes;
  - product, unit, quantity, and unit price rows;
  - add/remove return line items.
- Delete requires browser confirmation and redirects to `/returns` on success.
- Create/edit redirects to the return detail page on success.

## API Endpoints Used

Returns:

- `GET /api/returns`
- `GET /api/returns/{return_id}`
- `POST /api/returns`
- `PATCH /api/returns/{return_id}`
- `DELETE /api/returns/{return_id}`

Supporting selector data:

- `GET /api/inventory/products`
- `GET /api/customers`
- `GET /api/sales/invoices`

All requests use the existing authenticated API client with bearer token injection and refresh handling.

## Validation Behavior

Client-side validation covers:

- return datetime required;
- at least one return item;
- product required;
- unit type required and compatible with selected product;
- quantity must be positive;
- unit price must be non-negative;
- walk-in returns can only use `REFUND_NOW`;
- linked returns require a source invoice;
- linked return rows require a source invoice item;
- linked return quantity is capped by the source invoice item quantity when the frontend can infer it.

Decimal values remain strings for API payloads. The displayed total is advisory; the backend remains authoritative for totals, stock effects, and ledger effects.

## Tests Run

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 91 tests.
- `npm.cmd run build`: passed, TypeScript build and Vite production build completed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Caveats and Next Steps

- Return form selectors are simple dropdowns; searchable selectors can be added later.
- Frontend linked-return remaining quantity validation only checks against the source invoice item quantity currently loaded in the client. The backend remains the source of truth for prior returns and concurrency.
- Reporting UI and attendance portal remain out of scope.
