from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection


def verify_full_import_rehearsal(
    *,
    app_db_path: str | Path,
    database_url: str,
    core_import_report_path: str | Path,
    sales_returns_import_report_path: str | Path,
) -> dict[str, Any]:
    source_path = Path(app_db_path)
    core_report = json.loads(Path(core_import_report_path).read_text(encoding="utf-8"))
    sales_report = json.loads(Path(sales_returns_import_report_path).read_text(encoding="utf-8"))
    expected = _source_expected_counts(source_path)
    source_inventory = _source_inventory_snapshot(source_path)
    source_balances = _source_customer_balances(source_path)
    product_map = {str(old_id): int(new_id) for old_id, new_id in core_report["product_id_map"].items()}
    customer_map = {str(old_id): int(new_id) for old_id, new_id in core_report["customer_id_map"].items()}

    engine = create_engine(database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            actual = _target_counts(connection)
            target_inventory = _target_inventory_snapshot(connection, product_map)
            target_balances = _target_customer_balances(connection, customer_map)
            recomputed_balances = _recomputed_customer_balances(connection)
            checks = {
                "products_count": actual["products"] == expected["products"],
                "product_prices_count": actual["product_prices"] == expected["product_prices"],
                "inventory_balances_count": actual["inventory_balances"] == expected["inventory_balances"],
                "customers_count": actual["customers"] == expected["customers"],
                "standalone_core_debt_payments_count": core_report["imported_counts"]["debt_payments"]
                == expected["standalone_debt_payment_groups"],
                "core_customer_ledgers_count": core_report["imported_counts"]["customer_ledgers"] == expected["core_ledgers"],
                "invoices_count": actual["invoices"] == expected["invoices"],
                "invoice_items_count": actual["invoice_items"] == expected["invoice_items"],
                "return_invoices_count": actual["return_invoices"] == expected["return_invoices"],
                "return_invoice_items_count": actual["return_invoice_items"] == expected["return_invoice_items"],
                "total_debt_payments_count": actual["debt_payments"]
                == expected["standalone_debt_payment_groups"] + expected["invoice_payment_ledgers"],
                "total_customer_ledgers_count": actual["customer_balance_ledgers"]
                == expected["core_ledgers"]
                + expected["invoice_charge_ledgers"]
                + expected["invoice_payment_ledgers"]
                + expected["return_ledgers"],
                "invoice_charge_ledgers_count": sales_report["imported_counts"]["restored_invoice_charge_ledgers"]
                == expected["invoice_charge_ledgers"],
                "invoice_payment_ledgers_count": sales_report["imported_counts"]["restored_invoice_payment_ledgers"]
                == expected["invoice_payment_ledgers"],
                "created_source_linked_debt_payments_count": sales_report["imported_counts"][
                    "created_source_linked_debt_payments"
                ]
                == expected["invoice_payment_ledgers"],
                "no_orphan_invoice_items": _scalar(connection, _ORPHAN_INVOICE_ITEMS_SQL) == 0,
                "no_orphan_ledger_customers": _scalar(connection, _ORPHAN_LEDGER_CUSTOMERS_SQL) == 0,
                "no_orphan_invoice_ledgers": _scalar(connection, _ORPHAN_INVOICE_LEDGERS_SQL) == 0,
                "no_orphan_invoice_payment_ledgers": _scalar(connection, _ORPHAN_INVOICE_PAYMENT_LEDGERS_SQL) == 0,
                "no_duplicate_product_codes": _scalar(connection, _DUPLICATE_PRODUCT_CODES_SQL) == 0,
                "no_duplicate_price_units": _scalar(connection, _DUPLICATE_PRICE_UNITS_SQL) == 0,
                "no_duplicate_inventory_balances": _scalar(connection, _DUPLICATE_INVENTORY_BALANCES_SQL) == 0,
                "no_duplicate_invoice_codes": _scalar(connection, _DUPLICATE_INVOICE_CODES_SQL) == 0,
                "no_duplicate_return_codes": _scalar(connection, _DUPLICATE_RETURN_CODES_SQL) == 0,
                "inventory_snapshot_match": target_inventory == source_inventory,
                "customer_snapshot_match": target_balances == source_balances,
                "full_recomputed_balances_match": all(
                    recomputed_balances.get(new_id, Decimal("0")) == source_balances[int(old_id)]
                    for old_id, new_id in customer_map.items()
                ),
                "sales_report_can_import_full_ledger": sales_report.get("can_import_full_ledger") is True,
                "sales_report_final_balance_mismatches_zero": sales_report["reconciliation"][
                    "final_balance_mismatches"
                ]
                == 0,
                "sales_report_inventory_unchanged": sales_report["reconciliation"]["inventory_balance_unchanged"] is True,
            }
    finally:
        engine.dispose()

    return {
        "source_app_db": str(source_path),
        "database_url": database_url,
        "expected": expected,
        "actual": actual,
        "checks": checks,
        "all_passed": all(checks.values()),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify Phase 2 + Phase 3 full import rehearsal state.")
    parser.add_argument("--app-db", required=True)
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--core-import-report", required=True)
    parser.add_argument("--sales-returns-import-report", required=True)
    parser.add_argument("--json-out")
    args = parser.parse_args(argv)

    try:
        result = verify_full_import_rehearsal(
            app_db_path=args.app_db,
            database_url=args.database_url,
            core_import_report_path=args.core_import_report,
            sales_returns_import_report_path=args.sales_returns_import_report,
        )
    except Exception as exc:  # noqa: BLE001 - CLI should return stable exit codes.
        print(f"Verification failed to run: {exc}")
        return 2

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")

    print(
        "Full import rehearsal verification: "
        f"all_passed={str(result['all_passed']).lower()}, "
        f"products={result['actual']['products']}, "
        f"customers={result['actual']['customers']}, "
        f"invoices={result['actual']['invoices']}, "
        f"customer_ledgers={result['actual']['customer_balance_ledgers']}, "
        f"debt_payments={result['actual']['debt_payments']}"
    )
    failed = [name for name, passed in result["checks"].items() if not passed]
    if failed:
        print("Failed checks: " + ", ".join(failed))
        return 1
    return 0


def _source_expected_counts(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        ledgers = list(connection.execute("SELECT * FROM customer_balance_ledgers"))
        deferred_ledgers = [row for row in ledgers if _is_deferred(row)]
        core_ledgers = [row for row in ledgers if not _is_deferred(row)]
        return {
            "products": _count(connection, "products"),
            "product_prices": _count(connection, "product_prices"),
            "inventory_balances": _count(connection, "inventory_balances"),
            "customers": _count(connection, "customers"),
            "invoices": _count(connection, "invoices"),
            "invoice_items": _count(connection, "invoice_items"),
            "return_invoices": _count(connection, "return_invoices"),
            "return_invoice_items": _count(connection, "return_invoice_items"),
            "core_ledgers": len(core_ledgers),
            "deferred_ledgers": len(deferred_ledgers),
            "standalone_debt_payment_groups": len(
                {
                    int(row["ref_id"])
                    for row in core_ledgers
                    if str(row["ref_type"]).upper() == "DEBT_PAYMENT"
                    and str(row["event_type"]).upper() == "DEBT_PAYMENT"
                    and Decimal(str(row["amount_delta"])) < 0
                }
            ),
            "invoice_charge_ledgers": sum(1 for row in deferred_ledgers if str(row["ref_type"]).upper() == "INVOICE"),
            "invoice_payment_ledgers": sum(
                1
                for row in deferred_ledgers
                if str(row["ref_type"]).upper() == "DEBT_PAYMENT"
                and str(row["source_ref_type"]).upper() == "INVOICE"
            ),
            "return_ledgers": sum(
                1
                for row in deferred_ledgers
                if str(row["ref_type"]).upper() in {"RETURN", "RETURN_INVOICE"}
                or str(row["source_ref_type"]).upper() in {"RETURN", "RETURN_INVOICE"}
            ),
        }


def _count(connection: sqlite3.Connection, table: str) -> int:
    return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def _is_deferred(row: sqlite3.Row) -> bool:
    ref_type = str(row["ref_type"] or "").upper()
    source_ref_type = str(row["source_ref_type"] or "").upper()
    note = str(row["note"] or "").lower()
    return (
        ref_type in {"INVOICE", "RETURN", "RETURN_INVOICE"}
        or source_ref_type in {"INVOICE", "RETURN", "RETURN_INVOICE"}
        or "overpayment from invoice" in note
    )


def _source_inventory_snapshot(path: Path) -> dict[str, tuple[Decimal | None, Decimal | None]]:
    with sqlite3.connect(path) as connection:
        return {
            str(row[0]): (_decimal_or_none(row[1]), _decimal_or_none(row[2]))
            for row in connection.execute(
                "SELECT product_id, on_hand_bao_decimal, on_hand_bich_integer FROM inventory_balances"
            )
        }


def _source_customer_balances(path: Path) -> dict[int, Decimal]:
    with sqlite3.connect(path) as connection:
        return {
            int(row[0]): Decimal(str(row[1]))
            for row in connection.execute("SELECT id, current_balance FROM customers")
        }


def _decimal_or_none(value: object) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _target_counts(connection: Connection) -> dict[str, int]:
    tables = [
        "products",
        "product_prices",
        "inventory_balances",
        "customers",
        "debt_payments",
        "customer_balance_ledgers",
        "invoices",
        "invoice_items",
        "return_invoices",
        "return_invoice_items",
    ]
    return {
        table: int(connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one())
        for table in tables
    }


def _target_inventory_snapshot(
    connection: Connection,
    product_map: dict[str, int],
) -> dict[str, tuple[Decimal | None, Decimal | None]]:
    snapshot = {}
    for old_id, new_id in product_map.items():
        row = connection.execute(
            text(
                """
                SELECT on_hand_bao_decimal, on_hand_bich_integer
                FROM inventory_balances
                WHERE product_id = :product_id
                """
            ),
            {"product_id": new_id},
        ).one()
        snapshot[old_id] = (row[0], row[1])
    return snapshot


def _target_customer_balances(
    connection: Connection,
    customer_map: dict[str, int],
) -> dict[int, Decimal]:
    balances = {}
    for old_id, new_id in customer_map.items():
        balances[int(old_id)] = connection.execute(
            text("SELECT current_balance FROM customers WHERE id = :customer_id"),
            {"customer_id": new_id},
        ).scalar_one()
    return balances


def _recomputed_customer_balances(connection: Connection) -> dict[int, Decimal]:
    totals: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for customer_id, amount in connection.execute(
        text("SELECT customer_id, amount_delta FROM customer_balance_ledgers")
    ):
        totals[int(customer_id)] += amount
    return dict(totals)


def _scalar(connection: Connection, sql: str) -> int:
    return int(connection.execute(text(sql)).scalar_one())


_ORPHAN_INVOICE_ITEMS_SQL = """
SELECT COUNT(*)
FROM invoice_items item
LEFT JOIN invoices invoice ON invoice.id = item.invoice_id
WHERE invoice.id IS NULL
"""

_ORPHAN_LEDGER_CUSTOMERS_SQL = """
SELECT COUNT(*)
FROM customer_balance_ledgers ledger
LEFT JOIN customers customer ON customer.id = ledger.customer_id
WHERE customer.id IS NULL
"""

_ORPHAN_INVOICE_LEDGERS_SQL = """
SELECT COUNT(*)
FROM customer_balance_ledgers ledger
LEFT JOIN invoices invoice ON invoice.id = ledger.ref_id
WHERE ledger.ref_type = 'INVOICE' AND invoice.id IS NULL
"""

_ORPHAN_INVOICE_PAYMENT_LEDGERS_SQL = """
SELECT COUNT(*)
FROM customer_balance_ledgers ledger
LEFT JOIN debt_payments payment ON payment.id = ledger.ref_id
LEFT JOIN invoices invoice ON invoice.id = ledger.source_ref_id
WHERE ledger.ref_type = 'DEBT_PAYMENT'
  AND ledger.source_ref_type = 'INVOICE'
  AND (payment.id IS NULL OR invoice.id IS NULL)
"""

_DUPLICATE_PRODUCT_CODES_SQL = """
SELECT COUNT(*)
FROM (
    SELECT product_code_base
    FROM products
    GROUP BY product_code_base
    HAVING COUNT(*) > 1
) duplicate_rows
"""

_DUPLICATE_PRICE_UNITS_SQL = """
SELECT COUNT(*)
FROM (
    SELECT product_id, unit_type
    FROM product_prices
    GROUP BY product_id, unit_type
    HAVING COUNT(*) > 1
) duplicate_rows
"""

_DUPLICATE_INVENTORY_BALANCES_SQL = """
SELECT COUNT(*)
FROM (
    SELECT product_id
    FROM inventory_balances
    GROUP BY product_id
    HAVING COUNT(*) > 1
) duplicate_rows
"""

_DUPLICATE_INVOICE_CODES_SQL = """
SELECT COUNT(*)
FROM (
    SELECT invoice_code
    FROM invoices
    GROUP BY invoice_code
    HAVING COUNT(*) > 1
) duplicate_rows
"""

_DUPLICATE_RETURN_CODES_SQL = """
SELECT COUNT(*)
FROM (
    SELECT return_code
    FROM return_invoices
    GROUP BY return_code
    HAVING COUNT(*) > 1
) duplicate_rows
"""


if __name__ == "__main__":
    raise SystemExit(main())
