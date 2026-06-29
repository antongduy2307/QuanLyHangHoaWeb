import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { adminRoutes } from "../domain/routes";

const navItems = [
  { to: adminRoutes.dashboard, label: "Tổng quan", end: true, roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.attendance, label: "Chấm công", roles: ["owner", "admin", "attendance_manager", "read_only"] as const },
  { to: adminRoutes.products, label: "Hàng hóa", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.customers, label: "Khách hàng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.history, label: "Lịch sử", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.invoices, label: "Bán hàng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.orders, label: "Đặt hàng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.reports, label: "Báo cáo", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.settings, label: "Cài đặt", roles: ["owner", "admin", "read_only"] as const },
];

export function Sidebar() {
  const { user } = useAuth();
  const visibleNavItems = navItems.filter((item) => (user ? (item.roles as readonly string[]).includes(user.role) : false));

  return (
    <aside className="sidebar" aria-label="Dieu huong chinh">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          QL
        </span>
        <div>
          <p className="brand-name">QuanLyHangHoa</p>
          <p className="brand-caption">Admin web</p>
        </div>
      </div>
      <nav className="nav-list">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
