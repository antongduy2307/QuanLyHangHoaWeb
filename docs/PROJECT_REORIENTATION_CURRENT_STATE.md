# PROJECT REORIENTATION CURRENT STATE

Ngày khảo sát: 2026-06-29  
Repository: `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb`  
Branch: `main`

## Phạm vi và cảnh báo rất quan trọng

Tài liệu này được viết theo trạng thái **thực tế hiện có trong repo hiện tại**, không theo giả định của brief cũ.

Điểm cần hiểu ngay:

- Repo này **không còn là desktop app Qt/PyInstaller/Inno Setup**.
- Repo hiện tại là **web migration** gồm:
  - `backend/`: FastAPI + SQLAlchemy + Alembic + PostgreSQL
  - `frontend/`: React + TypeScript + Vite
- Desktop app gốc được tham chiếu như nguồn hành vi legacy ở thư mục ngoài repo này:
  - `../QuanLyHangHoa/`
- Nhiều mục trong brief như `core/version.py`, `version.json`, `desktop_app.spec`, `installer/QuanLyHangHoa.iss`, `.github/workflows/*.yml`, `QApplication`, `app.db` runtime, `attendance.db` runtime, auto-update manifest hiện **không tồn tại trong repo web hiện tại**.
- Vì vậy, các phần dưới đây luôn phân biệt rõ:
  - `Implemented in this repo`
  - `Legacy source only`
  - `Missing / deferred / not applicable`

---

## PART A - EXECUTIVE SUMMARY

### 1. Ứng dụng này là gì

`QuanLyHangHoaWeb` là dự án web migration của hệ thống `QuanLyHangHoa`. Mục tiêu là đưa các nghiệp vụ hàng hóa, khách hàng, bán hàng, trả hàng, đặt hàng, chấm công và báo cáo từ ứng dụng desktop cũ sang stack web hiện đại, tập trung dữ liệu vào PostgreSQL.

Hiện trạng không còn là skeleton ban đầu nữa. Repo đã có:

- backend API có auth, inventory, customers, sales, returns, orders, attendance, history, reports;
- frontend admin shell có route bảo vệ, dashboard, inventory, customers, sales, returns, orders, attendance, settings, reports;
- import/rehearsal tooling để đọc desktop `app.db`;
- dry-run tooling để khảo sát legacy `attendance.db`.

### 2. Kiến trúc hiện tại

Kiến trúc đang theo mô hình tách lớp khá rõ:

- HTTP/API: `backend/app/api/routes/*`
- application services: `backend/app/application/*`
- domain enums/rules/value semantics: `backend/app/domain/*`
- persistence models + repositories: `backend/app/infrastructure/db/models/*`, `repositories/*`
- migration layer: `backend/alembic/*`
- frontend pages/queries/API client: `frontend/src/features/*`, `frontend/src/api/*`

Không còn startup flow kiểu desktop (`QApplication`, `AppWindow`, tab Qt). Startup hiện tại là:

- backend FastAPI app tạo trong `backend/app/main.py`
- frontend React boot từ `frontend/src/main.tsx`

### 3. Version / release state hiện tại

Repo chưa có cơ chế release hoàn chỉnh cho production.

- root `README.md` vẫn nói một số module chưa xong, nhưng code thực tế đã đi xa hơn README.
- `backend/pyproject.toml`: version `0.1.0`
- `frontend/package.json`: version `0.1.0`
- không có version manifest ở root;
- không có auto-update manifest;
- không có CI/release workflow trong `.github/`;
- không có packaged Windows installer trong repo này.

Kết luận: version hiện tại là **version source-code level**, chưa phải release artifact level.

### 4. Những tính năng quan trọng đã có

Các phần đã có code + test khá chắc trong repo này:

- Inventory/product CRUD với active/inactive, reactivation, price/unit validation, stock adjustments.
- Customer CRUD, ledger công nợ, debt payment create/edit/delete, recompute balance.
- Sales invoices đầy đủ create/update/delete, stock decrease, customer ledger effects, imported-code collision avoidance.
- Returns create/update/delete, quick return / linked return, refund/store-credit logic, stock rollback/reapply.
- Orders top-level page, summary, prepared/open/converted flow, sales-from-order conversion.
- History unified feed với filter, pagination, drawer/open-link mapping.
- Dashboard overview, sales timeseries, top products, recent activity.
- Attendance employees, day entry, CUT product linking, BLOW extra CUT/VK, attendance inventory effects, settings editor, diagnostics, reports.
- Import rehearsal cho desktop `app.db`.

### 5. Những vùng unfinished / risky / dễ hiểu sai

- README và một số docs tổng quan đã cũ hơn code; không được dùng README làm source duy nhất.
- Không có CI/CD thật trong repo; mọi xác nhận chất lượng đang dựa vào test local/doc batch notes.
- Release packaging, deployment, backup/restore production, auth admin UI, user/role management UI vẫn thiếu.
- Attendance legacy import từ `attendance.db` mới dừng ở dry-run/investigation; chưa có importer production-grade.
- Frontend test suite hiện không hoàn toàn xanh:
  - `npm.cmd test -- --run` fail 1 test ở `src/features/settings/SettingsPage.test.tsx`
- Backend compile check hiện vấp lỗi quyền ghi `__pycache__` trong `tests/`, không phải lỗi cú pháp source.
- Một số docs vẫn nói reporting/orders/attendance “deferred”, nhưng code hiện đã implemented đáng kể. Khi handoff, phải ưu tiên **code + tests mới nhất**.

