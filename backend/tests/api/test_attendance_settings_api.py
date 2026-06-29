from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
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
    username = f"{role.value}_attendance_settings_user"
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


def test_attendance_manager_can_create_update_and_deactivate_work_type(client, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    created = client.post(
        "/api/attendance/work-types",
        headers=headers,
        json={
            "name": "Sample Blow",
            "input_type": "quantity",
            "pricing_rule": "quantity_full",
            "quota_quantity": None,
            "unit_price": "65000",
            "exclusive_group": None,
            "is_active": True,
        },
    )
    assert created.status_code == 201
    work_type_id = created.json()["id"]

    updated = client.patch(
        f"/api/attendance/work-types/{work_type_id}",
        headers=headers,
        json={
            "name": "Sample Blow Updated",
            "input_type": "quantity",
            "pricing_rule": "quantity_excess_over_quota",
            "quota_quantity": "3",
            "unit_price": "70000",
            "exclusive_group": "glove",
            "is_active": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Sample Blow Updated"
    assert updated.json()["pricing_rule"] == "quantity_excess_over_quota"
    assert updated.json()["is_active"] is False


def test_read_only_cannot_mutate_attendance_settings_but_can_view(client, session_factory) -> None:
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_only_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)

    created = client.post(
        "/api/attendance/work-types",
        headers=owner_headers,
        json={
            "name": "Read Only Guard",
            "input_type": "tick",
            "pricing_rule": "flat_tick",
            "quota_quantity": None,
            "unit_price": "30000",
            "exclusive_group": None,
            "is_active": True,
        },
    )
    work_type_id = created.json()["id"]

    listed = client.get("/api/attendance/work-types?include_inactive=true", headers=read_only_headers)
    denied = client.patch(
        f"/api/attendance/work-types/{work_type_id}",
        headers=read_only_headers,
        json={
            "name": "Denied",
            "input_type": "tick",
            "pricing_rule": "flat_tick",
            "quota_quantity": None,
            "unit_price": "30000",
            "exclusive_group": None,
            "is_active": True,
        },
    )

    assert listed.status_code == 200
    assert denied.status_code == 403


def test_attendance_manager_can_create_and_update_cut_work_item_linked_to_product(client, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)
    product_id = seed_product(session_factory, code="SETTINGS-CUT-01", name="Settings Cut Product")

    created = client.post(
        "/api/attendance/cut-work-items/from-product",
        headers=headers,
        json={"product_id": product_id, "quota_quantity": "20", "excess_unit_price": "10000"},
    )
    assert created.status_code == 200
    bag_type_id = created.json()["id"]
    assert created.json()["product_id"] == product_id

    updated = client.patch(
        f"/api/attendance/cut-work-items/{bag_type_id}",
        headers=headers,
        json={
            "name": "Settings Cut Product",
            "product_id": product_id,
            "source_product_name_snapshot": "Settings Cut Product",
            "quota_quantity": "25",
            "excess_unit_price": "12000",
            "is_active": True,
            "is_product_linked": True,
            "is_excluded_from_attendance": True,
            "is_legacy": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["quota_quantity"] == "25.00"
    assert updated.json()["excess_unit_price"] == "12000.00"
    assert updated.json()["is_excluded_from_attendance"] is True
