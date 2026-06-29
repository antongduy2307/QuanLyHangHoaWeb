from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


EXPECTED_TABLES = [
    "employees",
    "periods",
    "employee_shift_periods",
    "daily_records",
    "work_types",
    "work_logs",
    "bag_types",
    "cut_logs",
    "extra_cut_work_logs",
]

DEFAULT_SOURCE_CANDIDATES = [
    Path(r"E:\QuanLyHangHoaWeb\QuanLyHangHoa\attendance.db"),
    Path.home() / "AppData" / "Local" / "QuanLyHangHoa" / "attendance.db",
]


@dataclass(frozen=True, slots=True)
class TableProfile:
    row_count: int
    columns: list[dict[str, Any]]
    foreign_keys: list[dict[str, Any]]
    samples: list[dict[str, Any]]


@dataclass(frozen=True, slots=True)
class AttendanceImportDryRunReport:
    source_db_path: str
    source_exists: bool
    dry_run: bool
    expected_tables: list[str] = field(default_factory=list)
    missing_tables: list[str] = field(default_factory=list)
    table_profiles: dict[str, TableProfile] = field(default_factory=dict)
    mapping_plan: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    validation_checklist: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["table_profiles"] = {
            table: asdict(profile) for table, profile in self.table_profiles.items()
        }
        return payload


def detect_source_path(explicit_path: str | None) -> Path | None:
    if explicit_path:
        candidate = Path(explicit_path).expanduser()
        return candidate if candidate.exists() else candidate
    for candidate in DEFAULT_SOURCE_CANDIDATES:
        if candidate.exists():
            return candidate
    return DEFAULT_SOURCE_CANDIDATES[0]


def open_readonly_connection(source_path: Path) -> sqlite3.Connection:
    uri = f"file:{source_path.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def load_table_profile(connection: sqlite3.Connection, table: str, sample_limit: int) -> TableProfile:
    row_count = int(connection.execute(f'SELECT COUNT(*) AS c FROM "{table}"').fetchone()["c"])
    columns = [dict(row) for row in connection.execute(f'PRAGMA table_info("{table}")').fetchall()]
    foreign_keys = [dict(row) for row in connection.execute(f'PRAGMA foreign_key_list("{table}")').fetchall()]
    rows = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}" ORDER BY 1 LIMIT {sample_limit}').fetchall()]
    samples = [_anonymize_row(table, row) for row in rows]
    return TableProfile(
        row_count=row_count,
        columns=columns,
        foreign_keys=foreign_keys,
        samples=samples,
    )


def _anonymize_row(table: str, row: dict[str, Any]) -> dict[str, Any]:
    anonymized: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, str) and key in {"name", "source_product_name_snapshot"}:
            anonymized[key] = value[:2] + "***" if value else value
        else:
            anonymized[key] = value
    if table == "daily_records" and "employee_id" in anonymized:
        anonymized["employee_id"] = f"employee#{anonymized['employee_id']}"
    return anonymized


def collect_warnings(connection: sqlite3.Connection) -> list[str]:
    warnings: list[str] = []

    duplicate_employee_names = [
        dict(row)
        for row in connection.execute(
            "SELECT name, COUNT(*) AS c FROM employees GROUP BY name HAVING COUNT(*) > 1 ORDER BY name"
        ).fetchall()
    ]
    if duplicate_employee_names:
        warnings.append(
            "Duplicate employee names found in legacy source: "
            + ", ".join(f"{row['name']} ({row['c']})" for row in duplicate_employee_names)
        )

    mojibake_rows = [
        dict(row)
        for row in connection.execute(
            """
            SELECT 'employees' AS table_name, id, name
            FROM employees
            WHERE name LIKE '%Ã%' OR name LIKE '%Æ%' OR name LIKE '%Ä%'
            UNION ALL
            SELECT 'work_types' AS table_name, id, name
            FROM work_types
            WHERE name LIKE '%Ã%' OR name LIKE '%Æ%' OR name LIKE '%Ä%'
            UNION ALL
            SELECT 'bag_types' AS table_name, id, name
            FROM bag_types
            WHERE name LIKE '%Ã%' OR name LIKE '%Æ%' OR name LIKE '%Ä%'
            ORDER BY table_name, id
            """
        ).fetchall()
    ]
    if mojibake_rows:
        warnings.append(
            f"Potential mojibake found in {len(mojibake_rows)} legacy name rows; manual normalization is required before final import."
        )

    status_counts = {
        row["status"]: int(row["c"])
        for row in connection.execute(
            "SELECT status, COUNT(*) AS c FROM daily_records GROUP BY status ORDER BY status"
        ).fetchall()
    }
    if status_counts.get("draft", 0) > 0:
        warnings.append(f"Legacy source contains {status_counts['draft']} draft daily records that must remain draft after import.")

    absent_count = int(connection.execute("SELECT COUNT(*) AS c FROM daily_records WHERE is_absent = 1").fetchone()["c"])
    if absent_count > 0:
        warnings.append(f"Legacy source contains {absent_count} absent daily records that must import with zero totals and no active effects.")

    bag_type_link_counts = [
        dict(row)
        for row in connection.execute(
            """
            SELECT is_product_linked, is_excluded_from_attendance, is_legacy, COUNT(*) AS c
            FROM bag_types
            GROUP BY is_product_linked, is_excluded_from_attendance, is_legacy
            ORDER BY is_product_linked, is_excluded_from_attendance, is_legacy
            """
        ).fetchall()
    ]
    if bag_type_link_counts:
        warnings.append(
            "Legacy bag_types contain mixed product-linked/excluded/legacy states; validate product mapping before recreating inventory effects."
        )

    daily_total_sum = connection.execute(
        "SELECT COALESCE(SUM(total_amount_snapshot), 0) AS s FROM daily_records"
    ).fetchone()["s"]
    cut_log_amount_sum = connection.execute(
        "SELECT COALESCE(SUM(amount_snapshot), 0) AS s FROM cut_logs"
    ).fetchone()["s"]
    if str(cut_log_amount_sum) == "0":
        warnings.append(
            f"Legacy cut_logs.amount_snapshot sums to {cut_log_amount_sum}; treat daily_records.total_amount_snapshot ({daily_total_sum}) as authoritative for CUT payroll parity."
        )

    linked_without_source_name = int(
        connection.execute(
            """
            SELECT COUNT(*) AS c
            FROM bag_types
            WHERE is_product_linked = 1
              AND source_product_id IS NOT NULL
              AND (source_product_name_snapshot IS NULL OR TRIM(source_product_name_snapshot) = '')
            """
        ).fetchone()["c"]
    )
    if linked_without_source_name > 0:
        warnings.append(
            f"{linked_without_source_name} linked bag_types are missing source_product_name_snapshot."
        )

    extra_cut_count = int(connection.execute("SELECT COUNT(*) AS c FROM extra_cut_work_logs").fetchone()["c"])
    if extra_cut_count == 0:
        warnings.append("Legacy source currently has zero extra_cut_work_logs rows; VK import path should still remain supported but may have no real data to exercise.")

    return warnings


