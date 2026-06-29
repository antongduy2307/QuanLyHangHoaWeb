# Invoice Detail + Edit Workflow Investigation

## Summary

Current web invoice detail and edit are split across two older AdminLayout-style pages:

- `InvoiceDetailPage.tsx` is a read/detail screen with summary cards and a plain table.
- `InvoiceEditPage.tsx` is a separate edit route that renders `InvoiceForm.tsx`.

That is out of step with the redesigned web sales experience, where `InvoiceCreatePage.tsx` already uses the newer brown/cream POS shell with tabbed drafts and in-place sales editing patterns for orders/returns.

The old desktop app confirms the target direction:

- invoice detail can be opened from invoice list, transaction history, and customer history
- edit is routed back into the sales workspace, not handled as a separate detail form
- editing preloads the existing invoice into a sales tab
- update is only committed when the user clicks the POS action button (`Cập nhật`)
- after successful edit, the edit tab closes and the surrounding history/list views refresh

Recommendation: redesign web invoice detail into the current shell, then move invoice edit initiation from `/sales/invoices/:id/edit` to an edit draft inside the POS route (`/sales/invoices/new` or an equivalent sales POS route state), with clear edit-mode labeling and PATCH-on-submit behavior.

## Files Inspected

### Current web

- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoiceEditPage.tsx`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/features/sales/InvoiceForm.tsx`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/sales/invoiceSchemas.ts`
- `frontend/src/api/sales.ts`
- `frontend/src/api/types.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/domain/routes.ts`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/components/PageHeader.tsx`
- `backend/app/application/sales_service.py`
- `backend/app/api/routes/sales.py`
- `backend/app/schemas/sales.py`
- `backend/tests/service/test_sales_service.py`
- `backend/tests/api/test_sales_api.py`

### Old desktop app

- `QuanLyHangHoa/modules/sales/ui/invoice_detail_popup.py`
- `QuanLyHangHoa/modules/sales/ui/invoice_edit_dialog.py`
- `QuanLyHangHoa/modules/sales/ui/sales_page.py`
- `QuanLyHangHoa/modules/sales/ui/page.py`
- `QuanLyHangHoa/modules/sales/ui/invoice_list_view.py`
- `QuanLyHangHoa/modules/sales/ui/transaction_history_view.py`
- `QuanLyHangHoa/modules/customer/ui/customer_list_view.py`
- `QuanLyHangHoa/shell/app_window.py`
- `QuanLyHangHoa/modules/sales/service.py`
- `QuanLyHangHoa/tests/test_sales_service.py`
- `QuanLyHangHoa/tests/test_sales_pos_layout.py`
- `QuanLyHangHoa/tests/test_invoice_edit_dialog_layout.py`

## 1. Current Web Invoice Detail

### Layout

- Route: `/sales/invoices/:invoiceId`
- Shell: `AdminLayout`
- Page component: `InvoiceDetailPage`
- Visual structure:
  - top `page-title-row`
  - `PageHeader`
  - row actions on the right
  - `summary-grid` of `summary-card`
  - plain `data-table` inside `table-wrap`

This is the older app styling, not the newer `InventoryModuleShell` / redesigned POS shell.

### Actions available

- `Sửa hóa đơn` links to `/sales/invoices/:invoiceId/edit`
- `Xóa hóa đơn` runs delete with `window.confirm`
- `Quay lại` links to `/sales/invoices`

Write access is role-gated in the page via `owner` / `admin`.

### Fields shown

- invoice code
- invoice datetime
- customer snapshot name
- total amount
- paid amount
- status
- payment method
- remaining amount computed as `total_amount - paid_amount`
- note

### Item table structure

Columns:

- mã hàng
- tên hàng
- đơn vị
- số lượng
- đơn giá
- thành tiền

Rows come directly from `invoice.items` and use the snapshot fields.

### Edit / delete / back behavior

- Edit is route-based and leaves the detail screen.
- Delete stays on the detail screen and redirects to `/sales/invoices` after success.
- Back always returns to invoice history list.

### Mismatch with redesigned shell

- no `InventoryModuleShell`
- no redesigned top nav / brand shell
- no POS-style tab metaphor
- no warm brown/cream card styling used by the newer sales/inventory/customer redesign
- actions are simple links/buttons, not aligned with the current POS workspace mental model

