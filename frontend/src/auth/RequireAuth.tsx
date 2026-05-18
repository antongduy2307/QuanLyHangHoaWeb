import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { UserRole } from "../domain/roles";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { useAuth } from "./useAuth";

type RequireAuthProps = PropsWithChildren<{
  allowedRoles?: readonly UserRole[];
}>;

export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const { user, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <main className="auth-screen" aria-label="Dang tai">
        <section className="auth-card">
          <h1>Dang tai phien lam viec</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return children;
}
