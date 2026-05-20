from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.domain.auth import UserRole
from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import Customer
from app.infrastructure.db.models.inventory import InventoryBalance
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
    username = f"{role.value}_sales_user"
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


def seed_product(session_factory, *, code: str = "gao-sales", stock: str = "10") -> int:
    with session_factory() as session:
        service = InventoryService()
        product = service.create_product(
            session,
            product_code_base=code,
            product_name="Gao Sales",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: Decimal("100.00")},
        )
        service.increase_stock(session, product.id, Decimal(stock), UnitType.BAO)
        session.commit()
        return product.id


def seed_customer(session_factory, *, name: str = "Customer", total_sales: str = "0") -> int:
    with session_factory() as session:
        customer = CustomerService().create_customer(
            session,
            customer_name=name,
            total_sales=Decimal(total_sales),
        )
        session.commit()
        return customer.id


def invoice_payload(product_id: int, *, customer_id: int | None = None, quantity: str = "1", paid: str = "100") -> dict:
    return {
        "customer_id": customer_id,
        "customer_snapshot_name": None if customer_id is not None else "Walk In",
        "invoice_datetime": datetime(2026, 1, 2, 9, 0, tzinfo=timezone.utc).isoformat(),
        "paid_amount": paid,
        "payment_method": "CASH",
        "items": [
            {
                "product_id": product_id,
                "unit_type": "BAO",
                "quantity": quantity,
                "unit_price": "100.00",
            }
        ],
    }


def get_balance(session_factory, product_id: int) -> Decimal:
    with session_factory() as session:
        balance = session.query(InventoryBalance).filter_by(product_id=product_id).one()
        return balance.on_hand_bao_decimal


def get_customer(session_factory, customer_id: int) -> Customer:
    with session_factory() as session:
        return session.get(Customer, customer_id)


def test_anonymous_and_invalid_sales_access_return_401(client: TestClient) -> None:
    anonymous = client.get("/api/sales/invoices")
    invalid = client.get("/api/sales/invoices", headers={"Authorization": "Bearer invalid-token"})

    assert anonymous.status_code == 401
    assert invalid.status_code == 401


def test_read_only_can_get_but_cannot_write_sales(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    invoice = client.post("/api/sales/invoices", headers=owner_headers, json=invoice_payload(product_id)).json()

    read_response = client.get("/api/sales/invoices", headers=read_headers)
    create_response = client.post("/api/sales/invoices", headers=read_headers, json=invoice_payload(product_id))
    patch_response = client.patch(
        f"/api/sales/invoices/{invoice['id']}",
        headers=read_headers,
        json=invoice_payload(product_id, quantity="2", paid="200"),
    )
    delete_response = client.delete(f"/api/sales/invoices/{invoice['id']}", headers=read_headers)

    assert read_response.status_code == 200
    assert create_response.status_code == 403
    assert patch_response.status_code == 403
    assert delete_response.status_code == 403


def test_owner_and_admin_can_create_invoice(client: TestClient, session_factory) -> None:
    owner_product_id = seed_product(session_factory, code="owner-product")
    admin_product_id = seed_product(session_factory, code="admin-product")

    owner_response = client.post(
        "/api/sales/invoices",
        headers=auth_headers(client, session_factory, UserRole.OWNER),
        json=invoice_payload(owner_product_id),
    )
    admin_response = client.post(
        "/api/sales/invoices",
        headers=auth_headers(client, session_factory, UserRole.ADMIN),
        json=invoice_payload(admin_product_id),
    )

    assert owner_response.status_code == 201
    assert admin_response.status_code == 201


def test_employee_and_attendance_manager_cannot_access_sales(client: TestClient, session_factory) -> None:
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    attendance_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    employee_response = client.get("/api/sales/invoices", headers=employee_headers)
    attendance_response = client.get("/api/sales/invoices", headers=attendance_headers)

    assert employee_response.status_code == 403
    assert attendance_response.status_code == 403


def test_create_walk_in_fully_paid_invoice(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    response = client.post("/api/sales/invoices", headers=headers, json=invoice_payload(product_id))

    assert response.status_code == 201
    body = response.json()
    assert body["invoice_code"].startswith("HD20260102-")
    assert body["customer_id"] is None
    assert body["total_amount"] == "100.00"
    assert body["items"][0]["product_code_snapshot"] == "GAO-SALES"


def test_reject_unpaid_walk_in_invoice(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    response = client.post("/api/sales/invoices", headers=headers, json=invoice_payload(product_id, paid="0"))

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_customer_invoice_updates_stock_and_customer_ledger(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    response = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="20"),
    )
    ledger_response = client.get(f"/api/customers/{customer_id}/ledger", headers=headers)

    assert response.status_code == 201
    assert get_balance(session_factory, product_id) == Decimal("9.000")
    assert get_customer(session_factory, customer_id).current_balance == Decimal("80.00")
    assert [row["event_type"] for row in ledger_response.json()] == ["INVOICE_CHARGE", "DEBT_PAYMENT"]


def test_patch_invoice_reapplies_effects(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="0"),
    ).json()

    response = client.patch(
        f"/api/sales/invoices/{invoice['id']}",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, quantity="2", paid="50"),
    )

    assert response.status_code == 200
    assert response.json()["invoice_code"] == invoice["invoice_code"]
    assert get_balance(session_factory, product_id) == Decimal("8.000")
    assert get_customer(session_factory, customer_id).current_balance == Decimal("150.00")


