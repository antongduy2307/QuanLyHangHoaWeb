from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.document_service import DocumentService
from app.domain.documents import DocumentType
from app.infrastructure.db.base import Base


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_same_date_increments_document_sequence(session: Session) -> None:
    service = DocumentService()

    assert service.next_document_code(session, DocumentType.INVOICE, date(2026, 5, 16)) == "HD20260516-001"
    assert service.next_document_code(session, DocumentType.INVOICE, date(2026, 5, 16)) == "HD20260516-002"


def test_document_types_have_independent_counters(session: Session) -> None:
    service = DocumentService()

    assert service.next_document_code(session, DocumentType.INVOICE, date(2026, 5, 16)) == "HD20260516-001"
    assert service.next_document_code(session, DocumentType.RETURN, date(2026, 5, 16)) == "TR20260516-001"


def test_document_dates_have_independent_counters(session: Session) -> None:
    service = DocumentService()

    assert service.next_document_code(session, DocumentType.INVOICE, date(2026, 5, 16)) == "HD20260516-001"
    assert service.next_document_code(session, DocumentType.INVOICE, date(2026, 5, 17)) == "HD20260517-001"