### 6. Điều bắt buộc phải hiểu trước khi sửa code

1. Đây là **repo web**, không phải desktop repo.
2. Desktop app cũ chỉ là **read-only legacy reference**, không được sửa từ repo này.
3. Runtime database hiện tại là **PostgreSQL**, không phải SQLite.
4. `app.db` và `attendance.db` chỉ còn là **legacy import sources**.
5. Inventory, customer debt, sales, returns đang có nhiều rule được khóa bằng test service/API.
6. Attendance đã tích hợp với inventory qua `attendance_inventory_effects`.
7. Active/inactive/historical-preservation là pattern xuyên suốt; nhiều chỗ không hard-delete nếu có history.
8. Frontend route shell và page organization đã lớn; sửa UX cần kiểm tra cả query invalidation và historical merge behavior.
9. Báo cáo/docs cũ có thể lệch trạng thái thật; phải đọc source/test trước khi kết luận.
10. Không có release pipeline chính thức, nên mọi thay đổi có nguy cơ làm mơ hồ trạng thái ship-ready.

### Read This First - 10 fact quan trọng nhất

1. Runtime app hiện tại = FastAPI + React, không còn Qt desktop runtime.
2. Repo này không có `core/version.py`, `version.json`, installer, hay GitHub Actions workflow.
3. DB chính hiện tại là PostgreSQL qua `DATABASE_URL`, local Docker mapping `localhost:5433`.
4. `backend/app/main.py` đã mount đầy đủ routes: auth, attendance, history, inventory, customers, orders, sales, returns, reports.
5. `frontend/src/app/router.tsx` đã expose dashboard + attendance + settings + inventory + customers + sales + orders + returns + reports.
6. Inventory/product delete dùng chiến lược `hard_deleted` hoặc `deactivated` tùy có history.
7. Customer debt là ledger-driven; không sửa `current_balance` trực tiếp nếu là nghiệp vụ công nợ.
8. Attendance CUT product linking và attendance inventory effects là phần mới nhưng đã có test backend rõ ràng.
9. Import từ desktop `app.db` có runbook và JSON proof artifacts; attendance import chưa hoàn tất.
10. Kiểm thử local hiện cho thấy backend pytest xanh, frontend build/lint xanh, frontend test còn 1 fail, compileall dính permission issue.

---

## PART B - CURRENT REPO / VERSION / RELEASE STATE

### Repo / branch

- Current branch: `main`

### Version files thực tế

| Item | Trạng thái |
| --- | --- |
| `core/version.py` | Không tồn tại |
| `version.json` | Không tồn tại |
| `backend/pyproject.toml` | `0.1.0` |
| `frontend/package.json` | `0.1.0` |

Kết luận:

- Không có cặp version desktop-style để so khớp.
- `backend` và `frontend` đều đang dùng `0.1.0`, nhưng đây là package version nội bộ, chưa đủ để suy ra release người dùng cuối.

### installer_url / update manifest

- Không có `version.json`
- Không có `installer_url`
- Không có auto-update manifest nào trỏ về `antongduy2307/QuanLyHangHoa`

### `.github/workflows/ci.yml` / `release.yml`

- `.github/` hiện không có file workflow nào.
- `ci.yml`: không tồn tại
- `release.yml`: không tồn tại

### `desktop_app.spec`, `installer/QuanLyHangHoa.iss`, `scripts/`

- `desktop_app.spec`: không tồn tại
- `installer/QuanLyHangHoa.iss`: không tồn tại
- root `scripts/`: không tồn tại
- script liên quan hiện có:
  - `backend/scripts/attendance_import_dry_run.py`

### Build / release hiện tại được làm như thế nào

#### Backend

- dependency/tooling: `backend/pyproject.toml`
- chạy app local thường qua `uvicorn` hoặc test stack
- schema được quản lý bằng Alembic

#### Frontend

- build command:
  - `npm.cmd run build`
- dev command:
  - `npm.cmd run dev`

#### Database runtime

- local PostgreSQL từ `docker-compose.yml`
- default host port: `5433`

### Trước khi release thực sự phải kiểm tra gì

- có CI workflow hay chưa;
- frontend tests có còn fail không;
- backend compile/check permission issue đã được xử lý chưa;
- env production (`AUTH_SECRET_KEY`, `AUTH_BYPASS`, CORS) đã được harden chưa;
- deployment plan, backup/restore, migration cutover, auth admin flows đã đủ chưa.

### Rủi ro version/release hiện tại

- Không có release manifest chuẩn.
- Không có automated CI/release evidence.
- Không có cách nhìn repo để biết “user version đang deploy” một cách chắc chắn.
- README tổng quan có thể lạc hậu so với code thật.

### Exact deployed user version có detect được từ repo không

- Không.
- Repo chỉ cho biết source version `0.1.0` ở backend/frontend package metadata.
- Không có artifact manifest, tag policy, release workflow hay installer metadata để xác định chính xác deployed version.

---

## PART C - PROJECT ARCHITECTURE MAP

### Cấu trúc lớn

