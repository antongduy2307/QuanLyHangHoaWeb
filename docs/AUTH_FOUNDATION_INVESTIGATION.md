# Auth Foundation Investigation

## 1. Summary

The current backend has no authentication or authorization layer. Inventory and customer APIs are public once the server is reachable, and future sales/returns/attendance APIs would inherit that risk unless auth is added before frontend expansion.

Recommended foundation:

- single-business user model, not multi-tenant;
- `users` table with role, password hash, active flag, and audit timestamps;
- `refresh_tokens` table for revocable sessions;
- Argon2id password hashing through `pwdlib` or Passlib with Argon2 support;
- short-lived JWT access tokens;
- refresh token stored server-side as a hashed opaque token;
- API returns tokens in response body first for simplicity, with an optional later move to HttpOnly cookies when the frontend deployment shape is known;
- FastAPI dependencies for `get_current_user` and `require_roles`;
- route-level role protection for inventory/customer APIs first, then sales/returns and attendance.

First implementation should be schema + auth service + login/me/logout/refresh endpoints, followed by route protection in a separate batch.

## 2. Current Backend Structure Reviewed

Reviewed files:

- `backend/app/main.py`
- `backend/app/api/deps.py`
- `backend/app/api/errors.py`
- `backend/app/api/routes/health.py`
- `backend/app/api/routes/inventory.py`
- `backend/app/api/routes/customers.py`
- `backend/app/core/config.py`
- `backend/app/core/exceptions.py`
- `backend/app/infrastructure/db/session.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/pyproject.toml`

Current structure:

- `create_app()` registers health, inventory, and customer routers under `settings.api_prefix`.
- `api/deps.py` only exposes `get_session()`.
- `get_db_session()` creates request-scoped SQLAlchemy sessions, but transaction commit/rollback is currently handled inside route helpers.
- `api/errors.py` maps domain/application errors into simple JSON responses shaped as `{"error": {"code": "...", "message": "..."}}`.
- `core/config.py` has `APP_NAME`, `APP_ENV`, `API_PREFIX`, and `DATABASE_URL`.
- No CORS config exists yet.
- No auth models, auth settings, password utilities, token utilities, current-user dependency, or authorization guards exist.
- `pyproject.toml` currently does not include auth/security dependencies.

Important API observation:

- Health can remain public.
- Inventory and customer routes should become protected before real deployment.
- Mutating inventory/customer endpoints use local route-level transaction helpers; auth dependencies should not own transactions.

## 3. Recommended Auth Model

Use a simple single-business model:

- one owner/admin user at bootstrap;
- optional additional staff/admin users later;
- employee users can be added when the attendance portal is built;
- no tenant table and no tenant_id columns in this phase.

Core user identity:

- one `users` table;
- login identifier should be `username` or `email`;
- keep both if practical, but make `username` required and unique because not every employee may have email;
- role stored as a string enum-compatible column;
- active/inactive flag for disabling accounts without deleting history;
- password hash stored only for password-authenticated users;
- future external auth is out of scope.

Recommended service layout:

- `app/domain/auth.py` for roles/constants and permission mapping;
- `app/infrastructure/db/models/auth.py` for `User` and `RefreshToken`;
- `app/infrastructure/db/repositories/auth.py` for thin user/token queries;
- `app/application/auth_service.py` for login, token issuance, refresh, logout, password verification;
- `app/api/routes/auth.py` for login/logout/me/refresh;
- `app/api/deps.py` extended with `get_current_user()` and `require_roles(...)`;
- `app/schemas/auth.py` for request/response models.

## 4. Recommended Roles and Permissions

Roles:

| Role | Purpose |
| --- | --- |
| `owner` | Main business owner. Full access, including user management and migration/admin actions. |
| `admin` | Full operational access except destructive system-level settings if those are later separated. Useful if the owner wants another administrator. |
| `attendance_manager` | Manage employees, attendance periods, attendance corrections, and attendance reports. |
| `employee` | Employee-facing attendance portal access only. Should not access inventory/customer/sales admin APIs. |
| `read_only` | View inventory/customer/sales reports without mutations. Optional but useful for audit/accounting use. |

