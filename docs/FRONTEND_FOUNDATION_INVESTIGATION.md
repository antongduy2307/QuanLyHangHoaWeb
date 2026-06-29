# Frontend Foundation Investigation

## 1. Summary

The backend now has protected FastAPI routes for auth, inventory, customers, sales, and returns, with PostgreSQL-backed smoke tests. The frontend can start with a focused React admin application that consumes those APIs without changing backend behavior.

Recommended direction:

- Use React + TypeScript with Vite for the first frontend milestone.
- Build one admin web app first, with a structure that can later host or share code with an employee attendance portal.
- Use bearer-token auth initially because the backend currently returns access and refresh tokens in JSON.
- Keep the API client handwritten for the first milestone, with typed request/response models aligned to the backend schemas.
- Start with login/logout, protected route shell, inventory product list, and create product form before implementing sales/returns screens.

No code was implemented as part of this investigation.

## 2. Recommended Frontend Stack

### Application Framework

Use Vite + React + TypeScript.

Reasons:

- The app is an operational single-business admin tool, not a public SEO site.
- Vite keeps the initial setup small and fast.
- The backend already owns API routing and data access; Next.js server rendering would add complexity without clear benefit for the current admin workflows.
- The future employee attendance portal can still live in the same Vite project as a separate route group, or be split later if deployment needs diverge.

Recommended packages:

- React 18 or current stable React.
- TypeScript with strict mode.
- Vite for dev server/build.
- React Router for client-side routing.
- TanStack Query for server state, caching, invalidation, and request lifecycle.
- React Hook Form for forms.
- Zod for frontend validation and API payload parsing where useful.
- TanStack Table for inventory/customer/sales tables.
- A lightweight component strategy based on local components plus Radix UI primitives if needed.
- Lucide React for icons.

Avoid for the first milestone:

- Next.js unless SSR, file-based routing, or server actions become a concrete requirement.
- Redux for server state; TanStack Query is a better fit.
- Large admin templates that impose layout and styling decisions before the workflows are understood.
- Heavy data-grid licensing dependencies until actual table needs exceed TanStack Table.

## 3. Proposed Frontend Repo Structure

Target structure under `frontend/`:

```text
frontend/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    app/
      App.tsx
      router.tsx
      providers.tsx
      queryClient.ts
    config/
      env.ts
    api/
      client.ts
      errors.ts
      auth.ts
      inventory.ts
      customers.ts
      sales.ts
      returns.ts
      types.ts
    auth/
      AuthProvider.tsx
      authStore.ts
      RequireAuth.tsx
      RequireRole.tsx
      LoginPage.tsx
    layouts/
      AdminLayout.tsx
      Sidebar.tsx
      TopBar.tsx
    features/
      dashboard/
        DashboardPage.tsx
      inventory/
        ProductListPage.tsx
        ProductCreatePage.tsx
        productSchemas.ts
        productQueries.ts
      customers/
        CustomerListPage.tsx
        customerQueries.ts
      sales/
        InvoiceListPage.tsx
        invoiceQueries.ts
      returns/
        ReturnListPage.tsx
        returnQueries.ts
      reports/
        ReportsPlaceholder.tsx
      settings/
        SettingsPlaceholder.tsx
    components/
      ui/
      forms/
      tables/
      feedback/
    domain/
      roles.ts
      units.ts
      money.ts
      dates.ts
    tests/
      mocks/
      testUtils.tsx
```

Structure rationale:

- `api/` owns HTTP calls, auth headers, refresh behavior, and API types.
- `auth/` owns login state, route guards, and role checks.
- `features/` groups workflow-specific screens and query hooks.
- `components/` holds reusable UI primitives that are not domain-specific.
- `domain/` holds shared constants and formatting helpers such as roles, units, money, quantities, and dates.

Future attendance portal options:

1. Same Vite app, separate route group: `/attendance`.
2. Same repo, second Vite entry/app: `src/apps/admin` and `src/apps/attendance`.
3. Separate frontend app later if deployment, device constraints, or offline behavior diverge.

Recommendation: start with one Vite app and keep `features/attendance/` out until backend attendance APIs exist.

