export const userRoles = ["owner", "admin", "attendance_manager", "employee", "read_only"] as const;

export type UserRole = (typeof userRoles)[number];
