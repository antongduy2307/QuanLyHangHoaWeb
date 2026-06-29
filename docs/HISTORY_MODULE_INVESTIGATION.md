# History Module Investigation

Date: 2026-05-23

Scope: read-only investigation of the old desktop History behavior and the current web app data sources. No implementation is included.

## Summary

The old desktop app already has a dedicated History page, but its actual scope is narrower than a fully unified operational audit log.

Desktop History currently includes:

- unified transaction history
- invoice list
- return list
- debt payment list

Desktop History does not appear to include, as first-class tabs:

- inventory stock movements
- order history
- explicit balance-adjustment list
- explicit order-status transition history

The current web backend already exposes enough read-only data to build a meaningful History module, but the APIs are fragmented:

- sales invoices
- returns
- customer ledger
- debt payments
- product-specific inventory movements
- active orders and order quantity summary

The strongest recommendation is:

- medium-term: add a unified read-only `/api/history` endpoint
- short-term prototype only if needed: compose from existing APIs

A frontend-only composition is possible for invoices, returns, customer debt, and product-level movements, but it will be weaker on:

- performance
- de-duplication
- consistent sorting
- cross-entity filtering
- imported-history correctness

## Files Inspected

Desktop app:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\shell\history_page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\transaction_history_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_history.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_overpayment_ordering_pipeline.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_history_datetime_actions.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_history_delete_actions.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_history_search_suggestions.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_transaction_history_timestamps.py`

Web backend:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\orders.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\orders.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\customer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\orders.py`

