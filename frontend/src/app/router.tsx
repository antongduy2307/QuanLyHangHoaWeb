import { Navigate, type RouteObject } from "react-router-dom";

import { LoginPage } from "../auth/LoginPage";
import { RequireAuth } from "../auth/RequireAuth";
import { RequireRole } from "../auth/RequireRole";
import { AttendancePage } from "../features/attendance/AttendancePage";
import { CustomerCreatePage } from "../features/customers/CustomerCreatePage";
import { CustomerDetailPage } from "../features/customers/CustomerDetailPage";
import { CustomerEditPage } from "../features/customers/CustomerEditPage";
import { CustomerListPage } from "../features/customers/CustomerListPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { HistoryListPage } from "../features/history/HistoryListPage";
import { ProductCreatePage } from "../features/inventory/ProductCreatePage";
import { ProductDetailPage } from "../features/inventory/ProductDetailPage";
import { ProductEditPage } from "../features/inventory/ProductEditPage";
import { ProductListPage } from "../features/inventory/ProductListPage";
import { OrderListPage } from "../features/orders/OrderListPage";
import { ReportsPlaceholder } from "../features/reports/ReportsPlaceholder";
import { ReturnDetailPage } from "../features/returns/ReturnDetailPage";
import { ReturnCreatePage } from "../features/returns/ReturnCreatePage";
import { ReturnEditPage } from "../features/returns/ReturnEditPage";
import { ReturnListPage } from "../features/returns/ReturnListPage";
import { InvoiceCreatePage } from "../features/sales/InvoiceCreatePage";
import { InvoiceDetailPage } from "../features/sales/InvoiceDetailPage";
import { InvoiceEditPage } from "../features/sales/InvoiceEditPage";
import { InvoiceListPage } from "../features/sales/InvoiceListPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { AdminLayout } from "../layouts/AdminLayout";

const adminShellRoles = ["owner", "admin", "read_only"] as const;
const adminWriteRoles = ["owner", "admin"] as const;
const attendanceShellRoles = ["owner", "admin", "attendance_manager", "read_only"] as const;
const settingsShellRoles = ["owner", "admin", "attendance_manager", "read_only"] as const;

export const appRoutes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth allowedRoles={adminShellRoles}>
        <DashboardPage />
      </RequireAuth>
    ),
  },
  {
    path: "/attendance",
    element: (
      <RequireAuth allowedRoles={attendanceShellRoles}>
        <AttendancePage />
      </RequireAuth>
    ),
  },
  {
    path: "/settings",
    element: (
      <RequireAuth allowedRoles={settingsShellRoles}>
        <SettingsPage />
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth allowedRoles={adminShellRoles}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { path: "inventory", element: <Navigate to="/inventory/products" replace /> },
      { path: "inventory/products", element: <ProductListPage /> },
      {
        path: "inventory/products/new",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <ProductCreatePage />
          </RequireRole>
        ),
      },
      { path: "inventory/products/:productId", element: <ProductDetailPage /> },
      {
        path: "inventory/products/:productId/edit",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <ProductEditPage />
          </RequireRole>
        ),
      },
      { path: "history", element: <HistoryListPage /> },
      { path: "customers", element: <CustomerListPage /> },
      {
        path: "customers/new",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <CustomerCreatePage />
          </RequireRole>
        ),
      },
      { path: "customers/:customerId", element: <CustomerDetailPage /> },
      {
        path: "customers/:customerId/edit",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <CustomerEditPage />
          </RequireRole>
        ),
      },
      { path: "sales/invoices", element: <InvoiceListPage /> },
      {
        path: "sales/invoices/new",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <InvoiceCreatePage />
          </RequireRole>
        ),
      },
      { path: "sales/invoices/:invoiceId", element: <InvoiceDetailPage /> },
      {
        path: "sales/invoices/:invoiceId/edit",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <InvoiceEditPage />
          </RequireRole>
        ),
      },
      { path: "orders", element: <OrderListPage /> },
      { path: "returns", element: <ReturnListPage /> },
      {
        path: "returns/new",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <ReturnCreatePage />
          </RequireRole>
        ),
      },
      { path: "returns/:returnId", element: <ReturnDetailPage /> },
      {
        path: "returns/:returnId/edit",
        element: (
          <RequireRole allowedRoles={adminWriteRoles}>
            <ReturnEditPage />
          </RequireRole>
        ),
      },
      { path: "reports", element: <ReportsPlaceholder /> },
    ],
  },
];
