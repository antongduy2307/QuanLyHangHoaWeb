# Operational CRUD Batch 2: Customers

## Summary

Completed customer operational CRUD on the frontend:

- Customer detail actions for owner/admin.
- Customer edit page at `/customers/:customerId/edit`.
- Customer delete/deactivate flow from detail.
- Customer list inactive toggle.
- Debt payment success messages and refetch coverage.

No backend code changes were required. Existing customer APIs already supported profile patching, delete/deactivate, inactive list filtering, and debt payment mutations.

## Files Changed

- `frontend/src/api/customers.ts`
- `frontend/src/api/types.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/features/customers/CustomerDetailPage.tsx`
- `frontend/src/features/customers/CustomerEditPage.tsx`
- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/features/customers/customerQueries.ts`
- `frontend/src/features/customers/customerSchemas.ts`
- `frontend/src/app/App.test.tsx`
- `docs/OPERATIONAL_CRUD_BATCH2_CUSTOMERS_IMPLEMENTATION.md`

## UI Behavior

Customer list:

- Search remains available.
- Positive-debt filter remains available.
- `Hien khach ngung dung` sends `include_inactive=true`.
- Customer names continue linking to detail pages.
- Delete/deactivate redirects can display a result message.

Customer detail:

- Read-only users can view profile, debt payments, and ledger.
- Owner/admin users see `Sua khach hang` and `Xoa khach hang`.
- Delete requires confirmation, calls the backend, then redirects to `/customers`.
- Detail now displays note text in addition to address and balance summary.

Customer edit:

- Owner/admin only.
- Editable fields: `customer_name`, `phone`, `address`, `note`.
- `current_balance` and `total_sales` are displayed read-only.
- Successful save redirects back to customer detail.
- Backend errors are displayed inline.

Debt payment workflow:

- Existing create/edit/delete forms remain in detail.
- Delete still requires confirmation.
- Mutations invalidate customer list, customer detail, ledger, and debt payment queries.
- Success states now show after create/update/delete.
- Backend errors remain visible at form or detail level.

## API Endpoints Used

- `GET /api/customers?search=...&only_positive_debt=true&include_inactive=true`
- `GET /api/customers/{customer_id}`
- `PATCH /api/customers/{customer_id}`
- `DELETE /api/customers/{customer_id}`
- `GET /api/customers/{customer_id}/ledger`
- `GET /api/customers/{customer_id}/debt-payments`
- `POST /api/customers/{customer_id}/debt-payments`
- `PATCH /api/customers/{customer_id}/debt-payments/{payment_id}`
- `DELETE /api/customers/{customer_id}/debt-payments/{payment_id}`

## Limitations

- Customer balance is not edited directly from the profile edit page. Balance changes remain ledger-driven through opening balance, invoices, returns, and debt payments.
- Reactivation is not exposed because there is no direct customer reactivation endpoint in the current backend API.

## Tests Run

Targeted during implementation:

```powershell
npm.cmd test -- src\app\App.test.tsx
npm.cmd run lint
```

Results:

```text
npm.cmd test -- src\app\App.test.tsx: 120 passed
npm.cmd run lint: passed
```

Full requested frontend checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

```text
npm.cmd test: 120 passed
npm.cmd run build: passed
npm.cmd run lint: passed
```

## Next Steps

- Add a direct backend reactivation endpoint if customer reactivation becomes an operational requirement.
- Continue operational completion with sales/returns polish or a later reporting batch.
