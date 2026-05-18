from __future__ import annotations

import sqlite3
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Literal


IssueSeverity = Literal["error", "warning", "info"]

REQUIRED_TABLES = (
    "products",
    "product_prices",
    "inventory_balances",
    "customers",
    "customer_balance_ledgers",
)
VALID_UNIT_MODES = {"BAO_KG", "BICH"}
VALID_UNIT_TYPES = {"BAO", "KG", "BICH"}
UNIT_TYPES_BY_MODE = {"BAO_KG": {"BAO", "KG"}, "BICH": {"BICH"}}
DEFERRED_REF_TYPES = {"INVOICE", "RETURN", "RETURN_INVOICE"}


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    severity: IssueSeverity
    code: str
    message: str
    table: str
    row_id: int | None = None
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ValidationSummary:
    product_count: int = 0
    product_price_count: int = 0
    inventory_balance_count: int = 0
    customer_count: int = 0
    ledger_count: int = 0
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    affected_ledger_mismatch_customer_count: int = 0
    deferred_ledger_mismatch_count: int = 0
    blocking_ledger_mismatch_count: int = 0
    customers_current_balance_matched_count: int = 0
    customers_current_balance_mismatch_count: int = 0


@dataclass(frozen=True, slots=True)
class ValidationResult:
    summary: ValidationSummary
    issues: list[ValidationIssue]
    can_import_core: bool
    can_import_full_ledger: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": asdict(self.summary),
            "issues": [asdict(issue) for issue in self.issues],
            "can_import_core": self.can_import_core,
            "can_import_full_ledger": self.can_import_full_ledger,
        }


def validate_app_db(app_db_path: str | Path) -> ValidationResult:
    path = Path(app_db_path)
    issues: list[ValidationIssue] = []
    ledger_stats: dict[str, int] = {}
    if not path.exists() or not path.is_file():
        return _result(
            issues=[
                ValidationIssue(
                    severity="error",
                    code="invalid_app_db_path",
                    message=f"SQLite app.db path is not readable: {path}",
                    table="database",
                )
            ],
            counts={},
            ledger_stats={},
        )

    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        tables = _table_names(connection)
        for table in REQUIRED_TABLES:
            if table not in tables:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="missing_required_table",
                        message=f"Required table '{table}' is missing.",
                        table=table,
                    )
                )

        counts = _row_counts(connection, tables)
        columns_by_table = {table: _table_columns(connection, table) for table in tables}

        if "products" in tables:
            _validate_products(connection, columns_by_table, issues)
        if "product_prices" in tables and "products" in tables:
            _validate_product_prices(connection, columns_by_table, issues)
        if "inventory_balances" in tables and "products" in tables:
            _validate_inventory_balances(connection, columns_by_table, issues)
        if "customers" in tables:
            _validate_customers(connection, columns_by_table, issues)
        if "customer_balance_ledgers" in tables:
            ledger_stats = _validate_ledgers(connection, columns_by_table, issues)

    return _result(issues=issues, counts=counts, ledger_stats=ledger_stats)


def _result(*, issues: list[ValidationIssue], counts: dict[str, int], ledger_stats: dict[str, int]) -> ValidationResult:
    counter = Counter(issue.severity for issue in issues)
    total_ledger_mismatch_count = ledger_stats.get("deferred_ledger_mismatch_count", 0) + ledger_stats.get("blocking_ledger_mismatch_count", 0)
    summary = ValidationSummary(
        product_count=counts.get("products", 0),
        product_price_count=counts.get("product_prices", 0),
        inventory_balance_count=counts.get("inventory_balances", 0),
        customer_count=counts.get("customers", 0),
        ledger_count=counts.get("customer_balance_ledgers", 0),
        error_count=counter["error"],
        warning_count=counter["warning"],
        info_count=counter["info"],
        affected_ledger_mismatch_customer_count=ledger_stats.get("affected_ledger_mismatch_customer_count", 0),
        deferred_ledger_mismatch_count=ledger_stats.get("deferred_ledger_mismatch_count", 0),
        blocking_ledger_mismatch_count=ledger_stats.get("blocking_ledger_mismatch_count", 0),
        customers_current_balance_matched_count=ledger_stats.get("customers_current_balance_matched_count", 0),
        customers_current_balance_mismatch_count=ledger_stats.get("customers_current_balance_mismatch_count", 0),
    )
    return ValidationResult(
        summary=summary,
        issues=sorted(issues, key=_issue_sort_key),
        can_import_core=counter["error"] == 0,
        can_import_full_ledger=counter["error"] == 0 and total_ledger_mismatch_count == 0,
    )


