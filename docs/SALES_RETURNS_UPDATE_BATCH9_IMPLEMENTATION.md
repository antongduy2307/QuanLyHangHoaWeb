# Sales/Returns Update Batch 9 Implementation

## Summary

Phase 3 Batch 9 adds service-layer update behavior for future web-created sales invoices and returns.

This batch does not add FastAPI endpoints, historical sales/returns import, React UI, auth, attendance, orders, reporting, or production cutover. Historical import remains a separate path and must not use these service update/create methods to replay effects against Phase 2 final snapshots.

## Files Created Or Modified

Modified:

- `backend/app/application/sales_service.py`
- `backend/app/application/return_service.py`
- `backend/app/infrastructure/db/repositories/returns.py`
- `backend/tests/service/test_sales_service.py`
- `backend/tests/service/test_return_service.py`
- `backend/tests/integration/test_sales_returns_services_postgres.py`
- `docs/SALES_RETURNS_UPDATE_BATCH9_IMPLEMENTATION.md`

## Update Behavior Implemented

Sales invoice update:

- Locks the invoice and existing invoice items.
- Validates the new customer/walk-in identity, items, prices, units, quantities, totals, and payment amount.
- Preserves `invoice_code`.
- Rolls back old effects:
  - restores inventory stock for old invoice items;
  - removes invoice-linked customer ledger rows;
  - removes generated invoice-linked `DebtPayment` parent rows;
  - decreases old customer `total_sales`;
  - recomputes old customer balance.
- Replaces invoice header fields:
  - `invoice_datetime`
  - `customer_id`
  - `customer_snapshot_name`
  - `paid_amount`
  - `payment_method`
  - `note`
  - `status = COMPLETED`
  - `total_amount`
- Replaces invoice items and refreshes product snapshots from current product data.
- Reapplies new effects:
  - decreases inventory for new items;
  - increases new customer `total_sales`;
  - appends `INVOICE_CHARGE` ledger rows;
  - creates source-linked `DebtPayment` rows when `paid_amount > 0`;
  - appends source-linked `DEBT_PAYMENT` ledger rows;
  - recomputes new customer balance.
- Supports customer-to-customer changes, customer-to-walk-in changes, and walk-in-to-customer changes.
- Enforces full payment for walk-in updates.

Return update:

- Locks the return invoice and existing return items.
- Validates the new linked/quick return shape, source invoice/source item ownership, remaining quantity, units, quantities, prices, handling mode, and customer/walk-in rules.
- Preserves `return_code`.
- Rolls back old effects:
  - subtracts old returned stock from inventory;
  - removes return-linked customer ledger rows;
  - restores old customer `total_sales`;
  - recomputes old customer balance.
- Replaces return header fields:
  - `source_invoice_id`
  - `customer_id`
  - `customer_snapshot_name`
  - `is_quick_return`
  - `return_datetime`
  - `handling_mode`
  - `note`
  - `total_amount`
- Replaces return items and refreshes product snapshots from current product data.
- Reapplies new effects:
  - increases inventory for new return items;
  - applies customer `STORE_CREDIT` or `REFUND_NOW` balance policy;
  - appends return-linked ledger rows when the return changes customer balance;
  - recomputes customer balance.
- Supports quick-to-linked return update and linked source changes, with source item validation.

## Rollback/Reapply Policy

The update methods use the same conceptual policy as desktop behavior:

1. Validate the requested new state.
2. Roll back all effects from the old persisted state.
3. Delete old line rows.
4. Replace document header fields and line rows.
5. Apply effects from the new state.
6. Recompute affected customer balances.

All operations run inside the caller's SQLAlchemy session/transaction. If a caller wraps the service call in a transaction and an exception is raised, the whole update can roll back atomically.

## Ledger/Payment Cleanup Policy

Invoice updates remove only invoice-generated effects for the invoice being updated:

- Customer ledgers with `source_ref_type = INVOICE` and `source_ref_id = invoice.id`.
- Generated payment ledger rows with `ref_type = DEBT_PAYMENT` under that invoice source.
- Generated `DebtPayment` parent rows referenced by those invoice-linked payment ledgers.

Standalone debt payments are not removed.

Return updates remove only web-created return-linked ledger rows for the return being updated:

- Customer ledgers with `source_ref_type = RETURN` and `source_ref_id = return_invoice.id`.

Legacy imported rows with missing return source fields remain a future import/reconciliation concern, not a Batch 9 web-created update concern.

## Tests Added

Sales update tests cover:

- quantity update changes inventory from old effect to new effect without double counting;
- paid amount update rebuilds customer ledgers and balances;
- invoice datetime update is reflected on rebuilt ledger rows;
- customer A to customer B update rolls back A and applies B;
- customer invoice to walk-in update removes customer effects and enforces payment;
- walk-in to customer update applies customer effects;
- item update refreshes product snapshots;
- invoice code is preserved;
- invalid unit/product update is rejected;
- delete after update rolls back latest effects only.

Return update tests cover:

- quantity update changes inventory from old effect to new effect without double counting;
- `STORE_CREDIT` amount update rebuilds customer ledger and total sales;
- `REFUND_NOW` uses `min(current positive balance, return total)`;
- linked return update validates remaining source quantity;
- quick return to linked return update is supported;
- return code is preserved;
- return item update refreshes product snapshots;
- delete after update rolls back latest effects only.

PostgreSQL-marked tests cover:

- invoice update reapplying stock and customer effects;
- return update reapplying stock and customer effects.

## Commands Run And Results

From `backend/`:

```powershell
pytest tests\service\test_sales_service.py tests\service\test_return_service.py
```

Result:

```text
26 passed
```

```powershell
pytest
```

Result:

```text
134 passed, 9 skipped
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
9 passed, 134 deselected
```

## Caveats And Next Steps

- FastAPI sales/returns endpoints are still out of scope and not implemented.
- Historical sales/returns import is still out of scope and must not replay effects against Phase 2 final balance snapshots.
- Multi-session deadlock/lost-update stress tests are still recommended for a PostgreSQL hardening pass.
- The next implementation batch can proceed to sales/returns API endpoints or historical sales/returns import validation, depending on migration priority.
