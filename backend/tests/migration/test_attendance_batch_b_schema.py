from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260526_0009_attendance_batch_b_daily_logic.py"


def test_attendance_batch_b_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_attendance_batch_b_migration_creates_expected_tables() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for table_name in (
        "attendance_daily_records",
        "attendance_work_types",
        "attendance_bag_types",
        "attendance_work_logs",
        "attendance_cut_logs",
        "attendance_extra_cut_logs",
    ):
        assert f'op.create_table(\n        "{table_name}"' in migration_text


def test_attendance_batch_b_migration_contains_expected_constraints_and_indexes() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")

    for expected_name in (
        "uq_attendance_daily_records_employee_work_date",
        "ck_attendance_daily_records_status_known",
        "ix_attendance_daily_records_employee_date",
        "ck_attendance_work_types_pricing_rule_known",
        "uq_attendance_work_types_team_name",
        "ix_attendance_work_types_team_active",
        "uq_attendance_bag_types_name",
        "ck_attendance_bag_types_excess_price_non_negative",
        "uq_attendance_work_logs_daily_work_type",
        "uq_attendance_cut_logs_daily_bag_type",
        "uq_attendance_extra_cut_logs_daily_bag_type",
    ):
        assert expected_name in migration_text