Initial permission shape:

| Area | owner | admin | attendance_manager | employee | read_only |
| --- | --- | --- | --- | --- | --- |
| Inventory read | yes | yes | no by default | no | yes |
| Inventory write | yes | yes | no | no | no |
| Customers read | yes | yes | no by default | no | yes |
| Customers write | yes | yes | no | no | no |
| Sales/returns read | yes | yes | no by default | no | yes |
| Sales/returns write | yes | yes | no | no | no |
| Attendance admin | yes | yes | yes | no | no by default |
| Employee self-service | yes | yes | yes, for support | yes, self only | no |
| User management | yes | limited or yes by policy | no | no | no |
| Import/cutover tools | yes only | no by default | no | no | no |

Recommendation:

- Start with role checks rather than a full permissions table.
- Keep a pure Python role-to-permission mapping for now.
- Add database-backed permission overrides only if the business needs fine-grained ACLs later.

## 5. Recommended Token/Session Strategy

Recommended initial strategy:

- JWT access token, short lived;
- opaque refresh token, long lived and stored hashed in PostgreSQL;
- bearer tokens in JSON responses for the first backend/API batch;
- optional HttpOnly cookie mode later when frontend deployment, domain, HTTPS, and CSRF requirements are concrete.

Why this balance fits the project:

- JWT access tokens are easy for FastAPI dependencies and API tests.
- Server-stored refresh tokens provide logout/revocation, unlike stateless long-lived JWTs.
- Avoids committing early to cookie/SameSite/CSRF behavior before the React app and attendance portal hosting are known.
- Keeps the model single-business and operationally simple.

Access token:

- signed JWT;
- algorithm: `HS256` initially with a strong `AUTH_SECRET_KEY`;
- expiry: 15 to 30 minutes;
- claims: `sub` user id, `role`, `iat`, `exp`, `jti`;
- do not store sensitive profile details in token claims.

Refresh token:

- random opaque token, at least 32 bytes entropy;
- store only a hash in `refresh_tokens.token_hash`;
- expiry: 7 to 30 days depending business tolerance;
- rotate on refresh if implementation cost remains low;
- support logout by revoking the current refresh token;
- support logout-all by revoking all user refresh tokens.

Cookie alternative:

- HttpOnly cookies are a good future option for browser-only admin and employee portals.
- If cookies are used, add CSRF protection for mutating requests, set `Secure`, `HttpOnly`, and `SameSite=Lax` or `Strict`, and configure trusted origins.
- Defer cookie mode until frontend hosting and domain layout are known.

Server-side sessions alternative:

- Valid and simple, but requires session lookup on every request.
- Since refresh tokens already require server storage and access JWTs avoid per-request DB session lookups unless the user must be loaded, JWT + refresh table is the better first fit.

## 6. Schema Proposal

### `users`

Columns:

- `id`: bigint primary key / identity;
- `username`: varchar(64), required, unique, indexed;
- `email`: varchar(255), nullable, unique where not null if PostgreSQL partial index is used;
- `display_name`: varchar, required;
- `password_hash`: text, required for password users;
- `role`: varchar(32), required, indexed;
- `is_active`: boolean, required, default true, indexed;
- `last_login_at`: timestamptz nullable;
- `created_at`: timestamptz required;
- `updated_at`: timestamptz required.

Constraints:

- username non-blank at service validation level;
- role must be one of known role values;
- email uniqueness should be case-insensitive eventually. Start by normalizing email to lowercase in service code.

Indexes:

- unique `username`;
- unique `email` where email is not null, if Alembic/PostgreSQL-specific partial index is acceptable;
- `role, is_active`;
- `is_active`.

### `refresh_tokens`

Columns:

- `id`: bigint primary key / identity;
- `user_id`: bigint required FK `users.id` on delete cascade;
- `token_hash`: varchar/text required, unique, indexed;
- `expires_at`: timestamptz required, indexed;
- `revoked_at`: timestamptz nullable;
- `created_at`: timestamptz required;
- `last_used_at`: timestamptz nullable;
- `user_agent`: text nullable;
- `ip_address`: varchar(64) nullable.

