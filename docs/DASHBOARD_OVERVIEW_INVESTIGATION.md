# Dashboard / Tổng quan Investigation

Date: 2026-05-25

## Summary

Current web support for Dashboard / `Tổng quan` is partial.

- The existing dashboard page is a small card view backed by one endpoint: `GET /api/reports/dashboard-summary`.
- The existing reports page is a read-only placeholder backed by four report endpoints:
  - sales summary
  - returns summary
  - customer debt
  - inventory summary
- The repo already has a strong unified activity feed via `GET /api/history`, which can power `Hoạt động gần đây` better than the current report endpoints.
- Sales, returns, inventory, customer, and order data already exist in separate APIs, but there is no backend aggregation yet for:
  - top-selling products by revenue
  - flexible dashboard time-series buckets
  - one-call overview payload shaped for the target UI
- I did not find a real old desktop dashboard/report implementation inside this repo. I only found:
  - earlier notes that dashboard was initially allowed to be a placeholder
  - KiotViet/desktop-inspired layout references in redesign docs
  - a mature history-module investigation that already follows desktop/KiotViet-style operational UX patterns

## Files Inspected

Frontend:

- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/features/reports/ReportsPlaceholder.tsx`
- `frontend/src/features/reports/reportQueries.ts`
- `frontend/src/api/reports.ts`
- `frontend/src/api/types.ts`
- `frontend/src/api/history.ts`
- `frontend/src/api/sales.ts`
- `frontend/src/api/returns.ts`
- `frontend/src/api/orders.ts`
- `frontend/src/api/customers.ts`
- `frontend/src/api/inventory.ts`
- `frontend/src/features/history/HistoryListPage.tsx`
- `frontend/src/features/history/historyPresentation.ts`
- `frontend/src/tests/appTestHarness.ts`
- `frontend/src/app/router.tsx`

Backend:

- `backend/app/api/routes/reports.py`
- `backend/app/application/reporting_service.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/schemas/reports.py`
- `backend/app/api/routes/history.py`
- `backend/app/application/history_service.py`
- `backend/app/schemas/history.py`
- `backend/app/api/routes/sales.py`
- `backend/app/api/routes/returns.py`
- `backend/app/api/routes/orders.py`
- `backend/app/api/routes/customers.py`
- `backend/app/api/routes/inventory.py`
- `backend/tests/api/test_reports_api.py`
- `backend/tests/integration/test_reports_postgres.py`

Docs:

- `docs/OPERATIONAL_CRUD_BATCH5_REPORTING_IMPLEMENTATION.md`
- `docs/HISTORY_MODULE_INVESTIGATION.md`
- `docs/FRONTEND_FOUNDATION_INVESTIGATION.md`
- `docs/FEATURE_PARITY_CORE_MODULES_INVESTIGATION.md`

Note:

- `codegraph` is not initialized in this repo, so this investigation used direct file inspection instead of `codegraph_*` tools.

## Current Frontend Dashboard / Reports Surfaces

### Dashboard page

`frontend/src/features/dashboard/DashboardPage.tsx`

Current behavior:

- Calls `useDashboardSummary()`
- Renders 6 cards:
  - `Doanh thu hôm nay`
  - `Doanh thu tháng này`
  - `Công nợ hiện tại`
  - `Khách còn nợ`
  - `Hóa đơn hôm nay`
  - `Trả hàng hôm nay`

Limitations:

- no chart
- no top sellers
- no recent activity
- no date preset switching
- no return count card
- no hourly / weekday revenue view

### Reports page

`frontend/src/features/reports/ReportsPlaceholder.tsx`

Current behavior:

- `Sales summary` with date range and `by_day` table
- `Returns summary` with date range and `by_day` table
- `Customer debt` table
- `Inventory summary` table

Limitations:

- still a placeholder-style page, not a consolidated operational overview
- no charts
- no top sellers
- no dashboard-oriented preset switching
- no recent-activity feed

### History page

`frontend/src/features/history/HistoryListPage.tsx`

Current behavior:

- unified cross-module operational history
- filters:
  - date range
  - transaction type
  - customer
  - product
  - keyword/code
- includes event types:
  - `SALES_INVOICE`
  - `RETURN_INVOICE`
  - `DEBT_PAYMENT`
  - `BALANCE_ADJUSTMENT`
  - `STOCK_MOVEMENT`
  - `ORDER`

This is the strongest existing candidate for `Hoạt động gần đây`.

## Existing APIs

### Reporting endpoints

Already implemented under `/api/reports`:

1. `GET /api/reports/dashboard-summary`
   - fields:
     - `total_products`
     - `total_customers`
     - `total_customer_debt`
     - `total_inventory_items`
     - `today_sales_total`
     - `month_sales_total`
     - `today_return_total`
     - `month_return_total`
     - `invoice_count_today`
     - `positive_debt_customer_count`

2. `GET /api/reports/customer-debts`
   - rows of customer debt, sorted descending by current balance

3. `GET /api/reports/inventory-summary`
   - product identity, active state, unit mode, canonical balance, prices

4. `GET /api/reports/sales-summary?date_from=&date_to=`
   - aggregate:
     - `total_sales`
     - `total_paid`
     - `invoice_count`
     - `average_invoice_total`
   - time bucket:
     - `by_day[]`

5. `GET /api/reports/returns-summary?date_from=&date_to=`
   - aggregate:
     - `total_returns`
     - `return_count`
   - time bucket:
     - `by_day[]`

### History endpoint

Already implemented:

6. `GET /api/history`
   - filters:
     - `date_from`
     - `date_to`
     - `event_type`
     - `customer_id`
     - `product_id`
     - `search`
     - `page`
     - `page_size`
   - normalized event payload:
     - datetime
     - code
     - customer
     - product
     - amount
     - quantity
     - status
     - note
     - open target

### Sales / returns / orders / customers / inventory read APIs relevant to overview work

Already implemented:

7. `GET /api/sales/invoices`
   - filters:
     - `customer_id`
     - `search`
     - `date_from`
     - `date_to`
   - includes invoice items with:
     - `product_id`
     - `product_code_snapshot`
     - `product_name_snapshot`
     - `quantity`
     - `unit_price`
     - `line_total`

8. `GET /api/returns`
   - filters:
     - `customer_id`
     - `search`
     - `date_from`
     - `date_to`
   - includes return items with:
     - `product_id`
     - `product_code_snapshot`
     - `product_name_snapshot`
     - `quantity`
     - `unit_price`
     - `line_total`

9. `GET /api/orders`
   - active orders list

10. `GET /api/orders/{id}`
   - order detail exists in backend/client

11. `GET /api/orders/quantity-summary`
   - active-order quantity summary by product/unit

12. `GET /api/customers`
   - supports `only_positive_debt`

13. `GET /api/customers/{id}/ledger`
   - customer-scoped debt/balance history

14. `GET /api/customers/{id}/debt-payments`
   - customer-scoped payments

15. `GET /api/inventory/products`
   - product list with prices and current balance

16. `GET /api/inventory/products/{id}/movements`
   - product-scoped inventory movement feed

## Which Metrics Can Be Built From Existing APIs?

### Directly available now

These are already available without backend changes:

- `Kết quả bán hàng hôm nay`
  - `số hóa đơn`
    - from `dashboard-summary.invoice_count_today`
    - or `sales-summary` for today
  - `doanh thu`
    - from `dashboard-summary.today_sales_total`
    - or `sales-summary` for today
  - `tổng tiền trả hàng`
    - from `dashboard-summary.today_return_total`
    - or `returns-summary` for today

- `Doanh thu theo thời gian`
  - `hôm nay`
    - from `sales-summary` with today range
  - `hôm qua`
    - from `sales-summary` with yesterday range
  - `7 ngày qua`
    - from `sales-summary` with 7-day range
  - `tháng này`
    - from `dashboard-summary.month_sales_total`
    - or `sales-summary` with month range
  - `tháng trước`
    - from `sales-summary` with previous-month range
  - `theo ngày`
    - from `sales-summary.by_day`

- `Hoạt động gần đây`
  - `bán hàng`
  - `trả hàng`
  - `nhập/xuất/điều chỉnh kho`
  - `đặt hàng`
    - all already available from `GET /api/history`

### Available indirectly, but not ideal

These can be built with current APIs, but would be a poor production design:

- `Top hàng bán chạy` sorted by `doanh thu`
  - possible by fetching `GET /api/sales/invoices` for a date range and aggregating invoice items client-side by:
    - `product_id`
    - `product_name_snapshot`
    - `line_total`
  - problems:
    - no pagination contract on invoices for analytics-style scans
    - client-side aggregation duplicates backend work
    - likely to degrade on larger datasets

### Not available yet

These are not available from current APIs in a strong way:

- `Kết quả bán hàng hôm nay -> số phiếu trả hàng`
  - not in `dashboard-summary`
  - available only if frontend makes a separate `returns-summary(today)` call
  - so:
    - possible in UI composition
    - missing from the existing one-call dashboard payload

- `Doanh thu theo thời gian -> theo giờ`
  - no hourly bucket API

- `Doanh thu theo thời gian -> theo thứ`
  - no weekday bucket API

- `Top hàng bán chạy` with server-side period filter and sorting
  - no dedicated backend endpoint

## Available Data / API Map

| Target area | Current source | What it already gives |
| --- | --- | --- |
| Dashboard cards | `GET /api/reports/dashboard-summary` | Today/month sales, today/month returns, today invoice count, debt and count metrics |
| Sales over date range | `GET /api/reports/sales-summary` | Totals plus daily buckets |
| Returns over date range | `GET /api/reports/returns-summary` | Totals plus daily buckets |
| Customer debt | `GET /api/reports/customer-debts`, `GET /api/customers?only_positive_debt=true` | Debt rows and customer-level balances |
| Inventory snapshot | `GET /api/reports/inventory-summary`, `GET /api/inventory/products` | Product snapshot, prices, current balance |
| Recent activity | `GET /api/history` | Unified feed across sales, returns, debt, stock, orders |
| Sales line data for top sellers | `GET /api/sales/invoices` | Per-item `line_total`, quantity, product snapshot |
| Returns line data | `GET /api/returns` | Per-item `line_total`, quantity, product snapshot |
| Open orders demand | `GET /api/orders/quantity-summary` | Product/unit quantity requested in active orders |
| Inventory movement detail | `GET /api/inventory/products/{id}/movements` | Product-scoped movement stream |

## Which Backend Endpoints Are Missing?

### Missing for the target overview UI

Recommended missing backend pieces:

1. A richer overview endpoint
   - either extend `GET /api/reports/dashboard-summary`
   - or add something like `GET /api/reports/overview`
   - should include at least:
     - today invoice count
     - today sales revenue
     - today return count
     - today return total
     - optionally yesterday / 7-day / month metrics in one payload

2. Sales time-series analytics endpoint with granularity
   - suggested shape:
     - `GET /api/reports/sales-timeseries?period=today|yesterday|last_7_days|this_month|last_month&granularity=hour|day|weekday`
   - current `sales-summary` only supports daily buckets

3. Top products / top sellers endpoint
   - suggested shape:
     - `GET /api/reports/top-products?metric=revenue&period=...&limit=...`
   - should aggregate from invoice items server-side

### Not strictly missing because existing APIs can cover them

These do not require a new backend endpoint immediately:

- recent activity feed
  - can already use `GET /api/history`
- separate customer-debt and inventory widgets
  - already covered by report endpoints

### Partial gaps / caveats

- order activity exists in `/api/history`, but current frontend `resolveHistoryOpenLink()` intentionally does not open order details
- inventory movements are globally available through `/api/history`, but product-scoped detail still uses `/inventory/products/{id}/movements`
- there is no dedicated backend analytics endpoint for combined sales-vs-returns net revenue

## Recommended Implementation Batches

### Batch 1: Overview payload shaping

Goal:

- keep current dashboard simple
- avoid client-side N-call composition for core cards

Backend:

- extend existing dashboard summary or add `GET /api/reports/overview`
- include:
  - today invoice count
  - today sales total
  - today return count
  - today return total
  - 7-day / this-month / last-month pre-aggregates if desired

Frontend:

- replace current 6-card dashboard with the target `Kết quả bán hàng hôm nay` block

### Batch 2: Revenue over time

Goal:

- support `hôm nay`, `hôm qua`, `7 ngày qua`, `tháng này`, `tháng trước`
- add chart-ready buckets

Backend:

- add timeseries endpoint with granularity
- start with:
  - `day`
  - `hour`
- optionally add:
  - `weekday`

Frontend:

- add preset filters and chart/table toggle

### Batch 3: Top hàng bán chạy

Goal:

- backend-owned aggregation

Backend:

- add top-products endpoint
- sort by revenue first
- support period filter and limit

Frontend:

- top-products card/table
- preset period switch

### Batch 4: Hoạt động gần đây

Goal:

- reuse existing `history` backend rather than create another feed

Frontend:

- add a compact recent-activity panel fed from `/api/history`
- restrict to:
  - `SALES_INVOICE`
  - `RETURN_INVOICE`
  - `STOCK_MOVEMENT`
  - `ORDER`
- show latest N items

Optional follow-up:

- add order deep-link support once order detail route exists in frontend

### Batch 5: Polish and parity

Goal:

- dashboard/report cohesion and operator ergonomics

Potential work:

- net sales after returns
- export actions
- empty-state and loading polish
- read-only role UX polish
- consistency with KiotViet/desktop density

## Legacy / Desktop / KiotViet Findings

What I found:

- `docs/FRONTEND_FOUNDATION_INVESTIGATION.md` explicitly says dashboard could be a placeholder until reporting APIs existed.
- `docs/OPERATIONAL_CRUD_BATCH5_REPORTING_IMPLEMENTATION.md` describes the current reporting foundation as small read-only endpoints for cards/tables, not a parity-complete overview module.
- `docs/HISTORY_MODULE_INVESTIGATION.md` is the strongest desktop/KiotViet-like behavioral reference found in the repo, but it is for History, not Dashboard.
- `docs/FEATURE_PARITY_CORE_MODULES_INVESTIGATION.md` explicitly keeps reporting/dashboard parity out of scope except for direct metric implications.

What I did not find:

- no checked-in old desktop dashboard source
- no repo-local desktop `Tổng quan` metric spec
- no implemented KiotViet-like overview behavior beyond generic design-density references

Conclusion:

- there is no concrete old desktop dashboard implementation in this repo to copy directly
- implementation should be guided by:
  - current backend data realities
  - existing history-module normalization patterns
  - the target UI requirements in this task

## Mojibake / Broken Vietnamese Findings

Safety rule handling:

- I did not modify source files in this investigation.
- I interpreted broken text once for analysis and continued the main task.

Manual repair items encountered during investigation:

| File | Line | Current broken text | Intended text |
| --- | --- | --- | --- |
| `frontend/src/features/history/HistoryListPage.tsx` | 65 | `KhÃ´ng thá»ƒ táº£i lá»‹ch sá»­ giao dá»‹ch.` | `Không thể tải lịch sử giao dịch.` |
| `frontend/src/features/history/HistoryListPage.tsx` | 105 | `mặt hàng` text shown as mojibake | `mặt hàng` |
| `frontend/src/features/history/HistoryListPage.tsx` | 128 | `Lá»‹ch sá»­` | `Lịch sử` |
| `frontend/src/features/history/HistoryListPage.tsx` | 129 | `Theo dÃµi toÃ n bá»™...` | `Theo dõi toàn bộ...` |
| `frontend/src/features/history/HistoryListPage.tsx` | 132 | `Bá»™ lá»c lá»‹ch sá»­` | `Bộ lọc lịch sử` |
| `frontend/src/features/history/HistoryListPage.tsx` | 163 | `Tá»« ngÃ y` | `Từ ngày` |
| `frontend/src/features/history/HistoryListPage.tsx` | 173 | `Äáº¿n ngÃ y` | `Đến ngày` |
| `frontend/src/features/history/HistoryListPage.tsx` | 183 | `KhÃ¡ch hÃ ng` | `Khách hàng` |
| `frontend/src/features/history/HistoryListPage.tsx` | 198 | `Sáº£n pháº©m` | `Sản phẩm` |
| `frontend/src/features/history/HistoryListPage.tsx` | 221 | `TÃ¬m kiáº¿m` | `Tìm kiếm` |
| `frontend/src/features/history/historyPresentation.ts` | 4 | `Táº¥t cáº£ giao dá»‹ch` | `Tất cả giao dịch` |
| `frontend/src/features/history/historyPresentation.ts` | 5 | `HÃ³a Ä‘Æ¡n bÃ¡n hÃ ng` | `Hóa đơn bán hàng` |
| `frontend/src/features/history/historyPresentation.ts` | 6 | `Phiáº¿u tráº£ hÃ ng` | `Phiếu trả hàng` |
| `frontend/src/features/history/historyPresentation.ts` | 7 | `Thanh toÃ¡n cÃ´ng ná»£` | `Thanh toán công nợ` |
| `frontend/src/features/history/historyPresentation.ts` | 8 | `Äiá»u chá»‰nh cÃ´ng ná»£` | `Điều chỉnh công nợ` |
| `frontend/src/features/history/historyPresentation.ts` | 9 | `Biáº¿n Ä‘á»™ng tá»“n kho` | `Biến động tồn kho` |
| `frontend/src/features/history/historyPresentation.ts` | 37-43 | status labels shown as mojibake | `Đang mở`, `Đã hoàn thành`, `Đã chuyển bán`, `Xuất bán`, `Nhập trả`, `Tăng tồn`, `Giảm tồn`, `Đặt tồn` |

## No-Code-Change Confirmation

This task was investigation only.

- No application source code was changed.
- No backend endpoint was implemented.
- No frontend page was implemented.
- Only this investigation document was added.
