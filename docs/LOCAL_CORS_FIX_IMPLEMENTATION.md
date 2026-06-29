# Local CORS Fix Implementation

## Summary

Local frontend create flows were blocked by browser CORS preflight requests. FastAPI did not register `CORSMiddleware`, so `OPTIONS /api/inventory/products` reached the API router and returned `405 Method Not Allowed`.

The backend now registers FastAPI `CORSMiddleware` before API routers and reads allowed origins from `CORS_ALLOWED_ORIGINS`.

## Files Changed

- `backend/app/main.py`
  - Registers `CORSMiddleware` before route registration.
- `backend/app/core/config.py`
  - Adds parsed `cors_origins`.
  - Updates local default frontend origins.
  - Rejects wildcard CORS origins outside local/dev/test environments.
- `.env.example`
  - Updates local CORS origin examples.
- `docs/SETUP.md`
  - Updates local CORS run configuration.
- `backend/tests/api/test_cors.py`
  - Adds local Vite preflight coverage.
- `backend/tests/unit/test_config.py`
  - Adds CORS parsing and production wildcard safety coverage.

## CORS Behavior

Allowed origins are configured through comma-separated `CORS_ALLOWED_ORIGINS`.

Local defaults:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Middleware settings:

- `allow_methods=["*"]`
- `allow_headers=["*"]`
- `allow_credentials=False`

This matches the current bearer-token and local auth bypass mode. No cookie/CSRF behavior was added.

## Local Backend Command

From `E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend`:

```powershell
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend `.env.local`:

```text
VITE_AUTH_BYPASS=true
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Restart both backend and Vite after changing environment variables.

## Verification

Expected preflight check:

```powershell
Invoke-WebRequest `
  -Method Options `
  -Uri "http://127.0.0.1:8000/api/inventory/products" `
  -Headers @{
    Origin="http://localhost:5173"
    "Access-Control-Request-Method"="POST"
    "Access-Control-Request-Headers"="content-type"
  }
```

Expected:

- HTTP status `200` or `204`
- `Access-Control-Allow-Origin: http://localhost:5173`
- Not `405 Method Not Allowed`

## Commands Run

From `backend/`:

- `python -m pytest tests\api\test_cors.py tests\unit\test_config.py`
  - Result: `7 passed`.
- `python -m pytest`
  - Result: `215 passed, 16 skipped`.
- `python -m compileall app tests`
  - Result: passed.

## Caveats

- This does not change authentication behavior.
- Local auth bypass still requires backend `APP_ENV=local` and `AUTH_BYPASS=true`.
- Production should set explicit trusted origins and must not use wildcard CORS origins.