Indexes:

- `user_id, revoked_at`;
- `expires_at`;
- unique `token_hash`.

### Bootstrap Strategy

Initial owner user options:

1. CLI command: `python -m app.auth.bootstrap_owner --username admin --password ...`
2. Environment-only first-run bootstrap: `BOOTSTRAP_OWNER_USERNAME`, `BOOTSTRAP_OWNER_PASSWORD`, then refuse if any owner exists.

Recommendation:

- Implement a CLI bootstrap first. It is explicit and avoids silently creating users in production.
- For local development/tests, fixtures can create users directly.
- Do not store production default passwords in `.env.example`.

## 7. API Proposal

Routes under `/api/auth`:

### `POST /api/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "..."
}
```

Response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": 1,
    "username": "admin",
    "display_name": "Owner",
    "role": "owner"
  }
}
```

Error behavior:

- invalid credentials: HTTP 401 with generic message;
- inactive user: HTTP 403 or 401 with generic message. Prefer 403 when already identified, but avoid revealing details on login.

### `POST /api/auth/refresh`

Request:

```json
{
  "refresh_token": "..."
}
```

Response:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

Recommendation:

- rotate refresh tokens when refreshing;
- revoke the previous refresh token after successful refresh.

### `POST /api/auth/logout`

Request:

```json
{
  "refresh_token": "..."
}
```

Response:

```json
{
  "status": "ok"
}
```

For bearer-only access tokens, logout revokes refresh tokens but cannot revoke already-issued access tokens unless a token denylist is added. Keep access tokens short lived.

### `GET /api/auth/me`

Authorization:

```text
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 1,
  "username": "admin",
  "display_name": "Owner",
  "role": "owner",
  "is_active": true
}
```

### Future Admin User Endpoints

Defer unless needed immediately:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/{user_id}`
- `POST /api/users/{user_id}/reset-password`
- `POST /api/users/{user_id}/deactivate`

These should be owner/admin-only and are not required for the first auth batch if CLI bootstrap is enough.

## 8. Config and Security Decisions

Add settings:

- `AUTH_SECRET_KEY`: required in non-local environments, no hardcoded production default;
- `ACCESS_TOKEN_EXPIRE_MINUTES`: default `30`;
- `REFRESH_TOKEN_EXPIRE_DAYS`: default `14`;
- `AUTH_ISSUER`: default `QuanLyHangHoaWeb`;
- `CORS_ALLOWED_ORIGINS`: comma-separated list, default local development origins only;
- optional `AUTH_COOKIE_MODE`: false initially.

Password hashing:

- prefer Argon2id through `pwdlib[argon2]` or Passlib with Argon2;
- bcrypt is acceptable if Argon2 dependencies become a packaging issue;
- never store plain passwords;
- add password length validation, minimum 10 or 12 characters for admin-created accounts.

Secret management:

- `.env.example` should include placeholders, not real secrets;
- production `AUTH_SECRET_KEY` must come from deployment secret storage;
- rotate secret only with a plan because it invalidates JWTs.

CORS:

- add `CORSMiddleware` before frontend work;
- allow only explicit origins, for example `http://localhost:5173` in development;
- do not use wildcard origins with credentials.

Rate limiting:

- defer full distributed rate limiting for now;
- first implementation can add simple login failure logging and leave rate limiting as a deployment/API gateway concern;
- before production, add either app-level login throttling or reverse-proxy rate limiting.

Audit logging:

- defer full audit table;
- keep `last_login_at`, refresh token timestamps, and optional IP/user-agent for sessions;
- later add audit events for destructive inventory/customer/sales operations.

Error handling:

- add `AuthenticationError` and `AuthorizationError` or map FastAPI `HTTPException` consistently;
- return 401 for missing/invalid token;
- return 403 for valid user without required role;
- do not expose whether username or password was wrong.

## 9. Route Protection Plan

Public routes:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

Authenticated routes:

- `GET /api/auth/me`
- `POST /api/auth/logout`

Inventory/customer admin APIs:

