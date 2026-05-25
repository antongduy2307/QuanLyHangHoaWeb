import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Tong quan", end: true },
  { to: "/inventory/products", label: "Hang hoa" },
  { to: "/customers", label: "Khach hang" },
  { to: "/history", label: "Lich su" },
  { to: "/sales/invoices/new", label: "Ban hang" },
  { to: "/orders", label: "Dat hang" },
  { to: "/reports", label: "Bao cao" },
  { to: "/settings", label: "Cai dat" },
];

export function Sidebar() {
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
        {navItems.map((item) => (
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
