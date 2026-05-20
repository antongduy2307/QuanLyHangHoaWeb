from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.application.customer_service import CustomerService
from app.application.document_service import DocumentService
from app.application.inventory_service import InventoryService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.domain.inventory import coerce_unit_type, validate_unit_type_for_mode
from app.domain.money import to_money
from app.domain.quantity import to_quantity
from app.domain.returns import ReturnHandlingMode
from app.infrastructure.db.models.customer import Customer
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import InvoiceItem
from app.infrastructure.db.repositories.customer import CustomerRepository
from app.infrastructure.db.repositories.inventory import InventoryRepository
from app.infrastructure.db.repositories.returns import ReturnsRepository
from app.infrastructure.db.repositories.sales import SalesRepository
from app.schemas.returns import ReturnItemInput


@dataclass(frozen=True, slots=True)
class NormalizedReturnLine:
    product: Product
    unit_type: UnitType
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    source_invoice_item_id: int | None = None


class ReturnService:
    RETURN_DISPLAY_ORDER = 0

    def __init__(
        self,
        repository: ReturnsRepository | None = None,
        sales_repository: SalesRepository | None = None,
        inventory_service: InventoryService | None = None,
        customer_service: CustomerService | None = None,
        document_service: DocumentService | None = None,
        inventory_repository: InventoryRepository | None = None,
        customer_repository: CustomerRepository | None = None,
    ) -> None:
        self._repository = repository or ReturnsRepository()
        self._sales_repository = sales_repository or SalesRepository()
        self._inventory_service = inventory_service or InventoryService()
        self._customer_service = customer_service or CustomerService()
        self._document_service = document_service or DocumentService()
        self._inventory_repository = inventory_repository or InventoryRepository()
        self._customer_repository = customer_repository or CustomerRepository()

    def create_return(
        self,
        session: Session,
        *,
        source_invoice_id: int | None,
        customer_id: int | None,
        customer_snapshot_name: str | None,
        return_datetime: datetime,
        handling_mode: ReturnHandlingMode | str,
        items: list[ReturnItemInput] | tuple[ReturnItemInput, ...],
        note: str | None = None,
        return_code: str | None = None,
    ) -> ReturnInvoice:
        if not items:
            raise ValidationError("Return must contain at least one item.")
        normalized_mode = self._coerce_handling_mode(handling_mode)
        source_invoice = None
        customer: Customer | None = None
        if source_invoice_id is not None:
            source_invoice = self._sales_repository.get_invoice_for_update(session, source_invoice_id)
            customer_id = source_invoice.customer_id
            customer_snapshot = source_invoice.customer_snapshot_name
        else:
            customer_snapshot = (customer_snapshot_name or "Khach le").strip()
        if customer_id is not None:
            customer = self._customer_repository.get_customer_for_update(session, customer_id)
            if not customer_snapshot:
                customer_snapshot = customer.customer_name
        if not customer_snapshot:
            raise ValidationError("customer_snapshot_name is required.")
        if customer is None and normalized_mode != ReturnHandlingMode.REFUND_NOW:
            raise ValidationError("Walk-in returns only support REFUND_NOW.")

        normalized_lines = (
            self._normalize_linked_lines(session, source_invoice_id, items)
            if source_invoice is not None
            else self._normalize_quick_lines(session, items)
        )
        total_amount = sum((line.line_total for line in normalized_lines), start=Decimal("0"))
        return_invoice = ReturnInvoice(
            return_code=return_code or self._document_service.next_return_code(session, return_datetime),
            source_invoice_id=source_invoice_id,
            customer_id=customer.id if customer is not None else None,
            customer_snapshot_name=customer_snapshot,
            is_quick_return=source_invoice is None,
            return_datetime=return_datetime,
            total_amount=total_amount,
            handling_mode=normalized_mode.value,
            note=(note or "").strip() or None,
        )
        self._repository.add_return_invoice(session, return_invoice)
        session.flush()

        for line in normalized_lines:
            self._inventory_service.increase_stock(session, line.product.id, line.quantity, line.unit_type, record_adjustment=False)
            return_invoice.items.append(
                ReturnInvoiceItem(
                    return_invoice_id=return_invoice.id,
                    source_invoice_item_id=line.source_invoice_item_id,
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
            customer.total_sales -= total_amount
            if customer.total_sales < Decimal("0"):
                raise ValidationError("total_sales cannot become negative.")
            ledger_delta = self._return_ledger_delta(customer.current_balance, total_amount, normalized_mode)
            if ledger_delta != Decimal("0"):
                self._customer_service._append_balance_ledger(
                    session,
                    customer,
                    amount_delta=ledger_delta,
                    event_type=(
                        "RETURN_STORE_CREDIT"
                        if normalized_mode == ReturnHandlingMode.STORE_CREDIT
                        else "RETURN_REFUND_NOW"
                    ),
                    ref_type="RETURN",
                    ref_id=return_invoice.id,
                    note=f"Return {return_invoice.return_code}",
                    transaction_datetime=return_invoice.return_datetime,
                    source_ref_type="RETURN",
                    source_ref_id=return_invoice.id,
                    display_order=self.RETURN_DISPLAY_ORDER,
                )
            session.flush()
            self._customer_service.recompute_customer_balance(session, customer.id)

        session.flush()
        return return_invoice

    def get_return(self, session: Session, return_id: int) -> ReturnInvoice:
        return self._repository.get_return(session, return_id)

    def list_returns(
        self,
        session: Session,
        *,
        customer_id: int | None = None,
        search: str = "",
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[ReturnInvoice]:
        return self._repository.list_returns(
            session,
            customer_id=customer_id,
            search=search,
            date_from=date_from,
            date_to=date_to,
        )

    def delete_return(self, session: Session, return_id: int) -> None:
        return_invoice = self._repository.get_return_for_update(session, return_id)
        items = self._repository.load_return_items_for_update(session, return_invoice.id)
        self._rollback_return_effects(session, return_invoice, items)
        self._repository.delete_return(session, return_invoice)
        session.flush()

    def update_return(
        self,
        session: Session,
        return_id: int,
        *,
        source_invoice_id: int | None,
        customer_id: int | None,
        customer_snapshot_name: str | None,
        return_datetime: datetime,
        handling_mode: ReturnHandlingMode | str,
        items: list[ReturnItemInput] | tuple[ReturnItemInput, ...],
        note: str | None = None,
    ) -> ReturnInvoice:
        return_invoice = self._repository.get_return_for_update(session, return_id)
        old_items = self._repository.load_return_items_for_update(session, return_invoice.id)
        if not items:
            raise ValidationError("Return must contain at least one item.")
        normalized_mode = self._coerce_handling_mode(handling_mode)

        source_invoice = None
        customer: Customer | None = None
        if source_invoice_id is not None:
            source_invoice = self._sales_repository.get_invoice_for_update(session, source_invoice_id)
            customer_id = source_invoice.customer_id
            customer_snapshot = source_invoice.customer_snapshot_name
        else:
            customer_snapshot = (customer_snapshot_name or "Khach le").strip()
        if customer_id is not None:
            customer = self._customer_repository.get_customer_for_update(session, customer_id)
            if not customer_snapshot:
                customer_snapshot = customer.customer_name
        if not customer_snapshot:
            raise ValidationError("customer_snapshot_name is required.")
        if customer is None and normalized_mode != ReturnHandlingMode.REFUND_NOW:
            raise ValidationError("Walk-in returns only support REFUND_NOW.")

        normalized_lines = (
            self._normalize_linked_lines(session, source_invoice_id, items, exclude_return_id=return_invoice.id)
            if source_invoice is not None
            else self._normalize_quick_lines(
                session,
                items,
                allowed_inactive_product_ids={item.product_id for item in old_items},
            )
        )
        total_amount = sum((line.line_total for line in normalized_lines), start=Decimal("0"))

        self._rollback_return_effects(session, return_invoice, old_items)
        for item in old_items:
            session.delete(item)
        session.flush()

        return_invoice.source_invoice_id = source_invoice_id
        return_invoice.customer_id = customer.id if customer is not None else None
        return_invoice.customer_snapshot_name = customer_snapshot
        return_invoice.is_quick_return = source_invoice is None
        return_invoice.return_datetime = return_datetime
        return_invoice.total_amount = total_amount
        return_invoice.handling_mode = normalized_mode.value
        return_invoice.note = (note or "").strip() or None
        return_invoice.items.clear()
        session.flush()

        for line in normalized_lines:
            self._inventory_service.increase_stock(session, line.product.id, line.quantity, line.unit_type, record_adjustment=False)
            return_invoice.items.append(
                ReturnInvoiceItem(
                    return_invoice_id=return_invoice.id,
                    source_invoice_item_id=line.source_invoice_item_id,
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
            self._apply_customer_return_effects(session, customer, return_invoice, total_amount, normalized_mode)
        session.flush()
        return return_invoice

    def _rollback_return_effects(
        self,
        session: Session,
        return_invoice: ReturnInvoice,
        items: list[ReturnInvoiceItem],
    ) -> None:
        for item in sorted(items, key=lambda row: row.product_id):
            self._inventory_service.decrease_stock(session, item.product_id, item.quantity, item.unit_type, record_adjustment=False)

        if return_invoice.customer_id is not None:
            customer = self._customer_repository.get_customer_for_update(session, return_invoice.customer_id)
            customer.total_sales += return_invoice.total_amount
            ledgers = self._customer_repository.list_ledgers_by_source_for_update(
                session,
                customer.id,
                "RETURN",
                return_invoice.id,
            )
            for ledger in ledgers:
                session.delete(ledger)
            session.flush()
            self._customer_service.recompute_customer_balance(session, customer.id)

    def _apply_customer_return_effects(
        self,
        session: Session,
        customer: Customer,
        return_invoice: ReturnInvoice,
        total_amount: Decimal,
        handling_mode: ReturnHandlingMode,
    ) -> None:
        customer.total_sales -= total_amount
        if customer.total_sales < Decimal("0"):
            raise ValidationError("total_sales cannot become negative.")
        ledger_delta = self._return_ledger_delta(customer.current_balance, total_amount, handling_mode)
        if ledger_delta != Decimal("0"):
            self._customer_service._append_balance_ledger(
                session,
                customer,
                amount_delta=ledger_delta,
                event_type=(
                    "RETURN_STORE_CREDIT"
                    if handling_mode == ReturnHandlingMode.STORE_CREDIT
                    else "RETURN_REFUND_NOW"
                ),
                ref_type="RETURN",
                ref_id=return_invoice.id,
                note=f"Return {return_invoice.return_code}",
                transaction_datetime=return_invoice.return_datetime,
                source_ref_type="RETURN",
                source_ref_id=return_invoice.id,
                display_order=self.RETURN_DISPLAY_ORDER,
            )
        session.flush()
        self._customer_service.recompute_customer_balance(session, customer.id)

    def _normalize_quick_lines(
        self,
        session: Session,
        items: list[ReturnItemInput] | tuple[ReturnItemInput, ...],
        *,
        allowed_inactive_product_ids: set[int] | None = None,
    ) -> list[NormalizedReturnLine]:
        lines: list[NormalizedReturnLine] = []
        allowed_inactive_product_ids = allowed_inactive_product_ids or set()
        for item in items:
            if item.product_id is None:
                raise ValidationError("product_id is required for quick returns.")
            product = self._inventory_repository.get_product_for_update(session, item.product_id)
            if not product.is_active and product.id not in allowed_inactive_product_ids:
                raise ValidationError("Inactive products cannot be used for quick returns.")
            unit_type = coerce_unit_type(item.unit_type)
            validate_unit_type_for_mode(UnitMode(product.unit_mode), unit_type)
            quantity = self._positive_quantity(item.quantity)
            unit_price, line_total = self._resolve_price_and_total(product, unit_type, quantity, item.unit_price, item.line_total)
            lines.append(NormalizedReturnLine(product, unit_type, quantity, unit_price, line_total))
        return sorted(lines, key=lambda line: line.product.id)

    def _normalize_linked_lines(
        self,
        session: Session,
        source_invoice_id: int,
        items: list[ReturnItemInput] | tuple[ReturnItemInput, ...],
        *,
        exclude_return_id: int | None = None,
    ) -> list[NormalizedReturnLine]:
        source_items = {
            item.id: item
            for item in self._sales_repository.load_invoice_items_for_update(session, source_invoice_id)
        }
        lines: list[NormalizedReturnLine] = []
        for item in items:
            if item.source_invoice_item_id is None:
                raise ValidationError("source_invoice_item_id is required for linked returns.")
            source_item = source_items.get(item.source_invoice_item_id)
            if source_item is None:
                raise ValidationError("Source invoice item does not belong to the source invoice.")
            quantity = self._positive_quantity(item.quantity)
            already_returned = self._repository.get_returned_quantity_for_source_item(
                session,
                source_item.id,
                exclude_return_id=exclude_return_id,
            )
            if already_returned + quantity > source_item.quantity:
                raise ValidationError("Returned quantity cannot exceed remaining source invoice quantity.")
            product = self._inventory_repository.get_product_for_update(session, source_item.product_id)
            unit_type = coerce_unit_type(item.unit_type)
            if unit_type.value != source_item.unit_type:
                raise ValidationError("Linked return unit type must match the source invoice item.")
            unit_price = source_item.unit_price
            line_total = (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            lines.append(
                NormalizedReturnLine(
                    product=product,
                    unit_type=unit_type,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                    source_invoice_item_id=source_item.id,
                )
            )
        return sorted(lines, key=lambda line: line.product.id)

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
    def _positive_quantity(value: Decimal | int | str) -> Decimal:
        quantity = to_quantity(value)
        if quantity <= Decimal("0"):
            raise ValidationError("Return item quantity must be > 0.")
        return quantity

    @staticmethod
    def _coerce_handling_mode(value: ReturnHandlingMode | str) -> ReturnHandlingMode:
        if isinstance(value, ReturnHandlingMode):
            return value
        try:
            return ReturnHandlingMode(str(value))
        except ValueError as exc:
            raise ValidationError(f"Unsupported return handling mode: {value}") from exc

    @staticmethod
    def _return_ledger_delta(
        current_balance: Decimal,
        total_amount: Decimal,
        handling_mode: ReturnHandlingMode,
    ) -> Decimal:
        if handling_mode == ReturnHandlingMode.STORE_CREDIT:
            return total_amount * Decimal("-1")
        positive_balance = max(current_balance, Decimal("0"))
        return min(positive_balance, total_amount) * Decimal("-1")
