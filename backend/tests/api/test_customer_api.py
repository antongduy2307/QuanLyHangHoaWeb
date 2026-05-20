from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.domain.auth import UserRole
from app.infrastructure.db.base import Base
from app.main import app


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        yield SessionLocal
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(session_factory) -> Iterator[TestClient]:

    def override_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def auth_headers(client: TestClient, session_factory, role: UserRole = UserRole.OWNER) -> dict[str, str]:
    username = f"{role.value}_customer_user"
    with session_factory() as session:
        if AuthService()._repository.get_user_by_username(session, username) is None:
            AuthService().create_user(
                session,
                username=username,
                password="strong-password",
                display_name=role.value,
                role=role,
            )
            session.commit()
    response = client.post("/api/auth/login", json={"username": username, "password": "strong-password"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_customer(
    client: TestClient,
    headers: dict[str, str],
    name: str = "Customer",
    opening_balance: str = "0",
) -> dict:
    response = client.post(
        "/api/customers",
        headers=headers,
        json={"customer_name": name, "opening_balance": opening_balance, "note": "note"},
    )
    assert response.status_code == 201
    return response.json()


def test_anonymous_and_invalid_customer_access_return_401(client: TestClient) -> None:
    anonymous = client.get("/api/customers")
    invalid = client.get("/api/customers", headers={"Authorization": "Bearer invalid-token"})

    assert anonymous.status_code == 401
    assert invalid.status_code == 401


def test_read_only_can_get_but_cannot_write_customers(client: TestClient, session_factory) -> None:
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    create_customer(client, owner_headers)

    read_response = client.get("/api/customers", headers=read_headers)
    write_response = client.post("/api/customers", headers=read_headers, json={"customer_name": "Denied"})

    assert read_response.status_code == 200
    assert write_response.status_code == 403


def test_employee_and_attendance_manager_cannot_access_customers(client: TestClient, session_factory) -> None:
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    attendance_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    employee_response = client.get("/api/customers", headers=employee_headers)
    attendance_response = client.get("/api/customers", headers=attendance_headers)

    assert employee_response.status_code == 403
    assert attendance_response.status_code == 403


def test_create_customer_with_opening_balance_and_ledger(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers, opening_balance="100000")

    ledger_response = client.get(f"/api/customers/{customer['id']}/ledger", headers=headers)

    assert customer["current_balance"] == "100000.00"
    assert ledger_response.status_code == 200
    assert ledger_response.json()[0]["event_type"] == "OPENING_BALANCE"


def test_balance_adjustment_endpoint_appends_ledger_and_recomputes(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers, opening_balance="100000")

    response = client.post(
        f"/api/customers/{customer['id']}/balance-adjustments",
        headers=headers,
        json={"target_balance": "250000", "note": "manual correction"},
    )
    ledger_response = client.get(f"/api/customers/{customer['id']}/ledger", headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["customer"]["current_balance"] == "250000.00"
    assert body["ledger"]["event_type"] == "BALANCE_ADJUSTMENT"
    assert body["ledger"]["amount_delta"] == "150000.00"
    assert body["ledger"]["balance_after"] == "250000.00"
    assert body["ledger"]["note"] == "manual correction"
    assert [row["event_type"] for row in ledger_response.json()] == ["OPENING_BALANCE", "BALANCE_ADJUSTMENT"]


def test_read_only_cannot_create_balance_adjustment(client: TestClient, session_factory) -> None:
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    customer = create_customer(client, owner_headers, opening_balance="100000")

    response = client.post(
        f"/api/customers/{customer['id']}/balance-adjustments",
        headers=read_headers,
        json={"target_balance": "250000"},
    )

    assert response.status_code == 403


def test_list_excludes_inactive_by_default_and_get_customer(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    active = create_customer(client, headers, "Active")
    inactive = create_customer(client, headers, "Inactive", opening_balance="1")

    delete_response = client.delete(f"/api/customers/{inactive['id']}", headers=headers)
    default_response = client.get("/api/customers", headers=headers)
    inactive_response = client.get("/api/customers", headers=headers, params={"include_inactive": True})
    get_response = client.get(f"/api/customers/{active['id']}", headers=headers)

    assert delete_response.json()["action"] == "deactivated"
    assert [customer["id"] for customer in default_response.json()] == [active["id"]]
    assert {customer["id"] for customer in inactive_response.json()} == {active["id"], inactive["id"]}
    assert get_response.json()["id"] == active["id"]


def test_patch_customer_profile_and_clear_note(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ADMIN)
    customer = create_customer(client, headers, "Customer")

    response = client.patch(
        f"/api/customers/{customer['id']}",
        headers=headers,
        json={"customer_name": "New Name", "phone": "0909", "address": " ", "note": " "},
    )

    assert response.status_code == 200
    assert response.json()["customer_name"] == "New Name"
    assert response.json()["phone"] == "0909"
    assert response.json()["address"] is None
    assert response.json()["note"] is None


def test_debt_payment_create_edit_delete_recomputes_balance(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers, opening_balance="100000")

    create_response = client.post(
        f"/api/customers/{customer['id']}/debt-payments",
        headers=headers,
        json={"amount": "30000", "note": "cash"},
    )
    payment_id = create_response.json()["payment"]["id"]
    assert create_response.status_code == 201
    assert create_response.json()["current_balance"] == "70000.00"

    edit_response = client.patch(
        f"/api/customers/{customer['id']}/debt-payments/{payment_id}",
        headers=headers,
        json={"amount": "40000", "note": "edited"},
    )
    ledger_response = client.get(f"/api/customers/{customer['id']}/ledger", headers=headers)
    assert edit_response.status_code == 200
    assert edit_response.json()["current_balance"] == "60000.00"
    assert [row["event_type"] for row in ledger_response.json()] == [
        "OPENING_BALANCE",
        "DEBT_PAYMENT",
        "DEBT_PAYMENT_EDIT_ROLLBACK",
        "DEBT_PAYMENT",
    ]

    delete_response = client.delete(f"/api/customers/{customer['id']}/debt-payments/{payment_id}", headers=headers)
    final_customer = client.get(f"/api/customers/{customer['id']}", headers=headers)
    final_ledger = client.get(f"/api/customers/{customer['id']}/ledger", headers=headers)

    assert delete_response.status_code == 204
    assert final_customer.json()["current_balance"] == "100000.00"
    assert [row["event_type"] for row in final_ledger.json()] == ["OPENING_BALANCE"]


def test_overpayment_can_make_balance_negative(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers, opening_balance="100")

    response = client.post(f"/api/customers/{customer['id']}/debt-payments", headers=headers, json={"amount": "150"})

    assert response.status_code == 201
    assert response.json()["current_balance"] == "-50.00"


def test_invalid_payment_amount_returns_validation_error(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers)

    response = client.post(f"/api/customers/{customer['id']}/debt-payments", headers=headers, json={"amount": "0"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_not_found_returns_404(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    response = client.get("/api/customers/999", headers=headers)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_list_debt_payments(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer = create_customer(client, headers, opening_balance="100")
    payment = client.post(f"/api/customers/{customer['id']}/debt-payments", headers=headers, json={"amount": "10"}).json()

    response = client.get(f"/api/customers/{customer['id']}/debt-payments", headers=headers)

    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [payment["payment"]["id"]]
