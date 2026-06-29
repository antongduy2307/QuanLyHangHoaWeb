# Frontend Batch 4 Customers Implementation

## Summary

Implemented the customer frontend vertical slice.

This batch adds a typed customer API client, customer list, create-customer form, customer detail page, ledger read view, formatting helpers, loading/error/empty states, and role-gated create access. Backend code was not changed.

## Files Changed

Created:
- `frontend/src/api/customers.ts`
- `frontend/src/domain/dates.ts`
- `frontend/src/domain/money.ts`
- `frontend/src/features/customers/CustomerCreatePage.tsx`
- `frontend/src/features/customers/CustomerDetailPage.tsx`
- `frontend/src/features/customers/customerQueries.ts`
- `frontend/src/features/customers/customerSchemas.ts`
- `docs/FRONTEND_BATCH4_CUSTOMERS_IMPLEMENTATION.md`

Modified:
- `frontend/src/api/types.ts`
- `frontend/src/app/App.test.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/styles.css`

## UI Behavior

Customer list:

- loads customers through TanStack Query;
- supports backend `search`;
- supports backend `only_positive_debt`;
- displays loading, error, and empty states;
- displays customer name, phone, address, current balance, total sales, and active status;
- links each customer name to `/customers/:customerId`;
- shows `Tạo khách hàng` only for `owner` and `admin`;
- hides create action from `read_only`.

Customer create:

- route: `/customers/new`;
- protected by `RequireRole` for `owner` and `admin`;
- `read_only` sees access denied;
- validates required customer name;
- validates numeric opening balance and non-negative total sales strings;
- submits `POST /api/customers`;
- invalidates customer list queries on success;
- redirects to `/customers` on success;
- shows backend validation errors clearly.

Customer detail and ledger:

- route: `/customers/:customerId`;
- loads customer profile and ledger rows;
- displays profile summary, current balance, total sales, phone, and address;
- displays ledger table with transaction time, event type, ref type/id, amount delta, balance after, and note;
- read-only users can view detail and ledger;
- no mutation buttons are present.

## API Endpoints Used

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/{customer_id}`
- `GET /api/customers/{customer_id}/ledger`
- `GET /api/customers/{customer_id}/debt-payments`

The debt-payment list client helper is added for a later read/mutation workflow, but this batch does not render debt payment UI.

## Validation Behavior

Customer create validation is intentionally small and string-based:

- `customer_name` is required;
- `opening_balance` must be a valid decimal string and may be negative;
- `total_sales` must be a valid non-negative decimal string;
- optional phone, address, and note are normalized to `null` when blank.

Financial display uses formatting helpers and keeps API Decimal values as strings at the boundary. The frontend does not perform financial calculations.

## Tests Added or Updated

Frontend tests cover:

- customer list loading state;
- customer list success rendering;
- empty state;
- API error state;
- search and positive-debt filter requests;
- owner/admin create button visibility;
- read-only create button hiding;
- read-only denial on create route;
- required name validation;
- numeric opening-balance validation;
- successful create redirect;
- customer detail profile and ledger rendering;
- customer detail error state.

## Commands Run and Results

From `frontend/`:

```powershell
npm.cmd test
```

Result: `1 passed`, `40 tests passed`.

```powershell
npm.cmd run build
```

Result: passed.

```powershell
npm.cmd run lint
```

Result: passed.

Backend tests were not run because no backend code was changed.

## Caveats and Next Steps

- Customer edit/delete UI remains out of scope.
- Debt payment create/edit/delete UI remains out of scope.
- Sales/returns UI remains placeholder-only.
- Customer list is still a simple table with no pagination.
- Backend validation remains authoritative.
- Next recommended batch: customer debt payment UI or sales/returns read-first screens, depending operational priority.
