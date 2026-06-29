# SETTINGS_MODULE_INVESTIGATION

## Summary

The legacy desktop app has a much smaller true `Cài đặt` surface than its business impact suggests.

What actually exists in the old app:

- general app/runtime preferences
- UI scale
- update check status
- backup creation
- log/diagnostic actions
- attendance pricing/configuration
- attendance inventory diagnostics
- attendance product-to-CUT sync

What does **not** exist as a first-class legacy settings area:

- global sales rules editor
- customer debt policy editor
- order policy editor
- invoice numbering editor
- user/role management UI
- product/inventory business-rule settings UI
- print/export layout settings beyond runtime export folders

In the new web app, `/settings` is currently only a placeholder. Most business behavior is still implemented directly in backend services and route policies, not exposed as editable settings.

The main recommendation is:

- keep web Settings narrow and business-safe
- move only settings that are truly operationally owned by users
- do **not** expose destructive business toggles without snapshot/history protection
- prioritize attendance settings first, because attendance already has real configuration objects and cross-module inventory effects

## Files Inspected

### Legacy desktop

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\settings\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\settings\backup_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\settings\ui\page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\settings_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\ui\settings_tab.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\blow_work.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\db.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\attendance\product_sync_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\core\config.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\README.md`

### Current web app

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\settings\SettingsPlaceholder.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\router.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\domain\routes.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\inventory\InventoryModuleShell.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\core\config.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\deps.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\auth.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\auth\bootstrap_owner.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\domain\auth.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\document_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\inventory_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\sales_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\return_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\order_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\attendance_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\attendance_inventory_diagnostic_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\attendance.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\attendance.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\scripts\attendance_import_dry_run.py`
- relevant existing docs under `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\`

## 1. Legacy Settings Feature Map

| Legacy setting area | Where in UI | What it changes | Depends on / impacts | Web relevance |
| --- | --- | --- | --- | --- |
| UI scale preset | `Cài đặt chung` tab | `QSettings` key `ui/scale_preset` | all desktop UI screens | Drop as business setting; web should rely on responsive UI/accessibility, not a persisted desktop scale preset |
| App info/version | `Cài đặt chung` tab | read-only display from `core/version.py` and config | support / diagnostics | Keep as read-only system info |
| Log folder location | `Cài đặt chung` tab | derived from runtime config, not user-edited in UI | support / troubleshooting | Useful as read-only environment info only |
| Export folder location | `Cài đặt chung` tab | derived from runtime config | export workflows | Usually drop from end-user settings in web; server-side path config belongs to ops |
| Backup folder location | `Cài đặt chung` tab | derived from runtime config | backup feature | Keep only as admin/system info if backup jobs are added |
| Check updates | `Cài đặt chung` tab button | remote manifest check state | deployment / release process | Drop from in-app business settings; web deployment belongs to ops |
| Backup now | `Cài đặt chung` tab button | creates zip of `app.db` + `attendance.db` | backup / recovery | Keep, but redesign for web as admin export/rehearsal tools, not raw file-path UX |
| Open logs / export diagnostics | `Cài đặt chung` tab actions | operational diagnostics only | support | Keep only for admin/system diagnostics if needed |
| Attendance blow work types | `Cài đặt giá chấm công` | `attendance.work_types` in attendance DB | blow day-entry, payroll totals, attendance reports | Must keep |
| Attendance CUT bag/work items | `Cài đặt giá chấm công` | `attendance.bag_types` in attendance DB | cut day-entry, blow VK, payroll totals, attendance reports, inventory effects | Must keep |
| Attendance CUT quota quantity | `Cài đặt giá chấm công` | `bag_types.quota_quantity` | CUT bonus calculation | Must keep, but history-safe |
| Attendance CUT excess unit price | `Cài đặt giá chấm công` | `bag_types.excess_unit_price` | CUT bonus calculation, VK amount | Must keep, but history-safe |
| Attendance exclude-from-attendance flag | `Cài đặt giá chấm công` | `bag_types.is_excluded_from_attendance` | day-entry availability only | Must keep |
| Attendance active/inactive flags | `Cài đặt giá chấm công` dialogs | `work_types.is_active`, `bag_types.is_active` | new day-entry availability, historical preservation | Must keep |
| Attendance product sync | implicit on opening attendance settings | syncs inventory products into attendance CUT items | inventory, attendance CUT config, diagnostics | Must keep, but redesign; sync direction and audit need to be explicit in web |
| Attendance inventory diagnostics | `Cài đặt chung` diagnostics panel | no config mutation by default; scans mismatches | attendance + inventory correctness | Must keep as diagnostics, not ordinary business settings |
| Attendance re-sync / reconcile one record | diagnostics action | repairs inventory effect consistency | attendance + inventory | Useful but dangerous; keep only for high-privilege admin workflow |

## 2. Current Web Settings State

### Frontend

- `/settings` exists in navigation for `owner`, `admin`, `read_only`
- page is only `SettingsPlaceholder`
- visible copy is placeholder text, not real functionality

### Backend

- no general settings CRUD API
- no user-management API surface beyond auth login/refresh/logout/me
- owner bootstrap exists as CLI/server-side utility, not a web settings function
- runtime config comes from environment variables:
  - app name
  - environment
  - DB URL
  - auth secret
  - auth bypass
  - token lifetimes
  - issuer
  - CORS origins
- these are deployment settings, not end-user settings

### Existing module-owned configuration in code

- inventory:
  - product unit mode is fixed at creation and cannot be changed later
  - product prices are editable and active/inactive per unit
- sales:
  - invoice code format is generated in code by `DocumentService`
  - payment method enum is code-defined
  - walk-in invoice must be fully paid
- returns:
  - return code format is generated in code
  - walk-in return only supports `REFUND_NOW`
  - return handling mode enum is code-defined
- orders:
  - order code format is generated in repository/service logic
  - order statuses are code-defined
- customers:
  - customers are not walk-in when created in master data
  - balance adjustments and debt payments are service-driven, not settings-driven
- attendance:
  - real editable config objects already exist: work types and bag types
  - inventory diagnostics and product-link rules already exist

## 3. Cross-Module Dependency Map

| Setting / config area | Hàng hóa | Bán hàng | Trả hàng | Đặt hàng | Khách hàng | Lịch sử | Chấm công | Báo cáo / Tổng quan | Import / export / backup | Auth / roles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UI scale | none in web | none | none | none | none | none | none | none | none | none |
| Runtime file paths | indirect | indirect | indirect | indirect | indirect | indirect | attendance DB path in desktop | indirect | strong impact | none |
| Update manifest / update check | none | none | none | none | none | none | none | none | deployment only | none |
| Backup behavior | snapshots all data | snapshots all data | snapshots all data | snapshots all data | snapshots all data | snapshots all data | snapshots attendance DB / web DB | reporting restore confidence | primary impact | none |
| Product unit mode | core | sales quantity/unit validation | return quantity/unit validation | order quantity/unit validation | none | stock history semantics | attendance inventory effect unit mapping for CUT/VK | inventory/report aggregation | import validation | none |
| Product prices | core | invoice line creation/edit | quick return pricing input | none | debt totals | history display amounts | no direct payroll effect | sales/report values | import validation | none |
| Invoice code format | none | primary impact | source reference readability | indirect from order-to-invoice conversion | customer ledger references | history browsing | none | reports/search readability | import matching | none |
| Order code format | none | order conversion references | none | primary impact | customer views | history browsing | none | dashboard/history | import matching | none |
| Return code format | none | invoice/return linkage readability | primary impact | none | customer ledger references | history browsing | none | reports/search readability | import matching | none |
| Payment method enum/rules | none | primary impact | none | none | debt interpretation | history display | none | sales reports | import mapping | role-based write access |
| Walk-in invoice policy | none | primary impact | impacts return source cases | none | debt integrity | history semantics | none | sales/debt reporting | import assumptions | none |
| Return handling mode policy | stock effect only | indirect | primary impact | none | debt/store-credit behavior | history semantics | none | returns/debt reports | import mapping | none |
| Attendance blow work types | none | none | none | none | none | attendance history | primary impact | attendance reports | attendance import | attendance roles |
| Attendance CUT bag/work items | linked to products | none | none | none | none | attendance history | primary impact | attendance reports | attendance import | attendance roles |
| Attendance quota / excess price | none | none | none | none | none | attendance history | payroll correctness | attendance totals/reports | import parity | attendance roles |
| Attendance product links | strong | stock effect via attendance | stock effect via attendance | none | none | inventory history from effects | CUT/VK entry correctness | inventory + attendance reporting | import coordination | attendance roles |
| Attendance excluded / legacy flags | none | none | none | none | none | historical readability | new-entry availability | report inclusion logic may vary | import cleanup | attendance roles |
| Attendance inventory diagnostics | inventory correctness | none | none | none | none | history consistency | correctness repair | diagnostic reporting | import cutover validation | high-privilege ops |
| Auth bypass | none | none | none | none | none | none | none | none | none | major security/system impact |
| Token lifetime / secret / CORS | none | none | none | none | none | none | none | none | none | major system impact |

## 4. Must-Keep vs Optional vs Should-Drop

### Must keep for business correctness

- attendance blow work type settings
- attendance CUT work item settings
- attendance quota and excess price
- attendance excluded / legacy / active state
- attendance product link management
- attendance inventory diagnostics
- backup / import-rehearsal tooling
- read-only system/runtime information for diagnostics

### Useful but can defer

- richer backup UI
- admin-facing environment summary
- attendance reconcile/repair UI around diagnostics
- user-management UI
- more polished settings shell/tab structure

### Legacy-only or should drop

- desktop UI scale preset
- desktop update-check UX
- local folder-opening buttons as end-user settings
- local file-path editing for logs/export/backup

### Dangerous in web unless redesigned

- auth bypass control
- token lifetime editing
- secret-key editing
- raw database path editing
- changing document-code patterns after transactions exist
- changing product unit mode after transactions exist
- changing attendance product links after finalized records exist
- destructive delete of work types, bag types, or products with history

## 5. Proposed Web Settings Structure

Recommended sections:

### Cửa hàng / thông tin chung

- application name / version
- environment
- database target summary
- health / diagnostics summary

Read mostly from backend runtime. Mostly read-only.

### Hàng hóa & tồn kho

- product-related guardrails explanation
- stock diagnostics / integrity tools
- maybe future defaults if the business truly has reusable product policies

Do not add casual toggles that can change unit semantics after history exists.

### Bán hàng / hóa đơn

- only consider adding if the business explicitly needs configurable invoice behavior
- potential future settings:
  - allowed payment methods
  - invoice note defaults
  - maybe document numbering policy

This area is dangerous and should stay mostly code-driven unless there is a clear business need.

### Khách hàng & công nợ

- future customer policy toggles only if real business ownership exists
- likely candidates:
  - walk-in naming label
  - debt reminder/reporting options

Not urgent right now.

### Chấm công

- blow work types
- CUT work items
- quota / excess price
- product links
- excluded / legacy / active states
- diagnostics
- maybe import validation summary

This is the strongest candidate for the first real web settings module.

### Sao lưu / nhập dữ liệu

- backup/export of operational snapshots
- import rehearsal tools
- import status/docs links
- restore should be separate, heavily protected, and probably not in the ordinary UI

### Người dùng & phân quyền

- owner/admin user list
- create/deactivate users
- role assignment
- attendance-manager assignment

Needed, but separate from attendance config.

### Hệ thống

- environment info
- auth configuration summary
- CORS / issuer / token policy summary
- maintenance/diagnostics

Mostly read-only and admin-only.

## 6. Attendance-Specific Settings Investigation

### Blow work types

Legacy and web both treat these as real settings data, not hardcoded display-only content.

Belongs in settings:

- name
- input type
- unit price
- active flag
- exclusive group
- pricing rule
- quota for quota-based rules

Safety rule:

- after work logs exist, do not rewrite historical meaning
- new edits must affect only future day-entry behavior
- historical logs continue using stored snapshots

### CUT work items

Belongs in settings:

- linked product
- display name
- quota quantity
- excess unit price
- active flag
- excluded flag
- legacy flag

Safety rule:

- finalized records already snapshot quota/excess values
- changing current bag-type config must not recalculate old records

### Product sync

Legacy desktop has one-way sync from inventory products into attendance CUT work items.

Recommendation for web:

- expose it as explicit “link / create from product” actions
- avoid hidden automatic mass-changes without audit
- keep diagnostics for incomplete links

### Excluded / legacy flags

These clearly belong in attendance settings.

Purpose:

- `excluded` prevents use in new day-entry without deleting history
- `legacy` preserves historical rows but keeps them out of new entry flows

### Inventory diagnostics

This belongs under attendance settings or a nearby diagnostics subsection because it is operationally owned by attendance/inventory admins.

### “thông ca” and “cắt thêm bao”

These should live in attendance settings, not in hardcoded defaults.

Recommendation:

- treat them as optional/configurable blow-team work types
- do not force-seed by default
- allow admins to enable them intentionally in settings later

### Safe exposure model

To avoid payroll breakage:

- current config changes affect only future new records
- finalized daily records remain authoritative via snapshots
- changing current quota/price/product links does not mutate historical totals
- destructive actions become deactivate/exclude/legacy, not delete

## 7. Data Safety Recommendations

| Risky setting change | Why dangerous | Recommended safe behavior |
| --- | --- | --- |
| Changing product prices | can distort future entry if misused, but old invoice snapshots are safe | allow, but never recalculate old invoice/return totals |
| Changing attendance blow work price | can change payroll for future entries | allow for future only; old work logs keep snapshot |
| Changing attendance CUT quota | can change future payroll logic | allow for future only; old cut logs keep quota snapshot |
| Changing attendance CUT excess price | can change future payroll/VK logic | allow for future only; old logs keep price snapshot |
| Changing attendance product link | can break inventory effects / diagnostics | require admin-only flow, show impact warning, keep old finalized record effects historical |
| Changing product unit mode | breaks inventory semantics across modules | forbid after creation |
| Changing invoice numbering format | can confuse history/import/search and duplicate sequences | avoid user-editable setting unless fully versioned and forward-only |
| Deleting work types/bag types/products with history | breaks historical readability and foreign-key references | never hard delete after history; use deactivate/exclude/legacy |
| Changing stock movement behavior | can break inventory/history consistency | keep code-driven, versioned, and heavily tested |
| Changing auth bypass / secrets / token settings | severe security risk | keep ops-only, environment-managed, not in end-user UI |

## 8. Recommended Implementation Batches

### Batch A: settings investigation/docs only

- this document

### Batch B: frontend settings shell

- replace placeholder with real tabbed shell
- add read-only general/system section
- add routing/role framing

### Batch C: attendance settings

- blow work types
- CUT work items
- product links
- active/excluded/legacy flags
- diagnostics panel

### Batch D: backup/import settings

- expose backup/rehearsal docs and admin actions
- import validation summaries
- avoid production restore UI at first

### Batch E: user/role settings

- user list/create/deactivate
- role assignment
- attendance-manager workflow

### Batch F: business config polish

- only after real business need is confirmed
- selectively consider sales/customer/report preferences
- avoid overbuilding “settings” for code-driven rules that should stay fixed

## Risks

- overexposing dangerous business toggles can corrupt historical interpretation
- attendance product-link changes have inventory side effects and need explicit audit
- document numbering is operationally sensitive and easy to redesign badly
- runtime/deployment config should not be confused with user-editable business settings
- import/backup controls are high-risk and need admin-only UX
- the current web `/settings` placeholder may encourage users to expect much broader configurability than currently exists

## Recommendation Snapshot

If the user wants a lean, safe first version of web Settings, implement this order:

1. `Cài đặt chung` read-only system info
2. `Chấm công`
3. `Sao lưu / nhập dữ liệu`
4. `Người dùng & phân quyền`

Defer or drop everything else until a real business owner asks for it.

## No Change Confirmation

- No business code was implemented for this task.
- No database was modified.
- No settings behavior was changed.
- Only this investigation document was added.
