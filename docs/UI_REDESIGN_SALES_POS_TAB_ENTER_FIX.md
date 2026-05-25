# UI Redesign: Sales POS Tab And Enter Fix

## Summary

Fixed two frontend-only Sales POS behaviors on `/sales/invoices/new`:

- Draft tab display labels now renumber from current tab order.
- Pressing `Enter` inside the POS form no longer triggers invoice payment.

No backend code, API calls, or payment business logic changed.

## Draft Tab Numbering Decision

- Each draft keeps a stable internal `id`.
- The tab label is computed at render time from the draft array index.
- Current invoice tabs always display left-to-right as `Hóa đơn 1`, `Hóa đơn 2`, `Hóa đơn 3`, and so on.
- Closing a tab automatically renumbers remaining tabs.
- Active tab tracking remains ID-based, not label-based.
- The draft model includes a `documentType` field so the label function can later support mixed tab types such as invoice and return documents.

## Close Tab Behavior

- At least one draft remains available.
- If a non-active tab is closed, the active draft stays active.
- If the active tab is closed, the adjacent next tab is selected when available; otherwise the previous remaining tab is selected.
- Closing down to one tab leaves a single blank `Hóa đơn 1` without a close button.

## Enter Behavior Decision

- The POS form prevents default submit behavior.
- The `Thanh toán` button is now `type="button"` and calls payment explicitly.
- The form intercepts `Enter` keydown outside textareas to prevent accidental payment.
- Quantity, unit price, paid amount, and other inputs remain editable by keyboard.

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `159` passed, `34` skipped.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend tests were not run because backend code was not changed.

## Files Changed

- `frontend/src/features/sales/InvoiceCreatePage.tsx`
- `frontend/src/styles.css`
- `frontend/src/app/App.test.tsx`
- `docs/UI_REDESIGN_SALES_POS_TAB_ENTER_FIX.md`
