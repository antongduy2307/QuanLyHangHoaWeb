from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.domain.documents import DocumentType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.repositories.documents import DocumentRepository


class DocumentService:
    def __init__(self, repository: DocumentRepository | None = None) -> None:
        self._repository = repository or DocumentRepository()

    def next_invoice_code(self, session: Session, invoice_datetime: datetime) -> str:
        return self.next_document_code(session, DocumentType.INVOICE, invoice_datetime.date())

    def next_return_code(self, session: Session, return_datetime: datetime) -> str:
        return self.next_document_code(session, DocumentType.RETURN, return_datetime.date())

    def next_document_code(
        self,
        session: Session,
        document_type: DocumentType | str,
        business_date: date,
    ) -> str:
        normalized_type = self._coerce_document_type(document_type)
        counter = self._repository.get_or_create_counter_for_update(
            session,
            document_type=normalized_type.value,
            business_date=business_date,
        )
        existing_max = self._repository.max_existing_document_number(
            session,
            document_type=normalized_type.value,
            business_date=business_date,
        )
        if counter.last_number < existing_max:
            counter.last_number = existing_max
        counter.last_number += 1
        session.flush()
        return f"{self._prefix(normalized_type)}{business_date:%Y%m%d}-{counter.last_number:03d}"

    @staticmethod
    def _coerce_document_type(value: DocumentType | str) -> DocumentType:
        if isinstance(value, DocumentType):
            return value
        try:
            return DocumentType(str(value))
        except ValueError as exc:
            raise ValidationError(f"Unsupported document type: {value}") from exc

    @staticmethod
    def _prefix(document_type: DocumentType) -> str:
        if document_type == DocumentType.INVOICE:
            return "HD"
        if document_type == DocumentType.RETURN:
            return "TR"
        raise ValidationError(f"Unsupported document type: {document_type}")
