# Invoice History Nav And Edit Workflow Fix

## Old Desktop Workflow Findings

Reference files inspected in `QuanLyHangHoa`:

- `modules/sales/ui/transaction_history_view.py`
- `modules/customer/ui/customer_list_view.py`
- `modules/sales/ui/invoice_detail_popup.py`
- `modules/sales/ui/page.py`
- `modules/sales/ui/sales_page.py`
- `shell/app_window.py`
- related history/customer/sales tests

Observed desktop behavior:

- invoice detail can be opened from transaction history, customer history, and invoice list
- history/customer contexts do not lose their place when invoice detail opens; detail is layered over the current workflow
- edit from history/customer detail jumps into the sales workspace, not into a separate standalone invoice form
- sales workspace preloads:
  - original customer
  - datetime
  - paid amount
  - note
  - invoice rows
- edit submission updates the original invoice and returns control to the originating context/workspace

## Root Cause Of `Quay lại` Bug

The web invoice detail page was not origin-aware.

It always treated itself as sales-list-owned and used a sales-list fallback:

- `Quay lại` pointed back to `/sales/invoices`
- `Sửa hóa đơn` only preserved invoice-id context, not the invoice detail page’s own upstream origin

So when invoice detail was opened from `/history`, the history context was lost.

## Root Cause Of POS Loading Hang

The POS edit hydration path depended on a fragile route-state lifecycle:

- edit draft request state was being consumed and then cleared via same-path navigation
- edit hydration depended on draft-list rerenders plus request refs to complete
- when a draft was not yet active, the page showed a generic “loading invoice for edit” screen with no real recovery path

This made the edit preload flow brittle enough to get stuck on the loading state instead of reliably activating the fetched edit draft.

## Fixes Implemented

### Invoice detail return context

`InvoiceDetailPage` now supports:

- `returnTo`
- `returnLabel`
- `returnState`

Behavior:

- from History: `Quay lại` returns to `/history` with the preserved history filter/page context
- from customer inline history: `Quay lại` returns to `/customers` with the customer focus/history-tab context
- otherwise: fallback remains the sales invoice list

### History -> invoice detail

`HistoryListPage` now passes invoice-detail navigation state:

- `returnTo: "/history"`
- `returnLabel: "Quay lại lịch sử"`
- `returnState.historyContext`

Preserved history context:

- `dateFrom`
- `dateTo`
- `eventType`
- `search`
- `customerId`
- `productId`
- `page`
- `pageSize`

### Customer inline history -> invoice detail

`CustomerInlineDetailPanel` now passes invoice-detail navigation state through the drawer:

- `returnTo: "/customers"`
- `returnLabel: "Quay lại khách hàng"`
- `returnState.focusCustomerId`
- `returnState.openInlineTab = "history"`

`CustomerListPage` reads that state and re-expands the customer row with the history tab active.

### POS edit workflow robustness

`InvoiceCreatePage` edit hydration was hardened:

- edit requests are keyed and handled once per route-state payload
- existing edit drafts for the same invoice are reused/focused
- explicit hydration error state is tracked separately from normal form feedback
- loading screen is shown only while the edit draft is not yet available
- fetch failures now show:
  - explicit error
  - retry button
  - back link

### Detail -> edit -> detail -> origin chain

When `Sửa hóa đơn` is clicked from invoice detail, the edit draft now receives:

- invoice id
- return-to-detail route
- detail page’s own upstream origin state

After successful update:

- POS returns to invoice detail
- invoice detail still remembers whether it came from History or customer history
- `Quay lại` still returns to that original source

## Files Changed

- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoiceEditPage.tsx`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/HistoryDetailDrawer.tsx`
- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/features/customers/CustomerInlineDetailPanel.tsx`
- `frontend/src/features/sales/InvoicePages.test.tsx`
- `frontend/src/features/sales/InvoicePosEditDraft.test.tsx`
- `frontend/src/features/history/HistoryListPage.test.tsx`
- `frontend/src/features/customers/CustomerPages.test.tsx`

## Tests Run / Results

Frontend commands run:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- tests: passed
- build: passed
- lint: passed

## Remaining Limitations

- `InvoiceCreatePage.tsx` still contains existing text-encoding debt in some UI copy; workflow behavior was fixed in this batch, not broad text normalization.
- customer return context currently restores to the customer list with the focused customer/history tab, not to a separate customer detail route.
- no unrelated History redesign or invoice list redesign was done in this batch.
