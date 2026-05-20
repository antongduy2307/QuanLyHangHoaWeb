from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.sales import Invoice, InvoiceItem


class SalesRepository:
    def add_invoice(self, session: Session, invoice: Invoice) -> None:
        session.add(invoice)

    def get_invoice(self, session: Session, invoice_id: int) -> Invoice:
        statement = (
            select(Invoice)
            .options(selectinload(Invoice.items))
            .where(Invoice.id == invoice_id)
        )
        invoice = session.scalars(statement).one_or_none()
        if invoice is None:
            raise NotFoundError(f"Invoice {invoice_id} was not found.")
        return invoice

    def get_invoice_for_update(self, session: Session, invoice_id: int) -> Invoice:
        statement = select(Invoice).where(Invoice.id == invoice_id).with_for_update()
        invoice = session.scalars(statement).one_or_none()
        if invoice is None:
            raise NotFoundError(f"Invoice {invoice_id} was not found.")
        self.load_invoice_items_for_update(session, invoice.id)
        return invoice

    def list_invoices(
        self,
        session: Session,
        *,
        customer_id: int | None = None,
        search: str = "",
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[Invoice]:
        statement = (
            select(Invoice)
            .options(selectinload(Invoice.items))
            .order_by(Invoice.invoice_datetime.desc(), Invoice.id.desc())
        )
        if customer_id is not None:
            statement = statement.where(Invoice.customer_id == customer_id)
        if date_from is not None:
            statement = statement.where(Invoice.invoice_datetime >= date_from)
        if date_to is not None:
            statement = statement.where(Invoice.invoice_datetime <= date_to)
        needle = search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(
                Invoice.invoice_code.ilike(pattern) | Invoice.customer_snapshot_name.ilike(pattern)
            )
        return list(session.scalars(statement).all())

    def load_invoice_items(self, session: Session, invoice_id: int) -> list[InvoiceItem]:
        statement = select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id).order_by(InvoiceItem.id.asc())
        return list(session.scalars(statement).all())

    def load_invoice_items_for_update(self, session: Session, invoice_id: int) -> list[InvoiceItem]:
        statement = (
            select(InvoiceItem)
            .where(InvoiceItem.invoice_id == invoice_id)
            .order_by(InvoiceItem.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def delete_invoice(self, session: Session, invoice: Invoice) -> None:
        session.delete(invoice)
