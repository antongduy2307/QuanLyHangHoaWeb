# Feature Parity Core Modules Investigation

Date: 2026-05-19

Scope: inventory/products, customers/debt, sales/invoices, and returns. This is a read-only investigation of the desktop reference app plus the current web app. No code implementation is included.

## 1. Summary

The web app has substantial backend parity for the core operational flows: product create/update/delete/reactivate, customer/debt ledgers, invoice create/update/delete, return create/update/delete, BAO/KG/BICH unit compatibility, stock effects, customer balance effects, and full import rehearsal paths are present.

The largest P0 parity risks are not broad missing modules, but exact replacement details:

- Customer update in the web app cannot adjust current balance through the same desktop ledger semantics; it only updates profile fields and optionally `total_sales`.
- Web customer delete history detection only checks ledger rows, not invoices/returns directly. This is probably covered once invoices/returns always create ledgers, but it is weaker than desktop and risky for imported or inconsistent records.
- Web selectors for invoices/returns use active-only customers/products by default, while desktop preserves historical inactive customers in edit/return workflows.
- Web inventory and customer server-side search do not match the visible placeholders or desktop search scope in all cases.
- Stock adjustment history exists in the web app, but it is not the same model as desktop receipt/adjustment audit tables. If warehouse receipt semantics matter operationally, this is not full parity.
- Import tooling exists and has successful rehearsal evidence for the copied real DB, but production cutover remains out of scope and returns data in the current copied DB was zero, so return import parity has less real-data proof.

No UI/UX redesign is recommended here. The implementation batches below focus on core business parity and behavior lock-down tests.

## 2. Desktop Files Inspected

Inventory:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\models.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\validators.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\ui\product_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\inventory\ui\product_dialog.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_inventory_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_inventory_transactions.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_product_search_ui.py`

Customers/debt:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\models.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\validators.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\customer_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\debt_payment_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_list_search.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_history.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_invoice_payment_migration.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_ledger_ordering_migration.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_overpayment_ordering_pipeline.py`

Sales/invoices:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\models.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\validators.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\sales_page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\invoice_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\invoice_edit_dialog.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\sales\ui\transaction_history_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_sales_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_order_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_sales_pos_layout.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_invoice_items_table_precision.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_invoice_edit_dialog_layout.py`

Returns:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\models.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\validators.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\ui\return_page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\ui\return_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\ui\return_edit_dialog.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\ui\source_invoice_search_widget.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\returns\ui\source_invoice_items_table.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_return_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_return_page_ui_scale.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_return_page_quick_customer_search.py`

Shared/data assumptions:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\core\enums.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\core\migrations.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\docs\WEB_MIGRATION_INVESTIGATION.md`

## 3. Web Files Inspected

Backend:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\inventory_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\sales_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\return_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\document_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\customer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\money.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\quantity.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\enums.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\customer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\models\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\repositories\inventory.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\repositories\customer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\repositories\sales.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\repositories\returns.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\alembic\versions\20260515_0001_inventory_customer_schema.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\alembic\versions\20260515_0002_debt_payments.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\alembic\versions\20260516_0003_sales_returns_schema.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\alembic\versions\20260519_0005_stock_adjustments.py`

Frontend:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\inventory.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\customers.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\sales.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\returns.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\types.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\ProductListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\ProductCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\ProductEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\ProductDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\productSchemas.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\DebtPaymentForm.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\customerSchemas.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceForm.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\InvoiceEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\sales\invoiceSchemas.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\ReturnListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\ReturnForm.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\ReturnDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\ReturnCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\ReturnEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\returns\returnSchemas.ts`

Import/rehearsal/docs/tests:

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\importers\app_db_core_importer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\importers\app_db_sales_returns_importer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\importers\app_db_inventory_customer_validator.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\importers\full_import_rehearsal_verifier.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\FULL_IMPORT_REHEARSAL_PHASE2_PHASE3.md`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\IMPORT_REHEARSAL_AND_CUTOVER_RUNBOOK.md`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_inventory_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_sales_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_return_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_inventory_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_customer_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_sales_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_returns_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\importers\test_app_db_core_importer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\importers\test_app_db_sales_returns_importer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\importers\test_full_import_rehearsal_postgres.py`

## 4. Inventory Parity Table

