from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    ATTENDANCE_MANAGER = "attendance_manager"
    EMPLOYEE = "employee"
    READ_ONLY = "read_only"


ADMIN_WRITE_ROLES = frozenset({UserRole.OWNER, UserRole.ADMIN})
ADMIN_READ_ROLES = frozenset({UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY})
ATTENDANCE_MANAGER_ROLES = frozenset({UserRole.OWNER, UserRole.ADMIN, UserRole.ATTENDANCE_MANAGER})

ALL_USER_ROLES = frozenset(UserRole)
