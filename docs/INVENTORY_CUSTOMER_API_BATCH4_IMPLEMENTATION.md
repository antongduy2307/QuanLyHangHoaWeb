# Inventory + Customer API Batch 4 Implementation

## Summary

Phase 2 Batch 4 adds FastAPI endpoints for the inventory/customer core built in earlier batches. The implementation exposes product, price, inventory balance, stock mutation, customer, ledger, and standalone debt payment operations through structured API routes.

No React UI, sales, returns, orders, reporting, attendance, receipts, adjustments, auth, document counters, or import execution were implemented.

The desktop reference repository under `../QuanLyHangHoa/` was not modified.

## Files Created or Modified

API layer:

- `backend/app/api/deps.py`
- `backend/app/api/errors.py`
- `backend/app/api/routes/inventory.py`
- `backend/app/api/routes/customers.py`
- `backend/app/main.py`

Configuration and schemas:

- `backend/app/core/config.py`
- `backend/app/domain/exceptions.py`
- `backend/app/domain/__init__.py`
- `backend/app/application/inventory_service.py`
- `backend/app/application/customer_service.py`
- `backend/app/infrastructure/db/session.py`
- `backend/app/schemas/inventory.py`
- `backend/app/schemas/customers.py`

Tests:

- `backend/tests/api/test_inventory_api.py`
- `backend/tests/api/test_customer_api.py`

Docs:

- `.env.example`
- `README.md`
- `docs/SETUP.md`
- `docs/INVENTORY_CUSTOMER_API_BATCH4_IMPLEMENTATION.md`

## API Endpoints Added

Inventory:

- `GET /api/inventory/products`
- `POST /api/inventory/products`
- `GET /api/inventory/products/{product_id}`
- `PATCH /api/inventory/products/{product_id}`
- `DELETE /api/inventory/products/{product_id}`
- `GET /api/inventory/products/{product_id}/balance`
- `POST /api/inventory/products/{product_id}/stock/increase`
- `POST /api/inventory/products/{product_id}/stock/decrease`

Customers:

- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/{customer_id}`
- `PATCH /api/customers/{customer_id}`
- `DELETE /api/customers/{customer_id}`
- `GET /api/customers/{customer_id}/ledger`
- `GET /api/customers/{customer_id}/debt-payments`
- `POST /api/customers/{customer_id}/debt-payments`
- `PATCH /api/customers/{customer_id}/debt-payments/{payment_id}`
- `DELETE /api/customers/{customer_id}/debt-payments/{payment_id}`

## Error Handling Behavior

Added app-level error handlers:

- `NotFoundError` -> HTTP 404 with `{"error": {"code": "not_found", "message": "..."}}`
- `ConflictError` -> HTTP 409 with `{"error": {"code": "conflict", "message": "..."}}`
- `ValidationError` -> HTTP 422 with `{"error": {"code": "validation_error", "message": "..."}}`
- SQLAlchemy `IntegrityError` -> HTTP 409 with a generic database conflict message
- generic `AppError` -> HTTP 400

Active duplicate product code now raises `ConflictError`, which remains a `ValidationError` subclass for existing service tests.

## Transaction and Session Behavior

- API dependencies provide request-scoped SQLAlchemy sessions.
- Mutating endpoints wrap service calls in explicit commit/rollback boundaries.
- Read endpoints use request-scoped sessions without global session ownership.
- Existing service-layer PostgreSQL lock paths from Batch 3 remain the concurrency foundation.

## Tests Added

Inventory API tests cover:

- health endpoint still passes
- create `BAO_KG` product
- create `BICH` product
- reject invalid unit/price combination
- duplicate active product code returns 409
- list excludes inactive products by default
- get product by id
- patch product name/prices
- delete unused product returns `hard_deleted`
- stock increase/decrease works
- negative stock persists
- balance endpoint returns canonical balance

Customer API tests cover:

- create customer with opening balance
- opening ledger appears in ledger endpoint
- list excludes inactive customers by default
- get customer by id
- patch profile fields and clear note
- create debt payment reduces balance
- edit debt payment appends rollback/replacement rows
- delete debt payment removes payment effect and recomputes balance
- overpayment can make balance negative
- delete customer with ledger history returns `deactivated`
- invalid payment amount returns validation error
- not found returns 404
- list debt payments returns `debt_payments.id`

## PostgreSQL and Port Notes

The local Docker PostgreSQL service is mapped to host port `5433`:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web
```

Updated `.env.example`, `docs/SETUP.md`, and `README.md` to document the `5433` host port. This avoids conflicts with a Windows/local PostgreSQL service already using `5432`.

## Commands Run and Results

From `backend/`:

- `pytest`
  - First fast/default run without PostgreSQL env: `63 passed, 3 skipped`
  - Final run with `DATABASE_URL` and `TEST_DATABASE_URL` pointed at port `5433`: `66 passed`
- `python -m compileall app tests`
  - Result: passed
- `alembic upgrade head --sql`
  - Result: passed
- `alembic upgrade head`
  - Result: passed against Docker PostgreSQL on host port `5433`
- `pytest -m postgres`
  - Result: `3 passed, 63 deselected`

Docker:

- `docker compose up -d postgres`
  - Result: PostgreSQL container running

## Caveats and Next Steps

- API endpoints do not include authentication or authorization.
- Customer target-balance adjustment was not added to `PATCH /api/customers/{customer_id}` because the current service does not yet expose a dedicated safe target-balance update method.
- Inventory receipts and adjustments remain out of scope.
- True concurrent multi-session tests for stock and ledger writes are still recommended as a follow-up.
- Next batch should add API conflict translation coverage around database-level integrity errors and then begin import validation or the next Phase 2 transactional module slice, depending on migration priority.