| Area | Desktop behavior | Web behavior | Classification | Priority |
| --- | --- | --- | --- | --- |
| Product creation | Code trimmed/uppercased; name trimmed; unit mode required; at least one enabled price; creates zero balance in canonical stock column. | Same backend behavior via `InventoryService.create_product`; frontend create form exposes code/name/unit/prices. | Parity mostly present. | P0 satisfied |
| Duplicate active product code | Raises validation "Mã hàng đã tồn tại." | Raises `ConflictError("Product code already exists.")`; API maps to error response. | Behavior differs in message/language only. | P2 |
| Recreate inactive product | Same code + same trimmed name + same unit mode reactivates same row and syncs prices; different name/unit rejected. | Same backend behavior; frontend has no direct "reactivate" button, but create with same inactive identity reactivates. | Implemented but not explicit in UI. | P1 |
| Product update | Name and enabled prices editable; unit mode changes rejected. | Same backend and frontend; code and unit mode are read-only in edit page. | Parity present. | P0 satisfied |
| Product delete | Hard-delete if no history; deactivate if invoice/return/receipt/adjustment history exists. | Hard-delete if no invoice/return/stock-adjustment history; no receipt table exists in web. | Implemented but behavior differs for receipt/adjustment model. | P1 |
| Active/inactive listing | Active only by default; include inactive option. | Same. | Parity present. | P0 satisfied |
| Product search/filter | Desktop inventory list search is name-only by design; tests assert product code does not match inventory-list suggestions. Sales/returns product search also uses name-only suggestions. | Backend inventory `search` filters product name only, but frontend placeholder says "Ma hoac ten hang hoa". | Behavior mostly matches desktop; UI text/API expectation differs. | P2 |
| Product code rules | Trim + uppercase; nonblank. | Same. | Parity present. | P0 satisfied |
| Product name rules | Trim; nonblank. | Same. | Parity present. | P0 satisfied |
| Unit mode rules | `BAO_KG` allows BAO and/or KG prices; `BICH` allows only BICH. | Same. | Parity present. | P0 satisfied |
| Price create/edit/enable/disable | Price rows are created/reused; disabled rather than deleted. | Same backend; frontend exposes checkboxes. | Parity present. | P0 satisfied |
| BAO/KG/BICH compatibility | BICH rejects BAO/KG; BAO_KG rejects BICH. | Same. | Parity present. | P0 satisfied |
| Stock balance display | BAO_KG stores BAO canonical; KG derived at 25 KG/BAO; BICH stores BICH. | Same storage and conversion in backend. Frontend displays only BAO or BICH balance, not derived KG. | Frontend missing derived KG display. | P1 |
| Manual stock increase/decrease | Desktop has receipt and adjustment concepts; canonical adjustment can set new quantity; sales/returns can also move stock. Negative stock allowed. | Web exposes increase/decrease buttons with note and `StockAdjustment` audit rows; no set-to-new-quantity adjustment endpoint/UI; no receipt document model. Negative stock allowed. | Implemented but behavior differs. | P1 |
| Negative stock | Allowed and persisted; tests cover BAO, KG conversion, BICH decimals. | Allowed through decrease stock and sales. | Parity present. | P0 satisfied |
| Stock movement/history/audit | Desktop has receipt/adjustment items and history views; sales/returns are implicit stock effects. | Web has unified product movements from sales, returns, and stock adjustments. Manual adjustments record note/balance_after. | Partially parity; receipt/set-adjustment history differs. | P1 |
| Import behavior | Desktop is source DB. | Web Phase 2 imports products/prices/balances and preserves inactive flags/negative balances; rehearsal imported 23 products, 30 prices, 23 balances. | Parity path present for current data. | P0 satisfied |

## 5. Customer/Debt Parity Table

