from __future__ import annotations

from collections.abc import Iterator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.attendance_service import AttendanceConfigService
from app.application.auth_service import AuthService
from app.application.inventory_service import InventoryService
from app.domain.attendance import GLOVE_EXCLUSIVE_GROUP, AttendanceWorkInputType, AttendanceWorkPricingRule
from app.domain.auth import UserRole
from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.base import Base
from app.main import app


def auth_headers(client: TestClient, session_factory, role: UserRole = UserRole.OWNER) -> dict[str, str]:
    username = f"{role.value}_attendance_user"
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


def create_attendance_employee(client: TestClient, headers: dict[str, str], *, display_name: str, team: str, is_active: bool = True) -> dict:
    response = client.post(
        "/api/attendance/employees",
        headers=headers,
        json={"display_name": display_name, "team": team, "is_active": is_active},
    )
    assert response.status_code == 201
    return response.json()


def seed_blow_work_type(
    session_factory,
    *,
    name: str,
    input_type: AttendanceWorkInputType,
    pricing_rule: AttendanceWorkPricingRule,
    unit_price,
    quota_quantity=None,
    exclusive_group=None,
) -> int:
    with session_factory() as session:
        row = AttendanceConfigService().create_work_type(
            session,
            name=name,
            input_type=input_type,
            pricing_rule=pricing_rule,
            unit_price=unit_price,
            quota_quantity=quota_quantity,
            exclusive_group=exclusive_group,
        )
        session.commit()
        return row.id


def seed_bag_type(session_factory, *, name: str, quota_quantity, excess_unit_price, is_product_linked: bool = True) -> int:
    with session_factory() as session:
        product_id = None
        if is_product_linked:
            product = InventoryService().create_product(
                session,
                product_code_base=f"{name}-code",
                product_name=f"{name} Product",
                unit_mode=UnitMode.BAO_KG,
                enabled_prices={UnitType.BAO: "100.00"},
            )
            product_id = product.id
        row = AttendanceConfigService().create_bag_type(
            session,
            name=name,
            quota_quantity=quota_quantity,
            excess_unit_price=excess_unit_price,
            is_product_linked=is_product_linked,
            product_id=product_id,
            source_product_name_snapshot=f"{name} Product" if product_id is not None else None,
        )
        session.commit()
        return row.id


def test_attendance_reference_returns_teams_and_statuses(client, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    response = client.get("/api/attendance/reference", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"teams": ["blow", "cut"], "record_statuses": ["draft", "done"]}


def test_attendance_manager_can_seed_default_blow_work_types_and_read_only_cannot(client, session_factory) -> None:
    manager_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)

    seeded = client.post("/api/attendance/work-types/seed-defaults", headers=manager_headers)
    denied = client.post("/api/attendance/work-types/seed-defaults", headers=read_headers)
    listed = client.get("/api/attendance/work-types", headers=manager_headers)

    assert seeded.status_code == 200
    assert seeded.json()["created_count"] == 6
    assert seeded.json()["created_names"] == [
        "Thừa máy",
        "Máy nhỏ",
        "Máy to",
        "Phụ cắt",
        "Phụ găng 1 máy",
        "Phụ găng 2 máy",
    ]
    assert denied.status_code == 403
    assert [row["name"] for row in listed.json()] == [
        "Thừa máy",
        "Máy nhỏ",
        "Máy to",
        "Phụ cắt",
        "Phụ găng 1 máy",
        "Phụ găng 2 máy",
    ]


def test_employee_permissions_and_filters(client, session_factory) -> None:
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    created = create_attendance_employee(client, owner_headers, display_name="Alpha Worker", team="blow")
    create_attendance_employee(client, owner_headers, display_name="Beta Worker", team="cut", is_active=False)

    assert client.get("/api/attendance/employees", headers=read_headers).status_code == 200
    assert client.post("/api/attendance/employees", headers=read_headers, json={"display_name": "Denied", "team": "blow"}).status_code == 403
    assert client.get("/api/attendance/employees", headers=employee_headers).status_code == 403
    assert client.get(f"/api/attendance/employees/{created['id']}", headers=owner_headers).status_code == 200

    filtered = client.get(
        "/api/attendance/employees",
        headers=owner_headers,
        params={"search": "Alpha", "team": "blow", "include_inactive": "true"},
    )
    assert filtered.status_code == 200
    assert [row["display_name"] for row in filtered.json()] == ["Alpha Worker"]


