from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
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


class ReturnInvoice(Base):
    __tablename__ = "return_invoices"
    __table_args__ = (
        UniqueConstraint("return_code", name="uq_return_invoices_return_code"),
        CheckConstraint("length(trim(return_code)) > 0", name="ck_return_invoices_return_code_not_blank"),
        CheckConstraint(
            "length(trim(customer_snapshot_name)) > 0",
            name="ck_return_invoices_customer_snapshot_name_not_blank",
        ),
        CheckConstraint("total_amount >= 0", name="ck_return_invoices_total_amount_non_negative"),
        Index("ix_return_invoices_return_datetime_id", "return_datetime", "id"),
        Index("ix_return_invoices_customer_datetime_id", "customer_id", "return_datetime", "id"),
        Index("ix_return_invoices_source_invoice_datetime_id", "source_invoice_id", "return_datetime", "id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    return_code: Mapped[str] = mapped_column(String(64), nullable=False)
    source_invoice_id: Mapped[int | None] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=True,
    )
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_quick_return: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    return_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    handling_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    items: Mapped[list[ReturnInvoiceItem]] = relationship(
        back_populates="return_invoice",
        cascade="all, delete-orphan",
    )


class ReturnInvoiceItem(Base):
    __tablename__ = "return_invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_return_invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_return_invoice_items_unit_price_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_return_invoice_items_line_total_non_negative"),
        CheckConstraint(
            "length(trim(product_code_snapshot)) > 0",
            name="ck_return_invoice_items_product_code_snapshot_not_blank",
        ),
        CheckConstraint(
            "length(trim(product_name_snapshot)) > 0",
            name="ck_return_invoice_items_product_name_snapshot_not_blank",
        ),
        Index("ix_return_invoice_items_return_invoice_id_id", "return_invoice_id", "id"),
        Index("ix_return_invoice_items_source_invoice_item_return", "source_invoice_item_id", "return_invoice_id"),
        Index("ix_return_invoice_items_product_return", "product_id", "return_invoice_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    return_invoice_id: Mapped[int] = mapped_column(
        ForeignKey("return_invoices.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_invoice_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("invoice_items.id", ondelete="RESTRICT"),
        nullable=True,
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    product_code_snapshot: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)

    return_invoice: Mapped[ReturnInvoice] = relationship(back_populates="items")
