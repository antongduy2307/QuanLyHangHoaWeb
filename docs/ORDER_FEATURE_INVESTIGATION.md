# Order Feature Investigation

## Summary

Desktop `Đặt hàng` already exists as:

- a top-level module/page labeled `Đặt hàng`
- a fourth Sales POS workspace/tab type alongside sales and returns
- a lightweight operational document that does **not** change inventory, invoices, or customer debt until it is converted into a real sales invoice

The current web app has no real order feature yet:

- no backend order models
- no order tables/migrations
- no order service/repository/API
- no frontend order routes/pages/API clients
- no POS `order` draft type in the web tab model

The only existing web surface that is close is the mixed Sales POS tab architecture in `frontend/src/features/sales/InvoiceCreatePage.tsx`, which currently supports:

- `sale`
- `linked_return`
- `quick_return`

## Old Files Inspected

Desktop repo:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\__init__.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\models.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\ui\page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\ui\order_draft_page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\ui\order_detail_popup.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\orders\ui\order_items_table.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\sales_page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_sales_pos_layout.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_smoke.py`

## Web Files Inspected

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\invoiceQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\returnQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\InventoryModuleShell.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\router.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\domain\routes.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\types.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\inventory.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\customers.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\sales.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\App.test.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\main.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\sales_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\return_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\alembic\versions\20260516_0003_sales_returns_schema.py`

## Desktop Order Behavior Summary

### Data model

Desktop stores orders in:

- `order_requests`
- `order_request_items`

Header fields:

- `order_code`
- `customer_id` nullable
- `customer_name_snapshot`
- `order_datetime`
- `required_delivery_datetime` nullable
- `note`
- `status`
- `source_invoice_id` nullable
- `completed_at` nullable

Item fields:

- `product_id`
- `product_name_snapshot`
- `unit_type`
- `quantity`

Notably absent:

- no item price
- no line total
- no payment fields
- no stock movement fields
- no customer ledger link fields

### Order code

- Format: `DHYYYYMMDD-###`
- Generated per order date in repository `generate_order_code()`

### Customer selection

- New/edit order draft uses active customers by default
- Existing order edit can preserve an already-linked inactive customer
- Walk-in order is allowed
- Walk-in snapshot defaults to `Khách lẻ`

### Product selection

- Order draft uses sellable products from sales controller
- Products must still pass unit compatibility rules
- New orders use active products from inventory list
- Existing item rows preserve snapshot name and selected unit

### Needed delivery date

- Optional
- Controlled by a checkbox in desktop draft UI
- Stored as `required_delivery_datetime`

### Status and lifecycle

Observed statuses:

- `OPEN`
- `PREPARED`
- `CONVERTED`

Behavior:

- create -> `OPEN`
- `mark_prepared(order_id, True)` -> `PREPARED`
- unmark prepared -> back to `OPEN`
- convert after sales invoice -> `CONVERTED`

Meaning:

- `PREPARED` still remains an active operational order
- `CONVERTED` is treated as completed/hidden from active views

### Active list behavior

Top-level order page shows active orders only:

- `OPEN`
- `PREPARED`

Sorted by desktop repository order:

1. `status DESC` so `PREPARED` sorts before `OPEN`
2. `required_delivery_datetime ASC NULLS LAST`
3. `order_datetime ASC`
4. `id ASC`

### Quantity summary behavior

Desktop order page has a second sub-tab:

- `Tổng số lượng hàng cần làm`

It aggregates **active** orders only:

- includes `OPEN`
- includes `PREPARED`
- excludes `CONVERTED`

Grouping key:

- `(product_id, unit_type)`

Output columns:

- product id/code surrogate in current page implementation
- product name
- unit
- total ordered quantity
- current stock available for that same unit

Additional behavior:

- decimal quantities are preserved
- same product with different units stays split
- search is by product name only
- sort modes include quantity-desc default and name sort

### Create/update/delete behavior

Desktop tests lock this behavior:

- create order does not create invoice rows
- create order does not create customer ledger rows
- create order does not change inventory
- update order only changes order fields/items
- delete order removes the order only
- converted order cannot be edited
- converted order cannot be deleted
- prepared order can still be active

### Inventory / customer debt interaction

Desktop tests explicitly show:

- order can exceed current stock
- order can use decimal quantity
- order creation/update/delete has no stock effect
- order creation/update/delete has no customer debt effect
- only later invoice conversion applies real sales effects

This is the most important parity rule for the web implementation.

### Sales interaction

Desktop Sales POS workspace includes an `Đặt hàng` tab type in its `+` menu.

Sales workspace behavior:

- tab labels are renumbered independently by mode
- order tabs use the same top shared search as sales/return tabs
- order search placeholder is `Tìm theo tên hàng`
- product search adds/merges order items
- opening “Bán từ đặt hàng” creates a sales draft preloaded from the order
- the order is **not** converted just by opening the draft
- the order becomes `CONVERTED` only after the invoice is actually created

## Web Gap Analysis

### Backend present

Present:

- inventory
- customers/debt
- sales invoices
- returns

Missing for orders:

- order ORM models
- order schemas
- order repository
- order service
- order API routes
- order tests
- order migrations

### Database schema missing/present

Missing:

- `order_requests`
- `order_request_items`
- any order document counter or order-code support

