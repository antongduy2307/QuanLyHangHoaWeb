# UI Redesign Batch 4: Sales POS Create Implementation

## Summary

Redesigned `/sales/invoices/new` into a KiotViet-style POS invoice creation screen using the existing brown/cream operational shell. The old create form is replaced only for invoice creation; invoice list, detail, and edit routes remain available for later redesign batches.

No backend business logic or API contract was changed.

## Layout Decisions

- The create route now uses the same full-bleed top navigation shell used by the redesigned inventory pages.
- The POS layout has a wide left sale area and a fixed-width right payment panel.
- The left area contains product search, frontend-only invoice draft tabs, the line-item table, and the order note.
- The right panel contains customer search, selected customer debt display, invoice datetime, payment totals, paid amount, change/overpayment display, and the `Thanh toán` button.
- Payment method selectors, suggested amount chips, QR/contact elements, and return flows were intentionally left out of this batch.

## Draft Behavior

- A default `Hóa đơn 1` draft is created in frontend state.
- The `+` button adds a separate blank draft.
- Each draft keeps its own items, customer selection, customer snapshot name, invoice datetime, paid amount, and note.
- Drafts are not persisted to the backend and are lost on refresh.
- Successful payment resets the POS back to a fresh blank invoice.

## Product Search Behavior

- Product search filters by product name only from the currently loaded active product list.
- Selecting a product adds it to the current draft.
- Selecting the same product with the same default unit increments quantity by `1`.
- `BAO_KG` products default to `BAO` when enabled, otherwise `KG`.
- `BAO_KG` lines allow switching between enabled `BAO` and `KG` units, and switching unit refreshes the unit price from the enabled product price.
- `BICH` products show only `BICH`.
- Product code is displayed on selected lines but is not used for search.

## Customer, Debt, And Payment Behavior

- Customer search supports the existing customer name/phone search behavior from loaded customer data.
- Selected customer name, phone, and current debt are shown in the payment panel.
- No selected customer means walk-in (`Khach le`) behavior.
- Walk-in invoices are frontend-validated as fully paid or overpaid before submit.
- Customer invoices may be unpaid, partially paid, fully paid, or overpaid.
- Overpayment is sent as `paid_amount`; backend sales/customer ledger logic remains authoritative.
- The backend sales service and service tests were reviewed to confirm:
  - walk-in invoice underpayment is rejected;
  - customer unpaid invoice creates charge ledger;
  - customer partial payment creates charge and payment ledger rows;
  - customer overpayment can make customer balance negative;
  - invoice creation decreases stock through existing service logic.

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/domain/routes.ts`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/layouts/Sidebar.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`
- `docs/UI_REDESIGN_BATCH4_SALES_POS_CREATE_IMPLEMENTATION.md`

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `151` passed, `34` skipped.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend tests were not run because backend code was not changed.

## Known Limitations

- Draft tabs are frontend memory only and are lost on refresh.
- Invoice history/list/detail/edit still use the previous UI.
- There is no payment method selector in this POS batch; payload sends `payment_method: null`.
- There are no suggested payment chips.
- Returns are not included in the POS screen.
- The product search uses loaded active products and filters by name only.

## Ready For Review

Ready for local visual review at:

- `/sales/invoices/new`

The main `Bán hàng` navigation now opens the POS create screen. The invoice list remains available at `/sales/invoices`.
