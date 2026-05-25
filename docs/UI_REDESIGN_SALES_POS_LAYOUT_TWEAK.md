# UI Redesign: Sales POS Layout Tweak

## Summary

Adjusted `/sales/invoices/new` to sit closer to the desktop POS layout. The page title/hero is removed, the product search now starts the POS workspace, invoice draft tabs sit beside the search, and the surrounding card framing is reduced.

No backend code or invoice business logic changed.

## Layout Changes

- Suppressed the `Bán hàng` page title/header on the POS create route.
- Kept the horizontal top navigation shell.
- Moved the product search to the top of the POS workspace.
- Shortened the search area and placed invoice draft tabs to its right.
- Flattened the main sale area, note area, payment panel, customer summary, and payment summary so only the item list reads as the primary table surface.

## Table Changes

- Replaced the line-item HTML table with a CSS-grid table structure.
- Preserved the same columns: `STT`, delete, `Mã hàng`, `Tên hàng`, `Loại/Đơn vị`, `Số lượng`, `Đơn giá`, `Thành tiền`.
- Added clearer vertical boundaries between columns.
- Styled quantity, unit, and price controls to blend into table cells while preserving keyboard editing.
- Kept row hover feedback and compact-medium row height.

## Column Resize Approach

- Column widths are stored in local component state as proportional values.
- Each header boundary has a draggable separator.
- Dragging a separator adjusts the selected column and the adjacent column while preserving total grid width.
- Minimum widths prevent key columns from collapsing too far.
- No persistence is implemented; widths reset on page refresh.

## Tests Run

From `frontend/`:

```powershell
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

Results:

- `npm.cmd test -- --run`: passed, `153` passed, `34` skipped.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.

Backend tests were not run because backend code was not changed.

## Known Limitations

- Column widths are not persisted.
- Resize is local to the POS create component.
- Invoice list/detail/edit screens still use the previous UI.
- Drafts remain frontend-only and are lost on refresh.
