# Sales/Returns API Batch Implementation

## Summary

Implemented FastAPI endpoints for web-created sales invoices and returns. The routes expose the existing service-layer create, read, update, and delete behavior and apply role-based authorization from the first version.

This batch does not change historical import behavior and does not add frontend code.

## Files Created/Modified

Created:
- `backend/app/api/routes/sales.py`
- `backend/app/api/routes/returns.py`
- `backend/tests/api/test_sales_api.py`
- `backend/tests/api/test_returns_api.py`

Modified:
- `backend/app/main.py`
- `backend/app/schemas/sales.py`
- `backend/app/schemas/returns.py`

## Endpoints Added

Sales:
- `GET /api/sales/invoices`
- `POST /api/sales/invoices`
- `GET /api/sales/invoices/{invoice_id}`
- `PATCH /api/sales/invoices/{invoice_id}`
- `DELETE /api/sales/invoices/{invoice_id}`

Returns:
- `GET /api/returns`
- `POST /api/returns`
- `GET /api/returns/{return_id}`
- `PATCH /api/returns/{return_id}`
- `DELETE /api/returns/{return_id}`

## Auth Policy

Sales and returns routes use the same bearer-token role dependency foundation added in Auth Batch D.

Read routes allow:
- `owner`
- `admin`
- `read_only`

Write routes allow:
- `owner`
- `admin`

`employee` and `attendance_manager` are denied with HTTP 403. Missing or invalid bearer tokens return HTTP 401. Health and auth routes remain public.

## Service Behavior Exposed

Sales routes call `SalesService` and expose:
- invoice code/date/status fields;
- customer id and customer snapshot fields;
- totals and payment fields;
- invoice item product snapshots;
- inventory stock decrease on create/update and rollback on delete;
- customer ledger and balance effects for customer invoices.

Returns routes call `ReturnService` and expose:
- return code/date/source invoice fields;
- customer id and customer snapshot fields;
- total and handling mode;
- return item product snapshots and source invoice item links;
- inventory stock increase on create/update and rollback on delete;
- customer ledger and balance effects for customer returns.

Mutating routes wrap service calls in explicit commit/rollback transaction handling. Read routes use request-scoped SQLAlchemy sessions and do not intentionally mutate state.

## Tests Added

Sales API tests cover:
- anonymous and invalid-token 401 responses;
- read-only GET access and write denial;
- owner/admin write access;
- employee/attendance-manager denial;
- walk-in invoice creation and unpaid walk-in rejection;
- customer invoice stock and ledger effects;
- invoice update rollback/reapply behavior;
- invoice delete rollback behavior;
- get/list responses.

Returns API tests cover:
- anonymous and invalid-token 401 responses;
- read-only GET access and write denial;
- owner/admin write access;
- employee/attendance-manager denial;
- quick walk-in refund returns;
- customer store-credit returns;
- linked return quantity ceiling;
- return update rollback/reapply behavior;
- return delete rollback behavior;
- get/list responses.

## Commands Run

From `backend/`:

```powershell
pytest tests/api/test_sales_api.py tests/api/test_returns_api.py
```

Result: `20 passed`.

```powershell
pytest
```

Result: `209 passed, 12 skipped`.

```powershell
python -m compileall app tests
```

Result: completed successfully.

`TEST_DATABASE_URL` was not set in the shell, so `pytest -m postgres` was not run in this batch. PostgreSQL-marked tests in the full suite skipped clearly.

## Caveats and Next Steps

- Sales/returns API tests use the existing fast SQLite-backed API fixture for behavioral coverage.
- PostgreSQL API smoke coverage can be added once `TEST_DATABASE_URL` is set in the test shell.
- Future batches still need sales/returns frontend screens and user-management administration.
- Historical sales/returns import remains separate and must not call these write APIs because import must not replay stock/customer effects.
