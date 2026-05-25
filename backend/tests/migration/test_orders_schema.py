from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260521_0007_orders_schema.py"


def test_orders_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_orders_migration_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in ("order_requests", "order_request_items"):
        assert f'op.create_table(\n        "{table_name}"' in migration_text


def test_orders_migration_contains_expected_constraints_and_indexes() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for expected_name in (
        "uq_order_requests_order_code",
        "ck_order_requests_customer_snapshot_not_blank",
        "ix_order_requests_status_delivery_order",
        "ix_order_requests_customer_status_order",
        "ix_order_requests_source_invoice_id",
        "ck_order_request_items_quantity_positive",
        "ix_order_request_items_order_id_id",
        "ix_order_request_items_product_order",
    ):
        assert expected_name in migration_text
