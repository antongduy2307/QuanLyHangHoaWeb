# Real app.db Ledger Mismatch Investigation

## 1. Summary

The copied desktop database at `backend/validation_sources/real_app_copy.db` fails the Phase 2 inventory/customer validator only because of `ledger_balance_after_mismatch` issues.

Validation summary reviewed:

| Metric | Count |
| --- | ---: |
| Products | 23 |
| Product prices | 30 |
| Inventory balances | 23 |
| Customers | 87 |
| Customer ledger rows | 257 |
| Errors | 78 |
| Warnings | 173 |
| Info | 20 |
| `can_import_core` | `false` |

Issue counts:

| Severity | Code | Count |
| --- | --- | ---: |
| error | `ledger_balance_after_mismatch` | 78 |
| warning | `deferred_sales_return_ledger_dependency` | 173 |
| info | `negative_inventory_balance` | 20 |

The 78 row-level ledger mismatches affect 34 customers. Every affected customer also has invoice-linked ledger rows. All 87 customer `current_balance` values match the recomputed final ledger balance when the rows are sorted by the desktop service order. This points to stale or historically shifted intermediate `balance_after` values in timelines that include deferred sales/invoice behavior, not to final customer balance corruption.

Recommendation: do not treat these invoice-dependent row-level mismatches as Phase 2 core import blockers. Split validation into core import readiness and full ledger import readiness. Keep row-level ledger mismatch blocking only for customer timelines with no deferred sales/return dependencies.

## 2. Validator Logic Reviewed

Reviewed file:

- `backend/app/importers/app_db_inventory_customer_validator.py`

Relevant current behavior:

- Opens the SQLite DB read-only using `sqlite3.connect("file:...?mode=ro", uri=True)`.
- Requires these desktop tables: `products`, `product_prices`, `inventory_balances`, `customers`, `customer_balance_ledgers`.
- Defines deferred sales/return reference types as `INVOICE`, `RETURN`, and `RETURN_INVOICE`.
- Emits `warning.deferred_sales_return_ledger_dependency` when a ledger row has:
  - `ref_type` in the deferred set;
  - `source_ref_type` in the deferred set;
  - or a note containing `overpayment from invoice`.
- Groups ledgers by customer and recomputes `balance_after` from zero.
- Sorts ledgers with:
  - `transaction_datetime` if present;
  - otherwise `created_at`;
  - then `display_order`;
  - then `id`.
- Emits `error.ledger_balance_after_mismatch` for every row where stored `balance_after` does not equal the recomputed running balance.
- Emits `error.customer_current_balance_mismatch` if `customers.current_balance` does not equal the final recomputed balance.

Important finding: the validator already detects invoice/return dependency rows as deferred, but it still marks row-level `balance_after` mismatches as blocking even when the affected customer timeline contains deferred invoice behavior.

## 3. Desktop Ledger Logic Reviewed

Reviewed files:

- `QuanLyHangHoa/modules/customer/models.py`
- `QuanLyHangHoa/modules/customer/repository.py`
- `QuanLyHangHoa/modules/customer/service.py`
- `QuanLyHangHoa/core/db.py`
- `QuanLyHangHoa/core/migrations.py`
- `QuanLyHangHoa/tests/test_ledger_ordering_migration.py`
- `QuanLyHangHoa/tests/test_customer_invoice_payment_migration.py`
- `QuanLyHangHoa/tests/test_overpayment_ordering_pipeline.py`

Desktop model behavior:

- `CustomerBalanceLedger` stores `event_type`, `ref_type`, `ref_id`, `source_ref_type`, `source_ref_id`, `display_order`, `amount_delta`, `balance_after`, `transaction_datetime`, `created_at`, and `note`.
- `effective_transaction_datetime` is `transaction_datetime or created_at`, mainly for display and debt payment list sorting.

Desktop repository recompute order:

```sql
ORDER BY transaction_datetime ASC, display_order ASC, id ASC
```

Desktop service behavior:

