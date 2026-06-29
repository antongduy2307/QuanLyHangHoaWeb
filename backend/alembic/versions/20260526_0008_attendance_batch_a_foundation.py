"""Add attendance Batch A foundation schema.

Revision ID: 20260526_0008
Revises: 20260521_0007
Create Date: 2026-05-26
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260526_0008"
down_revision: str | None = "20260521_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attendance_employees",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("team", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("legacy_employee_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "length(trim(display_name)) > 0",
            name="ck_attendance_employees_display_name_not_blank",
        ),
        sa.CheckConstraint(
            "team IN ('blow', 'cut')",
            name="ck_attendance_employees_team_known",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("display_name", name="uq_attendance_employees_display_name"),
        sa.UniqueConstraint("user_id", name="uq_attendance_employees_user_id"),
    )
    op.create_index(
        "ix_attendance_employees_display_name",
        "attendance_employees",
        ["display_name"],
        unique=False,
    )
    op.create_index(
        "ix_attendance_employees_team_is_active",
        "attendance_employees",
        ["team", "is_active"],
        unique=False,
    )

    op.create_table(
        "attendance_periods",
        sa.Column("id", sa.BigInteger(), sa.Identity(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("locked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("legacy_period_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("start_date <= end_date", name="ck_attendance_periods_date_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("start_date", "end_date", name="uq_attendance_periods_start_end"),
    )
    op.create_index("ix_attendance_periods_start_date", "attendance_periods", ["start_date"], unique=False)
    op.create_index("ix_attendance_periods_end_date", "attendance_periods", ["end_date"], unique=False)
    op.create_index("ix_attendance_periods_locked", "attendance_periods", ["locked"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_attendance_periods_locked", table_name="attendance_periods")
    op.drop_index("ix_attendance_periods_end_date", table_name="attendance_periods")
    op.drop_index("ix_attendance_periods_start_date", table_name="attendance_periods")
    op.drop_table("attendance_periods")

    op.drop_index("ix_attendance_employees_team_is_active", table_name="attendance_employees")
    op.drop_index("ix_attendance_employees_display_name", table_name="attendance_employees")
    op.drop_table("attendance_employees")