def test_patch_invoice_preserves_paid_amount_when_omitted(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="20"),
    ).json()
    payload = invoice_payload(product_id, customer_id=customer_id, quantity="2", paid="999")
    payload.pop("paid_amount")

    response = client.patch(f"/api/sales/invoices/{invoice['id']}", headers=headers, json=payload)

    assert response.status_code == 200
    assert response.json()["paid_amount"] == "20.00"
    assert response.json()["total_amount"] == "200.00"


def test_delete_invoice_rolls_back_effects(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.ADMIN)
    invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="25"),
    ).json()

    delete_response = client.delete(f"/api/sales/invoices/{invoice['id']}", headers=headers)
    get_response = client.get(f"/api/sales/invoices/{invoice['id']}", headers=headers)

    assert delete_response.status_code == 204
    assert get_response.status_code == 404
    assert get_balance(session_factory, product_id) == Decimal("10.000")
    assert get_customer(session_factory, customer_id).current_balance == Decimal("0.00")


def test_get_and_list_invoices(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    invoice = client.post("/api/sales/invoices", headers=headers, json=invoice_payload(product_id)).json()

    get_response = client.get(f"/api/sales/invoices/{invoice['id']}", headers=headers)
    list_response = client.get("/api/sales/invoices", headers=headers)

    assert get_response.status_code == 200
    assert get_response.json()["id"] == invoice["id"]
    assert [row["id"] for row in list_response.json()] == [invoice["id"]]


def test_list_invoices_searches_code_and_customer_snapshot(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory, name="Cong ty Minh Anh")
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    customer_invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="0"),
    ).json()
    walk_in_invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json={**invoice_payload(product_id), "customer_snapshot_name": "Khach le"},
    ).json()

    code_response = client.get("/api/sales/invoices", headers=headers, params={"search": customer_invoice["invoice_code"]})
    customer_response = client.get("/api/sales/invoices", headers=headers, params={"search": "Minh Anh"})
    miss_response = client.get("/api/sales/invoices", headers=headers, params={"search": "Khong Co"})

    assert [row["id"] for row in code_response.json()] == [customer_invoice["id"]]
    assert [row["id"] for row in customer_response.json()] == [customer_invoice["id"]]
    assert miss_response.json() == []
    assert walk_in_invoice["id"] not in {row["id"] for row in customer_response.json()}