| Area | Desktop behavior | Web behavior | Classification | Priority |
| --- | --- | --- | --- | --- |
| Customer creation | Name required; phone/address/note optional; initial balance creates `OPENING_BALANCE` ledger at `1900-01-01`; total sales starts at zero. | Same opening-balance ledger; web additionally accepts `total_sales` on create. | Implemented but extra write surface differs. | P1 |
| Customer update | Updates profile fields; can set target balance, writing `BALANCE_ADJUSTMENT` ledger. If no trade/debt history, adjustment datetime is opening-balance datetime. | Updates profile fields and optionally `total_sales`; no API/UI target-balance ledger adjustment. | Backend/frontend missing desktop balance-adjustment parity. | P0 |
| Customer delete | Hard-delete if no business history; deactivate if invoices/returns/ledger history exists. | Hard-delete/deactivate based only on ledger existence. Since invoices/returns normally create ledgers, common flow works; direct imported/inconsistent docs without ledgers are riskier. | Bug suspected / behavior differs. | P0 |
| Active/inactive listing | Active only by default; include inactive option. | Same for customer list. | Parity present. | P0 satisfied |
| Customer search/filter | Desktop controller supports search/sort/positive-debt/include-inactive; UI search includes customer name and phone in places. | List API filters customer name only; frontend placeholder says name/phone. Positive-debt and include-inactive exist. | Backend missing phone search. | P1 |
| Walk-in customer | Desktop uses nullable customer for walk-in documents and snapshot name; `is_walk_in` exists but normal created customers are not walk-in. | Same nullable customer document pattern; `is_walk_in` exists. | Parity present. | P0 satisfied |
| Opening balance | Ledger event `OPENING_BALANCE`, ref id customer id, opening datetime. | Same. | Parity present. | P0 satisfied |
| Current balance | Recomputed from ordered ledger rows. Can be negative. | Same recompute order: transaction datetime, display order, id. Can be negative. | Parity present. | P0 satisfied |
| Total sales | Service-maintained aggregate; invoices increase; returns decrease; debt payments do not change it; cannot become negative. | Same in sales/returns services, but customer create/update can set total_sales directly. | Implemented but extra edit surface differs. | P1 |
| Debt payment creation | Positive only; creates ledger delta negative; can overpay into negative balance; generated ref id is time-based. | Positive only; creates `DebtPayment` row plus ledger with ref id equal to payment id; can overpay. | Behavior differs internally but operationally equivalent. | P0 satisfied |
| Debt payment edit | Append rollback ledger and replacement ledger under same ref id; keeps datetime unless changed. | Same ledger pattern plus updates `DebtPayment` row. | Parity present. | P0 satisfied |
| Debt payment delete | Removes all ledger rows for that payment reference and recomputes later balance snapshots. | Deletes all ledger rows and marks `DebtPayment.is_deleted=True`; list hides deleted by default. | Implemented but differs by retained deleted payment row. | P1 |
| Overpayment/negative balance | Allowed for debt payments and invoice overpayment. | Allowed. | Parity present. | P0 satisfied |
| Ledger ordering/display | Ledger order: transaction datetime, display order, id. Invoice charge display order 10, invoice payment 20, standalone payment 30. | Same core ordering and display orders for invoice/payment; return display order differs from desktop in one area (see returns). | Mostly parity. | P0 satisfied |
| Invoice/return-linked ledger behavior | Invoice charge and payment ledgers source-linked; deleting/updating docs removes/reapplies linked ledger effects. Returns source-linked through ref/source semantics. | Same overall behavior; uses source-linked debt payment rows for invoice payments. | Parity mostly present. | P0 satisfied |
| Import behavior | Source ledger contains core + deferred invoice/return ledgers. | Phase 2 imports core customer/debt; Phase 3 restores invoice/return ledgers and verifies final customer balances. Rehearsal imported 87 customers, 61 final debt payments, 257 ledgers. | Parity path present for current data. | P0 satisfied |

## 6. Sales/Invoice Parity Table

