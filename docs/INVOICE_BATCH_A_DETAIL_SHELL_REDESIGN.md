# Invoice Batch A: Detail Shell Redesign

## Summary

Batch A redesigned `/sales/invoices/:invoiceId` onto the current brown/cream shell used by the newer inventory, customer, history, and sales POS surfaces.

This batch was frontend-only:

- no invoice business logic changed
- edit workflow still links to the existing edit route
- delete confirm and redirect behavior stayed intact

## Navigation Choice

The redesigned shell highlights `Bán hàng` as the active top-nav item for invoice detail.

Reason:

- the route is still part of the sales/invoice feature set
- the primary follow-up action from detail is `Sửa hóa đơn`
- the current back target remains `/sales/invoices`

`Lịch sử` would be more ambiguous because invoice detail is also reachable outside history and is not primarily a history-owned page.

## Changes

### Route shell behavior

- `AdminLayout` now treats `/sales/invoices/:invoiceId` as a full-bleed redesigned route.
- This prevents the old sidebar/topbar shell from wrapping the invoice detail page.

### Redesign shell integration

- `InvoiceDetailPage` now renders inside `InventoryModuleShell`.
- The page uses the redesigned top-nav shell and full-bleed content layout.
- The top nav is explicitly overridden so `Bán hàng` remains active on detail routes.

### Invoice detail UI

- Hero/header actions now use the redesigned button system.
- Summary fields remain the same business data:
  - mã hóa đơn
  - thời gian
  - khách hàng
  - tổng tiền
  - đã thanh toán
  - còn lại
  - trạng thái
  - ghi chú
- Item table remains the same business data:
  - mã hàng
  - tên hàng
  - đơn vị
  - số lượng
  - đơn giá
  - thành tiền

### Styling

- Added invoice-detail-specific card styling scoped to the redesigned shell.
- Reused existing inventory table styling for the brown/cream table presentation.

## Files Changed

- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/features/sales/InvoiceDetailPage.tsx`
- `frontend/src/features/sales/InvoicePages.test.tsx`
- `frontend/src/styles.css`

## Verification

Commands run from `frontend/`:

- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run lint`

Results:

- tests: passed (`9` files, `42` tests)
- build: passed
- lint: passed

Build note:

- Vite reported an existing chunk-size warning for the main JS bundle exceeding `500 kB` after minification.
- This batch did not introduce a build failure and did not change bundling strategy.

## Risks / Follow-up

- Invoice list and invoice edit still use the older shell and remain visually inconsistent until later batches.
- The top-nav active override is route-driven for invoice detail only; future POS edit-draft work should keep `Bán hàng` active there as well.
