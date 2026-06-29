# UI Redesign Customer Investigation

Date: 2026-05-22

Scope: read-only investigation of the current web Customer module, the customer backend/API behavior that must be preserved, and the old desktop Customer module as the primary workflow reference. No implementation is included.

## Summary

The current web Customer module already preserves the core debt and ledger behavior needed for redesign:

- customer create with optional opening balance
- customer search by name and phone
- customer current balance recomputed from ordered ledger rows
- target balance adjustment through a dedicated balance-adjustment flow
- debt payment create/edit/delete with recompute semantics
- delete vs deactivate behavior based on history
- `total_sales` protected from normal customer UI/API editing

The main redesign gap is not backend parity. It is workflow and presentation parity.

- The web list is a simple toolbar + table + separate detail page.
- The desktop app uses a more operational workflow: list with side filters, summary row, single-click inline expansion, and tabbed inline detail.
- The web detail page currently exposes debt payments and full ledger, but it does not yet expose sales/returns history in the customer detail surface.
- The web edit page separates profile editing from balance adjustment; the desktop edit dialog combines profile update and target balance correction.

For redesign, the desktop app should remain the primary behavior reference, while KiotViet can guide layout density, hierarchy, and list ergonomics.

## Current Web Files Inspected

- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerListPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerDetailPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerCreatePage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\CustomerEditPage.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\DebtPaymentForm.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\customerSchemas.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\features\customers\customerQueries.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\customers.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\api\types.ts`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\app\router.tsx`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend\src\styles.css`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\application\customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\api\routes\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\schemas\customers.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\app\infrastructure\db\repositories\customer.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\service\test_customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\tests\api\test_customer_api.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\FEATURE_PARITY_ACCEPTANCE_CHECKLIST.md`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\FEATURE_PARITY_CORE_MODULES_INVESTIGATION.md`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\FEATURE_PARITY_BATCH1_CUSTOMER_DEBT_IMPLEMENTATION.md`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\docs\FEATURE_PARITY_BATCH6_P1_CLEANUP.md`

## Old Desktop Files Inspected

- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\repository.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\controller.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\validators.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\page.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\customer_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\customer_dialog.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\customer_detail_popup.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\debt_payment_dialog.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\debt_payment_list_view.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\debt_payment_detail_popup.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\modules\customer\ui\forms.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_service.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_ui.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_list_search.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_history.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_customer_invoice_payment_migration.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_ledger_ordering_migration.py`
- `E:\QuanLyHangHoaWeb\QuanLyHangHoa\tests\test_overpayment_ordering_pipeline.py`

## Current Workflow Map

### 1. Current Customer List Workflow

#### Current web behavior

- Route: `/customers`
- Visual structure:
  - page header and create button
  - single horizontal toolbar
  - single table below
  - no side panel
  - no pinned summary row
  - no inline expansion
- List columns:
  - `Ten khach hang`
  - `Dien thoai`
  - `Dia chi`
  - `So du`
  - `Tong mua`
  - `Trang thai`
- Search behavior:
  - one text input with placeholder `Ten, dien thoai`
  - query is sent to backend on each state change through React Query
  - backend matches `customer_name` and `phone`
- Filters:
  - `Chi hien khach dang no`
  - `Hien khach ngung dung`
- Sorting:
  - no sorting UI in current web page
  - backend list order is `customer_name asc`, then `id asc`
- Active/inactive behavior:
  - active customers shown by default
  - inactive customers appear only when `include_inactive` is checked
  - inactive rows are not visually differentiated beyond `Trang thai = Ngung dung`
- Create customer flow:
  - owner/admin sees `Tao khach hang`
  - action navigates to `/customers/new`
- Row click behavior:
  - customer name is the only clickable element
  - click navigates to full detail page `/customers/:customerId`
- Selected customer detail expansion behavior:
  - none in the current web implementation
- Loading/error/empty behavior:
  - simple message boxes in page flow
  - no skeletons
  - no pagination

#### Desktop reference behavior

- Search box above the table
- Left side panel contains:
  - create button
  - sort selector
  - positive-debt filter
  - include-inactive filter
- List columns:
  - customer name
  - phone
  - debt/current balance
  - total sales
