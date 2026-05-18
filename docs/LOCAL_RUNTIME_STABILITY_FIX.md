# Local Runtime Stability Fix

## Root Causes

- Browser writes use JSON `POST` requests, so the browser sends an `OPTIONS` preflight before product, customer, and invoice mutations. Without FastAPI `CORSMiddleware` registered before routers, `/api/inventory/products` can answer `405 Method Not Allowed` to preflight even when direct backend calls work.
- The frontend local auth bypass only skips the login shell. Backend protected routes still require either a bearer token or backend `APP_ENV=local` plus `AUTH_BYPASS=true`.
- Local browser origins vary between `localhost` and `127.0.0.1`. CORS must allow both frontend origins, and the frontend must display the resolved API base URL that it actually calls.

## CORS Behavior

Backend CORS is configured in `backend/app/main.py` through FastAPI `CORSMiddleware`.

Local defaults from `CORS_ALLOWED_ORIGINS` include:

```text
http://localhost:5173
http://127.0.0.1:5173
http://localhost:3000
http://127.0.0.1:3000
```

The middleware uses:

```text
allow_methods=["*"]
allow_headers=["*"]
allow_credentials=False
```

`CORS_ALLOWED_ORIGINS` accepts a comma-separated string:

```powershell
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
```

Production-like `APP_ENV` values reject wildcard CORS origins and reject auth bypass at settings validation time.

## Local Auth Bypass

Use bypass only for local development:

```powershell
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
```

Backend protected APIs work without an `Authorization` header only when `APP_ENV` is `local`, `dev`, `development`, or `test` and `AUTH_BYPASS=true`.

The frontend bypass is separate:

```powershell
Set-Content frontend\.env.local "VITE_AUTH_BYPASS=true`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
```

Restart both backend and Vite after changing environment values.

## Local Run Commands

From the repository root:

```powershell
docker compose up -d postgres
```

Backend:

```powershell
Set-Location backend
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```powershell
Set-Location frontend
Set-Content .env.local "VITE_AUTH_BYPASS=true`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Open:

```text
http://localhost:5173
```

The top bar shows the resolved API base URL, for example `http://127.0.0.1:8000/api`.

## Smoke Test Commands

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Preflight:

```powershell
Invoke-WebRequest `
  -Method OPTIONS `
  -Uri http://127.0.0.1:8000/api/inventory/products `
  -Headers @{
    Origin="http://localhost:5173"
    "Access-Control-Request-Method"="POST"
    "Access-Control-Request-Headers"="content-type"
  }
```

Expected: status `200` or `204`, with `Access-Control-Allow-Origin: http://localhost:5173`.

Protected read without token when backend bypass is enabled:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/inventory/products
```

Create product:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri http://127.0.0.1:8000/api/inventory/products `
  -ContentType "application/json" `
  -Body '{"product_code_base":"local-smoke","product_name":"Local Smoke Product","unit_mode":"BAO_KG","prices":[{"unit_type":"BAO","price":"100.00","is_enabled":true}]}'
```

Create customer:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri http://127.0.0.1:8000/api/customers `
  -ContentType "application/json" `
  -Body '{"customer_name":"Local Smoke Customer","opening_balance":"0"}'
```

Create invoice, replacing `<PRODUCT_ID>` and `<CUSTOMER_ID>`:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri http://127.0.0.1:8000/api/sales/invoices `
  -ContentType "application/json" `
  -Body '{"customer_id":<CUSTOMER_ID>,"customer_snapshot_name":null,"invoice_datetime":"2026-05-18T09:00:00+00:00","paid_amount":"100.00","payment_method":"CASH","items":[{"product_id":<PRODUCT_ID>,"unit_type":"BAO","quantity":"1","unit_price":"100.00"}]}'
```

## Common Failures

- `OPTIONS ... 405 Method Not Allowed`: backend is not running the app version with `CORSMiddleware`, or the request is missing `Origin` / `Access-Control-Request-Method` headers.
- `Cannot connect API at ...`: backend is down, `VITE_API_BASE_URL` points to a different host/port, or CORS rejected the browser origin.
- `Missing bearer token` while frontend bypass is enabled: backend was not started with `APP_ENV=local` and `AUTH_BYPASS=true`.
- CORS works for `localhost` but not `127.0.0.1`: add both frontend origins to `CORS_ALLOWED_ORIGINS` and restart the backend.
- Vite still calls the old API base URL: restart `npm.cmd run dev`; Vite reads `.env.local` at startup.