## 4. Auth Flow Design

### Login

Flow:

1. User opens `/login`.
2. Submit username/password to `POST /api/auth/login`.
3. Store returned access token, refresh token, expiry metadata, and user profile in the auth provider.
4. Redirect to the originally requested protected route or `/`.
5. Load `/api/auth/me` on app startup if tokens exist.

### Token Storage

Initial recommendation:

- Store the access token in memory.
- Store the refresh token in `sessionStorage` for the first implementation.
- Rehydrate by calling refresh on page reload.

Tradeoff:

- `sessionStorage` is still JavaScript-accessible, so XSS would be serious.
- It is less persistent than `localStorage`, which reduces exposure on shared machines.
- A pure in-memory refresh token would be safer but logs users out on every reload.

Do not use long-lived localStorage by default.

Future migration:

- Move refresh token handling to HttpOnly Secure cookies when frontend/backend deployment origins and HTTPS are defined.
- Add CSRF protection if cookie-auth mutating requests are enabled.

### Refresh Handling

Use a single-flight refresh mechanism in the API client:

- On a 401 from a protected endpoint, attempt `POST /api/auth/refresh` once if a refresh token exists.
- Queue or deduplicate concurrent refresh attempts.
- Retry the original request only once after refresh succeeds.
- If refresh fails, clear auth state and redirect to `/login`.

Avoid infinite refresh loops by marking refresh requests as non-refreshable.

### Logout

Flow:

1. Call `POST /api/auth/logout` with the refresh token if present.
2. Clear in-memory access token and sessionStorage refresh token.
3. Clear TanStack Query cache.
4. Redirect to `/login`.

Logout should be idempotent in the UI because the backend logout is idempotent.

### Route Guards

Use:

- `RequireAuth` for any admin shell route.
- `RequireRole` for role-specific route groups or actions.

Current role gates:

- Inventory/customer/sales/returns read UI: `owner`, `admin`, `read_only`.
- Mutating buttons/forms: `owner`, `admin`.
- Hide or disable write actions for `read_only`.
- Do not show admin modules to `employee` or `attendance_manager`.

The backend remains authoritative. UI gating is only usability and defense-in-depth.

## 5. API Client Strategy

### Base URL

Use `VITE_API_BASE_URL`, for example:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

Keep `/api` in the configured base URL so route modules can call paths like `/inventory/products`.

### HTTP Client

Start with a small typed wrapper over `fetch`.

Responsibilities:

- build URLs from `VITE_API_BASE_URL`;
- attach `Authorization: Bearer <access_token>`;
- JSON encode request bodies;
- parse JSON responses;
- normalize backend error shape;
- trigger refresh-on-401 for protected routes;
- expose typed helpers such as `api.get<T>()`, `api.post<TBody, TResponse>()`.

Axios is acceptable, but not necessary at this stage.

### Types

Use handwritten TypeScript types for the first milestone:

- `AuthUser`
- `TokenPair`
- `Product`
- `ProductPrice`
- `InventoryBalance`
- `Customer`
- `Invoice`
- `InvoiceItem`
- `ReturnInvoice`
- `ReturnInvoiceItem`
- `ApiError`

Recommendation:

- Keep handwritten types aligned with backend Pydantic response models for the first UI slice.
- Revisit generated clients after the API stabilizes. FastAPI OpenAPI generation can support later generation with `openapi-typescript` or similar tools.

Why not generated client immediately:

- The backend is still evolving through migration phases.
- A generated client can be added later without changing the UI architecture if all calls go through `api/`.
- Handwritten types keep the first implementation smaller and easier to review.

### Error Handling

