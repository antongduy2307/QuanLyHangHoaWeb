# History Invoice Grouping Fix

## Root Cause

The unified `/api/history` endpoint already emitted one `SALES_INVOICE` row per invoice and one `RETURN_INVOICE` row per return, but in the default all-events view it also appended invoice-item and return-item `STOCK_MOVEMENT` rows.

That caused one business document to appear multiple times:

- once as the document row
- once per item as stock movement rows

So a multi-line invoice looked expanded in the main history table even before the user opened details.

## Backend Grouping Decision

Default all-events history now behaves like the old app:

- one invoice = one `SALES_INVOICE` row
- one return = one `RETURN_INVOICE` row
- standalone stock adjustments remain visible as `STOCK_MOVEMENT`

Invoice/return-derived stock movement rows are hidden from the default all-events history view.

## Explicit `STOCK_MOVEMENT` Behavior

Decision implemented:

- default all-events view hides invoice/return-derived stock movements
- explicit `event_type=STOCK_MOVEMENT` shows:
  - manual stock adjustments
  - invoice item stock effects
  - return item stock effects

This preserves audit access without cluttering the business-document view.

## Frontend Display Changes

### `/history`

The main history table now treats invoice and return rows as business documents:

- invoice rows show:
  - customer
  - invoice code
  - total amount
  - paid amount
  - item count
  - datetime
- return rows show:
  - customer
  - return code
  - total return amount
  - item count
  - datetime

The table no longer relies on product-line-style stock movement rows to represent invoices/returns in the default view.

### Detail drawer

The existing drawer was extended so invoice/return detail now shows:

- header information
- note
- item table
  - product name
  - unit
  - quantity
  - unit price
  - line total

## Customer History Behavior

Customer inline sales/returns history continues to use one invoice/return per row.

This fix adds grouped-detail behavior there too:

- one invoice/return = one row
- clicking/opening a row shows the same detail drawer with item rows
- it no longer relies only on hard navigation to a separate page

## Files Changed

- `backend/app/application/history_service.py`
- `backend/app/schemas/history.py`
- `backend/tests/api/test_history_api.py`
- `frontend/src/api/types.ts`
- `frontend/src/features/history/historyPresentation.ts`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/HistoryDetailDrawer.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/customers/CustomerInlineDetailPanel.tsx`
- `frontend/src/features/customers/CustomerPages.test.tsx`
- `frontend/src/tests/appTestHarness.ts`

## Tests Run / Results

Backend:

- `pytest`
- `python -m compileall app tests`

Frontend:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- backend tests passed
- backend compileall passed
- frontend tests passed
- frontend build passed
- frontend lint passed

## Notes

- This batch does not touch invoice POS edit preload.
- No invoice/return business logic was changed.
- No report/export changes were made.
