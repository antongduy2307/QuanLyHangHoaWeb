from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.deps as api_deps
from app.api.deps import get_session
from app.core.config import Settings
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
def client(session_factory, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(api_deps, "get_settings", lambda: Settings(APP_ENV="local", AUTH_BYPASS=True))

    def override_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_local_auth_bypass_can_create_product_customer_and_invoice_without_token(client: TestClient) -> None:
    product_response = client.post(
        "/api/inventory/products",
        json={
            "product_code_base": "local-smoke",
            "product_name": "Local Smoke Product",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
        },
    )
    customer_response = client.post(
        "/api/customers",
        json={"customer_name": "Local Smoke Customer", "opening_balance": "0"},
    )

    assert product_response.status_code == 201
    assert customer_response.status_code == 201

    invoice_response = client.post(
        "/api/sales/invoices",
        json={
            "customer_id": customer_response.json()["id"],
            "customer_snapshot_name": None,
            "invoice_datetime": datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc).isoformat(),
            "paid_amount": "100.00",
            "payment_method": "CASH",
            "items": [
                {
                    "product_id": product_response.json()["id"],
                    "unit_type": "BAO",
                    "quantity": "1",
                    "unit_price": "100.00",
                }
            ],
        },
    )

    assert invoice_response.status_code == 201
    assert invoice_response.json()["customer_id"] == customer_response.json()["id"]
