# Inventory + Customer Core Import Batch 6 Implementation

## Summary

Batch 6 adds a Phase 2 import executor for desktop SQLite `app.db` inventory/customer core data. The executor validates the source first, builds a structured import plan/report, supports dry-run mode, and can import into an empty target database transactionally.

This batch does not import sales, returns, orders, reports, attendance, receipts, adjustments, document counters, auth, or frontend UI.

## Import Policy Decisions

Source database:

- Opened read-only with SQLite URI mode.
- Must pass `validator.can_import_core=true`.
- Source `app.db` is never mutated.

Target database:

- Actual import requires empty `products`, `customers`, `customer_balance_ledgers`, and `debt_payments` tables.
- Actual import runs inside one SQLAlchemy transaction.
- Any write failure rolls back the whole import.

Inventory:

- Imports all products, product prices, and inventory balances.
- Preserves disabled prices and negative inventory balances.
- Maps old SQLite product ids to new target product ids.
- Preserves timestamps when present, otherwise uses current timestamp.

Customers:

- Imports all customers and preserves source `current_balance` as the desktop customer snapshot.
- Maps old SQLite customer ids to new target customer ids.
- Preserves optional profile fields and active/walk-in flags.

Customer ledgers:

- Imports Phase 2 core ledger rows only:
  - `OPENING_BALANCE`
  - `BALANCE_ADJUSTMENT`
  - standalone `DEBT_PAYMENT`
  - standalone `DEBT_PAYMENT_EDIT_ROLLBACK`
- Skips/de defers invoice/return-linked rows for later sales/returns migration.
- Recomputes imported core-subset ledger `balance_after` values after insert.
- Does not claim the partial imported core ledger explains `customers.current_balance` when invoice/return rows were skipped.

Debt payments:

- Creates `debt_payments` parent rows for standalone debt payment groups.
- Remaps imported `DEBT_PAYMENT` ledger `ref_id` to the new `debt_payments.id`.
- Keeps rollback/replacement rows in the same standalone debt payment group where possible.
- Skips ambiguous debt payment groups with warnings.

## Files Created or Modified

Created:

- `backend/app/importers/app_db_core_importer.py`
- `backend/app/importers/import_app_db_core.py`
- `backend/tests/importers/test_app_db_core_importer.py`
- `backend/inventory_customer_core_import_plan_real_app.json`
- `docs/INVENTORY_CUSTOMER_CORE_IMPORT_BATCH6_IMPLEMENTATION.md`

## CLI Usage

Dry-run:

```powershell
python -m app.importers.import_app_db_core --app-db "path/to/app.db" --database-url "postgresql+psycopg://..." --dry-run --json-out "core_import_plan.json"
```

Actual import:

```powershell
python -m app.importers.import_app_db_core --app-db "path/to/app.db" --database-url "postgresql+psycopg://..." --json-out "core_import_report.json"
```

Exit codes:

- `0`: success or dry-run success.
- `1`: validation/import error.
- `2`: invalid source path or command/config failure.

## Report Output

The structured report includes:

- source app DB path;
- dry-run flag;
- validation summary and readiness flags;
- imported/planned counts;
- deferred/skipped counts;
- mapping counts;
- actual id mappings for non-dry-run imports;
- warnings;
- errors;
- `can_proceed_to_sales_returns_migration`.

## Tests Added

`backend/tests/importers/test_app_db_core_importer.py` covers:

- dry-run plan with no target writes;
- actual product/price/balance/customer import;
- old-to-new product/customer mappings;
- negative inventory preservation;
- inactive product/customer preservation;
- validator-blocked invalid source;
- non-empty target blocking;
- invoice-linked ledger deferral;
- source DB not modified;
- standalone debt payment parent creation and ledger ref remapping;
- debt payment edit group under one parent payment;
- rollback on simulated write failure;
- CLI dry-run JSON output and exit code.

## Real DB Dry-run Result

Command run from `backend/`:

```powershell
python -m app.importers.import_app_db_core --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://unused:unused@localhost:5433/unused" --dry-run --json-out "inventory_customer_core_import_plan_real_app.json"
```

Result:

- exit code: `0`
- success: `true`
- dry_run: `true`
- validator `can_import_core=true`
- validator `can_import_full_ledger=false`

Planned/importable counts:

- products: 23
- product_prices: 30
- inventory_balances: 23
- customers: 87
- debt_payments: 22
- customer_ledgers: 84

Deferred/skipped counts:

- deferred sales/returns ledgers: 173
- ambiguous debt payment groups: 0
- unsupported core ledgers: 0

Mapping counts:

- product id mappings: 23
- customer id mappings: 87
- debt payment mappings: 22

The dry-run did not connect to or write a target database.

## Commands Run and Results

From `backend/`:

- `pytest tests/importers/test_app_db_core_importer.py`
  - Result: `12 passed`
- `pytest`
  - Result: `94 passed, 3 skipped`
- `python -m compileall app tests`
  - Result: passed
- Real copied DB dry-run command above
  - Result: exit code `0`

`pytest -m postgres` was not run separately because `TEST_DATABASE_URL` was not set in this shell. The full test suite skipped the three PostgreSQL integration tests clearly.

## Caveats and Next Steps

- Actual import into PostgreSQL was not run against the real copied DB because no disposable target database was explicitly provided.
- Partial imported customer ledgers intentionally do not reconcile to source `current_balance` when sales/return rows are deferred.
- Full historical ledger import remains a later Phase 3 sales/returns concern.
- Before any real import, run the command against a disposable PostgreSQL database and review the JSON report.
- A later batch should add PostgreSQL-marked integration tests for the actual import path once `TEST_DATABASE_URL` is available.
