from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260516_0003_sales_returns_schema.py"


def test_sales_returns_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_sales_returns_migration_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in (
        "document_counters",
        "invoices",
        "invoice_items",
        "return_invoices",
        "return_invoice_items",
    ):
        assert f'op.create_table(\n        "{table_name}"' in migration_text


def test_sales_returns_migration_contains_expected_constraints_and_indexes() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for expected_name in (
        "uq_document_counters_type_business_date",
        "uq_invoices_invoice_code",
        "ix_invoices_customer_datetime_id",
        "ix_invoice_items_product_invoice",
        "uq_return_invoices_return_code",
        "ix_return_invoices_source_invoice_datetime_id",
        "ix_return_invoice_items_source_invoice_item_return",
    ):
        assert expected_name in migration_text
