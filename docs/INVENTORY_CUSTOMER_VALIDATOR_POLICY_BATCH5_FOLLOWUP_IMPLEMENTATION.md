# Inventory + Customer Validator Policy Batch 5 Follow-up Implementation

## Summary

This follow-up updates the read-only desktop `app.db` validator so invoice/return-dependent row-level ledger `balance_after` mismatches no longer block Phase 2 inventory/customer core import readiness when the customer's final `current_balance` still matches the recomputed ledger balance.

The validator now reports two readiness flags:

- `can_import_core`: Phase 2 inventory/customer readiness.
- `can_import_full_ledger`: later full historical ledger readiness for sales/returns migration.

No import executor was added. No SQLite or PostgreSQL data was mutated.

## Files Created or Modified

Modified:

- `backend/app/importers/app_db_inventory_customer_validator.py`
- `backend/app/importers/validate_app_db.py`
- `backend/tests/importers/test_app_db_inventory_customer_validator.py`

Created:

- `backend/inventory_customer_validation_report_after_policy_update.json`
- `docs/INVENTORY_CUSTOMER_VALIDATOR_POLICY_BATCH5_FOLLOWUP_IMPLEMENTATION.md`

## Readiness Policy

Core import readiness remains blocked by core validation errors, including:

- invalid product/customer/inventory data;
- ledger rows referencing missing customers;
- blank ledger event/ref values;
- numeric precision failures;
- final `customer_current_balance_mismatch`;
- row-level `ledger_balance_after_mismatch` in pure customer/debt-only timelines.

Row-level ledger mismatches are downgraded for core readiness when:

- the customer timeline contains deferred invoice/return dependencies; and
- the final `customers.current_balance` matches the recomputed final ledger balance.

Full ledger readiness is stricter:

- `can_import_full_ledger=false` whenever any row-level ledger mismatch exists, including downgraded invoice/return-dependent mismatches.

## Issue Code Changes

Kept:

- `error.ledger_balance_after_mismatch` for blocking pure-core row-level mismatches.
- `error.customer_current_balance_mismatch` for final customer balance mismatches.
- `warning.deferred_sales_return_ledger_dependency` for invoice/return-linked rows.

Added:

- `warning.ledger_balance_after_mismatch_deferred_dependency`

Message:

> Ledger balance_after mismatch occurs in a customer timeline with deferred invoice/return dependencies; downgraded for core import readiness but must be reconciled during full ledger migration.

## Summary Fields Added

The JSON output keeps existing fields and adds:

- `can_import_full_ledger`
- `summary.affected_ledger_mismatch_customer_count`
- `summary.deferred_ledger_mismatch_count`
- `summary.blocking_ledger_mismatch_count`
- `summary.customers_current_balance_matched_count`
- `summary.customers_current_balance_mismatch_count`

## CLI Behavior

`python -m app.importers.validate_app_db` now prints both readiness flags and ledger readiness statistics.

Exit code remains based on `can_import_core`:

- `0`: core import readiness is true.
- `1`: core import readiness is false.
- `2`: invalid path or unreadable database input.

## Tests Added or Updated

Updated importer tests cover:

- pure customer/debt-only row-level mismatch remains a blocking error;
- invoice-linked row-level mismatch is downgraded to warning when final balance matches;
- non-invoice row-level mismatch in a customer timeline with invoice dependencies is downgraded to warning when final balance matches;
- final customer balance mismatch remains blocking even with deferred invoice rows;
- `can_import_full_ledger=false` when any row-level mismatch exists;
- CLI exit code follows `can_import_core`, not `can_import_full_ledger`;
- JSON output includes both readiness flags.

## Real DB Validation Before/After

Input copy:

- `backend/validation_sources/real_app_copy.db`

Before policy update:

- products: 23
- product_prices: 30
- inventory_balances: 23
- customers: 87
- ledgers: 257
- errors: 78
- warnings: 173
- info: 20
- `can_import_core=false`
- blocking issue: `error.ledger_balance_after_mismatch = 78`

After policy update:

- products: 23
- product_prices: 30
- inventory_balances: 23
- customers: 87
- ledgers: 257
- errors: 0
- warnings: 251
- info: 20
- `can_import_core=true`
- `can_import_full_ledger=false`
- affected ledger mismatch customers: 34
- deferred ledger mismatches: 78
- blocking ledger mismatches: 0
- customers current balance matched: 87
- customers current balance mismatches: 0

After-policy issue counts:

- `warning.deferred_sales_return_ledger_dependency = 173`
- `warning.ledger_balance_after_mismatch_deferred_dependency = 78`
- `info.negative_inventory_balance = 20`

## Commands Run and Results

From `backend/`:

- `pytest tests/importers/test_app_db_inventory_customer_validator.py`
  - Result: `19 passed`
- `pytest`
  - Result: `82 passed, 3 skipped`
- `python -m compileall app tests`
  - Result: passed
- `python -m app.importers.validate_app_db --app-db "validation_sources/real_app_copy.db" --json-out "inventory_customer_validation_report_after_policy_update.json"`
  - Result: exit code `0`; `can_import_core=true`; `can_import_full_ledger=false`

PostgreSQL marker tests were not run separately because `TEST_DATABASE_URL` was not set in this shell. The full pytest run skipped the three PostgreSQL integration tests clearly.

## Caveats and Next Steps

- The validator still does not import data.
- The copied real SQLite DB was opened read-only by the validator.
- Full historical ledger readiness remains false until sales/returns invoice-linked ledger behavior is migrated and reconciled.
- The next import-planning step should use `can_import_core` for Phase 2 product/customer readiness and preserve `can_import_full_ledger` as a Phase 3 sales/returns gate.
