from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.api.deps as api_deps
from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.core.config import Settings
from app.domain.auth import UserRole
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.inventory import Product
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
    username = f"{role.value}_user"
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


def create_product(client: TestClient, headers: dict[str, str], code: str = "gao-01") -> dict:
    response = client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": code,
            "product_name": "Gao Thom",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "250000", "is_enabled": True}],
        },
    )
    assert response.status_code == 201
    return response.json()


def invoice_payload(product_id: int, *, invoice_datetime: datetime) -> dict:
    return {
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "invoice_datetime": invoice_datetime.isoformat(),
        "paid_amount": "250000",
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "250000"}],
    }


def return_payload(product_id: int, *, return_datetime: datetime) -> dict:
    return {
        "source_invoice_id": None,
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "return_datetime": return_datetime.isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "250000"}],
    }


def test_health_still_passes(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "QuanLyHangHoaWeb"}


def test_auth_login_and_refresh_remain_public(client: TestClient, session_factory) -> None:
    with session_factory() as session:
        AuthService().create_user(
            session,
            username="admin",
            password="strong-password",
            display_name="Admin",
            role=UserRole.OWNER,
        )
        session.commit()

    login = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"})
    refresh = client.post("/api/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})

    assert login.status_code == 200
    assert refresh.status_code == 200


def test_anonymous_and_invalid_inventory_access_return_401(client: TestClient) -> None:
    anonymous = client.get("/api/inventory/products")
    invalid = client.get("/api/inventory/products", headers={"Authorization": "Bearer invalid-token"})

    assert anonymous.status_code == 401
    assert invalid.status_code == 401


def test_local_auth_bypass_allows_protected_inventory_without_token(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        api_deps,
        "get_settings",
        lambda: Settings(APP_ENV="local", AUTH_BYPASS=True),
    )

    read_response = client.get("/api/inventory/products")
    write_response = client.post(
        "/api/inventory/products",
        json={
            "product_code_base": "bypass",
            "product_name": "Bypass Product",
            "unit_mode": "BICH",
            "prices": [{"unit_type": "BICH", "price": "1000.00", "is_enabled": True}],
        },
    )

    assert read_response.status_code == 200
    assert write_response.status_code == 201


def test_read_only_can_get_but_cannot_write_inventory(client: TestClient, session_factory) -> None:
    owner_headers = auth_headers(client, session_factory, UserRole.OWNER)
    read_headers = auth_headers(client, session_factory, UserRole.READ_ONLY)
    create_product(client, owner_headers)

    read_response = client.get("/api/inventory/products", headers=read_headers)
    write_response = client.post(
        "/api/inventory/products",
        headers=read_headers,
        json={
            "product_code_base": "readonly",
            "product_name": "Read Only",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "1", "is_enabled": True}],
        },
    )
    set_response = client.post(
        f"/api/inventory/products/{create_product(client, owner_headers, 'set-readonly')['id']}/stock/set",
        headers=read_headers,
        json={"unit_type": "BAO", "target_quantity": "1"},
    )

    assert read_response.status_code == 200
    assert write_response.status_code == 403
    assert set_response.status_code == 403


def test_employee_and_attendance_manager_cannot_access_inventory(client: TestClient, session_factory) -> None:
    employee_headers = auth_headers(client, session_factory, UserRole.EMPLOYEE)
    attendance_headers = auth_headers(client, session_factory, UserRole.ATTENDANCE_MANAGER)

    employee_response = client.get("/api/inventory/products", headers=employee_headers)
    attendance_response = client.get("/api/inventory/products", headers=attendance_headers)

    assert employee_response.status_code == 403
    assert attendance_response.status_code == 403


def test_create_bao_kg_product(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)

    assert product["product_code_base"] == "GAO-01"
    assert product["unit_mode"] == "BAO_KG"
    assert product["balance"]["on_hand_bao_decimal"] in ("0.000", "0")
    assert product["balance"]["derived_kg_balance"] in ("0.000", "0")


def test_create_bich_product(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ADMIN)
    response = client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": "bich-01",
            "product_name": "Bich Sua",
            "unit_mode": "BICH",
            "prices": [{"unit_type": "BICH", "price": "5000", "is_enabled": True}],
        },
    )

    assert response.status_code == 201
    assert response.json()["balance"]["on_hand_bich_integer"] in ("0.000", "0")


