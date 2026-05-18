from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.importers.app_db_inventory_customer_validator import validate_app_db


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate desktop QuanLyHangHoa app.db inventory/customer data.")
    parser.add_argument("--app-db", required=True, help="Path to the desktop SQLite app.db file.")
    parser.add_argument("--json-out", help="Optional path where a JSON validation report should be written.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    app_db_path = Path(args.app_db)
    if not app_db_path.exists() or not app_db_path.is_file():
        print(f"Invalid app.db path: {app_db_path}", file=sys.stderr)
        return 2

    try:
        result = validate_app_db(app_db_path)
    except OSError as exc:
        print(f"Could not read app.db: {exc}", file=sys.stderr)
        return 2

    if args.json_out:
        json_path = Path(args.json_out)
        json_path.write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    summary = result.summary
    print(
        "Inventory/customer app.db validation: "
        f"{summary.error_count} errors, {summary.warning_count} warnings, {summary.info_count} info notes. "
        f"can_import_core={str(result.can_import_core).lower()}, "
        f"can_import_full_ledger={str(result.can_import_full_ledger).lower()}"
    )
    print(
        "Rows: "
        f"products={summary.product_count}, product_prices={summary.product_price_count}, "
        f"inventory_balances={summary.inventory_balance_count}, customers={summary.customer_count}, "
        f"ledgers={summary.ledger_count}"
    )
    print(
        "Ledger readiness: "
        f"affected_mismatch_customers={summary.affected_ledger_mismatch_customer_count}, "
        f"deferred_mismatches={summary.deferred_ledger_mismatch_count}, "
        f"blocking_mismatches={summary.blocking_ledger_mismatch_count}, "
        f"current_balance_matches={summary.customers_current_balance_matched_count}, "
        f"current_balance_mismatches={summary.customers_current_balance_mismatch_count}"
    )
    return 0 if result.can_import_core else 1


if __name__ == "__main__":
    raise SystemExit(main())
