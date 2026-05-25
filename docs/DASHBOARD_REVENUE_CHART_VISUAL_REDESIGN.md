# Dashboard Revenue Chart Visual Redesign

Date: 2026-05-25

## Summary

Redesigned the dashboard `Doanh thu theo thời gian` section from a horizontal list-style bar view to a vertical column chart.

The redesign keeps the existing API and dashboard data flow unchanged.

## What Changed

- replaced row-style bars with vertical revenue columns
- added visible Y-axis scale labels
- added horizontal guide lines
- kept horizontal scrolling for longer month views

## Scrolling Behavior

- the month chart shows about 10 day buckets in view
- the remaining buckets are reachable with horizontal scrolling

## Files Changed

- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/styles.css`

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

- no backend changes
- no changes to `GET /api/reports/sales-timeseries`
- overview cards, top products, and recent activity behavior remain unchanged