## 2. Current Web Invoice Edit

### Current edit route and form

- Route: `/sales/invoices/:invoiceId/edit`
- Page: `InvoiceEditPage`
- UI: old standalone form page under `AdminLayout`
- Form component: `InvoiceForm`

`InvoiceEditPage` loads the invoice with `useInvoice(invoiceId)`, renders `InvoiceForm`, and submits with `useUpdateInvoice(invoiceId)`.

### Payload structure

Frontend PATCH payload shape is effectively the same as create:

- `customer_id`
- `customer_snapshot_name`
- `invoice_datetime`
- `paid_amount`
- `payment_method`
- `note`
- `items[]` with:
  - `product_id`
  - `unit_type`
  - `quantity`
  - `unit_price`

Web edit currently submits a full invoice payload, not a small partial patch.

### Whether edit uses full payload

Yes.

`InvoiceForm` always calls `toInvoiceCreatePayload(...)`, which rebuilds the complete invoice payload. `useUpdateInvoice` then sends that payload to `PATCH /sales/invoices/:id`.

Backend PATCH accepts `InvoiceUpdateRequest`, which also expects:

- `invoice_datetime`
- `items`
- optional `paid_amount`
- optional `payment_method`
- optional `note`
- optional customer fields

In practice the web edit page always sends `paid_amount`, so the backend "preserve paid amount when omitted" behavior is currently unused by this UI.

### Stock / customer ledger rollback and reapply

Backend `SalesService.update_invoice(...)` does a full rollback and reapply:

1. load invoice for update
2. load old items
3. validate new payload
4. `_rollback_invoice_effects(...)`
   - restore stock from old items
   - remove old customer ledger effects
   - remove generated debt payments linked to this invoice
   - recompute customer balance
5. delete old invoice items
6. rewrite invoice header fields
7. apply new items
   - decrease stock again
   - refresh item snapshots
8. reapply customer invoice effects
   - invoice charge ledger
   - debt payment ledger if `paid_amount > 0`
   - recompute balance

This is covered by both service and API tests.

### `paid_amount` behavior

Web edit:

- preloads existing `paid_amount`
- allows editing it
- always resubmits it

Backend behavior:

- if PATCH omits `paid_amount`, current paid amount is preserved
- if PATCH includes `paid_amount`, old debt-payment effects are removed and rebuilt from the new amount
- overpayment is allowed for customer invoices and can push balance negative
- walk-in invoices must remain fully paid after edit

### Inactive historical customer / product handling

Current edit form explicitly supports historical inactive references:

- `InvoiceForm.mergeHistoricalProducts(...)` injects missing inactive products from invoice snapshots
- `InvoiceForm.mergeHistoricalCustomer(...)` injects the inactive historical customer if needed

Backend also supports this pattern:

- inactive product can still be reused when updating a historical invoice if that product already exists on the invoice
- inactive historical customer detail and update still work

This behavior is already protected by tests on both web/backend sides.

### Important limitation of current web edit form

The separate edit form is not POS-native:

- no POS tab draft model
- no product/customer search interaction like the redesigned POS
- no shared workspace with new sale / return / order tabs
- no route-state-driven return destination

## 3. Old Desktop Behavior

### How invoice detail is opened

Desktop invoice detail is opened from:

- invoice list (`invoice_list_view.py`)
- transaction history (`transaction_history_view.py`)
- customer inline history (`customer_list_view.py`)

All of those open `InvoiceDetailPopup`.

### How invoice edit is initiated

Desktop edit is initiated from:

- invoice list `Sửa`
- transaction history `Sửa`
- customer history detail popup `Sửa`

Those paths do not open a separate edit form route. They call `app_window.open_sales_invoice_editor(invoice_id)`.

### Whether edit opens the sales POS/workspace

Yes.

`AppWindow.open_sales_invoice_editor(...)` switches to the sales module and calls `sales_page.open_invoice_edit_tab(invoice_id)`.

`modules/sales/ui/page.py` then:

- loads the invoice
- opens a sales workspace tab
- labels it like `Sửa bán hàng <invoice_code>`
- mounts `modules/sales/ui/sales_page.py` with `invoice=...`

This is the clearest legacy parity signal for the web app.

### How existing invoice values are preloaded

Desktop sales page preloads:

- invoice items
- note
- invoice datetime
- paid amount
- existing customer

