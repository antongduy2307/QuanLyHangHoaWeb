from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.documents import DocumentType
from app.infrastructure.db.models.documents import DocumentCounter
from app.infrastructure.db.models.returns import ReturnInvoice
from app.infrastructure.db.models.sales import Invoice


class DocumentRepository:
    def get_counter_for_update(
        self,
        session: Session,
        *,
        document_type: str,
        business_date: date,
    ) -> DocumentCounter | None:
        statement = (
            select(DocumentCounter)
            .where(DocumentCounter.document_type == document_type)
            .where(DocumentCounter.business_date == business_date)
            .with_for_update()
        )
        return session.scalars(statement).one_or_none()

    def get_or_create_counter_for_update(
        self,
        session: Session,
        *,
        document_type: str,
        business_date: date,
    ) -> DocumentCounter:
        counter = self.get_counter_for_update(
            session,
            document_type=document_type,
            business_date=business_date,
        )
        if counter is not None:
            return counter

        counter = DocumentCounter(
            document_type=document_type,
            business_date=business_date,
            last_number=0,
        )
        session.add(counter)
        session.flush()
        return counter

    def max_existing_document_number(
        self,
        session: Session,
        *,
        document_type: str,
        business_date: date,
    ) -> int:
        prefix = f"{self._prefix(document_type)}{business_date:%Y%m%d}-"
        if document_type == DocumentType.INVOICE.value:
            statement = select(Invoice.invoice_code).where(Invoice.invoice_code.like(f"{prefix}%"))
        elif document_type == DocumentType.RETURN.value:
            statement = select(ReturnInvoice.return_code).where(ReturnInvoice.return_code.like(f"{prefix}%"))
        else:
            return 0

        max_number = 0
        for code in session.scalars(statement):
            suffix = code.removeprefix(prefix)
            if suffix.isdigit():
                max_number = max(max_number, int(suffix))
        return max_number

    @staticmethod
    def _prefix(document_type: str) -> str:
        if document_type == DocumentType.INVOICE.value:
            return "HD"
        if document_type == DocumentType.RETURN.value:
            return "TR"
        return ""