| Folder | Trách nhiệm | Không nên đụng hời hợt |
| --- | --- | --- |
| `backend/app/main.py` | tạo FastAPI app, CORS, mount routes | thay route registration / middleware mà không retest toàn bộ API |
| `backend/app/core/` | settings, security, exceptions | auth/CORS/env validation |
| `backend/app/api/` | route layer, deps, schema binding | quyền truy cập, response contracts |
| `backend/app/application/` | business logic chính | inventory/customer ledger/sales/returns/attendance rules |
| `backend/app/domain/` | enums, value semantics, policy constants | unit/payment/attendance semantics |
| `backend/app/infrastructure/db/` | SQLAlchemy models, repositories, session | table shape, query ordering, FK semantics |
| `backend/alembic/` | migrations | historical schema compatibility |
| `backend/tests/` | regression proof | không được bỏ qua khi sửa business logic |
| `backend/scripts/` | import dry-run utility | logic điều tra attendance import |
| `frontend/src/app/` | router, providers, query client | route structure, auth shell |
| `frontend/src/auth/` | login, token refresh, role guard | auth bypass và refresh behavior |
| `frontend/src/api/` | typed client + API types | payload/response contract |
| `frontend/src/features/` | page-level business UI | query invalidation, historical inactive preservation |
| `frontend/src/layouts/` | shell layout | route-dependent layout switching |
| `frontend/src/tests/` | frontend harness/test utilities | shared harness semantics |
| `docs/` | milestone notes, investigation, runbooks | docs cũ có thể lệch trạng thái thật |

### Những file quan trọng nhất

- Backend:
  - `backend/app/main.py`
  - `backend/app/core/config.py`
  - `backend/app/infrastructure/db/session.py`
  - `backend/app/application/inventory_service.py`
  - `backend/app/application/customer_service.py`
  - `backend/app/application/sales_service.py`
  - `backend/app/application/return_service.py`
  - `backend/app/application/order_service.py`
  - `backend/app/application/attendance_service.py`
  - `backend/app/application/attendance_inventory_service.py`
  - `backend/app/application/attendance_inventory_diagnostic_service.py`

- Frontend:
  - `frontend/src/app/router.tsx`
  - `frontend/src/layouts/AdminLayout.tsx`
  - `frontend/src/features/dashboard/DashboardPage.tsx`
  - `frontend/src/features/attendance/AttendancePage.tsx`
  - `frontend/src/features/settings/SettingsPage.tsx`
  - `frontend/src/features/reports/ReportsPlaceholder.tsx`

### Startup flow thực tế

#### Backend startup

1. `backend/app/main.py` gọi `create_app()`.
2. `get_settings()` đọc env qua `backend/app/core/config.py`.
3. Tạo `FastAPI(title=settings.app_name)`.
4. `register_error_handlers(app)`.
5. Mount `CORSMiddleware` với `settings.cors_origins`.
6. Include routers:
   - health
   - auth
   - attendance
   - history
   - inventory
   - customers
   - orders
   - sales
   - returns
   - reports

#### DB initialization

1. `backend/app/infrastructure/db/session.py` tạo `engine = create_engine(settings.database_url, pool_pre_ping=True)`.
2. `SessionLocal = sessionmaker(...)`.
3. Request-level session cấp qua dependency `get_db_session()` / `get_session`.
4. Schema migration không auto-create kiểu desktop; thay vào đó dùng Alembic.

#### Frontend startup

1. `frontend/src/main.tsx` boot React app.
2. Providers/query client/auth provider được mount qua `frontend/src/app/providers.tsx`.
3. Router lấy từ `frontend/src/app/router.tsx`.
4. Route guard dùng `RequireAuth` và `RequireRole`.

#### Layout / page construction

- `AdminLayout.tsx` quyết định route nào dùng full-bleed page thay vì shell sidebar/topbar.
- Một số route như inventory redesign, sales detail, orders, customers, history dùng full-bleed content.

#### Update check startup flow

- Không có auto-update startup flow trong repo web này.

#### Điều không còn áp dụng

- Không có `QApplication`
- Không có `bootstrap` kiểu desktop shell
- Không có `AppWindow`
- Không có Qt tab/page construction

---

## PART D - DATABASE / STORAGE STATE

### Kiến trúc DB hiện tại

Repo web hiện tại dùng **một PostgreSQL database tập trung**.

Runtime DB:

- `DATABASE_URL`
- mặc định local:
  - `postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web`

Legacy source DB chỉ còn dùng cho import / investigation:

- desktop `app.db`
- desktop `attendance.db`

### Code liên quan

- `backend/app/core/config.py`
- `backend/app/infrastructure/db/session.py`
- `backend/alembic/*`
- `backend/scripts/attendance_import_dry_run.py`

### Path dùng trong dev

- PostgreSQL local qua `docker-compose.yml`
- host port `5433`
- DB name mặc định `quanlyhanghoa_web`

### Path dùng cho installed Windows app

- Không áp dụng trong repo này.
- Không có packaged installed-app runtime path được định nghĩa trong source hiện tại.

### Engine / session cache

- `get_settings()` có `@lru_cache(maxsize=1)`
- `session.py` giữ module-level `engine`, `SessionLocal`, `settings`
- `reset_engine()` dispose engine cũ rồi rebind sessionmaker

### Migration / schema creation behavior

- schema do Alembic quản lý;
- test PostgreSQL dùng `alembic upgrade head` trong `backend/tests/conftest.py`;
- không còn mô hình “app start lên thì tự tạo hết SQLite schema” như desktop.

### Cách tìm DB path trong dev

- xem `DATABASE_URL` ở env hoặc `.env.example`
- xem `docker-compose.yml`
- local default là `localhost:5433/quanlyhanghoa_web`

### Cách tìm DB path cho installed Windows app

- Không có vì repo này chưa có packaged installer/runtime.

### Reset / cache caveats

