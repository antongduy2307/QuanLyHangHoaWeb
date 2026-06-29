# Sales/Returns Import Batch 10 Implementation

## Summary

Phase 3 Batch 10 adds historical sales/returns validation and import tooling.

This importer is separate from the web-created sales/returns services. It directly restores historical documents and deferred ledger rows and does not call `SalesService.create_invoice` or `ReturnService.create_return`, because Phase 2 already imports final inventory/customer snapshots.

No FastAPI endpoints, frontend UI, attendance/order/reporting migration, production cutover, or source SQLite mutation were implemented.

## Files Created Or Modified

Created:

- `backend/app/importers/app_db_sales_returns_importer.py`
- `backend/app/importers/import_app_db_sales_returns.py`
- `backend/tests/importers/test_app_db_sales_returns_importer.py`
- `backend/sales_returns_import_plan_real_app.json`
- `docs/SALES_RETURNS_IMPORT_BATCH10_IMPLEMENTATION.md`

## Import Policy

Documents:

- Imports `invoices` and `invoice_items` as historical documents.
- Imports `return_invoices` and `return_invoice_items` when present.
- Preserves source document codes, business datetimes, status, payment method, notes, totals, and snapshots.
- Maps old product/customer ids through the Phase 2 core import report.
- Refuses actual import if target already has invoices or returns.
- Runs actual import inside one SQLAlchemy transaction.

Inventory:

- Does not apply invoice stock decreases.
- Does not apply return stock increases.
- Verifies inventory balances are unchanged before/after actual import.

Customers:

- Does not mutate customer balances or total sales from document totals directly.
- Restores deferred customer ledger rows and recomputes full ledgers.
- Verifies recomputed final customer balances match source `customers.current_balance`.

Mappings:

- Requires a Phase 2 core import JSON report.
- Uses `product_id_map` and `customer_id_map`.
- Fails clearly if mappings are missing instead of guessing ids.

## Validation Policy

The validator/import planner checks:

- required source tables exist;
- invoice codes are non-blank and unique;
- invoice customer references exist when present;
- invoice status is recognized;
- invoice totals and paid amounts are numeric and non-negative;
- invoice item invoice/product references exist;
- invoice item quantity is positive;
- invoice item unit type is compatible with source product unit mode;
- invoice item prices/totals are non-negative;
- invoice item snapshots are non-blank;
- invoice item total sum differences are warnings;
- return code uniqueness and references when return rows exist;
- linked return item source references and aggregate returned quantity ceilings;
- deferred invoice/return ledger rows reference existing source documents;
- Phase 2 mappings cover every product/customer needed by documents and deferred ledgers.

Zero return rows are accepted.

## Ledger Restoration Policy

Restored invoice charge ledgers:

- Map customer ids through Phase 2 customer mappings.
- Map `ref_id` and `source_ref_id` to the new invoice id.
- Preserve amount, display order, transaction datetime, created datetime, and note.

Restored invoice payment ledgers:

- Create source-linked `DebtPayment` parent rows.
- Map ledger `ref_id` to the new `DebtPayment.id`.
- Map `source_ref_id` to the new invoice id.
- Preserve payment amount, datetime, note, and ledger ordering data.

Restored return ledgers:

- Map return references to new return ids.
- Normalize source ids when source fields are present.
- Preserve ledger amount/order/datetime fields.

After restoring all deferred rows, the importer recomputes every customer ledger timeline and verifies final customer balances against the source snapshot.

## CLI Usage

Dry-run:

```powershell
python -m app.importers.import_app_db_sales_returns --app-db "path/to/app.db" --database-url "postgresql+psycopg://..." --core-import-report "core_import_report.json" --dry-run --json-out "sales_returns_import_plan.json"
```

Actual import:

```powershell
python -m app.importers.import_app_db_sales_returns --app-db "path/to/app.db" --database-url "postgresql+psycopg://..." --core-import-report "core_import_report.json" --json-out "sales_returns_import_report.json"
```

Exit codes:

- `0`: success or dry-run success
- `1`: validation/import/reconciliation failure
- `2`: invalid input path/config/command failure

## Tests Added

`backend/tests/importers/test_app_db_sales_returns_importer.py` covers:

- dry-run counts for a valid invoice fixture;
- actual document import without inventory balance changes;
- invoice charge ledger restoration and id remapping;
- invoice-linked payment ledger restoration with `DebtPayment` parent creation;
- full customer ledger recomputation;
- missing mapping report failure;
- missing product/customer mapping failure;
- invalid invoice item product reference failure;
- duplicate invoice code failure;
- non-empty target document blocking;
- source DB read-only behavior;
- rollback on simulated import failure;
- zero returns accepted;
- minimal linked return import;
- CLI dry-run JSON output;
- PostgreSQL integration for Phase 2 core import followed by Phase 3 sales import.

## Commands Run And Results

From `backend/`:

```powershell
pytest tests\importers\test_app_db_sales_returns_importer.py
```

Result:

```text
9 passed, 1 skipped
```

```powershell
pytest
```

Result:

```text
143 passed, 10 skipped
```

```powershell
python -m compileall app tests
```

Result: passed.

With Docker PostgreSQL available on host port `5433`:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web'; pytest -m postgres
```

Result:

```text
10 passed, 143 deselected
```

## Real DB Dry-run Result

Command:

```powershell
python -m app.importers.import_app_db_sales_returns --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://unused:unused@localhost:5433/unused" --core-import-report "inventory_customer_core_import_report_real_db.json" --dry-run --json-out "sales_returns_import_plan_real_app.json"
```

Result:

```text
Sales/returns historical import dry-run: success=true, can_import_full_ledger=true
Counts: invoices=156, invoice_items=375, return_invoices=0, return_invoice_items=0, invoice_charge_ledgers=134, invoice_payment_ledgers=39, return_ledgers=0
```

JSON report:

- `backend/sales_returns_import_plan_real_app.json`

Dry-run planned counts:

- invoices: 156
- invoice_items: 375
- return_invoices: 0
- return_invoice_items: 0
- restored invoice charge ledgers: 134
- restored invoice payment ledgers: 39
- restored return ledgers: 0
- created source-linked debt payments: 39
- errors: 0
- warnings: 0
- `can_import_full_ledger=true`

The copied source DB was opened read-only. Its observed metadata after dry-run:

- path: `backend/validation_sources/real_app_copy.db`
- size: `331776`
- `LastWriteTimeUtc`: `2026-05-14 08:06:50`

## Caveats And Next Steps

- The real copied DB was dry-run only; no actual sales/returns import was run into PostgreSQL in this batch.
- Actual real import should be rehearsed against a fresh disposable PostgreSQL database that already contains a successful Phase 2 core import.
- The importer validates and restores historical data but does not yet provide a user-facing API.
- Sales/returns FastAPI endpoints remain a later batch.
- Full production cutover still needs a repeatable disposable import rehearsal, audit artifacts, and rollback plan.