| Area | Desktop behavior | Web behavior | Classification | Priority |
| --- | --- | --- | --- | --- |
| Invoice creation | Creates `HDYYYYMMDD-###`; requires items; snapshots customer/product; decreases stock; applies customer ledger/sales if customer invoice; walk-in must be fully paid. | Same. | Parity present. | P0 satisfied |
| Invoice update | Roll back stock, customer ledger, source-linked debt payments, and total_sales; clear/recreate items; preserve paid amount if not supplied; can update datetime. | Full update endpoint requires full payload including paid amount/customer; rollbacks/reapplies. | Implemented but API contract differs. | P1 |
| Invoice delete | Roll back stock, customer ledger, source-linked debt payments, and total_sales, then delete invoice. | Same. | Parity present. | P0 satisfied |
| Invoice code generation | Desktop repository generates by invoice date prefix. | Web uses `DocumentService.next_invoice_code`; appears intended equivalent. | Parity likely; verify document counter collision/date behavior. | P1 |
| Invoice items | Positive quantity; compatible unit; enabled price required unless manual unit price/line total supplied; product snapshot stored. | Same; additionally quantizes calculated line total to 0.01. | Mostly parity; rounding should be checked against desktop. | P1 |
| Product/customer snapshots | Product code/name and customer snapshot stored. | Same. | Parity present. | P0 satisfied |
| Walk-in invoice | Nullable customer, default "Khach le"/"Khách lẻ"; must fully pay. | Same rule; string is ASCII "Khach le" in web. | Behavior present; display/message differs. | P2 |
| Customer invoice | Allows unpaid/partial/overpaid; invoice charge + optional debt payment ledger; increases total_sales. | Same. | Parity present. | P0 satisfied |
| Paid/unpaid/partial/overpaid | Paid amount >= 0; overpayment allowed and can make customer balance negative. | Same. | Parity present. | P0 satisfied |
| Inventory stock decrease | Decreases canonical balance; negative stock allowed. | Same. Sales stock changes do not create manual `StockAdjustment`; movement history union still shows sale rows. | Parity present. | P0 satisfied |
| Customer debt ledger | `INVOICE_CHARGE` + `DEBT_PAYMENT` with source invoice and display ordering. | Same. | Parity present. | P0 satisfied |
| Unit conversion BAO/KG/BICH | BAO/KG canonical stock in BAO; KG converts by 25. BICH only BICH. | Same. | Parity present. | P0 satisfied |
| Price default/manual price/line total | Default enabled price; manual unit price; if line total supplied, unit price derived. | Same. Web quantizes calculated totals; desktop multiplies quantity * price without explicit quantization in service. | Behavior differs in rounding edge cases. | P1 |
| Validation messages | Vietnamese desktop messages. | Mixed English/ASCII messages. | Behavior differs in operational messaging. | P2 |
| Invoice search/filter/detail | Desktop has repository search by code/customer name in different contexts and transaction history suggestions. | Web API search only invoice_code; frontend locally filters loaded list by code/customer/status/date. No pagination. | Backend missing customer-name search; frontend covers small datasets only. | P1 |
| Import behavior | Source invoices/items and ledgers. | Phase 3 import restores invoices/items and invoice ledgers; rehearsal imported 156 invoices and 375 items. | Parity path present for current data. | P0 satisfied |

## 7. Returns Parity Table

| Area | Desktop behavior | Web behavior | Classification | Priority |
| --- | --- | --- | --- | --- |
| Return creation | Supports linked returns and quick returns; generates `TRYYYYMMDD-###`; requires items; increases stock. | Same. | Parity present. | P0 satisfied |
| Return update | Roll back stock/customer effects, rebuild items, preserve id/code, update datetime/note/handling. Desktop linked update uses source invoice; quick update remains quick. | Same general behavior; web allows changing linked/quick shape through full payload. | Implemented but wider edit surface. | P1 |
| Return delete | Roll back stock and customer effects; delete return. | Same. | Parity present. | P0 satisfied |
| Return code generation | Date prefix `TRYYYYMMDD-###`. | Uses `DocumentService.next_return_code`; intended equivalent. | Parity likely; verify counter/date collision behavior. | P1 |
| Linked return | Source invoice id required; source item must belong to source invoice. | Same. | Parity present. | P0 satisfied |
| Quick return | No source invoice; no purchase ceiling; allows customer or walk-in. | Same. | Parity present. | P0 satisfied |
| Source invoice/source item behavior | Linked item uses source unit price and snapshots; source quantity ceiling enforced across prior returns. | Same, with exclusion when updating current return. | Parity present. | P0 satisfied |
| Return quantity ceiling | Linked returns cannot exceed purchased quantity minus previous returns. Quick returns have no ceiling. | Same. | Parity present. | P0 satisfied |
| Refund now behavior | Walk-in only supports refund now. Customer refund now reduces debt only up to positive balance, never pushes below zero due solely to refund. | Same. | Parity present. | P0 satisfied |
| Store credit behavior | Customer store credit subtracts full return from balance and can make balance negative. | Same. | Parity present. | P0 satisfied |
| Customer debt ledger | Desktop return display order default is `0` for store-credit/refund ledgers. | Web `RETURN_DISPLAY_ORDER = 20`. Ledger recompute will still be deterministic, but same-timestamp ordering can differ. | Implemented but behavior differs. | P1 |
| Total sales | Returns decrease total_sales; rollback increases it; cannot go negative. | Same. | Parity present. | P0 satisfied |
| Inventory stock increase | Returns increase stock; rollback decreases stock. | Same. | Parity present. | P0 satisfied |
| Validation messages | Vietnamese desktop messages. | Mixed English/ASCII messages. | Behavior differs in messaging. | P2 |
| Return search/filter/detail | Desktop search by return code/customer name/source invoice contexts. | Web API search only return_code; frontend locally filters by code/customer/handling/source/date after loading all returns. | Backend missing richer search/filter/pagination. | P1 |
| Import behavior | Source supports return invoices/items. | Phase 3 importer supports returns, but current rehearsal real copy had `return_invoices=0`, `return_invoice_items=0`, `return_ledgers=0`. | Implemented with limited real-data proof. | P1 |

