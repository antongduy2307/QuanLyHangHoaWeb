# Import Rehearsal and Cutover Runbook

## Purpose and Scope

This runbook describes how to safely repeat the current import rehearsal path for:

- Phase 2 inventory/customer core import from desktop `app.db`;
- Phase 3 sales/returns historical document and ledger import from desktop `app.db`;
- verification of the resulting disposable PostgreSQL state.

This runbook is for rehearsal and future cutover planning. It does not approve production cutover.

Not covered yet:

- attendance migration from `attendance.db`;
- orders migration;
- reporting migration;
- React frontend rollout;
- authentication and authorization;
- production deployment;
- final business acceptance testing.

## Safety Rules

- Never run import commands against production unless production cutover is explicitly approved.
- Always copy the source desktop `app.db` first. Validate and import only from the copied file.
- Never mutate the source SQLite `app.db`.
- Always use a disposable PostgreSQL database for rehearsal.
- Verify the target PostgreSQL database is empty before Phase 2 import.
- Preserve all JSON reports as audit artifacts.
- Keep `QuanLyHangHoaWeb/QuanLyHangHoa/` read-only. Do not modify the desktop reference repository.
- Do not reuse a previous rehearsal database unless it has been dropped and recreated.
- Stop if any verification check fails. Do not proceed to production planning until the cause is understood.

## Prerequisites

Expected working directories:

- repository root: `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb`
- backend: `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend`
- copied source DB example: `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\validation_sources\real_app_copy.db`

Required tools:

- Python 3.11 or newer;
- backend dependencies installed with `python -m pip install -e ".[dev]"`;
- Docker Desktop running;
- Docker PostgreSQL service available from `docker-compose.yml`;
- Alembic available in the active Python environment;
- copied source `app.db` available under `backend/validation_sources/` or another explicit copied path.

Local PostgreSQL convention:

- Docker container port: `5432`;
- host port: `5433`;
- user: `quanlyhanghoa`;
- password: `quanlyhanghoa_dev`;
- default dev database: `quanlyhanghoa_web`.

The host port `5433` avoids conflicts with a local Windows PostgreSQL service on `5432`.

## Environment Variables

PowerShell examples from `backend/`:

```powershell
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify"
$env:TEST_DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify_test"
```

Use `DATABASE_URL` for Alembic and application commands that read the configured database.

Use `TEST_DATABASE_URL` for PostgreSQL-marked pytest tests.

For the disposable rehearsal target used in this runbook:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify
```

For PostgreSQL tests:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify_test
```

If pytest cannot access the default Windows temp directory, set repo-local temp paths:

```powershell
$env:TMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
$env:TEMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
```

Remove `.tmp-tests` after verification if it remains.

## Step-by-Step Rehearsal Procedure

Run all commands from the indicated directory. Replace paths only when using a different copied `app.db` or disposable database name.

### 1. Start PostgreSQL

From `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb`:

```powershell
docker compose up -d postgres
```

If Docker access fails from a sandboxed shell, rerun with the required local permission path and verify Docker Desktop is open.

### 2. Create a Fresh Disposable Database

From `backend/`:

```powershell
python -c "import psycopg; conn=psycopg.connect('postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/postgres', autocommit=True); cur=conn.cursor(); cur.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s', ('quanlyhanghoa_web_full_import_verify',)); cur.execute('DROP DATABASE IF EXISTS quanlyhanghoa_web_full_import_verify'); cur.execute('CREATE DATABASE quanlyhanghoa_web_full_import_verify'); print('created quanlyhanghoa_web_full_import_verify'); conn.close()"
```

This command intentionally drops only the named disposable database. Do not use a production database name here.

### 3. Run Alembic Upgrade Head

From `backend/`:

```powershell
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify"
alembic upgrade head
```

Expected migrations include:

- inventory/customer schema;
- debt payments;
- sales/returns/document counters.

### 4. Verify Target Tables Are Empty

From `backend/`:

```powershell
python -c "from sqlalchemy import create_engine,text; url='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify'; tables='products,product_prices,inventory_balances,customers,customer_balance_ledgers,debt_payments,invoices,invoice_items,return_invoices,return_invoice_items'.split(','); e=create_engine(url); conn=e.connect(); print('\n'.join([t+'='+str(conn.execute(text('select count(*) from '+t)).scalar_one()) for t in tables])); conn.close()"
```

Expected output:

```text
products=0
product_prices=0
inventory_balances=0
customers=0
customer_balance_ledgers=0
debt_payments=0
invoices=0
invoice_items=0
return_invoices=0
return_invoice_items=0
```

Stop if any table is non-empty.

### 5. Run Phase 2 Core Import

From `backend/`:

```powershell
python -m app.importers.import_app_db_core --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --json-out "full_rehearsal_core_import_report.json"
```

Expected summary:

