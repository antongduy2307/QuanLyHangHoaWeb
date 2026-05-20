from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime, time, timezone
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
    username = f"{role.value}_reports_user"
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


def seed_product(session_factory, *, code: str = "report-product", stock: str = "10") -> int:
    with session_factory() as session:
        service = InventoryService()
        product = service.create_product(
            session,
            product_code_base=code,
            product_name="Report Product",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: Decimal("100.00"), UnitType.KG: Decimal("10.00")},
        )
        service.increase_stock(session, product.id, Decimal(stock), UnitType.BAO)
        session.commit()
        return product.id


def seed_customer(session_factory, *, name: str, opening_balance: str = "0", total_sales: str = "0") -> int:
    with session_factory() as session:
        customer = CustomerService().create_customer(
            session,
            customer_name=name,
            phone="0909",
            opening_balance=Decimal(opening_balance),
            total_sales=Decimal(total_sales),
        )
        session.commit()
        return customer.id


def invoice_payload(
    product_id: int,
    *,
    customer_id: int | None = None,
    invoice_date: date,
    quantity: str = "1",
    paid: str = "100",
) -> dict:
    return {
        "customer_id": customer_id,
        "customer_snapshot_name": None if customer_id is not None else "Walk In",
        "invoice_datetime": datetime.combine(invoice_date, time(9, 0), tzinfo=timezone.utc).isoformat(),
        "paid_amount": paid,
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": quantity, "unit_price": "100.00"}],
    }


def return_payload(product_id: int, *, return_date: date, quantity: str = "1") -> dict:
    return {
        "source_invoice_id": None,
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "return_datetime": datetime.combine(return_date, time(10, 0), tzinfo=timezone.utc).isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": quantity, "unit_price": "100.00"}],
    }


def seed_report_documents(client: TestClient, session_factory, headers: dict[str, str]) -> tuple[int, int]:
    product_id = seed_product(session_factory)
    debtor_id = seed_customer(session_factory, name="Big Debt Customer", opening_balance="25", total_sales="500")
    seed_customer(session_factory, name="Small Debt Customer", opening_balance="5", total_sales="100")
    today = date.today()
    client.post("/api/sales/invoices", headers=headers, json=invoice_payload(product_id, customer_id=debtor_id, invoice_date=today, paid="40"))
    client.post("/api/sales/invoices", headers=headers, json=invoice_payload(product_id, invoice_date=date(2025, 1, 1), paid="100"))
    client.post("/api/returns", headers=headers, json=return_payload(product_id, return_date=today))
    client.post("/api/returns", headers=headers, json=return_payload(product_id, return_date=date(2025, 1, 1), quantity="2"))
    return product_id, debtor_id


def test_reports_require_auth(client: TestClient) -> None:
    response = client.get("/api/reports/dashboard-summary")

    assert response.status_code == 401


@pytest.mark.parametrize("role", [UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY])
def test_owner_admin_and_read_only_can_access_reports(client: TestClient, session_factory, role: UserRole) -> None:
    response = client.get("/api/reports/dashboard-summary", headers=auth_headers(client, session_factory, role))

    assert response.status_code == 200


@pytest.mark.parametrize("role", [UserRole.EMPLOYEE, UserRole.ATTENDANCE_MANAGER])
def test_employee_and_attendance_manager_cannot_access_reports(client: TestClient, session_factory, role: UserRole) -> None:
    response = client.get("/api/reports/dashboard-summary", headers=auth_headers(client, session_factory, role))

    assert response.status_code == 403


def test_dashboard_summary_returns_seeded_values(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    seed_report_documents(client, session_factory, headers)

    response = client.get("/api/reports/dashboard-summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_products"] == 1
    assert body["total_customers"] == 2
    assert body["today_sales_total"] == "100.00"
    assert body["month_sales_total"] == "100.00"
    assert body["today_return_total"] == "100.00"
    assert body["invoice_count_today"] == 1
    assert body["positive_debt_customer_count"] == 2


def test_customer_debts_sorted_descending_and_decimal_serialized(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    seed_report_documents(client, session_factory, headers)

    response = client.get("/api/reports/customer-debts", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert [row["customer_name"] for row in body][:2] == ["Big Debt Customer", "Small Debt Customer"]
    assert body[0]["current_balance"] == "85.00"


def test_inventory_summary_returns_balance_and_enabled_prices(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    product_id, _ = seed_report_documents(client, session_factory, headers)

    response = client.get("/api/reports/inventory-summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body[0]["product_id"] == product_id
    assert body[0]["balance_unit"] == "BAO"
    assert body[0]["prices"][0]["price"] == "100.00"


def test_sales_summary_date_range_works(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    seed_report_documents(client, session_factory, headers)

    response = client.get("/api/reports/sales-summary?date_from=2025-01-01&date_to=2025-01-31", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_sales"] == "100.00"
    assert body["total_paid"] == "100.00"
    assert body["invoice_count"] == 1
    assert body["average_invoice_total"] == "100.00"
    assert body["by_day"] == [{"date": "2025-01-01", "invoice_count": 1, "total_sales": "100.00", "total_paid": "100.00"}]


def test_returns_summary_date_range_works(client: TestClient, session_factory) -> None:
    headers = auth_headers(client, session_factory, UserRole.OWNER)
    seed_report_documents(client, session_factory, headers)

    response = client.get("/api/reports/returns-summary?date_from=2025-01-01&date_to=2025-01-31", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_returns"] == "200.00"
    assert body["return_count"] == 1
    assert body["by_day"] == [{"date": "2025-01-01", "return_count": 1, "total_returns": "200.00"}]
