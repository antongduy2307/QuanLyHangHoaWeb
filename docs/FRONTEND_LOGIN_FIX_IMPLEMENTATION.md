# Frontend Login Fix Implementation

## Summary

Investigated the frontend login path after direct backend login succeeded. The frontend was building `/auth/login` through `VITE_API_BASE_URL`, but the fallback API base URL used `http://localhost:8000/api` and was not normalized. On Windows/local browser setups this can fail when the backend is reachable at `127.0.0.1:8000`, and trailing slashes in `.env.local` could produce malformed double-slash API URLs.

The fix makes the frontend default to `http://127.0.0.1:8000/api`, normalizes configured API base URLs, and adds tests proving the login request URL, JSON body, and error display behavior.

No backend code was changed.

## Root Cause

- Direct API login worked against `http://127.0.0.1:8000/api/auth/login`.
- The frontend fallback pointed at `http://localhost:8000/api`.
- If `VITE_API_BASE_URL` was unset, stale, or not restarted through Vite, frontend login used the fallback instead of the working `127.0.0.1` endpoint.
- The API base URL was concatenated directly, so values like `http://127.0.0.1:8000/api/` produced `.../api//auth/login`.

The request body and content type were already correct:

```json
{"username":"admin","password":"..."}
```

CORS was not changed in this fix. For the current backend defaults, use `http://localhost:5173` for the frontend origin or configure backend CORS if opening the frontend as `http://127.0.0.1:5173`.

## Files Changed

- `frontend/src/config/env.ts`
  - Changed fallback API base URL to `http://127.0.0.1:8000/api`.
  - Added `normalizeApiBaseUrl`.
  - Added development-only logging of the resolved API base URL.
- `frontend/src/api/client.ts`
  - Exported `buildApiUrl`.
  - Continued using normalized base URL for refresh, original request, and retry request.
- `frontend/src/app/App.test.tsx`
  - Added login URL/body/content-type coverage.
  - Added API base URL normalization coverage.
  - Added backend login error display coverage.
- `frontend/.env.example`
  - Updated default API base URL to `http://127.0.0.1:8000/api`.
- `frontend/README.md`
  - Updated local development API base guidance and Vite restart note.

## Verification

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 94 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

PowerShell printed the existing local profile execution-policy warning before command output; it did not affect the npm command results.

## Local Run Instructions

Backend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend
Set-Content .env.local "VITE_API_BASE_URL=http://127.0.0.1:8000/api"
npm.cmd run dev
```

Restart `npm.cmd run dev` after changing `.env.local`; Vite does not live-reload environment variables.

Open:

```text
http://localhost:5173
```

Login with the existing owner account:

```text
admin / ChangeMe12345!
```

## Caveats

- If the frontend is opened as `http://127.0.0.1:5173`, backend CORS must include that origin. The current frontend guidance uses `http://localhost:5173`.
- Do not log passwords or tokens. The only added diagnostic is the resolved API base URL in development.
