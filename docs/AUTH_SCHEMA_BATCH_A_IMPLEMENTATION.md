# Auth Schema Batch A Implementation

## Summary

Implemented the authentication foundation schema, configuration, and domain role constants.

This batch does not implement password hashing, JWT generation, login/logout/refresh/me endpoints, user management endpoints, route protection, or frontend authentication UI.

## Files Created or Modified

Created:

- `backend/app/domain/auth.py`
- `backend/app/infrastructure/db/models/auth.py`
- `backend/alembic/versions/20260517_0004_auth_schema.py`
- `backend/tests/unit/test_auth_domain.py`
- `backend/tests/unit/test_config.py`
- `backend/tests/migration/test_auth_schema.py`
- `docs/AUTH_SCHEMA_BATCH_A_IMPLEMENTATION.md`

Modified:

- `backend/app/core/config.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/tests/unit/test_db_metadata.py`
- `backend/tests/integration/test_postgres_schema.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`
- `.env.example`
- `docs/SETUP.md`

## Schema Decisions

Added `users`:

- `id` bigint identity primary key;
- `username` required, unique, indexed;
- `email` nullable with PostgreSQL partial unique index when not null;
- `display_name` required;
- `password_hash` required;
- `role` required and constrained to known role values;
- `is_active` default true and indexed;
- `last_login_at`, `created_at`, `updated_at`.

Added `refresh_tokens`:

- `id` bigint identity primary key;
- `user_id` required FK to `users.id` with `ON DELETE CASCADE`;
- `token_hash` required, unique, indexed;
- `expires_at` indexed;
- `revoked_at`, `created_at`, `last_used_at`;
- optional `user_agent` and `ip_address`.

Role constants were added with lowercase string values:

- `owner`
- `admin`
- `attendance_manager`
- `employee`
- `read_only`

Role groups were added for planned authorization checks:

- admin write: owner/admin;
- admin read: owner/admin/read_only;
- attendance manager: owner/admin/attendance_manager.

## Config Decisions

Added settings:

- `AUTH_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `AUTH_ISSUER`
- `CORS_ALLOWED_ORIGINS`

The local placeholder auth secret is allowed only for local/dev/test environments. `Settings` rejects the placeholder when `APP_ENV` is outside those environments.

No auth dependencies were added in this batch because password hashing and JWT generation are intentionally deferred to Batch B.

## Tests Run and Results

From `backend/`:

```powershell
pytest tests\unit\test_config.py tests\unit\test_auth_domain.py tests\unit\test_db_metadata.py tests\migration\test_auth_schema.py -q
```

Result:

```text
15 passed
```

```powershell
alembic upgrade head --sql
```

Result: passed. The generated SQL includes `users`, `refresh_tokens`, the auth role check constraint, unique username index, partial unique email index, and refresh token indexes.

```powershell
pytest
```

Result:

```text
151 passed, 12 skipped
```

```powershell
python -m compileall app tests
```

Result: passed.

PostgreSQL disposable verification database:

```text
quanlyhanghoa_web_auth_batch_a_verify
```

```powershell
$env:DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'; alembic upgrade head
```

Result: passed through auth revision `20260517_0004`.

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web_auth_batch_a_verify'; pytest -m postgres
```

Result:

```text
12 passed, 151 deselected
```

## Caveats and Next Steps

- No password hashing service exists yet.
- No JWT or refresh-token issuing service exists yet.
- No auth API routes exist yet.
- Existing inventory/customer routes are still unprotected.
- No owner bootstrap command exists yet.

Recommended next batch:

1. Add password hashing and token helpers.
2. Add auth repository/service.
3. Add refresh token hashing, rotation, and revocation behavior.
4. Add service tests before exposing API endpoints.
