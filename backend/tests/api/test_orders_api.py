from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.domain.auth import UserRole
from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger
from app.infrastructure.db.models.inventory import InventoryBalance
from app.infrastructure.db.models.sales import Invoice
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
    username = f"{role.value}_orders_user"
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


def seed_product(session_factory, *, code: str = "gao-orders", stock: str = "10") -> int:
    with session_factory() as session:
        service = InventoryService()
        product = service.create_product(
            session,
            product_code_base=code,
            product_name="Gao Orders",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: Decimal("100.00"), UnitType.KG: Decimal("10.00")},
        )
        service.increase_stock(session, product.id, Decimal(stock), UnitType.BAO)
        session.commit()
        return product.id


def seed_customer(session_factory, *, name: str = "Order Customer") -> int:
    with session_factory() as session:
        customer = CustomerService().create_customer(session, customer_name=name)
        session.commit()
        return customer.id


def order_payload(
    product_id: int,
    *,
    customer_id: int | None = None,
    quantity: str = "1",
    unit_type: str = "BAO",
    note: str | None = "Can giao som",
) -> dict:
    return {
        "customer_id": customer_id,
        "customer_snapshot_name": None if customer_id is not None else "",
        "order_datetime": datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc).isoformat(),
        "required_delivery_datetime": None,
        "items": [
            {
                "product_id": product_id,
                "unit_type": unit_type,
                "quantity": quantity,
            }
        ],
        "note": note,
    }


def get_balance(session_factory, product_id: int) -> Decimal:
    with session_factory() as session:
        balance = session.query(InventoryBalance).filter_by(product_id=product_id).one()
        return balance.on_hand_bao_decimal


def get_customer(session_factory, customer_id: int) -> Customer:
    with session_factory() as session:
        return session.get(Customer, customer_id)


def count_invoices(session_factory) -> int:
    with session_factory() as session:
        return len(session.scalars(select(Invoice)).all())


def count_ledgers(session_factory) -> int:
    with session_factory() as session:
        return len(session.scalars(select(CustomerBalanceLedger)).all())


def test_anonymous_and_invalid_orders_access_return_401(client: TestClient) -> None:
    anonymous = client.get("/api/orders")
    invalid = client.get("/api/orders", headers={"Authorization": "Bearer invalid-token"})

    assert anonymous.status_code == 401
    assert invalid.status_code == 401


