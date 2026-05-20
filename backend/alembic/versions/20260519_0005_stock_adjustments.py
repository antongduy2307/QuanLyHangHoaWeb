"""Add stock adjustment audit table.

Revision ID: 20260519_0005
Revises: 20260517_0004
Create Date: 2026-05-19
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision: str = "20260519_0005"
down_revision: str | None = "20260517_0004"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "stock_adjustments",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("adjustment_datetime", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("movement_type", sa.String(length=32), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("quantity_delta", sa.Numeric(14, 3), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 3), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("movement_type IN ('STOCK_INCREASE', 'STOCK_DECREASE')", name="ck_stock_adjustments_movement_type_valid"),
        sa.CheckConstraint("unit_type IN ('BAO', 'KG', 'BICH')", name="ck_stock_adjustments_unit_type_valid"),
        sa.CheckConstraint("quantity > 0", name="ck_stock_adjustments_quantity_positive"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_adjustments_product_id", "stock_adjustments", ["product_id"])
    op.create_index(
        "ix_stock_adjustments_product_datetime_id",
        "stock_adjustments",
        ["product_id", "adjustment_datetime", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_stock_adjustments_product_datetime_id", table_name="stock_adjustments")
    op.drop_index("ix_stock_adjustments_product_id", table_name="stock_adjustments")
    op.drop_table("stock_adjustments")
