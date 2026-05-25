"""Add orders schema.

Revision ID: 20260521_0007
Revises: 20260519_0006
Create Date: 2026-05-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0007"
down_revision: str | None = "20260519_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "order_requests",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("order_code", sa.String(length=64), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("order_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("required_delivery_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="OPEN", nullable=False),
        sa.Column("source_invoice_id", sa.BigInteger(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(customer_name_snapshot)) > 0",
            name="ck_order_requests_customer_snapshot_not_blank",
        ),
        sa.CheckConstraint("length(trim(order_code)) > 0", name="ck_order_requests_order_code_not_blank"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_invoice_id"], ["invoices.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_code", name="uq_order_requests_order_code"),
    )
    op.create_index(
        "ix_order_requests_status_delivery_order",
        "order_requests",
        ["status", "required_delivery_datetime", "order_datetime", "id"],
        unique=False,
    )
    op.create_index(
        "ix_order_requests_customer_status_order",
        "order_requests",
        ["customer_id", "status", "order_datetime", "id"],
        unique=False,
    )
    op.create_index("ix_order_requests_source_invoice_id", "order_requests", ["source_invoice_id"], unique=False)

    op.create_table(
        "order_request_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("order_request_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("product_name_snapshot", sa.String(length=255), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(product_name_snapshot)) > 0",
            name="ck_order_request_items_product_name_snapshot_not_blank",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_order_request_items_quantity_positive"),
        sa.ForeignKeyConstraint(["order_request_id"], ["order_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_request_items_order_id_id", "order_request_items", ["order_request_id", "id"], unique=False)
    op.create_index(
        "ix_order_request_items_product_order",
        "order_request_items",
        ["product_id", "order_request_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_order_request_items_product_order", table_name="order_request_items")
    op.drop_index("ix_order_request_items_order_id_id", table_name="order_request_items")
    op.drop_table("order_request_items")

    op.drop_index("ix_order_requests_source_invoice_id", table_name="order_requests")
    op.drop_index("ix_order_requests_customer_status_order", table_name="order_requests")
    op.drop_index("ix_order_requests_status_delivery_order", table_name="order_requests")
    op.drop_table("order_requests")
