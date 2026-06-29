# Frontend Batch 5: Customer Debt Payment UI

## Summary

Implemented the customer debt payment vertical slice in the React admin frontend. The customer detail page now loads standalone debt payments, displays them beside the existing profile and ledger view, and exposes create/edit/delete workflows for `owner` and `admin` users only.

No backend changes were made. The desktop reference repository was not modified.

## Files Changed

- `frontend/src/api/types.ts`
  - Added debt payment payload/result types.
- `frontend/src/api/customers.ts`
  - Added debt payment create, update, and delete API calls.
- `frontend/src/features/customers/customerQueries.ts`
  - Added debt payment list and mutation hooks.
  - Added invalidation for customer list/detail/ledger/debt payment queries after mutations.
- `frontend/src/features/customers/CustomerDetailPage.tsx`
  - Added debt payment section.
  - Added role-gated create/edit/delete controls.
  - Integrated mutation error handling and refetch behavior.
- `frontend/src/features/customers/DebtPaymentForm.tsx`
  - Added reusable create/edit debt payment form.
- `frontend/src/styles.css`
  - Added compact form, detail section, row action, and inline edit panel styles.
- `frontend/src/app/App.test.tsx`
  - Added customer debt payment API mocks and UI tests.
- `docs/FRONTEND_BATCH5_CUSTOMER_DEBT_PAYMENTS_IMPLEMENTATION.md`
  - Added this implementation report.

## UI Behavior

The customer detail page now includes a `Thanh toan cong no` section:

- Displays debt payment id, amount, payment time, note, and deleted status.
- Shows an empty state when no debt payments exist.
- Allows `owner` and `admin` users to create, edit, and delete debt payments.
- Allows `read_only` users to view debt payments without mutation controls.
- Keeps employee and attendance manager users blocked by the existing admin shell role guard.
- Uses a simple inline form/panel rather than adding a UI framework.
- Uses Vietnamese labels consistent with the existing frontend.

## API Endpoints Used

- `GET /api/customers/{customer_id}/debt-payments`
- `POST /api/customers/{customer_id}/debt-payments`
- `PATCH /api/customers/{customer_id}/debt-payments/{payment_id}`
- `DELETE /api/customers/{customer_id}/debt-payments/{payment_id}`

All requests use the existing authenticated fetch wrapper with bearer token injection, refresh-on-401 handling, and backend error parsing.

## Validation Behavior

- Amount is required and must be a positive decimal string.
- Zero, negative, blank, and malformed values are rejected in the form before submit.
- Payment datetime is optional and is sent as an ISO timestamp when provided.
- Note is optional and blank notes are normalized to `null`.
- Backend validation errors are displayed as form-level errors.
- Decimal values remain strings in the frontend; financial math is not performed in JavaScript.

## Tests Added

Added coverage for:

- Debt payment list rendering on the customer detail page.
- `read_only` users seeing the list without mutation controls.
- `owner`/`admin` users seeing create/edit/delete controls.
- Create success and refetch behavior.
- Create validation for non-positive amounts.
- Backend validation error display.
- Edit success.
- Delete confirmation and success.
- Delete error display.

## Commands Run

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 48 tests.
- `npm.cmd run build`: passed, TypeScript build and Vite production build completed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Caveats and Next Steps

- Customer edit/delete UI is still out of scope.
- Sales/returns UI is still out of scope.
- Debt payment mutation success feedback is intentionally minimal for this batch; query refetch updates the visible state.
- A future UI batch can add customer edit/delete, sales/returns screens, and richer notifications.
