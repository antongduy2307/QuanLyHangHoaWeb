# Dashboard Batch 2: Overview Cards UI

Date: 2026-05-25

## Summary

Batch 2 wires the frontend dashboard to `GET /api/reports/overview` and redesigns the `/` dashboard page into the brown/cream operational shell.

Implemented card section:

- `Kết quả bán hàng hôm nay`

Cards rendered:

- `Số hóa đơn hôm nay`
- `Doanh thu hôm nay`
- `Số phiếu trả hàng hôm nay`
- `Tiền trả hàng hôm nay`
- `Doanh thu 7 ngày qua`
- `Doanh thu tháng này`
- `Doanh thu tháng trước`
- `Công nợ hiện tại`

## Frontend Changes

- Added overview API client
- Added overview React Query hook
- Switched dashboard page from `dashboard-summary` to `overview`
- Reworked dashboard into the shared `InventoryModuleShell`
- Added dashboard-specific brown/cream card styling
- Added loading, error, and empty states

## Files Changed

- `frontend/src/api/types.ts`
- `frontend/src/api/reports.ts`
- `frontend/src/features/reports/reportQueries.ts`
- `frontend/src/features/dashboard/DashboardPage.tsx`
- `frontend/src/features/inventory/InventoryModuleShell.tsx`
- `frontend/src/tests/appTestHarness.ts`
- `frontend/src/features/dashboard/DashboardAndReports.test.tsx`
- `frontend/src/app/AdminShell.test.tsx`
- `frontend/src/styles.css`

## Test Coverage

- dashboard renders overview cards
- dashboard loading state
- dashboard error state
- dashboard empty state
- read-only session can view dashboard
- admin shell navigation labels remain valid after shell-text cleanup

## Scope

- Frontend only
- No backend code changed in this batch
