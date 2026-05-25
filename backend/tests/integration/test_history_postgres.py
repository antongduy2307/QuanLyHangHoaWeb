from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
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


def _dt(year: int, month: int, day: int, hour: int, minute: int) -> str:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc).isoformat()


def _auth_headers(pg_client: TestClient, postgres_session: Session, role: UserRole = UserRole.OWNER) -> dict[str, str]:
    suffix = uuid4().hex[:10]
    username = f"{role.value}_history_pg_{suffix}"
    password = "strong-password"
    AuthService().create_user(
        postgres_session,
        username=username,
        password=password,
        display_name="History PG User",
        role=role,
    )
    postgres_session.commit()
    response = pg_client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_postgres_history_endpoint_returns_cross_source_rows(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product = pg_client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": f"HIS-PG-{uuid4().hex[:8]}",
            "product_name": "History PG Product",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
        },
    ).json()
    customer = pg_client.post(
        "/api/customers",
        headers=headers,
        json={"customer_name": "History PG Customer", "opening_balance": "0"},
    ).json()
    assert pg_client.post(
        "/api/sales/invoices",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "invoice_datetime": _dt(2026, 5, 22, 9, 0),
            "paid_amount": "0",
            "payment_method": "CASH",
            "items": [{"product_id": product["id"], "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
        },
    ).status_code == 201
    assert pg_client.post(
        f"/api/customers/{customer['id']}/debt-payments",
        headers=headers,
        json={"amount": "10.00", "payment_datetime": _dt(2026, 5, 22, 10, 0), "note": "PG payment"},
    ).status_code == 201
    assert pg_client.post(
        f"/api/inventory/products/{product['id']}/stock/set",
        headers=headers,
        json={"unit_type": "BAO", "target_quantity": "3", "adjustment_datetime": _dt(2026, 5, 22, 11, 0)},
    ).status_code == 200

    response = pg_client.get("/api/history", headers=headers)

    assert response.status_code == 200
    rows = response.json()["items"]
    assert any(row["event_type"] == "SALES_INVOICE" for row in rows)
    assert any(row["event_type"] == "DEBT_PAYMENT" for row in rows)
    assert any(row["event_type"] == "STOCK_MOVEMENT" and row["source_type"] == "stock_adjustment" for row in rows)
