"""Add debt payments table.

Revision ID: 20260515_0002
Revises: 20260515_0001
Create Date: 2026-05-15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260515_0002"
down_revision: str | None = "20260515_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "debt_payments",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("customer_id", sa.BigInteger(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("payment_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_debt_payments_amount_positive"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_debt_payments_customer_id"), "debt_payments", ["customer_id"], unique=False)
    op.create_index(
        "ix_debt_payments_customer_timeline",
        "debt_payments",
        ["customer_id", "payment_datetime", "id"],
        unique=False,
    )
    op.create_index(
        "ix_debt_payments_customer_deleted",
        "debt_payments",
        ["customer_id", "is_deleted"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_debt_payments_customer_deleted", table_name="debt_payments")
    op.drop_index("ix_debt_payments_customer_timeline", table_name="debt_payments")
    op.drop_index(op.f("ix_debt_payments_customer_id"), table_name="debt_payments")
    op.drop_table("debt_payments")
