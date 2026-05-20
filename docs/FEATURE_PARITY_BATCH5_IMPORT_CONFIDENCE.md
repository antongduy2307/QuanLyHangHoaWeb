# Feature Parity Batch 5: Import/Cutover Confidence

## Summary

Batch 5 re-verified import/cutover confidence after the inventory, sales, and returns parity changes from Batches 2 to 4. This batch did not add product features or redesign UI. It repeated the full disposable PostgreSQL rehearsal on Docker port `5433`, reran the full import verifier, strengthened import-confidence tests for the recent parity changes, and reran the backend test suite with PostgreSQL coverage enabled.

## DB Source Used

- Source DB: `backend/validation_sources/real_app_copy.db`
- Selection basis: latest populated copied desktop `app.db` available in the workspace
- SHA-256: `62481F5931F307FB27173E6E3D4199B384E7886DCBE5B96A6C70A4C19FE65F54`

Observed source counts:

- `products=23`
- `product_prices=30`
- `inventory_balances=23`
- `customers=87`
- `customer_balance_ledgers=257`
- `invoices=156`
- `invoice_items=375`
- `return_invoices=0`
- `return_invoice_items=0`

Because the real copied DB still has zero returns, synthetic return fixture verification remains part of the confidence story and was retained/strengthened in tests.

## Live Rehearsal Result

Docker PostgreSQL on host port `5433` was started successfully and a fresh disposable rehearsal database was created:

- rehearsal DB: `quanlyhanghoa_web_batch5_import_verify`
- postgres-test DB: `quanlyhanghoa_web_batch5_import_verify_test`

### Phase 2 Core Import

Result: success

Counts:

- `products=23`
- `product_prices=30`
- `inventory_balances=23`
- `customers=87`
- `debt_payments=22`
- `customer_ledgers=84`
- deferred sales/returns ledgers: `173`
- ambiguous debt payment groups: `0`
- unsupported core ledgers: `0`

### Phase 3 Sales / Returns Import

Result: success

Counts:

- `invoices=156`
- `invoice_items=375`
- `return_invoices=0`
- `return_invoice_items=0`
- `invoice_charge_ledgers=134`
- `invoice_payment_ledgers=39`
- `return_ledgers=0`

### Full Import Verifier

Result: passed

Verifier summary:

- `all_passed=true`
- `products=23`
- `customers=87`
- `invoices=156`
- `customer_ledgers=257`
- `debt_payments=61`

Imported rehearsal DB counts matched expectations:

- `products=23`
- `product_prices=30`
- `inventory_balances=23`
- `customers=87`
- `customer_balance_ledgers=257`
- `debt_payments=61`
- `invoices=156`
- `invoice_items=375`
- `return_invoices=0`
- `return_invoice_items=0`

Verified by the live rehearsal + verifier:

- products / prices / balances
- customers / debt payments / ledgers
- invoices / items
- returns / items when present in source: source has `0`, so none imported from real copy
- customer balance reconciliation
- inventory balance reconciliation
- no orphan invoice items
- no orphan ledger customer refs
- no orphan invoice ledger refs
- no orphan invoice-linked debt payment refs
- no duplicate invoice codes
- no duplicate return codes

## Document Counter Safety After Import

Document-code generation was rechecked against the imported rehearsal database in a rolled-back session using `DocumentService`.

Observed next codes for business date `2026-05-16`:

- `next_invoice=HD20260516-001`
- `next_return=TR20260516-001`

This confirms the post-import code-generation path remains safe and scans imported rows rather than trusting counters blindly. Batch 3 and Batch 4 importer/unit tests also now explicitly cover imported-row scan behavior for invoices and returns.

## Synthetic Return Confidence

Since the real copied DB still has zero returns, Batch 5 kept synthetic return proof as a required supplement:

- importer tests verify synthetic `return_invoices`
- importer tests verify synthetic `return_invoice_items`
- importer tests verify linked customer return ledgers
- importer tests verify product/customer/invoice/return mapping
- importer tests verify final customer balance reconciliation
- importer tests now verify imported return ledger `display_order == 0`

## Import-Confidence Test Updates

This batch added or tightened checks specifically affected by the recent parity changes:

- `STOCK_SET` compatibility:
  - PostgreSQL schema test now verifies `stock_adjustments` exists after `alembic upgrade head`
  - schema constraints still allow `STOCK_SET`
- return `display_order=0`:
  - synthetic return import fixture now uses desktop-aligned `display_order=0`
  - importer test asserts imported return ledger rows preserve `display_order == 0`
- imported-row document counter safety:
  - importer test now proves `DocumentService.next_invoice_code(...)` and `next_return_code(...)` generate the next non-colliding code after imported rows
- PostgreSQL integration expectation update:
  - corrected a stale postgres protected-route test that still sorted ledgers by `display_order` only, which no longer matches the actual recomputation contract after return `display_order=0`

## Files Changed

- `backend/tests/importers/test_app_db_sales_returns_importer.py`
- `backend/tests/integration/test_postgres_schema.py`
- `backend/tests/integration/test_protected_api_postgres.py`
- `docs/FEATURE_PARITY_BATCH5_IMPORT_CONFIDENCE.md`

## Rehearsal Artifacts

- `backend/batch5_full_rehearsal_core_import_report.json`
- `backend/batch5_full_rehearsal_sales_returns_import_report.json`
- `backend/batch5_full_rehearsal_verification_result.json`
- `backend/batch5_core_import_plan_real_app.json`
- `backend/batch5_sales_returns_import_plan_real_app.json`

## Commands / Results

Environment / rehearsal:

- `docker compose up -d postgres` -> passed
- `docker compose ps` -> postgres up on `5433`
- PostgreSQL connectivity probe on `5433` -> passed
- disposable DB creation for rehearsal + test DBs -> passed
- `alembic upgrade head` on rehearsal DB -> passed
- empty-table verification on fresh rehearsal DB -> passed
- `python -m app.importers.import_app_db_core ...` -> passed
- `python -m app.importers.import_app_db_sales_returns ...` -> passed
- `python -m app.importers.full_import_rehearsal_verifier ...` -> passed

Backend verification:

- `uv run pytest` with `TEST_DATABASE_URL` set to the fresh `5433` test DB -> passed, `290 passed`
- `uv run pytest -m postgres` with `TEST_DATABASE_URL` set to the fresh `5433` test DB -> passed, `22 passed`
- `python -m compileall app tests` -> passed

## Confidence Assessment

Current confidence after retry:

- latest copied desktop DB chosen and inspected: verified
- live disposable PostgreSQL rehearsal on Docker `5433`: verified
- Phase 2 core import into fresh DB: verified
- Phase 3 sales/returns import into same DB: verified
- full import verifier: verified
- source-zero-returns branch covered by synthetic return fixture/tests: verified
- `STOCK_SET` import/rehearsal compatibility: verified
- return `display_order=0` import assumption: verified
- document counter safety after import: verified
- backend default + postgres-marked test suites: verified

## Cutover Status

Production cutover is still not approved in this batch, but the import/cutover confidence rehearsal is now materially stronger and live-verified on the disposable Docker/PostgreSQL path described by the runbook.