- Summary row at the top of the table:
  - aggregated debt total
  - aggregated sales total
  - non-interactive
- Sorting options:
  - name asc/desc
  - balance asc/desc
  - sales asc/desc
- Single click on a customer row toggles an inline expanded detail row directly under that customer
- Inactive customers are labelled inline with `(ngung su dung)`
- Negative balances are colored red, positive debt green

### 2. Current Customer Detail Workflow

#### Current web behavior

- Route: `/customers/:customerId`
- Layout:
  - page header
  - edit/delete actions for owner/admin
  - back link
  - summary-card grid
  - debt payment section
  - full ledger table
- General info shown in summary cards:
  - customer name
  - phone
  - current balance
  - total sales
  - address
  - note
- Sales/returns history tab:
  - not present in current web detail page
- Receivable/debt tab:
  - not tabbed
  - implemented as:
    - debt payment list
    - balance-adjustment inline form
    - full ledger table
- Edit/delete behavior:
  - edit navigates to `/customers/:customerId/edit`
  - delete opens `window.confirm`
  - result redirects back to list with message:
    - hard deleted
    - deactivated
- Debt payment behavior:
  - add payment button toggles inline create form
  - edit payment opens inline form bound to the selected payment
  - delete payment uses `window.confirm`
  - list columns:
    - id
    - amount
    - payment datetime
    - note
    - status
    - actions for write roles
- Balance adjustment behavior:
  - dedicated inline form inside debt section
  - inputs:
    - target balance
    - note
  - no explicit datetime control in current UI
  - success refetches customer detail, ledger, debt payments, and customer list queries
- Ledger behavior in current detail page:
  - full ledger table, not summarized debt-history entries
  - columns:
    - transaction datetime
    - event type
    - ref type/ref id
    - amount delta
    - balance after
    - note
- Pagination/loading/error behavior:
  - no pagination for debt payments or ledger
  - three separate queries load in parallel:
    - customer
    - ledger
    - debt payments
  - combined loading message
  - combined error message

#### Desktop reference behavior

- Detail is usually inline-expansion inside the customer list, not a separate route
- Three tabs:
  - `Thong tin chung`
  - `Lich su ban/tra hang`
  - `No can thu tu khach`
- General tab:
  - name
  - phone
  - address
  - note
  - inline `Sua` and `Xoa`
- Sales/returns history tab:
  - paged table
  - filter by all / invoice / return
  - columns:
    - time
    - transaction type
    - items summary
    - amount
  - double click opens invoice/return popup
- Receivable/debt tab:
  - paged table
  - current debt summary label
  - `Thanh toan` button
  - entries are business-readable debt history rows, not raw ledger rows
  - includes:
    - opening balance / balance adjustment
    - invoice rows
    - return rows
    - debt payment rows
  - each row retains historical `balance_after`
  - double click opens corresponding transaction detail
- Ordering behavior from tests:
  - logical ordering is preserved for same-batch invoice + overpayment cases
  - UI can render newest-first, but row balances must remain snapshot-correct

### 3. Current Customer Create/Edit Workflow

#### Current web create behavior

- Route: `/customers/new`
- Fields:
  - customer name
  - phone
  - address
  - note
  - opening balance
- Validation:
  - customer name required
  - opening balance must match signed decimal pattern
- Opening balance behavior:
  - sent as `opening_balance`
  - backend creates an `OPENING_BALANCE` ledger row only when non-zero
- Total sales:
  - not shown on create form
  - public API rejects manual `total_sales`

#### Current web edit behavior

- Route: `/customers/:customerId/edit`
- Fields:
  - customer name
  - phone
  - address
  - note
  - current balance read-only
  - total sales read-only
- Validation:
  - customer name required
- Target balance adjustment behavior:
  - not part of edit page
  - handled separately on detail page through balance-adjustment form
- Delete/deactivate behavior:
  - not in edit page
  - only on detail page

#### Desktop reference behavior

- Create and edit use the same dialog shape
- Fields:
  - customer name
  - phone
  - address
  - note
  - `Cong no ban dau` on create
  - `Cong no hien tai` on edit
