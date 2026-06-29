# Sales + Returns Migration Investigation

## 1. Summary

Phase 3 should migrate sales and returns as first-class web backend modules after the Phase 2 inventory/customer core import. The desktop application treats sales and returns as document workflows that also mutate inventory balances, customer balances, customer ledgers, and customer total sales.

The most important migration constraint is that Phase 2 already imports final inventory balances and final customer balances as snapshots from the desktop `app.db`. Therefore, Phase 3 historical document import must not replay sales/return stock and ledger effects against those already-final balances. Replaying historical invoices naively would double-decrease stock and double-apply customer debt.

The recommended Phase 3 policy is:

- Add PostgreSQL schema for invoices, invoice items, return invoices, return items, and document counters.
- Implement sales/returns services for future web writes that do apply stock and ledger effects transactionally.
- For historical import, import documents and items as history, map old ids to new ids, then reconstruct or import sales/return-linked customer ledger rows in a reconciliation pass without changing the preserved final customer/inventory snapshots incorrectly.
- Recompute ledger `balance_after` for the full customer timeline after Phase 3 ledger rows are restored, then verify final balances still match source customer snapshots.

The copied real `app.db` contains sales dependencies but no return documents. It has 156 invoices, 375 invoice items, 0 return invoices, 0 return items, and 173 deferred ledger rows. Those deferred ledger rows are 134 invoice charge rows and 39 invoice-linked debt payment rows.

## 2. Desktop Files/Tests Inspected

Read-only desktop reference files inspected:

- `QuanLyHangHoa/modules/sales/models.py`
- `QuanLyHangHoa/modules/sales/repository.py`
- `QuanLyHangHoa/modules/sales/service.py`
- `QuanLyHangHoa/modules/sales/controller.py`
- `QuanLyHangHoa/modules/sales/dto.py`
- `QuanLyHangHoa/modules/sales/mappers.py`
- `QuanLyHangHoa/modules/sales/validators.py`
- `QuanLyHangHoa/modules/returns/models.py`
- `QuanLyHangHoa/modules/returns/repository.py`
- `QuanLyHangHoa/modules/returns/service.py`
- `QuanLyHangHoa/modules/returns/dto.py`
- `QuanLyHangHoa/modules/returns/mappers.py`
- `QuanLyHangHoa/modules/returns/validators.py`
- `QuanLyHangHoa/modules/customer/service.py`
- `QuanLyHangHoa/modules/customer/repository.py`
- `QuanLyHangHoa/modules/inventory/service.py`
- `QuanLyHangHoa/modules/inventory/repository.py`
- `QuanLyHangHoa/core/enums.py`
- `QuanLyHangHoa/core/migrations.py`

Relevant tests identified:

- `QuanLyHangHoa/tests/test_sales_service.py`
- `QuanLyHangHoa/tests/test_return_service.py`
- `QuanLyHangHoa/tests/test_customer_history.py`
- `QuanLyHangHoa/tests/test_customer_invoice_payment_migration.py`
- `QuanLyHangHoa/tests/test_ledger_ordering_migration.py`
- `QuanLyHangHoa/tests/test_transaction_history_timestamps.py`
- `QuanLyHangHoa/tests/test_inventory_service.py`
- `QuanLyHangHoa/tests/test_inventory_transactions.py`
- `QuanLyHangHoa/tests/test_order_service.py`
- `QuanLyHangHoa/tests/test_reporting_service.py`
- `QuanLyHangHoa/tests/test_schema_invariants.py`

Web migration documents reviewed:

- `QuanLyHangHoaWeb/docs/MIGRATION_PLAN.md`
- `QuanLyHangHoaWeb/docs/INVENTORY_CUSTOMER_CORE_IMPORT_BATCH6_IMPLEMENTATION.md`
- `QuanLyHangHoaWeb/docs/REAL_CORE_IMPORT_VERIFICATION_BATCH6_FOLLOWUP.md`
- `QuanLyHangHoaWeb/docs/REAL_APP_DB_LEDGER_MISMATCH_INVESTIGATION.md`
- `QuanLyHangHoaWeb/docs/INVENTORY_CUSTOMER_VALIDATOR_POLICY_BATCH5_FOLLOWUP_IMPLEMENTATION.md`

## 3. Sales Business Rules To Preserve

Sales invoices:

