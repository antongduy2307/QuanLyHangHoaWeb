from __future__ import annotations

from sqlalchemy import BigInteger, Numeric, String, Text, cast, literal, null, select
from sqlalchemy.orm import Session, selectinload

from app.domain.enums import UnitMode
from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice, StockAdjustment
from app.infrastructure.db.models.returns import ReturnInvoice, ReturnInvoiceItem
from app.infrastructure.db.models.sales import Invoice, InvoiceItem


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

    def add_stock_adjustment(self, session: Session, adjustment: StockAdjustment) -> None:
        session.add(adjustment)

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
        checks = (
            select(InvoiceItem.id).where(InvoiceItem.product_id == product_id).limit(1),
            select(ReturnInvoiceItem.id).where(ReturnInvoiceItem.product_id == product_id).limit(1),
            select(StockAdjustment.id).where(StockAdjustment.product_id == product_id).limit(1),
        )
        return any(session.scalar(statement) is not None for statement in checks)

    def list_product_movements(self, session: Session, product_id: int) -> list[object]:
        id_type = BigInteger()
        quantity_type = Numeric(14, 3)

        sale_statement = (
            select(
                cast(InvoiceItem.id, id_type).label("movement_id"),
                Invoice.invoice_datetime.label("movement_datetime"),
                cast(literal("SALE"), String(32)).label("movement_type"),
                cast(-InvoiceItem.quantity, quantity_type).label("quantity_delta"),
                cast(InvoiceItem.unit_type, String(16)).label("unit_type"),
                cast(null(), quantity_type).label("balance_after"),
                cast(literal("invoice"), String(32)).label("source_type"),
                cast(Invoice.id, id_type).label("source_id"),
                cast(Invoice.note, Text).label("note"),
                cast(null(), Text).label("actor"),
                Invoice.created_at.label("created_at"),
            )
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(InvoiceItem.product_id == product_id)
        )
        return_statement = (
            select(
                cast(ReturnInvoiceItem.id, id_type).label("movement_id"),
                ReturnInvoice.return_datetime.label("movement_datetime"),
                cast(literal("RETURN"), String(32)).label("movement_type"),
                cast(ReturnInvoiceItem.quantity, quantity_type).label("quantity_delta"),
                cast(ReturnInvoiceItem.unit_type, String(16)).label("unit_type"),
                cast(null(), quantity_type).label("balance_after"),
                cast(literal("return"), String(32)).label("source_type"),
                cast(ReturnInvoice.id, id_type).label("source_id"),
                cast(ReturnInvoice.note, Text).label("note"),
                cast(null(), Text).label("actor"),
                ReturnInvoice.created_at.label("created_at"),
            )
            .join(ReturnInvoice, ReturnInvoice.id == ReturnInvoiceItem.return_invoice_id)
            .where(ReturnInvoiceItem.product_id == product_id)
        )
        adjustment_statement = select(
            cast(StockAdjustment.id, id_type).label("movement_id"),
            StockAdjustment.adjustment_datetime.label("movement_datetime"),
            cast(StockAdjustment.movement_type, String(32)).label("movement_type"),
            cast(StockAdjustment.quantity_delta, quantity_type).label("quantity_delta"),
            cast(StockAdjustment.unit_type, String(16)).label("unit_type"),
            cast(StockAdjustment.balance_after, quantity_type).label("balance_after"),
            cast(literal("stock_adjustment"), String(32)).label("source_type"),
            cast(StockAdjustment.id, id_type).label("source_id"),
            cast(StockAdjustment.note, Text).label("note"),
            cast(null(), Text).label("actor"),
            StockAdjustment.created_at.label("created_at"),
        ).where(StockAdjustment.product_id == product_id)

        statement = sale_statement.union_all(return_statement, adjustment_statement).subquery()
        ordered = select(statement).order_by(
            statement.c.movement_datetime.desc(),
            statement.c.created_at.desc(),
            statement.c.movement_id.desc(),
        )
        return list(session.execute(ordered).mappings())
