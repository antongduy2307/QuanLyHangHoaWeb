# PostgreSQL Protected API Smoke Tests Implementation

## Summary

Added PostgreSQL-marked API smoke tests for protected auth, inventory, customer, sales, and returns routes. The tests run the real FastAPI app through `TestClient` while overriding the request-scoped database dependency to use the existing PostgreSQL integration-session fixture.

No production API behavior was changed.

## Files Created/Modified

Created:
- `backend/tests/integration/test_protected_api_postgres.py`

Modified:
- No application code files.

## Tests Added

The new PostgreSQL integration tests cover:

- Auth login and `/api/auth/me` against PostgreSQL-backed users.
- Inventory protected access:
  - owner/admin write access through product creation;
  - read-only list/get access;
  - read-only write denial;
  - employee denial;
  - persisted product row verification.
- Customer protected access:
  - owner/admin write access through customer creation;
  - read-only list/get access;
  - read-only write denial;
  - employee denial;
  - opening-balance ledger persistence verification.
- Sales protected access:
  - owner-created PostgreSQL-backed customer invoice;
  - inventory stock decrease;
  - customer ledger/current-balance update;
  - read-only GET and write denial;
  - employee denial.
- Returns protected access:
  - owner-created linked return against PostgreSQL-backed invoice;
  - inventory stock increase;
  - customer ledger/current-balance/total-sales effects;
  - read-only GET and write denial;
  - employee denial.

## How to Run

From `backend/`, with Docker PostgreSQL available on host port `5433`:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'
pytest tests/integration/test_protected_api_postgres.py
pytest -m postgres
```

If `TEST_DATABASE_URL` is missing or unreachable, these tests skip clearly through the existing PostgreSQL fixture.

## Commands Run and Results

Focused test without `TEST_DATABASE_URL`:

```powershell
pytest tests/integration/test_protected_api_postgres.py
```

Result: `4 skipped`.

Focused test with local PostgreSQL URL:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'
pytest tests/integration/test_protected_api_postgres.py
```

Result: `4 passed`.

Full suite:

```powershell
pytest
```

Result: `209 passed, 16 skipped`.

Compile check:

```powershell
python -m compileall app tests
```

Result: passed.

PostgreSQL-marked suite:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'
pytest -m postgres
```

Result: `16 passed, 209 deselected`.

## Caveats and Next Steps

- These are smoke tests and intentionally do not duplicate the full SQLite-backed API behavior suite.
- The PostgreSQL fixture applies Alembic migrations to the configured test database before running.
- Future user-management APIs should get their own PostgreSQL authorization smoke tests when implemented.
