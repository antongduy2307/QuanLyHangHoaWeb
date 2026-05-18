from __future__ import annotations

import sqlite3
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.importers.app_db_core_importer import import_app_db_core
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


BACKEND_ROOT = Path(__file__).resolve().parents[2]
REAL_APP_DB = BACKEND_ROOT / "validation_sources" / "real_app_copy.db"


def test_real_app_core_import_into_disposable_postgres(postgres_session: Session) -> None:
    if not REAL_APP_DB.exists():
        pytest.skip(f"Real copied app.db is not present: {REAL_APP_DB}")

    expected = _source_expected_counts(REAL_APP_DB)

    report = import_app_db_core(REAL_APP_DB, target_session=postgres_session)

    assert report.succeeded is True
    assert report.imported_counts.products == expected["products"]
    assert report.imported_counts.product_prices == expected["product_prices"]
    assert report.imported_counts.inventory_balances == expected["inventory_balances"]
    assert report.imported_counts.customers == expected["customers"]
    assert report.imported_counts.customer_ledgers == expected["core_ledgers"]
    assert report.imported_counts.debt_payments == expected["standalone_debt_payment_groups"]
    assert report.deferred_counts.deferred_sales_return_ledgers == expected["deferred_ledgers"]
    assert report.mapping_counts.product_id_mappings == expected["products"]
    assert report.mapping_counts.customer_id_mappings == expected["customers"]
    assert report.mapping_counts.debt_payment_mappings == expected["standalone_debt_payment_groups"]
    assert len(report.product_id_map) == len(set(report.product_id_map))
    assert len(report.customer_id_map) == len(set(report.customer_id_map))
    assert len(report.debt_payment_ref_id_map) == len(set(report.debt_payment_ref_id_map))

    assert postgres_session.scalar(select(func.count()).select_from(Product)) == expected["products"]
    assert postgres_session.scalar(select(func.count()).select_from(ProductPrice)) == expected["product_prices"]
    assert postgres_session.scalar(select(func.count()).select_from(InventoryBalance)) == expected["inventory_balances"]
    assert postgres_session.scalar(select(func.count()).select_from(Customer)) == expected["customers"]
    assert postgres_session.scalar(select(func.count()).select_from(DebtPayment)) == expected["standalone_debt_payment_groups"]
    assert postgres_session.scalar(select(func.count()).select_from(CustomerBalanceLedger)) == expected["core_ledgers"]

    assert postgres_session.scalar(
        select(func.count()).select_from(InventoryBalance).where(InventoryBalance.on_hand_bao_decimal < 0)
    ) == expected["negative_bao_balances"]
    assert postgres_session.scalar(
        select(func.count()).select_from(InventoryBalance).where(InventoryBalance.on_hand_bich_integer < 0)
    ) == expected["negative_bich_balances"]
    assert postgres_session.scalar(select(func.count()).select_from(Product).where(Product.is_active.is_(False))) == expected["inactive_products"]
    assert postgres_session.scalar(select(func.count()).select_from(Customer).where(Customer.is_active.is_(False))) == expected["inactive_customers"]

    assert _duplicate_product_codes(postgres_session) == []
    assert _duplicate_product_price_units(postgres_session) == []
    assert _duplicate_inventory_balances(postgres_session) == []
    assert _invalid_canonical_balance_count(postgres_session) == 0
    assert _orphan_customer_ledger_count(postgres_session) == 0
    assert _orphan_debt_payment_ledger_count(postgres_session) == 0

    source_balances = _source_customer_balances(REAL_APP_DB)
    imported_balances = {
        old_id: postgres_session.get(Customer, new_id).current_balance
        for old_id, new_id in report.customer_id_map.items()
    }
    assert imported_balances == source_balances

    partial_reconciliation_count = _partial_ledger_reconciliation_count(postgres_session)
    assert partial_reconciliation_count > 0
    assert partial_reconciliation_count <= expected["deferred_customer_count"]