- Invoice codes are generated per business date with prefix `HDYYYYMMDD-` and a three-digit sequence in the desktop app.
- Desktop code generation uses `max(invoice_code) + 1`; the web app must replace this with a PostgreSQL-safe counter strategy.
- Invoices are created as `COMPLETED`.
- `customer_id` is nullable. A null customer is a walk-in sale.
- `customer_snapshot_name` is required and preserves display history when the customer row later changes.
- An invoice must contain at least one item.
- Item quantity must be positive.
- Item unit type must be compatible with the product unit mode.
- Product must be active for new invoice creation.
- Product price for the requested unit must exist and be enabled unless a valid manual price/line total is supplied through service rules.
- Unit price may be manually overridden.
- Line total may be manually overridden; if unit price is absent and line total is provided, unit price is derived as `line_total / quantity` rounded to 2 decimal places with `ROUND_HALF_UP`.
- If neither line total nor manual unit price is supplied, line total is `quantity * unit_price`.
- Item snapshots preserve `product_code_snapshot` and `product_name_snapshot`.
- Walk-in invoices must be fully paid or overpaid at creation.
- Customer invoices may be unpaid, partially paid, exactly paid, or overpaid.
- Customer invoice creation increases `customer.total_sales` by invoice total.
- Customer invoice charge creates a customer ledger row:
  - `event_type = INVOICE_CHARGE`
  - `ref_type = INVOICE`
  - `ref_id = invoice.id`
  - `source_ref_type = INVOICE`
  - `source_ref_id = invoice.id`
  - `display_order = 10`
  - `amount_delta = total_amount`
- If `paid_amount > 0`, customer invoice creation creates a source-linked debt payment row:
  - `event_type = DEBT_PAYMENT`
  - `ref_type = DEBT_PAYMENT`
  - `source_ref_type = INVOICE`
  - `source_ref_id = invoice.id`
  - `display_order = 20`
  - `amount_delta = -paid_amount`
- Overpayment is allowed and can make customer balance negative.
- Updating an invoice rolls back prior inventory/customer effects, clears and replaces invoice items, then reapplies the new state atomically.
- Updating invoice datetime synchronizes both invoice charge ledger timestamps and generated invoice payment timestamps.
- Deleting an invoice restores inventory, removes invoice-linked customer ledger effects, removes generated source-linked payments, decreases customer total sales, and deletes the invoice.

## 4. Returns Business Rules To Preserve

Return documents:

- Return codes are generated per business date with prefix `TRYYYYMMDD-` and a three-digit sequence in the desktop app.
- Desktop return code generation uses `max(return_code) + 1`; the web app must replace this with a PostgreSQL-safe counter strategy.
- Return invoices may be linked to a source invoice or created as quick returns without a source invoice.
- `source_invoice_id` is nullable. Null means quick return.
- `customer_id` is nullable. A null customer is walk-in.
- Walk-in returns only support `REFUND_NOW`.
- Linked returns copy customer id and customer snapshot from the source invoice.
- Linked return line quantity cannot exceed the remaining quantity of the source invoice item after previous returns.
- Source invoice item must belong to the selected source invoice.
- Quick return lines validate product active state, unit compatibility, enabled price, positive quantity, and price/line total rules.
- Returns increase inventory stock for returned items.
- Return item snapshots preserve product code/name at return time.
- `STORE_CREDIT` returns for customers reduce customer balance by the full return total and decrease total sales by the full return total.
- `REFUND_NOW` returns for customers decrease total sales by the full return total but only reduce customer balance by `min(current positive balance, return total)`.
- Walk-in returns create no customer ledger rows.
- Updating a return rolls back previous inventory/customer effects, replaces items/effects, and reapplies atomically.
- Updating return datetime synchronizes return ledger timestamps.
- Deleting a return rolls back inventory and customer effects and deletes the return.

## 5. Inventory Integration Rules

Sales and returns integrate with inventory through canonical product balances:

- `BAO_KG` products store canonical stock in `on_hand_bao_decimal`.
- Sales in `BAO` subtract the sold quantity from canonical bao stock.
- Sales in `KG` convert to bao by dividing kilograms by `BAO_TO_KG_RATIO = 25`, then subtract.
- Returns in `BAO` add the returned quantity to canonical bao stock.
- Returns in `KG` convert to bao by dividing by 25, then add.
- `BICH` products store canonical stock in `on_hand_bich_integer`.
- Sales subtract and returns add the `BICH` quantity directly.
- Decimal math must be used throughout; no float math.
- Negative stock is allowed by the desktop business rules.
- Product delete behavior depends on history. Products with invoice or return item history are deactivated, not hard-deleted.

