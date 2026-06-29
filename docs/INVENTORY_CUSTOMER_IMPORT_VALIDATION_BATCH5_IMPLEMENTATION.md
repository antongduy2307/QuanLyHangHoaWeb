# Inventory + Customer Import Validation Batch 5 Implementation

## Summary

Phase 2 Batch 5 adds a read-only validator for the desktop SQLite `app.db`. The validator inspects inventory/customer core tables and reports whether the data is safe for a later PostgreSQL import.

This batch does not import data, mutate SQLite, modify the desktop reference repo, or implement sales, returns, orders, reporting, attendance, receipts, adjustments, auth, or frontend UI.

## Files Created or Modified

Created:

- `backend/app/importers/__init__.py`
- `backend/app/importers/app_db_inventory_customer_validator.py`
- `backend/app/importers/validate_app_db.py`
- `backend/tests/importers/test_app_db_inventory_customer_validator.py`
- `docs/INVENTORY_CUSTOMER_IMPORT_VALIDATION_BATCH5_IMPLEMENTATION.md`

## Validator Behavior

The validator accepts a path to a desktop SQLite `app.db` and opens it read-only with SQLite URI mode.

It validates:

- required core tables exist;
- product identity, normalized code uniqueness, unit modes, prices, enabled price rules, and inventory balances;
- customer names, balances, total sales, duplicate phones, and active/inactive compatibility;
- ledger customer references, event/ref fields, numeric precision, ordering recomputation, customer balance agreement, legacy ordering/source columns, missing transaction timestamps, and invoice/return-linked deferred dependencies.

The output is deterministic and structured:

- `ValidationIssue`
- `ValidationSummary`
- `ValidationResult`

`ValidationResult.can_import_core` is `false` when any blocking error exists.

## Issue Severity Policy

Errors block import:

- missing required core tables;
- blank product code/name;
- duplicate normalized product code;
- invalid unit mode;
- incompatible product price unit;
- duplicate product price unit rows;
- active product without an enabled valid price;
- enabled price not positive;
- missing or duplicate inventory balance;
- canonical inventory balance mismatch;
- blank customer name;
- negative `total_sales`;
- numeric values that do not fit target precision;
- ledger rows referencing missing customers;
- blank ledger `event_type`/`ref_type`;
- ledger `balance_after` recomputation mismatch;
- customer `current_balance` mismatch.

Warnings do not block import:

- duplicate customer phone;
- missing legacy ledger columns such as `source_ref_type`, `source_ref_id`, or `display_order`;
- missing ledger `transaction_datetime`, with `created_at` fallback;
- invoice/return-linked ledger rows deferred to later sales/returns migration phases.

Info notes do not block import:

- negative inventory balances, because negative stock is valid desktop behavior and should be preserved.

Design decision: missing inventory balance is a blocking error because Phase 2 product import needs a canonical balance row for every product.

## CLI Usage

Run from `backend/`:

```powershell
python -m app.importers.validate_app_db --app-db "path\to\app.db"
```

Optional JSON report:

```powershell
python -m app.importers.validate_app_db --app-db "path\to\app.db" --json-out "validation_report.json"
```

Exit codes:

- `0`: no blocking errors
- `1`: blocking validation errors exist
- `2`: invalid input path or unreadable database

The CLI prints a concise human summary to stdout and writes the full structured report when `--json-out` is supplied.

## Tests Added

Tests create temporary SQLite databases under the backend workspace to avoid Windows system temp permission issues.

Covered cases:

- valid minimal `app.db` passes;
- missing required table returns blocking error;
- duplicate normalized product code returns blocking error;
- invalid product unit/price combination returns blocking error;
- active product without enabled price returns blocking error;
- missing inventory balance is blocking;
- negative stock is informational, not blocking;
- blank customer name returns blocking error;
- negative `total_sales` returns blocking error;
- ledger references missing customer returns blocking error;
- customer current balance mismatch returns blocking error;
- invoice-linked ledger rows are reported as deferred dependency warnings;
- duplicate phone is warning only;
- CLI returns expected exit codes and writes JSON.

## Commands Run and Results

From `backend/`:

- `pytest tests/importers/test_app_db_inventory_customer_validator.py`
  - Result: `14 passed`
- `pytest`
  - Result: `77 passed, 3 skipped`
- `python -m compileall app tests`
  - Result: passed
- `pytest -m postgres`
  - Environment: `DATABASE_URL` and `TEST_DATABASE_URL` pointed at Docker PostgreSQL on host port `5433`
  - Result: `3 passed, 77 deselected`

## Caveats and Next Steps

- The validator reports import readiness only; it does not write PostgreSQL rows.
- Invoice/return-linked ledgers are flagged as deferred dependencies because sales/returns migration is out of scope.
- Attendance data is not validated here because attendance lives in a separate desktop SQLite database.
- A later batch should run the validator against representative real `app.db` copies and save reports for migration planning.
- The eventual import executor should reuse these validation rules before writing any PostgreSQL data.
