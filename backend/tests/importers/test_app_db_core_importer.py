from __future__ import annotations

import json
import shutil
import sqlite3
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.importers.app_db_core_importer import import_app_db_core
from app.importers.import_app_db_core import main
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice


@pytest.fixture
def work_tmp_path() -> Path:
    root = Path(__file__).resolve().parents[2] / ".tmp-tests" / uuid.uuid4().hex
    root.mkdir(parents=True)
    try:
        yield root
    finally:
        shutil.rmtree(root, ignore_errors=True)


@pytest.fixture
def target_session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_source_app_db(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                product_code_base TEXT,
                product_name TEXT,
                unit_mode TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE product_prices (
                id INTEGER PRIMARY KEY,
                product_id INTEGER,
                unit_type TEXT,
                price NUMERIC,
                is_enabled INTEGER DEFAULT 1
            );
            CREATE TABLE inventory_balances (
                id INTEGER PRIMARY KEY,
                product_id INTEGER,
                on_hand_bao_decimal NUMERIC,
                on_hand_bich_integer NUMERIC,
                updated_at TEXT
            );
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY,
                customer_name TEXT,
                phone TEXT,
                address TEXT,
                note TEXT,
                current_balance NUMERIC DEFAULT 0,
                total_sales NUMERIC DEFAULT 0,
                is_walk_in INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE customer_balance_ledgers (
                id INTEGER PRIMARY KEY,
                customer_id INTEGER,
                event_type TEXT,
                ref_type TEXT,
                ref_id INTEGER,
                source_ref_type TEXT,
                source_ref_id INTEGER,
                display_order INTEGER DEFAULT 0,
                amount_delta NUMERIC,
                balance_after NUMERIC,
                transaction_datetime TEXT,
                created_at TEXT,
                note TEXT
            );
            """
        )
        connection.commit()


def insert_minimal_core_source(
    path: Path,
    *,
    product_id: int = 10,
    customer_id: int = 20,
    negative_inventory: bool = False,
    inactive: bool = False,
) -> None:
    balance = "-2.500" if negative_inventory else "2.500"
    active_value = 0 if inactive else 1
    with sqlite3.connect(path) as connection:
        connection.execute(
            """
            INSERT INTO products
            (id, product_code_base, product_name, unit_mode, is_active, created_at, updated_at)
            VALUES (?, 'GAO', 'Gao thom', 'BAO_KG', ?, '2026-04-01 08:00:00', '2026-04-01 08:30:00')
            """,
            (product_id, active_value),
        )
        connection.execute(
            "INSERT INTO product_prices (id, product_id, unit_type, price, is_enabled) VALUES (100, ?, 'BAO', '250000.00', 1)",
            (product_id,),
        )
        connection.execute(
            "INSERT INTO product_prices (id, product_id, unit_type, price, is_enabled) VALUES (101, ?, 'KG', '11000.00', 0)",
            (product_id,),
        )
        connection.execute(
            """
            INSERT INTO inventory_balances
            (id, product_id, on_hand_bao_decimal, on_hand_bich_integer, updated_at)
            VALUES (200, ?, ?, NULL, '2026-04-01 09:00:00')
            """,
            (product_id, balance),
        )
        connection.execute(
            """
            INSERT INTO customers
            (id, customer_name, phone, address, note, current_balance, total_sales, is_walk_in, is_active, created_at, updated_at)
            VALUES (?, 'Khach A', '0909', 'HN', 'note', '70.00', '30.00', 0, ?, '2026-04-01 08:00:00', '2026-04-01 08:30:00')
            """,
            (customer_id, active_value),
        )
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers
            (id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id, display_order, amount_delta, balance_after, transaction_datetime, created_at, note)
            VALUES (1, ?, 'OPENING_BALANCE', 'OPENING_BALANCE', ?, NULL, NULL, 0, '100.00', '100.00', '1900-01-01 00:00:00', '2026-04-01 08:00:00', 'Opening')
            """,
            (customer_id, customer_id),
        )
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers
            (id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id, display_order, amount_delta, balance_after, transaction_datetime, created_at, note)
            VALUES (2, ?, 'DEBT_PAYMENT', 'DEBT_PAYMENT', 900, NULL, NULL, 30, '-30.00', '70.00', '2026-04-01 10:00:00', '2026-04-01 10:00:00', 'Paid')
            """,
            (customer_id,),
        )
        connection.commit()


def test_dry_run_valid_minimal_db_produces_plan_with_no_writes(work_tmp_path: Path, target_session: Session) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)

    report = import_app_db_core(source, dry_run=True, target_session=target_session)

    assert report.succeeded is True
    assert report.dry_run is True
    assert report.imported_counts.products == 1
    assert report.imported_counts.product_prices == 2
    assert report.imported_counts.customers == 1
    assert target_session.scalar(select(Product).limit(1)) is None


def test_actual_import_inserts_inventory_and_customer_core(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is True
    assert report.imported_counts.products == 1
    assert report.imported_counts.product_prices == 2
    assert report.imported_counts.inventory_balances == 1
    assert report.imported_counts.customers == 1
    assert target_session.scalar(select(Product.product_code_base)) == "GAO"
    assert target_session.scalar(select(ProductPrice).where(ProductPrice.unit_type == "KG")).is_enabled is False
    assert target_session.scalar(select(Customer.customer_name)) == "Khach A"


def test_old_to_new_product_and_customer_mappings_are_recorded(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source, product_id=77, customer_id=88)

    report = import_app_db_core(source, target_session=target_session)

    assert report.mapping_counts.product_id_mappings == 1
    assert report.mapping_counts.customer_id_mappings == 1
    assert 77 in report.product_id_map
    assert 88 in report.customer_id_map


def test_negative_inventory_and_inactive_flags_are_preserved(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source, negative_inventory=True, inactive=True)

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is True
    assert target_session.scalar(select(InventoryBalance.on_hand_bao_decimal)) < 0
    assert target_session.scalar(select(Product.is_active)) is False
    assert target_session.scalar(select(Customer.is_active)) is False


def test_invalid_source_db_is_blocked_by_validator(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    with sqlite3.connect(source) as connection:
        connection.execute("UPDATE products SET product_code_base = '' WHERE id = 10")

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is False
    assert "failed core validation" in report.errors[0]
    assert target_session.scalar(select(Product).limit(1)) is None


def test_target_non_empty_blocks_import(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    target_session.add(Product(product_code_base="EXISTING", product_name="Existing", unit_mode="BAO_KG"))
    target_session.commit()

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is False
    assert "must be empty" in report.errors[0]


def test_invoice_linked_ledger_rows_are_deferred_and_partial_history_is_reported(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    with sqlite3.connect(source) as connection:
        connection.execute("UPDATE customers SET current_balance = '120.00' WHERE id = 20")
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers
            (id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id, display_order, amount_delta, balance_after, transaction_datetime, created_at, note)
            VALUES (3, 20, 'INVOICE_CHARGE', 'INVOICE', 501, 'INVOICE', 501, 10, '50.00', '120.00', '2026-04-02 09:00:00', '2026-04-02 09:00:00', 'Invoice charge')
            """
        )

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is True
    assert report.deferred_counts.deferred_sales_return_ledgers == 1
    assert report.imported_counts.customer_ledgers == 2
    assert target_session.scalar(select(Customer.current_balance)) == 120
    assert "partial imported ledgers" in " ".join(report.warnings)