## 8. P0 Gaps

1. Customer current-balance adjustment parity is missing in the web app.
   - Desktop: `CustomerService.update_customer(... target_balance=...)` writes a `BALANCE_ADJUSTMENT` ledger and recomputes balance.
   - Web: `CustomerService.update_customer` does not accept target/current balance adjustment; UI shows current balance read-only.
   - Classification: backend missing and frontend missing.

2. Customer delete history check is weaker than desktop.
   - Desktop checks invoices, returns, and ledger history.
   - Web checks only `CustomerBalanceLedger`.
   - Classification: bug suspected / behavior differs.

3. Historical inactive customer/product selection needs explicit parity tests and likely frontend/backend handling.
   - Desktop tests cover invoice edit locking inactive historical customers and return edit reloading inactive historical context.
   - Web list queries used by forms default to active-only customers/products. Existing edit forms can render old document items from the document payload, but selection lists may not preserve inactive choices consistently.
   - Classification: implemented but behavior differs / frontend missing.

## 9. P1 Gaps

1. Inventory receipt/set-adjustment parity is not exact.
   - Desktop has receipt documents and set-new-quantity adjustments.
   - Web has increase/decrease stock adjustments with notes and movement history.
   - Classification: backend missing for receipt/set-adjustment, frontend missing.

2. Derived KG stock display is not exposed in web product detail/list.
   - Backend can convert but response displays canonical fields only.
   - Classification: implemented backend logic but frontend not exposed.

3. Search/filter parity is incomplete.
   - Product search is name-only but frontend says code/name.
   - Customer API search is name-only while UI says name/phone.
   - Sales API search is invoice-code only.
   - Returns API search is return-code only.
   - Frontend compensates for some list pages by client-side filtering after loading all rows, which is not an operationally robust replacement.
   - Classification: backend missing / frontend mismatch.

4. Invoice and return code generation should be parity-tested against desktop date-prefix behavior.
   - Both appear equivalent, but web uses document counters instead of direct last-code query.
   - Classification: bug risk, needs tests.

5. Rounding behavior may differ.
   - Desktop calculates `quantity * unit_price` directly unless `line_total` is supplied.
   - Web quantizes calculated line totals to two decimals.
   - Classification: implemented but behavior differs.

6. Return ledger display ordering differs.
   - Desktop return ledgers default to display order `0`.
   - Web uses `20`.
   - Classification: implemented but behavior differs.

7. Deleted debt payments are retained as `is_deleted=True` in web while desktop deletes all ledger rows for the payment reference and has no separate payment table.
   - Operational list hides deleted rows, but import/audit/display behavior differs.
   - Classification: implemented but behavior differs.

8. Return import has limited real-data proof because the current real copied DB has zero return rows.
   - Classification: implemented but under-verified.

9. Customer create/update exposes total_sales in backend create/update and create UI.
   - Desktop total_sales is service-maintained and not a normal profile edit.
   - Classification: implemented but behavior differs.

## 10. P2 Gaps

1. Validation and user-facing messages differ substantially.
   - Desktop messages are mostly Vietnamese and often specific.
   - Web messages are mixed English/ASCII.

2. Walk-in label differs (`Khách lẻ` desktop vs `Khach le` web in several places).

3. Frontend placeholders and labels have mojibake/encoding artifacts in some files, but UI/UX redesign is explicitly out of scope.

