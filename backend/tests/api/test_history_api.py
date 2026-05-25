from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.domain.auth import UserRole
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import Product, StockAdjustment
from app.infrastructure.db.models.orders import OrderRequest
from app.infrastructure.db.models.returns import ReturnInvoice
from app.infrastructure.db.models.sales import Invoice
from app.main import app


def _dt(year: int, month: int, day: int, hour: int, minute: int) -> str:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc).isoformat()


def _session_scope(session_factory) -> Iterator[Session]:
    with session_factory() as session:
        yield session


def _table_count(session: Session, model) -> int:
    return int(session.scalar(select(func.count()).select_from(model)) or 0)


def _history_ids(rows: list[dict], event_type: str) -> list[int]:
    return [row["event_id"] for row in rows if row["event_type"] == event_type]


class TestHistoryApi:
    def setup_method(self) -> None:
        self._engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self._engine)
        self._session_factory = sessionmaker(bind=self._engine, expire_on_commit=False, autoflush=False)

        def override_session() -> Iterator[Session]:
            yield from _session_scope(self._session_factory)

        app.dependency_overrides[get_session] = override_session
        self.client = TestClient(app)

    def teardown_method(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self._engine)
        self._engine.dispose()

    def auth_headers(self, role: UserRole = UserRole.OWNER) -> dict[str, str]:
        username = f"{role.value}_history_user"
        with self._session_factory() as session:
            if AuthService()._repository.get_user_by_username(session, username) is None:
                AuthService().create_user(
                    session,
                    username=username,
                    password="strong-password",
                    display_name=role.value,
                    role=role,
                )
                session.commit()
        response = self.client.post("/api/auth/login", json={"username": username, "password": "strong-password"})
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    def create_product(self, headers: dict[str, str], *, code: str, name: str = "Gao History") -> dict:
        response = self.client.post(
            "/api/inventory/products",
            headers=headers,
            json={
                "product_code_base": code,
                "product_name": name,
                "unit_mode": "BAO_KG",
                "prices": [{"unit_type": "BAO", "price": "100.00", "is_enabled": True}],
            },
        )
        assert response.status_code == 201
        return response.json()

    def create_customer(self, headers: dict[str, str], *, name: str = "History Customer") -> dict:
        response = self.client.post(
            "/api/customers",
            headers=headers,
            json={"customer_name": name, "opening_balance": "0"},
        )
        assert response.status_code == 201
        return response.json()

    def seed_history(self, headers: dict[str, str]) -> dict[str, int]:
        product = self.create_product(headers, code="history-a", name="Gao History A")
        other_product = self.create_product(headers, code="history-b", name="Bot History B")
        customer = self.create_customer(headers, name="Tran History")

        self.client.post(
            f"/api/inventory/products/{product['id']}/stock/increase",
            headers=headers,
            json={"unit_type": "BAO", "quantity": "5", "note": "Initial stock"},
        )
        self.client.post(
            f"/api/inventory/products/{other_product['id']}/stock/increase",
            headers=headers,
            json={"unit_type": "BAO", "quantity": "4", "note": "Initial stock B"},
        )

        invoice = self.client.post(
            "/api/sales/invoices",
            headers=headers,
            json={
                "customer_id": customer["id"],
                "invoice_datetime": _dt(2026, 5, 20, 9, 0),
                "paid_amount": "30.00",
                "payment_method": "CASH",
                "items": [
                    {"product_id": product["id"], "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"},
                    {"product_id": other_product["id"], "unit_type": "BAO", "quantity": "2", "unit_price": "80.00"},
                ],
            },
        )
        assert invoice.status_code == 201

        return_invoice = self.client.post(
            "/api/returns",
            headers=headers,
            json={
                "customer_id": customer["id"],
                "customer_snapshot_name": None,
                "return_datetime": _dt(2026, 5, 20, 10, 0),
                "handling_mode": "STORE_CREDIT",
                "items": [{"product_id": product["id"], "unit_type": "BAO", "quantity": "1", "unit_price": "100.00"}],
            },
        )
        assert return_invoice.status_code == 201

        debt_payment = self.client.post(
            f"/api/customers/{customer['id']}/debt-payments",
            headers=headers,
            json={"amount": "15.00", "payment_datetime": _dt(2026, 5, 20, 11, 0), "note": "Standalone payment"},
        )
        assert debt_payment.status_code == 201

        balance_adjustment = self.client.post(
            f"/api/customers/{customer['id']}/balance-adjustments",
            headers=headers,
            json={"target_balance": "60.00", "adjustment_datetime": _dt(2026, 5, 20, 12, 0), "note": "Manual fix"},
        )
        assert balance_adjustment.status_code == 201

        stock_adjustment = self.client.post(
            f"/api/inventory/products/{other_product['id']}/stock/set",
            headers=headers,
            json={"unit_type": "BAO", "target_quantity": "3", "adjustment_datetime": _dt(2026, 5, 20, 13, 0), "note": "Counted stock"},
        )
        assert stock_adjustment.status_code == 200

        order = self.client.post(
            "/api/orders",
            headers=headers,
            json={
                "customer_id": customer["id"],
                "order_datetime": _dt(2026, 5, 20, 14, 0),
                "required_delivery_datetime": None,
                "items": [{"product_id": other_product["id"], "unit_type": "BAO", "quantity": "2"}],
                "note": "Converted order",
            },
        )
        assert order.status_code == 201
        converted = self.client.post(
            f"/api/orders/{order.json()['id']}/converted",
            headers=headers,
            json={"invoice_id": invoice.json()["id"]},
        )
        assert converted.status_code == 200

        return {
            "customer_id": customer["id"],
            "product_id": product["id"],
            "other_product_id": other_product["id"],
            "invoice_id": invoice.json()["id"],
            "return_id": return_invoice.json()["id"],
            "debt_payment_id": debt_payment.json()["payment"]["id"],
            "balance_adjustment_id": balance_adjustment.json()["ledger"]["id"],
            "order_id": order.json()["id"],
        }

    def test_history_auth_access_rules(self) -> None:
        owner_headers = self.auth_headers(UserRole.OWNER)
        read_headers = self.auth_headers(UserRole.READ_ONLY)
        employee_headers = self.auth_headers(UserRole.EMPLOYEE)
        attendance_headers = self.auth_headers(UserRole.ATTENDANCE_MANAGER)
        self.seed_history(owner_headers)

        anonymous = self.client.get("/api/history")
        invalid = self.client.get("/api/history", headers={"Authorization": "Bearer invalid-token"})
        owner = self.client.get("/api/history", headers=owner_headers)
        read_only = self.client.get("/api/history", headers=read_headers)
        employee = self.client.get("/api/history", headers=employee_headers)
        attendance = self.client.get("/api/history", headers=attendance_headers)

        assert anonymous.status_code == 401
        assert invalid.status_code == 401
        assert owner.status_code == 200
        assert read_only.status_code == 200
        assert employee.status_code == 403
        assert attendance.status_code == 403

    def test_history_includes_batch_a_event_types_without_invoice_linked_payment_duplicates(self) -> None:
        headers = self.auth_headers()
        ids = self.seed_history(headers)

        response = self.client.get("/api/history", headers=headers)

        assert response.status_code == 200
        payload = response.json()
        rows = payload["items"]
        assert payload["page"] == 1
        assert payload["page_size"] == 50
        assert payload["total"] >= len(rows)
        assert _history_ids(rows, "SALES_INVOICE").count(ids["invoice_id"]) == 1
        assert _history_ids(rows, "RETURN_INVOICE").count(ids["return_id"]) == 1
        assert ids["debt_payment_id"] in _history_ids(rows, "DEBT_PAYMENT")
        assert ids["balance_adjustment_id"] in _history_ids(rows, "BALANCE_ADJUSTMENT")
        assert ids["order_id"] in _history_ids(rows, "ORDER")
        assert any(
            row["event_type"] == "STOCK_MOVEMENT"
            and row["source_type"] == "stock_adjustment"
            and row["product_id"] == ids["other_product_id"]
            for row in rows
        )
        assert any(row["event_type"] == "ORDER" and row["event_id"] == ids["order_id"] for row in rows[:3])
        assert not any(
            row["event_type"] == "DEBT_PAYMENT"
            and row["source_type"] == "debt_payment"
            and row["event_id"] != ids["debt_payment_id"]
            for row in rows
        )
        assert not any(row["event_type"] == "STOCK_MOVEMENT" and row["source_type"] == "invoice" for row in rows)
        assert not any(row["event_type"] == "STOCK_MOVEMENT" and row["source_type"] == "return" for row in rows)

    def test_history_filters_by_type_customer_product_date_and_search(self) -> None:
        headers = self.auth_headers()
        ids = self.seed_history(headers)

        by_type = self.client.get("/api/history", headers=headers, params={"event_type": "RETURN_INVOICE"})
        by_customer = self.client.get("/api/history", headers=headers, params={"customer_id": ids["customer_id"]})
        by_product = self.client.get("/api/history", headers=headers, params={"product_id": ids["product_id"]})
        by_date = self.client.get(
            "/api/history",
            headers=headers,
            params={"date_from": _dt(2026, 5, 20, 12, 30), "date_to": _dt(2026, 5, 20, 14, 30)},
        )
        by_code = self.client.get("/api/history", headers=headers, params={"search": "HD20260520"})
        by_customer_keyword = self.client.get("/api/history", headers=headers, params={"search": "Tran History"})
        by_product_keyword = self.client.get("/api/history", headers=headers, params={"search": "Bot History B"})

        assert by_type.status_code == 200
        assert {row["event_type"] for row in by_type.json()["items"]} == {"RETURN_INVOICE"}
        assert all(row["customer_id"] == ids["customer_id"] for row in by_customer.json()["items"])
        assert {row["event_type"] for row in by_product.json()["items"]} == {"SALES_INVOICE", "RETURN_INVOICE", "STOCK_MOVEMENT"}
        assert [row["event_type"] for row in by_date.json()["items"]] == ["ORDER", "STOCK_MOVEMENT"]
        assert [row["event_type"] for row in by_code.json()["items"]] == ["SALES_INVOICE"]
        assert any(row["event_type"] == "DEBT_PAYMENT" for row in by_customer_keyword.json()["items"])
        assert any(row["event_type"] == "ORDER" for row in by_product_keyword.json()["items"])

    def test_history_explicit_stock_movement_filter_shows_document_derived_movements(self) -> None:
        headers = self.auth_headers()
        ids = self.seed_history(headers)

        response = self.client.get("/api/history", headers=headers, params={"event_type": "STOCK_MOVEMENT"})

        assert response.status_code == 200
        rows = response.json()["items"]
        assert any(row["source_type"] == "stock_adjustment" and row["product_id"] == ids["other_product_id"] for row in rows)
        assert len([row for row in rows if row["source_type"] == "invoice" and row["source_id"] == ids["invoice_id"]]) == 2
        assert len([row for row in rows if row["source_type"] == "return" and row["source_id"] == ids["return_id"]]) == 1

    def test_history_sorting_is_deterministic_by_datetime_display_order_and_event_id(self) -> None:
        headers = self.auth_headers()
        customer = self.create_customer(headers)
        product = self.create_product(headers, code="sort-a")
        same_time = _dt(2026, 5, 21, 9, 0)

        self.client.post(
            f"/api/customers/{customer['id']}/balance-adjustments",
            headers=headers,
            json={"target_balance": "10.00", "adjustment_datetime": same_time, "note": "Adjustment one"},
        )
        self.client.post(
            f"/api/customers/{customer['id']}/debt-payments",
            headers=headers,
            json={"amount": "2.00", "payment_datetime": same_time, "note": "Same time payment"},
        )
        second_adjustment = self.client.post(
            f"/api/customers/{customer['id']}/balance-adjustments",
            headers=headers,
            json={"target_balance": "25.00", "adjustment_datetime": same_time, "note": "Adjustment two"},
        )
        self.client.post(
            "/api/sales/invoices",
            headers=headers,
            json={
                "customer_id": customer["id"],
                "invoice_datetime": same_time,
                "paid_amount": "0",
                "payment_method": "CASH",
                "items": [{"product_id": product["id"], "unit_type": "BAO", "quantity": "1", "unit_price": "50.00"}],
            },
        )

        response = self.client.get("/api/history", headers=headers, params={"date_from": same_time, "date_to": same_time})

        assert response.status_code == 200
        rows = response.json()["items"]
        balance_rows = [row for row in rows if row["event_type"] == "BALANCE_ADJUSTMENT"]
        assert rows[0]["event_type"] == "DEBT_PAYMENT"
        assert balance_rows[0]["event_id"] == second_adjustment.json()["ledger"]["id"]
        assert balance_rows[1]["event_id"] < balance_rows[0]["event_id"]

    def test_history_endpoint_has_no_mutation_side_effects(self) -> None:
        headers = self.auth_headers()
        self.seed_history(headers)
        with self._session_factory() as session:
            before = {
                "invoices": _table_count(session, Invoice),
                "returns": _table_count(session, ReturnInvoice),
                "payments": _table_count(session, DebtPayment),
                "ledgers": _table_count(session, CustomerBalanceLedger),
                "adjustments": _table_count(session, StockAdjustment),
                "orders": _table_count(session, OrderRequest),
                "products": _table_count(session, Product),
            }

        response = self.client.get("/api/history", headers=headers)

        assert response.status_code == 200
        with self._session_factory() as session:
            after = {
                "invoices": _table_count(session, Invoice),
                "returns": _table_count(session, ReturnInvoice),
                "payments": _table_count(session, DebtPayment),
                "ledgers": _table_count(session, CustomerBalanceLedger),
                "adjustments": _table_count(session, StockAdjustment),
                "orders": _table_count(session, OrderRequest),
                "products": _table_count(session, Product),
            }
        assert after == before

    def test_history_paginates_results_with_stable_sorting(self) -> None:
        headers = self.auth_headers()
        self.seed_history(headers)

        page_one = self.client.get("/api/history", headers=headers, params={"page": 1, "page_size": 2})
        page_two = self.client.get("/api/history", headers=headers, params={"page": 2, "page_size": 2})

        assert page_one.status_code == 200
        assert page_two.status_code == 200
        payload_one = page_one.json()
        payload_two = page_two.json()
        assert payload_one["page"] == 1
        assert payload_one["page_size"] == 2
        assert payload_one["total"] >= 6
        assert len(payload_one["items"]) == 2
        assert len(payload_two["items"]) == 2
        assert payload_one["items"][0]["event_id"] != payload_two["items"][0]["event_id"]
