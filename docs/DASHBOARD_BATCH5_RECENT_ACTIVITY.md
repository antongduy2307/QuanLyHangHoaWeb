# Dashboard Batch 5: Recent Activity

Date: 2026-05-25

## Summary

Batch 5 adds a read-only `Hoạt động gần đây` panel to the dashboard overview.

## Data Source

The panel uses:

- `GET /api/history`

Current dashboard query:

- `page=1`
- `page_size=8`

The dashboard uses the latest unfiltered history feed and renders the newest returned rows.

## Event Types Shown

The panel can display the existing unified history event types:

- `SALES_INVOICE`
- `RETURN_INVOICE`
- `STOCK_MOVEMENT`
- `ORDER`
- `DEBT_PAYMENT`
- `BALANCE_ADJUSTMENT`

## Open Link Behavior

The panel reuses the existing history open-target mapping:

- `invoice` -> invoice detail route
- `return` -> return detail route
- `customer` -> customer detail route
- `product` -> product detail route
- `order` -> no link rendered, because there is no dedicated order detail route

Rendered link label:

- `Mở`

## Files Changed

- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/history/historyPresentation.ts`
- `frontend/src/styles.css`
- `frontend/src/tests/appTestHarness.ts`

## Tests Run / Results

Executed:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- frontend test suite passed
- production build passed
- lint passed

## Limitations

- The dashboard currently uses the latest unfiltered history page instead of requesting a multi-type subset.
- The activity panel is read-only and does not open a drawer inline.
- Order rows intentionally render without an open link until an order detail route exists in the frontend shell.