4. The web list pages rely on loading all invoices/returns for local filtering; this is acceptable short-term but should become server-side filtering/pagination later.

## 11. Behavior Mismatches and Risks

- Customer balance adjustment is the clearest functional mismatch. Operators need a desktop-equivalent way to correct balances without corrupting ledger semantics.
- Customer delete could hard-delete a customer with invoice/return rows if those rows exist without ledger rows. This should not happen in normal service flows, but import/repair/manual DB states make the weaker check unsafe for replacement parity.
- Inactive historical records are critical. Desktop explicitly preserves inactive products/customers in historical documents while preventing new use. Web should lock and display inactive historical choices in edit/detail flows while keeping new document creation active-only.
- Web stock adjustments are simpler than desktop inventory receipt/adjustment documents. If operators use "Nhập kho" or set-to-actual-count workflows, the web app is not yet a full replacement.
- Search discrepancies will show up operationally: customers expect phone search, invoice/return search by customer/source, and predictable suggestions.
- Rounding should be decided before cutover. If desktop historical totals are exact multiplication artifacts and web rounds to cents, small ledger differences can appear in new web transactions.
- Import proof is strong for products/customers/invoices on the current copied DB, but weak for returns because no real return rows existed in that rehearsal.

## 12. Recommended Implementation Batches

### Batch 1: Customer/Debt Parity P0

- Add backend target-balance adjustment endpoint/service path that writes `BALANCE_ADJUSTMENT` ledger with desktop opening-date semantics when no trade/debt history exists.
- Add frontend minimal control to perform a balance correction from customer detail/edit without redesign.
- Strengthen `customer_has_history` to check invoices and returns directly, not only ledger rows.
- Add regression tests for balance adjustment, hard-delete vs deactivate, overpayment, delete payment recompute, and inactive historical customer handling.

### Batch 2: Inventory Parity P0/P1

- Decide whether web must implement desktop receipt and set-to-new-quantity adjustment semantics before replacement.
- If yes, add backend receipt/set-adjustment model/API or map current stock increase/decrease to a desktop-compatible operational workflow.
- Expose derived KG balance for BAO_KG products.
- Align product search placeholder/API behavior with the chosen desktop behavior.
- Add regression tests for reactivation, inactive product use rejection, negative stock, KG conversion, and movement history.

### Batch 3: Sales/Invoice Parity P0/P1

- Add parity tests for invoice code generation under same-day existing codes.
- Add tests for inactive historical customer/product edit behavior.
- Decide and lock rounding behavior for default line totals.
- Expand backend search to invoice code + customer snapshot name, with date/customer filters.
- Keep UI changes minimal: expose existing backend behavior without redesign.

### Batch 4: Returns Parity P0/P1

- Add parity tests for return code generation, linked quantity ceiling on update, quick return no-ceiling behavior, refund-now/store-credit debt effects, and inactive historical context.
- Align return ledger display order with desktop or explicitly document why web order is accepted.
- Expand backend search to return code + customer snapshot + source invoice.
- Create synthetic return import fixtures because real rehearsal DB has no return rows.

### Batch 5: Import/Cutover Confidence

- Repeat full import rehearsal from a fresh copy of latest desktop `app.db`.
- Add synthetic or seeded return data import rehearsal if production DB still has no returns.
- Keep generated JSON reports as audit evidence.
- Do not approve production cutover until P0 parity tests pass.

### Batch 6: P1 Cleanup

- Remove or restrict manual `total_sales` editing if it is not a deliberate operational feature.
- Normalize validation messages only after behavior parity is locked.
- Add pagination/server-side filters for operationally large invoice/return histories.

### Later: UI/UX Redesign

- Redesign is explicitly out of scope until core behavior and data parity are complete.

## 13. Explicit Out-of-Scope Items

- UI/UX redesign, visual restyling, layout overhaul, or copy cleanup beyond behavior-critical labels.
- Attendance/chấm công parity.
- Order/pre-order parity except where order tests reveal sales/inventory interactions.
- Reporting/dashboard parity except direct total_sales/inventory movement implications.
- Authentication/authorization redesign.
- Production cutover approval.
- Deployment, backup/restore, rollback, and post-cutover operations beyond import notes already documented.
- Any code implementation in this investigation task.
