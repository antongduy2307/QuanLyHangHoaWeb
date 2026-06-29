# Frontend Batch 2 Auth Implementation

## Summary

Implemented the frontend auth flow and protected admin route shell.

This batch adds a typed API client foundation, backend error parsing, bearer access-token handling, sessionStorage refresh-token handling, refresh-on-401 retry, login/logout, session restore, protected admin routes, and role guards. It does not implement real inventory/customer/sales/returns data screens yet.

## Files Changed

Created:
- `frontend/src/api/auth.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/errors.ts`
- `frontend/src/api/types.ts`
- `frontend/src/auth/AccessDeniedPage.tsx`
- `frontend/src/auth/AuthContext.ts`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/auth/LoginPage.tsx`
- `frontend/src/auth/RequireAuth.tsx`
- `frontend/src/auth/RequireRole.tsx`
- `frontend/src/auth/tokenStore.ts`
- `frontend/src/auth/useAuth.ts`
- `docs/FRONTEND_BATCH2_AUTH_IMPLEMENTATION.md`

Modified:
- `README.md`
- `frontend/README.md`
- `frontend/src/app/App.test.tsx`
- `frontend/src/app/providers.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/layouts/TopBar.tsx`
- `frontend/src/styles.css`
- `frontend/src/tests/setupTests.ts`
- `frontend/src/tests/testUtils.tsx`

## API Client Behavior

The frontend now has a small typed `fetch` wrapper that:

- reads `VITE_API_BASE_URL`;
- attaches `Authorization: Bearer <access_token>` when an access token is present;
- parses the backend error shape `{"error": {"code": "...", "message": "..."}}`;
- throws typed `ApiError` objects;
- handles 204 responses;
- performs one refresh-and-retry when a protected request returns 401;
- deduplicates concurrent refresh attempts with a single in-flight refresh promise.

## Auth Behavior

Implemented:

- `LoginPage`;
- `AuthProvider`;
- in-memory access token storage;
- `sessionStorage` refresh-token storage;
- `/api/auth/login`;
- `/api/auth/refresh`;
- `/api/auth/logout`;
- `/api/auth/me`;
- logout that clears tokens, user state, and TanStack Query cache;
- session restore from refresh token on app startup.

## Routing and Role Guards

Added:

- public `/login`;
- protected admin shell under `/`;
- anonymous users redirect to `/login`;
- `owner`, `admin`, and `read_only` can enter the current admin shell;
- `employee` and `attendance_manager` receive an access-denied page;
- `RequireRole` foundation for future role-gated UI controls.

## README Update Summary

Updated the root `README.md` to reflect the current project status:

- backend auth exists;
- protected inventory/customer/sales/returns APIs exist;
- import/rehearsal tooling exists;
- frontend shell exists;
- frontend auth flow has been added;
- outdated claims that auth/import/React UI are not implemented were removed.

Also updated `frontend/README.md` to describe the current Batch 2 auth shell status.

## Tests Added or Updated

Frontend tests now cover:

- login page rendering;
- successful login redirecting to the app;
- anonymous protected-route redirect to `/login`;
- logout clearing session storage and returning to login;
- refresh-token restore flow;
- 401 refresh-and-retry behavior;
- forbidden role access denied page;
- backend API error parsing;
- existing sidebar and placeholder route rendering behind allowed roles.

## Commands Run and Results

From `frontend/`:

```powershell
npm.cmd run build
```

Result: passed.

```powershell
npm.cmd test
```

Result: `1 passed`, `17 tests passed`.

```powershell
npm.cmd run lint
```

Result: passed.

Backend tests were not run because no backend code was changed.

## Caveats and Next Steps

- Refresh tokens are currently stored in `sessionStorage`, matching the frontend foundation plan. This should be revisited before production exposure if HttpOnly cookie deployment is feasible.
- No real inventory/customer/sales/returns API data is rendered yet.
- No user-management UI exists yet.
- Next recommended frontend batch is the inventory product vertical slice: typed product API calls, product list, create product form, validation, conflict display, and role-gated write actions.
