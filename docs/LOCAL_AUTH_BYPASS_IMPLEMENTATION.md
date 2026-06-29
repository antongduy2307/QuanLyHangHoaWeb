# Local Auth Bypass Implementation

## Summary

Added a reversible local development auth bypass for the frontend admin shell and backend protected API dependencies. This is intended only for local development while the normal frontend login issue is being deferred.

The existing auth system remains in place. Login, tokens, role guards, and backend auth services were not removed.

## What Changed

Frontend:

- Added `VITE_AUTH_BYPASS=true` support.
- When enabled, `AuthProvider` supplies a mock owner user:
  - `id: 0`
  - `username: "local-admin"`
  - `display_name: "Local Admin"`
  - `role: "owner"`
  - `is_active: true`
- Protected frontend routes open directly.
- Role guards treat the mock user as owner.
- Logout is hidden when bypass is enabled.

Backend:

- Added `AUTH_BYPASS=false` config.
- `get_current_user` returns a mock owner user without reading `Authorization` only when:
  - `AUTH_BYPASS=true`; and
  - `APP_ENV` is `local`, `dev`, `development`, or `test`.
- Config validation rejects `AUTH_BYPASS=true` outside local/dev/test environments.

## Files Changed

- `frontend/src/config/env.ts`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/layouts/TopBar.tsx`
- `frontend/src/tests/setupTests.ts`
- `frontend/src/app/App.test.tsx`
- `frontend/.env.example`
- `frontend/README.md`
- `backend/app/core/config.py`
- `backend/app/api/deps.py`
- `backend/tests/unit/test_config.py`
- `backend/tests/api/test_inventory_api.py`
- `.env.example`

## How To Run Local Bypass

Backend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend
Set-Content .env.local "VITE_AUTH_BYPASS=true`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

## How To Disable

Frontend:

```powershell
Set-Content .env.local "VITE_AUTH_BYPASS=false`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
```

Backend:

```powershell
$env:AUTH_BYPASS="false"
```

Restart both backend and frontend after changing environment variables.

## Production Warning

Never enable `AUTH_BYPASS=true` or `VITE_AUTH_BYPASS=true` in production. The backend blocks `AUTH_BYPASS=true` outside local/dev/test, but deployment configuration should still keep the variable unset or false.

## Verification

Commands run:

Frontend:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Backend:

```powershell
pytest
python -m compileall app tests
```

Results are recorded in the final task response.
