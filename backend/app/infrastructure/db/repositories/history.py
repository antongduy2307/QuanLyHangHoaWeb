from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Select, exists, or_, select
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import Product, StockAdjustment
from app.infrastructure.db.models.orders import OrderRequest, OrderRequestItem
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice, InvoiceItem


@dataclass(frozen=True, slots=True)
class HistoryFilters:
    date_from: datetime | None = None
    date_to: datetime | None = None
    event_type: str | None = None
    customer_id: int | None = None
    product_id: int | None = None
    search: str = ""


class HistoryRepository:
    def list_invoices(self, session: Session, filters: HistoryFilters) -> list[Invoice]:
        statement = select(Invoice).options(selectinload(Invoice.items))
        statement = self._apply_invoice_filters(statement, filters)
        statement = statement.order_by(Invoice.invoice_datetime.desc(), Invoice.id.desc())
        return list(session.scalars(statement).all())

    def list_returns(self, session: Session, filters: HistoryFilters) -> list[ReturnInvoice]:
        statement = select(ReturnInvoice).options(selectinload(ReturnInvoice.items))
        statement = self._apply_return_filters(statement, filters)
        statement = statement.order_by(ReturnInvoice.return_datetime.desc(), ReturnInvoice.id.desc())
        return list(session.scalars(statement).all())

    def list_standalone_debt_payments(self, session: Session, filters: HistoryFilters) -> list[DebtPayment]:
        invoice_link_exists = exists(
            select(CustomerBalanceLedger.id).where(
                CustomerBalanceLedger.ref_type == "DEBT_PAYMENT",
                CustomerBalanceLedger.ref_id == DebtPayment.id,
                CustomerBalanceLedger.source_ref_type == "INVOICE",
            )
        )
        statement = (
            select(DebtPayment)
            .join(Customer, Customer.id == DebtPayment.customer_id)
            .where(DebtPayment.is_deleted.is_(False))
            .where(~invoice_link_exists)
        )
        if filters.customer_id is not None:
            statement = statement.where(DebtPayment.customer_id == filters.customer_id)
        if filters.date_from is not None:
            statement = statement.where(DebtPayment.payment_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(DebtPayment.payment_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    Customer.customer_name.ilike(pattern),
                    DebtPayment.note.ilike(pattern),
                )
            )
        statement = statement.order_by(DebtPayment.payment_datetime.desc(), DebtPayment.id.desc())
        return list(session.scalars(statement).all())

    def list_balance_adjustments(self, session: Session, filters: HistoryFilters) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .join(Customer, Customer.id == CustomerBalanceLedger.customer_id)
            .where(CustomerBalanceLedger.event_type == "BALANCE_ADJUSTMENT")
        )
        if filters.customer_id is not None:
            statement = statement.where(CustomerBalanceLedger.customer_id == filters.customer_id)
        if filters.date_from is not None:
            statement = statement.where(CustomerBalanceLedger.transaction_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(CustomerBalanceLedger.transaction_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    Customer.customer_name.ilike(pattern),
                    CustomerBalanceLedger.note.ilike(pattern),
                )
            )
        statement = statement.order_by(
            CustomerBalanceLedger.transaction_datetime.desc(),
            CustomerBalanceLedger.display_order.desc(),
            CustomerBalanceLedger.id.desc(),
        )
        return list(session.scalars(statement).all())

    def list_stock_adjustments(self, session: Session, filters: HistoryFilters) -> list[StockAdjustment]:
        statement = select(StockAdjustment).join(Product, Product.id == StockAdjustment.product_id)
        if filters.product_id is not None:
            statement = statement.where(StockAdjustment.product_id == filters.product_id)
        if filters.date_from is not None:
            statement = statement.where(StockAdjustment.adjustment_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(StockAdjustment.adjustment_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    Product.product_code_base.ilike(pattern),
                    Product.product_name.ilike(pattern),
                    StockAdjustment.note.ilike(pattern),
                    StockAdjustment.movement_type.ilike(pattern),
                )
            )
        statement = statement.order_by(StockAdjustment.adjustment_datetime.desc(), StockAdjustment.id.desc())
        return list(session.scalars(statement).all())

    def list_sale_stock_effects(self, session: Session, filters: HistoryFilters) -> list[InvoiceItem]:
        statement = select(InvoiceItem).join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        if filters.customer_id is not None:
            statement = statement.where(Invoice.customer_id == filters.customer_id)
        if filters.product_id is not None:
            statement = statement.where(InvoiceItem.product_id == filters.product_id)
        if filters.date_from is not None:
            statement = statement.where(Invoice.invoice_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(Invoice.invoice_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    Invoice.invoice_code.ilike(pattern),
                    Invoice.customer_snapshot_name.ilike(pattern),
                    InvoiceItem.product_code_snapshot.ilike(pattern),
                    InvoiceItem.product_name_snapshot.ilike(pattern),
                    Invoice.note.ilike(pattern),
                )
            )
        statement = statement.order_by(Invoice.invoice_datetime.desc(), InvoiceItem.id.desc())
        return list(session.scalars(statement).all())

    def list_return_stock_effects(self, session: Session, filters: HistoryFilters) -> list[ReturnInvoiceItem]:
        statement = select(ReturnInvoiceItem).join(ReturnInvoice, ReturnInvoice.id == ReturnInvoiceItem.return_invoice_id)
        if filters.customer_id is not None:
            statement = statement.where(ReturnInvoice.customer_id == filters.customer_id)
        if filters.product_id is not None:
            statement = statement.where(ReturnInvoiceItem.product_id == filters.product_id)
        if filters.date_from is not None:
            statement = statement.where(ReturnInvoice.return_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(ReturnInvoice.return_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    ReturnInvoice.return_code.ilike(pattern),
                    ReturnInvoice.customer_snapshot_name.ilike(pattern),
                    ReturnInvoiceItem.product_code_snapshot.ilike(pattern),
                    ReturnInvoiceItem.product_name_snapshot.ilike(pattern),
                    ReturnInvoice.note.ilike(pattern),
                )
            )
        statement = statement.order_by(ReturnInvoice.return_datetime.desc(), ReturnInvoiceItem.id.desc())
        return list(session.scalars(statement).all())

    def list_orders(self, session: Session, filters: HistoryFilters) -> list[OrderRequest]:
        statement = select(OrderRequest).options(selectinload(OrderRequest.items))
        if filters.customer_id is not None:
            statement = statement.where(OrderRequest.customer_id == filters.customer_id)
        if filters.product_id is not None:
            statement = statement.where(
                exists(
                    select(OrderRequestItem.id).where(
                        OrderRequestItem.order_request_id == OrderRequest.id,
                        OrderRequestItem.product_id == filters.product_id,
                    )
                )
            )
        if filters.date_from is not None:
            statement = statement.where(OrderRequest.order_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(OrderRequest.order_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    OrderRequest.order_code.ilike(pattern),
                    OrderRequest.customer_name_snapshot.ilike(pattern),
                    OrderRequest.note.ilike(pattern),
                    exists(
                        select(OrderRequestItem.id).where(
                            OrderRequestItem.order_request_id == OrderRequest.id,
                            OrderRequestItem.product_name_snapshot.ilike(pattern),
                        )
                    ),
                )
            )
        statement = statement.order_by(OrderRequest.order_datetime.desc(), OrderRequest.id.desc())
        return list(session.scalars(statement).all())

    @staticmethod
    def _apply_invoice_filters(statement: Select[tuple[Invoice]], filters: HistoryFilters) -> Select[tuple[Invoice]]:
        if filters.customer_id is not None:
            statement = statement.where(Invoice.customer_id == filters.customer_id)
        if filters.product_id is not None:
            statement = statement.where(
                exists(
                    select(InvoiceItem.id).where(
                        InvoiceItem.invoice_id == Invoice.id,
                        InvoiceItem.product_id == filters.product_id,
                    )
                )
            )
        if filters.date_from is not None:
            statement = statement.where(Invoice.invoice_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(Invoice.invoice_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    Invoice.invoice_code.ilike(pattern),
                    Invoice.customer_snapshot_name.ilike(pattern),
                    Invoice.note.ilike(pattern),
                    exists(
                        select(InvoiceItem.id).where(
                            InvoiceItem.invoice_id == Invoice.id,
                            or_(
                                InvoiceItem.product_code_snapshot.ilike(pattern),
                                InvoiceItem.product_name_snapshot.ilike(pattern),
                            ),
                        )
                    ),
                )
            )
        return statement

    @staticmethod
    def _apply_return_filters(statement: Select[tuple[ReturnInvoice]], filters: HistoryFilters) -> Select[tuple[ReturnInvoice]]:
        if filters.customer_id is not None:
            statement = statement.where(ReturnInvoice.customer_id == filters.customer_id)
        if filters.product_id is not None:
            statement = statement.where(
                exists(
                    select(ReturnInvoiceItem.id).where(
                        ReturnInvoiceItem.return_invoice_id == ReturnInvoice.id,
                        ReturnInvoiceItem.product_id == filters.product_id,
                    )
                )
            )
        if filters.date_from is not None:
            statement = statement.where(ReturnInvoice.return_datetime >= filters.date_from)
        if filters.date_to is not None:
            statement = statement.where(ReturnInvoice.return_datetime <= filters.date_to)
        needle = filters.search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    ReturnInvoice.return_code.ilike(pattern),
                    ReturnInvoice.customer_snapshot_name.ilike(pattern),
                    ReturnInvoice.note.ilike(pattern),
                    exists(
                        select(ReturnInvoiceItem.id).where(
                            ReturnInvoiceItem.return_invoice_id == ReturnInvoice.id,
                            or_(
                                ReturnInvoiceItem.product_code_snapshot.ilike(pattern),
                                ReturnInvoiceItem.product_name_snapshot.ilike(pattern),
                            ),
                        )
                    ),
                    exists(
                        select(Invoice.id).where(
                            Invoice.id == ReturnInvoice.source_invoice_id,
                            Invoice.invoice_code.ilike(pattern),
                        )
                    ),
                )
            )
        return statement
