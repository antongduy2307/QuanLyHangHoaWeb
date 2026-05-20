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
    username = f"{role.value}_returns_user"
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


def seed_product(session_factory, *, code: str = "gao-returns", stock: str = "10") -> int:
    with session_factory() as session:
        service = InventoryService()
        product = service.create_product(
            session,
            product_code_base=code,
            product_name="Gao Returns",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: Decimal("100.00")},
        )
        service.increase_stock(session, product.id, Decimal(stock), UnitType.BAO)
        session.commit()
        return product.id


def seed_customer(session_factory, *, total_sales: str = "100") -> int:
    with session_factory() as session:
        customer = CustomerService().create_customer(
            session,
            customer_name="Return Customer",
            total_sales=Decimal(total_sales),
        )
        session.commit()
        return customer.id


def quick_return_payload(
    product_id: int,
    *,
    customer_id: int | None = None,
    handling_mode: str = "REFUND_NOW",
    quantity: str = "1",
) -> dict:
    return {
        "source_invoice_id": None,
        "customer_id": customer_id,
        "customer_snapshot_name": None if customer_id is not None else "Walk In",
        "return_datetime": datetime(2026, 1, 3, 10, 0, tzinfo=timezone.utc).isoformat(),
        "handling_mode": handling_mode,
        "items": [
            {
                "product_id": product_id,
                "unit_type": "BAO",
                "quantity": quantity,
                "unit_price": "100.00",
            }
        ],
    }


def invoice_payload(product_id: int, *, customer_id: int | None = None, quantity: str = "1", paid: str = "100") -> dict:
    return {
        "customer_id": customer_id,
        "customer_snapshot_name": None if customer_id is not None else "Walk In",
        "invoice_datetime": datetime(2026, 1, 2, 9, 0, tzinfo=timezone.utc).isoformat(),
        "paid_amount": paid,
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": quantity, "unit_price": "100.00"}],
    }


def linked_return_payload(invoice: dict, *, quantity: str = "1") -> dict:
    item = invoice["items"][0]
    return {
        "source_invoice_id": invoice["id"],
        "return_datetime": datetime(2026, 1, 4, 11, 0, tzinfo=timezone.utc).isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"source_invoice_item_id": item["id"], "unit_type": item["unit_type"], "quantity": quantity}],
    }


def get_balance(session_factory, product_id: int) -> Decimal:
    with session_factory() as session:
        balance = session.query(InventoryBalance).filter_by(product_id=product_id).one()
        return balance.on_hand_bao_decimal


def get_customer(session_factory, customer_id: int) -> Customer:
    with session_factory() as session:
        return session.get(Customer, customer_id)


def test_anonymous_and_invalid_returns_access_return_401(client: TestClient) -> None:
    anonymous = client.get("/api/returns")
    invalid = client.get("/api/returns", headers={"Authorization": "Bearer invalid-token"})

    assert anonymous.status_code == 401
    assert invalid.status_code == 401


def test_read_only_can_get_but_cannot_write_returns(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    return_invoice = client.post("/api/returns", headers=owner_headers, json=quick_return_payload(product_id)).json()

    read_response = client.get("/api/returns", headers=read_headers)
    create_response = client.post("/api/returns", headers=read_headers, json=quick_return_payload(product_id))
    patch_response = client.patch(
        f"/api/returns/{return_invoice['id']}",
        headers=read_headers,
        json=quick_return_payload(product_id, quantity="2"),
    )
    delete_response = client.delete(f"/api/returns/{return_invoice['id']}", headers=read_headers)

    assert read_response.status_code == 200
    assert create_response.status_code == 403
    assert patch_response.status_code == 403
    assert delete_response.status_code == 403


def test_owner_and_admin_can_create_return(client: TestClient, session_factory) -> None:
    owner_product_id = seed_product(session_factory, code="owner-return")
    admin_product_id = seed_product(session_factory, code="admin-return")

    owner_response = client.post(
        "/api/returns",
        headers=auth_headers(client, session_factory, UserRole.OWNER),
        json=quick_return_payload(owner_product_id),
    )
    admin_response = client.post(
        "/api/returns",
        headers=auth_headers(client, session_factory, UserRole.ADMIN),
        json=quick_return_payload(admin_product_id),
    )

    assert owner_response.status_code == 201
    assert admin_response.status_code == 201


def test_employee_and_attendance_manager_cannot_access_returns(client: TestClient, session_factory) -> None:
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    attendance_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    employee_response = client.get("/api/returns", headers=employee_headers)
    attendance_response = client.get("/api/returns", headers=attendance_headers)

    assert employee_response.status_code == 403
    assert attendance_response.status_code == 403


def test_create_quick_walk_in_refund_return(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    response = client.post("/api/returns", headers=headers, json=quick_return_payload(product_id))

    assert response.status_code == 201
    body = response.json()
    assert body["return_code"].startswith("TR20260103-")
    assert body["customer_id"] is None
    assert body["is_quick_return"] is True
    assert get_balance(session_factory, product_id) == Decimal("11.000")


def test_customer_store_credit_return_updates_balance_and_total_sales(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory, total_sales="100")
    headers = auth_headers(client, session_factory, UserRole.OWNER)

    response = client.post(
        "/api/returns",
        headers=headers,
        json=quick_return_payload(product_id, customer_id=customer_id, handling_mode="STORE_CREDIT"),
    )

    assert response.status_code == 201
    customer = get_customer(session_factory, customer_id)
    assert customer.current_balance == Decimal("-100.00")
    assert customer.total_sales == Decimal("0.00")


def test_linked_return_quantity_ceiling(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory, total_sales="100")
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, paid="100"),
    ).json()

    first_return = client.post("/api/returns", headers=headers, json=linked_return_payload(invoice, quantity="1"))
    second_return = client.post("/api/returns", headers=headers, json=linked_return_payload(invoice, quantity="1"))

    assert first_return.status_code == 201
    assert second_return.status_code == 422
    assert second_return.json()["error"]["code"] == "validation_error"


