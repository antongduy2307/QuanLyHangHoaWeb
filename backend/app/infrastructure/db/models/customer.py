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
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("length(trim(customer_name)) > 0", name="ck_customers_name_not_blank"),
        CheckConstraint("total_sales >= 0", name="ck_customers_total_sales_non_negative"),
        Index("ix_customers_customer_name", "customer_name"),
        Index("ix_customers_phone", "phone"),
        Index("ix_customers_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        server_default="0",
        default=Decimal("0"),
    )
    total_sales: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        server_default="0",
        default=Decimal("0"),
    )
    is_walk_in: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    balance_ledger_entries: Mapped[list[CustomerBalanceLedger]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    debt_payments: Mapped[list[DebtPayment]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )


class DebtPayment(Base):
    __tablename__ = "debt_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_debt_payments_amount_positive"),
        Index("ix_debt_payments_customer_timeline", "customer_id", "payment_datetime", "id"),
        Index("ix_debt_payments_customer_deleted", "customer_id", "is_deleted"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    payment_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer: Mapped[Customer] = relationship(back_populates="debt_payments")


class CustomerBalanceLedger(Base):
    __tablename__ = "customer_balance_ledgers"
    __table_args__ = (
        CheckConstraint("length(trim(event_type)) > 0", name="ck_customer_balance_ledgers_event_type_not_blank"),
        CheckConstraint("length(trim(ref_type)) > 0", name="ck_customer_balance_ledgers_ref_type_not_blank"),
        Index(
            "ix_customer_balance_ledgers_customer_timeline",
            "customer_id",
            "transaction_datetime",
            "display_order",
            "id",
        ),
        Index("ix_customer_balance_ledgers_customer_ref", "customer_id", "ref_type", "ref_id"),
        Index("ix_customer_balance_ledgers_customer_event", "customer_id", "event_type"),
        Index(
            "ix_customer_balance_ledgers_customer_source",
            "customer_id",
            "source_ref_type",
            "source_ref_id",
        ),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    ref_type: Mapped[str] = mapped_column(String(50), nullable=False)
    ref_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    source_ref_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_ref_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    amount_delta: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    transaction_datetime: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped[Customer] = relationship(back_populates="balance_ledger_entries")