def test_day_entry_core_behaviors_and_diagnostics(client, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)
    blow_employee = create_attendance_employee(client, headers, display_name="Blow Rules", team="blow")
    cut_employee = create_attendance_employee(client, headers, display_name="Cut Rules", team="cut")

    qty_type_id = seed_blow_work_type(
        session_factory,
        name="Máy nhỏ",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )
    thua_may_id = seed_blow_work_type(
        session_factory,
        name="Thừa máy",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA,
        unit_price=30000,
        quota_quantity=3,
    )
    glove_1_id = seed_blow_work_type(
        session_factory,
        name="Phụ găng 1 máy",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=30000,
        exclusive_group=GLOVE_EXCLUSIVE_GROUP,
    )
    glove_2_id = seed_blow_work_type(
        session_factory,
        name="Phụ găng 2 máy",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=50000,
        exclusive_group=GLOVE_EXCLUSIVE_GROUP,
    )
    bag_25_id = seed_bag_type(session_factory, name="Bao 25kg", quota_quantity=20, excess_unit_price=10000)
    bag_50_id = seed_bag_type(session_factory, name="Bao 50kg", quota_quantity=30, excess_unit_price=20000)

    day_list = client.get("/api/attendance/day-entry", headers=headers, params={"date": "2026-05-06"})
    assert day_list.status_code == 200
    assert day_list.json()[0]["status"] == "not_started"

    draft = client.put(
        f"/api/attendance/day-entry/{blow_employee['id']}",
        headers=headers,
        params={"date": "2026-05-06", "finalize": "false"},
        json={"blow_work": [{"work_type_id": qty_type_id, "quantity": "8.5"}]},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "draft"

    thua_may = client.put(
        f"/api/attendance/day-entry/{blow_employee['id']}",
        headers=headers,
        params={"date": "2026-05-07", "finalize": "true"},
        json={"blow_work": [{"work_type_id": thua_may_id, "quantity": "5"}]},
    )
    assert thua_may.status_code == 200
    assert thua_may.json()["total_amount_snapshot"] == "60000"

    glove_conflict = client.put(
        f"/api/attendance/day-entry/{blow_employee['id']}",
        headers=headers,
        params={"date": "2026-05-08", "finalize": "true"},
        json={"blow_work": [{"work_type_id": glove_1_id}, {"work_type_id": glove_2_id}]},
    )
    assert glove_conflict.status_code == 422

    cut_save = client.put(
        f"/api/attendance/day-entry/{cut_employee['id']}",
        headers=headers,
        params={"date": "2026-05-06", "finalize": "true"},
        json={"cut_work": [{"bag_type_id": bag_25_id, "quantity": "10"}, {"bag_type_id": bag_50_id, "quantity": "20"}]},
    )
    assert cut_save.status_code == 200
    assert cut_save.json()["total_amount_snapshot"] == "100000"

    absent = client.put(
        f"/api/attendance/day-entry/{cut_employee['id']}",
        headers=headers,
        params={"date": "2026-05-06", "finalize": "true"},
        json={"is_absent": True},
    )
    assert absent.status_code == 200
    assert absent.json()["is_absent"] is True

    diagnostics_source = client.put(
        f"/api/attendance/day-entry/{cut_employee['id']}",
        headers=headers,
        params={"date": "2026-05-07", "finalize": "true"},
        json={"cut_work": [{"bag_type_id": bag_25_id, "quantity": "25"}]},
    )
    assert diagnostics_source.status_code == 200

    with session_factory() as session:
        session.execute(text("DELETE FROM attendance_inventory_effects"))
        session.commit()

    diagnostics = client.get("/api/attendance/inventory-diagnostics", headers=headers)
    assert diagnostics.status_code == 200
    assert diagnostics.json()[0]["issue_type"] == "finalized_record_missing_inventory_effect"
