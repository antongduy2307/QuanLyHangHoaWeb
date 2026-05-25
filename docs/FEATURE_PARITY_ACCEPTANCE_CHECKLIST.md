# Feature Parity Acceptance Checklist

Purpose: lock the core behavior baseline before any UI/UX redesign. The redesign phase must preserve these checks unless a deliberate product decision updates this checklist and the corresponding automated tests.

## 1. Inventory Acceptance Checks

- Product create must:
  - normalize/uppercase code
  - trim name
  - require valid unit mode
  - require at least one enabled valid price
- Product update must:
  - allow name/price changes
  - preserve unit-mode compatibility rules
  - reject illegal mode/unit combinations
- Product delete/reactivate must:
  - hard-delete only when no history exists
  - deactivate when history exists
  - reactivate only when desktop-compatible identity rules still match
- Price enable/disable rules must remain valid for:
  - `BAO_KG`
  - `BICH`
- BAO/KG/BICH compatibility must remain true:
  - `BICH` rejects `BAO`/`KG`
  - `BAO_KG` rejects `BICH`
- Stock mutations must preserve:
  - increase stock
  - decrease stock
  - set actual stock (`STOCK_SET`)
  - audit trail / movement rows
- Negative stock must remain allowed where already supported.
- Derived KG display must remain visible for `BAO_KG` products.
- Movement history must still include:
  - sales
  - returns
  - stock increase
  - stock decrease
  - stock set
- Inactive historical product handling must remain true:
  - new sales/quick returns cannot use inactive products
  - existing historical invoice/return edits can preserve already-linked inactive products
- Name-only inventory search decision must remain true:
  - inventory list search is name-only
  - do not silently broaden to code search without updating tests and checklist

## 2. Customer / Debt Acceptance Checks

- Customer create/update/delete/deactivate must preserve:
  - create with optional phone/address/note
  - opening balance ledger semantics
  - delete vs deactivate behavior based on history
- Customer search must still support:
  - customer name
  - customer phone
- Opening balance must still:
  - create an `OPENING_BALANCE` ledger row
  - use the opening-balance datetime contract
- Target balance adjustment must remain ledger-driven:
  - no direct balance mutation
  - adjustment must append a `BALANCE_ADJUSTMENT` ledger row
- Debt payment create/edit/delete must preserve:
  - positive-only amounts
  - rollback/replacement semantics on edit
  - delete recomputes later balances
- Overpayment / negative balance behavior must remain allowed where already supported.
- Ledger ordering / recompute must remain:
  - `transaction_datetime`
  - `display_order`
  - `id`
- `total_sales` must remain service-maintained only:
  - invoice create/update/delete affects it
  - return create/update/delete affects it
  - debt payments do not affect it
  - customer create/update UI/API must not manually edit it
- Inactive customer behavior must remain true:
  - new document creation cannot select inactive customers
  - historical invoice/return edits can preserve already-linked inactive customers

## 3. Sales / Invoice Acceptance Checks

- Invoice create/update/delete must preserve current stock/customer rollback-reapply semantics.
- Invoice code generation must remain:
  - `HDYYYYMMDD-###`
- Imported-code collision avoidance must remain true:
  - next code scans existing imported rows safely
- Walk-in vs customer invoice rules must remain true:
  - walk-in invoice must be fully paid or overpaid
  - customer invoice may be paid / partial / unpaid / overpaid
- Paid / partial / unpaid / overpaid behavior must preserve customer balance effects.
- Stock decrease from invoices must remain correct.
- Customer ledger effects must remain correct:
  - `INVOICE_CHARGE`
  - source-linked `DEBT_PAYMENT` when paid amount > 0
- Inactive historical customer/product edit support must remain preserved.
- Server-side invoice search/date filters must remain true:
  - search by `invoice_code`
  - search by `customer_snapshot_name`
  - `date_from`
  - `date_to`
- Rounding decision must remain locked:
  - calculated line totals use web `ROUND_HALF_UP`
  - manual supplied totals remain respected

## 4. Returns Acceptance Checks

- Return create/update/delete must preserve current stock/customer rollback-reapply semantics.
- Return code generation must remain:
  - `TRYYYYMMDD-###`
- Quick return behavior must remain true:
  - no source quantity ceiling
  - walk-in allowed
- Linked return behavior must remain true:
  - source invoice required
  - source item must belong to source invoice
- Quantity ceiling must remain true:
  - linked return cannot exceed source quantity minus prior returns
  - update excludes current return quantity from prior-return total
- Refund-now / store-credit rules must remain true:
  - walk-in return only `REFUND_NOW`
  - `STORE_CREDIT` can create negative balance
  - `REFUND_NOW` clamps to current positive balance only
- Stock increase from returns must remain correct.
- Customer return ledger ordering must remain:
  - `display_order = 0`
- Inactive historical context must remain preserved:
  - existing linked inactive customer/product/source invoice item stays selectable in edit flows
- Server-side return search/date filters must remain true:
  - search by `return_code`
  - search by `customer_snapshot_name`
  - search by source `invoice_code`
  - `date_from`
  - `date_to`
- Synthetic return import proof must remain available while the real copied DB has zero returns.

## 5. Import / Cutover Acceptance Checks

- Phase 2 + Phase 3 disposable rehearsal must remain runnable from the existing runbook.
- Full verifier must pass on the rehearsal target.
- No orphan refs must remain true for:
  - invoice items
  - customer ledgers
  - invoice ledger refs
  - invoice-linked debt payment refs
- Customer balances must reconcile to source snapshots.
- Inventory balances must reconcile to source snapshots.
- Document counter safety after import must remain verified.
- Synthetic returns must still be used as supplemental proof if the real copied DB has zero returns.

## 6. Intentional Divergences

Accepted divergences that may remain during redesign unless explicitly re-decided:

- Deleted debt payment parent rows remain soft-deleted internally (`is_deleted=True`) even though operationally the payment disappears from visible history.
- Stock set is represented as a `stock_adjustment` / `STOCK_SET` audit path, not as a full receipt document model.
- Web rounding remains `ROUND_HALF_UP` for calculated invoice/return line totals.
- `Khach le` / copy normalization is deferred; broad wording cleanup is not a behavior requirement.
- UI/UX redesign is deferred; this checklist governs behavior, not appearance.

## 7. Regression Command Checklist

Backend:

```powershell
pytest
pytest -m postgres
python -m compileall app tests
```

Frontend:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Import rehearsal:

- Use the existing runbook: `docs/IMPORT_REHEARSAL_AND_CUTOVER_RUNBOOK.md`
- Use the latest live confidence reference: `docs/FEATURE_PARITY_BATCH5_IMPORT_CONFIDENCE.md`

## 8. Redesign Guardrails

- UI/UX redesign must not change business logic.
- Any workflow rewrite must preserve every acceptance check above.
- If a behavior is intentionally changed:
  - update this checklist
  - update or add automated tests
  - document the decision in a new implementation note before shipping

## 9. Release Gate

Before any redesign branch is considered behavior-safe, the team should be able to say:

- inventory checks still hold
- customer/debt checks still hold
- sales/invoice checks still hold
- returns checks still hold
- import/cutover confidence checks still hold
- accepted divergences are still deliberate, not accidental regressions
