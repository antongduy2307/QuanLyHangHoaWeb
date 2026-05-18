from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.domain.auth import UserRole
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger
from app.infrastructure.db.models.inventory import InventoryBalance, Product
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


def _create_user(postgres_session: Session, role: UserRole) -> tuple[str, str]:
    suffix = uuid4().hex[:10]
    username = f"{role.value}_pg_api_{suffix}"
    password = "strong-password"
    AuthService().create_user(
        postgres_session,
        username=username,
        password=password,
        display_name=f"{role.value} API Smoke",
        role=role,
    )
    postgres_session.commit()
    return username, password


def _auth_headers(pg_client: TestClient, postgres_session: Session, role: UserRole) -> dict[str, str]:
    username, password = _create_user(postgres_session, role)
    response = pg_client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _product_payload(code: str) -> dict:
    return {
        "product_code_base": code,
        "product_name": f"Postgres Product {code}",
        "unit_mode": "BAO_KG",
        "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
    }


def _customer_payload(name: str, opening_balance: str = "0") -> dict:
    return {
        "customer_name": name,
        "opening_balance": opening_balance,
        "total_sales": "0",
    }


def _invoice_payload(product_id: int, customer_id: int, *, paid_amount: str = "0") -> dict:
    return {
        "customer_id": customer_id,
        "invoice_datetime": datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc).isoformat(),
        "paid_amount": paid_amount,
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
    }


def _linked_return_payload(invoice: dict) -> dict:
    item = invoice["items"][0]
    return {
        "source_invoice_id": invoice["id"],
        "return_datetime": datetime(2026, 5, 17, 10, 0, tzinfo=timezone.utc).isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"source_invoice_item_id": item["id"], "unit_type": item["unit_type"], "quantity": "1"}],
    }


def test_postgres_auth_login_and_me(pg_client: TestClient, postgres_session: Session) -> None:
    username, password = _create_user(postgres_session, UserRole.OWNER)

    login = pg_client.post("/api/auth/login", json={"username": username, "password": password})
    me = pg_client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})

    assert login.status_code == 200
    assert me.status_code == 200
    assert me.json()["username"] == username
    assert me.json()["role"] == UserRole.OWNER.value


def test_postgres_protected_inventory_and_customer_routes(pg_client: TestClient, postgres_session: Session) -> None:
    owner_headers = _auth_headers(pg_client, postgres_session, UserRole.OWNER)
    admin_headers = _auth_headers(pg_client, postgres_session, UserRole.ADMIN)
    read_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)
    suffix = uuid4().hex[:8]

    product_response = pg_client.post(
        "/api/inventory/products",
        headers=owner_headers,
        json=_product_payload(f"pg-api-{suffix}"),
    )
    assert product_response.status_code == 201
    product = product_response.json()

    customer_response = pg_client.post(
        "/api/customers",
        headers=admin_headers,
        json=_customer_payload(f"Postgres Customer {suffix}", opening_balance="100"),
    )
    assert customer_response.status_code == 201
    customer = customer_response.json()

    assert pg_client.get("/api/inventory/products", headers=read_headers).status_code == 200
    assert pg_client.get(f"/api/inventory/products/{product['id']}", headers=read_headers).status_code == 200
    assert pg_client.post("/api/inventory/products", headers=read_headers, json=_product_payload(f"deny-{suffix}")).status_code == 403
    assert pg_client.patch(
        f"/api/inventory/products/{product['id']}",
        headers=read_headers,
        json={"product_name": "Denied", "prices": [{"unit_type": "BAO", "price": "100", "is_enabled": True}]},
    ).status_code == 403
    assert pg_client.delete(f"/api/inventory/products/{product['id']}", headers=read_headers).status_code == 403
    assert pg_client.get("/api/inventory/products", headers=employee_headers).status_code == 403

    assert pg_client.get("/api/customers", headers=read_headers).status_code == 200
    assert pg_client.get(f"/api/customers/{customer['id']}", headers=read_headers).status_code == 200
    assert pg_client.post("/api/customers", headers=read_headers, json=_customer_payload("Denied")).status_code == 403
    assert pg_client.patch(
        f"/api/customers/{customer['id']}",
        headers=read_headers,
        json={"customer_name": "Denied"},
    ).status_code == 403
    assert pg_client.delete(f"/api/customers/{customer['id']}", headers=read_headers).status_code == 403
    assert pg_client.get("/api/customers", headers=employee_headers).status_code == 403

    stored_product = postgres_session.get(Product, product["id"])
    stored_customer = postgres_session.get(Customer, customer["id"])
    ledger_rows = postgres_session.scalars(
        select(CustomerBalanceLedger).where(CustomerBalanceLedger.customer_id == customer["id"])
    ).all()
    assert stored_product is not None
    assert stored_product.product_code_base == f"PG-API-{suffix.upper()}"
    assert stored_customer is not None
    assert stored_customer.current_balance == 100
    assert [row.event_type for row in ledger_rows] == ["OPENING_BALANCE"]


