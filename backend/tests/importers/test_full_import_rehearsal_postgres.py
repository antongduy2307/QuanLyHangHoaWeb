from __future__ import annotations

import json
import shutil
import sqlite3
import uuid
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.importers.app_db_core_importer import import_app_db_core
from app.importers.app_db_sales_returns_importer import import_app_db_sales_returns
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice, InvoiceItem


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


BACKEND_ROOT = Path(__file__).resolve().parents[2]
REAL_APP_DB = BACKEND_ROOT / "validation_sources" / "real_app_copy.db"


@pytest.fixture
def work_tmp_path() -> Path:
    root = BACKEND_ROOT / ".tmp-tests" / uuid.uuid4().hex
    root.mkdir(parents=True)
    try:
        yield root
    finally:
        shutil.rmtree(root, ignore_errors=True)


def test_real_app_phase2_phase3_full_import_rehearsal(postgres_session: Session, work_tmp_path: Path) -> None:
    if not REAL_APP_DB.exists():
        pytest.skip(f"Real copied app.db is not present: {REAL_APP_DB}")
    if _target_has_import_data(postgres_session):
        pytest.skip("PostgreSQL target is not empty; use a fresh disposable TEST_DATABASE_URL for full import rehearsal.")

    expected = _source_expected_counts(REAL_APP_DB)
    source_inventory = _source_inventory_snapshot(REAL_APP_DB)
    source_balances = _source_customer_balances(REAL_APP_DB)
    core_report_path = work_tmp_path / "core_import_report.json"

    core_report = import_app_db_core(REAL_APP_DB, target_session=postgres_session)
    assert core_report.succeeded is True
    core_report_path.write_text(json.dumps(core_report.to_dict(), indent=2, default=str), encoding="utf-8")

    assert core_report.imported_counts.products == expected["products"]
    assert core_report.imported_counts.product_prices == expected["product_prices"]
    assert core_report.imported_counts.inventory_balances == expected["inventory_balances"]
    assert core_report.imported_counts.customers == expected["customers"]
    assert core_report.imported_counts.debt_payments == expected["standalone_debt_payment_groups"]
    assert core_report.imported_counts.customer_ledgers == expected["core_ledgers"]
    assert core_report.deferred_counts.deferred_sales_return_ledgers == expected["deferred_ledgers"]

    sales_report = import_app_db_sales_returns(
        REAL_APP_DB,
        core_import_report_path=core_report_path,
        target_session=postgres_session,
    )

    assert sales_report.succeeded is True
    assert sales_report.can_import_full_ledger is True
    assert sales_report.imported_counts.invoices == expected["invoices"]
    assert sales_report.imported_counts.invoice_items == expected["invoice_items"]
    assert sales_report.imported_counts.return_invoices == expected["return_invoices"]
    assert sales_report.imported_counts.return_invoice_items == expected["return_invoice_items"]
    assert sales_report.imported_counts.restored_invoice_charge_ledgers == expected["invoice_charge_ledgers"]
    assert sales_report.imported_counts.restored_invoice_payment_ledgers == expected["invoice_payment_ledgers"]
    assert sales_report.imported_counts.created_source_linked_debt_payments == expected["invoice_payment_ledgers"]
    assert sales_report.reconciliation.final_balance_mismatches == 0
    assert sales_report.reconciliation.inventory_balance_unchanged is True

    assert postgres_session.scalar(select(func.count()).select_from(Product)) == expected["products"]
    assert postgres_session.scalar(select(func.count()).select_from(ProductPrice)) == expected["product_prices"]
    assert postgres_session.scalar(select(func.count()).select_from(InventoryBalance)) == expected["inventory_balances"]
    assert postgres_session.scalar(select(func.count()).select_from(Customer)) == expected["customers"]
    assert postgres_session.scalar(select(func.count()).select_from(DebtPayment)) == expected["standalone_debt_payment_groups"] + expected["invoice_payment_ledgers"]
    assert postgres_session.scalar(select(func.count()).select_from(CustomerBalanceLedger)) == expected["core_ledgers"] + expected["invoice_charge_ledgers"] + expected["invoice_payment_ledgers"] + expected["return_ledgers"]
    assert postgres_session.scalar(select(func.count()).select_from(Invoice)) == expected["invoices"]
    assert postgres_session.scalar(select(func.count()).select_from(InvoiceItem)) == expected["invoice_items"]
    assert postgres_session.scalar(select(func.count()).select_from(ReturnInvoice)) == expected["return_invoices"]
    assert postgres_session.scalar(select(func.count()).select_from(ReturnInvoiceItem)) == expected["return_invoice_items"]

    assert _duplicate_product_codes(postgres_session) == []
    assert _duplicate_product_price_units(postgres_session) == []
    assert _duplicate_inventory_balances(postgres_session) == []
    assert _duplicate_invoice_codes(postgres_session) == []
    assert _duplicate_return_codes(postgres_session) == []
    assert _orphan_invoice_items(postgres_session) == 0
    assert _orphan_ledger_customers(postgres_session) == 0
    assert _orphan_invoice_ledgers(postgres_session) == 0
    assert _orphan_invoice_payment_ledgers(postgres_session) == 0

    imported_inventory = _imported_inventory_snapshot(postgres_session, core_report.product_id_map)
    imported_balances = {
        old_id: postgres_session.get(Customer, new_id).current_balance
        for old_id, new_id in core_report.customer_id_map.items()
    }
    assert imported_inventory == source_inventory
    assert imported_balances == source_balances
    recomputed_balances = _recomputed_customer_balances(postgres_session)
    assert all(
        recomputed_balances.get(new_id, Decimal("0")) == source_balances[old_id]
        for old_id, new_id in core_report.customer_id_map.items()
    )