- đổi `DATABASE_URL` cần clear cache settings nếu process đang sống;
- test PostgreSQL dùng env `TEST_DATABASE_URL`, nếu thiếu sẽ skip integration tests;
- backend pytest warning hiện cho thấy `.pytest_cache` có thể không ghi được trong workspace.

### Backup / restore implications

- Production web sau này phải backup PostgreSQL, không chỉ source SQLite.
- Trong giai đoạn cutover, cần backup cả:
  - desktop `app.db`
  - desktop `attendance.db`
  - target PostgreSQL

### Vì sao restore chỉ một DB là nguy hiểm

- Legacy source hiện tách `app.db` và `attendance.db`, nhưng web target đang gom logic vào PostgreSQL.
- Nếu cutover/import attendance và core data không cùng snapshot thời điểm, attendance inventory effects và product links có thể lệch.
- Restore chỉ `app.db` hoặc chỉ `attendance.db` của desktop sẽ không đảm bảo cross-module consistency cho migration planning.

---

## PART E - DATA MODEL AND SCHEMA SUMMARY

### Main business tables trong PostgreSQL

| File | Class | Table | Key fields | Notes |
| --- | --- | --- | --- | --- |
| `backend/app/infrastructure/db/models/inventory.py` | `Product` | `products` | `product_code_base`, `product_name`, `unit_mode`, `is_active` | unique code, active/inactive instead of always delete |
| same | `ProductPrice` | `product_prices` | `product_id`, `unit_type`, `price`, `is_enabled` | unique `(product_id, unit_type)` |
| same | `InventoryBalance` | `inventory_balances` | `product_id`, `on_hand_bao_decimal`, `on_hand_bich_integer` | exactly one quantity column active |
| same | `StockAdjustment` | `stock_adjustments` | `product_id`, `movement_type`, `unit_type`, `quantity_delta`, `balance_after` | audit trail for stock mutations |
| `backend/app/infrastructure/db/models/customer.py` | `Customer` | `customers` | `customer_name`, `current_balance`, `total_sales`, `is_walk_in`, `is_active` | balance derived by service |
| same | `DebtPayment` | `debt_payments` | `customer_id`, `amount`, `payment_datetime`, `is_deleted` | soft delete via `is_deleted` |
| same | `CustomerBalanceLedger` | `customer_balance_ledgers` | `customer_id`, `event_type`, `ref_type`, `ref_id`, `amount_delta`, `balance_after`, `transaction_datetime`, `display_order` | canonical debt history |
| `backend/app/infrastructure/db/models/sales.py` | `Invoice` | `invoices` | `invoice_code`, `customer_id`, `invoice_datetime`, `total_amount`, `paid_amount`, `status` | unique invoice code |
| same | `InvoiceItem` | `invoice_items` | `invoice_id`, `product_id`, `unit_type`, `quantity`, `unit_price`, `line_total` | snapshots product code/name |
| `backend/app/infrastructure/db/models/returns.py` | `ReturnInvoice` | `return_invoices` | `return_code`, `source_invoice_id`, `customer_id`, `handling_mode`, `return_datetime` | quick vs linked return |
| same | `ReturnInvoiceItem` | `return_invoice_items` | `return_invoice_id`, `source_invoice_item_id`, `product_id`, `unit_type`, `quantity` | snapshot-based |
| `backend/app/infrastructure/db/models/orders.py` | `OrderRequest` | `order_requests` | `order_code`, `customer_id`, `status`, `source_invoice_id` | states `OPEN`, `PREPARED`, `CONVERTED` |
| same | `OrderRequestItem` | `order_request_items` | `order_request_id`, `product_id`, `unit_type`, `quantity` | no stock effect directly |

### Attendance tables trong PostgreSQL

| File | Class | Table | Key fields | Notes |
| --- | --- | --- | --- | --- |
| `backend/app/infrastructure/db/models/attendance.py` | `AttendanceEmployee` | `attendance_employees` | `display_name`, `team`, `is_active`, `user_id`, `legacy_employee_id` | unique display_name |
| same | `AttendancePeriod` | `attendance_periods` | `start_date`, `end_date`, `locked`, `legacy_period_id` | period lock blocks edits |
| same | `AttendanceDailyRecord` | `attendance_daily_records` | `employee_id`, `work_date`, `period_id`, `status`, `is_absent`, `total_amount_snapshot` | unique employee/date |
| same | `AttendanceWorkType` | `attendance_work_types` | `name`, `input_type`, `pricing_rule`, `quota_quantity`, `unit_price`, `exclusive_group`, `is_active` | BLOW-only config |
| same | `AttendanceWorkLog` | `attendance_work_logs` | `daily_record_id`, `work_type_id`, `quantity`, `unit_price_snapshot`, `amount_snapshot` | unique per record/work_type |
| same | `AttendanceBagType` | `attendance_bag_types` | `name`, `product_id`, `quota_quantity`, `excess_unit_price`, `is_product_linked`, `is_excluded_from_attendance`, `is_legacy`, `is_active` | product-linked CUT config |
| same | `AttendanceCutLog` | `attendance_cut_logs` | `daily_record_id`, `bag_type_id`, `quantity`, `quota_quantity_snapshot`, `excess_unit_price_snapshot` | unique per record/bag_type |
| same | `AttendanceExtraCutLog` | `attendance_extra_cut_logs` | `daily_record_id`, `bag_type_id`, `quantity`, `excess_unit_price_snapshot` | BLOW extra CUT/VK |
| same | `AttendanceInventoryEffect` | `attendance_inventory_effects` | `daily_record_id`, `cut_log_id` xor `extra_cut_log_id`, `product_id`, `quantity_delta`, `unit_type` | attendance -> inventory bridge |

