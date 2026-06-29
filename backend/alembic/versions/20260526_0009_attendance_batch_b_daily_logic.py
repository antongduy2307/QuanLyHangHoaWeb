"""Add attendance Batch B daily logic schema.

Revision ID: 20260526_0009
Revises: 20260526_0008
Create Date: 2026-05-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260526_0009"
down_revision: str | None = "20260526_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attendance_daily_records",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("employee_id", sa.BigInteger(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("period_id", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="draft", nullable=False),
        sa.Column("is_absent", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("total_amount_snapshot", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("legacy_daily_record_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'done')", name="ck_attendance_daily_records_status_known"),
        sa.CheckConstraint("total_amount_snapshot >= 0", name="ck_attendance_daily_records_total_amount_non_negative"),
        sa.ForeignKeyConstraint(["employee_id"], ["attendance_employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["period_id"], ["attendance_periods.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_id", "work_date", name="uq_attendance_daily_records_employee_work_date"),
    )
    op.create_index("ix_attendance_daily_records_work_date", "attendance_daily_records", ["work_date"], unique=False)
    op.create_index("ix_attendance_daily_records_employee_date", "attendance_daily_records", ["employee_id", "work_date"], unique=False)
    op.create_index("ix_attendance_daily_records_period_status", "attendance_daily_records", ["period_id", "status"], unique=False)

    op.create_table(
        "attendance_work_types",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("team", sa.String(length=16), server_default="blow", nullable=False),
        sa.Column("input_type", sa.String(length=32), nullable=False),
        sa.Column("pricing_rule", sa.String(length=64), nullable=False),
        sa.Column("quota_quantity", sa.Numeric(14, 2), nullable=True),
        sa.Column("unit_price", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("exclusive_group", sa.String(length=64), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("legacy_work_type_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("team IN ('blow', 'cut')", name="ck_attendance_work_types_team_known"),
        sa.CheckConstraint("team = 'blow'", name="ck_attendance_work_types_team_blow"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_attendance_work_types_name_not_blank"),
        sa.CheckConstraint("input_type IN ('tick', 'quantity')", name="ck_attendance_work_types_input_type_known"),
        sa.CheckConstraint(
            "pricing_rule IN ('flat_tick', 'quantity_full', 'quantity_excess_over_quota')",
            name="ck_attendance_work_types_pricing_rule_known",
        ),
        sa.CheckConstraint("quota_quantity IS NULL OR quota_quantity >= 0", name="ck_attendance_work_types_quota_non_negative"),
        sa.CheckConstraint("unit_price >= 0", name="ck_attendance_work_types_unit_price_non_negative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team", "name", name="uq_attendance_work_types_team_name"),
    )
    op.create_index("ix_attendance_work_types_team_active", "attendance_work_types", ["team", "is_active"], unique=False)

    op.create_table(
        "attendance_bag_types",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=True),
        sa.Column("source_product_name_snapshot", sa.String(length=255), nullable=True),
        sa.Column("quota_quantity", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("excess_unit_price", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_product_linked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_excluded_from_attendance", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_legacy", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("legacy_bag_type_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_attendance_bag_types_name_not_blank"),
        sa.CheckConstraint("quota_quantity >= 0", name="ck_attendance_bag_types_quota_non_negative"),
        sa.CheckConstraint("excess_unit_price >= 0", name="ck_attendance_bag_types_excess_price_non_negative"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_attendance_bag_types_name"),
        sa.UniqueConstraint("product_id", name="uq_attendance_bag_types_product_id"),
    )
    op.create_index("ix_attendance_bag_types_active", "attendance_bag_types", ["is_active"], unique=False)

    op.create_table(
        "attendance_work_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("daily_record_id", sa.BigInteger(), nullable=False),
        sa.Column("work_type_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity >= 0", name="ck_attendance_work_logs_quantity_non_negative"),
        sa.CheckConstraint("unit_price_snapshot >= 0", name="ck_attendance_work_logs_unit_price_non_negative"),
        sa.CheckConstraint("amount_snapshot >= 0", name="ck_attendance_work_logs_amount_non_negative"),
        sa.ForeignKeyConstraint(["daily_record_id"], ["attendance_daily_records.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["work_type_id"], ["attendance_work_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("daily_record_id", "work_type_id", name="uq_attendance_work_logs_daily_work_type"),
    )
    op.create_index("ix_attendance_work_logs_daily_record_id", "attendance_work_logs", ["daily_record_id"], unique=False)

    op.create_table(
        "attendance_cut_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("daily_record_id", sa.BigInteger(), nullable=False),
        sa.Column("bag_type_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("quota_quantity_snapshot", sa.Numeric(14, 2), nullable=True),
        sa.Column("excess_unit_price_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_snapshot", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity >= 0", name="ck_attendance_cut_logs_quantity_non_negative"),
        sa.CheckConstraint(
            "quota_quantity_snapshot IS NULL OR quota_quantity_snapshot >= 0",
            name="ck_attendance_cut_logs_quota_snapshot_non_negative",
        ),
        sa.CheckConstraint(
            "excess_unit_price_snapshot >= 0",
            name="ck_attendance_cut_logs_excess_snapshot_non_negative",
        ),
        sa.CheckConstraint("amount_snapshot >= 0", name="ck_attendance_cut_logs_amount_non_negative"),
        sa.ForeignKeyConstraint(["bag_type_id"], ["attendance_bag_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["daily_record_id"], ["attendance_daily_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("daily_record_id", "bag_type_id", name="uq_attendance_cut_logs_daily_bag_type"),
    )
    op.create_index("ix_attendance_cut_logs_daily_record_id", "attendance_cut_logs", ["daily_record_id"], unique=False)

    op.create_table(
        "attendance_extra_cut_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("daily_record_id", sa.BigInteger(), nullable=False),
        sa.Column("bag_type_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False),
        sa.Column("excess_unit_price_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount_snapshot", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_attendance_extra_cut_logs_quantity_positive"),
        sa.CheckConstraint(
            "excess_unit_price_snapshot >= 0",
            name="ck_attendance_extra_cut_logs_excess_snapshot_non_negative",
        ),
        sa.CheckConstraint("amount_snapshot >= 0", name="ck_attendance_extra_cut_logs_amount_non_negative"),
        sa.ForeignKeyConstraint(["bag_type_id"], ["attendance_bag_types.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["daily_record_id"], ["attendance_daily_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("daily_record_id", "bag_type_id", name="uq_attendance_extra_cut_logs_daily_bag_type"),
    )
    op.create_index("ix_attendance_extra_cut_logs_daily_record_id", "attendance_extra_cut_logs", ["daily_record_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_attendance_extra_cut_logs_daily_record_id", table_name="attendance_extra_cut_logs")
    op.drop_table("attendance_extra_cut_logs")

    op.drop_index("ix_attendance_cut_logs_daily_record_id", table_name="attendance_cut_logs")
    op.drop_table("attendance_cut_logs")

    op.drop_index("ix_attendance_work_logs_daily_record_id", table_name="attendance_work_logs")
    op.drop_table("attendance_work_logs")

    op.drop_index("ix_attendance_bag_types_active", table_name="attendance_bag_types")
    op.drop_table("attendance_bag_types")

    op.drop_index("ix_attendance_work_types_team_active", table_name="attendance_work_types")
    op.drop_table("attendance_work_types")

    op.drop_index("ix_attendance_daily_records_period_status", table_name="attendance_daily_records")
    op.drop_index("ix_attendance_daily_records_employee_date", table_name="attendance_daily_records")
    op.drop_index("ix_attendance_daily_records_work_date", table_name="attendance_daily_records")
    op.drop_table("attendance_daily_records")
