from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.infrastructure.db.models.documents import DocumentCounter


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

