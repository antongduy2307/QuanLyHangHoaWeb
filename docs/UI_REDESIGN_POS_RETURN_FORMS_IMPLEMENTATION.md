# UI Redesign: POS Return Forms Implementation

## Summary

Replaced the Sales POS return-tab placeholders with real return creation forms inside `/sales/invoices/new`.

Implemented:

- `Trả hàng theo hóa đơn` linked return tab.
- `Trả hàng nhanh` quick return tab.
- Per-tab return draft state.
- Existing sale tabs and payment behavior preserved.

No backend business logic or API behavior was changed.

## Linked Return Behavior

- Top POS search switches to `Nhập mã hóa đơn nguồn`.
- Search matches loaded source invoice codes.
- Selecting a source invoice loads its invoice rows into a return table.
- The table shows:
  - `Mã hàng`
  - `Tên hàng`
  - `Đơn vị`
  - `Đã mua`
  - `Đã trả`
  - `Còn lại`
  - `Trả lần này`
  - `Đơn giá`
  - `Thành tiền`
- `Đã trả` and `Còn lại` are estimated from currently loaded return records for the source invoice.
- Frontend blocks quantities above remaining quantity, while backend remains authoritative.
- Submit posts to `POST /api/returns` with `source_invoice_id` and `source_invoice_item_id`.

## Quick Return Behavior

- Top POS search switches to `Tìm theo tên hàng`.
- Product search remains name-only.
- Selecting a product adds a quick-return row.
- BAO/KG products expose enabled BAO/KG units.
- BICH products show BICH only.
- Quantity and unit price are editable.
- Optional customer search appears in the right return panel and shows current debt when selected.
- Submit posts to `POST /api/returns` without `source_invoice_id`.

## Handling Mode Decision

- Default handling mode is `REFUND_NOW`.
- Walk-in quick returns cannot use `STORE_CREDIT`; the UI disables that option and validation keeps the backend rule visible.
- Customer quick returns and customer-linked invoice returns may use `REFUND_NOW` or `STORE_CREDIT`.
- Backend remains the source of truth for refund/store-credit ledger effects.

## Tab State Behavior

Each return draft preserves:

- search input
- selected invoice or customer
- line rows
- return datetime
- note
- handling mode
- validation errors

Switching between sale, linked-return, and quick-return tabs does not discard draft state.

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `171` passed, `34` skipped.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend tests were not run because backend code was not changed.

## Known Limitations

- Top-level `Trả hàng` navigation is still unchanged.
- Return list/detail/edit screens are not redesigned.
- POS return drafts are frontend-only and are lost on refresh.
- Source invoice search uses loaded invoice data from the existing invoice query.

## Ready For Review

Open `/sales/invoices/new`, click the `+` POS tab button, then test:

- `Trả hàng theo hóa đơn`
- `Trả hàng nhanh`
- switching between mixed sale and return tabs
