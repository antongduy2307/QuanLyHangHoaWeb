from __future__ import annotations

import json
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

from app.domain.enums import UnitMode, UnitType
from app.domain.returns import ReturnHandlingMode
from app.domain.sales import InvoiceStatus
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import InventoryBalance
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice, InvoiceItem

DEFERRED_REF_TYPES = {"INVOICE", "RETURN", "RETURN_INVOICE"}


@dataclass(frozen=True, slots=True)
class SalesReturnsValidationSummary:
    invoice_count: int = 0
    invoice_item_count: int = 0
    return_invoice_count: int = 0
    return_invoice_item_count: int = 0
    deferred_ledger_count: int = 0
    error_count: int = 0
    warning_count: int = 0


@dataclass(frozen=True, slots=True)
class SalesReturnsImportCounts:
    invoices: int = 0
    invoice_items: int = 0
    return_invoices: int = 0
    return_invoice_items: int = 0
    restored_invoice_charge_ledgers: int = 0
    restored_invoice_payment_ledgers: int = 0
    restored_return_ledgers: int = 0
    created_source_linked_debt_payments: int = 0


@dataclass(frozen=True, slots=True)
class SalesReturnsReconciliation:
    customers_checked: int = 0
    final_balance_matches: int = 0
    final_balance_mismatches: int = 0
    inventory_balance_unchanged: bool = True