- Important workflow difference:
  - desktop edit can directly submit a target/current balance as part of the edit dialog
  - that target balance is translated into ledger-driven balance adjustment semantics
- Phone duplication:
  - desktop warns if phone already exists, but still allows continuing

## Backend Behavior Constraints To Preserve

### Customer search by name/phone

- Web API `GET /customers` supports:
  - `search`
  - `include_inactive`
  - `only_positive_debt`
- Repository search matches:
  - `customer_name ilike`
  - `phone ilike`
- This matches the current parity cleanup decision and should not regress to name-only search.

### Current balance

- `current_balance` is derived from ledger recomputation, not manually mutated.
- Recompute order is locked to:
  - `transaction_datetime`
  - `display_order`
  - `id`
- Redesign must not replace this with front-end-only balance math or optimistic shortcuts that skip refetch.

### `total_sales`

- Public customer create/update API does not allow manual `total_sales`.
- Sales service increases `customer.total_sales` on invoice effects.
- Return service decreases `customer.total_sales` on return effects and rejects negative totals.
- Debt payments do not affect `total_sales`.
- Internal service-level `total_sales` parameters still exist for import/test seeding and should not leak back into redesign UI.

### Opening balance ledger

- Non-zero opening balance creates:
  - event type `OPENING_BALANCE`
  - ref type `OPENING_BALANCE`
  - ref id = `customer.id`
  - transaction datetime = opening-balance constant
- Opening balance remains ledger-driven even when entered in a create form.

### Target balance adjustment

- Target balance adjustment creates a `BALANCE_ADJUSTMENT` ledger row with delta = `target - current_balance`.
- If customer has no trade/debt history, default adjustment datetime falls back to opening-balance datetime.
- Redesign must preserve:
  - ledger append, not direct mutation
  - note support
  - unchanged target rejection

### Debt payment create/edit/delete

- Create:
  - amount must be positive
  - creates `DebtPayment` row
  - appends ledger with negative delta
  - overpayment is allowed
- Edit:
  - appends rollback ledger
  - appends replacement `DEBT_PAYMENT` ledger
  - recomputes later balances
- Delete:
  - removes all ledger rows for that payment reference
  - recomputes later balances
  - current web keeps parent `DebtPayment.is_deleted = True` internally as an accepted divergence

### Ledger ordering and overpayment correctness

- Same-timestamp and overpayment cases are sensitive.
- Desktop tests prove that:
  - invoice charge and source-linked debt payment rows must keep logical batch ordering
  - newest-first presentation must still show correct snapshot balances
  - debt history rows must remain historically correct after recompute
- Redesign should treat the ledger/debt tab as high-risk and keep server-driven ordering authoritative.

### Inactive customer rules

- Customer list hides inactive by default.
- Delete should:
  - hard delete only when no history
  - otherwise deactivate
- Acceptance baseline to preserve:
  - new document creation cannot select inactive customers
  - historical invoice/return edits may preserve already-linked inactive customers

## Current Web vs Desktop: Key Workflow Delta

### What web already has

- backend/API parity for debt and balance logic
- customer list with search and basic filters
- dedicated create/edit/detail routes
- dedicated balance adjustment flow
- debt payment CRUD
- full raw ledger visibility

### What desktop still does better as workflow reference

- more operator-focused list layout
- sort controls
- summary row
- single-click inline detail expansion
- tabbed detail separation
- customer-centric trade history tab
- debt history table expressed in business events instead of raw ledger internals
- tighter edit flow combining profile + target balance intent

## Proposed UI Direction

### Behavior direction

- Keep current web route structure available because it already exists and is stable.
- Add a list-first workflow closer to desktop:
  - customer list remains the main entry
  - row selection should reveal detail inline or in a docked side panel
  - full dedicated detail page can remain as fallback/deep-link
- Use desktop behavior as the source of truth for:
  - what tabs exist
  - which actions live in each tab
  - how debt history is grouped
- Use KiotViet primarily for:
  - compact list ergonomics
  - clearer status badges
  - denser filter/action arrangement
  - more business-dashboard-like hierarchy

### Visual direction

