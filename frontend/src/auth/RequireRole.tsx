import type { PropsWithChildren } from "react";

import type { UserRole } from "../domain/roles";
import { AccessDeniedPage } from "./AccessDeniedPage";
import { useAuth } from "./useAuth";

type RequireRoleProps = PropsWithChildren<{
  allowedRoles: readonly UserRole[];
}>;

export function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }
  return children;
}
