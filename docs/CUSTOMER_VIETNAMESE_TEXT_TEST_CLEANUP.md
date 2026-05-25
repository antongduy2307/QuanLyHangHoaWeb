# Customer Vietnamese Text Test Cleanup

Date: 2026-05-23

## Summary

The attempted cleanup of `frontend/src/app/App.test.tsx` was not completed safely in this pass.

What was confirmed:

- the failed task is isolated to frontend text and tests
- the main unstable area is `frontend/src/app/App.test.tsx`
- customer source files still contain mojibake in several places and should be fixed before or alongside final customer test reconciliation

## Current State

- `npm.cmd test -- --run`
  - failing because `frontend/src/app/App.test.tsx` is not yet safely reconciled
- `npm.cmd run build`
  - passed during intermediate checkpoints before the last test-file drift
- `npm.cmd run lint`
  - passed during intermediate checkpoints before the last test-file drift

## Files Touched In This Attempt

- `frontend/src/app/App.test.tsx`
- customer frontend files were inspected for encoding drift

## Main Problems Found

1. `frontend/src/app/App.test.tsx`
   - mixed assertions between:
     - old ASCII labels
     - intended Vietnamese diacritics
     - mojibake literals from earlier failed writes
   - several customer debt-payment test blocks became structurally corrupted during previous quota-limited edits

2. Customer source files
   - several customer UI files still contain mojibake-like sequences in visible labels
   - examples include:
     - `CustomerListPage.tsx`
     - `CustomerInlineDetailPanel.tsx`
     - `CustomerFormDialog.tsx`

## Recommended Next Safe Recovery

1. Restore `frontend/src/app/App.test.tsx` from a known-good baseline.
2. Fix customer source labels first in UTF-8:
   - customer list
   - inline detail
   - modal dialog
   - debt form
3. Reapply only customer-route assertion updates in `App.test.tsx`.
4. Avoid broad search/replace across unrelated modules.

## Notes

- No backend change is required for this task.
- No API contract change is required for this task.
- Further automatic edits to `App.test.tsx` should be done from a clean restored copy.
