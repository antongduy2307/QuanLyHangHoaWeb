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
from app.importers.app_db_sales_returns_importer import import_app_db_sales_returns
from app.importers.import_app_db_sales_returns import main
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance
from app.infrastructure.db.models.returns import ReturnInvoice
from app.infrastructure.db.models.sales import Invoice, InvoiceItem


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


def create_sales_source_db(path: Path, *, include_return: bool = False) -> None:
    with sqlite3.connect(path) as conn:
        conn.executescript(
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
            CREATE TABLE invoices (
                id INTEGER PRIMARY KEY,
                invoice_code TEXT,
                customer_id INTEGER,
                customer_snapshot_name TEXT,
                invoice_datetime TEXT,
                total_amount NUMERIC,
                paid_amount NUMERIC,
                payment_method TEXT,
                status TEXT,
                note TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE invoice_items (
                id INTEGER PRIMARY KEY,
                invoice_id INTEGER,
                product_id INTEGER,
                unit_type TEXT,
                quantity NUMERIC,
                unit_price NUMERIC,
                line_total NUMERIC,
                product_code_snapshot TEXT,
                product_name_snapshot TEXT
            );
            CREATE TABLE return_invoices (
                id INTEGER PRIMARY KEY,
                return_code TEXT,
                source_invoice_id INTEGER,
                customer_id INTEGER,
                customer_snapshot_name TEXT,
                is_quick_return INTEGER,
                return_datetime TEXT,
                total_amount NUMERIC,
                handling_mode TEXT,
                note TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE return_invoice_items (
                id INTEGER PRIMARY KEY,
                return_invoice_id INTEGER,
                source_invoice_item_id INTEGER,
                product_id INTEGER,
                unit_type TEXT,
                quantity NUMERIC,
                unit_price NUMERIC,
                line_total NUMERIC,
                product_code_snapshot TEXT,
                product_name_snapshot TEXT
            );
            """
        )
        final_balance = "80.00" if include_return else "130.00"
        total_sales = "0.00" if include_return else "50.00"
        conn.execute("INSERT INTO products VALUES (10, 'GAO', 'Gao', 'BAO_KG', 1, '2026-01-01 08:00:00', '2026-01-01 08:00:00')")
        conn.execute("INSERT INTO product_prices VALUES (11, 10, 'BAO', '50.00', 1)")
        conn.execute("INSERT INTO inventory_balances VALUES (12, 10, '10.000', NULL, '2026-01-01 08:00:00')")
        conn.execute(
            "INSERT INTO customers VALUES (20, 'Customer', NULL, NULL, NULL, ?, ?, 0, 1, '2026-01-01 08:00:00', '2026-01-01 08:00:00')",
            (final_balance, total_sales),
        )
        conn.execute(
            """
            INSERT INTO invoices VALUES
            (100, 'HD20260516-001', 20, 'Customer', '2026-05-16 09:00:00', '50.00', '20.00', 'CASH', 'COMPLETED', 'note', '2026-05-16 09:00:00', '2026-05-16 09:00:00')
            """
        )
        conn.execute("INSERT INTO invoice_items VALUES (101, 100, 10, 'BAO', '1.000', '50.00', '50.00', 'GAO', 'Gao')")
        conn.execute(
            """
            INSERT INTO customer_balance_ledgers VALUES
            (1, 20, 'OPENING_BALANCE', 'OPENING_BALANCE', 20, NULL, NULL, 0, '100.00', '100.00', '1900-01-01 00:00:00', '2026-01-01 08:00:00', 'Opening')
            """
        )
        conn.execute(
            """
            INSERT INTO customer_balance_ledgers VALUES
            (2, 20, 'INVOICE_CHARGE', 'INVOICE', 100, 'INVOICE', 100, 10, '50.00', '150.00', '2026-05-16 09:00:00', '2026-05-16 09:00:00', 'Invoice')
            """
        )
        conn.execute(
            """
            INSERT INTO customer_balance_ledgers VALUES
            (3, 20, 'DEBT_PAYMENT', 'DEBT_PAYMENT', 500, 'INVOICE', 100, 20, '-20.00', '130.00', '2026-05-16 09:00:00', '2026-05-16 09:00:00', 'Invoice payment')
            """
        )
        if include_return:
            conn.execute(
                """
                INSERT INTO return_invoices VALUES
                (200, 'TR20260516-001', 100, 20, 'Customer', 0, '2026-05-16 10:00:00', '50.00', 'STORE_CREDIT', 'return', '2026-05-16 10:00:00', '2026-05-16 10:00:00')
                """
            )
            conn.execute("INSERT INTO return_invoice_items VALUES (201, 200, 101, 10, 'BAO', '1.000', '50.00', '50.00', 'GAO', 'Gao')")
            conn.execute(
                """
                INSERT INTO customer_balance_ledgers VALUES
                (4, 20, 'RETURN_STORE_CREDIT', 'RETURN', 200, 'RETURN', 200, 20, '-50.00', '80.00', '2026-05-16 10:00:00', '2026-05-16 10:00:00', 'Return')
                """
            )
        conn.commit()


def import_core_and_write_report(source: Path, target_session: Session, report_path: Path) -> dict:
    core_report = import_app_db_core(source, target_session=target_session)
    assert core_report.succeeded
    payload = core_report.to_dict()
    report_path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return payload


def test_dry_run_valid_invoice_db_produces_expected_counts(work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    report_path.write_text(json.dumps({"product_id_map": {"10": 1}, "customer_id_map": {"20": 1}}), encoding="utf-8")

    report = import_app_db_sales_returns(source, core_import_report_path=report_path, dry_run=True)

    assert report.succeeded is True
    assert report.imported_counts.invoices == 1
    assert report.imported_counts.invoice_items == 1
    assert report.imported_counts.restored_invoice_charge_ledgers == 1
    assert report.imported_counts.restored_invoice_payment_ledgers == 1


def test_actual_import_inserts_documents_and_preserves_inventory(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    import_core_and_write_report(source, target_session, core_report_path)
    before_inventory = target_session.scalar(select(InventoryBalance.on_hand_bao_decimal))

    report = import_app_db_sales_returns(source, core_import_report_path=core_report_path, target_session=target_session)

    assert report.succeeded is True
    assert target_session.scalar(select(Invoice.invoice_code)) == "HD20260516-001"
    assert target_session.scalar(select(InvoiceItem.product_code_snapshot)) == "GAO"
    assert target_session.scalar(select(InventoryBalance.on_hand_bao_decimal)) == before_inventory
    assert report.reconciliation.inventory_balance_unchanged is True


def test_deferred_ledgers_are_restored_and_recomputed(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    import_core_and_write_report(source, target_session, core_report_path)

    report = import_app_db_sales_returns(source, core_import_report_path=core_report_path, target_session=target_session)

    rows = target_session.scalars(select(CustomerBalanceLedger).order_by(CustomerBalanceLedger.display_order, CustomerBalanceLedger.id)).all()
    payment = target_session.scalar(select(DebtPayment).where(DebtPayment.amount == 20))
    assert report.succeeded is True
    assert payment is not None
    assert [row.event_type for row in rows] == ["OPENING_BALANCE", "INVOICE_CHARGE", "DEBT_PAYMENT"]
    assert rows[-1].balance_after == 130
    assert target_session.scalar(select(Customer.current_balance)) == 130


def test_missing_mapping_report_or_mapping_fails(work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)

    missing = import_app_db_sales_returns(source, core_import_report_path=None, dry_run=True)
    report_path.write_text(json.dumps({"product_id_map": {}, "customer_id_map": {"20": 1}}), encoding="utf-8")
    missing_product = import_app_db_sales_returns(source, core_import_report_path=report_path, dry_run=True)

    assert missing.succeeded is False
    assert "mapping report is required" in missing.errors[0]
    assert missing_product.succeeded is False
    assert "Missing product id mappings" in missing_product.errors[0]


def test_invalid_source_references_and_duplicate_invoice_code_fail(work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    report_path.write_text(json.dumps({"product_id_map": {"10": 1}, "customer_id_map": {"20": 1}}), encoding="utf-8")
    with sqlite3.connect(source) as conn:
        conn.execute("INSERT INTO invoices SELECT 101, invoice_code, customer_id, customer_snapshot_name, invoice_datetime, total_amount, paid_amount, payment_method, status, note, created_at, updated_at FROM invoices WHERE id=100")
        conn.execute("UPDATE invoice_items SET product_id = 999 WHERE id = 101")

    report = import_app_db_sales_returns(source, core_import_report_path=report_path, dry_run=True)

    assert report.succeeded is False
    assert any("Duplicate invoice_code" in error for error in report.errors)
    assert any("missing product" in error for error in report.errors)


def test_target_non_empty_invoices_blocks_import(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    import_core_and_write_report(source, target_session, core_report_path)
    from datetime import datetime

    target_session.add(Invoice(invoice_code="EXISTING", customer_snapshot_name="A", invoice_datetime=datetime(2026, 1, 1), total_amount=0, paid_amount=0, status="COMPLETED"))
    target_session.commit()

    report = import_app_db_sales_returns(source, core_import_report_path=core_report_path, target_session=target_session)

    assert report.succeeded is False
    assert "must be empty" in report.errors[0]


def test_source_db_read_only_and_transaction_rollback(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    import_core_and_write_report(source, target_session, core_report_path)
    before_mtime = source.stat().st_mtime_ns

    report = import_app_db_sales_returns(
        source,
        core_import_report_path=core_report_path,
        target_session=target_session,
        simulate_failure_after_documents=True,
    )

    assert report.succeeded is False
    assert source.stat().st_mtime_ns == before_mtime
    assert target_session.scalar(select(Invoice).limit(1)) is None
    assert target_session.scalar(select(CustomerBalanceLedger).where(CustomerBalanceLedger.ref_type == "INVOICE").limit(1)) is None


def test_zero_returns_accepted_and_minimal_return_fixture_imports(target_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source, include_return=True)
    import_core_and_write_report(source, target_session, core_report_path)

    report = import_app_db_sales_returns(source, core_import_report_path=core_report_path, target_session=target_session)

    assert report.succeeded is True
    assert report.imported_counts.return_invoices == 1
    assert report.imported_counts.return_invoice_items == 1
    assert report.imported_counts.restored_return_ledgers == 1
    assert target_session.scalar(select(ReturnInvoice.return_code)) == "TR20260516-001"
    assert target_session.scalar(select(Customer.current_balance)) == 80


def test_cli_dry_run_writes_json(work_tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    json_out = work_tmp_path / "plan.json"
    create_sales_source_db(source)
    core_report_path.write_text(json.dumps({"product_id_map": {"10": 1}, "customer_id_map": {"20": 1}}), encoding="utf-8")

    exit_code = main([
        "--app-db", str(source),
        "--database-url", "sqlite+pysqlite:///:memory:",
        "--core-import-report", str(core_report_path),
        "--dry-run",
        "--json-out", str(json_out),
    ])

    payload = json.loads(json_out.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert "dry-run" in capsys.readouterr().out
    assert payload["imported_counts"]["invoices"] == 1


@pytest.mark.integration
@pytest.mark.postgres
def test_postgres_core_then_sales_import_fixture(postgres_session: Session, work_tmp_path: Path) -> None:
    source = work_tmp_path / "app.db"
    core_report_path = work_tmp_path / "core.json"
    create_sales_source_db(source)
    import_core_and_write_report(source, postgres_session, core_report_path)

    report = import_app_db_sales_returns(source, core_import_report_path=core_report_path, target_session=postgres_session)

    assert report.succeeded is True
    assert report.reconciliation.final_balance_mismatches == 0
    assert report.reconciliation.inventory_balance_unchanged is True
