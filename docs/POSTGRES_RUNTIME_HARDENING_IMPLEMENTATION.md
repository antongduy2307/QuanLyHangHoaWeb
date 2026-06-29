# PostgreSQL Runtime Hardening Implementation

## Summary

This pass reviewed backend query patterns that can pass SQLite tests while failing on PostgreSQL at runtime, with emphasis on recently added reporting and inventory movement endpoints.

Fixed and hardened areas:

- inventory product movement `UNION ALL` typing;
- report customer debt Decimal comparisons;
- frontend API error classification for backend HTTP failures versus network/CORS failures;
- PostgreSQL-marked regression coverage for reports and inventory movement history.

## Backend review

Search targets reviewed:

- `func.date`
- `isoformat()`
- `union` / `union_all`
- `literal(None)`
- `cast(`
- text/date comparison patterns

Findings:

- Report date filters already use half-open datetime ranges instead of string date comparisons.
- Remaining `func.date(...)` usages in reports are grouping expressions only, not `WHERE` comparisons. They are converted to Python `date` values in service results and are safe for SQLite and PostgreSQL.
- Inventory movement history is the only backend `UNION ALL` query. It now explicitly casts mixed/null-sensitive columns.
- Customer debt report comparisons now use `Decimal("0")` rather than an integer literal.

## Files changed

- `backend/app/infrastructure/db/repositories/inventory.py`
- `backend/app/infrastructure/db/repositories/reports.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/tests/api/test_inventory_api.py`
- `backend/tests/integration/test_inventory_movements_postgres.py`
- `backend/tests/integration/test_reports_postgres.py`
- `frontend/src/api/client.ts`
- `frontend/src/app/App.test.tsx`
- `docs/POSTGRES_RUNTIME_HARDENING_IMPLEMENTATION.md`

## Query hardening details

Inventory movements:

- `movement_id` and `source_id` cast to `BIGINT`.
- movement/source labels cast to bounded `String`.
- `quantity_delta` and nullable `balance_after` cast to `Numeric(14, 3)`.
- nullable `note` and `actor` fields cast to `Text`.
- datetime columns remain native model datetime columns across all union branches. This avoids SQLite datetime processor failures while preserving PostgreSQL-compatible timestamp types.

Reports:

- daily and monthly filters use `>= start_datetime` and `< end_datetime`.
- date-range filters use the same half-open datetime bounds.
- positive debt filters compare numeric columns to `Decimal("0")`.

## Frontend API errors

The API client now distinguishes:

- HTTP backend errors, e.g. `Backend tra ve loi HTTP 500.`;
- network/CORS/fetch failures, e.g. `Khong the ket noi API tai ...`.

Backend JSON error payloads still take precedence and display their backend-provided message.

## PostgreSQL regression tests

Added/expanded PostgreSQL-marked coverage for:

- dashboard summary date filters;
- reports protected API smoke;
- sales summary date ranges;
- returns summary date ranges;
- inventory product movements with invoice, return, and stock adjustment rows;
- inventory movement read-only access and employee denial.

## Commands

Results from `backend`:

```powershell
pytest
# 231 passed, 21 skipped

pytest -m postgres
# 21 skipped because TEST_DATABASE_URL is not set

python -m compileall app tests
# passed
```

Results from `frontend`:

```powershell
npm.cmd test
# 142 passed

npm.cmd run build
# passed

npm.cmd run lint
# passed
```

`pytest -m postgres` requires `TEST_DATABASE_URL`; otherwise PostgreSQL tests are collected and skipped.

The first sandboxed frontend runs failed due Windows path mapping in Vitest/Vite. The same required commands were rerun outside the sandbox and passed.

## Caveats

- PostgreSQL-specific tests could not exercise a real PostgreSQL connection unless `TEST_DATABASE_URL` is available in the local environment.
- Report `func.date(...)` grouping was retained because replacing it with SQL `CAST(... AS DATE)` breaks SQLite result processing while not improving PostgreSQL filtering safety.
