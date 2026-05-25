# Dashboard Shell Nesting Fix

Date: 2026-05-25

## Summary

The dashboard route was still mounted inside the legacy `AdminLayout` while also rendering the redesigned brown/cream module shell.

That created nested UI:

- legacy sidebar and top header outside
- redesigned top navigation and dashboard shell inside

The fix moves `/` onto its own authenticated route so the dashboard renders only the redesigned shell.

## Files Changed

- `frontend/src/app/router.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`

## Tests Run / Results

Executed:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- frontend test suite passed
- production build passed
- lint passed

## Notes

- No backend changes
- No dashboard metric logic changes
- Existing redesigned dashboard sections remain unchanged:
  - overview cards
  - sales timeseries
  - top products
  - recent activity