Backend error shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "..."
  }
}
```

Frontend handling:

- Convert non-2xx responses into an `ApiError`.
- Show validation/domain errors near the form where possible.
- Show conflict errors such as duplicate product code as actionable field/form errors.
- Show unauthorized state by redirecting to login.
- Show forbidden state with a compact access-denied message or hidden action.

### Decimal, Money, Quantity

Backend returns Decimal values as JSON-safe strings in many responses. Treat money and quantities as strings at the API boundary.

Frontend should:

- keep form values as strings;
- validate with Zod regex/refinement;
- format display values with `Intl.NumberFormat`;
- avoid JavaScript floating-point math for financial totals where the backend is authoritative.

For client-side previews, use a decimal library only if needed. Do not introduce it in the first milestone unless calculations become user-facing.

## 6. Admin Layout Proposal

The admin app should be utilitarian and dense enough for repeated daily use.

Recommended layout:

- Left sidebar navigation.
- Top bar with page title, current user, and logout menu.
- Main content area with tables/forms.
- No marketing-style landing page.
- Dashboard can be a placeholder until reporting APIs exist.

Navigation:

- Dashboard
- Inventory
- Customers
- Sales
- Returns
- Reports
- Settings

Initial route map:

```text
/login
/
/inventory/products
/inventory/products/new
/customers
/sales/invoices
/returns
/reports
/settings
```

Role visibility:

- `owner`, `admin`: show all current admin modules and write actions.
- `read_only`: show admin modules but hide create/edit/delete actions.
- `attendance_manager`, `employee`: no access to admin shell for current modules.

UI tone:

- restrained operational interface;
- compact tables;
- clear filters/search;
- predictable modals or pages for create/edit;
- Vietnamese labels where appropriate for end users, while keeping code identifiers English.

## 7. First Frontend Milestone

Recommended first vertical slice:

1. Vite + React + TypeScript skeleton.
2. Environment config with `VITE_API_BASE_URL`.
3. Auth provider and API client.
4. Login page.
5. Protected admin shell with sidebar/top bar.
6. Logout.
7. Inventory product list.
8. Create product form.
9. Role gating:
   - `owner`/`admin` can create;
   - `read_only` can list but cannot create;
   - `employee` denied from admin shell.

Why inventory first:

- Inventory product APIs are already stable and well tested.
- Product creation exercises auth, protected routes, form validation, enums, Decimal-like price strings, mutation invalidation, and conflict handling.
- It is smaller than sales/returns forms, which need product/customer selection, totals, stock effects, ledger effects, and document flows.

Acceptance criteria:

- User can log in with a bootstrapped owner account.
- User can refresh the page and remain logged in via refresh token.
- User can log out and tokens are cleared.
- Protected routes redirect anonymous users to login.
- Product list loads from the backend.
- Create product form submits valid `BAO_KG` and `BICH` products.
- Duplicate product code conflict is shown cleanly.
- `read_only` cannot see or submit the create form.

## 8. Testing Strategy

### Unit and Component Tests

Use Vitest + React Testing Library.

Test:

- auth reducer/provider state transitions;
- route guards;
- role-gated UI controls;
- API error parsing;
- form validation;
- product list loading states;
- create product success/error states.

### API Mocking

Use MSW for component/integration-style tests.

Why:

- It exercises fetch-based API behavior without running the backend.
- It can return the same backend error shape.
- It supports auth/refresh scenarios cleanly.

Mock cases:

- login success/failure;
- `/auth/me` success/401;
- product list success;
- create product validation error;
- duplicate product conflict;
- 401 followed by successful refresh and retry;
- refresh failure leading to logout.

### E2E Later

Use Playwright after the first UI slice is real.

Initial E2E:

- login;
- view product list;
- create product;
- logout;
- read-only user cannot create product.

Run E2E against a disposable backend/PostgreSQL database, not production data.

### Contract Checks

Near-term:

- maintain TypeScript API types manually and review when backend response models change.

Later:

- generate OpenAPI types in CI and fail when frontend types drift materially, if that becomes useful.

## 9. Environment and Deployment Notes

### Local Development

Backend:

```text
http://localhost:8000
```

Frontend:

```text
http://localhost:5173
```

Frontend env:

```text
VITE_API_BASE_URL=http://localhost:8000/api
```

Backend CORS:

- Allow `http://localhost:5173` in development.
- Avoid wildcard origins for production.
- If cookie auth is introduced later, configure credentialed CORS explicitly.

### Production Build

Use:

```powershell
npm run build
```

Deployment options:

