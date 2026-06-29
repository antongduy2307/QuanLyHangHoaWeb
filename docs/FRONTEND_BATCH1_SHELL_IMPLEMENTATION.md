# Frontend Batch 1 Shell Implementation

## Summary

Created the initial Vite React TypeScript frontend shell under `frontend/`.

This batch adds frontend tooling, routing, TanStack Query provider setup, an admin layout, placeholder module pages, minimal operational styling, and Vitest/React Testing Library tests. It does not implement login, token storage, API client calls, real inventory data, or backend changes.

## Files Created or Modified

Modified:
- `frontend/README.md`

Created:
- `frontend/.env.example`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.node.json`
- `frontend/eslint.config.js`
- `frontend/src/main.tsx`
- `frontend/src/styles.css`
- `frontend/src/vite-env.d.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/app/App.test.tsx`
- `frontend/src/app/providers.tsx`
- `frontend/src/app/queryClient.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/config/env.ts`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/layouts/Sidebar.tsx`
- `frontend/src/layouts/TopBar.tsx`
- `frontend/src/components/PageHeader.tsx`
- `frontend/src/components/PlaceholderPanel.tsx`
- `frontend/src/domain/routes.ts`
- `frontend/src/domain/roles.ts`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/features/customers/CustomerListPage.tsx`
- `frontend/src/features/sales/InvoiceListPage.tsx`
- `frontend/src/features/returns/ReturnListPage.tsx`
- `frontend/src/features/reports/ReportsPlaceholder.tsx`
- `frontend/src/features/settings/SettingsPlaceholder.tsx`
- `frontend/src/tests/setupTests.ts`
- `frontend/src/tests/testUtils.tsx`

## Tooling Added

- Vite React TypeScript app foundation.
- React Router route tree.
- TanStack Query provider and default query client.
- Vitest with jsdom.
- React Testing Library and jest-dom assertions.
- ESLint flat config for TypeScript/React hooks/React refresh.
- Environment config with `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api`.

## Routes Added

- `/`
- `/inventory/products`
- `/customers`
- `/sales/invoices`
- `/returns`
- `/reports`
- `/settings`

All routes render placeholder content inside `AdminLayout`.

## UI Notes

The shell uses a left sidebar, top bar, and constrained main content area. Labels are user-facing Vietnamese without implementing business workflows yet. The design is intentionally operational and quiet rather than marketing-oriented.

## Tests Added

`frontend/src/app/App.test.tsx` covers:

- app shell renders;
- sidebar navigation links exist;
- each placeholder route renders the expected heading.

## Commands Run and Results

Initial install command:

```powershell
npm install
```

Result: failed because PowerShell blocked `npm.ps1`.

Retry:

```powershell
npm.cmd install --no-audit --no-fund --loglevel=error
```

Result: timed out inside the sandbox without producing `node_modules` or a lockfile.

Escalated retry for registry access:

```powershell
npm.cmd install --no-audit --no-fund --loglevel=error
```

Result: passed, `276 packages` installed and `package-lock.json` created.

Build:

```powershell
npm.cmd run build
```

Result: passed.

Tests:

```powershell
npm.cmd test
```

Result: `1 passed`, `9 tests passed`.

Lint:

```powershell
npm.cmd run lint
```

Result: passed.

## Caveats and Next Steps

- No login page or token storage exists yet.
- No API client exists yet.
- No backend routes are called from the frontend yet.
- No product/customer/sales/returns real data is rendered yet.
- Next recommended batch is auth flow foundation: API client, login/logout, refresh handling, protected route shell, and route guard tests.
