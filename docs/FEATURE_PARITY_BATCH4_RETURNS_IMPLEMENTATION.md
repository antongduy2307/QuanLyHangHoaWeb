# Feature Parity Batch 4: Returns P0/P1 Implementation

## Summary

Batch 4 closes the targeted returns parity gaps without redesigning the returns UI. The web app now generates return codes safely around imported historical rows, searches returns on the backend by return code/customer/source invoice code, supports backend date filters, preserves inactive historical return context in edit flows, aligns new return ledger display order to the desktop default `0`, and adds synthetic return-import proof plus stronger refund/store-credit and quantity-ceiling coverage.

## Parity Decisions

- Return codes remain `TRYYYYMMDD-###`.
- Document counters are retained, but code generation seeds from existing return rows for the same business date before incrementing. This avoids collisions when imported return codes exist but document counters do not.
- Backend return search now matches desktop operational contexts:
  - `return_code`
  - `customer_snapshot_name`
  - source `invoice_code` when a source invoice exists
- Backend return list now supports optional `date_from` and `date_to`.
- Frontend return list now uses backend filtering instead of local-only filtering.
- Existing historical inactive customer/product/source invoice item links are preserved in return edit selectors.
- New quick returns still reject inactive customers/products through existing active-only selector data and backend validation.

## Return Ledger Display Order Decision

- Decision: align web return ledgers to desktop display order `0`.
- Implementation: `ReturnService.RETURN_DISPLAY_ORDER` changed from `20` to `0`.
- Reasoning: desktop already defaults return ledger rows to `0`, the customer ledger schema default is `0`, and the web balance recomputation still sorts deterministically by `transaction_datetime`, `display_order`, and `id`.
- Safety proof:
  - service tests now assert new return ledger rows use display order `0`
  - full backend pytest passed after the change
  - synthetic return import coverage still reconciles final customer balances correctly

## Backend Changes

- Expanded return repository search from return-code-only to:
  - return code
  - customer snapshot name
  - source invoice code via join
- Added optional return list date filters.
- Aligned new return ledger display order to `0`.
- Kept refund/store-credit debt math unchanged, but added stronger tests around:
  - walk-in `REFUND_NOW` only
  - store-credit negative balances
  - refund-now clamping to current positive balance
  - update/delete rollback effects
- Added stronger return code generation tests:
  - same-day sequential generation
  - per-date counters
  - imported-code collision avoidance
- Strengthened linked return quantity tests:
  - create ceiling
  - update ceiling
  - current-return exclusion during update
  - quick-return no ceiling
- Strengthened synthetic import proof for returns:
  - return invoice
  - return items
  - linked customer ledger
  - product/customer/invoice/return mapping
  - final customer balance reconciliation

## Frontend Changes

- Return list query now sends `search`, `date_from`, and `date_to` to the backend.
- Return list search placeholder is now:
  - `Ma phieu tra, khach hang hoac hoa don goc`
- Removed local return search/date filtering logic from the list page.
- Return edit form now merges historical inactive:
  - customers
  - products
  - source invoices/source invoice items
  when they are already linked to the edited return.
- No visual redesign was introduced.

## Known Divergences Retained

- Validation and user-facing messages remain mixed English/ASCII in places.
- Walk-in naming remains `Khach le` in the web app.
- Linked return edit still uses the current web full-payload PATCH contract; no partial return PATCH semantics were added in this batch.

## Files Changed

- `backend/app/application/return_service.py`
- `backend/app/api/routes/returns.py`
- `backend/app/infrastructure/db/repositories/returns.py`
- `backend/tests/api/test_returns_api.py`
- `backend/tests/importers/test_app_db_sales_returns_importer.py`
- `backend/tests/service/test_return_service.py`
- `frontend/src/api/returns.ts`
- `frontend/src/app/App.test.tsx`
- `frontend/src/features/returns/ReturnForm.tsx`
- `frontend/src/features/returns/ReturnListPage.tsx`
- `frontend/src/features/returns/returnQueries.ts`

## Tests

- Backend service/API/import tests added or strengthened for:
  - return code generation parity
  - backend search/date filter parity
  - linked quantity ceilings
  - update exclusion of current return quantity
  - quick-return no ceiling
  - refund/store-credit debt behavior
  - ledger display order `0`
  - delete/update total-sales rollback
  - inactive historical edit handling
  - synthetic return import mapping and reconciliation
- Frontend tests added or updated for:
  - backend return search/date query params
  - no-results state under backend filtering
  - inactive historical return detail/edit selector preservation

## Command Results

- Backend:
  - `uv run pytest` -> passed, `267 passed`, `21 skipped`
  - `uv run pytest -m postgres` -> completed, all `21` postgres-marked tests skipped in current environment
  - `python -m compileall app tests` -> passed
- Frontend:
  - `npm.cmd test` -> passed, `146 passed`
  - `npm.cmd run build` -> passed
  - `npm.cmd run lint` -> passed

## Next Batch Recommendation

Batch 5 should focus on import/cutover confidence: repeat the end-to-end rehearsal against a fresh desktop DB copy, keep synthetic returns if real return rows are still absent, and carry forward the parity evidence before any broader returns UI work or redesign.
