# Sales/Returns Schema Batch 7 Implementation

## Summary

Phase 3 Batch 7 adds the schema/domain foundation for sales, returns, and PostgreSQL-safe document counters.

This batch intentionally does not add sales/returns services, API endpoints, historical import execution, inventory stock mutation, customer ledger mutation, frontend UI, auth, attendance, orders, or reporting.

## Files Created or Modified

Created:

- `backend/app/domain/sales.py`
- `backend/app/domain/returns.py`
- `backend/app/domain/documents.py`
- `backend/app/infrastructure/db/models/sales.py`
- `backend/app/infrastructure/db/models/returns.py`
- `backend/app/infrastructure/db/models/documents.py`
- `backend/alembic/versions/20260516_0003_sales_returns_schema.py`
- `backend/tests/unit/test_sales_returns_domain.py`
- `backend/tests/migration/test_sales_returns_schema.py`
- `docs/SALES_RETURNS_SCHEMA_BATCH7_IMPLEMENTATION.md`

Modified:

- `backend/app/domain/__init__.py`
- `backend/app/infrastructure/db/models/__init__.py`
- `backend/tests/unit/test_db_metadata.py`
- `backend/tests/migration/test_initial_inventory_customer_schema.py`
- `backend/tests/integration/test_postgres_schema.py`

## Schema Decisions

Sales schema:

- Added `invoices` and `invoice_items`.
- Invoice customer FK is nullable with `ON DELETE SET NULL` to preserve walk-in and historical behavior.
- Invoice item product FK uses `ON DELETE RESTRICT` to preserve historical item references.
- Monetary fields use `numeric(14, 2)`.
- Quantity fields use `numeric(14, 3)`.
- Product and customer snapshot names/codes are stored as non-empty text fields.

Returns schema:

- Added `return_invoices` and `return_invoice_items`.
- `source_invoice_id` and `source_invoice_item_id` are nullable for quick returns.
- Source invoice/item FKs use `ON DELETE RESTRICT`.
- Customer FK is nullable with `ON DELETE SET NULL`.
- Return item product FK uses `ON DELETE RESTRICT`.

Document counter schema:

- Added `document_counters` with unique `(document_type, business_date)`.
- This table is the future row-lockable foundation for invoice/return code generation.
- No code generation service was implemented in this batch.

Domain enums:

- `InvoiceStatus.COMPLETED`
- `PaymentMethod.CASH`, `BANK_TRANSFER`, `CARD`, `OTHER`
- `ReturnHandlingMode.REFUND_NOW`, `STORE_CREDIT`
- `DocumentType.INVOICE`, `RETURN`

Enum string values intentionally match desktop data values.

## Constraints And Indexes Added

`document_counters`:

- unique `(document_type, business_date)`
- non-blank document type check
- non-negative `last_number` check

`invoices`:

- unique `invoice_code`
- non-blank invoice code and customer snapshot checks
- non-negative total and paid amount checks
- indexes on `(invoice_datetime, id)`, `(customer_id, invoice_datetime, id)`, and `(status, invoice_datetime)`

`invoice_items`:

- positive quantity check
- non-negative unit price and line total checks
- non-blank product snapshot checks
- indexes on `(invoice_id, id)` and `(product_id, invoice_id)`

`return_invoices`:

- unique `return_code`
- non-blank return code and customer snapshot checks
- non-negative total amount check
- indexes on `(return_datetime, id)`, `(customer_id, return_datetime, id)`, and `(source_invoice_id, return_datetime, id)`

`return_invoice_items`:

- positive quantity check
- non-negative unit price and line total checks
- non-blank product snapshot checks
- indexes on `(return_invoice_id, id)`, `(source_invoice_item_id, return_invoice_id)`, and `(product_id, return_invoice_id)`

## Document Counter Design

The `document_counters` table is intended to replace the desktop `max(code) + 1` approach for web concurrency.

Future service behavior should:

- derive `business_date` from the invoice/return business datetime;
- select or create the counter row for `(document_type, business_date)`;
- lock the row with `FOR UPDATE`;
- increment `last_number`;
- format invoice codes as `HDYYYYMMDD-###`;
- format return codes as `TRYYYYMMDD-###`.

This batch only creates the persistence foundation.

## Tests Run And Results

From `backend/`:

```powershell
pytest tests\unit\test_sales_returns_domain.py tests\unit\test_db_metadata.py tests\migration\test_sales_returns_schema.py tests\migration\test_initial_inventory_customer_schema.py
```

Result:

```text
19 passed
```

```powershell
pytest
```

Result:

```text
105 passed, 5 skipped
```

```powershell
python -m compileall app tests
```

Result: passed.

```powershell
alembic upgrade head --sql
```

Result: passed. Offline SQL included the new `20260516_0003` migration.

PostgreSQL availability checks:

```powershell
$env:DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web'; alembic upgrade head
```

Initial result before Docker was reopened: timed out after 120 seconds without Alembic output.

```powershell
python -c "import psycopg; psycopg.connect('postgresql://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web', connect_timeout=5).close(); print('connected')"
```

Initial result before Docker was reopened: connection timeout to both `::1:5433` and `127.0.0.1:5433`.

```powershell
docker compose up -d postgres
```

Initial sandbox result: failed because Docker access required elevated permissions.

Escalated retry result:

```text
Container quanlyhanghoaweb-postgres Started
```

After Docker was reopened, live PostgreSQL verification was rerun:

```powershell
$env:DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web'; alembic upgrade head
```

Result:

```text
Running upgrade 20260515_0002 -> 20260516_0003, Add sales returns and document counters schema.
```

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web'; pytest -m postgres
```

Result:

```text
5 passed, 105 deselected
```

## Caveats And Next Steps

- Live PostgreSQL migration was verified against the Docker PostgreSQL service on host port `5433` after Docker was reopened.
- PostgreSQL-marked tests passed when `TEST_DATABASE_URL` was set.
- The offline Alembic SQL path and metadata tests also passed.
- Batch 8 should implement sales/returns repositories and services, including row-locking and document counter usage.
- Historical sales/returns import remains deferred. It must not replay stock/customer effects against the Phase 2 final balance snapshot.
