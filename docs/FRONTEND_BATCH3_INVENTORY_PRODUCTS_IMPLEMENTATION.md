# Frontend Batch 3 Inventory Products Implementation

## Summary

Implemented the first real frontend vertical slice for inventory products.

This batch adds a typed inventory API client, TanStack Query hooks, a real product list page, a role-gated create-product route, local form validation, loading/error/empty states, and frontend tests for the inventory workflow. Backend code was not changed.

## Files Changed

Created:
- `frontend/src/api/inventory.ts`
- `frontend/src/features/inventory/ProductCreatePage.tsx`
- `frontend/src/features/inventory/productQueries.ts`
- `frontend/src/features/inventory/productSchemas.ts`
- `docs/FRONTEND_BATCH3_INVENTORY_PRODUCTS_IMPLEMENTATION.md`

Modified:
- `frontend/src/api/types.ts`
- `frontend/src/app/App.test.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/styles.css`

## UI Behavior

Product list:

- loads products through TanStack Query;
- supports the backend `search` query parameter;
- displays loading, error, and empty states;
- displays product code, name, unit mode, active status, enabled prices, and canonical balance;
- shows `Tạo sản phẩm` only to `owner` and `admin`;
- hides create action from `read_only`;
- continues relying on the admin-shell guard to block `employee` and `attendance_manager`.

Product create:

- route: `/inventory/products/new`;
- protected by `RequireRole` for `owner` and `admin`;
- `read_only` sees access denied;
- submits to the backend create-product endpoint;
- invalidates product list queries on success;
- redirects to `/inventory/products` after successful create;
- shows backend conflict/validation messages as form-level errors.

## API Endpoints Used

- `GET /api/inventory/products`
- `POST /api/inventory/products`
- `GET /api/inventory/products/{product_id}`
- `GET /api/inventory/products/{product_id}/balance`

The list and create screens currently use the list and create endpoints. Detail/balance client helpers were added for the next inventory UI batches.

## Validation Behavior

Local validation keeps price values as strings.

For `BAO_KG`:

- BAO and/or KG prices can be enabled;
- at least one of BAO/KG must be enabled;
- enabled prices must be positive decimal strings;
- BICH price is not shown.

For `BICH`:

- only BICH price is shown and submitted;
- BICH price must be a positive decimal string;
- BAO/KG prices are disabled from the form model.

Backend errors remain authoritative. Duplicate product code conflicts are displayed using the backend error message.

## Tests Added or Updated

Frontend tests cover:

- product list loading state;
- successful product list rendering;
- empty state;
- API error state;
- owner/admin create button visibility;
- read-only create button hiding;
- read-only denial on create route;
- unit-mode switching between BAO/KG and BICH fields;
- BAO_KG enabled-price validation;
- BICH price validation;
- successful create redirect to product list;
- duplicate product code conflict display.

## Commands Run and Results

From `frontend/`:

```powershell
npm.cmd run build
```

Result: passed.

```powershell
npm.cmd test
```

Result: `1 passed`, `28 tests passed`.

```powershell
npm.cmd run lint
```

Result: passed.

Backend tests were not run because no backend code was changed.

## Caveats and Next Steps

- Product edit/delete UI remains out of scope.
- Customer, sales, returns, reports, settings, and attendance UI remain placeholders.
- Product list is still a simple table with no pagination.
- Client-side price validation is intentionally small; backend validation remains the source of truth.
- Next recommended batch: product detail/edit/delete or customer list, depending operational priority.
