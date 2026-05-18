# Local E2E Runtime Fix

## Summary

Investigated local end-to-end usability with auth bypass enabled. The backend runtime was reachable and the protected APIs worked when the backend had `APP_ENV=local` and `AUTH_BYPASS=true`. Direct API calls successfully created a product, customer, and invoice.

The main frontend blocker found was a product payload mismatch: disabled BAO/KG price rows were sent with an empty string price, but the backend schema requires every price row to contain a Decimal value even when `is_enabled=false`.

## Root Causes

1. Product create payload mismatch:
   - Frontend sent disabled KG price as `""`.
   - Backend `ProductPriceRequest.price` is a Decimal and rejected `""`.
   - Fix: disabled prices are now sent as `"0"`.

2. Local auth bypass was incomplete without backend env:
   - Frontend bypass opens the shell, but protected backend APIs still require auth unless backend `AUTH_BYPASS=true`.
   - Fix from previous bypass work remains required: backend must run with `APP_ENV=local` and `AUTH_BYPASS=true`.
   - Frontend now shows a clear error if frontend bypass is enabled but backend rejects the request with 401.

3. API/network errors were too generic:
   - Fetch/CORS/backend-down failures surfaced as generic form errors.
   - Fix: shared API client now converts fetch failures into `ApiError` with the configured API base URL and logs dev-safe diagnostics without tokens/passwords.

4. Tests could accidentally inherit a local `.env.local` bypass setting:
   - Vite test mode can read local env files.
   - Fix: `VITE_AUTH_BYPASS` is ignored in test mode; tests use an explicit sessionStorage test switch when they need bypass behavior.

## Files Changed

- `frontend/src/api/client.ts`
  - Added fetch failure handling.
  - Added clearer frontend-bypass/backend-bypass mismatch error.
  - Added dev-safe API error logging.
- `frontend/src/config/env.ts`
  - Keeps test mode independent from `.env.local` auth bypass.
- `frontend/src/features/inventory/productSchemas.ts`
  - Sends disabled BAO/KG prices as `"0"` instead of `""`.
- `frontend/src/app/App.test.tsx`
  - Added backend-compatible payload assertions for product, customer, and invoice create flows.
  - Added invoice create navigation coverage.
  - Added bypass mismatch error coverage.

## Runtime Verification

Backend health and protected endpoint check:

```powershell
$base="http://127.0.0.1:8000/api"
Invoke-RestMethod -Method Get -Uri "$base/health"
Invoke-RestMethod -Method Get -Uri "$base/inventory/products"
```

Result:

- `GET /api/health`: returned `status=ok`.
- `GET /api/inventory/products` without bearer token: returned `200` with `AUTH_BYPASS=true`.

Direct local API E2E check:

- `POST /api/inventory/products`: succeeded.
- `POST /api/customers`: succeeded.
- `POST /api/sales/invoices`: succeeded.
- Created invoice detail payload returned successfully.

The check used the local development PostgreSQL database only.

## Commands Run

Frontend:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test`: passed, 98 tests.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend after bypass/config changes:

```powershell
python -m pytest
python -m compileall app tests
```

Results:

- `python -m pytest`: passed, 211 passed and 16 skipped.
- `python -m compileall app tests`: passed.

## Local Run Instructions

Backend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\backend
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd E:\QuanLyHangHoaWeb\QuanLyHangHoaWeb\frontend
Set-Content .env.local "VITE_AUTH_BYPASS=true`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
npm.cmd run dev
```

Restart the Vite dev server after changing `.env.local`.

Open:

```text
http://localhost:5173
```

## Manual Verification Checklist

1. Open `http://localhost:5173`.
   - Expected: admin shell opens directly as `Local Admin · owner`.
2. Go to `Hang hoa` and create a product.
   - Use BAO/KG with BAO enabled and KG disabled if desired.
   - Expected: product saves and product list reloads.
3. Go to `Khach hang` and create a customer.
   - Expected: customer saves and customer list reloads.
4. Go to `Ban hang`, click `Tao hoa don`.
   - Expected: create invoice page opens.
5. Select the product, choose customer or walk-in, fill payment as required, and submit.
   - Expected: invoice saves and redirects to invoice detail.

## Caveats

- This does not redesign login. It only keeps local development usable while auth troubleshooting continues.
- If frontend shows a backend-bypass mismatch message, restart backend with `APP_ENV=local` and `AUTH_BYPASS=true`.
- If frontend shows a network/CORS message, verify backend is running on `127.0.0.1:8000` and restart Vite after `.env.local` changes.