For web concurrency, sales and returns must lock affected inventory balance rows before stock mutation. A single invoice or return should run in one database transaction, with product and inventory balance rows locked in deterministic order by product id to reduce deadlock risk.

## 6. Customer Ledger Integration Rules

Desktop customer balance semantics:

- Customer ledger ordering is by business transaction datetime, then `display_order`, then id.
- Opening balance uses `1900-01-01 00:00:00`.
- Invoice charge rows use `display_order = 10`.
- Invoice-linked debt payment rows use `display_order = 20`.
- Standalone debt payments use `display_order = 30`.
- Customer history UI combines invoice, return, and debt rows with additional display priorities, but persisted ledger recomputation uses ledger ordering.
- Editing debt payments appends rollback and replacement rows instead of mutating the original ledger in place.
- Invoice edits/deletes remove source-linked generated debt payment rows.
- Legacy invoice payment migration backfills source-linked debt payment rows for old invoices with `paid_amount > 0`.
- The desktop migration recomputes affected customer balances after generated invoice payments are inserted.

Return ledger semantics need special attention:

- Desktop return service writes `ref_type = RETURN`.
- Current desktop service does not consistently populate `source_ref_type`, `source_ref_id`, or `display_order` for return balance rows.
- The web service should make return ledger semantics explicit, preferably `source_ref_type = RETURN`, `source_ref_id = return_invoice.id`, and a stable display order, while the importer must still tolerate legacy null source fields.

## 7. Real app.db Findings For Invoices/Returns/Deferred Ledgers

The copied source database inspected read-only:

- `QuanLyHangHoaWeb/backend/validation_sources/real_app_copy.db`

Document counts:

- `invoices`: 156
- `invoice_items`: 375
- `return_invoices`: 0
- `return_invoice_items`: 0
- `customer_balance_ledgers`: 257
- `customers`: 87

Invoice profile:

- Walk-in invoices: 22
- Customer invoices: 134
- Unpaid invoices: 95
- Partial paid invoices: 18
- Exactly paid invoices: 27
- Overpaid invoices: 16
- Invoice status distribution: 156 `COMPLETED`
- Payment method distribution:
  - null: 150
  - `BANK_TRANSFER`: 5
  - `CASH`: 1

Invoice item unit distribution:

- `BICH`: 177 rows, quantity sum 4486
- `BAO`: 162 rows, quantity sum 2192
- `KG`: 36 rows, quantity sum 11756

Deferred ledger rows:

- Total deferred sales/returns ledger dependencies: 173
- Deferred customer count: 80
- Missing invoice references among deferred invoice ledger rows: 0

Deferred distribution:

- `INVOICE_CHARGE` / `INVOICE` / `INVOICE`: 134 rows
- `DEBT_PAYMENT` / `DEBT_PAYMENT` / `INVOICE`: 39 rows

There is no real return history in the copied database. Phase 3 still needs returns schema and service behavior because the desktop app supports returns and future web writes need it, but the first real import reconciliation will be sales-heavy.

## 8. PostgreSQL Target Schema Proposal

Add Phase 3 tables in a dedicated migration after Phase 2:

### invoices

- `id bigint primary key generated by default as identity`
- `invoice_code varchar(64) not null unique`
- `customer_id bigint null references customers(id) on delete set null`
- `customer_snapshot_name varchar not null`
- `invoice_datetime timestamptz not null`
- `total_amount numeric(14,2) not null check total_amount >= 0`
- `paid_amount numeric(14,2) not null default 0 check paid_amount >= 0`
- `payment_method varchar(32) null`
- `status varchar(32) not null`
- `note text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:

- unique `invoice_code`
- `(invoice_datetime, id)`
- `(customer_id, invoice_datetime, id)`
- `(status, invoice_datetime)`

### invoice_items

- `id bigint primary key generated by default as identity`
- `invoice_id bigint not null references invoices(id) on delete cascade`
- `product_id bigint not null references products(id) on delete restrict`
- `unit_type varchar(16) not null`
- `quantity numeric(14,3) not null check quantity > 0`
- `unit_price numeric(14,2) not null check unit_price >= 0`
- `line_total numeric(14,2) not null check line_total >= 0`
- `product_code_snapshot varchar not null`
- `product_name_snapshot varchar not null`

Indexes:

- `(invoice_id, id)`
- `(product_id, invoice_id)`

### return_invoices

- `id bigint primary key generated by default as identity`
- `return_code varchar(64) not null unique`
- `source_invoice_id bigint null references invoices(id) on delete restrict`
- `customer_id bigint null references customers(id) on delete set null`
- `customer_snapshot_name varchar not null`
- `is_quick_return boolean not null default false`
- `return_datetime timestamptz not null`
- `total_amount numeric(14,2) not null check total_amount >= 0`
- `handling_mode varchar(32) not null`
- `note text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Indexes:

