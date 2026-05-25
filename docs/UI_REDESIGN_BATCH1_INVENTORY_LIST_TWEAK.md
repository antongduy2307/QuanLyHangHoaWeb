# UI Redesign Batch 1 Inventory List Tweak

## Summary

This tweak reduces the visual height of the `/inventory/products` header area and brings the list page closer to the KiotViet-style reference without changing any inventory behavior.

Adjusted items:

- removed the large rounded header card around the `Hàng hóa` title on the product list page;
- removed the subtitle text from the list page header;
- reduced vertical spacing between top navigation, page title, toolbar, and list content;
- removed the outer bordered card treatment around the search/action toolbar row;
- widened the search input so it occupies more horizontal space before the action buttons.

## Files Changed

- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/features/inventory/ProductListPage.tsx`
- `frontend/src/styles.css`

## Visual Changes

- Product list title now sits directly on the page background.
- The list body starts higher on the page with less empty space below the top navigation.
- The search/action row is now visually flatter and lighter.
- Action buttons remain aligned on the right.
- Search input remains bordered and responsive, but uses more of the available width.

## Commands / Results

From `frontend/`:

- `npm.cmd test -- --run`
  - passed: `159`
  - skipped: `2`
- `npm.cmd run build`
  - passed
- `npm.cmd run lint`
  - passed
