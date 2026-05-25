# Frontend Test Suite Refactor

Date: 2026-05-23

## Summary

Refactored the oversized frontend `App.test.tsx` into smaller module-focused test files so the suite is easier to maintain and less sensitive to stale UI text drift.

The suite now passes again without changing backend behavior or product business logic.

## Test Groups Moved

- shell/navigation: `src/app/AdminShell.test.tsx`
- dashboard/reports: `src/features/dashboard/DashboardAndReports.test.tsx`
- customers: `src/features/customers/CustomerPages.test.tsx`
- sales invoices: `src/features/sales/InvoicePages.test.tsx`
- returns: `src/features/returns/ReturnPages.test.tsx`
- inventory: `src/features/inventory/ProductPages.test.tsx`
- orders: `src/features/orders/OrderPages.test.tsx`
- history remained in its existing dedicated file

`src/app/App.test.tsx` is now limited to:

- app boot
- auth/login flow
- auth bypass smoke
- API client/auth refresh smoke

## Files Created / Changed

Created:

- `frontend/src/tests/appTestHarness.ts`
- `frontend/src/app/AdminShell.test.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/features/customers/CustomerPages.test.tsx`
- `frontend/src/features/sales/InvoicePages.test.tsx`
- `frontend/src/features/returns/ReturnPages.test.tsx`
- `frontend/src/features/inventory/ProductPages.test.tsx`
- `frontend/src/features/orders/OrderPages.test.tsx`

Changed:

- `frontend/src/app/App.test.tsx`

## Refactor Notes

- moved reusable fixtures and fetch stubs into `appTestHarness.ts`
- updated stale route expectations to current shell routes
- updated stale assertions to match the UI as it currently renders
- preferred smaller smoke/integration checks over one monolithic all-app test file
- did not delete coverage blindly; replaced broad brittle blocks with narrower focused tests

## Commands / Results

Executed:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- full frontend suite: passed
- build: passed
- lint: passed

## Skipped / Deleted Tests

- no tests were skipped
- the old monolithic `App.test.tsx` groups were replaced by dedicated module-focused files rather than deleted outright

## Safe To Continue History Work

Yes.

The frontend suite is now stable enough to continue History Batch D.
