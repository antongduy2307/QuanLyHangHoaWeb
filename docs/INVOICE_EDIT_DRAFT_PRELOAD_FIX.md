# Invoice Edit Draft Preload Fix

## Summary

Fixed the Sales POS edit-draft preload bug where clicking `Sửa hóa đơn` from invoice detail could leave the default blank sale tab (`Bán hàng 1`) active instead of opening the fetched invoice as the active edit tab.

After the fix:

- detail-origin edit opens an edit tab labeled `Sửa {invoice_code}`
- the edit tab preloads:
  - customer
  - invoice datetime
  - paid amount
  - note
  - all invoice rows
- submit PATCHes the original invoice
- cancel returns to invoice detail

## Root Cause

The POS route-state preload flow was trying to determine the new active draft id through a `setDrafts(...)` state-updater path and then focus that draft immediately.

That had two practical problems:

1. It depended on updater timing to decide which draft to focus.
2. It did not reliably replace the initial pristine blank sale draft.

As a result, the fetched edit draft could be appended while the blank `Bán hàng 1` draft remained the effective visible tab.

## Fix

The edit-draft hydration path in `InvoiceCreatePage.tsx` was changed to:

- inspect the current draft list deterministically via a ref
- reuse/focus an existing edit draft for the same invoice when present
- replace the initial pristine blank create-sale draft when the edit flow is the first thing opened
- append only when there is already meaningful draft state that should be preserved

## Behavior After Fix

### Detail navigation

Clicking `Sửa hóa đơn` from invoice detail now:

- navigates to `/sales/invoices/new`
- passes `editInvoiceDraft` route state
- opens the fetched invoice as the active edit tab
- does not leave the blank sale tab as the active editing surface

### Legacy edit route

`/sales/invoices/:invoiceId/edit` still redirects into the same POS edit-draft flow, and now benefits from the same preload fix.

### Historical inactive references

Historical inactive customer/product display remains preserved through the shared merge helpers introduced in the POS edit-draft architecture.

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/InvoicePosEditDraft.test.tsx`

## Tests

Verified:

- clicking `Sửa hóa đơn` opens POS edit tab, not the blank sale tab
- edit tab preloads invoice rows
- customer / datetime / paid / note preload
- update calls PATCH, not POST
- cancel returns to invoice detail

## Commands

Run from `frontend/`:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`
