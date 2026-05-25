from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.infrastructure.db.models.customer import CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import Product, StockAdjustment
from app.infrastructure.db.models.orders import OrderRequest, OrderRequestItem
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice, InvoiceItem
from app.infrastructure.db.repositories.history import HistoryFilters, HistoryRepository
from app.schemas.history import HistoryOpenTarget


@dataclass(frozen=True, slots=True)
class HistoryEvent:
    event_type: str
    event_id: int
    event_datetime: datetime | None
    display_order: int
    code: str | None
    customer_id: int | None
    customer_name: str | None
    product_id: int | None
    product_name: str | None
    amount: Decimal | None
    paid_amount: Decimal | None
    item_count: int | None
    quantity: Decimal | None
    unit_type: str | None
    status: str | None
    source_type: str | None
    source_id: int | None
    note: str | None
    open_target: HistoryOpenTarget | None = None


@dataclass(frozen=True, slots=True)
class HistoryPage:
    page: int
    page_size: int
    total: int
    items: list[HistoryEvent]


class HistoryService:
    def __init__(self, repository: HistoryRepository | None = None) -> None:
        self._repository = repository or HistoryRepository()

    def list_history(
        self,
        session: Session,
        *,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        event_type: str | None = None,
        customer_id: int | None = None,
        product_id: int | None = None,
        search: str = "",
        page: int = 1,
        page_size: int = 50,
    ) -> HistoryPage:
        filters = HistoryFilters(
            date_from=date_from,
            date_to=date_to,
            event_type=event_type,
            customer_id=customer_id,
            product_id=product_id,
            search=search,
        )
        events: list[HistoryEvent] = []
        requested_type = (event_type or "").strip().upper()

        if self._includes(requested_type, "SALES_INVOICE"):
            events.extend(self._invoice_event(invoice, product_id) for invoice in self._repository.list_invoices(session, filters))
        if self._includes(requested_type, "RETURN_INVOICE"):
            events.extend(self._return_event(return_invoice, product_id) for return_invoice in self._repository.list_returns(session, filters))
        if self._includes(requested_type, "DEBT_PAYMENT"):
            if product_id is None:
                events.extend(
                    self._debt_payment_event(payment) for payment in self._repository.list_standalone_debt_payments(session, filters)
                )
        if self._includes(requested_type, "BALANCE_ADJUSTMENT"):
            if product_id is None:
                events.extend(
                    self._balance_adjustment_event(ledger) for ledger in self._repository.list_balance_adjustments(session, filters)
                )
        if self._includes(requested_type, "STOCK_MOVEMENT"):
            if customer_id is None:
                events.extend(
                    self._stock_adjustment_event(adjustment) for adjustment in self._repository.list_stock_adjustments(session, filters)
                )
            if requested_type == "STOCK_MOVEMENT":
                events.extend(self._sale_stock_effect_event(item) for item in self._repository.list_sale_stock_effects(session, filters))
                events.extend(self._return_stock_effect_event(item) for item in self._repository.list_return_stock_effects(session, filters))
        if self._includes(requested_type, "ORDER"):
            events.extend(self._order_event(order, product_id) for order in self._repository.list_orders(session, filters))

        sorted_events = sorted(
            events,
            key=lambda event: (
                self._normalized_datetime(event.event_datetime),
                event.display_order,
                event.event_id,
            ),
            reverse=True,
        )
        normalized_page = max(page, 1)
        normalized_page_size = min(max(page_size, 1), 200)
        start_index = (normalized_page - 1) * normalized_page_size
        end_index = start_index + normalized_page_size
        return HistoryPage(
            page=normalized_page,
            page_size=normalized_page_size,
            total=len(sorted_events),
            items=sorted_events[start_index:end_index],
        )

    @staticmethod
    def _includes(requested_type: str, current_type: str) -> bool:
        return not requested_type or requested_type == current_type

    @staticmethod
    def _normalized_datetime(value: datetime | None) -> datetime:
        if value is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def _invoice_event(self, invoice: Invoice, product_id: int | None) -> HistoryEvent:
        item = self._pick_invoice_item(invoice.items, product_id)
        return HistoryEvent(
            event_type="SALES_INVOICE",
            event_id=invoice.id,
            event_datetime=invoice.invoice_datetime,
            display_order=0,
            code=invoice.invoice_code,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_snapshot_name,
            product_id=item.product_id if item is not None else None,
            product_name=item.product_name_snapshot if item is not None else None,
            amount=invoice.total_amount,
            paid_amount=invoice.paid_amount,
            item_count=len(invoice.items),
            quantity=item.quantity if item is not None else None,
            unit_type=item.unit_type if item is not None else None,
            status=invoice.status,
            source_type="invoice",
            source_id=invoice.id,
            note=invoice.note,
            open_target=HistoryOpenTarget(target_type="invoice", target_id=invoice.id, route=f"/sales/invoices/{invoice.id}"),
        )

    def _return_event(self, return_invoice: ReturnInvoice, product_id: int | None) -> HistoryEvent:
        item = self._pick_return_item(return_invoice.items, product_id)
        return HistoryEvent(
            event_type="RETURN_INVOICE",
            event_id=return_invoice.id,
            event_datetime=return_invoice.return_datetime,
            display_order=0,
            code=return_invoice.return_code,
            customer_id=return_invoice.customer_id,
            customer_name=return_invoice.customer_snapshot_name,
            product_id=item.product_id if item is not None else None,
            product_name=item.product_name_snapshot if item is not None else None,
            amount=return_invoice.total_amount,
            paid_amount=None,
            item_count=len(return_invoice.items),
            quantity=item.quantity if item is not None else None,
            unit_type=item.unit_type if item is not None else None,
            status=return_invoice.handling_mode,
            source_type="return",
            source_id=return_invoice.id,
            note=return_invoice.note,
            open_target=HistoryOpenTarget(target_type="return", target_id=return_invoice.id, route=f"/returns/{return_invoice.id}"),
        )

    @staticmethod
    def _debt_payment_event(payment: DebtPayment) -> HistoryEvent:
        return HistoryEvent(
            event_type="DEBT_PAYMENT",
            event_id=payment.id,
            event_datetime=payment.payment_datetime,
            display_order=30,
            code=None,
            customer_id=payment.customer_id,
            customer_name=payment.customer.customer_name if payment.customer is not None else None,
            product_id=None,
            product_name=None,
            amount=payment.amount,
            paid_amount=None,
            item_count=None,
            quantity=None,
            unit_type=None,
            status=None,
            source_type="debt_payment",
            source_id=payment.id,
            note=payment.note,
            open_target=HistoryOpenTarget(target_type="customer", target_id=payment.customer_id, route=f"/customers/{payment.customer_id}"),
        )

    @staticmethod
    def _balance_adjustment_event(ledger: CustomerBalanceLedger) -> HistoryEvent:
        return HistoryEvent(
            event_type="BALANCE_ADJUSTMENT",
            event_id=ledger.id,
            event_datetime=ledger.transaction_datetime,
            display_order=ledger.display_order,
            code=None,
            customer_id=ledger.customer_id,
            customer_name=ledger.customer.customer_name if ledger.customer is not None else None,
            product_id=None,
            product_name=None,
            amount=ledger.amount_delta,
            paid_amount=None,
            item_count=None,
            quantity=None,
            unit_type=None,
            status=ledger.event_type,
            source_type="balance_adjustment",
            source_id=ledger.ref_id,
            note=ledger.note,
            open_target=HistoryOpenTarget(target_type="customer", target_id=ledger.customer_id, route=f"/customers/{ledger.customer_id}"),
        )

    @staticmethod
    def _stock_adjustment_event(adjustment: StockAdjustment) -> HistoryEvent:
        return HistoryEvent(
            event_type="STOCK_MOVEMENT",
            event_id=adjustment.id,
            event_datetime=adjustment.adjustment_datetime,
            display_order=0,
            code=None,
            customer_id=None,
            customer_name=None,
            product_id=adjustment.product_id,
            product_name=adjustment.product.product_name if adjustment.product is not None else None,
            amount=None,
            paid_amount=None,
            item_count=None,
            quantity=adjustment.quantity_delta,
            unit_type=adjustment.unit_type,
            status=adjustment.movement_type,
            source_type="stock_adjustment",
            source_id=adjustment.id,
            note=adjustment.note,
            open_target=HistoryOpenTarget(target_type="product", target_id=adjustment.product_id, route=f"/inventory/products/{adjustment.product_id}"),
        )

    @staticmethod
    def _sale_stock_effect_event(item: InvoiceItem) -> HistoryEvent:
        invoice = item.invoice
        return HistoryEvent(
            event_type="STOCK_MOVEMENT",
            event_id=item.id,
            event_datetime=invoice.invoice_datetime,
            display_order=0,
            code=invoice.invoice_code,
            customer_id=invoice.customer_id,
            customer_name=invoice.customer_snapshot_name,
            product_id=item.product_id,
            product_name=item.product_name_snapshot,
            amount=item.line_total,
            paid_amount=None,
            item_count=None,
            quantity=item.quantity * Decimal("-1"),
            unit_type=item.unit_type,
            status="SALE",
            source_type="invoice",
            source_id=invoice.id,
            note=invoice.note,
            open_target=HistoryOpenTarget(target_type="invoice", target_id=invoice.id, route=f"/sales/invoices/{invoice.id}"),
        )

    @staticmethod
    def _return_stock_effect_event(item: ReturnInvoiceItem) -> HistoryEvent:
        return_invoice = item.return_invoice
        return HistoryEvent(
            event_type="STOCK_MOVEMENT",
            event_id=item.id,
            event_datetime=return_invoice.return_datetime,
            display_order=0,
            code=return_invoice.return_code,
            customer_id=return_invoice.customer_id,
            customer_name=return_invoice.customer_snapshot_name,
            product_id=item.product_id,
            product_name=item.product_name_snapshot,
            amount=item.line_total,
            paid_amount=None,
            item_count=None,
            quantity=item.quantity,
            unit_type=item.unit_type,
            status="RETURN",
            source_type="return",
            source_id=return_invoice.id,
            note=return_invoice.note,
            open_target=HistoryOpenTarget(target_type="return", target_id=return_invoice.id, route=f"/returns/{return_invoice.id}"),
        )

    def _order_event(self, order: OrderRequest, product_id: int | None) -> HistoryEvent:
        item = self._pick_order_item(order.items, product_id)
        return HistoryEvent(
            event_type="ORDER",
            event_id=order.id,
            event_datetime=order.order_datetime,
            display_order=0,
            code=order.order_code,
            customer_id=order.customer_id,
            customer_name=order.customer_name_snapshot,
            product_id=item.product_id if item is not None else None,
            product_name=item.product_name_snapshot if item is not None else None,
            amount=None,
            paid_amount=None,
            item_count=len(order.items),
            quantity=item.quantity if item is not None else None,
            unit_type=item.unit_type if item is not None else None,
            status=order.status,
            source_type="order",
            source_id=order.id,
            note=order.note,
            open_target=HistoryOpenTarget(target_type="order", target_id=order.id, route=f"/orders/{order.id}"),
        )

    @staticmethod
    def _pick_invoice_item(items: list[InvoiceItem], product_id: int | None) -> InvoiceItem | None:
        if product_id is not None:
            return next((item for item in items if item.product_id == product_id), None)
        return items[0] if len(items) == 1 else None

    @staticmethod
    def _pick_return_item(items: list[ReturnInvoiceItem], product_id: int | None) -> ReturnInvoiceItem | None:
        if product_id is not None:
            return next((item for item in items if item.product_id == product_id), None)
        return items[0] if len(items) == 1 else None

    @staticmethod
    def _pick_order_item(items: list[OrderRequestItem], product_id: int | None) -> OrderRequestItem | None:
        if product_id is not None:
            return next((item for item in items if item.product_id == product_id), None)
        return items[0] if len(items) == 1 else None