def test_read_only_can_get_but_cannot_mutate_orders(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    order = client.post("/api/orders", headers=owner_headers, json=order_payload(product_id, customer_id=customer_id)).json()

    read_response = client.get("/api/orders", headers=read_headers)
    create_response = client.post("/api/orders", headers=read_headers, json=order_payload(product_id, customer_id=customer_id))
    patch_response = client.patch(
        f"/api/orders/{order['id']}",
        headers=read_headers,
        json=order_payload(product_id, customer_id=customer_id, quantity="2"),
    )
    delete_response = client.delete(f"/api/orders/{order['id']}", headers=read_headers)
    prepared_response = client.post(f"/api/orders/{order['id']}/prepared", headers=read_headers, json={"prepared": True})
    converted_response = client.post(f"/api/orders/{order['id']}/converted", headers=read_headers, json={"invoice_id": 99})

    assert read_response.status_code == 200
    assert create_response.status_code == 403
    assert patch_response.status_code == 403
    assert delete_response.status_code == 403
    assert prepared_response.status_code == 403
    assert converted_response.status_code == 403


def test_owner_and_admin_can_create_update_delete_toggle_and_convert_orders(client: TestClient, session_factory) -> None:
    owner_product_id = seed_product(session_factory, code="owner-order")
    admin_product_id = seed_product(session_factory, code="admin-order")
    owner_customer_id = seed_customer(session_factory, name="Owner Customer")
    admin_customer_id = seed_customer(session_factory, name="Admin Customer")

    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    admin_headers = auth_headers(client, session_factory, UserRole.ADMIN)

    owner_order = client.post("/api/orders", headers=owner_headers, json=order_payload(owner_product_id, customer_id=owner_customer_id)).json()
    admin_order = client.post("/api/orders", headers=admin_headers, json=order_payload(admin_product_id, customer_id=admin_customer_id)).json()

    owner_prepared = client.post(f"/api/orders/{owner_order['id']}/prepared", headers=owner_headers, json={"prepared": True})
    owner_updated = client.patch(
        f"/api/orders/{owner_order['id']}",
        headers=owner_headers,
        json=order_payload(owner_product_id, customer_id=owner_customer_id, quantity="2.5", note="Updated"),
    )
    admin_converted = client.post(f"/api/orders/{admin_order['id']}/converted", headers=admin_headers, json={"invoice_id": 51})
    owner_delete = client.delete(f"/api/orders/{owner_order['id']}", headers=owner_headers)

    assert owner_order["order_code"].startswith("DH20260521-")
    assert admin_order["order_code"].startswith("DH20260521-")
    assert owner_prepared.status_code == 200
    assert owner_prepared.json()["status"] == "PREPARED"
    assert owner_updated.status_code == 200
    assert Decimal(owner_updated.json()["items"][0]["quantity"]) == Decimal("2.500")
    assert owner_updated.json()["note"] == "Updated"
    assert admin_converted.status_code == 200
    assert admin_converted.json()["status"] == "CONVERTED"
    assert admin_converted.json()["source_invoice_id"] == 51
    assert owner_delete.status_code == 204


def test_employee_and_attendance_manager_cannot_access_orders(client: TestClient, session_factory) -> None:
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    attendance_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    employee_response = client.get("/api/orders", headers=employee_headers)
    attendance_response = client.get("/api/orders", headers=attendance_headers)

    assert employee_response.status_code == 403
    assert attendance_response.status_code == 403


def test_active_list_excludes_converted_orders(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    active_order = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id)).json()
    converted_order = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="2")).json()
    client.post(f"/api/orders/{converted_order['id']}/converted", headers=headers, json={"invoice_id": 77})

    response = client.get("/api/orders", headers=headers)

    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [active_order["id"]]


def test_quantity_summary_groups_active_orders_only(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="2", unit_type="BAO"))
    prepared = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="3", unit_type="BAO")).json()
    converted = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="4", unit_type="KG")).json()
    client.post(f"/api/orders/{prepared['id']}/prepared", headers=headers, json={"prepared": True})
    client.post(f"/api/orders/{converted['id']}/converted", headers=headers, json={"invoice_id": 88})

    response = client.get("/api/orders/quantity-summary", headers=headers)

    assert response.status_code == 200
    assert response.json() == [
        {
            "product_id": product_id,
            "product_name": "Gao Orders",
            "unit_type": "BAO",
            "quantity": "5.000",
            "stock_available": "10.000",
        }
    ]


def test_get_order_preserves_decimal_quantities(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    order = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="4.8")).json()

    response = client.get(f"/api/orders/{order['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json()["items"][0]["quantity"] == "4.800"


def test_converted_order_cannot_edit_or_delete_via_api(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    order = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id)).json()
    client.post(f"/api/orders/{order['id']}/converted", headers=headers, json={"invoice_id": 66})

    patch_response = client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json=order_payload(product_id, customer_id=customer_id, quantity="2"),
    )
    delete_response = client.delete(f"/api/orders/{order['id']}", headers=headers)

    assert patch_response.status_code == 422
    assert patch_response.json()["error"]["code"] == "validation_error"
    assert delete_response.status_code == 422
    assert delete_response.json()["error"]["code"] == "validation_error"


def test_order_api_has_no_stock_or_debt_side_effects(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory, stock="12")
    customer_id = seed_customer(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    create_response = client.post("/api/orders", headers=headers, json=order_payload(product_id, customer_id=customer_id, quantity="999"))
    order = create_response.json()
    client.patch(
        f"/api/orders/{order['id']}",
        headers=headers,
        json=order_payload(product_id, customer_id=customer_id, quantity="5"),
    )
    client.post(f"/api/orders/{order['id']}/prepared", headers=headers, json={"prepared": True})

    assert create_response.status_code == 201
    assert get_balance(session_factory, product_id) == Decimal("12.000")
    assert get_customer(session_factory, customer_id).current_balance == Decimal("0.00")
    assert count_invoices(session_factory) == 0
    assert count_ledgers(session_factory) == 0
