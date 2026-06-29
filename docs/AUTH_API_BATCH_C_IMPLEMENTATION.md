# Auth API Batch C Implementation

## Summary

Implemented authentication API routes and the initial owner bootstrap CLI.

This batch exposes the auth service foundation from Batch B through FastAPI and adds a CLI for creating the first owner account. It does not protect inventory/customer routes yet and does not add frontend, cookie mode, CSRF, rate limiting, or user management APIs.

## Files Created or Modified

Created:

- `backend/app/api/routes/auth.py`
- `backend/app/auth/__init__.py`
- `backend/app/auth/bootstrap_owner.py`
- `backend/tests/api/test_auth_api.py`
- `backend/tests/service/test_auth_bootstrap.py`
- `docs/AUTH_API_BATCH_C_IMPLEMENTATION.md`

Modified:

- `backend/app/api/deps.py`
- `backend/app/api/errors.py`
- `backend/app/main.py`
- `backend/app/infrastructure/db/repositories/auth.py`
- `backend/app/schemas/auth.py`

## API Endpoints Added

Registered under the existing API prefix:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Login accepts username/password and returns:

- access token;
- refresh token;
- `token_type="bearer"`;
- `expires_in`;
- authenticated user profile.

Refresh accepts a refresh token, rotates it, revokes the old refresh token, and returns a new token pair.

Logout accepts a refresh token, revokes it idempotently, and returns:

```json
{"status": "ok"}
```

Me requires:

```text
Authorization: Bearer <access_token>
```

and returns the active current user.

## Auth Dependencies

Added to `backend/app/api/deps.py`:

- `get_current_user`
- `require_roles`

Behavior:

- missing bearer token returns `401`;
- invalid, expired, stale-role, missing-user, or inactive-user token returns `401`;
- `require_roles` returns `403` for an authenticated user without an allowed role.

Existing inventory/customer routes are not protected yet.

## Owner Bootstrap CLI

Command:

```powershell
python -m app.auth.bootstrap_owner --username admin --password "..." --display-name "Owner"
```

Behavior:

- creates an `owner` user only if no owner exists;
- refuses weak passwords through the auth service password policy;
- refuses duplicate usernames;
- does not print the password;
- exits `0` on success;
- exits `1` for validation/conflict failures;
- exits `2` for database/config execution errors.

The CLI supports optional `--email`.

## Tests Run and Results

Focused tests:

```powershell
pytest tests\api\test_auth_api.py tests\service\test_auth_bootstrap.py
```

Result:

```text
14 passed
```

Full test suite:

```powershell
pytest
```

Result:

```text
182 passed, 12 skipped
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
12 passed, 182 deselected
```

## Caveats and Next Steps

- Inventory/customer APIs remain intentionally unprotected until the next auth batch.
- No user management API exists yet.
- No frontend login flow exists yet.
- No cookie mode, CSRF protection, or login rate limiting exists yet.
- The bootstrap command should be run only against the intended database after Alembic migrations are applied.

Recommended next batch:

1. Protect inventory/customer routes with `get_current_user` and `require_roles`.
2. Add unauthorized/forbidden API tests for read/write role boundaries.
3. Keep health and auth login/refresh public.
