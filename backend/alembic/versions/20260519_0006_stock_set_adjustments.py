"""Allow set-to-target stock adjustment movement type.

Revision ID: 20260519_0006
Revises: 20260519_0005
Create Date: 2026-05-19
"""

from __future__ import annotations

from alembic import op


revision: str = "20260519_0006"
down_revision: str | None = "20260519_0005"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_constraint("ck_stock_adjustments_movement_type_valid", "stock_adjustments", type_="check")
    op.create_check_constraint(
        "ck_stock_adjustments_movement_type_valid",
        "stock_adjustments",
        "movement_type IN ('STOCK_INCREASE', 'STOCK_DECREASE', 'STOCK_SET')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_stock_adjustments_movement_type_valid", "stock_adjustments", type_="check")
    op.create_check_constraint(
        "ck_stock_adjustments_movement_type_valid",
        "stock_adjustments",
        "movement_type IN ('STOCK_INCREASE', 'STOCK_DECREASE')",
    )
