from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.importers.app_db_sales_returns_importer import import_app_db_sales_returns


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import Phase 3 sales/returns history from desktop app.db.")
    parser.add_argument("--app-db", required=True, help="Path to the desktop SQLite app.db copy.")
    parser.add_argument("--database-url", required=True, help="Target database URL.")
    parser.add_argument("--core-import-report", required=True, help="Phase 2 core import JSON report with id mappings.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and build an import plan without writing.")
    parser.add_argument("--json-out", help="Optional path where the JSON import report should be written.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    app_db_path = Path(args.app_db)
    core_report_path = Path(args.core_import_report)
    if not app_db_path.exists() or not app_db_path.is_file():
        print(f"Invalid app.db path: {app_db_path}", file=sys.stderr)
        return 2
    if not core_report_path.exists() or not core_report_path.is_file():
        print(f"Invalid core import report path: {core_report_path}", file=sys.stderr)
        return 2
    try:
        report = import_app_db_sales_returns(
            app_db_path,
            database_url=args.database_url,
            core_import_report_path=core_report_path,
            dry_run=args.dry_run,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"Sales/returns import command failed: {exc}", file=sys.stderr)
        return 2

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(
        "Sales/returns historical import "
        f"{'dry-run' if report.dry_run else 'execution'}: "
        f"success={str(report.succeeded).lower()}, "
        f"can_import_full_ledger={str(report.can_import_full_ledger).lower()}"
    )
    print(
        "Counts: "
        f"invoices={report.imported_counts.invoices}, "
        f"invoice_items={report.imported_counts.invoice_items}, "
        f"return_invoices={report.imported_counts.return_invoices}, "
        f"return_invoice_items={report.imported_counts.return_invoice_items}, "
        f"invoice_charge_ledgers={report.imported_counts.restored_invoice_charge_ledgers}, "
        f"invoice_payment_ledgers={report.imported_counts.restored_invoice_payment_ledgers}, "
        f"return_ledgers={report.imported_counts.restored_return_ledgers}"
    )
    if report.errors:
        print("Errors: " + " | ".join(report.errors), file=sys.stderr)
    if report.warnings:
        print("Warnings: " + " | ".join(report.warnings))
    return 0 if report.succeeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
