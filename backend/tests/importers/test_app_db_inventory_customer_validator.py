from __future__ import annotations

import json
import shutil
import sqlite3
import uuid
from pathlib import Path

import pytest

from app.importers.app_db_inventory_customer_validator import validate_app_db
from app.importers.validate_app_db import main


@pytest.fixture
def work_tmp_path() -> Path:
    root = Path(__file__).resolve().parents[2] / ".tmp-tests" / uuid.uuid4().hex
    root.mkdir(parents=True)
    try:
        yield root
    finally:
        shutil.rmtree(root, ignore_errors=True)


def create_app_db(path: Path, *, omit_tables: tuple[str, ...] = ()) -> None:
    with sqlite3.connect(path) as connection:
        if "products" not in omit_tables:
            connection.execute(
                """
                CREATE TABLE products (
                    id INTEGER PRIMARY KEY,
                    product_code_base TEXT,
                    product_name TEXT,
                    unit_mode TEXT,
                    is_active INTEGER DEFAULT 1
                )
                """
            )
        if "product_prices" not in omit_tables:
            connection.execute(
                """
                CREATE TABLE product_prices (
                    id INTEGER PRIMARY KEY,
                    product_id INTEGER,
                    unit_type TEXT,
                    price NUMERIC,
                    is_enabled INTEGER DEFAULT 1
                )
                """
            )
        if "inventory_balances" not in omit_tables:
            connection.execute(
                """
                CREATE TABLE inventory_balances (
                    id INTEGER PRIMARY KEY,
                    product_id INTEGER,
                    on_hand_bao_decimal NUMERIC,
                    on_hand_bich_integer NUMERIC
                )
                """
            )
        if "customers" not in omit_tables:
            connection.execute(
                """
                CREATE TABLE customers (
                    id INTEGER PRIMARY KEY,
                    customer_name TEXT,
                    phone TEXT,
                    current_balance NUMERIC DEFAULT 0,
                    total_sales NUMERIC DEFAULT 0,
                    is_active INTEGER DEFAULT 1
                )
                """
            )
        if "customer_balance_ledgers" not in omit_tables:
            connection.execute(
                """
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
                )
                """
            )
        connection.commit()


