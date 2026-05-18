# Full Import Rehearsal: Phase 2 + Phase 3

## Summary

This rehearsal executed a complete disposable PostgreSQL import from the copied desktop SQLite database:

- source: `backend/validation_sources/real_app_copy.db`
- target: `quanlyhanghoa_web_full_import_verify`
- PostgreSQL host port: `5433`

The rehearsal completed successfully:

1. Created a fresh disposable PostgreSQL database.
2. Applied Alembic migrations through `head`.
3. Ran Phase 2 inventory/customer core actual import.
4. Ran Phase 3 sales/returns historical actual import.
5. Verified final counts, reference integrity, inventory snapshots, customer snapshots, and full customer ledger reconciliation.

No source SQLite data was modified. No files under the desktop reference repository were modified.

## Disposable DB Used

Docker PostgreSQL service:

```powershell
docker compose up -d postgres
```

Disposable database:

```text
quanlyhanghoa_web_full_import_verify
```

Connection URL:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify
```

The database was dropped and recreated before the rehearsal:

```powershell
python -c "import psycopg; conn=psycopg.connect('postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/postgres', autocommit=True); cur=conn.cursor(); cur.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s', ('quanlyhanghoa_web_full_import_verify',)); cur.execute('DROP DATABASE IF EXISTS quanlyhanghoa_web_full_import_verify'); cur.execute('CREATE DATABASE quanlyhanghoa_web_full_import_verify'); print('created quanlyhanghoa_web_full_import_verify'); conn.close()"
```

Alembic command:

```powershell
$env:DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify'; alembic upgrade head
```

Applied migrations:

- `20260515_0001` inventory/customer schema
- `20260515_0002` debt payments
- `20260516_0003` sales/returns/document counters

The target was verified empty before import:

| Table | Count |
| --- | ---: |
| products | 0 |
| product_prices | 0 |
| inventory_balances | 0 |
| customers | 0 |
| customer_balance_ledgers | 0 |
| debt_payments | 0 |
| invoices | 0 |
| invoice_items | 0 |
| return_invoices | 0 |
| return_invoice_items | 0 |

## Phase 2 Import Result

Command:

```powershell
python -m app.importers.import_app_db_core --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --json-out "full_rehearsal_core_import_report.json"
```

Result:

```text
Inventory/customer core import execution: success=true, can_import_core=true, can_import_full_ledger=false
Counts: products=23, product_prices=30, inventory_balances=23, customers=87, debt_payments=22, customer_ledgers=84
Deferred: sales_return_ledgers=173, ambiguous_debt_payment_groups=0, unsupported_core_ledgers=0
```

JSON report:

- `backend/full_rehearsal_core_import_report.json`

## Phase 3 Import Result

Command:

```powershell
python -m app.importers.import_app_db_sales_returns --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --core-import-report "full_rehearsal_core_import_report.json" --json-out "full_rehearsal_sales_returns_import_report.json"
```

Result:

```text
Sales/returns historical import execution: success=true, can_import_full_ledger=true
Counts: invoices=156, invoice_items=375, return_invoices=0, return_invoice_items=0, invoice_charge_ledgers=134, invoice_payment_ledgers=39, return_ledgers=0
```

JSON report:

- `backend/full_rehearsal_sales_returns_import_report.json`

## Final Verification

Reusable verifier added:

- `backend/app/importers/full_import_rehearsal_verifier.py`

PostgreSQL-marked test added:

- `backend/tests/importers/test_full_import_rehearsal_postgres.py`

Verification command against the actual disposable rehearsal database:

```powershell
python -m app.importers.full_import_rehearsal_verifier --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --core-import-report "full_rehearsal_core_import_report.json" --sales-returns-import-report "full_rehearsal_sales_returns_import_report.json" --json-out "full_rehearsal_verification_result.json"
```

Result:

```text
Full import rehearsal verification: all_passed=true, products=23, customers=87, invoices=156, customer_ledgers=257, debt_payments=61
```

JSON result:

- `backend/full_rehearsal_verification_result.json`

Final imported counts:

| Check | Expected | Actual |
| --- | ---: | ---: |
| products | 23 | 23 |
| product_prices | 30 | 30 |
| inventory_balances | 23 | 23 |
| customers | 87 | 87 |
| debt_payments | 61 | 61 |
| customer_balance_ledgers | 257 | 257 |
| invoices | 156 | 156 |
| invoice_items | 375 | 375 |
| return_invoices | 0 | 0 |
| return_invoice_items | 0 | 0 |

Ledger composition:

| Ledger type | Count |
| --- | ---: |
| Phase 2 core ledgers | 84 |
| restored invoice charge ledgers | 134 |
| restored invoice payment ledgers | 39 |
| restored return ledgers | 0 |

Debt payment composition:

| Debt payment source | Count |
| --- | ---: |
| standalone Phase 2 debt payments | 22 |
| source-linked invoice payments | 39 |
| total | 61 |

## Verification Checks

The verifier confirmed:

- no orphan invoice items;
- no orphan customer ledger customer ids;
- no orphan invoice ledger refs;
- no orphan invoice-linked debt payment refs;
- no duplicate product codes;
- no duplicate product price unit rows;
- no duplicate inventory balances per product;
- no duplicate invoice codes;
- no duplicate return codes;
- inventory balances match the source final snapshots;
- customer `current_balance` values match the source final snapshots;
- full recomputed customer ledger balances match imported `customers.current_balance`;
- Phase 3 report has `can_import_full_ledger=true`;
- Phase 3 report has zero final balance mismatches;
- Phase 3 report confirms inventory balances were unchanged.

## Tests And Commands

Dedicated full rehearsal PostgreSQL test:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify_test'; pytest tests\importers\test_full_import_rehearsal_postgres.py -q
```

Result:

```text
1 passed
```

Full default test suite:

```powershell
pytest
```

Result:

```text
143 passed, 11 skipped
```

Compile check:

```powershell
python -m compileall app tests
```

Result: passed.

PostgreSQL-marked tests:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify_test'; pytest -m postgres
```

Result:

```text
11 passed, 143 deselected
```

## Source DB Safety

Source database metadata after rehearsal:

| File | Size | LastWriteTimeUtc |
| --- | ---: | --- |
| `backend/validation_sources/real_app_copy.db` | 331776 | `2026-05-14 08:06:50` |

The source SQLite database was only read by the importers/verifier and was not modified.

## Issues Found

No imported-state integrity issue was found.

One verification-helper issue was found and corrected during the rehearsal: customers with no ledger rows must be treated as having a recomputed ledger balance of zero. The correction is included in the reusable verifier and PostgreSQL test.

Operational notes:

- Docker access required sandbox escalation.
- Pytest needed repo-local `TMP`/`TEMP` paths because the default Windows profile temp directory was inaccessible in this sandbox.
- Regular unmarked tests skip PostgreSQL tests unless `TEST_DATABASE_URL` is set.

## Readiness

The Phase 2 + Phase 3 import path is ready for repeat rehearsal and cutover planning against disposable databases.

Remaining next steps before any production cutover:

- repeat the rehearsal from a fresh copy of the latest production `app.db`;
- retain JSON reports as audit artifacts;
- add an operator runbook with exact database creation, import, verification, and rollback steps;
- keep production import blocked until attendance/order/reporting scope and deployment rollback policy are separately addressed.
