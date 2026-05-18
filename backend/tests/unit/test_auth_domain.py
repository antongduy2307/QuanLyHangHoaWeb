from __future__ import annotations

from app.domain.auth import ADMIN_READ_ROLES, ADMIN_WRITE_ROLES, ALL_USER_ROLES, ATTENDANCE_MANAGER_ROLES, UserRole


def test_user_role_values_are_lowercase_strings() -> None:
    assert UserRole.OWNER.value == "owner"
    assert UserRole.ADMIN.value == "admin"
    assert UserRole.ATTENDANCE_MANAGER.value == "attendance_manager"
    assert UserRole.EMPLOYEE.value == "employee"
    assert UserRole.READ_ONLY.value == "read_only"


def test_role_groups_contain_expected_roles() -> None:
    assert ADMIN_WRITE_ROLES == {UserRole.OWNER, UserRole.ADMIN}
    assert ADMIN_READ_ROLES == {UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY}
    assert ATTENDANCE_MANAGER_ROLES == {UserRole.OWNER, UserRole.ADMIN, UserRole.ATTENDANCE_MANAGER}
    assert ALL_USER_ROLES == {
        UserRole.OWNER,
        UserRole.ADMIN,
        UserRole.ATTENDANCE_MANAGER,
        UserRole.EMPLOYEE,
        UserRole.READ_ONLY,
    }
