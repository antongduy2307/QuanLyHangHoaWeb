from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260526_0008_attendance_batch_a_foundation.py"


def test_attendance_batch_a_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_attendance_batch_a_migration_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in ("attendance_employees", "attendance_periods"):
        assert f'op.create_table(\n        "{table_name}"' in migration_text


def test_attendance_batch_a_migration_contains_expected_constraints_and_indexes() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for expected_name in (
        "ck_attendance_employees_display_name_not_blank",
        "ck_attendance_employees_team_known",
        "uq_attendance_employees_display_name",
        "uq_attendance_employees_user_id",
        "ix_attendance_employees_display_name",
        "ix_attendance_employees_team_is_active",
        "uq_attendance_periods_start_end",
        "ck_attendance_periods_date_order",
        "ix_attendance_periods_start_date",
        "ix_attendance_periods_end_date",
        "ix_attendance_periods_locked",
    ):
        assert expected_name in migration_text
