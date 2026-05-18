from __future__ import annotations

import sqlite3
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.importers.app_db_inventory_customer_validator import (
    DEFERRED_REF_TYPES,
    ValidationResult,
    validate_app_db,
)
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice


CORE_LEDGER_EVENT_TYPES = {
    "OPENING_BALANCE",
    "BALANCE_ADJUSTMENT",
    "DEBT_PAYMENT",
    "DEBT_PAYMENT_EDIT_ROLLBACK",
}


@dataclass(frozen=True, slots=True)
class ImportCounts:
    products: int = 0
    product_prices: int = 0
    inventory_balances: int = 0
    customers: int = 0
    debt_payments: int = 0
    customer_ledgers: int = 0


@dataclass(frozen=True, slots=True)
class DeferredCounts:
    deferred_sales_return_ledgers: int = 0
    ambiguous_debt_payment_groups: int = 0
    unsupported_core_ledgers: int = 0


@dataclass(frozen=True, slots=True)
class MappingCounts:
    product_id_mappings: int = 0
    customer_id_mappings: int = 0
    debt_payment_mappings: int = 0


@dataclass(frozen=True, slots=True)
class CoreImportReport:
    source_app_db_path: str
    dry_run: bool
    validation_summary: dict[str, Any]
    validator_can_import_core: bool
    validator_can_import_full_ledger: bool
    imported_counts: ImportCounts = field(default_factory=ImportCounts)
    deferred_counts: DeferredCounts = field(default_factory=DeferredCounts)
    mapping_counts: MappingCounts = field(default_factory=MappingCounts)
    product_id_map: dict[int, int] = field(default_factory=dict)
    customer_id_map: dict[int, int] = field(default_factory=dict)
    debt_payment_ref_id_map: dict[int, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    can_proceed_to_sales_returns_migration: bool = False

    @property
    def succeeded(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["succeeded"] = self.succeeded
        return data


@dataclass(slots=True)
class _ImportPlan:
    products: list[sqlite3.Row]
    product_prices: list[sqlite3.Row]
    inventory_balances: list[sqlite3.Row]
    customers: list[sqlite3.Row]
    ledgers_to_import: list[sqlite3.Row]
    debt_payment_groups: dict[int, list[sqlite3.Row]]
    deferred_sales_return_ledgers: list[sqlite3.Row]
    ambiguous_debt_payment_groups: set[int]
    unsupported_core_ledgers: list[sqlite3.Row]
    partial_ledger_customer_ids: set[int]


def import_app_db_core(
    app_db_path: str | Path,
    *,
    database_url: str | None = None,
    dry_run: bool = False,
    target_session: Session | None = None,
) -> CoreImportReport:
    source_path = Path(app_db_path)
    if not source_path.exists() or not source_path.is_file():
        return _error_report(
            source_path=source_path,
            dry_run=dry_run,
            error=f"SQLite app.db path is not readable: {source_path}",
        )

    validation = validate_app_db(source_path)
    if not validation.can_import_core:
        return _report_from_validation(
            source_path=source_path,
            dry_run=dry_run,
            validation=validation,
            imported_counts=ImportCounts(),
            deferred_counts=DeferredCounts(),
            mapping_counts=MappingCounts(),
            warnings=[],
            errors=["Source app.db failed core validation; import was not started."],
        )

    try:
        plan = _build_import_plan(source_path)
    except sqlite3.Error as exc:
        return _report_from_validation(
            source_path=source_path,
            dry_run=dry_run,
            validation=validation,
            imported_counts=ImportCounts(),
            deferred_counts=DeferredCounts(),
            mapping_counts=MappingCounts(),
            warnings=[],
            errors=[f"Could not read source app.db: {exc}"],
        )

    warnings = _plan_warnings(plan)
    planned_counts = _counts_from_plan(plan)
    deferred_counts = DeferredCounts(
        deferred_sales_return_ledgers=len(plan.deferred_sales_return_ledgers),
        ambiguous_debt_payment_groups=len(plan.ambiguous_debt_payment_groups),
        unsupported_core_ledgers=len(plan.unsupported_core_ledgers),
    )
    planned_mapping_counts = MappingCounts(
        product_id_mappings=len(plan.products),
        customer_id_mappings=len(plan.customers),
        debt_payment_mappings=len(plan.debt_payment_groups) - len(plan.ambiguous_debt_payment_groups),
    )

    if dry_run:
        return _report_from_validation(
            source_path=source_path,
            dry_run=True,
            validation=validation,
            imported_counts=planned_counts,
            deferred_counts=deferred_counts,
            mapping_counts=planned_mapping_counts,
            warnings=warnings,
            errors=[],
        )

    if target_session is not None:
        return _import_with_session(source_path, validation, plan, target_session, warnings, owns_session=False)

    if not database_url:
        return _report_from_validation(
            source_path=source_path,
            dry_run=False,
            validation=validation,
            imported_counts=ImportCounts(),
            deferred_counts=deferred_counts,
            mapping_counts=MappingCounts(),
            warnings=warnings,
            errors=["database_url is required for actual import."],
        )

    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with SessionLocal() as session:
            return _import_with_session(source_path, validation, plan, session, warnings, owns_session=True)
    except SQLAlchemyError as exc:
        return _report_from_validation(
            source_path=source_path,
            dry_run=False,
            validation=validation,
            imported_counts=ImportCounts(),
            deferred_counts=deferred_counts,
            mapping_counts=MappingCounts(),
            warnings=warnings,
            errors=[f"Target database error: {exc}"],
        )
    finally:
        if "engine" in locals():
            engine.dispose()


def _import_with_session(
    source_path: Path,
    validation: ValidationResult,
    plan: _ImportPlan,
    session: Session,
    warnings: list[str],
    *,
    owns_session: bool,
) -> CoreImportReport:
    deferred_counts = DeferredCounts(
        deferred_sales_return_ledgers=len(plan.deferred_sales_return_ledgers),
        ambiguous_debt_payment_groups=len(plan.ambiguous_debt_payment_groups),
        unsupported_core_ledgers=len(plan.unsupported_core_ledgers),
    )
    product_id_map: dict[int, int] = {}
    customer_id_map: dict[int, int] = {}
    debt_payment_ref_id_map: dict[int, int] = {}

    try:
        transaction = session.begin() if not session.in_transaction() else session.begin_nested()
        with transaction:
            non_empty_tables = _non_empty_target_tables(session)
            if non_empty_tables:
                return _report_from_validation(
                    source_path=source_path,
                    dry_run=False,
                    validation=validation,
                    imported_counts=ImportCounts(),
                    deferred_counts=deferred_counts,
                    mapping_counts=MappingCounts(),
                    warnings=warnings,
                    errors=[f"Target import tables must be empty before import: {', '.join(non_empty_tables)}"],
                )

            _insert_products(session, plan, product_id_map)
            _insert_product_prices(session, plan, product_id_map)
            _insert_inventory_balances(session, plan, product_id_map)
            _insert_customers(session, plan, customer_id_map)
            _insert_debt_payments(session, plan, customer_id_map, debt_payment_ref_id_map)
            imported_ledger_count = _insert_customer_ledgers(session, plan, customer_id_map, debt_payment_ref_id_map)

        if owns_session:
            session.commit()
    except Exception as exc:  # noqa: BLE001 - importer must return structured failure reports.
        if session.in_transaction():
            session.rollback()
        return _report_from_validation(
            source_path=source_path,
            dry_run=False,
            validation=validation,
            imported_counts=ImportCounts(),
            deferred_counts=deferred_counts,
            mapping_counts=MappingCounts(),
            warnings=warnings,
            errors=[f"Import failed and was rolled back: {exc}"],
        )

    imported_counts = _counts_from_plan(plan, customer_ledgers=imported_ledger_count)
    return _report_from_validation(
        source_path=source_path,
        dry_run=False,
        validation=validation,
        imported_counts=imported_counts,
        deferred_counts=deferred_counts,
        mapping_counts=MappingCounts(
            product_id_mappings=len(product_id_map),
            customer_id_mappings=len(customer_id_map),
            debt_payment_mappings=len(debt_payment_ref_id_map),
        ),
        warnings=warnings,
        errors=[],
        product_id_map=product_id_map,
        customer_id_map=customer_id_map,
        debt_payment_ref_id_map=debt_payment_ref_id_map,
    )


def _build_import_plan(source_path: Path) -> _ImportPlan:
    with sqlite3.connect(f"file:{source_path.resolve().as_posix()}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        products = _rows(connection, "products")
        product_prices = _rows(connection, "product_prices")
        inventory_balances = _rows(connection, "inventory_balances")
        customers = _rows(connection, "customers")
        ledgers = _rows(connection, "customer_balance_ledgers")

    deferred_sales_return_ledgers: list[sqlite3.Row] = []
    unsupported_core_ledgers: list[sqlite3.Row] = []
    ledger_candidates: list[sqlite3.Row] = []
    debt_payment_groups: defaultdict[int, list[sqlite3.Row]] = defaultdict(list)
    customer_has_deferred: set[int] = set()

    for ledger in ledgers:
        customer_id = int(_row_value(ledger, "customer_id") or 0)
        if _is_deferred_ledger(ledger):
            deferred_sales_return_ledgers.append(ledger)
            customer_has_deferred.add(customer_id)
            continue

        event_type = _text(_row_value(ledger, "event_type")).upper()
        ref_type = _text(_row_value(ledger, "ref_type")).upper()
        if event_type not in CORE_LEDGER_EVENT_TYPES:
            unsupported_core_ledgers.append(ledger)
            continue

        ledger_candidates.append(ledger)
        if ref_type == "DEBT_PAYMENT":
            debt_payment_groups[int(_row_value(ledger, "ref_id"))].append(ledger)

    ambiguous_debt_payment_groups = {
        ref_id
        for ref_id, group in debt_payment_groups.items()
        if _debt_payment_parent_row(group) is None
    }
    ledgers_to_import = [
        ledger
        for ledger in ledger_candidates
        if _text(_row_value(ledger, "ref_type")).upper() != "DEBT_PAYMENT"
        or int(_row_value(ledger, "ref_id")) not in ambiguous_debt_payment_groups
    ]
    partial_ledger_customer_ids = {
        int(_row_value(customer, "id"))
        for customer in customers
        if int(_row_value(customer, "id")) in customer_has_deferred
    }

    return _ImportPlan(
        products=products,
        product_prices=product_prices,
        inventory_balances=inventory_balances,
        customers=customers,
        ledgers_to_import=ledgers_to_import,
        debt_payment_groups=dict(debt_payment_groups),
        deferred_sales_return_ledgers=deferred_sales_return_ledgers,
        ambiguous_debt_payment_groups=ambiguous_debt_payment_groups,
        unsupported_core_ledgers=unsupported_core_ledgers,
        partial_ledger_customer_ids=partial_ledger_customer_ids,
    )


def _insert_products(session: Session, plan: _ImportPlan, product_id_map: dict[int, int]) -> None:
    now = datetime.now()
    for row in plan.products:
        product = Product(
            product_code_base=_text(_row_value(row, "product_code_base")),
            product_name=_text(_row_value(row, "product_name")),
            unit_mode=_text(_row_value(row, "unit_mode")),
            is_active=_bool(_row_value(row, "is_active", True)),
            created_at=_datetime(_row_value(row, "created_at"), default=now),
            updated_at=_datetime(_row_value(row, "updated_at"), default=now),
        )
        session.add(product)
        session.flush()
        product_id_map[int(_row_value(row, "id"))] = product.id


def _insert_product_prices(session: Session, plan: _ImportPlan, product_id_map: dict[int, int]) -> None:
    for row in plan.product_prices:
        old_product_id = int(_row_value(row, "product_id"))
        session.add(
            ProductPrice(
                product_id=product_id_map[old_product_id],
                unit_type=_text(_row_value(row, "unit_type")),
                price=_decimal(_row_value(row, "price")),
                is_enabled=_bool(_row_value(row, "is_enabled", True)),
            )
        )
    session.flush()


def _insert_inventory_balances(session: Session, plan: _ImportPlan, product_id_map: dict[int, int]) -> None:
    now = datetime.now()
    for row in plan.inventory_balances:
        old_product_id = int(_row_value(row, "product_id"))
        session.add(
            InventoryBalance(
                product_id=product_id_map[old_product_id],
                on_hand_bao_decimal=_optional_decimal(_row_value(row, "on_hand_bao_decimal")),
                on_hand_bich_integer=_optional_decimal(_row_value(row, "on_hand_bich_integer")),
                updated_at=_datetime(_row_value(row, "updated_at"), default=now),
            )
        )
    session.flush()


def _insert_customers(session: Session, plan: _ImportPlan, customer_id_map: dict[int, int]) -> None:
    now = datetime.now()
    for row in plan.customers:
        customer = Customer(
            customer_name=_text(_row_value(row, "customer_name")),
            phone=_optional_text(_row_value(row, "phone")),
            address=_optional_text(_row_value(row, "address")),
            note=_optional_text(_row_value(row, "note")),
            current_balance=_decimal(_row_value(row, "current_balance", 0)),
            total_sales=_decimal(_row_value(row, "total_sales", 0)),
            is_walk_in=_bool(_row_value(row, "is_walk_in", False)),
            is_active=_bool(_row_value(row, "is_active", True)),
            created_at=_datetime(_row_value(row, "created_at"), default=now),
            updated_at=_datetime(_row_value(row, "updated_at"), default=now),
        )
        session.add(customer)
        session.flush()
        customer_id_map[int(_row_value(row, "id"))] = customer.id


def _insert_debt_payments(
    session: Session,
    plan: _ImportPlan,
    customer_id_map: dict[int, int],
    debt_payment_ref_id_map: dict[int, int],
) -> None:
    now = datetime.now()
    for old_ref_id, group in sorted(plan.debt_payment_groups.items()):
        if old_ref_id in plan.ambiguous_debt_payment_groups:
            continue
        parent_source = _debt_payment_parent_row(group)
        if parent_source is None:
            continue
        old_customer_id = int(_row_value(parent_source, "customer_id"))
        payment = DebtPayment(
            customer_id=customer_id_map[old_customer_id],
            amount=abs(_decimal(_row_value(parent_source, "amount_delta"))),
            payment_datetime=_datetime(
                _row_value(parent_source, "transaction_datetime"),
                default=_datetime(_row_value(parent_source, "created_at"), default=now),
            ),
            note=_optional_text(_row_value(parent_source, "note")),
            is_deleted=False,
            created_at=_datetime(_row_value(parent_source, "created_at"), default=now),
            updated_at=now,
        )
        session.add(payment)
        session.flush()
        debt_payment_ref_id_map[int(old_ref_id)] = payment.id


def _insert_customer_ledgers(
    session: Session,
    plan: _ImportPlan,
    customer_id_map: dict[int, int],
    debt_payment_ref_id_map: dict[int, int],
) -> int:
    now = datetime.now()
    imported_ledgers: list[CustomerBalanceLedger] = []
    rows = sorted(plan.ledgers_to_import, key=_ledger_order_key)
    for row in rows:
        old_customer_id = int(_row_value(row, "customer_id"))
        ref_type = _text(_row_value(row, "ref_type")).upper()
        old_ref_id = int(_row_value(row, "ref_id"))
        ref_id = debt_payment_ref_id_map[old_ref_id] if ref_type == "DEBT_PAYMENT" else old_ref_id
        ledger = CustomerBalanceLedger(
            customer_id=customer_id_map[old_customer_id],
            event_type=_text(_row_value(row, "event_type")),
            ref_type=_text(_row_value(row, "ref_type")),
            ref_id=ref_id,
            source_ref_type=_optional_text(_row_value(row, "source_ref_type")),
            source_ref_id=_optional_int(_row_value(row, "source_ref_id")),
            display_order=int(_row_value(row, "display_order", 0) or 0),
            amount_delta=_decimal(_row_value(row, "amount_delta")),
            balance_after=Decimal("0"),
            transaction_datetime=_optional_datetime(_row_value(row, "transaction_datetime")),
            created_at=_datetime(_row_value(row, "created_at"), default=now),
            note=_optional_text(_row_value(row, "note")),
        )
        session.add(ledger)
        imported_ledgers.append(ledger)
    session.flush()
    _recompute_imported_ledger_balances(imported_ledgers)
    session.flush()
    return len(imported_ledgers)


def _recompute_imported_ledger_balances(ledgers: list[CustomerBalanceLedger]) -> None:
    ledgers_by_customer: defaultdict[int, list[CustomerBalanceLedger]] = defaultdict(list)
    for ledger in ledgers:
        ledgers_by_customer[ledger.customer_id].append(ledger)

    for customer_ledgers in ledgers_by_customer.values():
        running = Decimal("0")
        for ledger in sorted(
            customer_ledgers,
            key=lambda row: (str(row.transaction_datetime or row.created_at), row.display_order, row.id),
        ):
            running += ledger.amount_delta
            ledger.balance_after = running


def _debt_payment_parent_row(group: list[sqlite3.Row]) -> sqlite3.Row | None:
    candidates = [
        row
        for row in sorted(group, key=_ledger_order_key)
        if _text(_row_value(row, "event_type")).upper() == "DEBT_PAYMENT"
        and _decimal(_row_value(row, "amount_delta")) < 0
    ]
    return candidates[-1] if candidates else None


def _non_empty_target_tables(session: Session) -> list[str]:
    checks = (
        ("products", Product),
        ("customers", Customer),
        ("customer_balance_ledgers", CustomerBalanceLedger),
        ("debt_payments", DebtPayment),
    )
    non_empty: list[str] = []
    for table_name, model in checks:
        if session.scalar(select(func.count()).select_from(model)):
            non_empty.append(table_name)
    return non_empty


def _counts_from_plan(plan: _ImportPlan, *, customer_ledgers: int | None = None) -> ImportCounts:
    imported_debt_payment_groups = len(plan.debt_payment_groups) - len(plan.ambiguous_debt_payment_groups)
    return ImportCounts(
        products=len(plan.products),
        product_prices=len(plan.product_prices),
        inventory_balances=len(plan.inventory_balances),
        customers=len(plan.customers),
        debt_payments=imported_debt_payment_groups,
        customer_ledgers=len(plan.ledgers_to_import) if customer_ledgers is None else customer_ledgers,
    )


def _plan_warnings(plan: _ImportPlan) -> list[str]:
    warnings: list[str] = []
    if plan.deferred_sales_return_ledgers:
        warnings.append(
            f"Deferred {len(plan.deferred_sales_return_ledgers)} sales/returns-linked ledger rows for later migration."
        )
    if plan.ambiguous_debt_payment_groups:
        warnings.append(
            "Skipped ambiguous standalone debt payment groups: "
            + ", ".join(str(ref_id) for ref_id in sorted(plan.ambiguous_debt_payment_groups))
        )
    if plan.unsupported_core_ledgers:
        warnings.append(f"Skipped {len(plan.unsupported_core_ledgers)} unsupported non-sales ledger rows.")
    if plan.partial_ledger_customer_ids:
        warnings.append(
            "Preserved source customer current_balance snapshots for customers with partial imported ledgers: "
            + ", ".join(str(customer_id) for customer_id in sorted(plan.partial_ledger_customer_ids))
        )
    return warnings


def _report_from_validation(
    *,
    source_path: Path,
    dry_run: bool,
    validation: ValidationResult,
    imported_counts: ImportCounts,
    deferred_counts: DeferredCounts,
    mapping_counts: MappingCounts,
    warnings: list[str],
    errors: list[str],
    product_id_map: dict[int, int] | None = None,
    customer_id_map: dict[int, int] | None = None,
    debt_payment_ref_id_map: dict[int, int] | None = None,
) -> CoreImportReport:
    return CoreImportReport(
        source_app_db_path=str(source_path),
        dry_run=dry_run,
        validation_summary=validation.to_dict()["summary"],
        validator_can_import_core=validation.can_import_core,
        validator_can_import_full_ledger=validation.can_import_full_ledger,
        imported_counts=imported_counts,
        deferred_counts=deferred_counts,
        mapping_counts=mapping_counts,
        product_id_map=product_id_map or {},
        customer_id_map=customer_id_map or {},
        debt_payment_ref_id_map=debt_payment_ref_id_map or {},
        warnings=warnings,
        errors=errors,
        can_proceed_to_sales_returns_migration=validation.can_import_full_ledger and not errors,
    )


def _error_report(*, source_path: Path, dry_run: bool, error: str) -> CoreImportReport:
    return CoreImportReport(
        source_app_db_path=str(source_path),
        dry_run=dry_run,
        validation_summary={},
        validator_can_import_core=False,
        validator_can_import_full_ledger=False,
        errors=[error],
    )


def _rows(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(connection.execute(f'SELECT * FROM "{table}" ORDER BY id'))


def _row_value(row: sqlite3.Row, column: str, default: Any = None) -> Any:
    return row[column] if column in row.keys() else default


def _is_deferred_ledger(row: sqlite3.Row) -> bool:
    ref_type = _text(_row_value(row, "ref_type")).upper()
    source_ref_type = _text(_row_value(row, "source_ref_type")).upper()
    note = _text(_row_value(row, "note")).lower()
    return ref_type in DEFERRED_REF_TYPES or source_ref_type in DEFERRED_REF_TYPES or "overpayment from invoice" in note


def _ledger_order_key(row: sqlite3.Row) -> tuple[str, int, int]:
    effective_datetime = _row_value(row, "transaction_datetime") or _row_value(row, "created_at") or ""
    return (str(effective_datetime), int(_row_value(row, "display_order", 0) or 0), int(_row_value(row, "id") or 0))


def _text(value: Any) -> str:
    return str(value or "").strip()


def _optional_text(value: Any) -> str | None:
    normalized = _text(value)
    return normalized or None


def _bool(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip().lower() not in {"", "0", "false", "no"}
    return bool(value)


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value is not None else "0"))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid decimal value: {value}") from exc


def _optional_decimal(value: Any) -> Decimal | None:
    return None if value is None else _decimal(value)


def _optional_int(value: Any) -> int | None:
    return None if value is None else int(value)


def _optional_datetime(value: Any) -> datetime | None:
    return None if value is None else _datetime(value)


def _datetime(value: Any, *, default: datetime | None = None) -> datetime:
    if value is None or value == "":
        if default is None:
            raise ValueError("Missing datetime value.")
        return default
    if isinstance(value, datetime):
        return value
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        if default is not None:
            return default
        raise