def mapping_plan() -> dict[str, str]:
    return {
        "employees": "attendance_employees",
        "periods": "attendance_periods",
        "daily_records": "attendance_daily_records",
        "work_types": "attendance_work_types",
        "work_logs": "attendance_work_logs",
        "bag_types": "attendance_bag_types",
        "cut_logs": "attendance_cut_logs",
        "extra_cut_work_logs": "attendance_extra_cut_logs",
    }


def validation_checklist() -> list[str]:
    return [
        "employee count",
        "period count",
        "daily record count",
        "total payroll by period",
        "total payroll by month",
        "total payroll by employee",
        "blow totals",
        "cut totals",
        "absent day count",
        "finalized vs draft count",
        "inventory effect count if product-linked import is enabled",
        "source total_amount_snapshot sum vs target total_amount_snapshot sum",
    ]


def build_report(source_path: Path, sample_limit: int) -> AttendanceImportDryRunReport:
    if not source_path.exists():
        return AttendanceImportDryRunReport(
            source_db_path=str(source_path),
            source_exists=False,
            dry_run=True,
            expected_tables=EXPECTED_TABLES,
            missing_tables=EXPECTED_TABLES,
            table_profiles={},
            mapping_plan=mapping_plan(),
            warnings=[
                "Legacy attendance.db was not found. Provide the source file before attempting import implementation."
            ],
            validation_checklist=validation_checklist(),
        )

    with open_readonly_connection(source_path) as connection:
        existing_tables = {
            row["name"]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        }
        missing_tables = [table for table in EXPECTED_TABLES if table not in existing_tables]
        table_profiles = {
            table: load_table_profile(connection, table, sample_limit)
            for table in EXPECTED_TABLES
            if table in existing_tables
        }
        warnings = collect_warnings(connection)
        if missing_tables:
            warnings.append(
                "Source DB is missing expected tables: " + ", ".join(missing_tables)
            )

    return AttendanceImportDryRunReport(
        source_db_path=str(source_path),
        source_exists=True,
        dry_run=True,
        expected_tables=EXPECTED_TABLES,
        missing_tables=missing_tables,
        table_profiles=table_profiles,
        mapping_plan=mapping_plan(),
        warnings=warnings,
        validation_checklist=validation_checklist(),
    )


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(
        description="Read-only dry-run inspector for legacy attendance.db import planning."
    )
    parser.add_argument(
        "--source-db",
        help="Path to the source attendance.db. Defaults to the repo copy, then LOCALAPPDATA path.",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=3,
        help="Number of anonymized sample rows per table to include in the report.",
    )
    parser.add_argument(
        "--output-json",
        help="Optional file path to write the dry-run report JSON.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Reserved for a future disposable-target import implementation. Not enabled in this script.",
    )
    args = parser.parse_args()

    if args.apply:
        parser.error("--apply is intentionally disabled in this dry-run planning script. Implement real import only against a disposable database later.")

    source_path = detect_source_path(args.source_db)
    if source_path is None:
        parser.error("No source attendance.db candidate path is available.")

    report = build_report(source_path, max(args.sample_limit, 1))
    payload = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)

    if args.output_json:
        output_path = Path(args.output_json).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(payload, encoding="utf-8")
        print(f"Wrote dry-run report to {output_path}")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
