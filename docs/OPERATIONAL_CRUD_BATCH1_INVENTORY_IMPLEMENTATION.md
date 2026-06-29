# Operational CRUD Batch 1: Inventory

## Summary

Implemented frontend inventory product operations for day-to-day CRUD workflows:

- Product detail page at `/inventory/products/:productId`.
- Product edit page at `/inventory/products/:productId/edit`.
- Product delete/deactivate action from detail.
- Stock increase/decrease controls from detail.
- Product list detail links and inactive-product toggle.

No backend code changes were required. Existing inventory APIs already support the required product read, update, delete/deactivate, and stock adjustment operations.

## Files Changed

- `frontend/src/api/types.ts`
- `frontend/src/api/inventory.ts`
- `frontend/src/app/router.tsx`
- `frontend/src/features/inventory/productQueries.ts`
- `frontend/src/features/inventory/productSchemas.ts`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/features/inventory/ProductDetailPage.tsx`
- `frontend/src/features/inventory/ProductEditPage.tsx`
- `frontend/src/app/App.test.tsx`
- `docs/OPERATIONAL_CRUD_BATCH1_INVENTORY_IMPLEMENTATION.md`

## UI Behavior

Product list:

- Search remains available.
- Product code links open the product detail page.
- `Hien hang ngung dung` sends `include_inactive=true` to the backend.

Product detail:

- Shows code, name, unit mode, active status, prices, current balance, created timestamp, and updated timestamp.
- Owner/admin users see edit, delete, and stock adjustment controls.
- Read-only users can view details but cannot edit, delete, or adjust stock.
- Delete uses browser confirmation and redirects to the list with either hard-delete or deactivation result text.

Product edit:

- Owner/admin only.
- `product_name` and enabled price values are editable.
- `product_code_base` and `unit_mode` are displayed as read-only fields.
- Successful save redirects to product detail and invalidates product list/detail queries.

Stock adjustment:

- Owner/admin only.
- Unit choices follow product `unit_mode`: `BAO`/`KG` for `BAO_KG`, `BICH` for `BICH`.
- Quantity must be a positive decimal string.
- Negative stock remains allowed by backend behavior when decreasing stock.
- Successful adjustment invalidates product list/detail queries so balance refetches.

## API Endpoints Used

- `GET /api/inventory/products?search=...&include_inactive=true`
- `GET /api/inventory/products/{product_id}`
- `PATCH /api/inventory/products/{product_id}`
- `DELETE /api/inventory/products/{product_id}`
- `POST /api/inventory/products/{product_id}/stock/increase`
- `POST /api/inventory/products/{product_id}/stock/decrease`

## Limitations

- Reactivation is not exposed as a risky inferred UI action. The backend currently has no direct `reactivate` endpoint for inactive products. The detail page documents this for inactive products.
- Product code and unit mode remain immutable in the edit UI because the existing backend patch contract only accepts product name and prices.

## Tests Run

Targeted during implementation:

```powershell
npm.cmd test -- src\app\App.test.tsx
```

Result:

```text
111 passed
```

Full requested frontend checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Results:

```text
npm.cmd test: 111 passed
npm.cmd run build: passed
npm.cmd run lint: passed
```

## Next Steps

- Add a backend reactivation endpoint if operational policy requires restoring inactive products without creating a new product.
- Complete customer edit/delete/reactivate in a separate batch.
- Add manual browser smoke coverage once local backend and Vite are running together.