- unique `return_code`
- `(return_datetime, id)`
- `(customer_id, return_datetime, id)`
- `(source_invoice_id, return_datetime, id)`

### return_invoice_items

- `id bigint primary key generated by default as identity`
- `return_invoice_id bigint not null references return_invoices(id) on delete cascade`
- `source_invoice_item_id bigint null references invoice_items(id) on delete restrict`
- `product_id bigint not null references products(id) on delete restrict`
- `unit_type varchar(16) not null`
- `quantity numeric(14,3) not null check quantity > 0`
- `unit_price numeric(14,2) not null check unit_price >= 0`
- `line_total numeric(14,2) not null check line_total >= 0`
- `product_code_snapshot varchar not null`
- `product_name_snapshot varchar not null`

Indexes:

- `(return_invoice_id, id)`
- `(source_invoice_item_id, return_invoice_id)`
- `(product_id, return_invoice_id)`

### document_counters

Use a PostgreSQL row-lockable counter table for document codes:

- `id bigint primary key generated by default as identity`
- `document_type varchar(32) not null`
- `business_date date not null`
- `last_number integer not null check last_number >= 0`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- unique `(document_type, business_date)`

This table should generate invoice codes and return codes under `SELECT ... FOR UPDATE`, replacing desktop `max(code) + 1`.

## 9. Service/API Architecture Proposal

Recommended backend modules:

- `backend/app/domain/sales.py`
- `backend/app/domain/returns.py`
- `backend/app/domain/documents.py`
- `backend/app/application/sales_service.py`
- `backend/app/application/return_service.py`
- `backend/app/infrastructure/db/models/sales.py`
- `backend/app/infrastructure/db/models/returns.py`
- `backend/app/infrastructure/db/repositories/sales.py`
- `backend/app/infrastructure/db/repositories/returns.py`
- `backend/app/schemas/sales.py`
- `backend/app/schemas/returns.py`
- `backend/app/api/routes/sales.py`
- `backend/app/api/routes/returns.py`

Service design:

- Repositories remain thin and receive explicit SQLAlchemy sessions.
- Services own business rules and transaction orchestration.
- Mutating service methods should lock all affected rows explicitly.
- Sales and returns services should depend on inventory and customer services or shared domain helpers, not duplicate stock and ledger rules.
- API routes should be added after schema/service/import risks are handled.

Suggested API surface later:

- `GET /api/sales/invoices`
- `POST /api/sales/invoices`
- `GET /api/sales/invoices/{invoice_id}`
- `PATCH /api/sales/invoices/{invoice_id}`
- `DELETE /api/sales/invoices/{invoice_id}`
- `GET /api/returns`
- `POST /api/returns`
- `POST /api/returns/quick`
- `GET /api/returns/{return_id}`
- `PATCH /api/returns/{return_id}`
- `DELETE /api/returns/{return_id}`

## 10. Import Strategy Options

### Option A: Replay historical invoices/returns through services

This is not recommended after Phase 2. Phase 2 already imported final stock and customer balances, so replaying invoices/returns would double-apply effects.

### Option B: Import historical documents only and leave ledgers partial

This is safer for inventory but leaves `can_import_full_ledger=false` and does not resolve the 173 deferred ledger rows.

### Option C: Import documents and reconstruct the full customer ledger timeline without changing final snapshots

This is recommended. It restores invoice/return documents, imports or regenerates their ledger dependencies, recomputes `balance_after` for the full timeline, and verifies final customer balances match the preserved source snapshots.

### Option D: Rebuild source state from pre-history opening balances and replay all documents

This would be conceptually clean but is not currently practical because the source database does not preserve reliable pre-sales inventory/customer starting balances separately from final snapshots.

## 11. Recommended Import Policy

Phase 3 import should run after a successful Phase 2 core import and should require Phase 2 id mappings.

Recommended policy:

