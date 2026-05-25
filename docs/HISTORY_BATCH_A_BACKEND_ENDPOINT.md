# History Batch A Backend Endpoint

Date: 2026-05-23

## Scope

Implemented a unified read-only backend endpoint:

- `GET /api/history`

This batch is backend-only. It does not add frontend UI, write actions, export behavior, or pagination.

## Implemented Event Types

- `SALES_INVOICE`
- `RETURN_INVOICE`
- `DEBT_PAYMENT`
- `BALANCE_ADJUSTMENT`
- `STOCK_MOVEMENT`
- `ORDER`

## Access Rules

- allowed: `owner`, `admin`, `read_only`
- forbidden: `employee`, `attendance_manager`

## Filters

Supported query params:

- `date_from`
- `date_to`
- `event_type`
- `customer_id`
- `product_id`
- `search`

## Response Shape

Normalized fields returned per row:

- `event_type`
- `event_id`
- `event_datetime`
- `display_order`
- `code`
- `customer_id`
- `customer_name`
- `product_id`
- `product_name`
- `amount`
- `quantity`
- `unit_type`
- `status`
- `source_type`
- `source_id`
- `note`
- `open_target`

## Important Behavior Decisions

- Invoice-linked ledger payment rows are not exposed as default business `DEBT_PAYMENT` history entries.
- Standalone debt payments are sourced from `debt_payments` and invoice-generated payment parents are excluded.
- Balance adjustments are sourced from ledger rows with `event_type = BALANCE_ADJUSTMENT`.
- Stock movement history includes:
  - stock adjustments
  - invoice stock effects
  - return stock effects
- Orders include historical converted rows, not only active orders.
- When `product_id` is supplied, non-product events (`DEBT_PAYMENT`, `BALANCE_ADJUSTMENT`) are excluded.
- When `customer_id` is supplied, customerless stock adjustments are excluded.

## Sorting Decision

Rows are sorted by:

1. `event_datetime` descending
2. `display_order` descending
3. `event_id` descending

This keeps the unified feed newest-first while preserving reverse-chronological ledger semantics for same-timestamp entries.

## Files Changed

- `backend/app/api/routes/history.py`
- `backend/app/application/history_service.py`
- `backend/app/infrastructure/db/repositories/history.py`
- `backend/app/schemas/history.py`
- `backend/app/main.py`
- `backend/app/application/__init__.py`
- `backend/app/infrastructure/db/repositories/__init__.py`
- `backend/tests/api/test_history_api.py`
- `backend/tests/integration/test_history_postgres.py`

## Verification

Executed:

- `uv run pytest`
- `uv run pytest -m postgres`
- `python -m compileall app tests`

Results:

- full test suite passed
- postgres-marked tests were skipped where `TEST_DATABASE_URL` was unavailable
- compileall passed