It also marks the page as edit mode by:

- storing `_editing_invoice_id`
- changing button text from `Thanh toán` to `Cập nhật`
- locking the customer picker to the existing customer or walk-in mode

Tests confirm:

- tab label starts with `Sửa bán hàng`
- button text becomes `Cập nhật`
- customer picker search is disabled in edit mode
- inactive historical customer still stays locked and selected

### When update is actually committed

Only when the user presses the main POS action button.

Desktop `SalesPage._submit_invoice()` branches:

- create mode -> `_create_invoice()`
- edit mode -> `_update_invoice()`

`_update_invoice()` calls controller update only on button click.

### Cancel behavior

The desktop edit workflow uses closable workspace tabs, not a separate cancel button inside the invoice edit workflow.

Observed behavior:

- edit opens in a closable sales workspace tab
- user can abandon by closing the tab before clicking `Cập nhật`
- on successful edit, `on_edit_completed` closes the workspace tab automatically

So the practical "cancel" behavior is tab close / tab switch, not a dedicated revert flow.

### Restrictions on edited invoice

Desktop edit restrictions:

- customer association is locked; edit does not switch invoice to a different customer
- walk-in edit still requires full payment
- existing invoice code is preserved
- rollback/reapply is atomic
- generated debt-payment rows linked to the invoice are removed/rebuilt
- invoice item list cannot be empty

Also important: there is still an `InvoiceEditDialog`, but the active workspace workflow is the POS tab workflow. The dialog appears to be legacy or secondary, not the primary edit path.

## 4. Proposed Web Behavior

### Target behavior

1. Redesign invoice detail to use the current brown/cream shell.
2. Keep invoice detail as the place for view + delete.
3. Change `Sửa hóa đơn` so it opens the sales POS route with an edit draft preloaded.
4. Make the draft visibly different from a new invoice draft.
5. Submit with PATCH, not POST.
6. Return/cancel should go back to the originating detail/history context.

### Recommended route direction

Preferred:

- reuse `/sales/invoices/new` as the POS workspace route

Reason:

- it already hosts the redesigned sales workspace
- it already supports route-state preload for `sourceOrderDraft`
- it already suppresses Enter-to-submit
- it already has draft tabs

Suggested route state shape:

- `editInvoiceDraft`
  - `invoiceId`
  - `returnTo`
  - `returnLabel`
  - preloaded invoice header
  - preloaded items
  - edit mode metadata

### Draft should be clearly marked as editing existing invoice

Recommended visible cues:

- tab label like `Sửa HD20260521-001`
- summary badge like `Đang sửa hóa đơn`
- primary button label `Cập nhật hóa đơn`
- secondary action `Hủy sửa`

This is necessary to prevent the user from thinking they are creating a new invoice.

### Submit behavior

- create draft -> POST `/sales/invoices`
- edit draft -> PATCH `/sales/invoices/:invoiceId`

The branch should be draft-mode-driven, not route-driven once the POS page loads.

### Cancel behavior

Recommended:

- if opened from detail page, cancel returns to that invoice detail
- if opened from history/customer history, cancel returns to the originating invoice detail or history context passed in route state
- cancel should close the edit draft tab if the POS page supports multiple drafts

### Post-success redirect behavior

Primary recommendation:

- redirect back to invoice detail with a success message

Alternative:

- stay inside POS temporarily, show success toast, then offer quick actions:
  - `Xem chi tiết`
  - `Tạo hóa đơn mới`

For parity and clarity, redirecting to invoice detail is the cleaner default.

## 5. Technical Gap Analysis

### Can current POS `InvoiceCreatePage` support create draft?

Yes. It already supports:

- sale draft creation
- multiple tabs/drafts
- order-to-sales preload via route state
- Enter-to-submit suppression
- redesigned shell

### Can it support edit draft?

Not yet directly, but the structure is close.

Missing pieces:

- a sale draft mode that distinguishes `create` vs `edit`
- invoice id attached to the draft
- invoice-code-aware tab label
- preload path for an existing invoice instead of only `sourceOrderDraft`
- submit branching to POST vs PATCH
- cancel/return target for edit drafts

### Can it preload invoice items / customer / paid_amount / datetime / note?

Architecturally yes.

Current draft shape already holds:

- customer state
- invoice datetime
- paid amount
- note
- item rows