def test_postgres_protected_sales_route_effects(pg_client: TestClient, postgres_session: Session) -> None:
    owner_headers = _auth_headers(pg_client, postgres_session, UserRole.OWNER)
    read_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)
    suffix = uuid4().hex[:8]
    product = pg_client.post(
        "/api/inventory/products",
        headers=owner_headers,
        json=_product_payload(f"pg-sale-{suffix}"),
    ).json()
    pg_client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=owner_headers,
        json={"unit_type": "BAO", "quantity": "3"},
    )
    customer = pg_client.post(
        "/api/customers",
        headers=owner_headers,
        json=_customer_payload(f"Postgres Sale Customer {suffix}"),
    ).json()

    invoice_response = pg_client.post(
        "/api/sales/invoices",
        headers=owner_headers,
        json=_invoice_payload(product["id"], customer["id"], paid_amount="25"),
    )
    assert invoice_response.status_code == 201
    invoice = invoice_response.json()

    assert pg_client.get(f"/api/sales/invoices/{invoice['id']}", headers=read_headers).status_code == 200
    assert pg_client.post("/api/sales/invoices", headers=read_headers, json=_invoice_payload(product["id"], customer["id"])).status_code == 403
    assert pg_client.patch(
        f"/api/sales/invoices/{invoice['id']}",
        headers=read_headers,
        json=_invoice_payload(product["id"], customer["id"]),
    ).status_code == 403
    assert pg_client.delete(f"/api/sales/invoices/{invoice['id']}", headers=read_headers).status_code == 403
    assert pg_client.get("/api/sales/invoices", headers=employee_headers).status_code == 403

    balance = postgres_session.scalars(
        select(InventoryBalance).where(InventoryBalance.product_id == product["id"])
    ).one()
    stored_customer = postgres_session.get(Customer, customer["id"])
    ledger_events = [
        row.event_type
        for row in postgres_session.scalars(
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer["id"])
            .order_by(CustomerBalanceLedger.display_order, CustomerBalanceLedger.id)
        ).all()
    ]
    assert balance.on_hand_bao_decimal == 2
    assert stored_customer.current_balance == 75
    assert ledger_events == ["INVOICE_CHARGE", "DEBT_PAYMENT"]


def test_postgres_protected_returns_route_effects(pg_client: TestClient, postgres_session: Session) -> None:
    owner_headers = _auth_headers(pg_client, postgres_session, UserRole.OWNER)
    read_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)
    suffix = uuid4().hex[:8]
    product = pg_client.post(
        "/api/inventory/products",
        headers=owner_headers,
        json=_product_payload(f"pg-return-{suffix}"),
    ).json()
    pg_client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=owner_headers,
        json={"unit_type": "BAO", "quantity": "3"},
    )
    customer = pg_client.post(
        "/api/customers",
        headers=owner_headers,
        json={"customer_name": f"Postgres Return Customer {suffix}", "opening_balance": "0", "total_sales": "100"},
    ).json()
    invoice = pg_client.post(
        "/api/sales/invoices",
        headers=owner_headers,
        json=_invoice_payload(product["id"], customer["id"], paid_amount="0"),
    ).json()

    return_response = pg_client.post("/api/returns", headers=owner_headers, json=_linked_return_payload(invoice))
    assert return_response.status_code == 201
    return_invoice = return_response.json()

    assert pg_client.get(f"/api/returns/{return_invoice['id']}", headers=read_headers).status_code == 200
    assert pg_client.post("/api/returns", headers=read_headers, json=_linked_return_payload(invoice)).status_code == 403
    assert pg_client.patch(
        f"/api/returns/{return_invoice['id']}",
        headers=read_headers,
        json=_linked_return_payload(invoice),
    ).status_code == 403
    assert pg_client.delete(f"/api/returns/{return_invoice['id']}", headers=read_headers).status_code == 403
    assert pg_client.get("/api/returns", headers=employee_headers).status_code == 403

    balance = postgres_session.scalars(
        select(InventoryBalance).where(InventoryBalance.product_id == product["id"])
    ).one()
    stored_customer = postgres_session.get(Customer, customer["id"])
    ledger_events = [
        row.event_type
        for row in postgres_session.scalars(
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer["id"])
            .order_by(CustomerBalanceLedger.display_order, CustomerBalanceLedger.id)
        ).all()
    ]
    assert balance.on_hand_bao_decimal == 3
    assert stored_customer.current_balance == 0
    assert stored_customer.total_sales == 100
    assert ledger_events == ["INVOICE_CHARGE", "RETURN_REFUND_NOW"]
