# Feature Parity Batch 1: Customer/Debt P0 Implementation

## Summary

Batch 1 implemented the P0 customer/debt parity items from `FEATURE_PARITY_CORE_MODULES_INVESTIGATION.md` without changing the desktop reference app. The web app now records customer target-balance corrections through `BALANCE_ADJUSTMENT` ledger rows instead of directly mutating `current_balance`, strengthens customer delete history detection, and preserves inactive historical customer behavior for existing invoices and returns.

## Desktop Behavior Matched

- Customer balance changes are ledgered as `BALANCE_ADJUSTMENT`.
- Balance adjustment writes a delta from current balance to target balance, then recomputes the running ledger balance.
- Customers with no trade/debt history use opening-balance datetime semantics for implicit adjustment datetime.
- Customer delete hard-deletes only customers with no ledger, invoice, return, or debt-payment history.
- Existing invoice and return documents remain loadable/editable when their linked customer is inactive.
- New invoices cannot use inactive customers.

## Backend Changes

- Added `CustomerService.adjust_customer_balance(...)`.
- Added `POST /api/customers/{customer_id}/balance-adjustments`.
- Added request/response schemas for balance adjustments.
- Added monotonic integer reference ids for standalone adjustment ledgers.
- Added `CustomerRepository.customer_has_trade_or_debt_history(...)` for opening-datetime adjustment decisions.
- Strengthened `CustomerRepository.customer_has_history(...)` to include:
  - `customer_balance_ledgers`
  - `invoices`
  - `return_invoices`
  - `debt_payments`
- Added inactive-customer guard to new invoice creation while keeping invoice update permissive for historical documents.

## Frontend Changes

- Added customer API/types/query support for balance adjustments.
- Added an owner/admin-only `Điều chỉnh công nợ` control on customer detail.
- The control accepts target balance and note, posts to the backend endpoint, and refetches customer detail, ledger, debt payments, and customer lists.
- `read_only` users do not see the adjustment control.

## Tests

- Backend service tests cover:
  - Balance adjustment ledger creation and recomputation.
  - Opening-balance datetime semantics when no trade/debt history exists.
  - Unchanged target balance validation.
  - Hard delete for customers with no history.
  - Deactivation for customers with ledger, invoice, return, or debt-payment history.
  - New invoice rejection for inactive customers.
  - Existing invoice detail/update with inactive linked customer.
  - Linked return detail/update with inactive linked customer.
- Backend API tests cover:
  - Balance adjustment endpoint response and ledger creation.
  - `read_only` denial for balance adjustments.
- Frontend tests cover:
  - Owner/admin visibility and read-only hiding for the adjustment control.
  - Posting balance adjustment and refetching dependent customer data.

## Limitations

- The adjustment UI is intentionally minimal and does not include an explicit datetime picker. The backend supports `adjustment_datetime` for future UI exposure.
- Customer update `PATCH` remains profile-focused; target balance changes use the new dedicated adjustment endpoint.
- Quick-return creation with inactive customers was not newly restricted in this batch because the P0 requirement only called out new invoice customer selection/API.
- Existing document edit paths remain permissive so historical inactive customer documents can still be corrected.

## Next Parity Batch

- Continue P0 parity with sales/invoice and returns behavior that was outside Batch 1.
- Add any remaining customer import parity and broader ledger display/reporting refinements in P1 cleanup.
- Defer UI/UX redesign until core parity is complete.
