# Attendance Batch E Inventory Effects

## Summary

Batch E adds product-linked CUT work inventory effects on top of the existing attendance backend.

Implemented:

- durable `attendance_inventory_effects` table
- product-link consistency rule for attendance CUT work items
- finalized attendance inventory application
- idempotent reconcile-on-resave behavior
- absent/draft cleanup behavior
- minimal inventory diagnostics endpoint

Out of scope in this batch:

- legacy attendance DB import
- Excel / print
- employee portal
- full attendance settings redesign

## Product-Link Decision

Attendance remains in the same PostgreSQL database as the rest of the app.

Batch E keeps `attendance_bag_types.product_id` as the canonical link to inventory products and enforces:

- `is_product_linked=true` requires `product_id`
- `is_product_linked=false` requires `product_id=NULL`

Current unit mapping:

- `BAO_KG` product -> attendance effect uses inventory unit `BAO`
- `BICH` product -> attendance effect uses inventory unit `BICH`

This matches the legacy investigation and keeps attendance production aligned with the current inventory storage model.

## Inventory Effect Model

Added table:

- `attendance_inventory_effects`

Fields:

- `id`
- `daily_record_id`
- `cut_log_id` nullable
- `extra_cut_log_id` nullable
- `employee_id`
- `work_date`
- `bag_type_id`
- `product_id`
- `quantity_delta`
- `unit_type`
- `movement_datetime`
- `note`
- `created_at`
- `updated_at`

Key constraints:

- FK `daily_record_id`
- FK `cut_log_id`
- FK `extra_cut_log_id`
- FK `employee_id`
- FK `bag_type_id`
- FK `product_id`
- exactly one source line:
  - `cut_log_id` xor `extra_cut_log_id`
- unique `cut_log_id`
- unique `extra_cut_log_id`
- `quantity_delta > 0`
- `unit_type IN ('BAO', 'BICH')`

## Finalize / Reconcile Behavior

Attendance save now reconciles inventory effects inside the same transaction as the day-entry save.

Rules:

- draft attendance:
  - active inventory effects are removed if they exist
  - no new inventory effects are applied
- absent attendance:
  - existing inventory effects for that daily record are reversed and deleted
  - no new inventory effects are applied
- finalized cut attendance:
  - CUT log quantities increase inventory for linked products
- finalized blow attendance with extra CUT (`VK`) lines:
  - extra CUT lines also increase inventory for linked products

Re-save of finalized attendance:

1. load existing effects for `daily_record_id`
2. reverse their stock impact
3. delete old effect rows
4. apply new stock increases from the current saved attendance rows
5. insert the new effect rows

This is idempotent at the daily-record level and matches the intended desktop reconcile behavior, but now runs inside one PostgreSQL transaction.

## Inventory Movement Integration

Actual stock changes continue to use the existing `InventoryService`, which writes:

- canonical inventory balances
- `stock_adjustments` movement rows for audit history

Attendance effects are therefore:

- the current active attendance-to-inventory state
- while `stock_adjustments` remain the audit trail of each increase/decrease/reversal

## Diagnostics

Added endpoint:

- `GET /api/attendance/inventory-diagnostics`

Current diagnostics detect:

- finalized attendance record missing inventory effects
- attendance inventory effect product mismatch
- attendance inventory effect quantity mismatch
- inventory effects existing for draft or absent records

Repair endpoint is intentionally deferred.

## Tests Run / Results

Commands run:

```powershell
pytest
pytest -m postgres
python -m compileall app tests
```

Results:

- `python -m compileall app tests`
  - passed
- `uv run pytest`
  - passed
  - `363 passed, 27 skipped`
- `uv run pytest -m postgres`
  - no failures
  - `27 skipped, 363 deselected`
  - postgres-marked tests were skipped because `TEST_DATABASE_URL` was not available/reachable in this run

No frontend commands were run because the frontend was not changed in this batch.

## Deferred Items

Still deferred after Batch E:

- legacy `attendance.db` import
- Excel / print
- employee portal
- full settings redesign
- explicit repair endpoint for diagnostics

## Risks

- Attendance effect reversals create offsetting `stock_adjustments` rows instead of mutating past history in place.
  - This is intentional and preserves auditability.
- Product-link consistency is now stricter than earlier attendance test fixtures.
  - Future CUT work setup must use real linked products.
- The diagnostics endpoint is read-only.
  - Operators can see drift, but cannot auto-repair from the API yet.