Current web migrations stop at inventory/customer/auth/sales/returns/stock adjustments. No order migration exists.

### Frontend present

Present:

- Sales POS mixed tab architecture
- top nav shell
- sales/returns list and create flows

Missing:

- top-level `/orders` route/page
- order API client
- order query hooks
- POS `order` draft type
- order draft form in Sales POS
- “Bán từ đặt hàng” conversion flow
- order list/detail/edit/delete UI
- order quantity aggregation page

### Existing web surfaces that will need change

- `InventoryModuleShell` top nav currently uses `Trả hàng`
- `router.tsx` has `/returns`, but no `/orders`
- `domain/routes.ts` has `returns`, but no `orders`
- `InvoiceCreatePage.tsx` `PosDraftType` currently has only:
  - `sale`
  - `linked_return`
  - `quick_return`

## UI Plan

### POS + menu

Replace current POS menu choices with:

- `Bán hàng`
- `Trả hàng theo hóa đơn`
- `Trả hàng nhanh`
- `Đặt hàng`

Recommended draft label scheme:

- `Bán hàng 1`
- `Trả theo HĐ 1`
- `Trả nhanh 1`
- `Đặt hàng 1`

Numbering should remain per-type, matching the desktop workspace tests.

### POS order draft tab

Desktop-aligned POS order tab should include:

- top shared search placeholder: `Tìm theo tên hàng`
- left/main item table
- right panel with:
  - customer picker
  - order datetime
  - optional required delivery datetime toggle + field
  - save action
- note field

Order row structure from desktop:

- product
- unit
- quantity
- remove

No price/payment section should be treated as business-critical for orders, because the desktop order model does not store pricing.

### Top-level Đặt hàng page

Repurpose current top-level `Trả hàng` navigation target into a future `Đặt hàng` route only after order pages are implemented.

Desktop-aligned page structure:

- sub-tab `Khách hàng`
  - active orders list
  - open detail/edit/sell actions
- sub-tab `Tổng số lượng hàng cần làm`
  - grouped quantities by product + unit
  - current stock side-by-side
  - search by product name
  - quantity/name sort

For now, `Trả hàng` top nav should remain until the order module is complete and return access has another safe entrypoint.

## Recommended Implementation Batches

### Batch 1: Backend schema + service parity

Implement:

- ORM models for `order_requests` and `order_request_items`
- Alembic migration
- repository with:
  - generate order code `DHYYYYMMDD-###`
  - get order
  - list active orders
- service with:
  - create
  - update
  - delete
  - mark prepared/unprepared
  - mark converted
  - active quantity summary

Lock parity with tests:

- no stock effects
- no customer debt effects
- can exceed stock
- decimal quantity preserved
- prepared ordering
- converted hidden from active list
- converted cannot edit/delete
- walk-in snapshot behavior

### Batch 2: Backend API

Implement:

- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `DELETE /api/orders/:id`
- `POST /api/orders/:id/prepared` or equivalent prepared toggle
- `GET /api/orders/quantity-summary`

Possibly add:

- `POST /api/orders/:id/convert` only if the web needs an explicit conversion endpoint

However, the cleaner parity path is:

- sales invoice creation can accept `source_order_id`
- sales service marks the order converted only after successful invoice creation

That matches desktop behavior more closely than a separate front-loaded conversion API.

### Batch 3: POS order draft tab

Implement:

- add `order` type to web POS draft union
- add `Đặt hàng` to `+` menu
- order draft form inside Sales POS
- per-tab state preservation
- Enter must not submit accidentally

Parity targets:

- customer selection
- walk-in snapshot
- optional required delivery date
- quantity-only items
- save order
- edit existing order in tab

### Batch 4: Top-level Đặt hàng page

Implement:

- route
- top-nav swap from `Trả hàng` to `Đặt hàng` when safe
- `Khách hàng` order list tab
- `Tổng số lượng hàng cần làm` aggregation tab
- detail popup/page behavior
- prepared toggle
- delete
- open POS order edit tab
- open “Bán từ đặt hàng” sales draft

### Batch 5: Sales-from-order integration

Implement and verify:

- opening a sales draft from an order
- preloading order items/customer/note
- keeping the order active while the draft is just open
- marking the order converted only after invoice create succeeds
- preserving stock/debt logic as standard sales logic

This should be tested end-to-end because it is the only place where order logic crosses into real financial/inventory behavior.

## Key Parity Rules To Preserve

1. Orders are not invoices.
2. Orders do not reserve or mutate stock.
3. Orders do not affect customer debt.
4. Orders may exceed stock.
5. Orders support decimal quantities.
6. Prepared orders remain active.
7. Converted orders disappear from active operational views.
8. Conversion happens only after successful invoice creation.
9. Quantity summary groups active orders by product and unit.
10. Existing inactive customer handling should follow the same historical-preservation rule already used elsewhere in the web app.

## Recommended Sequence

Recommended implementation order:

1. backend schema/service/tests
2. backend API/tests
3. POS order draft tab
4. top-level order page
5. sales-from-order conversion integration
6. only then repurpose top nav `Trả hàng` to `Đặt hàng`

## Code Change Confirmation

No application code was changed for this investigation.

Only this documentation file was added:

- `docs/ORDER_FEATURE_INVESTIGATION.md`