### Soft delete / deactivate / compatibility notes

- `Product`: deactivate when history exists; reactivate only if identity still matches.
- `Customer`: deactivate when history exists.
- `DebtPayment`: soft delete via `is_deleted`.
- `AttendanceEmployee`: delete may degrade to deactivate depending on history.
- `AttendanceWorkType` / `AttendanceBagType`: historical readability preserved; active/excluded/legacy flags control new-entry availability.
- Legacy compatibility fields exist heavily in attendance:
  - `legacy_employee_id`
  - `legacy_period_id`
  - `legacy_daily_record_id`
  - `legacy_work_type_id`
  - `legacy_bag_type_id`

---

## PART F - FEATURE STATUS MATRIX

| Feature / Area | Status | Main files | Main docs | Main tests | Notes / caveats |
| --- | --- | --- | --- | --- | --- |
| Inventory/product CRUD | Implemented | `backend/app/application/inventory_service.py`, `frontend/src/features/inventory/*` | `docs/FEATURE_PARITY_ACCEPTANCE_CHECKLIST.md` | `backend/tests/service/test_inventory_service.py`, `frontend/src/features/inventory/ProductPages.test.tsx` | Code + tests solid |
| Product reactivation on recreate same code/name | Implemented | inventory service | parity checklist | inventory service tests | same inactive identity only |
| Product active/inactive handling | Implemented | inventory service, product pages | parity checklist, UI redesign docs | inventory service tests | hidden by default unless include inactive |
| Inventory receipts | Deferred | none as dedicated receipt model | legacy-oriented docs only | none | stock handled via `stock_adjustments`, no receipt document model |
| Inventory adjustments | Implemented | inventory service | parity checklist | inventory service tests | includes `STOCK_INCREASE`, `STOCK_DECREASE`, `STOCK_SET` |
| Product multi-delete | Pending | no confirmed code | none | none | not found in current repo |
| Sales invoices | Implemented | sales service, sales routes/pages | sales batch docs | sales service/api/frontend tests | strong coverage |
| Returns | Implemented | return service, return routes/pages | returns docs | return service/api/frontend tests | quick + linked supported |
| Customer debt ledger | Implemented | customer service/models | parity checklist | customer service/api/frontend tests | ledger-driven |
| Customer debt edit transaction datetime | Implemented; needs manual verification | customer service, frontend customer detail | debt/docs scattered | customer service tests | backend supports `payment_datetime` / `adjustment_datetime`; manual UI pass still useful |
| Orders | Implemented | order service, orders page | `docs/ORDER_*` | order service/api/frontend tests | no stock effect until invoice conversion |
| Reporting | Implemented; needs manual verification | report routes/service, `ReportsPlaceholder.tsx`, dashboard | dashboard/report docs | reports API + dashboard tests | UI still named placeholder but functional |
| History page | Implemented | history route/service/UI | `docs/HISTORY_*` | history API/frontend tests | unified feed |
| History delete behavior | Deferred | none | history docs | none | no write/delete actions added |
| History multi-delete | Deferred | none | history docs | none | explicitly high risk / absent |
| Attendance employee management | Implemented | attendance service/UI | attendance docs | attendance service/api/frontend tests | includes create/update/delete/deactivate behavior |
| Employee multi-delete | Pending | none confirmed | none | none | not found |
| Attendance day entry | Implemented | attendance service/UI | `docs/ATTENDANCE_BATCH_C_FRONTEND_DAY_ENTRY.md` | attendance service/api/frontend tests | draft/finalize/absent supported |
| BLOW work calculation | Implemented | attendance service/math | attendance docs | attendance tests | includes tick and quantity rules |
| CUT work calculation | Implemented | attendance service/math | attendance investigation/docs | attendance tests | quota/excess logic in service |
| CUT quota decimal half-step support | Implemented | attendance UI + models | settings/attendance docs | backend/frontend tests | step `0.5` in UI and decimals in DB |
| CUT multi-code reached-quota lowest-price rule | Unknown / inspect further | likely attendance logic | investigation docs | no direct proof located in current quick scan | needs dedicated code read if changing |
| Product-to-attendance CUT sync | Implemented | attendance config service | `docs/ATTENDANCE_CUT_PRODUCT_LINK_AND_BLOW_VK.md` | `test_attendance_cut_product_linking.py` | product-linked bag types |
| Attendance price settings dropdown / remove CUT add | Implemented | settings page | `docs/SETTINGS_BATCH_C_ATTENDANCE_SETTINGS.md` | settings frontend tests | CUT add now via product search/link flow |
| Attendance incomplete CUT config warning | Implemented; needs manual verification | attendance UI/service | CUT product link docs | frontend settings/attendance tests | inline config flow present |
| BLOW extra CUT/VK | Implemented | attendance service/UI | CUT+VK docs | cut product linking + inventory effects tests | amount = quantity * excess price |
| Attendance CUT/VK to inventory | Implemented | attendance inventory service | Batch E docs | attendance inventory effect tests | single DB transaction path |
| Attendance inventory diagnostics service | Implemented | diagnostic service | Batch E / settings docs | attendance inventory effect tests | read-only issue detection |
| Attendance inventory diagnostics UI | Implemented | settings page | settings docs | settings tests | no repair action |
| Backup | Deferred | no real backup feature UI | runbook docs only | none | only procedural docs |
| Diagnostics export | Deferred | none | none | none | not found |
| Auto-update / version.json | Deferred | absent | absent | none | web repo has no update manifest |
| CI/CD | Deferred | `.github/` absent | absent | none | no workflows in repo |
| Background image feature | Unknown / inspect further | not confirmed | none | none | not obvious in current repo |
| Web/online/QR attendance idea | Future idea | docs/investigation only if any | not current implementation | none | no runtime proof found |

