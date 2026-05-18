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


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("invoice_code", name="uq_invoices_invoice_code"),
        CheckConstraint("length(trim(invoice_code)) > 0", name="ck_invoices_invoice_code_not_blank"),
        CheckConstraint("length(trim(customer_snapshot_name)) > 0", name="ck_invoices_customer_snapshot_name_not_blank"),
        CheckConstraint("total_amount >= 0", name="ck_invoices_total_amount_non_negative"),
        CheckConstraint("paid_amount >= 0", name="ck_invoices_paid_amount_non_negative"),
        Index("ix_invoices_invoice_datetime_id", "invoice_datetime", "id"),
        Index("ix_invoices_customer_datetime_id", "customer_id", "invoice_datetime", "id"),
        Index("ix_invoices_status_datetime", "status", "invoice_datetime"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    invoice_code: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        server_default="0",
        default=Decimal("0"),
    )
    payment_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    items: Mapped[list[InvoiceItem]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_items_unit_price_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_invoice_items_line_total_non_negative"),
        CheckConstraint("length(trim(product_code_snapshot)) > 0", name="ck_invoice_items_product_code_snapshot_not_blank"),
        CheckConstraint("length(trim(product_name_snapshot)) > 0", name="ck_invoice_items_product_name_snapshot_not_blank"),
        Index("ix_invoice_items_invoice_id_id", "invoice_id", "id"),
        Index("ix_invoice_items_product_invoice", "product_id", "invoice_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    product_code_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)

    invoice: Mapped[Invoice] = relationship(back_populates="items")

