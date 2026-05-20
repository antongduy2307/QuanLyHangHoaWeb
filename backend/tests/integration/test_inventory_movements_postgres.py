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
from app.infrastructure.db.models.inventory import StockAdjustment
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


def _auth_headers(pg_client: TestClient, postgres_session: Session, role: UserRole = UserRole.OWNER) -> dict[str, str]:
    suffix = uuid4().hex[:10]
    username = f"{role.value}_inventory_movements_pg_{suffix}"
    password = "strong-password"
    AuthService().create_user(
        postgres_session,
        username=username,
        password=password,
        display_name="Inventory Movements PG Owner",
        role=role,
    )
    postgres_session.commit()
    response = pg_client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_product(pg_client: TestClient, headers: dict[str, str]) -> int:
    suffix = uuid4().hex[:8].upper()
    response = pg_client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": f"MOV-PG-{suffix}",
            "product_name": f"Movement PG {suffix}",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _invoice_payload(product_id: int) -> dict:
    return {
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "invoice_datetime": datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc).isoformat(),
        "paid_amount": "100.00",
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
    }


def _return_payload(product_id: int) -> dict:
    return {
        "source_invoice_id": None,
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "return_datetime": datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc).isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
    }


def test_postgres_mixed_inventory_movements_do_not_union_text_and_numeric(
    pg_client: TestClient,
    postgres_session: Session,
) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product_id = _create_product(pg_client, headers)
    sale_response = pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id))
    return_response = pg_client.post("/api/returns", headers=headers, json=_return_payload(product_id))
    stock_response = pg_client.post(
        f"/api/inventory/products/{product_id}/stock/increase",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "2", "note": "Nhap bo sung"},
    )
    assert sale_response.status_code == 201
    assert return_response.status_code == 201
    assert stock_response.status_code == 200

    adjustment = postgres_session.scalars(
        select(StockAdjustment).where(StockAdjustment.product_id == product_id)
    ).one()
    adjustment.adjustment_datetime = datetime(2026, 5, 19, 9, 0, tzinfo=timezone.utc)
    postgres_session.commit()

    response = pg_client.get(f"/api/inventory/products/{product_id}/movements", headers=headers)

    assert response.status_code == 200
    rows = response.json()
    assert [row["movement_type"] for row in rows] == ["STOCK_INCREASE", "RETURN", "SALE"]
    assert rows[0]["source_type"] == "stock_adjustment"
    assert rows[0]["balance_after"] == "2.000"
    assert rows[1]["source_type"] == "return"
    assert rows[1]["balance_after"] is None
    assert rows[2]["source_type"] == "invoice"
    assert rows[2]["balance_after"] is None


def test_postgres_inventory_movements_protected_api_smoke(
    pg_client: TestClient,
    postgres_session: Session,
) -> None:
    owner_headers = _auth_headers(pg_client, postgres_session, UserRole.OWNER)
    read_only_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)
    product_id = _create_product(pg_client, owner_headers)
    assert pg_client.post(
        f"/api/inventory/products/{product_id}/stock/increase",
        headers=owner_headers,
        json={"unit_type": "BAO", "quantity": "1", "note": "Smoke"},
    ).status_code == 200

    read_response = pg_client.get(f"/api/inventory/products/{product_id}/movements", headers=read_only_headers)
    employee_response = pg_client.get(f"/api/inventory/products/{product_id}/movements", headers=employee_headers)

    assert read_response.status_code == 200
    assert read_response.json()[0]["movement_type"] == "STOCK_INCREASE"
    assert employee_response.status_code == 403
