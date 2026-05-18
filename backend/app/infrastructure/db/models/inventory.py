from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.base import Base

if TYPE_CHECKING:
    from app.infrastructure.db.models.customer import Customer


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("length(trim(product_code_base)) > 0", name="ck_products_code_not_blank"),
        CheckConstraint("length(trim(product_name)) > 0", name="ck_products_name_not_blank"),
        CheckConstraint("unit_mode IN ('BAO_KG', 'BICH')", name="ck_products_unit_mode_valid"),
        Index("ix_products_product_code_base", "product_code_base", unique=True),
        Index("ix_products_product_name", "product_name"),
        Index("ix_products_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    product_code_base: Mapped[str] = mapped_column(String(64), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    prices: Mapped[list[ProductPrice]] = relationship(back_populates="product", cascade="all, delete-orphan")
    inventory_balance: Mapped[InventoryBalance | None] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        uselist=False,
    )


class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = (
        UniqueConstraint("product_id", "unit_type", name="uq_product_prices_product_unit_type"),
        CheckConstraint("unit_type IN ('BAO', 'KG', 'BICH')", name="ck_product_prices_unit_type_valid"),
        CheckConstraint("price >= 0", name="ck_product_prices_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    unit_type: Mapped[str] = mapped_column(String(16), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0", default=Decimal("0"))
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)

    product: Mapped[Product] = relationship(back_populates="prices")


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"
    __table_args__ = (
        CheckConstraint(
            "(on_hand_bao_decimal IS NOT NULL AND on_hand_bich_integer IS NULL) "
            "OR (on_hand_bao_decimal IS NULL AND on_hand_bich_integer IS NOT NULL)",
            name="ck_inventory_balances_exactly_one_quantity",
        ),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    on_hand_bao_decimal: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    on_hand_bich_integer: Mapped[Decimal | None] = mapped_column(Numeric(14, 3), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    product: Mapped[Product] = relationship(back_populates="inventory_balance")