---

## PART G - INVENTORY / HÀNG HÓA CURRENT BEHAVIOR

- Product create:
  - uppercases/normalizes `product_code_base`
  - trims `product_name`
  - validates `unit_mode`
  - requires at least one enabled positive price
- Product update:
  - name and prices editable
  - rejects illegal unit-mode changes
  - removed prices are disabled, not necessarily deleted
- Product delete/deactivate:
  - `hard_deleted` if unused
  - `deactivated` if history exists
- Product reactivation:
  - creating same inactive code + same identity reactivates existing row
  - different name or different unit mode is rejected
- Same code but different name/unit:
  - rejected
- Product price behavior:
  - `BAO_KG` accepts `BAO`, `KG`, or both
  - `BICH` accepts only `BICH`
- Product active/inactive list:
  - inactive hidden by default
  - include-inactive toggle supported
- Inventory balance:
  - canonical quantity stored as:
    - `on_hand_bao_decimal` for `BAO_KG`
    - `on_hand_bich_integer` for `BICH`
- BAO/KG vs BICH:
  - BAO/KG products use canonical BAO balance; KG is converted
  - BICH stays BICH
- Decimal quantity:
  - supported, typically `Numeric(14,3)`
- Stock effects:
  - inventory service writes `stock_adjustments` for increase/decrease/set
- Product multi-delete:
  - no confirmed current implementation
- Attendance link implications:
  - CUT bag types can link to `products.id`
  - linked product deactivation/legacy flags matter for attendance selection

Main proof:

- `backend/tests/service/test_inventory_service.py`
- `docs/FEATURE_PARITY_ACCEPTANCE_CHECKLIST.md`

---

## PART H - SALES / RETURNS / CUSTOMER / ORDERS CURRENT BEHAVIOR

### Sales invoices

- create:
  - invoice code format `HDYYYYMMDD-###`
  - walk-in must be fully paid or overpaid
  - customer invoice can be unpaid/partial/paid/overpaid
  - decreases stock
  - creates customer ledger effects if customer invoice
- update:
  - rollback old stock/customer effects then apply new state
  - preserves historical inactive customer/product references on edit
- delete:
  - restores stock
  - removes customer/debt effects

Ledger semantics:

- charge row: `INVOICE_CHARGE`
- payment row when `paid_amount > 0`: `DEBT_PAYMENT`

### Returns

- create:
  - return code format `TRYYYYMMDD-###`
  - quick return has no source quantity ceiling
  - linked return enforces source item remaining quantity
  - increases stock
- handling modes:
  - `REFUND_NOW`
  - `STORE_CREDIT`
- customer effects:
  - `STORE_CREDIT` reduces balance by full return total
  - `REFUND_NOW` reduces balance by `min(current positive balance, return total)`
- update/delete:
  - rollback/reapply latest effects

### Customer debt

- `Customer.current_balance` is derived by service recomputation
- `CustomerBalanceLedger` ordered by:
  - `transaction_datetime`
  - `display_order`
  - `id`
- debt payment:
  - positive amount only
  - edit = rollback old + append replacement
  - delete = mark payment `is_deleted=True` and recompute
- adjustment:
  - target-balance based, ledger-driven, not direct mutation

### Orders

- do not affect stock directly
- do not create invoice/customer ledger effects directly
- statuses:
  - `OPEN`
  - `PREPARED`
  - `CONVERTED`
- sales-from-order:
  - opening invoice draft from order does not convert
  - successful invoice POST with `source_order_id` marks order `CONVERTED` transactionally

### History page

- displays unified events:
  - `SALES_INVOICE`
  - `RETURN_INVOICE`
  - `DEBT_PAYMENT`
  - `BALANCE_ADJUSTMENT`
  - `STOCK_MOVEMENT`
  - `ORDER`
- supports:
  - pagination
  - date range
  - event type filter
  - customer filter
  - product filter
  - search
- no delete behavior implemented
- multi-delete intentionally absent / high risk

---

## PART I - ATTENDANCE / CHẤM CÔNG CURRENT BEHAVIOR

### Cấu trúc page

`/attendance` có 3 tab:

- `Nhân viên`
- `Chấm công`
- `Báo cáo`

### Employee management

- create/update supported
- delete path có thể hard delete hoặc deactivate tùy history
- active/inactive supported
- search/filter team supported

### Day entry

- date picker theo ngày
- employee status list ở panel trái
- panel phải là editor chi tiết
- trạng thái UI:
  - `not_started`
  - `draft`
  - `done`
  - `absent`
- save flow:
  - `Lưu nháp`
  - `Lưu chính thức`
- absent:
  - zero work effects
  - finalized absent can reverse prior attendance inventory effects
- edit finalized:
  - allowed nếu period chưa lock
  - locked period blocks inventory-affecting edits

### BLOW team

- work types gồm:
  - quantity-based
  - tick-based
