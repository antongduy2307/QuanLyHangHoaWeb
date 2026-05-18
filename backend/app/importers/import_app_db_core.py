from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.importers.app_db_core_importer import import_app_db_core


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import Phase 2 inventory/customer core data from desktop app.db.")
    parser.add_argument("--app-db", required=True, help="Path to the desktop SQLite app.db copy.")
    parser.add_argument("--database-url", required=True, help="Target database URL. Actual imports require an empty target.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and build an import plan without writing target data.")
    parser.add_argument("--json-out", help="Optional path where the JSON import report should be written.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    app_db_path = Path(args.app_db)
    if not app_db_path.exists() or not app_db_path.is_file():
        print(f"Invalid app.db path: {app_db_path}", file=sys.stderr)
        return 2

    try:
        report = import_app_db_core(
            app_db_path,
            database_url=args.database_url,
            dry_run=args.dry_run,
        )
    except Exception as exc:  # noqa: BLE001 - CLI must return stable exit codes.
        print(f"Import command failed: {exc}", file=sys.stderr)
        return 2

    if args.json_out:
        json_path = Path(args.json_out)
        json_path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(
        "Inventory/customer core import "
        f"{'dry-run' if report.dry_run else 'execution'}: "
        f"success={str(report.succeeded).lower()}, "
        f"can_import_core={str(report.validator_can_import_core).lower()}, "
        f"can_import_full_ledger={str(report.validator_can_import_full_ledger).lower()}"
    )
    print(
        "Counts: "
        f"products={report.imported_counts.products}, "
        f"product_prices={report.imported_counts.product_prices}, "
        f"inventory_balances={report.imported_counts.inventory_balances}, "
        f"customers={report.imported_counts.customers}, "
        f"debt_payments={report.imported_counts.debt_payments}, "
        f"customer_ledgers={report.imported_counts.customer_ledgers}"
    )
    print(
        "Deferred: "
        f"sales_return_ledgers={report.deferred_counts.deferred_sales_return_ledgers}, "
        f"ambiguous_debt_payment_groups={report.deferred_counts.ambiguous_debt_payment_groups}, "
        f"unsupported_core_ledgers={report.deferred_counts.unsupported_core_ledgers}"
    )
    if report.errors:
        print("Errors: " + " | ".join(report.errors), file=sys.stderr)
    if report.warnings:
        print("Warnings: " + " | ".join(report.warnings))

    return 0 if report.succeeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