- Reuse the brown/cream visual system already established in inventory/sales rather than the current generic teal admin shell.
- Density target:
  - compact-medium
  - row heights tighter than current web cards/tables
  - large datasets should feel scannable without looking cramped
- Recommended structural language:
  - top hero/header consistent with inventory/sales
  - left filter rail or compact filter block
  - cream table surface with subtle zebra rows
  - selected row highlight
  - debt color semantics:
    - positive debt warm red/brown accent
    - negative/overpaid balance muted green or credit-style accent
- Detail surface recommendation:
  - prefer inline expandable panel or split-detail panel over immediate full-page navigation
  - tabs:
    - General
    - Sales/Returns History
    - Receivable / Debt
- Keep edit/create as dedicated page or modal based on implementation convenience, but visually align them with inventory detail forms.

### Suggested detail information architecture

- List row:
  - customer name
  - phone
  - current balance
  - total sales
  - status
- Inline detail header:
  - name, phone, address, note
  - balance chip
  - total sales chip
  - edit/delete quick actions
- Tab 1:
  - general profile data
- Tab 2:
  - customer sales + return history
  - link/open invoice/return detail
- Tab 3:
  - debt timeline
  - add payment
  - adjust target balance
  - ledger/debt reference details

## Recommended Redesign Batches

### Batch A: Customer List Redesign

- Move current list into brown/cream redesign shell
- Add desktop-style sort controls
- Add summary totals row
- Improve inactive row/status treatment
- Keep current backend list query contract unchanged
- Do not change search/filter semantics

### Batch B: Inline Customer Detail / Tabs Redesign

- Add inline expansion or split panel from list
- Introduce tabs:
  - General
  - Sales/Returns History
  - Receivable / Debt
- Reuse current detail API and debt queries
- Add customer sales/return history surface without altering ledger logic

### Batch C: Customer Create/Edit Redesign

- Restyle create/edit into the same visual system
- Decide whether edit should stay separate page or become modal/sheet
- Make balance-adjustment intent obvious from edit flow, even if backend call remains dedicated
- Preserve public restriction against manual `total_sales` editing

### Batch D: Debt Payment / Balance Adjustment Polish

- Upgrade inline forms to clearer transactional panels
- Improve payment history table/readability
- Clarify balance adjustment as target-balance correction
- Keep strict positive amount validation and recompute semantics

### Batch E: Final Cleanup

- unify labels/copy
- remove duplicated visual patterns
- tighten spacing and responsive behavior
- ensure routes, deep-links, and inline views coexist cleanly

## Risks

### High-risk behaviors redesign must not break

- Balance adjustment ledger semantics
  - target balance must append `BALANCE_ADJUSTMENT`
  - no direct current-balance mutation
- Deleted debt payment behavior
  - visible payment disappears
  - all ledger rows for that payment reference are removed
  - later balances recompute correctly
- Customer delete/deactivate rules
  - no hard delete when history exists
- Customer history and ledger correctness
  - ordered recompute by datetime/display_order/id
  - historical `balance_after` snapshots remain correct
- Sales/returns history display
  - redesign may add the UI surface, but it must not flatten or mis-order invoice/return/payment relationships
- Overpayment / negative balance
  - negative balances are allowed
  - overpayment-linked debt rows must remain visible and correctly ordered
- Inactive-customer rules
  - inactive customers hidden by default
  - historical linked inactive customers remain preservable in existing document flows

### Medium-risk redesign traps

- Replacing raw-ledger view with simplified debt cards and losing auditability
- Converting detail to client-only derived history without server-backed ordering
- Collapsing create/edit/balance-adjustment into one form without preserving separate API contracts
- Making list-side detail state fight with route-based navigation

## Recommended Redesign Decision

The safest redesign path is:

1. keep current backend/API contracts intact
2. redesign the customer list first
3. add desktop-style inline detail with tabs
4. expose sales/returns history in the customer module before polishing forms
5. treat debt timeline and balance adjustment as behavior-frozen zones

This keeps the redesign close to desktop operational behavior while still allowing the web app to retain its route structure and modern React composition.

## No-Code-Change Confirmation

This task was investigation and documentation only.

- No application code was changed.
- No frontend behavior was implemented.
- No backend behavior was modified.