- `_append_balance_ledger()` initially writes `balance_after` as `customer.current_balance + amount_delta`.
- `_recompute_customer_balance()` later recomputes all ledger rows in repository order and updates `customers.current_balance`.
- Current `create_customer()` uses `OPENING_BALANCE_DATETIME = 1900-01-01 00:00:00`, but the real copied DB has zero opening rows at 1900, which means many rows were created before that rule or were backfilled differently.
- `pay_debt()` creates `DEBT_PAYMENT` rows.
- `update_debt_payment()` appends rollback and replacement rows using the same debt payment `ref_id`.
- `delete_debt_payment()` removes all ledger rows for the selected debt payment `ref_id`.

Desktop migration/backfill behavior:

- `core/db.py` backfills missing `transaction_datetime` with `created_at`.
- `core/db.py` adds `source_ref_type`, `source_ref_id`, and `display_order`.
- Existing invoice ledgers get `source_ref_type = INVOICE`, `source_ref_id = ref_id`, and `display_order = 10`.
- Standalone debt payment rows with default order get `display_order = 30`.
- Legacy overpayment rows are linked to invoices by note and set to `display_order = 20`.
- `core/migrations.py` migrates paid invoices by ensuring invoice charge rows and generated invoice payment rows are separate. It then recomputes affected customers by `transaction_datetime ASC, display_order ASC, id ASC`.

Desktop tests confirm:

- Invoice charge rows are ordered before source-linked invoice debt payment rows.
- Generated invoice payment rows use `source_ref_type = INVOICE` and `display_order = 20`.
- Standalone debt payments use a later display order.
- UI/history views may display newest-first, but balance recomputation uses oldest-first ledger order.

## 4. Root Cause Analysis of Mismatch

The validator recomputation rule is close to the current desktop recomputation rule because all real copied DB ledger rows have non-null `transaction_datetime`. The `created_at` fallback does not explain these mismatches.

The mismatch pattern instead points to historical ledger rows whose stored intermediate `balance_after` values were not fully rewritten after invoice/order timing or opening/manual balance rows shifted around them.

Observed evidence from the real copied DB:

- All 87 customers have `current_balance` equal to the recomputed final ledger balance.
- No `customer_current_balance_mismatch` issues were present.
- 34 customers have row-level mismatches.
- All 34 affected customers also have deferred invoice/return dependency rows.
- No affected customer has mismatches in a pure core-only timeline.
- 38 mismatched rows are themselves invoice rows.
- 40 mismatched rows are non-invoice rows, but all are in customer timelines that contain invoice rows.
- Opening balance rows are especially affected:
  - 48 opening balance rows exist.
  - 0 opening balance rows use the current `1900-01-01 00:00:00` convention.
  - 29 opening balance rows have `balance_after` mismatches.

Example pattern:

- Customer 4 has an `INVOICE_CHARGE` at `2026-04-11 09:26:29`.
- The customer's `OPENING_BALANCE` is later at `2026-04-11 09:49:11`.
- The opening balance row's stored `balance_after` equals its own delta, but the recomputed timeline expects it to include the earlier invoice charge.
- The final `customers.current_balance` still equals the recomputed sum.

This is consistent with legacy or partially backfilled ledger histories where:

- opening balances were written with real creation timestamps rather than the current 1900 convention;
- sales/invoice rows can be dated before customer opening/manual rows;
- generated invoice payments and standalone debt payments have different `display_order` semantics;
- final customer balance stayed correct because the customer aggregate is the net sum, even when intermediate stored row balances became stale.

## 5. Mismatch Classification

Mismatch distribution:

| Row category | Count |
| --- | ---: |
| `INVOICE_CHARGE` / `INVOICE` / source `INVOICE` | 38 |
| `OPENING_BALANCE` / `OPENING_BALANCE` | 29 |
| `BALANCE_ADJUSTMENT` / `BALANCE_ADJUSTMENT` | 6 |
| `DEBT_PAYMENT` / `DEBT_PAYMENT` / no source | 5 |

Deferred dependency relationship:

| Classification | Count |
| --- | ---: |
| Mismatched row is directly deferred invoice/return-linked | 38 |
| Mismatched row is not directly deferred, but customer timeline has deferred invoice rows | 40 |
| Mismatched row belongs to customer timeline with no deferred invoice/return rows | 0 |

Customer-level findings:

| Finding | Count |
| --- | ---: |
| Customers affected by row-level mismatch | 34 |
| Affected customers with deferred invoice/return rows | 34 |
| Affected customers without deferred invoice/return rows | 0 |
| Customers whose `current_balance` matches recomputed final balance | 87 of 87 |
| Customers whose latest stored ledger row balance does not equal `current_balance` | 28 |

