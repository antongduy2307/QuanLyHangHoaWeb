from __future__ import annotations

import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import Session


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


def test_alembic_upgrade_head_creates_debt_payments(postgres_session: Session) -> None:
    inspector = inspect(postgres_session.bind)

    assert "debt_payments" in inspector.get_table_names()
    assert {"customer_id", "payment_datetime", "id"}.issubset(
        {column["name"] for column in inspector.get_columns("debt_payments")}
    )


def test_alembic_upgrade_head_creates_sales_returns_schema(postgres_session: Session) -> None:
    inspector = inspect(postgres_session.bind)
    table_names = set(inspector.get_table_names())

    assert {
        "document_counters",
        "invoices",
        "invoice_items",
        "return_invoices",
        "return_invoice_items",
    }.issubset(table_names)
    assert {"invoice_code", "customer_id", "invoice_datetime", "total_amount", "paid_amount"}.issubset(
        {column["name"] for column in inspector.get_columns("invoices")}
    )
    assert {"return_code", "source_invoice_id", "is_quick_return", "handling_mode"}.issubset(
        {column["name"] for column in inspector.get_columns("return_invoices")}
    )


def test_alembic_upgrade_head_keeps_stock_set_compatible_stock_adjustments(postgres_session: Session) -> None:
    inspector = inspect(postgres_session.bind)
    table_names = set(inspector.get_table_names())

    assert "stock_adjustments" in table_names
    assert {"product_id", "movement_type", "unit_type", "quantity_delta", "balance_after"}.issubset(
        {column["name"] for column in inspector.get_columns("stock_adjustments")}
    )
    check_constraints = inspector.get_check_constraints("stock_adjustments")
    assert any("STOCK_SET" in (constraint.get("sqltext") or "") for constraint in check_constraints)


def test_alembic_upgrade_head_creates_auth_schema(postgres_session: Session) -> None:
    inspector = inspect(postgres_session.bind)
    table_names = set(inspector.get_table_names())

    assert {"users", "refresh_tokens"}.issubset(table_names)
    assert {"username", "email", "display_name", "password_hash", "role", "is_active"}.issubset(
        {column["name"] for column in inspector.get_columns("users")}
    )
    assert {"user_id", "token_hash", "expires_at", "revoked_at"}.issubset(
        {column["name"] for column in inspector.get_columns("refresh_tokens")}
    )