What is missing is a converter from `Invoice` -> `SalePosDraft`, similar to:

- current `invoiceToFormState(...)` in `invoiceSchemas.ts`
- current `applySourceOrderDraftState(...)` in `InvoiceCreatePage.tsx`

### Can it use PATCH instead of POST?

Not currently in `InvoiceCreatePage`.

Today `handlePayment()` always calls `createInvoice.mutateAsync(...)`.

It would need:

- `useUpdateInvoice(invoiceId)`
- mode-aware submit logic

### No Enter-to-submit

Already supported.

`InvoiceCreatePage` prevents Enter submission at the form level except for textarea.

### Tab label for editing

Not supported today.

Current sale tab labels are generic:

- `Bán hàng 1`
- `Bán hàng 2`

Edit drafts would need custom labels, for example:

- `Sửa HD20260521-001`

That is consistent with old desktop behavior and should be added.

## 6. Risks

### Stock rollback / reapply

- Edit is not an in-place delta update.
- Backend fully rolls back old stock effects and reapplies new ones.
- UI must not accidentally submit create when the user intended update.

### Customer debt recalculation

- Customer ledgers are deleted and rebuilt for the invoice.
- Editing `paid_amount`, customer linkage, or total amount changes debt state materially.

### Overpayment handling

- Customer overpayment is allowed and can push balance negative.
- UI must present the edit mode clearly so overpayment is not interpreted as a new invoice payment.

### Inactive historical product / customer

- Existing edit flow already supports them.
- A POS edit-draft rewrite must preserve the same support.
- Reusing only active product/customer lists would regress historical invoice editing.

### `source_order_id`

- Current create POS can originate from order conversion.
- Invoice edit should not accidentally reuse create-only order conversion behavior.
- Future order-conversion logic must ensure edited invoices are not treated like fresh order conversions.

### Draft state collision

- Multi-tab POS introduces risk of two edit tabs for the same invoice
- risk of edit draft coexisting with a new sale draft using similar visual language
- risk of stale route-state draft reopening

Recommended mitigation:

- unique draft key per editing invoice
- refuse duplicate edit tabs for the same invoice, or focus the existing tab

### User accidentally paying edited invoice as new invoice

This is the highest UX risk.

If edit mode is not explicit enough, the user may think they are creating a new sale and duplicate the business effect. Clear edit labeling, PATCH submit logic, and distinct success copy are required.

## 7. Recommended Batches

### Batch A: Invoice detail shell redesign

- move `InvoiceDetailPage` onto the redesigned shell
- keep current read behavior
- keep delete on detail page
- restyle actions, summary cards, and item table

### Batch B: POS edit-draft architecture

- add sale draft mode metadata: `create` vs `edit`
- add invoice preload adapter
- add edit tab custom label
- add PATCH submit branch
- add edit cancel / return target handling
- preserve Enter suppression

### Batch C: Wire `Sửa hóa đơn` to POS edit draft

- replace detail-page edit link behavior
- support opening from invoice detail first
- optionally extend later to invoice list/history/customer history deep links

### Batch D: Regression tests

Frontend:

- invoice detail redesigned shell rendering
- edit draft preload
- PATCH vs POST branch
- cancel routing
- duplicate edit-tab prevention if implemented

Backend/API:

- preserve existing invoice update/delete tests
- add any missing tests only if new route-state or API assumptions change

## Recommended Implementation Notes

- Keep `/sales/invoices/:invoiceId/edit` temporarily as a compatibility redirect into the POS route-state flow if needed.
- Do not delete the backend PATCH path; it already matches the required business semantics.
- Reuse the current POS draft system instead of adding a second invoice edit surface.
- Treat desktop `SalesPage` edit-tab behavior as the parity reference, not the legacy `InvoiceEditDialog`.

## Conclusion

The old desktop app already validates the requested product decision: invoice edit belongs inside the sales workspace, preloaded into an edit-specific tab, and committed only when the user confirms update. The current web app has the backend semantics needed for this, but the frontend is still split between an old detail page and a separate old edit form.

The smallest low-risk path is:

1. redesign detail first
2. add POS edit-draft support
3. rewire `Sửa hóa đơn` into that POS draft
4. cover the flow with regression tests

## Confirmation

- No application code behavior was changed.
- Only this investigation document was added.
