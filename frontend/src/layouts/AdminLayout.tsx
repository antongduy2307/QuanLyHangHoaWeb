import { Outlet } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AdminLayout() {
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
