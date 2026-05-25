# History Batch C Detail Drawer

Date: 2026-05-23

## Summary

Added a read-only detail drawer to `/history` so users can inspect a selected history row without leaving the page.

This batch keeps the existing list, filters, auth behavior, and backend history API unchanged.

## Drawer Behavior

- clicking a history row opens a right-side drawer
- the page does not navigate on row click
- the selected row is highlighted
- the drawer can be closed with `Đóng`
- table open links still work and do not trigger row-selection navigation

## Event-Specific Display

### Sales Invoice

- invoice code
- customer
- total amount
- paid amount when detail data is available
- status
- payment method
- open detail link

### Return Invoice

- return code
- customer
- total amount
- handling mode/status
- source invoice id when available
- open detail link

### Debt Payment

- customer
- amount
- payment datetime
- note
- open customer detail link

### Balance Adjustment

- customer
- amount delta
- note
- open customer detail link

### Stock Movement

- product
- movement type
- quantity delta
- unit
- balance after when product movement detail is available
- source type/source id
- open detail link when the target is resolvable

### Order

- order code
- customer
- status
- required delivery datetime when order detail data is available
- note
- explicit no-link state because there is no dedicated order detail route

## Open Target Mapping

Used safe frontend route mapping:

- `invoice` -> `/sales/invoices/:id`
- `return` -> `/returns/:id`
- `customer` -> `/customers/:id`
- `product` -> `/inventory/products/:id`
- `order` -> no frontend detail route, so no link is rendered

Rendered label:

- `Mở chi tiết`

## Files Changed

- `frontend/src/features/history/HistoryDetailDrawer.tsx`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/history/historyPresentation.ts`
- `frontend/src/styles.css`

## Tests Run / Results

Executed:

- `npm.cmd test -- --run src/features/history/HistoryListPage.test.tsx`
- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- history-focused drawer tests passed
- build passed
- lint passed
- full frontend test run still has unrelated existing failures outside the history drawer scope

## Known Limitations

- order rows do not open a dedicated detail route because the frontend does not have one yet
- stock movement drawer only shows `balance_after` when it can be resolved from product movement detail
- the broader frontend suite still contains pre-existing failures unrelated to this batch