def test_patch_return_reapplies_effects(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    return_invoice = client.post("/api/returns", headers=headers, json=quick_return_payload(product_id)).json()

    response = client.patch(
        f"/api/returns/{return_invoice['id']}",
        headers=headers,
        json=quick_return_payload(product_id, quantity="2"),
    )

    assert response.status_code == 200
    assert response.json()["return_code"] == return_invoice["return_code"]
    assert get_balance(session_factory, product_id) == Decimal("12.000")


def test_delete_return_rolls_back_effects(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.ADMIN)
    return_invoice = client.post("/api/returns", headers=headers, json=quick_return_payload(product_id)).json()

    delete_response = client.delete(f"/api/returns/{return_invoice['id']}", headers=headers)
    get_response = client.get(f"/api/returns/{return_invoice['id']}", headers=headers)

    assert delete_response.status_code == 204
    assert get_response.status_code == 404
    assert get_balance(session_factory, product_id) == Decimal("10.000")


def test_get_and_list_returns(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    return_invoice = client.post("/api/returns", headers=headers, json=quick_return_payload(product_id)).json()

    get_response = client.get(f"/api/returns/{return_invoice['id']}", headers=headers)
    list_response = client.get("/api/returns", headers=headers)

    assert get_response.status_code == 200
    assert get_response.json()["id"] == return_invoice["id"]
    assert [row["id"] for row in list_response.json()] == [return_invoice["id"]]


def test_list_returns_supports_backend_search_and_date_filters(client: TestClient, session_factory) -> None:
    product_id = seed_product(session_factory)
    customer_id = seed_customer(session_factory, total_sales="200")
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    invoice = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product_id, customer_id=customer_id, quantity="2", paid="0"),
    ).json()
    older_payload = quick_return_payload(product_id, quantity="1")
    older_payload["customer_snapshot_name"] = "Khach Cu"
    older_payload["return_datetime"] = datetime(2025, 1, 1, 10, 0, tzinfo=timezone.utc).isoformat()
    older_return = client.post("/api/returns", headers=headers, json=older_payload).json()
    linked_return = client.post("/api/returns", headers=headers, json=linked_return_payload(invoice, quantity="1")).json()

    by_code = client.get("/api/returns?search=TR20260104", headers=headers)
    by_customer = client.get("/api/returns?search=return%20customer", headers=headers)
    by_invoice = client.get(f"/api/returns?search={invoice['invoice_code']}", headers=headers)
    by_date = client.get(
        "/api/returns?date_from=2026-01-01T00:00:00%2B00:00&date_to=2026-12-31T23:59:59%2B00:00",
        headers=headers,
    )

    assert by_code.status_code == 200
    assert [row["id"] for row in by_code.json()] == [linked_return["id"]]
    assert [row["id"] for row in by_customer.json()] == [linked_return["id"]]
    assert [row["id"] for row in by_invoice.json()] == [linked_return["id"]]
    assert [row["id"] for row in by_date.json()] == [linked_return["id"]]
    assert older_return["id"] != linked_return["id"]