```text
Inventory/customer core import execution: success=true, can_import_core=true, can_import_full_ledger=false
Counts: products=23, product_prices=30, inventory_balances=23, customers=87, debt_payments=22, customer_ledgers=84
Deferred: sales_return_ledgers=173, ambiguous_debt_payment_groups=0, unsupported_core_ledgers=0
```

Stop if `success` is not true.

### 6. Run Phase 3 Sales/Returns Import

From `backend/`:

```powershell
python -m app.importers.import_app_db_sales_returns --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --core-import-report "full_rehearsal_core_import_report.json" --json-out "full_rehearsal_sales_returns_import_report.json"
```

Expected summary:

```text
Sales/returns historical import execution: success=true, can_import_full_ledger=true
Counts: invoices=156, invoice_items=375, return_invoices=0, return_invoice_items=0, invoice_charge_ledgers=134, invoice_payment_ledgers=39, return_ledgers=0
```

Stop if `success` is not true or `can_import_full_ledger` is not true.

### 7. Run Full Rehearsal Verifier

From `backend/`:

```powershell
python -m app.importers.full_import_rehearsal_verifier --app-db "validation_sources/real_app_copy.db" --database-url "postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" --core-import-report "full_rehearsal_core_import_report.json" --sales-returns-import-report "full_rehearsal_sales_returns_import_report.json" --json-out "full_rehearsal_verification_result.json"
```

Expected summary:

```text
Full import rehearsal verification: all_passed=true, products=23, customers=87, invoices=156, customer_ledgers=257, debt_payments=61
```

Stop if `all_passed` is not true.

### 8. Run Default Tests

From `backend/`:

```powershell
$env:TMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
$env:TEMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
pytest
```

Current expected result:

```text
143 passed, 11 skipped
```

### 9. Run PostgreSQL-Marked Tests

Create a separate disposable test database:

```powershell
python -c "import psycopg; conn=psycopg.connect('postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/postgres', autocommit=True); cur=conn.cursor(); cur.execute('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=%s', ('quanlyhanghoa_web_full_import_verify_test',)); cur.execute('DROP DATABASE IF EXISTS quanlyhanghoa_web_full_import_verify_test'); cur.execute('CREATE DATABASE quanlyhanghoa_web_full_import_verify_test'); print('created quanlyhanghoa_web_full_import_verify_test'); conn.close()"
```

Run tests:

```powershell
$env:TMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
$env:TEMP="E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend\.tmp-tests"
$env:TEST_DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify_test"
pytest -m postgres
```

Current expected result:

```text
11 passed, 143 deselected
```

### 10. Run Compile Check

From `backend/`:

```powershell
python -m compileall app tests
```

Expected result: no compile errors.

## Expected Results for Current Copied DB

These counts are from the current copied real `app.db` used in rehearsal:

| Category | Expected |
| --- | ---: |
| products | 23 |
| product_prices | 30 |
| inventory_balances | 23 |
| customers | 87 |
| Phase 2 debt_payments | 22 |
| Phase 2 customer_ledgers | 84 |
| deferred sales/returns ledgers | 173 |
| invoices | 156 |
| invoice_items | 375 |
| return_invoices | 0 |
| return_invoice_items | 0 |
| restored invoice charge ledgers | 134 |
| restored invoice payment ledgers | 39 |
| final debt_payments | 61 |
| final customer_balance_ledgers | 257 |

The verifier must also confirm:

- no orphan invoice items;
- no orphan ledger customer ids;
- no orphan invoice ledger refs;
- no orphan invoice-linked debt payment refs;
- no duplicate invoice codes;
- no duplicate return codes;
- inventory balances remain equal to source final snapshots;
- customer `current_balance` values remain equal to source final snapshots;
- full recomputed customer ledger balances match imported `customers.current_balance`.

## Validation and Report Files

Preserve these JSON files after each rehearsal:

| File | Purpose |
| --- | --- |
| `backend/full_rehearsal_core_import_report.json` | Proves Phase 2 import counts, deferred ledger count, and old-to-new product/customer/debt payment mappings. Required input for Phase 3 import. |
| `backend/full_rehearsal_sales_returns_import_report.json` | Proves Phase 3 document import counts, restored ledger counts, created source-linked debt payment count, and `can_import_full_ledger`. |
| `backend/full_rehearsal_verification_result.json` | Proves final target counts, reference integrity, duplicate checks, inventory snapshot match, customer snapshot match, and full ledger recomputation. |

Keep these files with the copied source DB metadata and command log for auditability.

## Failure Handling

### Docker Cannot Start

- Confirm Docker Desktop is open.
- Run `docker ps` from a normal terminal to verify the daemon is reachable.
- If sandboxed shell access is blocked, rerun Docker commands through an approved/elevated path.
- Do not proceed until PostgreSQL is reachable.

### PostgreSQL Password Fails

- Confirm `docker-compose.yml` credentials.
- Use the expected local password: `quanlyhanghoa_dev`.
- Recreate the Docker volume only if this is a disposable local environment and old credentials are not needed.
- Do not alter production credentials.

### Port 5432 Conflict

