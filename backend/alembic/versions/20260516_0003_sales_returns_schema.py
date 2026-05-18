"""Add sales returns and document counters schema.

Revision ID: 20260516_0003
Revises: 20260515_0002
Create Date: 2026-05-16
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0003"
down_revision: str | None = "20260515_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_counters",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("document_type", sa.String(length=32), nullable=False),
        sa.Column("business_date", sa.Date(), nullable=False),
        sa.Column("last_number", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(document_type)) > 0",
            name="ck_document_counters_document_type_not_blank",
        ),
        sa.CheckConstraint("last_number >= 0", name="ck_document_counters_last_number_non_negative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_type", "business_date", name="uq_document_counters_type_business_date"),
    )

    op.create_table(
        "invoices",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("invoice_code", sa.String(length=64), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("invoice_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("payment_method", sa.String(length=32), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(customer_snapshot_name)) > 0",
            name="ck_invoices_customer_snapshot_name_not_blank",
        ),
        sa.CheckConstraint("length(trim(invoice_code)) > 0", name="ck_invoices_invoice_code_not_blank"),
        sa.CheckConstraint("paid_amount >= 0", name="ck_invoices_paid_amount_non_negative"),
        sa.CheckConstraint("total_amount >= 0", name="ck_invoices_total_amount_non_negative"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_code", name="uq_invoices_invoice_code"),
    )
    op.create_index("ix_invoices_invoice_datetime_id", "invoices", ["invoice_datetime", "id"], unique=False)
    op.create_index(
        "ix_invoices_customer_datetime_id",
        "invoices",
        ["customer_id", "invoice_datetime", "id"],
        unique=False,
    )
    op.create_index("ix_invoices_status_datetime", "invoices", ["status", "invoice_datetime"], unique=False)

    op.create_table(
        "invoice_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("invoice_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("product_code_snapshot", sa.String(length=64), nullable=False),
        sa.Column("product_name_snapshot", sa.String(length=255), nullable=False),
        sa.CheckConstraint("length(trim(product_code_snapshot)) > 0", name="ck_invoice_items_product_code_snapshot_not_blank"),
        sa.CheckConstraint("length(trim(product_name_snapshot)) > 0", name="ck_invoice_items_product_name_snapshot_not_blank"),
        sa.CheckConstraint("line_total >= 0", name="ck_invoice_items_line_total_non_negative"),
        sa.CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_invoice_items_unit_price_non_negative"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_invoice_items_invoice_id_id", "invoice_items", ["invoice_id", "id"], unique=False)
    op.create_index("ix_invoice_items_product_invoice", "invoice_items", ["product_id", "invoice_id"], unique=False)

    op.create_table(
        "return_invoices",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("return_code", sa.String(length=64), nullable=False),
        sa.Column("source_invoice_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_id", sa.BigInteger(), nullable=True),
        sa.Column("customer_snapshot_name", sa.String(length=255), nullable=False),
        sa.Column("is_quick_return", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("return_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("handling_mode", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(customer_snapshot_name)) > 0",
            name="ck_return_invoices_customer_snapshot_name_not_blank",
        ),
        sa.CheckConstraint("length(trim(return_code)) > 0", name="ck_return_invoices_return_code_not_blank"),
        sa.CheckConstraint("total_amount >= 0", name="ck_return_invoices_total_amount_non_negative"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_invoice_id"], ["invoices.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("return_code", name="uq_return_invoices_return_code"),
    )
    op.create_index(
        "ix_return_invoices_return_datetime_id",
        "return_invoices",
        ["return_datetime", "id"],
        unique=False,
    )
    op.create_index(
        "ix_return_invoices_customer_datetime_id",
        "return_invoices",
        ["customer_id", "return_datetime", "id"],
        unique=False,
    )
    op.create_index(
        "ix_return_invoices_source_invoice_datetime_id",
        "return_invoices",
        ["source_invoice_id", "return_datetime", "id"],
        unique=False,
    )

    op.create_table(
        "return_invoice_items",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("return_invoice_id", sa.BigInteger(), nullable=False),
        sa.Column("source_invoice_item_id", sa.BigInteger(), nullable=True),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("product_code_snapshot", sa.String(length=64), nullable=False),
        sa.Column("product_name_snapshot", sa.String(length=255), nullable=False),
        sa.CheckConstraint(
            "length(trim(product_code_snapshot)) > 0",
            name="ck_return_invoice_items_product_code_snapshot_not_blank",
        ),
        sa.CheckConstraint(
            "length(trim(product_name_snapshot)) > 0",
            name="ck_return_invoice_items_product_name_snapshot_not_blank",
        ),
        sa.CheckConstraint("line_total >= 0", name="ck_return_invoice_items_line_total_non_negative"),
        sa.CheckConstraint("quantity > 0", name="ck_return_invoice_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_return_invoice_items_unit_price_non_negative"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["return_invoice_id"], ["return_invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_invoice_item_id"], ["invoice_items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_return_invoice_items_return_invoice_id_id",
        "return_invoice_items",
        ["return_invoice_id", "id"],
        unique=False,
    )
    op.create_index(
        "ix_return_invoice_items_source_invoice_item_return",
        "return_invoice_items",
        ["source_invoice_item_id", "return_invoice_id"],
        unique=False,
    )
    op.create_index(
        "ix_return_invoice_items_product_return",
        "return_invoice_items",
        ["product_id", "return_invoice_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_return_invoice_items_product_return", table_name="return_invoice_items")
    op.drop_index("ix_return_invoice_items_source_invoice_item_return", table_name="return_invoice_items")
    op.drop_index("ix_return_invoice_items_return_invoice_id_id", table_name="return_invoice_items")
    op.drop_table("return_invoice_items")

    op.drop_index("ix_return_invoices_source_invoice_datetime_id", table_name="return_invoices")
    op.drop_index("ix_return_invoices_customer_datetime_id", table_name="return_invoices")
    op.drop_index("ix_return_invoices_return_datetime_id", table_name="return_invoices")
    op.drop_table("return_invoices")

    op.drop_index("ix_invoice_items_product_invoice", table_name="invoice_items")
    op.drop_index("ix_invoice_items_invoice_id_id", table_name="invoice_items")
    op.drop_table("invoice_items")

    op.drop_index("ix_invoices_status_datetime", table_name="invoices")
    op.drop_index("ix_invoices_customer_datetime_id", table_name="invoices")
    op.drop_index("ix_invoices_invoice_datetime_id", table_name="invoices")
    op.drop_table("invoices")

    op.drop_table("document_counters")