Interpretation:

- These mismatches should not be classified as confirmed data corruption.
- They are best classified as deferred full-ledger readiness issues caused by invoice-dependent historical timelines and legacy backfill assumptions.
- They are relevant for Phase 3 sales/returns migration, but they should not block Phase 2 import planning for products, inventory balances, customers, and final customer balance snapshots.

## 6. Recommended Validation Policy

Recommended policy: split validation into two readiness levels.

### Core-only import readiness

Use this for Phase 2 inventory/customer import planning.

Core readiness should block on:

- missing required inventory/customer tables;
- invalid product codes, names, unit modes, prices, or canonical balances;
- customer name and numeric precision violations;
- ledgers that reference missing customers;
- blank ledger `event_type` or `ref_type`;
- numeric overflow in ledger amount fields;
- `customer_current_balance_mismatch` against recomputed final ledger balance;
- `ledger_balance_after_mismatch` only when the customer's ledger timeline has no deferred sales/return dependency.

Core readiness should warn on:

- row-level `balance_after` mismatches in customer timelines that include invoice/return dependency rows;
- invoice/return-linked ledgers not yet importable in Phase 2;
- legacy opening balances not using the new 1900 convention;
- stale latest-row `balance_after` when final `customers.current_balance` still matches recomputed final balance.

### Full ledger import readiness

Use this for Phase 3 or later sales/returns migration.

Full readiness should keep row-level `ledger_balance_after_mismatch` blocking, because full historical timeline import requires sales, returns, generated payments, document timestamps, source links, and ledger balances to be reconciled as one unit.

## 7. Recommended Code Changes, If Any

No code was changed for this investigation.

Recommended future validator changes:

1. Add a customer-level deferred dependency classification before emitting row-level balance mismatch issues.
2. Emit a warning such as `ledger_balance_after_mismatch_deferred_dependency` when:
   - the mismatch is on an invoice/return-linked row; or
   - the mismatch is on a non-invoice row but the same customer timeline contains invoice/return-linked rows.
3. Keep `ledger_balance_after_mismatch` as a blocking error for pure core-only customer timelines.
4. Add summary fields for:
   - affected customer count;
   - mismatches by `event_type/ref_type/source_ref_type`;
   - customers where `current_balance` matches recomputed final balance;
   - customers where latest stored ledger `balance_after` differs from `current_balance`.
5. Add a separate full-ledger readiness flag, for example:
   - `can_import_core`;
   - `can_import_full_ledger`.
6. Add tests for:
   - pure standalone debt ledger mismatch remains blocking;
   - invoice-dependent row mismatch is warning for core readiness;
   - final current balance mismatch remains blocking even with deferred invoice rows.

## 8. Risks If Ignored

If the validator keeps all row-level mismatches as Phase 2 blockers:

- Phase 2 customer/import planning will be blocked by sales/invoice history that is explicitly out of scope.
- Work may drift into premature sales/returns migration before the inventory/customer core is stable.
- Operators may incorrectly interpret all 78 mismatches as customer balance corruption.

If the validator downgrades mismatches too broadly:

- Real standalone debt or customer ledger corruption could be missed.
- Future full ledger migration could import misleading historical `balance_after` values.
- Audit-style screens may display stale intermediate balances if they rely on stored row balances rather than recomputed timeline balances.

The safer compromise is to downgrade only when the customer timeline has deferred invoice/return dependencies and final `customers.current_balance` still matches the recomputed final balance.

## 9. Recommended Next Step

Implement a Batch 5 follow-up that updates the import validator policy without importing data:

1. Add core-readiness versus full-ledger-readiness classification.
2. Downgrade row-level ledger mismatches to warnings only for invoice/return-dependent customer timelines.
3. Keep final `customers.current_balance` mismatch blocking.
4. Preserve the current detailed JSON output, but include classification statistics so the migration team can see which rows need Phase 3 reconciliation.
5. Re-run validation against `backend/validation_sources/real_app_copy.db` and confirm `can_import_core` reflects inventory/customer readiness while full ledger readiness remains blocked or warned until sales/returns migration.
