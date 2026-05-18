# Real Core Import Verification Batch 6 Follow-up

## Summary

This follow-up executed the Phase 2 Batch 6 inventory/customer core importer against a disposable PostgreSQL target using the copied real SQLite database:

- `backend/validation_sources/real_app_copy.db`

The real import succeeded against a fresh disposable PostgreSQL database. A reusable PostgreSQL-marked verification test was also added and passed against a separate disposable test database.

No source SQLite data was modified. No desktop reference repository files were modified.

## Disposable DB Setup Used

Expected Docker PostgreSQL configuration:

- Docker compose service: `postgres`
- Host port: `5433`
- Database/user from `docker-compose.yml`: `quanlyhanghoa_web` / `quanlyhanghoa`
- Expected URL:
  - `postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web`

Docker command:

```powershell
docker compose up -d postgres
```

Initial sandbox result:

```text
WARNING: Error loading config file: open C:\Users\Admin\.docker\config.json: Access is denied.
unable to get image 'postgres:16': failed to connect to the docker API at npipe:////./pipe/docker_engine; check if the path is correct and if the daemon is running
```

Escalated retry result:

```text
Container quanlyhanghoaweb-postgres Started
```

Direct connection check to Docker PostgreSQL port passed:

```powershell
python -c "import psycopg; conn=psycopg.connect('postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/postgres', connect_timeout=5)"
```

Result:

```text
connected
```

Disposable import database:

```text
quanlyhanghoa_web_import_verify
```

It was dropped and recreated before import.

Disposable PostgreSQL test database:

```text
quanlyhanghoa_web_import_verify_test
```

It was dropped and recreated before running `pytest -m postgres`.

## Actual Import Result

Target tables were verified empty before import:

```text
products=0
product_prices=0
inventory_balances=0
customers=0
customer_balance_ledgers=0
debt_payments=0
```

Actual import command:

```powershell
python -m app.importers.import_app_db_core --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_import_verify" --json-out "inventory_customer_core_import_report_real_db.json"
```

Result:

```text
Inventory/customer core import execution: success=true, can_import_core=true, can_import_full_ledger=false
Counts: products=23, product_prices=30, inventory_balances=23, customers=87, debt_payments=22, customer_ledgers=84
Deferred: sales_return_ledgers=173, ambiguous_debt_payment_groups=0, unsupported_core_ledgers=0
```

JSON report created:

- `backend/inventory_customer_core_import_report_real_db.json`

## Verification Test Added

Created:

- `backend/tests/importers/test_real_core_import_verification.py`

The test is marked:

- `integration`
- `postgres`

It uses the existing PostgreSQL fixture behavior:

- reads `TEST_DATABASE_URL`;
- skips clearly when missing or unreachable;
- runs Alembic upgrade through the existing fixture;
- imports `backend/validation_sources/real_app_copy.db` into the transaction-scoped test database;
- rolls back after the test.

Verification coverage:

- imported product count matches source;
- product price count matches source;
- inventory balance count matches source;
- negative balances are preserved;
- inactive products are preserved;
- canonical quantity columns are valid;
- imported customer count matches source;
- inactive customers are preserved;
- debt payment count matches expected standalone groups;
- Phase 2 customer ledger count matches expected core subset;
- imported customer ledgers reference valid customers;
- debt payment ledgers reference valid `debt_payments`;
- source customer `current_balance` values are preserved;
- partial imported ledgers do not falsely reconcile every deferred invoice timeline;
- mapping counts match imported entities;
- no duplicate product codes;
- no duplicate product price unit rows;
- no duplicate inventory balances per product.

## Commands Run

From `backend/`:

```powershell
docker compose up -d postgres
```

Result: service started after escalated retry.

```powershell
python -c "import psycopg; ... DROP DATABASE IF EXISTS quanlyhanghoa_web_import_verify; CREATE DATABASE quanlyhanghoa_web_import_verify"
```

Result: disposable import database created.

```powershell
$env:DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_import_verify'; alembic upgrade head
```

Result: migrations applied through head.

```powershell
python -m app.importers.import_app_db_core --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_import_verify" --json-out "inventory_customer_core_import_report_real_db.json"
```

Result: import succeeded.

```powershell
python -c "... verification queries ..."
```

Result:

```text
all checked counts and integrity checks matched expected values
```

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_import_verify_test'; pytest -m postgres
```

Result:

```text
4 passed, 94 deselected
```

```powershell
pytest
```

Result:

```text
94 passed, 4 skipped
```

```powershell
python -m compileall app tests
```

Result: passed.

## Verification Results

Imported target counts:

| Check | Expected | Actual |
| --- | ---: | ---: |
| products | 23 | 23 |
| product_prices | 30 | 30 |
| inventory_balances | 23 | 23 |
| customers | 87 | 87 |
| debt_payments | 22 | 22 |
| customer_balance_ledgers | 84 | 84 |
| deferred sales/returns ledgers | 173 | 173 |
| negative balances | 20 | 20 |
| inactive products | 0 | 0 |
| inactive customers | 0 | 0 |

Mapping counts:

| Mapping | Count |
| --- | ---: |
| product id mappings | 23 |
| customer id mappings | 87 |
| debt payment mappings | 22 |

Integrity checks:

| Check | Result |
| --- | ---: |
| duplicate product codes | 0 |
| duplicate product price unit rows | 0 |
| duplicate inventory balances per product | 0 |
| orphan customer ledger rows | 0 |
| orphan debt payment ledger refs | 0 |
| invalid canonical inventory balances | 0 |

Customer balances:

- Source customer balance sum: `6295324500`
- Imported customer balance sum: `6295324500.00`
- The PostgreSQL-marked verification test checks every imported customer balance against the source snapshot through the id mapping.

Partial ledger behavior:

- `partial_ledger_customer_count=78`
- This is expected because Phase 2 imports only core customer/debt ledger rows and defers invoice/return-linked rows.
- The imported PostgreSQL state does not falsely claim partial ledgers reconcile every deferred invoice timeline.

## Import Counts Expected From Dry-run

The previous dry-run plan matched the actual disposable PostgreSQL import:

- products: 23
- product_prices: 30
- inventory_balances: 23
- customers: 87
- debt_payments: 22
- customer_ledgers: 84
- deferred sales/returns ledgers: 173
- ambiguous debt payment groups: 0
- unsupported core ledgers: 0
- `can_import_core=true`
- `can_import_full_ledger=false`

## Imported State Readiness

The imported PostgreSQL state is considered Phase 2-ready for inventory/customer core:

- core import completed transactionally;
- all expected inventory/customer rows were imported;
- target integrity checks passed;
- customer balance snapshots were preserved;
- deferred sales/returns ledgers were not imported;
- partial imported ledgers remain visibly partial and are not treated as full historical reconciliation.

## Issues Found

No imported state integrity issue was found.

Operational notes:

- Docker access required escalation from this sandboxed shell.
- The actual import database was intentionally disposable.
- The regular unmarked `pytest` run still skips PostgreSQL tests unless `TEST_DATABASE_URL` is set in that command's environment.

## Next Step

Keep `backend/inventory_customer_core_import_report_real_db.json` as the audit artifact for this disposable import. For future repeat verification:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_import_verify_test"
pytest -m postgres
```

The next migration implementation should continue with Phase 3 sales/returns design or add an explicit disposable database management helper for repeat import rehearsals.
