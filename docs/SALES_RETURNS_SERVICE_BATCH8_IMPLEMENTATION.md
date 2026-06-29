# Sales/Returns Service Batch 8 Implementation

## Summary

Phase 3 Batch 8 adds service-layer foundations for future web-created sales invoices and returns.

This batch implements repositories, document-counter code generation, sales invoice create/list/get/delete behavior, and return create/list/get/delete behavior. It intentionally does not implement FastAPI endpoints, historical sales/returns import, React UI, auth, attendance, orders, reporting, or production cutover.

Historical import remains a separate path: future import must not replay sales/return effects against the Phase 2 final inventory/customer snapshots.

## Files Created Or Modified

Created:

- `backend/app/application/document_service.py`
- `backend/app/application/sales_service.py`
- `backend/app/application/return_service.py`
- `backend/app/infrastructure/db/repositories/documents.py`
- `backend/app/infrastructure/db/repositories/sales.py`
- `backend/app/infrastructure/db/repositories/returns.py`
- `backend/app/schemas/sales.py`
- `backend/app/schemas/returns.py`
- `backend/tests/service/test_document_service.py`
- `backend/tests/service/test_sales_service.py`
- `backend/tests/service/test_return_service.py`
- `backend/tests/integration/test_sales_returns_services_postgres.py`
- `docs/SALES_RETURNS_SERVICE_BATCH8_IMPLEMENTATION.md`

Modified:

- `backend/app/application/__init__.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/app/infrastructure/db/repositories/inventory.py`

## Service Behavior Implemented

Document service:

- Generates invoice codes as `HDYYYYMMDD-###`.
- Generates return codes as `TRYYYYMMDD-###`.
- Uses `document_counters` instead of `max(code) + 1`.
- Locks counter rows through repository `with_for_update()` queries.
- Keeps counters independent by document type and business date.

Sales service:

- Creates completed invoices.
- Supports customer and walk-in invoices.
- Derives customer snapshot name from the customer when omitted.
- Uses `Khach le` as the default walk-in snapshot name.
- Requires at least one item.
- Validates positive quantities, product active status, and unit compatibility.
- Supports enabled product prices, manual unit prices, and manual line totals.
- Derives unit price from manual line total using `ROUND_HALF_UP`.
- Stores product code/name snapshots.
- Decreases inventory stock through the inventory service.
- Allows negative stock through existing inventory service behavior.
- Enforces full payment for walk-in invoices.
- Allows unpaid, partial, exact, and overpaid customer invoices.
- Adds customer `INVOICE_CHARGE` ledger rows with `display_order=10`.
- Creates source-linked `DebtPayment` parent rows for invoice payments.
- Adds source-linked `DEBT_PAYMENT` ledger rows with `display_order=20`.
- Recomputes customer balances after ledger writes.
- Deletes invoices by restoring stock, removing source-linked invoice ledgers/payments, decreasing total sales, recomputing balance, and deleting invoice rows.

Return service:

- Creates linked and quick returns.
- Generates return codes through `document_counters`.
- Copies customer identity/snapshot from source invoice for linked returns.
- Allows quick returns with explicit customer or walk-in identity.
- Enforces walk-in returns as `REFUND_NOW` only.
- Validates positive quantities.
- Validates linked return source item ownership.
- Prevents linked returns from exceeding source invoice item remaining quantity.
- Supports enabled product prices, manual unit prices, and manual line totals for quick returns.
- Stores product code/name snapshots.
- Increases inventory stock on create.
- For customer `STORE_CREDIT`, reduces balance by full return total and decreases `total_sales`.
- For customer `REFUND_NOW`, reduces balance by `min(current positive balance, return total)` and decreases `total_sales`.
- Does not create zero-amount refund ledger rows when customer balance is already non-positive.
- Adds return ledger rows with `ref_type=RETURN`, `source_ref_type=RETURN`, and `display_order=20`.
- Deletes returns by reversing stock, removing return ledger rows, restoring total sales, recomputing balance, and deleting return rows.

## Update Behavior

Invoice update and return update are deferred in this batch.

Reason: update requires rollback/reapply semantics across document rows, stock, source-linked debt payments, customer ledgers, and datetime synchronization. The create/delete foundation is now in place, and update should be implemented in a focused follow-up with its own regression tests.

## Inventory And Customer Ledger Effect Policy

This service layer is for future web-created documents, so it applies business effects immediately inside the caller transaction:

- invoice create decreases inventory and increases customer debt/sales when applicable;
- invoice delete restores those effects;
- return create increases inventory and decreases customer balance/sales when applicable;
- return delete restores those effects.

This is deliberately different from the later historical import path, which must import documents without replaying effects against already-final Phase 2 snapshots.

## Tests Added

Document tests cover:

- same-date sequence increments;
- independent invoice/return counters;
- independent date counters.

Sales tests cover:

- invoice code generation;
- walk-in fully paid invoice creation;
- unpaid walk-in rejection;
- customer unpaid invoice charge ledger;
- customer partial payment charge/payment ledgers;
- overpayment making balance negative;
- BAO/KG/BICH stock decreases;
- product snapshots;
- manual line total price derivation;
- inactive product rejection;
- invalid unit type rejection;
- invoice delete rollback for stock/customer ledgers/total sales.

Return tests cover:

- return code generation;
- quick walk-in refund return;
- walk-in store credit rejection;
- customer store credit return;
- customer refund-now min positive balance behavior;
- stock increase;
- linked return quantity ceiling;
- product snapshots;
- return delete rollback for stock/customer effects.

PostgreSQL tests cover:

- document counter sequence persistence under PostgreSQL;
- basic invoice creation and stock effect under PostgreSQL.

## Commands Run And Results

From `backend/`:

```powershell
pytest tests\service\test_document_service.py tests\service\test_sales_service.py tests\service\test_return_service.py
```

Result:

```text
18 passed
```

```powershell
pytest
```

Result:

```text
123 passed, 7 skipped
```

```powershell
python -m compileall app tests
```

Result: passed.

With Docker PostgreSQL available on host port `5433`:

```powershell
$env:TEST_DATABASE_URL='postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web'; pytest -m postgres
```

Result:

```text
7 passed, 123 deselected
```

## Caveats And Next Steps

- Invoice update and return update are deferred.
- API routes are not implemented yet.
- Historical sales/returns import is not implemented and must not reuse service create methods to replay effects.
- True multi-session concurrent counter tests are still recommended for a later PostgreSQL-focused hardening pass.
- Batch 9 should implement sales/returns import validation/import reconciliation, or Batch 9 can add update behavior first if API readiness is prioritized.
