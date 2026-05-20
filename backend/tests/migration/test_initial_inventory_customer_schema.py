from __future__ import annotations

from pathlib import Path

from alembic.script import ScriptDirectory


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260515_0001_inventory_customer_schema.py"


def test_inventory_customer_schema_revision_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_alembic_head_is_stock_adjustments_revision() -> None:
    script = ScriptDirectory(str(BACKEND_ROOT / "alembic"))

    assert script.get_current_head() == "20260519_0006"


def test_migration_script_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in (
        "products",
        "product_prices",
        "inventory_balances",
        "customers",
        "customer_balance_ledgers",
    ):
        assert f'"{table_name}"' in migration_text
        assert f'op.create_table(\n        "{table_name}"' in migration_text


def test_debt_payments_schema_revision_exists() -> None:
    migration_path = BACKEND_ROOT / "alembic" / "versions" / "20260515_0002_debt_payments.py"
    migration_text = migration_path.read_text(encoding="utf-8")

    assert migration_path.exists()
    assert 'op.create_table(\n        "debt_payments"' in migration_text
    assert 'op.drop_table("debt_payments")' in migration_text


def test_sales_returns_schema_revision_exists() -> None:
    migration_path = BACKEND_ROOT / "alembic" / "versions" / "20260516_0003_sales_returns_schema.py"
    migration_text = migration_path.read_text(encoding="utf-8")

    assert migration_path.exists()
    for table_name in (
        "document_counters",
        "invoices",
        "invoice_items",
        "return_invoices",
        "return_invoice_items",
    ):
        assert f'op.create_table(\n        "{table_name}"' in migration_text
        assert f'op.drop_table("{table_name}")' in migration_text


def test_stock_adjustments_schema_revision_exists() -> None:
    migration_path = BACKEND_ROOT / "alembic" / "versions" / "20260519_0005_stock_adjustments.py"
    migration_text = migration_path.read_text(encoding="utf-8")

    assert migration_path.exists()
    assert 'op.create_table(\n        "stock_adjustments"' in migration_text
    assert 'op.drop_table("stock_adjustments")' in migration_text


def test_stock_set_adjustments_revision_exists() -> None:
    migration_path = BACKEND_ROOT / "alembic" / "versions" / "20260519_0006_stock_set_adjustments.py"
    migration_text = migration_path.read_text(encoding="utf-8")

    assert migration_path.exists()
    assert "STOCK_SET" in migration_text
    assert "op.create_check_constraint" in migration_text
