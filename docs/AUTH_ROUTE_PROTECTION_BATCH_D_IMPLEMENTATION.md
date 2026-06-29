# Auth Route Protection Batch D Implementation

## Summary

Protected the existing inventory and customer API routes with role-based authorization.

Health and auth login/refresh remain public. Sales/returns API route protection is out of scope because sales/returns FastAPI routes have not been implemented yet.

## Files Modified

- `backend/app/api/routes/inventory.py`
- `backend/app/api/routes/customers.py`
- `backend/tests/api/test_inventory_api.py`
- `backend/tests/api/test_customer_api.py`
- `docs/AUTH_ROUTE_PROTECTION_BATCH_D_IMPLEMENTATION.md`

## Route Protection Rules Implemented

Inventory:

- read routes allow `owner`, `admin`, `read_only`;
- write routes allow `owner`, `admin`;
- `employee` and `attendance_manager` receive `403`.

Customer:

- customer read routes allow `owner`, `admin`, `read_only`;
- customer write routes allow `owner`, `admin`;
- ledger read allows `owner`, `admin`, `read_only`;
- debt payment read allows `owner`, `admin`, `read_only`;
- debt payment mutation routes allow `owner`, `admin`;
- `employee` and `attendance_manager` receive `403`.

Unauthenticated or invalid bearer tokens return `401`.

## Public Routes Preserved

These remain public:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

## Tests Added or Updated

Updated inventory/customer API tests to create users and authenticate requests through the real `/api/auth/login` route.

Coverage includes:

- anonymous inventory/customer access returns `401`;
- invalid bearer token returns `401`;
- `read_only` can read but cannot write;
- `owner` can read/write;
- `admin` can read/write;
- `employee` cannot access inventory/customer admin APIs;
- `attendance_manager` cannot access inventory/customer admin APIs by default;
- health remains public;
- auth login/refresh remain public;
- existing inventory/customer behavior still works when authorized.

## Commands Run and Results

Focused API tests:

```powershell
pytest tests\api\test_inventory_api.py tests\api\test_customer_api.py tests\api\test_auth_api.py
```

Result:

```text
31 passed
```

Full suite:

```powershell
pytest
```

Result:

```text
189 passed, 12 skipped
```

Compile check:

```powershell
python -m compileall app tests
```

Result: passed.

PostgreSQL-marked tests:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'; pytest -m postgres
```

Result:

```text
12 passed, 189 deselected
```

## Caveats and Next Steps

- No user management API exists yet.
- No frontend login flow exists yet.
- No cookie mode, CSRF protection, or rate limiting exists yet.
- Sales/returns FastAPI endpoints are not implemented yet, so no sales/returns route protection was added.
- A future batch should protect sales/returns APIs when those routes are introduced.
