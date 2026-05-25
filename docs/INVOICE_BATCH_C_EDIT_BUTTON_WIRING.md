# Invoice Batch C: Edit Button Wiring

## Summary

Batch C wires invoice detail editing into the POS edit-draft flow introduced in Batch B.

Changes:

- `Sửa hóa đơn` on `/sales/invoices/:invoiceId` now opens `/sales/invoices/new` with `editInvoiceDraft` route state.
- `/sales/invoices/:invoiceId/edit` is now a compatibility redirect into the same POS edit-draft route-state flow.
- successful edit still returns to the invoice detail page
- cancel from detail-origin edit returns to the invoice detail page
- edit continues to use PATCH only, never POST

No backend logic was changed.

## Wiring Behavior

### Detail page action

`/sales/invoices/:invoiceId`

`Sửa hóa đơn` now navigates to:

`/sales/invoices/new`

with route state:

```ts
{
  editInvoiceDraft: {
    invoiceId,
    returnTo: `/sales/invoices/${invoiceId}`,
    returnLabel: "Quay lại hóa đơn",
  },
}
```

### Compatibility route

`/sales/invoices/:invoiceId/edit`

now redirects to the same POS route-state flow using `Navigate`.

This preserves old links and bookmarks while moving the actual editing experience into the sales POS workspace.

## User Flow

From invoice detail:

1. user clicks `Sửa hóa đơn`
2. app opens POS at `/sales/invoices/new`
3. POS creates/focuses `Sửa {invoice_code}` draft
4. invoice fields preload
5. user clicks `Cập nhật hóa đơn`
6. app PATCHes invoice
7. app returns to `/sales/invoices/{invoiceId}` with success state

Cancel flow:

1. user clicks `Hủy sửa`
2. app navigates back to `/sales/invoices/{invoiceId}`
3. no PATCH is sent

## Files Changed

- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoiceEditPage.tsx`
- `frontend/src/features/sales/InvoicePages.test.tsx`

## Tests Covered

- detail edit button opens POS edit draft
- old edit route redirects into POS edit draft
- POS edit draft preloads from detail-style route state
- update success returns to invoice detail
- cancel returns to invoice detail
- edit does not POST

## Commands / Results

Commands run from `frontend/`:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- tests: passed
- build: passed
- lint: passed

Build note:

- the existing Vite chunk-size warning over `500 kB` remains, but build succeeds

## Known Limitations

- invoice list still uses the older layout and still links through existing list/detail paths
- the old standalone invoice form component still exists for now, but the route no longer uses it
- broader sales/history deep-link wiring beyond invoice detail remains future work if needed
