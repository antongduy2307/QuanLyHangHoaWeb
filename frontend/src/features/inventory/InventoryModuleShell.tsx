import type { PropsWithChildren, ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { PageHeader } from "../../components/PageHeader";
import { useAuth } from "../../auth/useAuth";
import { isAuthBypassEnabled } from "../../config/env";
import { adminRoutes } from "../../domain/routes";

const topNavItems = [
  { to: adminRoutes.dashboard, label: "T\u1ed5ng quan", end: true, roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.attendance, label: "Ch\u1ea5m c\u00f4ng", roles: ["owner", "admin", "attendance_manager", "read_only"] as const },
  { to: adminRoutes.products, label: "H\u00e0ng h\u00f3a", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.invoices, label: "B\u00e1n h\u00e0ng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.orders, label: "\u0110\u1eb7t h\u00e0ng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.history, label: "L\u1ecbch s\u1eed", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.customers, label: "Kh\u00e1ch h\u00e0ng", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.reports, label: "B\u00e1o c\u00e1o", roles: ["owner", "admin", "read_only"] as const },
  { to: adminRoutes.settings, label: "C\u00e0i \u0111\u1eb7t", roles: ["owner", "admin", "read_only"] as const },
] as const;

type InventoryModuleShellProps = PropsWithChildren<{
  title: string;
  description: string;
  activeNavPath?: string;
  heroActions?: ReactNode;
  contentClassName?: string;
  compactHero?: boolean;
  hideDescription?: boolean;
  hideHero?: boolean;
}>;

export function InventoryModuleShell({
  title,
  description,
  activeNavPath,
  heroActions,
  contentClassName,
  compactHero = false,
  hideDescription = false,
  hideHero = false,
  children,
}: InventoryModuleShellProps) {
  const { user, logout } = useAuth();
  const visibleTopNavItems = topNavItems.filter((item) => (user ? (item.roles as readonly string[]).includes(user.role) : false));

  return (
    <div className="inventory-redesign-page">
      <header className="inventory-top-shell">
        <div className="inventory-top-shell__brand">
          <span className="inventory-top-shell__mark" aria-hidden="true">
            QL
          </span>
          <div>
            <p className="inventory-top-shell__eyebrow">Quan ly van hanh</p>
            <strong>QuanLyHangHoa</strong>
          </div>
        </div>
        <nav className="inventory-top-nav" aria-label={"\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh"}>
          {visibleTopNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : undefined}
              className={({ isActive }) =>
                isActive || activeNavPath === item.to ? "inventory-top-nav__link active" : "inventory-top-nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="inventory-top-shell__actions">
          <div className="inventory-top-shell__user" aria-label={"Ng\u01b0\u1eddi d\u00f9ng hi\u1ec7n t\u1ea1i"}>
            <strong>{user?.display_name || "Ng\u01b0\u1eddi d\u00f9ng"}</strong>
            <span>{user?.role || "unknown"}</span>
          </div>
          {isAuthBypassEnabled() ? null : (
            <button className="inventory-ghost-button" type="button" onClick={() => void logout()}>
              {"\u0110\u0103ng xu\u1ea5t"}
            </button>
          )}
        </div>
      </header>

      {hideHero ? null : (
        <section className={compactHero ? "inventory-hero inventory-hero--compact" : "inventory-hero"}>
          <div className={compactHero ? "inventory-hero__card inventory-hero__card--flat" : "inventory-hero__card"}>
            <PageHeader title={title} description={hideDescription ? "" : description} />
            {heroActions ? <div className="inventory-hero__actions">{heroActions}</div> : null}
          </div>
        </section>
      )}

      <section className={contentClassName ?? "inventory-layout"}>{children}</section>
    </div>
  );
}
