# Invoice POS Edit First-Load Fix

Date: 2026-05-25

## Root Cause

The first-load invoice edit hydration path in `InvoiceCreatePage` used a manual route-state effect plus `fetchQuery` and internal pending request refs.

That path could leave the edit flow stuck on the loading message before the draft tab was inserted on first navigation.

## Why Retry Worked

The retry action explicitly reset the internal hydration bookkeeping and triggered the invoice fetch again.

That second attempt rebuilt the edit draft and activated the edit tab correctly, which is why `Thử lại` appeared to fix the problem.

## Fix

- captured the pending edit route state in component state as soon as the page is entered
- enabled `useInvoice(invoiceId)` for the pending edit invoice on first render
- hydrated the edit draft from the invoice query success path
- activated an existing matching edit draft instead of duplicating it
- cleared the pending edit request only after success or after a matching draft was activated
- kept retry as a fallback for real fetch errors
- preserved normal create-mode behavior when no edit route state is present

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/sales/InvoicePosEditDraft.test.tsx`

## Tests Run / Results

Executed:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- frontend test suite passed
- production build passed
- lint passed

## Remaining Limitations

- the file still contains older legacy edit-hydration scaffolding that is effectively bypassed by the new path
- the fix is frontend-only and does not change invoice backend behavior