- read endpoints: allow `owner`, `admin`, `read_only`;
- write endpoints: allow `owner`, `admin`;
- debt payment mutation: allow `owner`, `admin`;
- ledger read: allow `owner`, `admin`, `read_only`.

Future sales/returns APIs:

- read endpoints: allow `owner`, `admin`, `read_only`;
- create/update/delete endpoints: allow `owner`, `admin`;
- import/cutover endpoints, if ever exposed: `owner` only. Prefer keeping import commands CLI-only.

Future attendance APIs:

- attendance admin/manager workflows: `owner`, `admin`, `attendance_manager`;
- employee portal self-service: `employee` for own records only;
- QR attendance flow: likely requires a separate short-lived signed QR token or kiosk/session design, not standard admin bearer token only.

Implementation pattern:

- extend `api/deps.py`:
  - `get_current_user`;
  - `require_roles(*roles)`;
  - optionally `CurrentUserDep` alias.
- attach dependencies per router or per route:
  - router-level dependency for broad protection;
  - route-level dependency for write-only restrictions.
- keep health public.

## 10. Testing Plan

Schema tests:

- `users` and `refresh_tokens` exist in metadata;
- unique username constraint exists;
- refresh token FK and indexes exist;
- Alembic migration creates/drops auth tables.

Auth service tests:

- password hash verifies correct password;
- wrong password rejected;
- inactive user cannot login;
- login updates `last_login_at`;
- access token contains expected subject/role and expires;
- refresh token is stored hashed;
- refresh rotates token and revokes old token;
- logout revokes refresh token;
- expired/revoked refresh token rejected.

API tests:

- `POST /api/auth/login` succeeds with valid credentials;
- login rejects wrong credentials with 401;
- `GET /api/auth/me` succeeds with bearer token;
- `GET /api/auth/me` rejects missing/invalid token;
- logout revokes refresh token;
- route protection blocks anonymous inventory/customer access after protection batch;
- read-only role can read but cannot mutate;
- employee role cannot access admin inventory/customer APIs.

PostgreSQL tests:

- auth migration upgrade head;
- unique username behavior;
- refresh token uniqueness/revocation;
- route protection with real DB session if `TEST_DATABASE_URL` is available.

Security-focused tests:

- error response does not reveal raw token/password internals;
- disabled user token rejected if the user is deactivated after token issuance;
- access token with unknown user id rejected.

## 11. Recommended Implementation Batches

### Batch A: Auth Schema and Config

- Add auth role enum/constants.
- Add `users` and `refresh_tokens` models.
- Add Alembic migration.
- Add auth settings to `core/config.py`.
- Add metadata/migration tests.

Why first:

- low behavioral risk;
- establishes storage model before token endpoints.

### Batch B: Password and Token Service

- Add password hashing helper.
- Add JWT helper.
- Add auth repository/service.
- Add refresh token hashing, creation, rotation, revocation.
- Add service tests.

Dependency note:

- Add minimal auth dependencies such as `pwdlib[argon2]` and `PyJWT` or `python-jose`.
- Prefer well-maintained small packages over custom crypto.

### Batch C: Auth API and Bootstrap

- Add `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`.
- Add CLI owner bootstrap command.
- Add API tests.
- Add `.env.example` updates.

### Batch D: Protect Existing Routes

- Add `get_current_user` and `require_roles`.
- Protect inventory/customer routes.
- Keep health public.
- Add unauthorized/forbidden API tests.

### Batch E: Frontend/Attendance-Oriented Enhancements

- Add CORS config once frontend origin is known.
- Decide whether to move browser clients to HttpOnly cookies.
- Add employee-specific attendance portal authorization rules.
- Add owner/admin user-management endpoints if needed.

## 12. Explicit Out-of-Scope Items

- No code implementation in this investigation.
- No database migration in this investigation.
- No database mutation.
- No desktop reference repository modification.
- No frontend login screen.
- No production secret creation.
- No OAuth/social login.
- No multi-tenant organizations.
- No complete audit logging system.
- No rate limiting implementation yet.
- No attendance QR token design beyond noting the need.
- No production deployment or cutover work.
