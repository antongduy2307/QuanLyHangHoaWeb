# Invoice Batch B: POS Edit-Draft Architecture

## Summary

Batch B adds invoice edit-draft architecture to the redesigned sales POS screen at `/sales/invoices/new`.

This batch keeps backend invoice business logic unchanged and reuses the existing PATCH endpoint:

- `PATCH /api/sales/invoices/{invoice_id}`

The sales POS can now host sale drafts in two modes:

- `create`
- `edit`

Edit drafts:

- preload an existing invoice through route state
- render with an edit-specific tab label
- show clear edit-mode UI
- submit with PATCH instead of POST
- cancel without mutating data

The old standalone invoice edit route still exists. Batch C can now wire the detail-page `Sửa hóa đơn` action into the POS edit-draft flow.

## Draft Model Changes

`SalePosDraft` now supports:

- `mode: "create" | "edit"`
- `invoiceId`
- `invoiceCode`
- `returnTo`
- `returnLabel`

Create-mode behavior remains unchanged:

- standard sale tabs still default to `Bán hàng {n}`
- create submit still POSTs `/sales/invoices`

Edit-mode behavior:

- tab label becomes `Sửa {invoice_code}`
- payment panel shows an edit badge
- primary action becomes `Cập nhật hóa đơn`
- secondary action becomes `Hủy sửa`

## Preload Adapter Behavior

Added a safe adapter from invoice detail response into POS sale-draft state.

Preloaded fields:

- invoice id
- invoice code
- customer id / snapshot name
- invoice datetime
- paid amount
- note
- item rows:
  - product id
  - product code snapshot
  - product name snapshot
  - unit type
  - quantity
  - unit price

Line totals remain derived in POS from quantity + unit price, matching existing POS behavior.

## Historical Inactive Product / Customer Handling

To preserve existing historical update behavior:

- invoice item form state now carries optional snapshot code/name fields
- shared historical merge helpers were added to `invoiceSchemas.ts`
- the standalone `InvoiceForm` now reuses those helpers
- `InvoiceCreatePage` merges historical inactive customer/product references only for existing edit drafts

Important safety behavior:

- active search suggestions still use active product/customer lists only
- merged inactive entities are used for display/edit continuity, not for general new-document selection

This keeps the feature-parity guardrail intact:

- new document creation does not silently broaden inactive selection
- historical edit rows remain visible and editable enough for update

## Route-State Preload

`/sales/invoices/new` now supports route state:

```ts
{
  editInvoiceDraft: {
    invoiceId: number;
    returnTo?: string;
    returnLabel?: string;
  }
}
```

Behavior:

- fetch invoice detail by `invoiceId`
- create an edit draft from the invoice
- focus an existing edit draft if the same invoice is already open
- avoid creating a broken draft when fetch fails
- clear the route-state payload after handling it

## Submit Branching

Sale submit now branches by draft mode:

### Create draft

- POST `/sales/invoices`
- existing create behavior preserved

### Edit draft

- PATCH `/sales/invoices/{invoice_id}`
- uses the existing invoice payload shape
- reuses existing sales query invalidation patterns
- also invalidates history queries for downstream consistency

## Cancel Behavior

Edit drafts now show `Hủy sửa`.

Behavior:

- if `returnTo` exists: navigate there
- otherwise: close the edit draft tab and focus an adjacent tab
- never PATCH on cancel

## Safety UX

Edit mode is now clearly visible through:

- tab label: `Sửa {invoice_code}`
- edit badge: `Đang sửa hóa đơn`
- invoice code in the payment panel
- submit button text: `Cập nhật hóa đơn`

This reduces the risk of confusing an invoice update with a new sale.

## Enter Behavior

The POS form still blocks Enter-triggered invoice submission.

This batch preserves:

- no full invoice create/update on Enter
- explicit click on the main action button is still required

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/invoiceSchemas.ts`
- `frontend/src/features/sales/InvoiceForm.tsx`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/sales/InvoicePosEditDraft.test.tsx`
- `frontend/src/styles.css`

## Tests Run / Results

Commands run from `frontend/`:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- tests: passed (`10` files, `50` tests)
- build: passed
- lint: passed

Build note:

- Vite still reports the existing main-bundle chunk-size warning above `500 kB` after minification.
- This batch did not introduce a build failure.

## Known Limitations

- The old standalone invoice edit route still exists and still renders the older separate edit form.
- The detail-page `Sửa hóa đơn` action is not yet rewired in this batch.
- Product/customer reassignment behavior inside POS edit mode was not narrowed to the old desktop’s locked-customer pattern; this batch focused on edit-draft hosting and preload architecture.

## Batch C Wiring Plan

Batch C can now wire invoice detail into POS edit mode with a low-risk change:

1. Change `Sửa hóa đơn` on invoice detail to navigate to `/sales/invoices/new`
2. Pass:

```ts
{
  editInvoiceDraft: {
    invoiceId,
    returnTo: `/sales/invoices/${invoiceId}`,
    returnLabel: "Quay lại hóa đơn",
  }
}
```

3. Optionally convert `/sales/invoices/:invoiceId/edit` into a compatibility redirect into the same route-state flow

That wiring is now feasible without additional backend work.