- Import invoices and invoice items as historical documents.
- Import return invoices and return items when present, even though the current real copy has none.
- Map old product/customer ids through Phase 2 mappings.
- Preserve invoice and return codes from source; document counters only apply to future web-created documents.
- Preserve customer/product snapshots from source documents.
- Do not apply stock mutations during historical import.
- Do not update imported inventory balances from historical document replay.
- Preserve `customers.current_balance` and `customers.total_sales` from the source snapshot unless a reconciliation step proves an intentional correction is needed.
- Restore deferred customer ledger rows into the ledger table using new document ids.
- For invoice charge ledger rows, map `ref_id`, `source_ref_id` to the new invoice id.
- For invoice-linked payment rows, create or reuse `debt_payments` parent rows and map ledger `ref_id` to the new debt payment id; map `source_ref_id` to the new invoice id.
- For return ledger rows, map `ref_id` to the new return id and tolerate legacy null `source_ref_type/source_ref_id`.
- Recompute `balance_after` for the full imported ledger timeline instead of preserving stale intermediate `balance_after` values from the source.
- Verify every customer's final recomputed balance equals the source `customers.current_balance`.
- If a customer final balance cannot be reconciled, fail the import.
- Verify final inventory balances remain equal to Phase 2/source snapshots.
- Emit an explicit report showing imported document counts, restored ledger counts, skipped/ambiguous rows, and reconciliation results.

## 12. Concurrency/Document-Code Risks

Key risks:

- Desktop `max(code) + 1` document generation is not safe under concurrent web requests.
- Concurrent invoices for the same product can lose stock updates without row locks.
- Concurrent returns and invoices against the same product can deadlock if product rows are locked in inconsistent order.
- Concurrent invoices/payments for the same customer can corrupt `balance_after` if customer and ledger rows are not locked.
- Linked return quantity checks require locking the source invoice item and existing return item rows, otherwise two concurrent returns can exceed the original sold quantity.
- Invoice edit/delete and return edit/delete must rollback and reapply effects atomically.
- Generated invoice payment rows must be grouped by `debt_payments.id` in the web schema; the desktop generated ref id strategy should not be reused.
- Historical import must distinguish "document history restoration" from "business effect replay".

Recommended locking patterns:

- Generate document codes through `document_counters` using `SELECT ... FOR UPDATE`.
- Lock invoice/return rows before edit/delete.
- Lock customer row before writing customer ledger rows or recomputing balance.
- Lock affected inventory balance rows before stock mutation.
- Lock products and inventory balances in deterministic product id order for multi-line documents.
- For linked returns, lock source invoice items and existing return rows for the source invoice item before validating remaining quantity.
- Flush inserted ledger rows before recompute so ids are stable for ordering.

## 13. Recommended Implementation Batches

Recommended Phase 3 sequence:

1. Batch 7: Sales/returns schema and document counter foundation.
   - Add invoices, invoice_items, return_invoices, return_invoice_items, and document_counters.
   - Add Alembic migration and metadata tests.
   - Add enum/domain constants for payment method, invoice status, and return handling mode.

2. Batch 8: Sales/returns service foundation.
   - Implement repositories and services.
   - Preserve desktop business rules for invoice creation/update/delete and return creation/update/delete.
   - Add service tests using fast SQLite-compatible fixtures plus PostgreSQL integration tests for locking/counters.

3. Batch 9: Sales/returns import validator and importer.
   - Validate invoice/return source data and references.
   - Import historical documents without replaying stock/customer effects.
   - Restore deferred invoice/return ledger dependencies.
   - Recompute ledger timeline and verify final customer balances.
   - Run real copied DB dry-run and disposable PostgreSQL import verification.

4. Batch 10: Sales/returns FastAPI endpoints.
   - Add API request/response schemas and routes.
   - Add API tests for create/update/delete, stock effects, ledger effects, overpayment, walk-in rules, and return quantity ceilings.

5. Batch 11: Admin web UI workflows.
   - Build frontend views only after backend behavior and import strategy are stable.

## 14. Explicit Out-of-Scope Items

Out of scope for this investigation:

- No code implementation.
- No database mutation.
- No source SQLite mutation.
- No desktop reference repository modification.
- No actual sales/returns import execution.
- No React frontend implementation.
- No attendance migration.
- No reporting migration.
- No order migration beyond noting that converted orders can apply sales effects in existing desktop tests.
- No production cutover plan beyond Phase 3 import policy.
