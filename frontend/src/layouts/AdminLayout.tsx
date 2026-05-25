import { Outlet, useLocation } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AdminLayout() {
  const location = useLocation();
  const isInventoryRedesignRoute = /^\/inventory\/products(?:\/new|\/\d+(?:\/edit)?)?$/.test(location.pathname);
  const isSalesPosRoute = location.pathname === "/sales/invoices/new";
  const isInvoiceDetailRoute = /^\/sales\/invoices\/\d+$/.test(location.pathname);
  const isOrdersRoute = location.pathname === "/orders";
  const isCustomerRedesignRoute = /^\/customers(?:\/new|\/\d+(?:\/edit)?)?$/.test(location.pathname);
  const isHistoryRoute = location.pathname === "/history";

  if (
    isInventoryRedesignRoute
    || isSalesPosRoute
    || isInvoiceDetailRoute
    || isOrdersRoute
    || isCustomerRedesignRoute
    || isHistoryRoute
  ) {
    return (
      <main className="page-surface page-surface--full-bleed" aria-label="Noi dung chinh">
        <Outlet />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="page-surface" aria-label="Noi dung chinh">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
