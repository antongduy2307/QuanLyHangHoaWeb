# QuanLyHangHoaWeb Frontend

React and TypeScript admin frontend for the QuanLyHangHoa web migration.

Current status: React admin frontend with auth, protected inventory/customer/sales/returns screens, product/customer/debt payment workflows, invoice mutation workflows, and return mutation workflows.

## Local Development

```powershell
npm install
npm run dev
```

Default API base URL:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Override it in `.env.local` when needed. Restart the Vite dev server after changing `VITE_API_BASE_URL`; Vite reads environment values at startup.

If the backend was started on `127.0.0.1:8000`, prefer the `127.0.0.1` API base URL above. If you use `http://localhost:8000/api`, keep the frontend opened from `http://localhost:5173` so the backend CORS origin matches local defaults.

The app top bar displays the resolved API base URL that browser requests use. If a network or CORS-style fetch failure occurs, the UI error includes that same resolved base URL.

## Local Auth Bypass

For local development only, the frontend can bypass the login screen and enter the admin shell as a mock owner user:

```powershell
Set-Content .env.local "VITE_AUTH_BYPASS=true`nVITE_API_BASE_URL=http://127.0.0.1:8000/api"
```

Restart Vite after changing `.env.local`.

Protected backend API calls also need the backend local bypass enabled:

```powershell
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
```

Do not enable bypass in production.

Full local runtime and smoke-check commands are documented in `../docs/LOCAL_RUNTIME_STABILITY_FIX.md`.

## Checks

```powershell
npm run build
npm test
npm run lint
```
