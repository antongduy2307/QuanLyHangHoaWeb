from __future__ import annotations

from collections.abc import Iterator
from datetime import date, datetime, time, timezone
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


def _auth_headers(pg_client: TestClient, postgres_session: Session, role: UserRole = UserRole.OWNER) -> dict[str, str]:
    suffix = uuid4().hex[:10]
    username = f"{role.value}_reports_pg_{suffix}"
    password = "strong-password"
    AuthService().create_user(
        postgres_session,
        username=username,
        password=password,
        display_name="Reports Postgres Owner",
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
            "product_code_base": f"RPT-PG-{suffix}",
            "product_name": f"Report PG {suffix}",
            "unit_mode": "BAO_KG",
            "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def _invoice_payload(product_id: int, business_date: date) -> dict:
    return {
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "invoice_datetime": datetime.combine(business_date, time(9, 0), tzinfo=timezone.utc).isoformat(),
        "paid_amount": "100.00",
        "payment_method": "CASH",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
    }


def _return_payload(product_id: int, business_date: date) -> dict:
    return {
        "source_invoice_id": None,
        "customer_id": None,
        "customer_snapshot_name": "Walk In",
        "return_datetime": datetime.combine(business_date, time(10, 0), tzinfo=timezone.utc).isoformat(),
        "handling_mode": "REFUND_NOW",
        "items": [{"product_id": product_id, "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
    }


def test_postgres_dashboard_summary_date_filters_do_not_compare_date_to_string(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product_id = _create_product(pg_client, headers)
    today = date.today()
    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id, today)).status_code == 201
    assert pg_client.post("/api/returns", headers=headers, json=_return_payload(product_id, today)).status_code == 201

    response = pg_client.get("/api/reports/dashboard-summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["today_sales_total"] == "100.00"
    assert body["today_return_total"] == "100.00"
    assert body["invoice_count_today"] == 1


def test_postgres_dashboard_overview_returns_today_and_trailing_metrics(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product_id = _create_product(pg_client, headers)
    today = date.today()
    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id, today)).status_code == 201
    assert pg_client.post("/api/returns", headers=headers, json=_return_payload(product_id, today)).status_code == 201

    response = pg_client.get("/api/reports/overview", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["today_invoice_count"] == 1
    assert body["today_sales_total"] == "100.00"
    assert body["today_return_count"] == 1
    assert body["today_return_total"] == "100.00"
    assert body["this_month_sales_total"] == "100.00"
    assert body["last_7_days_sales_total"] == "100.00"


def test_postgres_reports_protected_api_smoke(pg_client: TestClient, postgres_session: Session) -> None:
    owner_headers = _auth_headers(pg_client, postgres_session, UserRole.OWNER)
    read_only_headers = _auth_headers(pg_client, postgres_session, UserRole.READ_ONLY)
    employee_headers = _auth_headers(pg_client, postgres_session, UserRole.EMPLOYEE)
    product_id = _create_product(pg_client, owner_headers)
    assert pg_client.post("/api/sales/invoices", headers=owner_headers, json=_invoice_payload(product_id, date.today())).status_code == 201

    assert pg_client.get("/api/reports/dashboard-summary", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/overview", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/sales-timeseries?period=today&granularity=hour", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/top-products?period=today", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/sales-summary", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/returns-summary", headers=read_only_headers).status_code == 200
    assert pg_client.get("/api/reports/dashboard-summary", headers=employee_headers).status_code == 403
    assert pg_client.get("/api/reports/overview", headers=employee_headers).status_code == 403
    assert pg_client.get("/api/reports/sales-timeseries?period=today&granularity=hour", headers=employee_headers).status_code == 403


def test_postgres_sales_timeseries_returns_chart_ready_buckets(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product_id = _create_product(pg_client, headers)
    business_date = date.today()
    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id, business_date)).status_code == 201

    response = pg_client.get("/api/reports/sales-timeseries?period=today&granularity=hour", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "today"
    assert body["granularity"] == "hour"
    assert len(body["buckets"]) == 24
    assert any(bucket["label"] == "09:00" and bucket["sales_total"] == "100.00" for bucket in body["buckets"])


def test_postgres_top_products_returns_revenue_ranked_rows(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    first_product_id = _create_product(pg_client, headers)
    second_product_id = _create_product(pg_client, headers)
    business_date = date.today()

    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(first_product_id, business_date)).status_code == 201
    second_payload = _invoice_payload(second_product_id, business_date)
    second_payload["items"][0]["quantity"] = "2"
    second_payload["items"][0]["unit_price"] = "150.00"
    second_payload["paid_amount"] = "300.00"
    assert pg_client.post("/api/sales/invoices", headers=headers, json=second_payload).status_code == 201

    response = pg_client.get("/api/reports/top-products?period=today", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body[0]["product_id"] == second_product_id
    assert body[0]["total_revenue"] == "300.00"
    assert body[0]["invoice_count"] == 1
    assert body[1]["product_id"] == first_product_id
    assert body[1]["total_revenue"] == "100.00"


def test_postgres_sales_and_returns_summary_date_ranges_use_timestamp_bounds(pg_client: TestClient, postgres_session: Session) -> None:
    headers = _auth_headers(pg_client, postgres_session)
    product_id = _create_product(pg_client, headers)
    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id, date(2025, 1, 1))).status_code == 201
    assert pg_client.post("/api/sales/invoices", headers=headers, json=_invoice_payload(product_id, date(2025, 2, 1))).status_code == 201
    assert pg_client.post("/api/returns", headers=headers, json=_return_payload(product_id, date(2025, 1, 1))).status_code == 201
    assert pg_client.post("/api/returns", headers=headers, json=_return_payload(product_id, date(2025, 2, 1))).status_code == 201

    sales_response = pg_client.get("/api/reports/sales-summary?date_from=2025-01-01&date_to=2025-01-31", headers=headers)
    returns_response = pg_client.get("/api/reports/returns-summary?date_from=2025-01-01&date_to=2025-01-31", headers=headers)

    assert sales_response.status_code == 200
    assert sales_response.json()["total_sales"] == "100.00"
    assert sales_response.json()["invoice_count"] == 1
    assert returns_response.status_code == 200
    assert returns_response.json()["total_returns"] == "100.00"
    assert returns_response.json()["return_count"] == 1
