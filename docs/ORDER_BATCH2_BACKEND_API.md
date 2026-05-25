# Order Batch 2 Backend API

## Summary

Exposed the Batch 1 order backend service through protected `/api/orders` endpoints.

Implemented endpoints:

- `GET /api/orders`
- `GET /api/orders/{order_id}`
- `POST /api/orders`
- `PATCH /api/orders/{order_id}`
- `DELETE /api/orders/{order_id}`
- `POST /api/orders/{order_id}/prepared`
- `POST /api/orders/{order_id}/converted`
- `GET /api/orders/quantity-summary`

No frontend, POS order tab, or sales-from-order workflow was added in this batch.

## Auth Behavior

Read access:

- `owner`
- `admin`
- `read_only`

Write access:

- `owner`
- `admin`

Forbidden:

- `employee`
- `attendance_manager`

The routes use the same dependency and standard error shape as the existing inventory, customer, sales, and returns APIs, so local auth bypass behavior remains unchanged.

## Behavior Preserved

The API preserves Batch 1 service rules:

- order creation/update/delete does not affect stock
- order creation/update/delete does not affect customer debt
- orders can exceed stock
- decimal quantities are preserved
- prepared orders stay active
- converted orders are excluded from active list and quantity summary
- converted orders cannot be edited or deleted
- walk-in snapshot defaults to `Khách lẻ`
- quantity summary groups active orders by `product_id + unit_type`

## Files Changed

- `backend/app/api/routes/orders.py`
- `backend/app/main.py`
- `backend/app/schemas/orders.py`
- `backend/app/application/order_service.py`
- `backend/tests/api/test_orders_api.py`

## Tests Run

From `backend/`:

```powershell
pytest
python -m compileall app tests
```

Results:

- `pytest`: passed, `296` passed, `22` skipped
- `python -m compileall app tests`: passed

`pytest -m postgres` was not run because `TEST_DATABASE_URL` is not available in this environment.
