# Order Batch 5 Sales From Order

## Summary

Implemented the sales-from-order conversion flow.

Behavior now matches the desktop rule:

- opening a sales draft from an existing order does **not** convert the order
- only a successful invoice `POST` converts the order
- conversion happens transactionally on the backend after invoice creation succeeds
- failed invoice creation leaves the order active

## Backend Change

Added minimal backend support by extending invoice creation to accept optional `source_order_id`.

When `source_order_id` is present:

- sales invoice creation still runs normal stock/debt logic
- after invoice creation succeeds, the order is marked `CONVERTED` in the same transaction

This keeps conversion tightly coupled to successful invoice creation and avoids a separate frontend conversion call.

## Frontend Change

On the `/orders` page, each owner/admin order row now exposes `Bán hàng`.

Clicking it opens `/sales/invoices/new` with a preloaded sales draft via router state:

- source order id
- customer snapshot/customer id
- note
- order items mapped into sales items with current unit price defaults

The draft opens ready for editing/payment, but nothing is converted until the user actually submits the invoice.

## Tests

Backend:

- sales API tests now cover:
  - order remains `OPEN` before invoice submit
  - successful invoice create from order marks it `CONVERTED`
  - failed invoice create leaves it active

Frontend:

- order page can open preloaded sales draft from order
- preloaded sales draft includes `source_order_id` in invoice POST payload
- failed invoice submit from order shows backend error and does not trigger any separate conversion request

## Files Changed

- `backend/app/schemas/sales.py`
- `backend/app/api/routes/sales.py`
- `backend/tests/api/test_sales_api.py`
- `frontend/src/api/types.ts`
- `frontend/src/features/sales/invoiceQueries.ts`
- `frontend/src/features/orders/OrderListPage.tsx`
- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/tests/testUtils.tsx`
- `frontend/src/app/App.test.tsx`
- `docs/ORDER_BATCH5_SALES_FROM_ORDER.md`

## Commands Run

Backend:

- `pytest`
- `python -m compileall app tests`

Frontend:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

## Results

- Backend `pytest`: passed, `298` passed, `22` skipped
- Backend `python -m compileall app tests`: passed
- Frontend `npm.cmd test -- --run`: passed, `187` passed, `34` skipped
- Frontend `npm.cmd run build`: passed
- Frontend `npm.cmd run lint`: passed