- `exclusive_group` được dùng để loại trừ lẫn nhau cho một số tick rules
- extra CUT / `VK` section tồn tại riêng
- `VK` amount = `quantity * excess_unit_price`

### CUT team

- day-entry dùng bag types liên kết product
- selectable CUT items phải:
  - active
  - product-linked
  - not excluded
  - not legacy
- product chưa cấu hình attendance sẽ đi qua inline configuration flow
- quantity supports decimal / half-step UI step `0.5`

### CUT calculation

Từ code/tests hiện có có thể khẳng định:

- quota/excess price snapshot được lưu theo row
- CUT records và extra CUT records đều tính amount snapshot
- inventory effects phát sinh theo quantity đã finalize

Những rule sâu kiểu “2+ codes reach quota thì lấy lowest-price quota-charged rule” chưa có bằng chứng đủ chắc trong lượt scan này; nếu sửa attendance calculation phải đọc sâu `attendance_service.py` trước.

### Attendance reports

- attendance reports page đã có implementation backend/frontend
- docs nói có period/month reporting
- report inclusion có hỗ trợ hiển thị inactive employees nếu có history trong range
- export/print chưa thấy proof chắc trong repo hiện tại

---

## PART J - PRODUCT ↔ ATTENDANCE CUT SYNC

Repo web không có file desktop-style `modules/attendance/product_sync_service.py`.  
Feature tương đương hiện nằm chủ yếu trong:

- `backend/app/application/attendance_service.py` (`AttendanceConfigService`)
- `frontend/src/features/settings/SettingsPage.tsx`
- `frontend/src/features/attendance/AttendancePage.tsx`
- `backend/tests/service/test_attendance_cut_product_linking.py`

### Current model

`AttendanceBagType` là bản ghi CUT config liên kết `products`.

Key fields:

- `is_product_linked`
- `product_id`
- `source_product_name_snapshot`
- `is_excluded_from_attendance`
- `is_legacy`

### Current behavior

- Product là source cho linked CUT item creation.
- Search product:
  - theo name hoặc code
- Nếu product đã configured:
  - add trực tiếp vào day-entry
- Nếu product chưa configured:
  - phải nhập `quota_quantity` và `excess_unit_price`
  - tạo hoặc revive linked bag type
- Revive behavior:
  - clear `is_excluded_from_attendance`
  - clear `is_legacy`
  - reactivate row
- Settings UI cho phép:
  - toggle active
  - toggle excluded
  - toggle legacy

### Caveats

- Legacy/manual bag types không đủ điều kiện sẽ bị loại khỏi new day-entry.
- Historical records vẫn dựa vào snapshot cũ.

---

## PART K - ATTENDANCE CUT/VK → INVENTORY STOCK EFFECTS

### Files chính

- `backend/app/infrastructure/db/models/attendance.py`
- `backend/app/application/attendance_inventory_service.py`
- `backend/app/application/attendance_inventory_diagnostic_service.py`
- `backend/app/application/attendance_service.py`
- `frontend/src/features/settings/SettingsPage.tsx`
- `backend/tests/service/test_attendance_inventory_effects.py`

### Requirement hiện tại đã có

- finalized CUT/VK increases stock
- draft does not affect stock
- absent/finalized status transition can reverse effects
- re-save finalized record reconciles by reverse/delete/reapply
- no automatic backfill for old records

### `attendance_inventory_effects`

Fields chính:

- `daily_record_id`
- `cut_log_id` xor `extra_cut_log_id`
- `employee_id`
- `work_date`
- `bag_type_id`
- `product_id`
- `quantity_delta`
- `unit_type`
- `movement_datetime`
- `note`

Constraints:

- exactly one source line
- unique `cut_log_id`
- unique `extra_cut_log_id`
- `quantity_delta > 0`
- `unit_type IN ('BAO', 'BICH')`

### Reconciliation algorithm

Cho một daily record finalized:

1. load effect rows cũ
2. reverse stock impact cũ
3. delete effect rows cũ
4. tính effect rows mới từ current saved attendance rows
5. apply stock increases mới
6. insert effect rows mới

### Unit mapping

- `BAO_KG` product -> inventory effect dùng `BAO`
- `BICH` product -> inventory effect dùng `BICH`

### Diagnostics

Read-only issue types hiện thấy:

- `finalized_record_missing_inventory_effect`
- `effect_product_mismatch`
- `effect_quantity_mismatch`
- `effect_exists_for_non_final_record`

UI hiện có panel diagnostics trong settings, nhưng chưa có repair action.

---

## PART L - SETTINGS / BACKUP / DIAGNOSTICS / UPDATE

### Settings page structure

`/settings` hiện có các section:

- `overview`
- `attendance`
- `backup_import` placeholder
- `user_roles` placeholder

Role-based visibility:

- `owner` / `admin`: full sections
- `attendance_manager`: attendance section
- `read_only`: overview only

### Attendance settings

- BLOW:
  - list/create/edit/reactivate/deactivate work types
  - seed default work types
- CUT:
  - product search
  - create linked CUT item from product
  - edit quota / excess price
  - toggle active / excluded / legacy
- Diagnostics:
  - read-only issue counts + table

### Backup behavior

- Chưa có feature backup trong UI/API.
- Chỉ có procedural docs/runbook.

### Diagnostics export

- Không thấy implementation export diagnostics ra file trong repo hiện tại.

### Auto-update

- Không có manifest
- Không có startup check
- Không có manual check flow
- Không có installer download flow

### Background image / assets

- Không thấy feature runtime quan trọng liên quan background image.

---

