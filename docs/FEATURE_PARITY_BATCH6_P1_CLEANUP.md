# Feature Parity Batch 6: P1 Cleanup

## Summary

Batch 6 closes the remaining non-UI P1 cleanup items that were safe to address before any UI/UX redesign work:

- customer backend search now matches the visible list behavior by searching both customer name and phone
- invoice/return server-side search and date-filter behavior is re-verified with regression coverage
- manual `total_sales` editing is removed from the customer create/update API and frontend create form
- deleted debt payment behavior is retained as an explicit web divergence, but is now re-verified as operationally acceptable
- walk-in labels were reviewed; no broad copy sweep was done because the remaining differences are wording/encoding rather than behavior blockers

No UI redesign was started.

## Parity Decisions

### 1. Customer Search By Phone

- Decision: implement backend phone search.
- Reason: the web customer list placeholder already promises `Ten, dien thoai`, and the parity investigation flagged missing phone search as a P1 gap.
- Result: customer list search now matches on:
  - `customer_name`
  - `phone`

### 2. Invoice / Return Server-Side Search Final Check

- Decision: retain the existing Batch 3 / Batch 4 backend search behavior and add final regression coverage rather than changing the endpoints again.
- Verified behavior:
  - invoices search by `invoice_code` or `customer_snapshot_name`
  - invoices support `date_from` and `date_to`
  - returns search by `return_code`, `customer_snapshot_name`, or source `invoice_code`
  - returns support `date_from` and `date_to`

### 3. Manual `total_sales` Editing

- Decision: remove manual `total_sales` editing from customer create/update API surfaces and the customer create form.
- Reason: it is not desktop-equivalent; desktop total sales is service-maintained from invoices/returns rather than manually edited profile data.
- Scope kept narrow:
  - service-level internal `create_customer(... total_sales=...)` support is retained for import/test seeding
  - public customer create/update requests now forbid extra `total_sales`
  - frontend create form no longer exposes a `Tong mua` input

### 4. Deleted Debt Payment Behavior

- Decision: retain the web divergence and document it as acceptable for now.
- Current web behavior:
  - deletes all ledger rows for the payment reference
  - recomputes balances
  - marks the parent `DebtPayment` row as `is_deleted=True`
  - hides deleted payments from the default debt-payment list
- Why acceptable:
  - customer-facing operational behavior matches desktop for balances and visible payment history
  - the retained deleted parent row is an internal audit/storage divergence, not a user-facing debt-balance divergence

### 5. Walk-In Labels

- Decision: no broad normalization pass in this batch.
- Reason: the remaining walk-in label differences are wording/encoding cleanup rather than functional blockers, and a larger copy sweep would drift into UI polish work.
- Retained:
  - `Khach le` remains in current web copy where already shipped
  - walk-in validation behavior itself remains correct and covered

## Files Changed

- `backend/app/application/customer_service.py`
- `backend/app/api/routes/customers.py`
- `backend/app/infrastructure/db/repositories/customer.py`
- `backend/app/schemas/customers.py`
- `backend/tests/api/test_customer_api.py`
- `backend/tests/api/test_sales_api.py`
- `backend/tests/integration/test_protected_api_postgres.py`
- `backend/tests/service/test_customer_service.py`
- `frontend/src/api/types.ts`
- `frontend/src/app/App.test.tsx`
- `frontend/src/features/customers/CustomerCreatePage.tsx`
- `frontend/src/features/customers/customerSchemas.ts`

## Regression Coverage Added / Updated

- customer service:
  - search by customer name
  - search by phone
  - customer profile update does not mutate `total_sales`
- customer API:
  - customer search by phone
  - create rejects manual `total_sales`
  - update rejects manual `total_sales`
  - deleted debt payments are hidden from the list after delete
- sales API:
  - invoice backend date filters alongside existing server-side search checks
- postgres integration:
  - updated protected-route fixtures and ledger ordering expectations to match the current parity baseline

## Commands / Results

- Backend:
  - `uv run pytest` -> passed, `272 passed`, `22 skipped`
  - `uv run pytest -m postgres` with Docker PostgreSQL on `5433` -> passed, `22 passed`
  - `python -m compileall app tests` -> passed
- Frontend:
  - `npm.cmd test` -> passed, `146 passed`
  - `npm.cmd run build` -> passed
  - `npm.cmd run lint` -> passed

## Remaining Intentional Divergences

- deleted debt payments still retain a soft-deleted parent `DebtPayment` row internally
- walk-in copy still uses the existing web wording in places
- broader label/message normalization remains deferred until behavior parity is complete and redesign work begins

## Next Step

P1 cleanup is now narrowed enough to start UI/UX redesign work without carrying these behavior mismatches forward.