def _issue_sort_key(issue: ValidationIssue) -> tuple[str, str, int, str]:
    return (issue.table, issue.code, issue.row_id or 0, issue.message)


def _table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {str(row["name"]) for row in rows}


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    rows = connection.execute(f"PRAGMA table_info({_quote_identifier(table)})").fetchall()
    return {str(row["name"]) for row in rows}


def _row_counts(connection: sqlite3.Connection, tables: set[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table in REQUIRED_TABLES:
        if table in tables:
            counts[table] = int(connection.execute(f"SELECT COUNT(*) AS count FROM {_quote_identifier(table)}").fetchone()["count"])
    return counts


def _rows(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(connection.execute(f"SELECT * FROM {_quote_identifier(table)} ORDER BY id"))


def _quote_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _row_value(row: sqlite3.Row, column: str, default: Any = None) -> Any:
    return row[column] if column in row.keys() else default


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_code(value: Any) -> str:
    return _normalize_text(value).upper()


def _bool_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip().lower() not in {"0", "false", "no", ""}
    return bool(value)


def _decimal_value(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _fits_numeric(value: Any, precision: int, scale: int) -> bool:
    decimal = _decimal_value(value)
    if decimal is None:
        return False
    integer_part, _, fractional_part = format(decimal.copy_abs(), "f").partition(".")
    integer_digits = len(integer_part.lstrip("0")) or 1
    fractional_digits = len(fractional_part.rstrip("0"))
    return fractional_digits <= scale and integer_digits <= precision - scale


def _add_numeric_issue(
    issues: list[ValidationIssue],
    *,
    table: str,
    row: sqlite3.Row,
    column: str,
    value: Any,
    precision: int,
    scale: int,
) -> None:
    if not _fits_numeric(value, precision, scale):
        issues.append(
            ValidationIssue(
                severity="error",
                code="numeric_precision_overflow",
                message=f"{column} does not fit numeric({precision}, {scale}).",
                table=table,
                row_id=_row_value(row, "id"),
                details={"column": column, "value": value},
            )
        )


def _validate_products(
    connection: sqlite3.Connection,
    columns_by_table: dict[str, set[str]],
    issues: list[ValidationIssue],
) -> None:
    rows = _rows(connection, "products")
    normalized_codes: defaultdict[str, list[int]] = defaultdict(list)
    for row in rows:
        row_id = _row_value(row, "id")
        code = _normalize_code(_row_value(row, "product_code_base"))
        name = _normalize_text(_row_value(row, "product_name"))
        unit_mode = _normalize_text(_row_value(row, "unit_mode"))
        if not code:
            issues.append(ValidationIssue("error", "blank_product_code", "Product code is blank.", "products", row_id))
        else:
            normalized_codes[code].append(row_id)
        if not name:
            issues.append(ValidationIssue("error", "blank_product_name", "Product name is blank.", "products", row_id))
        if unit_mode not in VALID_UNIT_MODES:
            issues.append(
                ValidationIssue(
                    "error",
                    "invalid_product_unit_mode",
                    "Product unit_mode is not supported.",
                    "products",
                    row_id,
                    {"unit_mode": unit_mode},
                )
            )

    for code, ids in normalized_codes.items():
        if len(ids) > 1:
            issues.append(
                ValidationIssue(
                    "error",
                    "duplicate_normalized_product_code",
                    "Multiple products share the same normalized product_code_base.",
                    "products",
                    ids[0],
                    {"normalized_code": code, "product_ids": ids},
                )
            )

    del columns_by_table


def _validate_product_prices(
    connection: sqlite3.Connection,
    columns_by_table: dict[str, set[str]],
    issues: list[ValidationIssue],
) -> None:
    products = {row["id"]: row for row in _rows(connection, "products")}
    price_rows = _rows(connection, "product_prices")
    duplicate_keys = Counter((row["product_id"], _normalize_text(_row_value(row, "unit_type"))) for row in price_rows)
    enabled_by_product: defaultdict[int, list[sqlite3.Row]] = defaultdict(list)

    for row in price_rows:
        row_id = _row_value(row, "id")
        product_id = _row_value(row, "product_id")
        unit_type = _normalize_text(_row_value(row, "unit_type"))
        product = products.get(product_id)
        if duplicate_keys[(product_id, unit_type)] > 1:
            issues.append(
                ValidationIssue(
                    "error",
                    "duplicate_product_price_unit",
                    "Duplicate product price unit row.",
                    "product_prices",
                    row_id,
                    {"product_id": product_id, "unit_type": unit_type},
                )
            )
        if unit_type not in VALID_UNIT_TYPES:
            issues.append(ValidationIssue("error", "invalid_price_unit_type", "Product price unit_type is invalid.", "product_prices", row_id, {"unit_type": unit_type}))
        if product is None:
            issues.append(ValidationIssue("error", "price_missing_product", "Product price references a missing product.", "product_prices", row_id, {"product_id": product_id}))
        else:
            unit_mode = _normalize_text(_row_value(product, "unit_mode"))
            if unit_type in VALID_UNIT_TYPES and unit_type not in UNIT_TYPES_BY_MODE.get(unit_mode, set()):
                issues.append(
                    ValidationIssue(
                        "error",
                        "incompatible_price_unit",
                        "Product price unit_type is incompatible with product unit_mode.",
                        "product_prices",
                        row_id,
                        {"product_id": product_id, "unit_mode": unit_mode, "unit_type": unit_type},
                    )
                )
        if _bool_value(_row_value(row, "is_enabled", True)):
            enabled_by_product[product_id].append(row)
            price = _decimal_value(_row_value(row, "price"))
            if price is None or price <= 0:
                issues.append(ValidationIssue("error", "enabled_price_not_positive", "Enabled product price must be greater than zero.", "product_prices", row_id))
        _add_numeric_issue(issues, table="product_prices", row=row, column="price", value=_row_value(row, "price"), precision=14, scale=2)

    for product_id, product in products.items():
        if not _bool_value(_row_value(product, "is_active", True)):
            continue
        valid_enabled = [
            price
            for price in enabled_by_product.get(product_id, [])
            if _decimal_value(_row_value(price, "price")) is not None and _decimal_value(_row_value(price, "price")) > 0
        ]
        if not valid_enabled:
            issues.append(
                ValidationIssue(
                    "error",
                    "active_product_missing_enabled_price",
                    "Active product has no enabled valid price.",
                    "products",
                    product_id,
                )
            )

    del columns_by_table


def _validate_inventory_balances(
    connection: sqlite3.Connection,
    columns_by_table: dict[str, set[str]],
    issues: list[ValidationIssue],
) -> None:
    products = {row["id"]: row for row in _rows(connection, "products")}
    balance_rows = _rows(connection, "inventory_balances")
    balances_by_product: defaultdict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in balance_rows:
        balances_by_product[_row_value(row, "product_id")].append(row)

    for product_id, product in products.items():
        balances = balances_by_product.get(product_id, [])
        if not balances:
            issues.append(ValidationIssue("error", "missing_inventory_balance", "Product is missing inventory balance.", "inventory_balances", None, {"product_id": product_id}))
            continue
        if len(balances) > 1:
            issues.append(ValidationIssue("error", "duplicate_inventory_balance", "Product has multiple inventory balance rows.", "inventory_balances", balances[0]["id"], {"product_id": product_id}))

    for row in balance_rows:
        row_id = _row_value(row, "id")
        product_id = _row_value(row, "product_id")
        product = products.get(product_id)
        bao = _decimal_value(_row_value(row, "on_hand_bao_decimal"))
        bich = _decimal_value(_row_value(row, "on_hand_bich_integer"))
        if product is None:
            issues.append(ValidationIssue("error", "balance_missing_product", "Inventory balance references a missing product.", "inventory_balances", row_id, {"product_id": product_id}))
            continue
        unit_mode = _normalize_text(_row_value(product, "unit_mode"))
        if unit_mode == "BAO_KG" and (bao is None or bich is not None):
            issues.append(ValidationIssue("error", "inventory_balance_canonical_mismatch", "BAO_KG product must use on_hand_bao_decimal only.", "inventory_balances", row_id, {"product_id": product_id}))
        if unit_mode == "BICH" and (bich is None or bao is not None):
            issues.append(ValidationIssue("error", "inventory_balance_canonical_mismatch", "BICH product must use on_hand_bich_integer only.", "inventory_balances", row_id, {"product_id": product_id}))
        for column in ("on_hand_bao_decimal", "on_hand_bich_integer"):
            value = _row_value(row, column)
            if value is not None:
                _add_numeric_issue(issues, table="inventory_balances", row=row, column=column, value=value, precision=14, scale=3)
                decimal = _decimal_value(value)
                if decimal is not None and decimal < 0:
                    issues.append(ValidationIssue("info", "negative_inventory_balance", "Negative inventory is allowed and will be preserved.", "inventory_balances", row_id, {"column": column, "value": str(decimal)}))

    del columns_by_table


def _validate_customers(
    connection: sqlite3.Connection,
    columns_by_table: dict[str, set[str]],
    issues: list[ValidationIssue],
) -> None:
    phone_counts: defaultdict[str, list[int]] = defaultdict(list)
    for row in _rows(connection, "customers"):
        row_id = _row_value(row, "id")
        if not _normalize_text(_row_value(row, "customer_name")):
            issues.append(ValidationIssue("error", "blank_customer_name", "Customer name is blank.", "customers", row_id))
        total_sales = _decimal_value(_row_value(row, "total_sales"))
        if total_sales is None or total_sales < 0:
            issues.append(ValidationIssue("error", "negative_total_sales", "Customer total_sales must not be negative.", "customers", row_id))
        _add_numeric_issue(issues, table="customers", row=row, column="current_balance", value=_row_value(row, "current_balance"), precision=14, scale=2)
        _add_numeric_issue(issues, table="customers", row=row, column="total_sales", value=_row_value(row, "total_sales"), precision=14, scale=2)
        phone = _normalize_text(_row_value(row, "phone"))
        if phone:
            phone_counts[phone].append(row_id)

    for phone, ids in phone_counts.items():
        if len(ids) > 1:
            issues.append(ValidationIssue("warning", "duplicate_customer_phone", "Duplicate customer phone is informational for import planning.", "customers", ids[0], {"phone": phone, "customer_ids": ids}))

    del columns_by_table


def _validate_ledgers(
    connection: sqlite3.Connection,
    columns_by_table: dict[str, set[str]],
    issues: list[ValidationIssue],
) -> dict[str, int]:
    customers = {row["id"]: row for row in _rows(connection, "customers")} if "customers" in _table_names(connection) else {}
    ledger_columns = columns_by_table.get("customer_balance_ledgers", set())
    for missing_column in ("source_ref_type", "source_ref_id", "display_order"):
        if missing_column not in ledger_columns:
            issues.append(ValidationIssue("warning", "missing_legacy_ledger_column", f"Ledger column '{missing_column}' is missing and needs migration/backfill.", "customer_balance_ledgers", details={"column": missing_column}))

    ledgers = _rows(connection, "customer_balance_ledgers")
    ledgers_by_customer: defaultdict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in ledgers:
        row_id = _row_value(row, "id")
        customer_id = _row_value(row, "customer_id")
        ledgers_by_customer[customer_id].append(row)
        if customer_id not in customers:
            issues.append(ValidationIssue("error", "ledger_missing_customer", "Ledger row references a missing customer.", "customer_balance_ledgers", row_id, {"customer_id": customer_id}))
        if not _normalize_text(_row_value(row, "event_type")):
            issues.append(ValidationIssue("error", "blank_ledger_event_type", "Ledger event_type is blank.", "customer_balance_ledgers", row_id))
        if not _normalize_text(_row_value(row, "ref_type")):
            issues.append(ValidationIssue("error", "blank_ledger_ref_type", "Ledger ref_type is blank.", "customer_balance_ledgers", row_id))
        _add_numeric_issue(issues, table="customer_balance_ledgers", row=row, column="amount_delta", value=_row_value(row, "amount_delta"), precision=14, scale=2)
        _add_numeric_issue(issues, table="customer_balance_ledgers", row=row, column="balance_after", value=_row_value(row, "balance_after"), precision=14, scale=2)
        _detect_deferred_ledger_dependency(row, issues)
        if _row_value(row, "transaction_datetime") is None:
            issues.append(ValidationIssue("warning", "missing_ledger_transaction_datetime", "Ledger transaction_datetime is missing; created_at fallback will be used when available.", "customer_balance_ledgers", row_id))

    affected_ledger_mismatch_customer_ids: set[int] = set()
    deferred_ledger_mismatch_count = 0
    blocking_ledger_mismatch_count = 0
    customers_current_balance_matched_count = 0
    customers_current_balance_mismatch_count = 0

    for customer_id, customer in customers.items():
        customer_ledgers = ledgers_by_customer.get(customer_id, [])
        running = Decimal("0")
        ordered_ledgers = sorted(customer_ledgers, key=_ledger_order_key)
        ledger_mismatches: list[tuple[sqlite3.Row, Decimal, Decimal]] = []
        has_deferred_dependency = any(_is_deferred_ledger_dependency(row) for row in ordered_ledgers)
        for row in ordered_ledgers:
            amount = _decimal_value(_row_value(row, "amount_delta"))
            balance_after = _decimal_value(_row_value(row, "balance_after"))
            if amount is None or balance_after is None:
                continue
            running += amount
            if balance_after != running:
                ledger_mismatches.append((row, running, balance_after))
        current_balance = _decimal_value(_row_value(customer, "current_balance"))
        current_balance_matches = current_balance is not None and current_balance == running
        if current_balance_matches:
            customers_current_balance_matched_count += 1
        elif current_balance is not None:
            customers_current_balance_mismatch_count += 1
            issues.append(
                ValidationIssue(
                    "error",
                    "customer_current_balance_mismatch",
                    "Customer current_balance does not match recomputed ledger balance.",
                    "customers",
                    customer_id,
                    {"expected": str(running), "actual": str(current_balance)},
                )
            )

        if ledger_mismatches:
            affected_ledger_mismatch_customer_ids.add(int(customer_id))
        for row, expected_balance, actual_balance in ledger_mismatches:
            if has_deferred_dependency and current_balance_matches:
                deferred_ledger_mismatch_count += 1
                issues.append(
                    ValidationIssue(
                        "warning",
                        "ledger_balance_after_mismatch_deferred_dependency",
                        "Ledger balance_after mismatch occurs in a customer timeline with deferred invoice/return dependencies; downgraded for core import readiness but must be reconciled during full ledger migration.",
                        "customer_balance_ledgers",
                        _row_value(row, "id"),
                        {"customer_id": customer_id, "expected": str(expected_balance), "actual": str(actual_balance)},
                    )
                )
                continue
            blocking_ledger_mismatch_count += 1
            issues.append(
                ValidationIssue(
                    "error",
                    "ledger_balance_after_mismatch",
                    "Ledger balance_after does not match recomputed running balance.",
                    "customer_balance_ledgers",
                    _row_value(row, "id"),
                    {"customer_id": customer_id, "expected": str(expected_balance), "actual": str(actual_balance)},
                )
            )

    return {
        "affected_ledger_mismatch_customer_count": len(affected_ledger_mismatch_customer_ids),
        "deferred_ledger_mismatch_count": deferred_ledger_mismatch_count,
        "blocking_ledger_mismatch_count": blocking_ledger_mismatch_count,
        "customers_current_balance_matched_count": customers_current_balance_matched_count,
        "customers_current_balance_mismatch_count": customers_current_balance_mismatch_count,
    }


def _ledger_order_key(row: sqlite3.Row) -> tuple[str, int, int]:
    effective_datetime = _row_value(row, "transaction_datetime") or _row_value(row, "created_at") or ""
    return (str(effective_datetime), int(_row_value(row, "display_order", 0) or 0), int(_row_value(row, "id") or 0))


def _detect_deferred_ledger_dependency(row: sqlite3.Row, issues: list[ValidationIssue]) -> None:
    row_id = _row_value(row, "id")
    ref_type = _normalize_text(_row_value(row, "ref_type")).upper()
    source_ref_type = _normalize_text(_row_value(row, "source_ref_type")).upper()
    if _is_deferred_ledger_dependency(row):
        issues.append(
            ValidationIssue(
                "warning",
                "deferred_sales_return_ledger_dependency",
                "Ledger row references invoice/return behavior deferred to later migration phases.",
                "customer_balance_ledgers",
                row_id,
                {"ref_type": ref_type, "source_ref_type": source_ref_type},
            )
        )


def _is_deferred_ledger_dependency(row: sqlite3.Row) -> bool:
    ref_type = _normalize_text(_row_value(row, "ref_type")).upper()
    source_ref_type = _normalize_text(_row_value(row, "source_ref_type")).upper()
    note = _normalize_text(_row_value(row, "note")).lower()
    return ref_type in DEFERRED_REF_TYPES or source_ref_type in DEFERRED_REF_TYPES or "overpayment from invoice" in note
