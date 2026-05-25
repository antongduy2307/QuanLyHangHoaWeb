# Frontend Test Suite Stabilization

Date: 2026-05-23

## Summary

This pass focused on stabilizing the full frontend test suite before continuing History work.

History-specific tests remain green, and frontend build/lint still pass.

The broad frontend suite does **not** fully pass yet. Remaining failures are concentrated in the large legacy `src/app/App.test.tsx` file rather than in the History feature work.

## Failing Tests Found

Primary failing surface:

- `frontend/src/app/App.test.tsx`

Observed failure categories:

1. stale visible-text assertions
2. stale route/shell expectations
3. async/query timing expectations tied to old page structure
4. corrupted/stale test literals around older Vietnamese text assumptions

## Root Cause Categories

### Stale visible-text assertions

Many expectations still use old plain-ASCII labels while the current UI renders Vietnamese labels with accents or updated wording.

Examples:

- `Hang hoa` vs `Hàng hóa`
- `Khach hang` vs `Khách hàng`
- `Ban hang` vs `Bán hàng`
- loading/empty-state sentences that no longer match exactly

### Route / shell expectation changed

Some tests still assume older navigation or page-shell behavior.

Examples:

- sales nav expectation still points to `/sales/invoices` in places where the current shell points to `/sales/invoices/new`
- older “placeholder page” assumptions no longer match real feature pages

### Async / query timing issue

Several tests are coupled to older loading-state timing and now hit real page composition paths with different query waterfalls.

### Corrupted / stale test block

The monolithic `App.test.tsx` file contains a mix of older assumptions and partially updated text, which makes broad suite stabilization higher-risk than the scoped History tests.

## Files Changed

- `frontend/src/app/App.test.tsx`
- `docs/FRONTEND_TEST_SUITE_STABILIZATION.md`

## Commands / Results

Executed:

- `npm.cmd test -- --run`
- `npm.cmd test -- --run src/app/App.test.tsx`
- `npm.cmd test -- --run src/features/history/HistoryListPage.test.tsx`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- history-focused tests: passed
- build: passed
- lint: passed
- full frontend suite: still failing

Latest full-suite result:

- `76 failed | 84 passed`

## Skipped / Deleted Tests

- none

## Safe To Continue History Batch D?

Not yet.

The full frontend suite is still unstable, so continuing History refinements before finishing `App.test.tsx` stabilization would make regression detection weaker.