def _source_expected_counts(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as connection:
        connection.row_factory = sqlite3.Row
        ledgers = list(connection.execute("SELECT * FROM customer_balance_ledgers"))
        deferred_ledgers = [row for row in ledgers if _is_deferred(row)]
        core_ledgers = [row for row in ledgers if not _is_deferred(row)]
        debt_payment_ref_ids = {
            int(row["ref_id"])
            for row in core_ledgers
            if str(row["ref_type"]).upper() == "DEBT_PAYMENT"
            and str(row["event_type"]).upper() == "DEBT_PAYMENT"
            and Decimal(str(row["amount_delta"])) < 0
        }
        deferred_customer_ids = {int(row["customer_id"]) for row in deferred_ledgers}
        return {
            "products": _count(connection, "products"),
            "product_prices": _count(connection, "product_prices"),
            "inventory_balances": _count(connection, "inventory_balances"),
            "customers": _count(connection, "customers"),
            "deferred_ledgers": len(deferred_ledgers),
            "core_ledgers": len(core_ledgers),
            "standalone_debt_payment_groups": len(debt_payment_ref_ids),
            "deferred_customer_count": len(deferred_customer_ids),
            "negative_bao_balances": connection.execute(
                "SELECT COUNT(*) FROM inventory_balances WHERE on_hand_bao_decimal < 0"
            ).fetchone()[0],
            "negative_bich_balances": connection.execute(
                "SELECT COUNT(*) FROM inventory_balances WHERE on_hand_bich_integer < 0"
            ).fetchone()[0],
            "inactive_products": connection.execute("SELECT COUNT(*) FROM products WHERE COALESCE(is_active, 1) = 0").fetchone()[0],
            "inactive_customers": connection.execute("SELECT COUNT(*) FROM customers WHERE COALESCE(is_active, 1) = 0").fetchone()[0],
        }


def _source_customer_balances(path: Path) -> dict[int, Decimal]:
    with sqlite3.connect(path) as connection:
        return {
            int(row[0]): Decimal(str(row[1]))
            for row in connection.execute("SELECT id, current_balance FROM customers")
        }


def _count(connection: sqlite3.Connection, table: str) -> int:
    return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def _is_deferred(row: sqlite3.Row) -> bool:
    ref_type = str(row["ref_type"] or "").upper()
    source_ref_type = str(row["source_ref_type"] or "").upper()
    note = str(row["note"] or "").lower()
    return ref_type in {"INVOICE", "RETURN", "RETURN_INVOICE"} or source_ref_type in {"INVOICE", "RETURN", "RETURN_INVOICE"} or "overpayment from invoice" in note


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


def _invalid_canonical_balance_count(session: Session) -> int:
    balances = session.scalars(select(InventoryBalance).join(Product)).all()
    return sum(
        1
        for balance in balances
        if (
            balance.product.unit_mode == "BAO_KG"
            and (balance.on_hand_bao_decimal is None or balance.on_hand_bich_integer is not None)
        )
        or (
            balance.product.unit_mode == "BICH"
            and (balance.on_hand_bich_integer is None or balance.on_hand_bao_decimal is not None)
        )
    )


def _orphan_customer_ledger_count(session: Session) -> int:
    customer_ids = set(session.scalars(select(Customer.id)))
    return sum(1 for customer_id in session.scalars(select(CustomerBalanceLedger.customer_id)) if customer_id not in customer_ids)


def _orphan_debt_payment_ledger_count(session: Session) -> int:
    payment_ids = set(session.scalars(select(DebtPayment.id)))
    return sum(
        1
        for ref_id in session.scalars(
            select(CustomerBalanceLedger.ref_id).where(CustomerBalanceLedger.ref_type == "DEBT_PAYMENT")
        )
        if ref_id not in payment_ids
    )


def _partial_ledger_reconciliation_count(session: Session) -> int:
    ledgers = session.scalars(select(CustomerBalanceLedger)).all()
    ledger_sum_by_customer: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for ledger in ledgers:
        ledger_sum_by_customer[ledger.customer_id] += ledger.amount_delta
    customers = session.scalars(select(Customer)).all()
    return sum(1 for customer in customers if ledger_sum_by_customer[customer.id] != customer.current_balance)
