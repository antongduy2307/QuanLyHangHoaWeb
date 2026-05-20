from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice


class ReturnsRepository:
    def add_return_invoice(self, session: Session, return_invoice: ReturnInvoice) -> None:
        session.add(return_invoice)

    def get_return(self, session: Session, return_id: int) -> ReturnInvoice:
        statement = (
            select(ReturnInvoice)
            .options(selectinload(ReturnInvoice.items))
            .where(ReturnInvoice.id == return_id)
        )
        return_invoice = session.scalars(statement).one_or_none()
        if return_invoice is None:
            raise NotFoundError(f"Return invoice {return_id} was not found.")
        return return_invoice

    def get_return_for_update(self, session: Session, return_id: int) -> ReturnInvoice:
        statement = select(ReturnInvoice).where(ReturnInvoice.id == return_id).with_for_update()
        return_invoice = session.scalars(statement).one_or_none()
        if return_invoice is None:
            raise NotFoundError(f"Return invoice {return_id} was not found.")
        self.load_return_items_for_update(session, return_invoice.id)
        return return_invoice

    def list_returns(
        self,
        session: Session,
        *,
        customer_id: int | None = None,
        search: str = "",
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[ReturnInvoice]:
        statement = (
            select(ReturnInvoice)
            .options(selectinload(ReturnInvoice.items))
            .outerjoin(Invoice, ReturnInvoice.source_invoice_id == Invoice.id)
            .order_by(ReturnInvoice.return_datetime.desc(), ReturnInvoice.id.desc())
        )
        if customer_id is not None:
            statement = statement.where(ReturnInvoice.customer_id == customer_id)
        if date_from is not None:
            statement = statement.where(ReturnInvoice.return_datetime >= date_from)
        if date_to is not None:
            statement = statement.where(ReturnInvoice.return_datetime <= date_to)
        needle = search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                or_(
                    ReturnInvoice.return_code.ilike(pattern),
                    ReturnInvoice.customer_snapshot_name.ilike(pattern),
                    Invoice.invoice_code.ilike(pattern),
                )
            )
        return list(session.scalars(statement).all())

    def load_return_items(self, session: Session, return_id: int) -> list[ReturnInvoiceItem]:
        statement = (
            select(ReturnInvoiceItem)
            .where(ReturnInvoiceItem.return_invoice_id == return_id)
            .order_by(ReturnInvoiceItem.id.asc())
        )
        return list(session.scalars(statement).all())

    def load_return_items_for_update(self, session: Session, return_id: int) -> list[ReturnInvoiceItem]:
        statement = (
            select(ReturnInvoiceItem)
            .where(ReturnInvoiceItem.return_invoice_id == return_id)
            .order_by(ReturnInvoiceItem.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def get_returned_quantity_for_source_item(
        self,
        session: Session,
        source_invoice_item_id: int,
        *,
        exclude_return_id: int | None = None,
    ) -> Decimal:
        statement = select(func.coalesce(func.sum(ReturnInvoiceItem.quantity), 0)).where(
            ReturnInvoiceItem.source_invoice_item_id == source_invoice_item_id
        )
        if exclude_return_id is not None:
            statement = statement.where(ReturnInvoiceItem.return_invoice_id != exclude_return_id)
        return Decimal(str(session.scalar(statement) or 0))

    def delete_return(self, session: Session, return_invoice: ReturnInvoice) -> None:
        session.delete(return_invoice)
