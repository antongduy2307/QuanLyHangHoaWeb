from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.application.customer_service import CustomerService
from app.application.document_service import DocumentService
from app.application.inventory_service import InventoryService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import NotFoundError, ValidationError
from app.domain.inventory import coerce_unit_type, validate_unit_type_for_mode
from app.domain.money import require_non_negative_money, to_money
from app.domain.quantity import to_quantity
from app.domain.sales import InvoiceStatus, PaymentMethod
from app.infrastructure.db.models.customer import DebtPayment
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.models.sales import Invoice, InvoiceItem
from app.infrastructure.db.repositories.customer import CustomerRepository
from app.infrastructure.db.repositories.inventory import InventoryRepository
from app.infrastructure.db.repositories.sales import SalesRepository
from app.schemas.sales import InvoiceItemInput


@dataclass(frozen=True, slots=True)
class NormalizedInvoiceLine:
    product: Product
    unit_type: UnitType
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal


class SalesService:
    def __init__(
        self,
        repository: SalesRepository | None = None,
        inventory_service: InventoryService | None = None,
        customer_service: CustomerService | None = None,
        document_service: DocumentService | None = None,
        inventory_repository: InventoryRepository | None = None,
        customer_repository: CustomerRepository | None = None,
    ) -> None:
        self._repository = repository or SalesRepository()
        self._inventory_service = inventory_service or InventoryService()
        self._customer_service = customer_service or CustomerService()
        self._document_service = document_service or DocumentService()
        self._inventory_repository = inventory_repository or InventoryRepository()
        self._customer_repository = customer_repository or CustomerRepository()

    def create_invoice(
        self,
        session: Session,
        *,
        customer_id: int | None,
        invoice_datetime: datetime,
        items: list[InvoiceItemInput] | tuple[InvoiceItemInput, ...],
        paid_amount: Decimal | int | str = Decimal("0"),
        customer_snapshot_name: str | None = None,
        payment_method: PaymentMethod | str | None = None,
        note: str | None = None,
        invoice_code: str | None = None,
    ) -> Invoice:
        if not items:
            raise ValidationError("Invoice must contain at least one item.")
        normalized_paid = require_non_negative_money(paid_amount, "paid_amount")
        customer = None
        if customer_id is not None:
            customer = self._customer_repository.get_customer_for_update(session, customer_id)
            if not customer.is_active:
                raise ValidationError("Inactive customers cannot be used for new invoices.")
            snapshot_name = customer_snapshot_name.strip() if customer_snapshot_name else customer.customer_name
        else:
            snapshot_name = (customer_snapshot_name or "Khach le").strip()
        if not snapshot_name:
            raise ValidationError("customer_snapshot_name is required.")

        normalized_lines = self._normalize_lines(session, items, require_active_product=True)
        total_amount = sum((line.line_total for line in normalized_lines), start=Decimal("0"))
        if customer is None and normalized_paid < total_amount:
            raise ValidationError("Walk-in invoices must be fully paid.")

        invoice = Invoice(
            invoice_code=invoice_code or self._document_service.next_invoice_code(session, invoice_datetime),
            customer_id=customer.id if customer is not None else None,
            customer_snapshot_name=snapshot_name,
            invoice_datetime=invoice_datetime,
            total_amount=total_amount,
            paid_amount=normalized_paid,
            payment_method=self._normalize_payment_method(payment_method),
            status=InvoiceStatus.COMPLETED.value,
            note=(note or "").strip() or None,
        )
        self._repository.add_invoice(session, invoice)
        session.flush()

        for line in normalized_lines:
            self._inventory_service.decrease_stock(session, line.product.id, line.quantity, line.unit_type, record_adjustment=False)
            invoice.items.append(
                InvoiceItem(
                    invoice_id=invoice.id,
                    product_id=line.product.id,
                    unit_type=line.unit_type.value,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    line_total=line.line_total,
                    product_code_snapshot=line.product.product_code_base,
                    product_name_snapshot=line.product.product_name,
                )
            )

        if customer is not None:
            customer.total_sales += total_amount
            self._customer_service._append_balance_ledger(
                session,
                customer,
                amount_delta=total_amount,
                event_type="INVOICE_CHARGE",
                ref_type="INVOICE",
                ref_id=invoice.id,
                note=f"Invoice {invoice.invoice_code}",
                transaction_datetime=invoice.invoice_datetime,
                source_ref_type="INVOICE",
                source_ref_id=invoice.id,
                display_order=10,
            )
            if normalized_paid > Decimal("0"):
                debt_payment = DebtPayment(
                    customer_id=customer.id,
                    amount=normalized_paid,
                    payment_datetime=invoice.invoice_datetime,
                    note=f"Payment for invoice {invoice.invoice_code}",
                    is_deleted=False,
                )
                self._customer_repository.add_debt_payment(session, debt_payment)
                session.flush()
                self._customer_service._append_balance_ledger(
                    session,
                    customer,
                    amount_delta=normalized_paid * Decimal("-1"),
                    event_type="DEBT_PAYMENT",
                    ref_type="DEBT_PAYMENT",
                    ref_id=debt_payment.id,
                    note=debt_payment.note,
                    transaction_datetime=invoice.invoice_datetime,
                    source_ref_type="INVOICE",
                    source_ref_id=invoice.id,
                    display_order=20,
                )
            session.flush()
            self._customer_service.recompute_customer_balance(session, customer.id)

        session.flush()
        return invoice

    def get_invoice(self, session: Session, invoice_id: int) -> Invoice:
        return self._repository.get_invoice(session, invoice_id)

    def list_invoices(
        self,
        session: Session,
        *,
        customer_id: int | None = None,
        search: str = "",
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[Invoice]:
        return self._repository.list_invoices(
            session,
            customer_id=customer_id,
            search=search,
            date_from=date_from,
            date_to=date_to,
        )

    def delete_invoice(self, session: Session, invoice_id: int) -> None:
        invoice = self._repository.get_invoice_for_update(session, invoice_id)
        items = self._repository.load_invoice_items_for_update(session, invoice.id)
        self._rollback_invoice_effects(session, invoice, items)
        self._repository.delete_invoice(session, invoice)
        session.flush()

    def update_invoice(
        self,
        session: Session,
        invoice_id: int,
        *,
        customer_id: int | None,
        invoice_datetime: datetime,
        items: list[InvoiceItemInput] | tuple[InvoiceItemInput, ...],
        paid_amount: Decimal | int | str,
        customer_snapshot_name: str | None = None,
        payment_method: PaymentMethod | str | None = None,
        note: str | None = None,
    ) -> Invoice:
        invoice = self._repository.get_invoice_for_update(session, invoice_id)
        old_items = self._repository.load_invoice_items_for_update(session, invoice.id)
        if not items:
            raise ValidationError("Invoice must contain at least one item.")

        normalized_paid = require_non_negative_money(paid_amount, "paid_amount")
        new_customer = None
        if customer_id is not None:
            new_customer = self._customer_repository.get_customer_for_update(session, customer_id)
            snapshot_name = customer_snapshot_name.strip() if customer_snapshot_name else new_customer.customer_name
        else:
            snapshot_name = (customer_snapshot_name or "Khach le").strip()
        if not snapshot_name:
            raise ValidationError("customer_snapshot_name is required.")

        existing_product_ids = {item.product_id for item in old_items}
        normalized_lines = self._normalize_lines(
            session,
            items,
            require_active_product=True,
            allowed_inactive_product_ids=existing_product_ids,
        )
        total_amount = sum((line.line_total for line in normalized_lines), start=Decimal("0"))
        if new_customer is None and normalized_paid < total_amount:
            raise ValidationError("Walk-in invoices must be fully paid.")

        self._rollback_invoice_effects(session, invoice, old_items)
        for item in old_items:
            session.delete(item)
        session.flush()

        invoice.customer_id = new_customer.id if new_customer is not None else None
        invoice.customer_snapshot_name = snapshot_name
        invoice.invoice_datetime = invoice_datetime
        invoice.total_amount = total_amount
        invoice.paid_amount = normalized_paid
        invoice.payment_method = self._normalize_payment_method(payment_method)
        invoice.status = InvoiceStatus.COMPLETED.value
        invoice.note = (note or "").strip() or None
        invoice.items.clear()
        session.flush()

        for line in normalized_lines:
            self._inventory_service.decrease_stock(session, line.product.id, line.quantity, line.unit_type, record_adjustment=False)
            invoice.items.append(
                InvoiceItem(
                    invoice_id=invoice.id,
                    product_id=line.product.id,
                    unit_type=line.unit_type.value,
                    quantity=line.quantity,
                    unit_price=line.unit_price,
                    line_total=line.line_total,
                    product_code_snapshot=line.product.product_code_base,
                    product_name_snapshot=line.product.product_name,
                )
            )

        if new_customer is not None:
            self._apply_customer_invoice_effects(session, new_customer, invoice, total_amount, normalized_paid)
        session.flush()
        return invoice

    def _rollback_invoice_effects(
        self,
        session: Session,
        invoice: Invoice,
        items: list[InvoiceItem],
    ) -> None:
        for item in sorted(items, key=lambda row: row.product_id):
            self._inventory_service.increase_stock(session, item.product_id, item.quantity, item.unit_type, record_adjustment=False)

        if invoice.customer_id is not None:
            customer = self._customer_repository.get_customer_for_update(session, invoice.customer_id)
            customer.total_sales -= invoice.total_amount
            if customer.total_sales < Decimal("0"):
                raise ValidationError("total_sales cannot become negative.")
            ledgers = self._customer_repository.list_ledgers_by_source_for_update(
                session,
                customer.id,
                "INVOICE",
                invoice.id,
            )
            debt_payment_ids = {
                ledger.ref_id for ledger in ledgers if ledger.ref_type == "DEBT_PAYMENT"
            }
            for ledger in ledgers:
                session.delete(ledger)
            for debt_payment_id in debt_payment_ids:
                debt_payment = self._customer_repository.get_debt_payment_for_update(
                    session,
                    debt_payment_id,
                    include_deleted=True,
                )
                session.delete(debt_payment)
            session.flush()
            self._customer_service.recompute_customer_balance(session, customer.id)

    def _apply_customer_invoice_effects(
        self,
        session: Session,
        customer,
        invoice: Invoice,
        total_amount: Decimal,
        paid_amount: Decimal,
    ) -> None:
        customer.total_sales += total_amount
        self._customer_service._append_balance_ledger(
            session,
            customer,
            amount_delta=total_amount,
            event_type="INVOICE_CHARGE",
            ref_type="INVOICE",
            ref_id=invoice.id,
            note=f"Invoice {invoice.invoice_code}",
            transaction_datetime=invoice.invoice_datetime,
            source_ref_type="INVOICE",
            source_ref_id=invoice.id,
            display_order=10,
        )
        if paid_amount > Decimal("0"):
            debt_payment = DebtPayment(
                customer_id=customer.id,
                amount=paid_amount,
                payment_datetime=invoice.invoice_datetime,
                note=f"Payment for invoice {invoice.invoice_code}",
                is_deleted=False,
            )
            self._customer_repository.add_debt_payment(session, debt_payment)
            session.flush()
            self._customer_service._append_balance_ledger(
                session,
                customer,
                amount_delta=paid_amount * Decimal("-1"),
                event_type="DEBT_PAYMENT",
                ref_type="DEBT_PAYMENT",
                ref_id=debt_payment.id,
                note=debt_payment.note,
                transaction_datetime=invoice.invoice_datetime,
                source_ref_type="INVOICE",
                source_ref_id=invoice.id,
                display_order=20,
            )
        session.flush()
        self._customer_service.recompute_customer_balance(session, customer.id)

    def _normalize_lines(
        self,
        session: Session,
        items: list[InvoiceItemInput] | tuple[InvoiceItemInput, ...],
        *,
        require_active_product: bool,
        allowed_inactive_product_ids: set[int] | None = None,
    ) -> list[NormalizedInvoiceLine]:
        normalized_lines: list[NormalizedInvoiceLine] = []
        allowed_inactive_product_ids = allowed_inactive_product_ids or set()
        for item in items:
            product = self._inventory_repository.get_product_for_update(session, item.product_id)
            if require_active_product and not product.is_active and product.id not in allowed_inactive_product_ids:
                raise ValidationError("Inactive products cannot be used for new invoices.")
            mode = UnitMode(product.unit_mode)
            unit_type = coerce_unit_type(item.unit_type)
            validate_unit_type_for_mode(mode, unit_type)
            quantity = to_quantity(item.quantity)
            if quantity <= Decimal("0"):
                raise ValidationError("Invoice item quantity must be > 0.")
            unit_price, line_total = self._resolve_price_and_total(product, unit_type, quantity, item.unit_price, item.line_total)
            normalized_lines.append(
                NormalizedInvoiceLine(
                    product=product,
                    unit_type=unit_type,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )
        return sorted(normalized_lines, key=lambda line: line.product.id)

    def _resolve_price_and_total(
        self,
        product: Product,
        unit_type: UnitType,
        quantity: Decimal,
        raw_unit_price: Decimal | int | str | None,
        raw_line_total: Decimal | int | str | None,
    ) -> tuple[Decimal, Decimal]:
        unit_price = to_money(raw_unit_price) if raw_unit_price is not None else None
        line_total = to_money(raw_line_total) if raw_line_total is not None else None
        if unit_price is not None and unit_price < Decimal("0"):
            raise ValidationError("unit_price must be >= 0.")
        if line_total is not None and line_total < Decimal("0"):
            raise ValidationError("line_total must be >= 0.")
        if unit_price is None and line_total is not None:
            unit_price = (line_total / quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if unit_price is None:
            unit_price = self._enabled_price(product, unit_type)
        if line_total is None:
            line_total = (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return unit_price, line_total

    def _enabled_price(self, product: Product, unit_type: UnitType) -> Decimal:
        for price in product.prices:
            if price.unit_type == unit_type.value and price.is_enabled:
                return price.price
        raise ValidationError("Enabled product price is required unless a manual price or line total is supplied.")

    @staticmethod
    def _normalize_payment_method(payment_method: PaymentMethod | str | None) -> str | None:
        if payment_method is None:
            return None
        if isinstance(payment_method, PaymentMethod):
            return payment_method.value
        try:
            return PaymentMethod(str(payment_method)).value
        except ValueError as exc:
            raise ValidationError(f"Unsupported payment method: {payment_method}") from exc
