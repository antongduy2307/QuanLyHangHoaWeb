from __future__ import annotations

from collections.abc import Iterator

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.application.inventory_service import InventoryService
from app.domain.auth import UserRole
from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.base import Base
from app.main import app


def auth_headers(client: TestClient, session_factory, role: UserRole) -> dict[str, str]:
    username = f"{role.value}_attendance_cut_user"
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


def seed_product(session_factory, *, code: str, name: str, unit_mode: UnitMode = UnitMode.BAO_KG) -> int:
    with session_factory() as session:
        product = InventoryService().create_product(
            session,
            product_code_base=code,
            product_name=name,
            unit_mode=unit_mode,
            enabled_prices={UnitType.BAO: "100.00"} if unit_mode == UnitMode.BAO_KG else {UnitType.BICH: "5.00"},
        )
        session.commit()
        return product.id


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


def test_attendance_manager_can_search_products_and_create_cut_work_item(client, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)
    product_id = seed_product(session_factory, code="CUT-API-01", name="Bao API Search")

    search_response = client.get("/api/attendance/cut-products/search", headers=headers, params={"search": "CUT-API-01"})
    assert search_response.status_code == 200
    assert search_response.json()[0]["product_id"] == product_id
    assert search_response.json()[0]["is_configured_for_attendance"] is False

    create_response = client.post(
        "/api/attendance/cut-work-items/from-product",
        headers=headers,
        json={"product_id": product_id, "quota_quantity": "20", "excess_unit_price": "10000"},
    )
    assert create_response.status_code == 200
    assert create_response.json()["product_id"] == product_id
    assert create_response.json()["quota_quantity"] == "20.00"
    assert create_response.json()["excess_unit_price"] == "10000.00"

    listed = client.get("/api/attendance/cut-work-items", headers=headers, params={"search": "Bao API"})
    assert listed.status_code == 200
    assert listed.json()[0]["product_code_base"] == "CUT-API-01"


def test_unconfigured_product_returns_clear_validation_and_read_only_cannot_mutate(client, session_factory) -> None:
    manager_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)
    read_only_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    product_id = seed_product(session_factory, code="CUT-API-02", name="Bao Needs Config")

    invalid_response = client.post(
        "/api/attendance/cut-work-items/from-product",
        headers=manager_headers,
        json={"product_id": product_id},
    )
    denied_response = client.post(
        "/api/attendance/cut-work-items/from-product",
        headers=read_only_headers,
        json={"product_id": product_id, "quota_quantity": "25", "excess_unit_price": "3500"},
    )

    assert invalid_response.status_code == 422
    assert "not configured for attendance" in invalid_response.json()["error"]["message"]
    assert denied_response.status_code == 403
