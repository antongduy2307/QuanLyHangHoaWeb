from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.domain.auth import UserRole
from app.main import app


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


@pytest.fixture
def pg_client(postgres_session: Session) -> Iterator[TestClient]:
    def override_session() -> Iterator[Session]:
        yield postgres_session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _auth_headers(pg_client: TestClient, postgres_session: Session, role: UserRole) -> dict[str, str]:
    suffix = uuid4().hex[:10]
    username = f"{role.value}_attendance_{suffix}"
    password = "strong-password"
    AuthService().create_user(
        postgres_session,
        username=username,
        password=password,
        display_name=f"{role.value} Attendance",
        role=role,
    )
    postgres_session.commit()
    response = pg_client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_postgres_attendance_access_policy_and_period_creation(pg_client: TestClient, postgres_session: Session) -> None:
    manager_headers = _auth_headers(pg_client, postgres_session, UserRole.ATTENDANCE_MANAGER)
    read_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)

    create_employee = pg_client.post(
        "/api/attendance/employees",
        headers=manager_headers,
        json={"display_name": "Postgres Attendance Worker", "team": "blow"},
    )
    create_period = pg_client.post(
        "/api/attendance/periods/ensure-for-date",
        headers=manager_headers,
        json={"selected_date": "2026-05-24"},
    )
    read_list = pg_client.get("/api/attendance/employees", headers=read_headers)
    employee_forbidden = pg_client.get("/api/attendance/employees", headers=employee_headers)

    assert create_employee.status_code == 201
    assert create_period.status_code == 201
    assert create_period.json()["start_date"] == "2026-05-21"
    assert create_period.json()["end_date"] == "2026-05-31"
    assert read_list.status_code == 200
    assert employee_forbidden.status_code == 403
