# UI Redesign: POS Mixed Tab Architecture

## Summary

Updated the Sales POS create screen to support mixed draft tabs for sale and return workflows without changing backend APIs or invoice business logic.

The POS screen now starts with one sale tab and the `+` button opens a menu for:

- `Bán hàng`
- `Trả hàng theo hóa đơn`
- `Trả hàng nhanh`

Return tabs currently render placeholders only. Full return creation UI is intentionally deferred to the next batch.

## Tab Model Decision

- POS drafts now use a generic union with a stable internal `id`.
- Sale tabs keep the existing invoice form state and existing product/customer/payment behavior.
- Linked-return and quick-return tabs carry placeholder data containers for future forms.
- Active tab tracking remains ID-based, not label-based.
- Display labels are computed during render and are not used as storage keys.

## Numbering Logic

Labels are numbered by visible order within each tab type:

- Sale tabs: `Bán hàng 1`, `Bán hàng 2`
- Linked return tabs: `Trả theo HĐ 1`, `Trả theo HĐ 2`
- Quick return tabs: `Trả nhanh 1`, `Trả nhanh 2`

Closing a tab automatically renumbers remaining tabs of the same type. If all tabs would be closed, the POS creates a fresh blank sale tab.

## + Menu Behavior

The `+` button opens a small menu beside the draft tabs. Selecting a menu item appends a new draft of that type and activates it.

## Return Creation Migration Plan

For now, the top-level `Trả hàng` navigation remains unchanged. Return creation will move into POS tabs in the next batch by replacing the placeholder panels with linked-return and quick-return forms while keeping the same draft container model.

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`
- `docs/UI_REDESIGN_POS_MIXED_TAB_ARCHITECTURE.md`

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
```

Result:

- Passed: `162` tests
- Skipped: `34` tests

`npm.cmd run build` and `npm.cmd run lint` are run as final verification for this batch.

Final verification:

- `npm.cmd test -- --run`: passed, `162` passed, `34` skipped.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend tests were not run because backend code was not changed.

## Next Batch

Implement real POS return forms:

- `Trả hàng theo hóa đơn`: source invoice lookup, source item selection, return quantity validation.
- `Trả hàng nhanh`: product-name search, return line entry, optional customer association.
- Keep backend return endpoints authoritative.