Web frontend:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\sales.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\returns.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\customers.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\inventory.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\orders.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\reports.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\types.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\router.tsx`

## 1. Recommended History Scope

### Include

Recommended for the new History module:

1. Hóa đơn bán hàng
2. Phiếu trả hàng
3. Thanh toán công nợ
4. Điều chỉnh công nợ
5. Điều chỉnh tồn kho / stock movements
6. Đặt hàng
7. Chuyển trạng thái đặt hàng

### Why

- `Hóa đơn bán hàng`, `phiếu trả hàng`, and `thanh toán công nợ` are already first-class history categories in the desktop app.
- `Điều chỉnh công nợ` is not a desktop tab by itself, but it is part of debt history and is operationally important in the web parity model.
- `Điều chỉnh tồn kho` and `stock movements` are crucial in the web app because stock change auditing already exists via movement rows and stock adjustments.
- `Đặt hàng` and `chuyển trạng thái đặt hàng` matter in the web app because Orders are a first-class module and already have state transitions (`OPEN`, `PREPARED`, `CONVERTED`).

### Scope recommendation

Recommended initial History scope:

- sales + returns + debt + stock + orders

Recommended display grouping:

- Giao dịch bán hàng
- Giao dịch trả hàng
- Công nợ khách hàng
- Biến động tồn kho
- Đặt hàng

## 2. Data Source Map

### A. Hóa đơn bán hàng

- Backend model/table:
  - `Invoice` -> `invoices`
  - `InvoiceItem` -> `invoice_items`
- Existing API:
  - `GET /api/sales/invoices`
  - `GET /api/sales/invoices/{invoice_id}`
- Existing filters:
  - `customer_id`
  - `search`
  - `date_from`
  - `date_to`
- Fields already available:
  - `id`
  - `invoice_code`
  - `customer_id`
  - `customer_snapshot_name`
  - `invoice_datetime`
  - `total_amount`
  - `paid_amount`
  - `payment_method`
  - `status`
  - `note`
  - `created_at`
  - `updated_at`
  - item snapshots
- Fields likely needed for History UI:
  - already sufficient for list + detail link
- Missing API:
  - no unified history endpoint
  - no pagination

### B. Phiếu trả hàng

- Backend model/table:
  - `ReturnInvoice` -> `return_invoices`
  - `ReturnInvoiceItem` -> `return_invoice_items`
- Existing API:
  - `GET /api/returns`
  - `GET /api/returns/{return_id}`
- Existing filters:
  - `customer_id`
  - `search`
  - `date_from`
  - `date_to`
- Fields already available:
  - `id`
  - `return_code`
  - `source_invoice_id`
  - `customer_id`
  - `customer_snapshot_name`
  - `is_quick_return`
  - `return_datetime`
  - `total_amount`
  - `handling_mode`
  - `note`
  - item snapshots
- Fields likely needed for History UI:
  - already sufficient for list + detail link
- Missing API:
  - no unified history endpoint
  - no pagination

### C. Thanh toán công nợ

- Backend model/table:
  - `DebtPayment` -> `debt_payments`
- Existing API:
  - `GET /api/customers/{customer_id}/debt-payments`
- Fields already available:
  - `id`
  - `customer_id`
  - `amount`
  - `payment_datetime`
  - `note`
  - `is_deleted`
  - `created_at`
  - `updated_at`
- Fields likely needed for History UI:
  - customer name
  - optional source transaction context
- Missing API:
  - no global debt-payment listing endpoint in the web backend
  - no date-range filtering endpoint for all debt payments

### D. Điều chỉnh công nợ

- Backend model/table:
  - `CustomerBalanceLedger` -> `customer_balance_ledgers`
- Existing API:
  - `GET /api/customers/{customer_id}/ledger`
- Relevant ledger row types:
  - `OPENING_BALANCE`
  - `BALANCE_ADJUSTMENT`
  - `INVOICE_CHARGE`
  - `DEBT_PAYMENT`
  - `DEBT_PAYMENT_EDIT_ROLLBACK`
- Fields already available:
  - `id`
  - `customer_id`
  - `event_type`
  - `ref_type`
  - `ref_id`
  - `amount_delta`
  - `balance_after`
  - `transaction_datetime`
  - `display_order`
  - `note`
- Fields needed for History UI:
  - customer name
  - optional source-link metadata for invoice/return-linked rows
- Missing API:
  - no global ledger/history endpoint
  - current public schema does not expose `source_ref_type` / `source_ref_id`

### E. Điều chỉnh tồn kho / Stock movements

- Backend model/table:
  - `StockAdjustment` -> `stock_adjustments`
- Existing API:
  - `GET /api/inventory/products/{product_id}/movements`
- Fields already available:
  - `movement_id`
  - `movement_datetime`
  - `movement_type`
  - `quantity_delta`
  - `unit_type`
  - `balance_after`
  - `source_type`
  - `source_id`
  - `note`
  - `actor`
  - `created_at`
- Important behavior:
  - endpoint is product-scoped, not global
  - service already composes movement history from:
    - sales
    - returns
    - stock adjustments
- Missing API:
  - no global inventory-history endpoint
  - no date-range or keyword filters at backend

### F. Đặt hàng

- Backend model/table:
  - `OrderRequest` -> `order_requests`
  - `OrderRequestItem` -> `order_request_items`
- Existing API:
  - `GET /api/orders`
  - `GET /api/orders/{order_id}`
  - `GET /api/orders/quantity-summary`
- Existing behavior:
  - `GET /api/orders` returns active orders only
- Fields already available:
  - `id`
  - `order_code`
  - `customer_id`
  - `customer_name_snapshot`
  - `order_datetime`
  - `required_delivery_datetime`
  - `note`
  - `status`
  - `source_invoice_id`
  - `completed_at`
  - items
- Missing API:
  - no order-history list including converted/closed rows
  - no global order transition timeline
  - no date-range filters

### G. Chuyển trạng thái đặt hàng

- Backend source:
  - still `order_requests`
  - transitions performed through:
    - `POST /api/orders/{order_id}/prepared`
    - `POST /api/orders/{order_id}/converted`
- Existing persisted fields:
  - `status`
  - `source_invoice_id`
  - `completed_at`
- Missing API:
  - no dedicated order-event table
  - no transition audit feed

## 3. UI Proposal

### Recommended layout

KiotViet/desktop-inspired History module:

- left filter rail or compact top filter bar
- large main table
- detail drawer on the right or modal popup
- open-link behavior to existing detail pages where possible

### Recommended filters

1. Date range
2. Transaction type
3. Customer
4. Product
5. Keyword / code

### Recommended transaction-type filter values

- Tất cả
- Hóa đơn bán hàng
- Phiếu trả hàng
- Thanh toán công nợ
- Điều chỉnh công nợ
- Biến động tồn kho
- Đặt hàng
- Chuyển trạng thái đặt hàng

### Recommended main table columns

- Thời gian
- Loại giao dịch
- Mã chứng từ / mã tham chiếu
- Khách hàng
- Sản phẩm / tóm tắt hàng
- Giá trị / phát sinh
- Trạng thái
- Nguồn / mở chi tiết

### Detail drawer / popup behavior

Preferred:

- click row opens right-side drawer
- drawer shows normalized detail summary by history type
- include deep links:
  - open invoice detail
  - open return detail
  - open customer detail
  - open product detail
  - open order detail

For some event types:

- debt payment / balance adjustment can show normalized ledger detail
- stock movement can show product, movement type, quantity delta, and balance after

## 4. Backend / API Recommendation

### Recommendation

Recommend a unified read-only backend endpoint:

- `GET /api/history`

### Why not frontend composition only

Frontend composition from existing APIs is possible, but not ideal because:

1. invoice, return, ledger, movement, and order sources use different filter shapes
2. customer debt data is customer-scoped, not globally queryable
3. inventory movements are product-scoped, not globally queryable
4. orders list is active-only, not historical
5. sorting across multiple feeds will become fragile, especially around ledger-order rules and imported data

### Recommended unified history response shape

Suggested normalized item fields:

- `event_type`
- `event_id`
- `event_datetime`
- `display_order`
- `code`
- `customer_id`
- `customer_name`
- `product_id`
- `product_name`
- `amount`
- `quantity`
- `status`
- `source_type`
- `source_id`
- `note`
- `open_target`

### Minimum viable fallback

If backend work must be deferred:

- invoices + returns can be composed from existing list APIs
- customer debt can only be partially composed per selected customer
- stock movement can only be shown per selected product
- orders can only show active orders

That fallback is too incomplete for a strong module-wide “Lịch sử” surface.

## 5. Risk Analysis

### Ledger ordering

High risk.

- Customer debt history depends on stable ordering:
  - `transaction_datetime`
  - `display_order`
  - `id`
- Overpayment and same-timestamp invoice/payment cases already have explicit desktop tests.
- A unified History feed must not flatten these rows in a way that breaks order semantics.

### Duplicated events

High risk.

- The same business action can appear in multiple sources:
  - invoice in invoices
  - invoice-linked debt effect in ledger
  - invoice-linked movement in inventory movements
- The History module must decide:
  - whether to show business documents only
  - or show every accounting/audit event

Recommended principle:

- default list should show business/audit events as distinct categories, not blindly merge all raw rows

### Performance

High risk for frontend composition.

- Multiple list fetches with cross-filtering will become expensive.
- Product-scoped and customer-scoped endpoints do not scale for a global History module.

### Consistency across invoice/return/ledger/stock movement

High risk.

- Web currently has strong per-domain APIs, but not a single consistency surface.
- A unified backend endpoint should own normalization and sorting.

### Imported historical data

Medium-high risk.

- Imported invoice/return/customer-balance history must remain visible and consistent.
- Unified history should avoid assumptions that all records were generated by the current UI.

### Order history completeness

High risk.

- Current orders API is not historical; it is operationally active-focused.
- If order history is in scope, backend expansion is required.

## 6. Recommended Implementation Batches

### Batch A: Read-only unified backend history endpoint

- add `GET /api/history`
- normalize invoices, returns, debt payments, balance adjustments, stock movements, and orders
- support:
  - date range
  - type
  - customer
  - product
  - keyword/code
- keep read-only

### Batch B: Frontend history list

- add `/history` route and nav entry
- implement list/table
- implement filters
- implement type chips or filter select

### Batch C: Detail drawer and open links

- right-side detail drawer
- open existing detail pages from history rows
- normalized row detail panels by event type

### Batch D: Pagination / export / refinement

- backend pagination
- large-range performance tuning
- export later
- optional saved filters

## Recommended Scope Decision

Recommended v1 scope:

- Hóa đơn bán hàng
- Phiếu trả hàng
- Thanh toán công nợ
- Điều chỉnh công nợ
- Biến động tồn kho
- Đặt hàng

Recommended v1 API decision:

- build unified `/api/history`

Recommended non-goal for v1:

- no write actions from History
- no full reporting/dashboard merge

## No-Code-Change Confirmation

This task was investigation only.

- No source code was changed.
- No backend logic was modified.
- No frontend routes or UI were implemented.
