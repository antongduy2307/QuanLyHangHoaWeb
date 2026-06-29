# Auth Service Batch B Implementation

## Summary

Implemented the authentication service foundation:

- Argon2id password hashing through `pwdlib[argon2]`;
- JWT access token helper through `PyJWT`;
- opaque refresh token generation and SHA-256 storage hashing;
- auth repository for users and refresh tokens;
- auth service for user creation, authentication, login, refresh rotation, logout, logout-all, and current-user lookup from access tokens.

This batch does not add `/api/auth` routes, route protection, user management APIs, frontend work, or production secret generation.

## Files Created or Modified

Created:

- `backend/app/core/security.py`
- `backend/app/infrastructure/db/repositories/auth.py`
- `backend/app/application/auth_service.py`
- `backend/app/schemas/auth.py`
- `backend/tests/unit/test_auth_tokens.py`
- `backend/tests/service/test_auth_service.py`
- `docs/AUTH_SERVICE_BATCH_B_IMPLEMENTATION.md`

Modified:

- `backend/pyproject.toml`
- `backend/app/domain/exceptions.py`

## Hashing and Token Decisions

Password hashing:

- Uses `pwdlib.PasswordHash.recommended()`.
- Requires passwords to be at least 10 characters.
- Stores only password hashes in `users.password_hash`.
- Verification returns false for invalid hash strings rather than exposing internals.

Access tokens:

- Uses JWT with `HS256`.
- Claims include:
  - `sub`
  - `role`
  - `iat`
  - `exp`
  - `iss`
  - `jti`
- Decoding validates expiration, signature, and issuer.
- Invalid, expired, or wrong-issuer tokens raise `AuthenticationError`.

Refresh tokens:

- Generated as opaque random URL-safe tokens.
- Stored as SHA-256 hashes in `refresh_tokens.token_hash`.
- Plain refresh tokens are returned only at issue/refresh time and are never stored in the database.
- Candidate refresh tokens are verified by hashing and constant-time comparison.

## Refresh Token Behavior

Login:

- Authenticates username/password.
- Rejects inactive users.
- Updates `last_login_at`.
- Issues access token and refresh token.
- Stores hashed refresh token with expiry, optional user-agent, and optional IP address.

Refresh:

- Hashes the presented refresh token and loads the stored row.
- Rejects missing, revoked, expired, or inactive-user tokens.
- Updates `last_used_at`.
- Revokes the old refresh token.
- Issues a new access token and new refresh token.

Logout:

- Revokes the presented refresh token when found.
- Missing tokens are treated idempotently.

Logout all:

- Revokes all active refresh tokens for a user.

Current-user lookup:

- Decodes the access token.
- Loads the user from the database.
- Rejects missing users, inactive users, and stale role claims.

## Tests Run and Results

Installed new dependencies:

```powershell
python -m pip install -e ".[dev]"
```

The first sandboxed attempt could not access the network, so the command was rerun with approved network/package-install access and succeeded.

Focused tests:

```powershell
pytest tests\service\test_auth_service.py tests\unit\test_auth_tokens.py
```

Result:

```text
17 passed
```

Full test suite:

```powershell
pytest
```

Result:

```text
168 passed, 12 skipped
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
12 passed, 168 deselected
```

## Caveats and Next Steps

- No `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, or `/api/auth/me` endpoints exist yet.
- Existing inventory/customer routes remain unprotected.
- No owner bootstrap command exists yet.
- No cookie mode or CSRF handling exists yet.
- No login rate limiting exists yet.

Recommended next batch:

1. Add auth API routes.
2. Add owner bootstrap strategy.
3. Add API tests for login/refresh/logout/me.
4. In the following batch, protect inventory/customer routes with role dependencies.