## PART M - UI/UX CURRENT STATE

### Main navigation hiện tại

Top nav cho thấy:

- `Tổng quan`
- `Chấm công`
- `Hàng hóa`
- `Bán hàng`
- `Đặt hàng`
- `Lịch sử`
- `Khách hàng`
- `Báo cáo`
- `Cài đặt`

### Cấu trúc lớn

- Dashboard có cards + revenue chart + top products + recent activity
- Inventory dùng redesign shell
- Customer có list + detail + edit/create flow
- Attendance có page riêng với 3 tabs
- Settings tách riêng attendance config khỏi day-entry

### Product list behavior

- search name-only
- include inactive toggle
- unit-mode aware pricing/balance display

### Customer UI

- có inline/detail oriented flows theo docs redesign
- inactive rows được preserve nhưng hidden by default

### Attendance day-entry layout

- trái: employee/day status list
- phải: detail editor
- CUT search/add/config ngay trong form
- BLOW extra CUT/VK section riêng

### Attendance settings layout

- overview cards + BLOW config + CUT config + diagnostics

### Attendance report layout

- implemented, nhưng nên manual verify trước khi sửa lớn vì docs/report formatting trải qua nhiều batch

### Multi-delete

- Không thấy shared implemented multi-delete flow rõ ràng cho products/employees/history trong repo hiện tại.

### Numeric input conventions

- nhiều input dùng native `<input type="number">`
- decimal step phổ biến:
  - quantity: `0.5` hoặc decimal text
  - money: integer-ish / `step="100"` ở nhiều attendance settings form
- backend lưu nhiều quantity dạng `Numeric(14,3)`

### Known UI caveats

- text/mojibake cleanup có lịch sử sửa nhiều batch; vẫn cần cẩn thận khi sửa chuỗi tiếng Việt
- reports page tên file còn là `ReportsPlaceholder.tsx` dù đã có functionality
- order page vẫn chưa có dedicated order detail route

---

## PART N - TESTING / CI / COMMON FAILURES

### Test framework

- Backend: `pytest`
- Frontend: `vitest`

### Current test footprint detect được

- backend test files: `55`
- frontend `*.test.tsx` / `*.test.ts`: `12`

### Full commands phù hợp với repo hiện tại

Backend:

```powershell
cd backend
uv run pytest
python -m compileall app tests
```

Frontend:

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

### Verification run mới nhất trong lần khảo sát này

#### Backend

- `uv run pytest`
  - passed
  - `370 passed, 27 skipped, 1 warning in 48.56s`
- `python -m compileall app tests`
  - failed with permission errors writing `tests/**/__pycache__/*.pyc`
  - source listing proceeded; issue là quyền ghi cache, không phải syntax error được chứng minh từ output này

#### Frontend

- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed
- `npm.cmd test -- --run`
  - failed
  - `1 failed | 83 passed (84 tests)`
  - failing test:
    - `src/features/settings/SettingsPage.test.tsx`
    - case: `create, edit, and exclude cut item then day-entry reflects future behavior while history keeps snapshot`
    - symptom: không tìm thấy text `10.000`

### CI workflow behavior

- Không có `.github/workflows/*` hiện hành trong repo.
- Vì vậy không có CI behavior chính thức để dựa vào.

### Common historical / practical failures hiện thấy

- PostgreSQL integration tests bị skip nếu thiếu `TEST_DATABASE_URL`.
- `compileall` có thể fail vì permission issue khi ghi `__pycache__`.
- `pytest` có thể warning vì không ghi được `.pytest_cache`.
- Frontend test suite hiện có ít nhất 1 regression/failing expectation ở attendance/settings flow.

### Warning nào là expected, warning nào là real issue

Expected / tolerable trong môi trường local hiện tại:

- pytest cache warning do không ghi được `.pytest_cache`
- compileall permission errors ghi `__pycache__`
- postgres-marked tests skip khi không có `TEST_DATABASE_URL`

Real issue cần theo dõi:

- frontend vitest fail trong attendance/settings historical snapshot behavior
- thiếu CI/release pipeline
- docs tổng quan cũ hơn code thật

---

## Handoff kết luận ngắn

Nếu mở lại dự án sau một thời gian dài, hướng an toàn nhất là:

1. Xem repo này như **web application đã có nền nghiệp vụ khá sâu**, không còn là migration skeleton.
2. Dùng **backend tests + frontend tests hiện tại** làm mốc sự thật trước khi tin vào docs cũ.
3. Nếu làm tiếp theo ưu tiên:
   - sửa frontend failing test ở attendance/settings
   - quyết định và bổ sung CI
   - cập nhật README / overview docs cho khớp trạng thái hiện tại
   - làm rõ production deployment + backup/restore + cutover policy
   - chỉ sau đó mới mở rộng attendance import hoặc release planning

## Changed Files

- `docs/PROJECT_REORIENTATION_CURRENT_STATE.md`

## Simplifications Made

- Ánh xạ brief desktop cũ sang trạng thái web hiện tại thay vì giả vờ các file/version/update flow cũ vẫn tồn tại.
- Ưu tiên code + tests + docs batch mới hơn thay vì lặp lại toàn bộ assumptions của desktop repo.

## Remaining Risks

- Chưa có CI chính thức.
- Frontend test suite chưa hoàn toàn xanh.
- Release/deployment/versioning artifact story còn thiếu.
- Một số attendance calculation edge rules sâu vẫn nên đọc lại code chi tiết trước khi chỉnh sửa logic.