- Serve static frontend from a web server or CDN and point it to the FastAPI API origin.
- Serve the built assets behind the same reverse proxy as FastAPI to simplify CORS.
- Keep API base URL configurable at build time or via a runtime config file if deployment needs one image across environments.

Recommendation:

- For first production planning, deploy frontend and backend behind the same domain with `/api` proxied to FastAPI. This reduces CORS and token exposure complexity.

## 10. Risks and Decisions

### Bearer Token Storage

Risk:

- JavaScript-accessible refresh tokens are vulnerable to XSS.

Decision:

- Use sessionStorage only for the first frontend milestone.
- Keep access token in memory.
- Plan HttpOnly cookie migration before production exposure if the deployment shape supports it.

### Refresh Complexity

Risk:

- Multiple concurrent 401 responses can trigger refresh races.

Decision:

- Implement single-flight refresh in the API client from the beginning.

### Large Tables

Risk:

- Inventory, customers, invoices, and returns may grow beyond simple client-side lists.

Decision:

- Use TanStack Query and TanStack Table, but start with simple server calls.
- Add backend pagination/filter parameters in a later API batch when real usage requires it.

### Forms

Risk:

- Sales/returns forms are complex and easy to get wrong.

Decision:

- Do not start with sales/returns UI.
- Build inventory first, then customers, then sales/returns after reusable form/table patterns settle.

### Vietnamese Labels and Formatting

Risk:

- Code identifiers are English, but users may expect Vietnamese UI labels, currency formatting, date formats, and units.

Decision:

- Keep code English.
- Use Vietnamese UI copy where user-facing.
- Centralize money, quantity, date, and unit formatting helpers.

### Decimal Handling

Risk:

- JavaScript number math can introduce rounding errors.

Decision:

- Treat API Decimal values as strings.
- Let the backend be authoritative for persisted totals.
- Add a decimal library only when client-side sales/return previews require exact arithmetic.

### Attendance Portal

Risk:

- Employee attendance may need mobile-first screens, QR/kiosk flow, and different auth UX.

Decision:

- Keep admin shell separate from future attendance route group.
- Do not force attendance UX into the first admin layout.

## 11. Recommended Implementation Batches

### Frontend Batch 1: Tooling and Shell

- Create Vite React TypeScript app.
- Add routing, providers, env config, base CSS.
- Add AdminLayout with sidebar/top bar.
- Add placeholder routes.
- Add basic test setup with Vitest and React Testing Library.

### Frontend Batch 2: Auth Flow

- Add API client foundation.
- Add auth API calls.
- Add AuthProvider.
- Add login/logout.
- Add refresh handling.
- Add protected route and role guard tests.

### Frontend Batch 3: Inventory Product Slice

- Add product API client.
- Add product list page.
- Add create product form.
- Add role-gated create action.
- Add validation and conflict handling.
- Add component tests with MSW.

### Frontend Batch 4: Customer Slice

- Add customer list/detail basics.
- Add customer creation.
- Add customer ledger read view.
- Keep debt payment mutation UI for a later customer workflow batch if needed.

### Frontend Batch 5: Sales/Returns Read-First

- Add invoice list/detail.
- Add return list/detail.
- Verify read-only workflows before adding document creation.

### Frontend Batch 6: Sales/Returns Mutation Workflows

- Add invoice creation/update/delete UI.
- Add return creation/update/delete UI.
- Add product/customer selectors.
- Add backend-authoritative totals and error handling.

### Frontend Batch 7: Reports and Settings Placeholders

- Add report placeholders or first report pages when backend reports exist.
- Add settings shell.
- Keep user management separate until backend user-management APIs exist.

### Frontend Batch 8: Attendance Portal Planning

- Revisit app split.
- Design employee login/portal routes.
- Add attendance-specific role guards after attendance backend APIs exist.

## 12. Explicit Out-of-Scope Items

- No frontend code implementation in this investigation.
- No backend code changes.
- No database changes.
- No desktop reference repository modification.
- No user management UI.
- No sales/returns UI implementation yet.
- No attendance portal implementation yet.
- No cookie auth migration implementation.
- No CSRF or rate limiting implementation.
- No production deployment.
- No historical import changes.
