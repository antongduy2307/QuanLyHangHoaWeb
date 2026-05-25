# Order Batch 3 POS Order Tab

## Summary

Added real `Đặt hàng` draft tabs inside the Sales POS screen at `/sales/invoices/new`.

This batch adds:

- `Đặt hàng` as a fourth POS `+` menu option
- order draft tabs with per-type numbering
- desktop-aligned order item table
- order customer/delivery-date panel
- order save flow using `POST /api/orders`

No top-level order page, no sales-from-order conversion, and no navigation changes were introduced in this batch.

## Behavior

### POS + menu

The POS `+` menu now includes:

- `Bán hàng`
- `Trả hàng theo hóa đơn`
- `Trả hàng nhanh`
- `Đặt hàng`

### Order draft tabs

- Order drafts use a dedicated `order` draft type.
- Labels are computed by current visible order within that type:
  - `Đặt hàng 1`
  - `Đặt hàng 2`
- Active draft tracking remains ID-based.
- Switching between mixed sale/return/order tabs preserves state.

### Order tab UI

The order tab includes:

- top search: `Tìm theo tên hàng`
- item table:
  - `Tên hàng`
  - `Đơn vị`
  - `Số lượng`
  - `Xóa`
- right panel:
  - `Thời gian đặt hàng`
  - `Có ngày cần giao`
  - `Ngày cần giao`
  - customer search/selection
  - current customer debt display
  - `Lưu đặt hàng`
- bottom note:
  - `Ghi chú đơn đặt hàng`

### Product behavior

- search remains product-name-only
- selecting the same product with the same unit increments quantity
- BAO/KG products support enabled BAO/KG units
- BICH products support BICH only
- decimal quantity is allowed
- order quantity can exceed stock

### Customer behavior

- customer is optional
- walk-in is allowed
- selected customer shows current debt
- saving the order does not mutate customer debt

### Submit behavior

- order submit calls `POST /api/orders`
- save success shows feedback and resets the current order draft to a fresh blank order draft
- order mutation invalidates the order query key plus customer/product query groups

### Enter behavior

- Enter does not submit the whole order draft
- only clicking `Lưu đặt hàng` submits

## Files Changed

- `frontend/src/api/types.ts`
- `frontend/src/api/orders.ts`
- `frontend/src/features/orders/orderQueries.ts`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`
- `docs/ORDER_BATCH3_POS_ORDER_TAB.md`

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `180` passed, `34` skipped
- `npm.cmd run build`: passed
- `npm.cmd run lint`: passed

## Notes

- Top-level `Trả hàng` navigation remains unchanged in this batch.
- No top-level `/orders` page is implemented yet.
- No sales-from-order conversion is implemented yet.
