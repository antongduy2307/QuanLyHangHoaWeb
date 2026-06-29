"""Add attendance inventory effects.

Revision ID: 20260526_0010
Revises: 20260526_0009
Create Date: 2026-05-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260526_0010"
down_revision: str | None = "20260526_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attendance_inventory_effects",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("daily_record_id", sa.BigInteger(), nullable=False),
        sa.Column("cut_log_id", sa.BigInteger(), nullable=True),
        sa.Column("extra_cut_log_id", sa.BigInteger(), nullable=True),
        sa.Column("employee_id", sa.BigInteger(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("bag_type_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity_delta", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_type", sa.String(length=16), nullable=False),
        sa.Column("movement_datetime", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity_delta > 0", name="ck_attendance_inventory_effects_quantity_positive"),
        sa.CheckConstraint("unit_type IN ('BAO', 'BICH')", name="ck_attendance_inventory_effects_unit_type_known"),
        sa.CheckConstraint(
            "(cut_log_id IS NOT NULL AND extra_cut_log_id IS NULL) OR (cut_log_id IS NULL AND extra_cut_log_id IS NOT NULL)",
            name="ck_attendance_inventory_effects_exactly_one_source",
        ),
        sa.ForeignKeyConstraint(["bag_type_id"], ["attendance_bag_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cut_log_id"], ["attendance_cut_logs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["daily_record_id"], ["attendance_daily_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_id"], ["attendance_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["extra_cut_log_id"], ["attendance_extra_cut_logs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cut_log_id", name="uq_attendance_inventory_effects_cut_log_id"),
        sa.UniqueConstraint("extra_cut_log_id", name="uq_attendance_inventory_effects_extra_cut_log_id"),
    )
    op.create_index(
        "ix_attendance_inventory_effects_daily_record_id",
        "attendance_inventory_effects",
        ["daily_record_id"],
        unique=False,
    )
    op.create_index(
        "ix_attendance_inventory_effects_product_id",
        "attendance_inventory_effects",
        ["product_id"],
        unique=False,
    )

    op.create_check_constraint(
        "ck_attendance_bag_types_product_link_consistent",
        "attendance_bag_types",
        "(is_product_linked = false AND product_id IS NULL) OR (is_product_linked = true AND product_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_attendance_bag_types_product_link_consistent", "attendance_bag_types", type_="check")
    op.drop_index("ix_attendance_inventory_effects_product_id", table_name="attendance_inventory_effects")
    op.drop_index("ix_attendance_inventory_effects_daily_record_id", table_name="attendance_inventory_effects")
    op.drop_table("attendance_inventory_effects")
