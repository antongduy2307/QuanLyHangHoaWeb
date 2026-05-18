from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Identity, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.base import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class DocumentCounter(Base):
    __tablename__ = "document_counters"
    __table_args__ = (
        UniqueConstraint("document_type", "business_date", name="uq_document_counters_type_business_date"),
        CheckConstraint("length(trim(document_type)) > 0", name="ck_document_counters_document_type_not_blank"),
        CheckConstraint("last_number >= 0", name="ck_document_counters_last_number_non_negative"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    document_type: Mapped[str] = mapped_column(String(32), nullable=False)
    business_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

