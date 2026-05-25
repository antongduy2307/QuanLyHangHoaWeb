# Order Batch 1 Backend Foundation

## Summary

Implemented the backend order foundation matching the desktop module's core behavior.

This batch adds:

- order ORM models
- order service/repository
- order input schemas
- Alembic migration
- backend parity tests

No frontend, API route, or sales-from-order conversion behavior was added in this batch.

## Desktop Parity Preserved

Implemented backend behavior:

- order code format `DHYYYYMMDD-###`
- walk-in orders allowed
- walk-in snapshot defaults to `Khách lẻ`
- order items store quantity only, not price
- order does not affect stock
- order does not affect customer debt
- order can exceed current stock
- decimal quantity is preserved
- prepared order remains active
- converted order is hidden from active views
- converted order cannot be edited or deleted
- active quantity summary includes `OPEN` and `PREPARED` only
- quantity summary groups by `product_id + unit_type`

## Files Changed

- `backend/app/domain/orders.py`
- `backend/app/schemas/orders.py`
- `backend/app/infrastructure/db/models/orders.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/app/infrastructure/db/repositories/orders.py`
- `backend/app/infrastructure/db/repositories/__init__.py`
- `backend/app/application/order_service.py`
- `backend/app/application/__init__.py`
- `backend/alembic/versions/20260521_0007_orders_schema.py`
- `backend/tests/service/test_order_service.py`
- `backend/tests/migration/test_orders_schema.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`

## Notes

- `source_invoice_id` is included in the schema for future sales conversion work, but this batch does not implement conversion-side sales logic.
- Order code generation follows desktop repository behavior by scanning existing same-day order codes rather than using document counters.
- Active order sorting matches desktop operational intent:
  - prepared before open
  - earlier required delivery first
  - then order datetime
  - then id

## Tests Run

From `backend/`:

```powershell
pytest
python -m compileall app tests
```

Results:

- `pytest`: passed, `287` passed, `22` skipped
- `python -m compileall app tests`: passed

`pytest -m postgres` was not run because `TEST_DATABASE_URL` is not available in this environment.

## Out Of Scope Kept

- no API routes
- no frontend
- no POS order tab
- no top-level order page
- no sales-from-order conversion workflow
