from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class OrderRequest(Base):
    __tablename__ = "order_requests"
    __table_args__ = (
        UniqueConstraint("order_code", name="uq_order_requests_order_code"),
        CheckConstraint("length(trim(order_code)) > 0", name="ck_order_requests_order_code_not_blank"),
        CheckConstraint(
            "length(trim(customer_name_snapshot)) > 0",
            name="ck_order_requests_customer_snapshot_not_blank",
        ),
        Index("ix_order_requests_status_delivery_order", "status", "required_delivery_datetime", "order_datetime", "id"),
        Index("ix_order_requests_customer_status_order", "customer_id", "status", "order_datetime", "id"),
        Index("ix_order_requests_source_invoice_id", "source_invoice_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    order_code: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    order_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    required_delivery_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, server_default="OPEN", default="OPEN")
    source_invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    items: Mapped[list[OrderRequestItem]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderRequestItem(Base):
    __tablename__ = "order_request_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_request_items_quantity_positive"),
        CheckConstraint(
            "length(trim(product_name_snapshot)) > 0",
            name="ck_order_request_items_product_name_snapshot_not_blank",
        ),
        Index("ix_order_request_items_order_id_id", "order_request_id", "id"),
        Index("ix_order_request_items_product_order", "product_id", "order_request_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    order_request_id: Mapped[int] = mapped_column(ForeignKey("order_requests.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    order: Mapped[OrderRequest] = relationship(back_populates="items")