def test_source_db_is_not_modified(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    before = source.stat().st_mtime_ns
    before_count = sqlite3.connect(source).execute("SELECT COUNT(*) FROM products").fetchone()[0]

    report = import_app_db_core(source, target_session=target_session)

    after = source.stat().st_mtime_ns
    after_count = sqlite3.connect(source).execute("SELECT COUNT(*) FROM products").fetchone()[0]
    assert report.succeeded is True
    assert after == before
    assert after_count == before_count


def test_standalone_debt_payment_creates_parent_and_remaps_ledger_ref_id(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)

    report = import_app_db_core(source, target_session=target_session)

    payment = target_session.scalar(select(DebtPayment))
    debt_ledger = target_session.scalar(select(CustomerBalanceLedger).where(CustomerBalanceLedger.ref_type == "DEBT_PAYMENT"))
    assert payment is not None
    assert payment.amount == 30
    assert debt_ledger is not None
    assert debt_ledger.ref_id == payment.id
    assert report.debt_payment_ref_id_map[900] == payment.id


def test_debt_payment_edit_group_uses_one_parent_payment(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    with sqlite3.connect(source) as connection:
        connection.execute("UPDATE customers SET current_balance = '50.00' WHERE id = 20")
        connection.execute("UPDATE customer_balance_ledgers SET amount_delta = '-100.00', balance_after = '0.00' WHERE id = 2")
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers
            (id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id, display_order, amount_delta, balance_after, transaction_datetime, created_at, note)
            VALUES (3, 20, 'DEBT_PAYMENT_EDIT_ROLLBACK', 'DEBT_PAYMENT', 900, NULL, NULL, 30, '100.00', '100.00', '2026-04-01 10:05:00', '2026-04-01 10:05:00', 'Rollback')
            """
        )
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers
            (id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id, display_order, amount_delta, balance_after, transaction_datetime, created_at, note)
            VALUES (4, 20, 'DEBT_PAYMENT', 'DEBT_PAYMENT', 900, NULL, NULL, 30, '-50.00', '50.00', '2026-04-01 10:10:00', '2026-04-01 10:10:00', 'Replacement')
            """
        )

    report = import_app_db_core(source, target_session=target_session)

    payment = target_session.scalar(select(DebtPayment))
    ledgers = target_session.scalars(select(CustomerBalanceLedger).where(CustomerBalanceLedger.ref_type == "DEBT_PAYMENT")).all()
    assert report.succeeded is True
    assert payment is not None
    assert payment.amount == 50
    assert len(ledgers) == 3
    assert {ledger.ref_id for ledger in ledgers} == {payment.id}


def test_transaction_rollback_on_failure_leaves_target_empty(
    monkeypatch: pytest.MonkeyPatch,
    target_session: Session,
    work_tmp_path: Path,
) -> None:
    source = work_tmp_path / "app.db"
    create_source_app_db(source)
    insert_minimal_core_source(source)
    original_flush = Session.flush
    state = {"failed": False}

    def failing_flush(self: Session, *args, **kwargs):  # type: ignore[no-untyped-def]
        if not state["failed"] and any(isinstance(item, Product) for item in self.new):
            original_flush(self, *args, **kwargs)
            state["failed"] = True
            raise RuntimeError("simulated failure")
        return original_flush(self, *args, **kwargs)

    monkeypatch.setattr(Session, "flush", failing_flush)

    report = import_app_db_core(source, target_session=target_session)

    assert report.succeeded is False
    assert "rolled back" in report.errors[0]
    assert target_session.scalar(select(Product).limit(1)) is None
    assert target_session.scalar(select(Customer).limit(1)) is None


def test_cli_dry_run_follows_core_readiness_and_writes_json(work_tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = work_tmp_path / "app.db"
    report_path = work_tmp_path / "plan.json"
    create_source_app_db(source)
    insert_minimal_core_source(source)

    exit_code = main(
        [
            "--app-db",
            str(source),
            "--database-url",
            "sqlite+pysqlite:///:memory:",
            "--dry-run",
            "--json-out",
            str(report_path),
        ]
    )

    output = capsys.readouterr().out
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert "dry-run" in output
    assert payload["dry_run"] is True
    assert payload["imported_counts"]["products"] == 1
