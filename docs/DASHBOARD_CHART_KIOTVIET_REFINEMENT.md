# Dashboard Chart KiotViet Refinement

Date: 2026-05-25

## Summary

Refined the dashboard revenue chart to match the KiotViet-style reference more closely.

## Visual Behavior Changed

- removed `Hôm nay`, `Hôm qua`, and `7 ngày qua`
- kept only:
  - `Tháng này`
  - `Tháng trước`
- default period is now `Tháng này`
- X-axis labels now show day numbers only, for example `01`, `02`, `03`
- removed boxed pillar containers behind each bar
- removed value labels above bars
- tightened bar spacing and increased visual density
- kept horizontal scrolling with about 10 visible day buckets

## Files Changed

- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/styles.css`

## Verification

Run:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`