@dataclass(frozen=True, slots=True)
class SalesReturnsImportReport:
    source_app_db_path: str
    phase2_mapping_report_path: str | None
    dry_run: bool
    validation_summary: SalesReturnsValidationSummary
    imported_counts: SalesReturnsImportCounts = field(default_factory=SalesReturnsImportCounts)
    skipped_ambiguous_deferred_ledgers: int = 0
    invoice_id_map: dict[int, int] = field(default_factory=dict)
    return_id_map: dict[int, int] = field(default_factory=dict)
    source_linked_debt_payment_map: dict[int, int] = field(default_factory=dict)
    reconciliation: SalesReturnsReconciliation = field(default_factory=SalesReturnsReconciliation)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    can_import_full_ledger: bool = False

    @property
    def succeeded(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["succeeded"] = self.succeeded
        return data


@dataclass(slots=True)
class _Plan:
    invoices: list[sqlite3.Row]
    invoice_items: list[sqlite3.Row]
    return_invoices: list[sqlite3.Row]
    return_invoice_items: list[sqlite3.Row]
    deferred_ledgers: list[sqlite3.Row]
    invoice_charge_ledgers: list[sqlite3.Row]
    invoice_payment_ledgers: list[sqlite3.Row]
    return_ledgers: list[sqlite3.Row]
    source_customer_balances: dict[int, Decimal]


def validate_sales_returns_app_db(app_db_path: str | Path) -> SalesReturnsImportReport:
    source_path = Path(app_db_path)
    if not source_path.exists() or not source_path.is_file():
        return _error_report(source_path, None, True, f"SQLite app.db path is not readable: {source_path}")
    try:
        plan, errors, warnings = _build_plan(source_path)
    except sqlite3.Error as exc:
        return _error_report(source_path, None, True, f"Could not read source app.db: {exc}")
    summary = _summary(plan, errors, warnings)
    return SalesReturnsImportReport(
        source_app_db_path=str(source_path),
        phase2_mapping_report_path=None,
        dry_run=True,
        validation_summary=summary,
        imported_counts=_counts_from_plan(plan),
        warnings=warnings,
        errors=errors,
        can_import_full_ledger=not errors,
    )


def import_app_db_sales_returns(
    app_db_path: str | Path,
    *,
    core_import_report_path: str | Path | None = None,
    database_url: str | None = None,
    dry_run: bool = False,
    target_session: Session | None = None,
    simulate_failure_after_documents: bool = False,
) -> SalesReturnsImportReport:
    source_path = Path(app_db_path)
    if not source_path.exists() or not source_path.is_file():
        return _error_report(source_path, core_import_report_path, dry_run, f"SQLite app.db path is not readable: {source_path}")

    mapping_report, mapping_error = _load_mapping_report(core_import_report_path)
    if mapping_error:
        return _error_report(source_path, core_import_report_path, dry_run, mapping_error)

    try:
        plan, errors, warnings = _build_plan(source_path)
    except sqlite3.Error as exc:
        return _error_report(source_path, core_import_report_path, dry_run, f"Could not read source app.db: {exc}")

    mapping_errors = _validate_mappings(plan, mapping_report)
    errors.extend(mapping_errors)
    summary = _summary(plan, errors, warnings)
    planned_counts = _counts_from_plan(plan)
    if dry_run or errors:
        return SalesReturnsImportReport(
            source_app_db_path=str(source_path),
            phase2_mapping_report_path=str(core_import_report_path) if core_import_report_path else None,
            dry_run=dry_run,
            validation_summary=summary,
            imported_counts=planned_counts,
            warnings=warnings,
            errors=errors,
            can_import_full_ledger=not errors,
        )

    if target_session is not None:
        return _import_with_session(
            source_path,
            core_import_report_path,
            plan,
            mapping_report,
            target_session,
            warnings,
            simulate_failure_after_documents=simulate_failure_after_documents,
            owns_session=False,
        )

    if not database_url:
        return _error_report(source_path, core_import_report_path, False, "database_url is required for actual import.")

    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
        with SessionLocal() as session:
            return _import_with_session(
                source_path,
                core_import_report_path,
                plan,
                mapping_report,
                session,
                warnings,
                simulate_failure_after_documents=simulate_failure_after_documents,
                owns_session=True,
            )
    except SQLAlchemyError as exc:
        return _error_report(source_path, core_import_report_path, False, f"Target database error: {exc}")
    finally:
        if "engine" in locals():
            engine.dispose()


def _import_with_session(
    source_path: Path,
    core_import_report_path: str | Path | None,
    plan: _Plan,
    mapping_report: dict[str, Any],
    session: Session,
    warnings: list[str],
    *,
    simulate_failure_after_documents: bool,
    owns_session: bool,
) -> SalesReturnsImportReport:
    invoice_id_map: dict[int, int] = {}
    invoice_item_id_map: dict[int, int] = {}
    return_id_map: dict[int, int] = {}
    source_payment_map: dict[int, int] = {}
    try:
        tx = session.begin() if not session.in_transaction() else session.begin_nested()
        with tx:
            if _target_has_documents(session):
                return _failure_from_plan(source_path, core_import_report_path, plan, warnings, "Target invoices/returns must be empty before historical import.")
            before_inventory = _inventory_snapshot(session)
            product_map = _int_map(mapping_report.get("product_id_map", {}))
            customer_map = _int_map(mapping_report.get("customer_id_map", {}))
            _insert_invoices(session, plan, product_map, customer_map, invoice_id_map, invoice_item_id_map)
            _insert_returns(session, plan, product_map, customer_map, invoice_id_map, invoice_item_id_map, return_id_map)
            if simulate_failure_after_documents:
                raise RuntimeError("simulated failure")
            counts = _restore_deferred_ledgers(session, plan, customer_map, invoice_id_map, return_id_map, source_payment_map)
            reconciliation = _recompute_and_verify_customer_ledgers(session, plan, customer_map, before_inventory)
            if reconciliation.final_balance_mismatches:
                raise RuntimeError("Final customer balance mismatch after full ledger restoration.")
        if owns_session:
            session.commit()
    except Exception as exc:  # noqa: BLE001
        if session.in_transaction():
            session.rollback()
        return _failure_from_plan(source_path, core_import_report_path, plan, warnings, f"Import failed and was rolled back: {exc}")

    imported_counts = SalesReturnsImportCounts(
        invoices=len(plan.invoices),
        invoice_items=len(plan.invoice_items),
        return_invoices=len(plan.return_invoices),
        return_invoice_items=len(plan.return_invoice_items),
        restored_invoice_charge_ledgers=counts["invoice_charge"],
        restored_invoice_payment_ledgers=counts["invoice_payment"],
        restored_return_ledgers=counts["return"],
        created_source_linked_debt_payments=len(source_payment_map),
    )
    return SalesReturnsImportReport(
        source_app_db_path=str(source_path),
        phase2_mapping_report_path=str(core_import_report_path) if core_import_report_path else None,
        dry_run=False,
        validation_summary=_summary(plan, [], warnings),
        imported_counts=imported_counts,
        invoice_id_map=invoice_id_map,
        return_id_map=return_id_map,
        source_linked_debt_payment_map=source_payment_map,
        reconciliation=reconciliation,
        warnings=warnings,
        errors=[],
        can_import_full_ledger=True,
    )


def _build_plan(source_path: Path) -> tuple[_Plan, list[str], list[str]]:
    with sqlite3.connect(f"file:{source_path.resolve().as_posix()}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        errors = _required_tables(conn)
        if errors:
            empty = _Plan([], [], [], [], [], [], [], [], {})
            return empty, errors, []
        invoices = _rows(conn, "invoices")
        invoice_items = _rows(conn, "invoice_items")
        return_invoices = _rows(conn, "return_invoices") if _table_exists(conn, "return_invoices") else []
        return_invoice_items = _rows(conn, "return_invoice_items") if _table_exists(conn, "return_invoice_items") else []
        products = {int(row["id"]): row for row in _rows(conn, "products")}
        customers = {int(row["id"]): row for row in _rows(conn, "customers")}
        ledgers = _rows(conn, "customer_balance_ledgers")
    errors, warnings = _validate_source(invoices, invoice_items, return_invoices, return_invoice_items, products, customers)
    deferred = [row for row in ledgers if _is_deferred_ledger(row)]
    invoice_charge = [row for row in deferred if _text(row["event_type"]).upper() == "INVOICE_CHARGE"]
    invoice_payment = [
        row for row in deferred
        if _text(row["event_type"]).upper() == "DEBT_PAYMENT" and _text(row["source_ref_type"]).upper() == "INVOICE"
    ]
    return_ledgers = [
        row for row in deferred
        if _text(row["ref_type"]).upper() in {"RETURN", "RETURN_INVOICE"}
        or _text(row["source_ref_type"]).upper() in {"RETURN", "RETURN_INVOICE"}
    ]
    invoice_ids = {int(row["id"]) for row in invoices}
    for row in invoice_charge + invoice_payment:
        old_invoice_id = _ledger_invoice_id(row)
        if old_invoice_id not in invoice_ids:
            errors.append(f"Deferred invoice ledger {row['id']} references missing invoice {old_invoice_id}.")
    plan = _Plan(
        invoices=invoices,
        invoice_items=invoice_items,
        return_invoices=return_invoices,
        return_invoice_items=return_invoice_items,
        deferred_ledgers=deferred,
        invoice_charge_ledgers=invoice_charge,
        invoice_payment_ledgers=invoice_payment,
        return_ledgers=return_ledgers,
        source_customer_balances={customer_id: _decimal(row["current_balance"]) for customer_id, row in customers.items()},
    )
    return plan, errors, warnings


def _validate_source(
    invoices: list[sqlite3.Row],
    invoice_items: list[sqlite3.Row],
    return_invoices: list[sqlite3.Row],
    return_invoice_items: list[sqlite3.Row],
    products: dict[int, sqlite3.Row],
    customers: dict[int, sqlite3.Row],
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    invoice_codes: set[str] = set()
    invoice_by_id = {int(row["id"]): row for row in invoices}
    invoice_items_by_id = {int(row["id"]): row for row in invoice_items}
    for invoice in invoices:
        code = _text(invoice["invoice_code"])
        if not code:
            errors.append(f"Invoice {invoice['id']} has blank invoice_code.")
        if code in invoice_codes:
            errors.append(f"Duplicate invoice_code: {code}.")
        invoice_codes.add(code)
        if invoice["customer_id"] is not None and int(invoice["customer_id"]) not in customers:
            errors.append(f"Invoice {invoice['id']} references missing customer {invoice['customer_id']}.")
        if _decimal(invoice["paid_amount"]) < 0:
            errors.append(f"Invoice {invoice['id']} has negative paid_amount.")
        if _text(invoice["status"]) not in {InvoiceStatus.COMPLETED.value, "DRAFT", "CANCELLED"}:
            errors.append(f"Invoice {invoice['id']} has unsupported status {_text(invoice['status'])}.")
    items_by_invoice: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for item in invoice_items:
        invoice_id = int(item["invoice_id"])
        product_id = int(item["product_id"])
        if invoice_id not in invoice_by_id:
            errors.append(f"Invoice item {item['id']} references missing invoice {invoice_id}.")
        product = products.get(product_id)
        if product is None:
            errors.append(f"Invoice item {item['id']} references missing product {product_id}.")
            continue
        quantity = _decimal(item["quantity"])
        if quantity <= 0:
            errors.append(f"Invoice item {item['id']} quantity must be > 0.")
        if _text(item["unit_type"]) not in _allowed_units(_text(product["unit_mode"])):
            errors.append(f"Invoice item {item['id']} unit_type is incompatible with product unit_mode.")
        if _decimal(item["unit_price"]) < 0 or _decimal(item["line_total"]) < 0:
            errors.append(f"Invoice item {item['id']} price/line_total must be >= 0.")
        if not _text(item["product_code_snapshot"]) or not _text(item["product_name_snapshot"]):
            errors.append(f"Invoice item {item['id']} has blank product snapshot.")
        items_by_invoice[invoice_id] += _decimal(item["line_total"])
    for invoice in invoices:
        diff = abs(items_by_invoice[int(invoice["id"])] - _decimal(invoice["total_amount"]))
        if diff > Decimal("0.01"):
            warnings.append(f"Invoice {invoice['id']} stored total differs from item sum by {diff}.")
    return_codes: set[str] = set()
    return_by_id = {int(row["id"]): row for row in return_invoices}
    returned_by_source_item: defaultdict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for ret in return_invoices:
        code = _text(ret["return_code"])
        if not code:
            errors.append(f"Return {ret['id']} has blank return_code.")
        if code in return_codes:
            errors.append(f"Duplicate return_code: {code}.")
        return_codes.add(code)
        if ret["source_invoice_id"] is not None and int(ret["source_invoice_id"]) not in invoice_by_id:
            errors.append(f"Return {ret['id']} references missing source invoice {ret['source_invoice_id']}.")
        if ret["customer_id"] is not None and int(ret["customer_id"]) not in customers:
            errors.append(f"Return {ret['id']} references missing customer {ret['customer_id']}.")
        if _text(ret["handling_mode"]) not in {ReturnHandlingMode.REFUND_NOW.value, ReturnHandlingMode.STORE_CREDIT.value}:
            errors.append(f"Return {ret['id']} has unsupported handling_mode.")
    for item in return_invoice_items:
        return_id = int(item["return_invoice_id"])
        product_id = int(item["product_id"])
        if return_id not in return_by_id:
            errors.append(f"Return item {item['id']} references missing return {return_id}.")
        product = products.get(product_id)
        if product is None:
            errors.append(f"Return item {item['id']} references missing product {product_id}.")
            continue
        quantity = _decimal(item["quantity"])
        if quantity <= 0:
            errors.append(f"Return item {item['id']} quantity must be > 0.")
        if _text(item["unit_type"]) not in _allowed_units(_text(product["unit_mode"])):
            errors.append(f"Return item {item['id']} unit_type is incompatible with product unit_mode.")
        if item["source_invoice_item_id"] is not None:
            source_item_id = int(item["source_invoice_item_id"])
            if source_item_id not in invoice_items_by_id:
                errors.append(f"Return item {item['id']} references missing source invoice item {source_item_id}.")
            else:
                returned_by_source_item[source_item_id] += quantity
    for source_item_id, returned_qty in returned_by_source_item.items():
        if returned_qty > _decimal(invoice_items_by_id[source_item_id]["quantity"]):
            errors.append(f"Returned quantity exceeds source invoice item {source_item_id}.")
    return errors, warnings


def _insert_invoices(
    session: Session,
    plan: _Plan,
    product_map: dict[int, int],
    customer_map: dict[int, int],
    invoice_id_map: dict[int, int],
    invoice_item_id_map: dict[int, int],
) -> None:
    now = datetime.now()
    for row in plan.invoices:
        invoice = Invoice(
            invoice_code=_text(row["invoice_code"]),
            customer_id=None if row["customer_id"] is None else customer_map[int(row["customer_id"])],
            customer_snapshot_name=_text(row["customer_snapshot_name"]),
            invoice_datetime=_datetime(row["invoice_datetime"], default=now),
            total_amount=_decimal(row["total_amount"]),
            paid_amount=_decimal(row["paid_amount"]),
            payment_method=_optional_text(row["payment_method"]),
            status=_text(row["status"]),
            note=_optional_text(row["note"]),
            created_at=_datetime(_row_value(row, "created_at"), default=now),
            updated_at=_datetime(_row_value(row, "updated_at"), default=now),
        )
        session.add(invoice)
        session.flush()
        invoice_id_map[int(row["id"])] = invoice.id
    for row in plan.invoice_items:
        item = InvoiceItem(
            invoice_id=invoice_id_map[int(row["invoice_id"])],
            product_id=product_map[int(row["product_id"])],
            unit_type=_text(row["unit_type"]),
            quantity=_decimal(row["quantity"]),
            unit_price=_decimal(row["unit_price"]),
            line_total=_decimal(row["line_total"]),
            product_code_snapshot=_text(row["product_code_snapshot"]),
            product_name_snapshot=_text(row["product_name_snapshot"]),
        )
        session.add(item)
        session.flush()
        invoice_item_id_map[int(row["id"])] = item.id
    session.flush()


def _insert_returns(
    session: Session,
    plan: _Plan,
    product_map: dict[int, int],
    customer_map: dict[int, int],
    invoice_id_map: dict[int, int],
    invoice_item_id_map: dict[int, int],
    return_id_map: dict[int, int],
) -> None:
    now = datetime.now()
    for row in plan.return_invoices:
        ret = ReturnInvoice(
            return_code=_text(row["return_code"]),
            source_invoice_id=None if row["source_invoice_id"] is None else invoice_id_map[int(row["source_invoice_id"])],
            customer_id=None if row["customer_id"] is None else customer_map[int(row["customer_id"])],
            customer_snapshot_name=_text(row["customer_snapshot_name"]),
            is_quick_return=_bool(row["is_quick_return"]),
            return_datetime=_datetime(row["return_datetime"], default=now),
            total_amount=_decimal(row["total_amount"]),
            handling_mode=_text(row["handling_mode"]),
            note=_optional_text(row["note"]),
            created_at=_datetime(_row_value(row, "created_at"), default=now),
            updated_at=_datetime(_row_value(row, "updated_at"), default=now),
        )
        session.add(ret)
        session.flush()
        return_id_map[int(row["id"])] = ret.id
    for row in plan.return_invoice_items:
        session.add(
            ReturnInvoiceItem(
                return_invoice_id=return_id_map[int(row["return_invoice_id"])],
                source_invoice_item_id=None if row["source_invoice_item_id"] is None else invoice_item_id_map[int(row["source_invoice_item_id"])],
                product_id=product_map[int(row["product_id"])],
                unit_type=_text(row["unit_type"]),
                quantity=_decimal(row["quantity"]),
                unit_price=_decimal(row["unit_price"]),
                line_total=_decimal(row["line_total"]),
                product_code_snapshot=_text(row["product_code_snapshot"]),
                product_name_snapshot=_text(row["product_name_snapshot"]),
            )
        )
    session.flush()


def _restore_deferred_ledgers(
    session: Session,
    plan: _Plan,
    customer_map: dict[int, int],
    invoice_id_map: dict[int, int],
    return_id_map: dict[int, int],
    source_payment_map: dict[int, int],
) -> dict[str, int]:
    counts = {"invoice_charge": 0, "invoice_payment": 0, "return": 0}
    for row in sorted(plan.invoice_charge_ledgers, key=_ledger_order_key):
        _add_mapped_ledger(session, row, customer_map, ref_id=invoice_id_map[_ledger_invoice_id(row)], source_ref_id=invoice_id_map[_ledger_invoice_id(row)])
        counts["invoice_charge"] += 1
    for row in sorted(plan.invoice_payment_ledgers, key=_ledger_order_key):
        old_invoice_id = _ledger_invoice_id(row)
        new_customer_id = customer_map[int(row["customer_id"])]
        payment = DebtPayment(
            customer_id=new_customer_id,
            amount=abs(_decimal(row["amount_delta"])),
            payment_datetime=_datetime(row["transaction_datetime"], default=datetime.now()),
            note=_optional_text(row["note"]),
            is_deleted=False,
            created_at=_datetime(_row_value(row, "created_at"), default=datetime.now()),
            updated_at=datetime.now(),
        )
        session.add(payment)
        session.flush()
        source_payment_map[int(row["ref_id"])] = payment.id
        _add_mapped_ledger(session, row, customer_map, ref_id=payment.id, source_ref_id=invoice_id_map[old_invoice_id])
        counts["invoice_payment"] += 1
    for row in sorted(plan.return_ledgers, key=_ledger_order_key):
        old_return_id = _ledger_return_id(row)
        _add_mapped_ledger(session, row, customer_map, ref_id=return_id_map[old_return_id], source_ref_id=return_id_map[old_return_id])
        counts["return"] += 1
    session.flush()
    return counts


def _add_mapped_ledger(
    session: Session,
    row: sqlite3.Row,
    customer_map: dict[int, int],
    *,
    ref_id: int,
    source_ref_id: int | None,
) -> None:
    session.add(
        CustomerBalanceLedger(
            customer_id=customer_map[int(row["customer_id"])],
            event_type=_text(row["event_type"]),
            ref_type=_text(row["ref_type"]),
            ref_id=ref_id,
            source_ref_type=_optional_text(row["source_ref_type"]),
            source_ref_id=source_ref_id if _optional_text(row["source_ref_type"]) else None,
            display_order=int(_row_value(row, "display_order", 0) or 0),
            amount_delta=_decimal(row["amount_delta"]),
            balance_after=Decimal("0"),
            transaction_datetime=_optional_datetime(row["transaction_datetime"]),
            created_at=_datetime(_row_value(row, "created_at"), default=datetime.now()),
            note=_optional_text(row["note"]),
        )
    )


def _recompute_and_verify_customer_ledgers(
    session: Session,
    plan: _Plan,
    customer_map: dict[int, int],
    before_inventory: dict[int, tuple[Decimal | None, Decimal | None]],
) -> SalesReturnsReconciliation:
    matches = 0
    mismatches = 0
    for old_customer_id, expected_balance in plan.source_customer_balances.items():
        new_customer_id = customer_map[old_customer_id]
        customer = session.get(Customer, new_customer_id)
        ledgers = list(
            session.scalars(
                select(CustomerBalanceLedger)
                .where(CustomerBalanceLedger.customer_id == new_customer_id)
                .order_by(CustomerBalanceLedger.transaction_datetime.asc(), CustomerBalanceLedger.display_order.asc(), CustomerBalanceLedger.id.asc())
            )
        )
        running = Decimal("0")
        for ledger in ledgers:
            running += ledger.amount_delta
            ledger.balance_after = running
        if customer is not None:
            customer.current_balance = running
        if running == expected_balance:
            matches += 1
        else:
            mismatches += 1
    session.flush()
    return SalesReturnsReconciliation(
        customers_checked=len(plan.source_customer_balances),
        final_balance_matches=matches,
        final_balance_mismatches=mismatches,
        inventory_balance_unchanged=before_inventory == _inventory_snapshot(session),
    )


def _load_mapping_report(path: str | Path | None) -> tuple[dict[str, Any], str | None]:
    if path is None:
        return {}, "core import mapping report is required."
    report_path = Path(path)
    if not report_path.exists() or not report_path.is_file():
        return {}, f"core import mapping report is not readable: {report_path}"
    try:
        return json.loads(report_path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return {}, f"core import mapping report is invalid JSON: {exc}"


def _validate_mappings(plan: _Plan, report: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    product_map = _int_map(report.get("product_id_map", {}))
    customer_map = _int_map(report.get("customer_id_map", {}))
    product_ids = {int(row["product_id"]) for row in plan.invoice_items + plan.return_invoice_items}
    customer_ids = {int(row["customer_id"]) for row in plan.invoices + plan.return_invoices if row["customer_id"] is not None}
    customer_ids.update(int(row["customer_id"]) for row in plan.deferred_ledgers)
    missing_products = sorted(product_ids - set(product_map))
    missing_customers = sorted(customer_ids - set(customer_map))
    if missing_products:
        errors.append(f"Missing product id mappings: {missing_products}")
    if missing_customers:
        errors.append(f"Missing customer id mappings: {missing_customers}")
    return errors


def _summary(plan: _Plan, errors: list[str], warnings: list[str]) -> SalesReturnsValidationSummary:
    return SalesReturnsValidationSummary(
        invoice_count=len(plan.invoices),
        invoice_item_count=len(plan.invoice_items),
        return_invoice_count=len(plan.return_invoices),
        return_invoice_item_count=len(plan.return_invoice_items),
        deferred_ledger_count=len(plan.deferred_ledgers),
        error_count=len(errors),
        warning_count=len(warnings),
    )


def _counts_from_plan(plan: _Plan) -> SalesReturnsImportCounts:
    return SalesReturnsImportCounts(
        invoices=len(plan.invoices),
        invoice_items=len(plan.invoice_items),
        return_invoices=len(plan.return_invoices),
        return_invoice_items=len(plan.return_invoice_items),
        restored_invoice_charge_ledgers=len(plan.invoice_charge_ledgers),
        restored_invoice_payment_ledgers=len(plan.invoice_payment_ledgers),
        restored_return_ledgers=len(plan.return_ledgers),
        created_source_linked_debt_payments=len(plan.invoice_payment_ledgers),
    )


def _failure_from_plan(source_path: Path, report_path: str | Path | None, plan: _Plan, warnings: list[str], error: str) -> SalesReturnsImportReport:
    return SalesReturnsImportReport(
        source_app_db_path=str(source_path),
        phase2_mapping_report_path=str(report_path) if report_path else None,
        dry_run=False,
        validation_summary=_summary(plan, [error], warnings),
        imported_counts=SalesReturnsImportCounts(),
        warnings=warnings,
        errors=[error],
        can_import_full_ledger=False,
    )


def _error_report(source_path: Path, report_path: str | Path | None, dry_run: bool, error: str) -> SalesReturnsImportReport:
    return SalesReturnsImportReport(
        source_app_db_path=str(source_path),
        phase2_mapping_report_path=str(report_path) if report_path else None,
        dry_run=dry_run,
        validation_summary=SalesReturnsValidationSummary(error_count=1),
        errors=[error],
    )


def _required_tables(conn: sqlite3.Connection) -> list[str]:
    required = ["invoices", "invoice_items", "products", "customers", "customer_balance_ledgers"]
    return [f"Missing required table: {table}" for table in required if not _table_exists(conn, table)]


def _table_exists(conn: sqlite3.Connection, table: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is not None


def _rows(conn: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(conn.execute(f'SELECT * FROM "{table}" ORDER BY id'))


def _target_has_documents(session: Session) -> bool:
    return bool(session.scalar(select(func.count()).select_from(Invoice))) or bool(session.scalar(select(func.count()).select_from(ReturnInvoice)))


def _inventory_snapshot(session: Session) -> dict[int, tuple[Decimal | None, Decimal | None]]:
    rows = session.scalars(select(InventoryBalance).order_by(InventoryBalance.product_id.asc())).all()
    return {row.product_id: (row.on_hand_bao_decimal, row.on_hand_bich_integer) for row in rows}


def _is_deferred_ledger(row: sqlite3.Row) -> bool:
    return (
        _text(row["ref_type"]).upper() in DEFERRED_REF_TYPES
        or _text(row["source_ref_type"]).upper() in DEFERRED_REF_TYPES
        or "overpayment from invoice" in _text(row["note"]).lower()
    )


def _ledger_invoice_id(row: sqlite3.Row) -> int:
    return int(row["source_ref_id"] or row["ref_id"])


def _ledger_return_id(row: sqlite3.Row) -> int:
    return int(row["source_ref_id"] or row["ref_id"])


def _ledger_order_key(row: sqlite3.Row) -> tuple[str, int, int]:
    return (str(row["transaction_datetime"] or row["created_at"] or ""), int(row["display_order"] or 0), int(row["id"]))


def _allowed_units(unit_mode: str) -> set[str]:
    if unit_mode == UnitMode.BAO_KG.value:
        return {UnitType.BAO.value, UnitType.KG.value}
    if unit_mode == UnitMode.BICH.value:
        return {UnitType.BICH.value}
    return set()


def _int_map(raw: dict[str, Any]) -> dict[int, int]:
    return {int(key): int(value) for key, value in raw.items()}


def _row_value(row: sqlite3.Row, column: str, default: Any = None) -> Any:
    return row[column] if column in row.keys() else default


def _text(value: Any) -> str:
    return str(value or "").strip()


def _optional_text(value: Any) -> str | None:
    text = _text(value)
    return text or None


def _bool(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() not in {"", "0", "false", "no"}
    return bool(value)


def _decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value is not None else "0"))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Invalid decimal value: {value}") from exc


def _optional_datetime(value: Any) -> datetime | None:
    return None if value is None else _datetime(value)


def _datetime(value: Any, *, default: datetime | None = None) -> datetime:
    if value is None or value == "":
        if default is None:
            raise ValueError("Missing datetime value.")
        return default
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        if default is not None:
            return default
        raise
