from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.enums import UnitMode
from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice


class InventoryRepository:
    def get_product(self, session: Session, product_id: int) -> Product:
        statement = (
            select(Product)
            .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
            .where(Product.id == product_id)
        )
        product = session.scalars(statement).one_or_none()
        if product is None:
            raise NotFoundError(f"Product {product_id} was not found.")
        return product

    def get_product_for_update(self, session: Session, product_id: int) -> Product:
        statement = (
            select(Product)
            .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
            .where(Product.id == product_id)
            .with_for_update()
        )
        product = session.scalars(statement).one_or_none()
        if product is None:
            raise NotFoundError(f"Product {product_id} was not found.")
        return product

    def get_product_by_code_base(self, session: Session, product_code_base: str) -> Product | None:
        statement = (
            select(Product)
            .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
            .where(Product.product_code_base == product_code_base)
        )
        return session.scalars(statement).one_or_none()

    def get_product_by_code_base_for_update(self, session: Session, product_code_base: str) -> Product | None:
        statement = (
            select(Product)
            .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
            .where(Product.product_code_base == product_code_base)
            .with_for_update()
        )
        return session.scalars(statement).one_or_none()

    def list_products(self, session: Session, *, include_inactive: bool = False, search: str = "") -> list[Product]:
        statement = (
            select(Product)
            .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
            .order_by(Product.product_name.asc(), Product.id.asc())
        )
        if not include_inactive:
            statement = statement.where(Product.is_active.is_(True))
        needle = search.strip()
        if needle:
            statement = statement.where(Product.product_name.ilike(f"%{needle}%"))
        return list(session.scalars(statement).all())

    def add_product(self, session: Session, product: Product) -> None:
        session.add(product)

    def load_product_prices(self, session: Session, product_id: int) -> list[ProductPrice]:
        statement = select(ProductPrice).where(ProductPrice.product_id == product_id).order_by(ProductPrice.id.asc())
        return list(session.scalars(statement).all())

    def load_product_prices_for_update(self, session: Session, product_id: int) -> list[ProductPrice]:
        statement = (
            select(ProductPrice)
            .where(ProductPrice.product_id == product_id)
            .order_by(ProductPrice.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def get_or_create_balance(self, session: Session, product: Product) -> InventoryBalance:
        if product.inventory_balance is not None:
            return product.inventory_balance

        existing_balance = self.get_inventory_balance_for_update(session, product.id)
        if existing_balance is not None:
            product.inventory_balance = existing_balance
            return existing_balance

        return self.create_inventory_balance(session, product)

    def get_inventory_balance_for_update(self, session: Session, product_id: int) -> InventoryBalance | None:
        statement = select(InventoryBalance).where(InventoryBalance.product_id == product_id).with_for_update()
        return session.scalars(statement).one_or_none()

    def create_inventory_balance(self, session: Session, product: Product) -> InventoryBalance:
        balance = InventoryBalance(
            product_id=product.id,
            on_hand_bao_decimal=0 if product.unit_mode == UnitMode.BAO_KG.value else None,
            on_hand_bich_integer=0 if product.unit_mode == UnitMode.BICH.value else None,
        )
        product.inventory_balance = balance
        session.add(balance)
        return balance

    def product_has_history(self, session: Session, product_id: int) -> bool:
        from app.infrastructure.db.models.returns import ReturnInvoiceItem
        from app.infrastructure.db.models.sales import InvoiceItem

        checks = (
            select(InvoiceItem.id).where(InvoiceItem.product_id == product_id).limit(1),
            select(ReturnInvoiceItem.id).where(ReturnInvoiceItem.product_id == product_id).limit(1),
        )
        return any(session.scalar(statement) is not None for statement in checks)