def insert_valid_core(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute(
            "INSERT INTO products (id, product_code_base, product_name, unit_mode, is_active) VALUES (1, 'GAO', 'Gao', 'BAO_KG', 1)"
        )
        connection.execute(
            "INSERT INTO product_prices (id, product_id, unit_type, price, is_enabled) VALUES (1, 1, 'BAO', '250000.00', 1)"
        )
        connection.execute(
            "INSERT INTO inventory_balances (id, product_id, on_hand_bao_decimal, on_hand_bich_integer) VALUES (1, 1, '1.000', NULL)"
        )
        connection.execute(
            "INSERT INTO customers (id, customer_name, phone, current_balance, total_sales, is_active) VALUES (1, 'Alice', '0909', '100.00', '0.00', 1)"
        )
        connection.execute(
            """
            INSERT INTO customer_balance_ledgers (
                id, customer_id, event_type, ref_type, ref_id, amount_delta, balance_after,
                transaction_datetime, created_at, display_order
            )
            VALUES (1, 1, 'OPENING_BALANCE', 'OPENING_BALANCE', 1, '100.00', '100.00', '1900-01-01 00:00:00', '1900-01-01 00:00:00', 0)
            """
        )
        connection.commit()


def issue_codes(path: Path) -> set[str]:
    return {issue.code for issue in validate_app_db(path).issues}


def replace_ledgers(path: Path, rows: list[tuple[object, ...]], *, current_balance: str) -> None:
    with sqlite3.connect(path) as connection:
        connection.execute("DELETE FROM customer_balance_ledgers")
        connection.execute("UPDATE customers SET current_balance = ? WHERE id = 1", (current_balance,))
        connection.executemany(
            """
            INSERT INTO customer_balance_ledgers (
                id, customer_id, event_type, ref_type, ref_id, source_ref_type, source_ref_id,
                display_order, amount_delta, balance_after, transaction_datetime, created_at, note
            )
            VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )
        connection.commit()


def test_valid_minimal_app_db_passes(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)

    result = validate_app_db(db_path)

    assert result.can_import_core is True
    assert result.can_import_full_ledger is True
    assert result.summary.product_count == 1
    assert result.summary.customer_count == 1
    assert result.summary.error_count == 0


def test_missing_required_table_returns_blocking_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path, omit_tables=("product_prices",))

    result = validate_app_db(db_path)

    assert result.can_import_core is False
    assert "missing_required_table" in issue_codes(db_path)


def test_duplicate_normalized_product_code_returns_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO products (id, product_code_base, product_name, unit_mode, is_active) VALUES (2, ' gao ', 'Other', 'BAO_KG', 1)"
        )
        connection.execute(
            "INSERT INTO product_prices (id, product_id, unit_type, price, is_enabled) VALUES (2, 2, 'BAO', '1.00', 1)"
        )
        connection.execute(
            "INSERT INTO inventory_balances (id, product_id, on_hand_bao_decimal, on_hand_bich_integer) VALUES (2, 2, '0.000', NULL)"
        )

    assert "duplicate_normalized_product_code" in issue_codes(db_path)


def test_invalid_product_unit_price_combination_returns_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE products SET unit_mode = 'BICH' WHERE id = 1")

    assert "incompatible_price_unit" in issue_codes(db_path)


def test_active_product_with_no_enabled_price_returns_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE product_prices SET is_enabled = 0 WHERE id = 1")

    assert "active_product_missing_enabled_price" in issue_codes(db_path)


def test_missing_inventory_balance_is_blocking_and_negative_stock_is_info(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO products (id, product_code_base, product_name, unit_mode, is_active) VALUES (2, 'BICH', 'Bich', 'BICH', 1)"
        )
        connection.execute(
            "INSERT INTO product_prices (id, product_id, unit_type, price, is_enabled) VALUES (2, 2, 'BICH', '1.00', 1)"
        )
        connection.execute("UPDATE inventory_balances SET on_hand_bao_decimal = '-1.000' WHERE id = 1")

    result = validate_app_db(db_path)

    assert "missing_inventory_balance" in {issue.code for issue in result.issues if issue.severity == "error"}
    assert "negative_inventory_balance" in {issue.code for issue in result.issues if issue.severity == "info"}


def test_blank_customer_name_and_negative_total_sales_are_errors(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE customers SET customer_name = ' ', total_sales = '-1.00' WHERE id = 1")

    codes = issue_codes(db_path)
    assert "blank_customer_name" in codes
    assert "negative_total_sales" in codes


def test_ledger_references_missing_customer_returns_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE customer_balance_ledgers SET customer_id = 999 WHERE id = 1")

    assert "ledger_missing_customer" in issue_codes(db_path)


def test_customer_current_balance_mismatch_returns_error(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE customers SET current_balance = '90.00' WHERE id = 1")

    assert "customer_current_balance_mismatch" in issue_codes(db_path)


def test_pure_customer_debt_ledger_balance_mismatch_remains_blocking(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    replace_ledgers(
        db_path,
        [
            (
                1,
                "DEBT_PAYMENT",
                "DEBT_PAYMENT",
                501,
                None,
                None,
                30,
                "-40.00",
                "-10.00",
                "2026-04-01 09:00:00",
                "2026-04-01 09:00:00",
                None,
            )
        ],
        current_balance="-40.00",
    )

    result = validate_app_db(db_path)

    assert result.can_import_core is False
    assert result.can_import_full_ledger is False
    assert result.summary.blocking_ledger_mismatch_count == 1
    assert "ledger_balance_after_mismatch" in {issue.code for issue in result.issues if issue.severity == "error"}


def test_invoice_dependent_row_mismatch_is_warning_when_final_balance_matches(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    replace_ledgers(
        db_path,
        [
            (
                1,
                "INVOICE_CHARGE",
                "INVOICE",
                10,
                "INVOICE",
                10,
                10,
                "50.00",
                "999.00",
                "2026-04-01 09:00:00",
                "2026-04-01 09:00:00",
                "Invoice charge HD1",
            )
        ],
        current_balance="50.00",
    )

    result = validate_app_db(db_path)

    assert result.can_import_core is True
    assert result.can_import_full_ledger is False
    assert result.summary.deferred_ledger_mismatch_count == 1
    assert result.summary.blocking_ledger_mismatch_count == 0
    assert "ledger_balance_after_mismatch_deferred_dependency" in {issue.code for issue in result.issues if issue.severity == "warning"}
    assert "ledger_balance_after_mismatch" not in {issue.code for issue in result.issues if issue.severity == "error"}


def test_non_invoice_row_mismatch_in_invoice_timeline_is_warning_when_final_balance_matches(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    replace_ledgers(
        db_path,
        [
            (
                1,
                "INVOICE_CHARGE",
                "INVOICE",
                10,
                "INVOICE",
                10,
                10,
                "50.00",
                "50.00",
                "2026-04-01 09:00:00",
                "2026-04-01 09:00:00",
                "Invoice charge HD1",
            ),
            (
                2,
                "DEBT_PAYMENT",
                "DEBT_PAYMENT",
                501,
                None,
                None,
                30,
                "-20.00",
                "10.00",
                "2026-04-01 10:00:00",
                "2026-04-01 10:00:00",
                None,
            ),
        ],
        current_balance="30.00",
    )

    result = validate_app_db(db_path)

    assert result.can_import_core is True
    assert result.can_import_full_ledger is False
    assert result.summary.deferred_ledger_mismatch_count == 1
    assert "ledger_balance_after_mismatch_deferred_dependency" in {issue.code for issue in result.issues if issue.severity == "warning"}
    assert "ledger_balance_after_mismatch" not in {issue.code for issue in result.issues if issue.severity == "error"}


def test_final_customer_balance_mismatch_remains_blocking_with_deferred_invoice_rows(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    replace_ledgers(
        db_path,
        [
            (
                1,
                "INVOICE_CHARGE",
                "INVOICE",
                10,
                "INVOICE",
                10,
                10,
                "50.00",
                "50.00",
                "2026-04-01 09:00:00",
                "2026-04-01 09:00:00",
                "Invoice charge HD1",
            )
        ],
        current_balance="999.00",
    )

    result = validate_app_db(db_path)

    assert result.can_import_core is False
    assert result.can_import_full_ledger is False
    assert result.summary.customers_current_balance_mismatch_count == 1
    assert "customer_current_balance_mismatch" in {issue.code for issue in result.issues if issue.severity == "error"}


def test_invoice_linked_ledger_is_deferred_dependency_warning(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute("UPDATE customer_balance_ledgers SET ref_type = 'INVOICE', source_ref_type = 'INVOICE' WHERE id = 1")

    result = validate_app_db(db_path)
    warning_codes = {issue.code for issue in result.issues if issue.severity == "warning"}

    assert "deferred_sales_return_ledger_dependency" in warning_codes


def test_duplicate_phone_is_warning_only(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO customers (id, customer_name, phone, current_balance, total_sales) VALUES (2, 'Bob', '0909', '0.00', '0.00')"
        )

    result = validate_app_db(db_path)

    assert "duplicate_customer_phone" in {issue.code for issue in result.issues if issue.severity == "warning"}
    assert "duplicate_customer_phone" not in {issue.code for issue in result.issues if issue.severity == "error"}


def test_cli_returns_expected_exit_codes_and_writes_json(work_tmp_path: Path, capsys) -> None:
    db_path = work_tmp_path / "app.db"
    json_path = work_tmp_path / "report.json"
    create_app_db(db_path)
    insert_valid_core(db_path)

    exit_code = main(["--app-db", str(db_path), "--json-out", str(json_path)])

    assert exit_code == 0
    assert "can_import_core=true" in capsys.readouterr().out
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    assert payload["can_import_core"] is True
    assert payload["can_import_full_ledger"] is True


def test_cli_returns_zero_for_core_ready_full_ledger_not_ready(work_tmp_path: Path, capsys) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    insert_valid_core(db_path)
    replace_ledgers(
        db_path,
        [
            (
                1,
                "INVOICE_CHARGE",
                "INVOICE",
                10,
                "INVOICE",
                10,
                10,
                "50.00",
                "999.00",
                "2026-04-01 09:00:00",
                "2026-04-01 09:00:00",
                "Invoice charge HD1",
            )
        ],
        current_balance="50.00",
    )

    assert main(["--app-db", str(db_path)]) == 0
    output = capsys.readouterr().out
    assert "can_import_core=true" in output
    assert "can_import_full_ledger=false" in output


def test_cli_returns_one_for_blocking_errors(work_tmp_path: Path) -> None:
    db_path = work_tmp_path / "app.db"
    create_app_db(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO products (id, product_code_base, product_name, unit_mode, is_active) VALUES (1, '', 'Product', 'BAO_KG', 1)"
        )

    assert main(["--app-db", str(db_path)]) == 1


def test_cli_returns_two_for_invalid_input_path(work_tmp_path: Path) -> None:
    assert main(["--app-db", str(work_tmp_path / "missing.db")]) == 2
