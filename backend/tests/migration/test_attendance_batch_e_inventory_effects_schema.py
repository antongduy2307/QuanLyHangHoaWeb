from __future__ import annotations

from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = BACKEND_ROOT / "alembic" / "versions" / "20260526_0010_attendance_inventory_effects.py"


def test_attendance_batch_e_migration_script_exists() -> None:
    assert MIGRATION_PATH.exists()


def test_attendance_batch_e_migration_creates_inventory_effects_table() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")
    assert 'op.create_table(\n        "attendance_inventory_effects"' in migration_text


def test_attendance_batch_e_migration_contains_expected_constraints() -> None:
    migration_text = MIGRATION_PATH.read_text(encoding="utf-8")
    for expected_name in (
        "ck_attendance_inventory_effects_quantity_positive",
        "ck_attendance_inventory_effects_unit_type_known",
        "ck_attendance_inventory_effects_exactly_one_source",
        "uq_attendance_inventory_effects_cut_log_id",
        "uq_attendance_inventory_effects_extra_cut_log_id",
        "ix_attendance_inventory_effects_daily_record_id",
        "ix_attendance_inventory_effects_product_id",
        "ck_attendance_bag_types_product_link_consistent",
    ):
        assert expected_name in migration_text