- Use host port `5433` in `docker-compose.yml`, `DATABASE_URL`, and `TEST_DATABASE_URL`.
- Check for existing local PostgreSQL on `5432`.
- Do not change commands to `5432` unless the Docker mapping was intentionally changed.

### Alembic Fails

- Stop before importing.
- Confirm `DATABASE_URL` points to the disposable database.
- Confirm the target database exists and is reachable.
- Review the migration error and do not manually create tables to bypass Alembic.

### Phase 2 Import Fails

- Stop before Phase 3.
- Inspect `full_rehearsal_core_import_report.json` if it was created.
- Check source validation errors and target emptiness.
- Drop/recreate the disposable database before retrying.

### Phase 3 Import Fails

- Stop verification and preserve the failed JSON report if created.
- Confirm `--core-import-report` points to the Phase 2 report from the same rehearsal.
- Confirm target invoices/returns were empty before Phase 3.
- Drop/recreate the disposable database before retrying from Phase 2.

### Verification Fails

- Do not continue to production planning.
- Inspect `full_rehearsal_verification_result.json`.
- Compare failed checks to the source copied DB.
- Preserve the failed database until the cause is understood, unless it contains sensitive data and must be destroyed.

### Source DB Appears Modified

- Stop immediately.
- Compare file metadata and checksum against the original copy.
- Discard the copied DB and create a new copy from the original source.
- Do not use a modified source DB for cutover planning.

### Target Database Is Not Empty

- Stop before Phase 2 import.
- If it is a disposable rehearsal database, drop and recreate it.
- If it is not clearly disposable, do not alter it.

## Production Cutover Draft Plan

Production cutover is not approved yet. This is a draft planning outline only.

1. Freeze desktop writes and communicate downtime.
2. Create backups of the desktop `app.db`, `attendance.db`, and any production PostgreSQL state.
3. Copy the latest desktop `app.db` to a controlled import workspace.
4. Run validation against the copied `app.db`.
5. Run a full disposable rehearsal with the copied DB.
6. Review all JSON reports and verifier results.
7. Create the production PostgreSQL database.
8. Run Alembic `upgrade head` against production PostgreSQL.
9. Run Phase 2 core import.
10. Run Phase 3 sales/returns import.
11. Run the full verifier against production PostgreSQL.
12. Preserve all JSON reports and command logs.
13. Switch the web backend to the production PostgreSQL database.
14. Run smoke tests and business acceptance checks.
15. Keep the desktop database unchanged and archived for rollback/reference.

Production cutover must remain blocked until attendance, orders/reporting, frontend, auth, deployment, backup/restore, and acceptance criteria are explicitly handled.

## Rollback Policy Draft

Before cutover:

- Imports are isolated to PostgreSQL.
- Rollback can drop and recreate the disposable or staging target database.
- Never delete or overwrite the source desktop database.

During production cutover:

- If verification fails before switching traffic, drop/recreate the production target and return to the desktop system.
- Keep all failed reports and logs for diagnosis.

After cutover:

- Rollback requires restoring the previous production application/database state.
- If users wrote data to the web app after cutover, rollback must define how those writes are handled.
- Do not use the desktop DB as a write target again unless a deliberate reverse migration or operational rollback plan exists.

## Open Gaps Before Production

- Attendance migration is not done.
- Orders migration is not done.
- Reporting migration is not done.
- Auth and roles are not done.
- Frontend is not done.
- Production deployment is not done.
- Production backup/restore procedure is not done.
- Final acceptance testing is not done.
- Production cutover approval is not defined.
- Post-cutover rollback handling for new web writes is not defined.

## Appendix: Useful psql Checks

If `psql` is available:

```powershell
psql "postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" -c "select count(*) from products;"
psql "postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" -c "select count(*) from invoices;"
psql "postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_full_import_verify" -c "select count(*) from customer_balance_ledgers;"
```

Duplicate invoice code check:

```sql
SELECT invoice_code, COUNT(*)
FROM invoices
GROUP BY invoice_code
HAVING COUNT(*) > 1;
```

Orphan invoice item check:

```sql
SELECT COUNT(*)
FROM invoice_items item
LEFT JOIN invoices invoice ON invoice.id = item.invoice_id
WHERE invoice.id IS NULL;
```

## Appendix: Useful Docker Commands

From `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb`:

```powershell
docker compose ps
docker compose logs postgres
docker compose up -d postgres
docker compose stop postgres
```

Do not run `docker compose down -v` unless you intentionally want to delete the local Docker PostgreSQL volume.

## Appendix: Windows and Port 5433 Notes

- The current local convention maps Docker PostgreSQL to host port `5433`.
- Use `localhost:5433` in `DATABASE_URL` and `TEST_DATABASE_URL`.
- If a command fails with temp directory permission errors, set `TMP` and `TEMP` to a repo-local directory before running pytest.
- PowerShell may print profile loading warnings if script execution is disabled. Those warnings do not necessarily mean the import command failed; check the command exit code and command-specific output.
