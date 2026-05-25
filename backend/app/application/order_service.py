from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.domain.inventory import bao_to_kg, coerce_unit_type, validate_unit_type_for_mode
from app.domain.orders import OrderStatus
from app.domain.quantity import to_quantity
from app.infrastructure.db.models.orders import OrderRequest, OrderRequestItem
from app.infrastructure.db.repositories.customer import CustomerRepository
from app.infrastructure.db.repositories.inventory import InventoryRepository
from app.infrastructure.db.repositories.orders import OrderRepository


@dataclass(frozen=True, slots=True)
class OrderLineInput:
    product_id: int
    unit_type: UnitType
    quantity: Decimal


@dataclass(frozen=True, slots=True)
class OrderQuantitySummary:
    product_id: int
    product_name: str
    unit_type: UnitType
    quantity: Decimal
    stock_available: Decimal | None = None


class OrderService:
    def __init__(
        self,
        repository: OrderRepository | None = None,
        inventory_repository: InventoryRepository | None = None,
        customer_repository: CustomerRepository | None = None,
    ) -> None:
        self._repository = repository or OrderRepository()
        self._inventory_repository = inventory_repository or InventoryRepository()
        self._customer_repository = customer_repository or CustomerRepository()

    def list_active_orders(self, session: Session) -> list[OrderRequest]:
        return self._repository.list_active_orders(session)

    def list_active_quantity_summary(self, session: Session) -> list[OrderQuantitySummary]:
        totals: dict[tuple[int, UnitType], OrderQuantitySummary] = {}
        for order in self._repository.list_active_orders(session):
            for item in order.items:
                unit_type = coerce_unit_type(item.unit_type)
                key = (item.product_id, unit_type)
                existing = totals.get(key)
                if existing is None:
                    totals[key] = OrderQuantitySummary(
                        product_id=item.product_id,
                        product_name=item.product_name_snapshot,
                        unit_type=unit_type,
                        quantity=Decimal(str(item.quantity)),
                        stock_available=self._get_stock_available(session, item.product_id, unit_type),
                    )
                    continue
                totals[key] = OrderQuantitySummary(
                    product_id=existing.product_id,
                    product_name=existing.product_name,
                    unit_type=existing.unit_type,
                    quantity=existing.quantity + Decimal(str(item.quantity)),
                    stock_available=existing.stock_available,
                )
        return list(totals.values())

    def get_order(self, session: Session, order_id: int) -> OrderRequest:
        return self._repository.get_order(session, order_id)

    def create_order(
        self,
        session: Session,
        *,
        customer_id: int | None,
        customer_snapshot_name: str | None,
        order_datetime: datetime,
        required_delivery_datetime: datetime | None,
        items: list[Mapping[str, object]] | tuple[Mapping[str, object], ...],
        note: str | None = None,
    ) -> OrderRequest:
        normalized_datetime = self._require_datetime(order_datetime, "order_datetime")
        normalized_delivery = self._require_optional_datetime(required_delivery_datetime, "required_delivery_datetime")
        normalized_items = self._normalize_items(items)

        order = OrderRequest(
            order_code=self._repository.generate_order_code(session, normalized_datetime),
            customer_id=customer_id,
            customer_name_snapshot=self._resolve_customer_name(session, customer_id, customer_snapshot_name),
            order_datetime=normalized_datetime,
            required_delivery_datetime=normalized_delivery,
            note=self._normalize_optional_text(note),
            status=OrderStatus.OPEN.value,
        )
        self._repository.add_order(session, order)
        session.flush()
        self._replace_items(session, order, normalized_items)
        session.flush()
        return order

    def update_order(
        self,
        session: Session,
        order_id: int,
        *,
        customer_id: int | None,
        customer_snapshot_name: str | None,
        order_datetime: datetime,
        required_delivery_datetime: datetime | None,
        items: list[Mapping[str, object]] | tuple[Mapping[str, object], ...],
        note: str | None = None,
    ) -> OrderRequest:
        normalized_datetime = self._require_datetime(order_datetime, "order_datetime")
        normalized_delivery = self._require_optional_datetime(required_delivery_datetime, "required_delivery_datetime")
        normalized_items = self._normalize_items(items)

        order = self._repository.get_order_for_update(session, order_id)
        if order.status == OrderStatus.CONVERTED.value:
            raise ValidationError("Converted orders cannot be edited.")
        order.customer_id = customer_id
        order.customer_name_snapshot = self._resolve_customer_name(session, customer_id, customer_snapshot_name)
        order.order_datetime = normalized_datetime
        order.required_delivery_datetime = normalized_delivery
        order.note = self._normalize_optional_text(note)
        self._replace_items(session, order, normalized_items)
        session.flush()
        return order

    def mark_prepared(self, session: Session, order_id: int, prepared: bool) -> OrderRequest:
        order = self._repository.get_order_for_update(session, order_id)
        if order.status == OrderStatus.CONVERTED.value:
            raise ValidationError("Converted orders cannot change prepared status.")
        order.status = OrderStatus.PREPARED.value if prepared else OrderStatus.OPEN.value
        order.completed_at = datetime.now(order.order_datetime.tzinfo) if prepared else None
        session.flush()
        return order

    def mark_converted(self, session: Session, order_id: int, invoice_id: int) -> OrderRequest:
        order = self._repository.get_order_for_update(session, order_id)
        order.status = OrderStatus.CONVERTED.value
        order.source_invoice_id = int(invoice_id)
        order.completed_at = datetime.now(order.order_datetime.tzinfo)
        session.flush()
        return order

    def delete_order(self, session: Session, order_id: int) -> None:
        order = self._repository.get_order_for_update(session, order_id)
        if order.status == OrderStatus.CONVERTED.value:
            raise ValidationError("Converted orders cannot be deleted.")
        self._repository.delete_order(session, order)
        session.flush()

    def _replace_items(self, session: Session, order: OrderRequest, items: list[OrderLineInput]) -> None:
        order.items.clear()
        session.flush()
        for line in items:
            product = self._inventory_repository.get_product(session, line.product_id)
            validate_unit_type_for_mode(UnitMode(product.unit_mode), line.unit_type)
            order.items.append(
                OrderRequestItem(
                    product_id=product.id,
                    product_name_snapshot=product.product_name,
                    unit_type=line.unit_type.value,
                    quantity=line.quantity,
                )
            )

    def _resolve_customer_name(self, session: Session, customer_id: int | None, raw_name: str | None) -> str:
        if customer_id is None:
            normalized_name = self._normalize_optional_text(raw_name)
            return normalized_name or "Khách lẻ"
        customer = self._customer_repository.get_customer(session, customer_id)
        return customer.customer_name

    def _normalize_items(self, items: list[Mapping[str, object] | object] | tuple[Mapping[str, object] | object, ...]) -> list[OrderLineInput]:
        if not items:
            raise ValidationError("Order must contain at least one item.")
        return [
            OrderLineInput(
                product_id=int(self._item_value(item, "product_id")),
                unit_type=self._normalize_unit_type(self._item_value(item, "unit_type")),
                quantity=self._require_positive_quantity(self._item_value(item, "quantity")),
            )
            for item in items
        ]

    @staticmethod
    def _item_value(item: Mapping[str, object] | object, field_name: str) -> object:
        if isinstance(item, Mapping):
            return item.get(field_name)
        return getattr(item, field_name)

    def _get_stock_available(self, session: Session, product_id: int | None, unit_type: UnitType) -> Decimal | None:
        if product_id is None:
            return None
        try:
            product = self._inventory_repository.get_product(session, int(product_id))
            balance = product.inventory_balance
            if balance is None:
                return Decimal("0")
            if unit_type == UnitType.BAO:
                return balance.on_hand_bao_decimal or Decimal("0")
            if unit_type == UnitType.KG:
                return bao_to_kg(balance.on_hand_bao_decimal or Decimal("0"))
            return balance.on_hand_bich_integer or Decimal("0")
        except Exception:
            return None

    @staticmethod
    def _normalize_unit_type(value: object) -> UnitType:
        if value is None:
            raise ValidationError("Order item unit_type is required.")
        return coerce_unit_type(value)

    @staticmethod
    def _require_positive_quantity(value: object) -> Decimal:
        quantity = to_quantity(value)
        if quantity <= Decimal("0"):
            raise ValidationError("Order item quantity must be > 0.")
        return quantity

    @staticmethod
    def _require_datetime(value: object, field_name: str) -> datetime:
        if not isinstance(value, datetime):
            raise ValidationError(f"{field_name} must be a valid datetime.")
        return value

    @staticmethod
    def _require_optional_datetime(value: object, field_name: str) -> datetime | None:
        if value is None:
            return None
        if not isinstance(value, datetime):
            raise ValidationError(f"{field_name} must be a valid datetime.")
        return value

    @staticmethod
    def _normalize_optional_text(value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None