def _target_has_import_data(session: Session) -> bool:
    tables = [
        "products",
        "customers",
        "customer_balance_ledgers",
        "debt_payments",
        "invoices",
        "return_invoices",
    ]
    return any(session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one() for table in tables)


def _source_expected_counts(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        ledgers = list(connection.execute("SELECT * FROM customer_balance_ledgers"))
        deferred = [row for row in ledgers if _is_deferred(row)]
        core = [row for row in ledgers if not _is_deferred(row)]
        return {
            "products": _count(connection, "products"),
            "product_prices": _count(connection, "product_prices"),
            "inventory_balances": _count(connection, "inventory_balances"),
            "customers": _count(connection, "customers"),
            "standalone_debt_payment_groups": len(
                {
                    int(row["ref_id"])
                    for row in core
                    if str(row["ref_type"]).upper() == "DEBT_PAYMENT"
                    and str(row["event_type"]).upper() == "DEBT_PAYMENT"
                    and Decimal(str(row["amount_delta"])) < 0
                }
            ),
            "core_ledgers": len(core),
            "deferred_ledgers": len(deferred),
            "invoices": _count(connection, "invoices"),
            "invoice_items": _count(connection, "invoice_items"),
            "return_invoices": _count(connection, "return_invoices"),
            "return_invoice_items": _count(connection, "return_invoice_items"),
            "invoice_charge_ledgers": sum(1 for row in deferred if str(row["ref_type"]).upper() == "INVOICE"),
            "invoice_payment_ledgers": sum(
                1
                for row in deferred
                if str(row["ref_type"]).upper() == "DEBT_PAYMENT"
                and str(row["source_ref_type"]).upper() == "INVOICE"
            ),
            "return_ledgers": sum(
                1
                for row in deferred
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


def _source_inventory_snapshot(path: Path) -> dict[int, tuple[Decimal | None, Decimal | None]]:
    with sqlite3.connect(path) as connection:
        return {
            int(row[0]): (_decimal_or_none(row[1]), _decimal_or_none(row[2]))
            for row in connection.execute("SELECT product_id, on_hand_bao_decimal, on_hand_bich_integer FROM inventory_balances")
        }


def _source_customer_balances(path: Path) -> dict[int, Decimal]:
    with sqlite3.connect(path) as connection:
        return {
            int(row[0]): Decimal(str(row[1]))
            for row in connection.execute("SELECT id, current_balance FROM customers")
        }


def _decimal_or_none(value: object) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _imported_inventory_snapshot(
    session: Session,
    product_id_map: dict[int, int],
) -> dict[int, tuple[Decimal | None, Decimal | None]]:
    rows = session.scalars(select(InventoryBalance)).all()
    new_to_old = {new_id: old_id for old_id, new_id in product_id_map.items()}
    return {
        new_to_old[row.product_id]: (row.on_hand_bao_decimal, row.on_hand_bich_integer)
        for row in rows
    }


def _recomputed_customer_balances(session: Session) -> dict[int, Decimal]:
    totals: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for ledger in session.scalars(select(CustomerBalanceLedger)):
        totals[ledger.customer_id] += ledger.amount_delta
    return dict(totals)


def _duplicate_product_codes(session: Session) -> list[str]:
    return list(
        session.scalars(
            select(Product.product_code_base)
            .group_by(Product.product_code_base)
            .having(func.count(Product.id) > 1)
        )
    )


def _duplicate_product_price_units(session: Session) -> list[tuple[int, str]]:
    return list(
        session.execute(
            select(ProductPrice.product_id, ProductPrice.unit_type)
            .group_by(ProductPrice.product_id, ProductPrice.unit_type)
            .having(func.count(ProductPrice.id) > 1)
        )
    )


def _duplicate_inventory_balances(session: Session) -> list[int]:
    return list(
        session.scalars(
            select(InventoryBalance.product_id)
            .group_by(InventoryBalance.product_id)
            .having(func.count(InventoryBalance.id) > 1)
        )
    )


def _duplicate_invoice_codes(session: Session) -> list[str]:
    return list(
        session.scalars(
            select(Invoice.invoice_code)
            .group_by(Invoice.invoice_code)
            .having(func.count(Invoice.id) > 1)
        )
    )


def _duplicate_return_codes(session: Session) -> list[str]:
    return list(
        session.scalars(
            select(ReturnInvoice.return_code)
            .group_by(ReturnInvoice.return_code)
            .having(func.count(ReturnInvoice.id) > 1)
        )
    )


def _orphan_invoice_items(session: Session) -> int:
    return int(
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM invoice_items item
                LEFT JOIN invoices invoice ON invoice.id = item.invoice_id
                WHERE invoice.id IS NULL
                """
            )
        ).scalar_one()
    )


def _orphan_ledger_customers(session: Session) -> int:
    return int(
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM customer_balance_ledgers ledger
                LEFT JOIN customers customer ON customer.id = ledger.customer_id
                WHERE customer.id IS NULL
                """
            )
        ).scalar_one()
    )


def _orphan_invoice_ledgers(session: Session) -> int:
    return int(
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM customer_balance_ledgers ledger
                LEFT JOIN invoices invoice ON invoice.id = ledger.ref_id
                WHERE ledger.ref_type = 'INVOICE' AND invoice.id IS NULL
                """
            )
        ).scalar_one()
    )


def _orphan_invoice_payment_ledgers(session: Session) -> int:
    return int(
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM customer_balance_ledgers ledger
                LEFT JOIN debt_payments payment ON payment.id = ledger.ref_id
                LEFT JOIN invoices invoice ON invoice.id = ledger.source_ref_id
                WHERE ledger.ref_type = 'DEBT_PAYMENT'
                  AND ledger.source_ref_type = 'INVOICE'
                  AND (payment.id IS NULL OR invoice.id IS NULL)
                """
            )
        ).scalar_one()
    )