def test_reject_invalid_unit_price_combination(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    response = client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": "bad",
            "product_name": "Bad",
            "unit_mode": "BICH",
            "prices": [{"unit_type": "BAO", "price": "1", "is_enabled": True}],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_duplicate_active_product_code_returns_conflict(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    create_product(client, headers, "dup")

    response = client.post(
        "/api/inventory/products",
        headers=headers,
        json={
            "product_code_base": " dup ",
            "product_name": "Duplicate",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "250000", "is_enabled": True}],
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_list_excludes_inactive_by_default(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    active = create_product(client, headers, "active")
    inactive = create_product(client, headers, "inactive")

    with next(app.dependency_overrides[get_session]()) as session:
        product = session.scalars(select(Product).where(Product.id == inactive["id"])).one()
        product.is_active = False
        session.commit()

    default_response = client.get("/api/inventory/products", headers=headers)
    inactive_response = client.get("/api/inventory/products", headers=headers, params={"include_inactive": True})

    assert [product["id"] for product in default_response.json()] == [active["id"]]
    assert {product["id"] for product in inactive_response.json()} == {active["id"], inactive["id"]}


def test_get_patch_delete_product(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.ADMIN)
    product = create_product(client, headers)

    get_response = client.get(f"/api/inventory/products/{product['id']}", headers=headers)
    assert get_response.status_code == 200

    patch_response = client.patch(
        f"/api/inventory/products/{product['id']}",
        headers=headers,
        json={
            "product_name": "Gao Moi",
            "prices": [{"unit_type": "KG", "price": "12000", "is_enabled": True}],
        },
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["product_name"] == "Gao Moi"
    assert {price["unit_type"] for price in patch_response.json()["prices"] if price["is_enabled"]} == {"KG"}

    delete_response = client.delete(f"/api/inventory/products/{product['id']}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["action"] == "hard_deleted"


def test_stock_increase_decrease_and_balance_endpoint(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)

    increase_response = client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "1"},
    )
    decrease_response = client.post(
        f"/api/inventory/products/{product['id']}/stock/decrease",
        headers=headers,
        json={"unit_type": "KG", "quantity": "50"},
    )
    balance_response = client.get(f"/api/inventory/products/{product['id']}/balance", headers=headers)

    assert increase_response.status_code == 200
    assert decrease_response.status_code == 200
    assert decrease_response.json()["on_hand_bao_decimal"] == "-1.000"
    assert decrease_response.json()["derived_kg_balance"] == "-25.000"
    assert balance_response.json()["on_hand_bao_decimal"] == "-1.000"


def test_stock_set_endpoint_computes_delta_and_movement(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)
    client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "2", "note": "Initial"},
    )

    response = client.post(
        f"/api/inventory/products/{product['id']}/stock/set",
        headers=headers,
        json={"unit_type": "KG", "target_quantity": "25", "note": "Kiem kho thuc te"},
    )
    movements = client.get(f"/api/inventory/products/{product['id']}/movements", headers=headers).json()

    assert response.status_code == 200
    assert response.json()["on_hand_bao_decimal"] == "1.000"
    assert response.json()["derived_kg_balance"] == "25.000"
    assert movements[0]["movement_type"] == "STOCK_SET"
    assert movements[0]["quantity_delta"] == "-25.000"
    assert movements[0]["unit_type"] == "KG"
    assert movements[0]["balance_after"] == "1.000"


def test_stock_set_allows_negative_target(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)

    response = client.post(
        f"/api/inventory/products/{product['id']}/stock/set",
        headers=headers,
        json={"unit_type": "KG", "target_quantity": "-25", "note": "Kiem kho am"},
    )

    assert response.status_code == 200
    assert response.json()["on_hand_bao_decimal"] == "-1.000"
    assert response.json()["derived_kg_balance"] == "-25.000"


def test_stock_adjustments_generate_movement_rows(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)

    client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "3", "note": "Nhap kho dau ngay"},
    )
    client.post(
        f"/api/inventory/products/{product['id']}/stock/decrease",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "1", "note": "Kiem kho"},
    )

    response = client.get(f"/api/inventory/products/{product['id']}/movements", headers=headers)

    assert response.status_code == 200
    rows = response.json()
    assert [row["movement_type"] for row in rows] == ["STOCK_DECREASE", "STOCK_INCREASE"]
    assert rows[0]["quantity_delta"] == "-1.000"
    assert rows[0]["source_type"] == "stock_adjustment"
    assert rows[0]["note"] == "Kiem kho"
    assert rows[1]["balance_after"] in ("3.000", "3")


def test_sales_and_returns_generate_visible_movement_rows_sorted_newest_first(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)
    sale_response = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product["id"], invoice_datetime=datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc)),
    )
    return_response = client.post(
        "/api/returns",
        headers=headers,
        json=return_payload(product["id"], return_datetime=datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc)),
    )

    response = client.get(f"/api/inventory/products/{product['id']}/movements", headers=headers)

    assert sale_response.status_code == 201
    assert return_response.status_code == 201
    assert response.status_code == 200
    rows = response.json()
    assert [row["movement_type"] for row in rows] == ["RETURN", "SALE"]
    assert rows[0]["quantity_delta"] == "1.000"
    assert rows[0]["source_type"] == "return"
    assert rows[0]["source_id"] == return_response.json()["id"]
    assert rows[1]["quantity_delta"] == "-1.000"
    assert rows[1]["source_type"] == "invoice"
    assert rows[1]["source_id"] == sale_response.json()["id"]


def test_mixed_inventory_movements_return_200_and_newest_first(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product = create_product(client, headers)
    sale_response = client.post(
        "/api/sales/invoices",
        headers=headers,
        json=invoice_payload(product["id"], invoice_datetime=datetime(2026, 5, 17, 9, 0, tzinfo=timezone.utc)),
    )
    return_response = client.post(
        "/api/returns",
        headers=headers,
        json=return_payload(product["id"], return_datetime=datetime(2026, 5, 18, 9, 0, tzinfo=timezone.utc)),
    )
    stock_response = client.post(
        f"/api/inventory/products/{product['id']}/stock/increase",
        headers=headers,
        json={"unit_type": "BAO", "quantity": "2", "note": "Nhap bo sung"},
    )

    response = client.get(f"/api/inventory/products/{product['id']}/movements", headers=headers)

    assert sale_response.status_code == 201
    assert return_response.status_code == 201
    assert stock_response.status_code == 200
    assert response.status_code == 200
    rows = response.json()
    assert [row["movement_type"] for row in rows] == ["STOCK_INCREASE", "RETURN", "SALE"]
    assert rows[0]["balance_after"] is not None
    assert rows[1]["balance_after"] is None
    assert rows[2]["balance_after"] is None
