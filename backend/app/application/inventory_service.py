from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ConflictError, ValidationError
from app.domain.inventory import (
    bao_to_kg,
    coerce_unit_mode,
    coerce_unit_type,
    kg_to_bao,
    normalize_product_code,
    normalize_product_name,
    validate_unit_type_for_mode,
)
from app.domain.money import require_positive_money
from app.domain.quantity import to_quantity
from app.infrastructure.db.models.inventory import InventoryBalance, Product, ProductPrice, StockAdjustment
from app.infrastructure.db.repositories.inventory import InventoryRepository


@dataclass(frozen=True, slots=True)
class ProductDeleteResult:
    product_id: int
    action: str


class InventoryService:
    def __init__(self, repository: InventoryRepository | None = None) -> None:
        self._repository = repository or InventoryRepository()

    def create_product(
        self,
        session: Session,
        *,
        product_code_base: str,
        product_name: str,
        unit_mode: UnitMode | str,
        enabled_prices: Mapping[UnitType | str, Decimal | int | str],
    ) -> Product:
        code = normalize_product_code(product_code_base)
        name = normalize_product_name(product_name)
        normalized_unit_mode = coerce_unit_mode(unit_mode)
        prices = self._normalize_enabled_prices(normalized_unit_mode, enabled_prices)

        existing = self._repository.get_product_by_code_base_for_update(session, code)
        if existing is not None:
            if existing.is_active:
                raise ConflictError("Product code already exists.")
            return self._reactivate_existing_product(
                session,
                existing,
                requested_name=name,
                requested_unit_mode=normalized_unit_mode,
                enabled_prices=prices,
            )

        product = Product(
            product_code_base=code,
            product_name=name,
            unit_mode=normalized_unit_mode.value,
            is_active=True,
        )
        self._repository.add_product(session, product)
        session.flush()
        self._sync_product_prices(session, product, prices)
        self._repository.create_inventory_balance(session, product)
        session.flush()
        return product

    def update_product(
        self,
        session: Session,
        product_id: int,
        *,
        product_name: str,
        unit_mode: UnitMode | str,
        enabled_prices: Mapping[UnitType | str, Decimal | int | str],
    ) -> Product:
        product = self._repository.get_product_for_update(session, product_id)
        requested_unit_mode = coerce_unit_mode(unit_mode)
        if requested_unit_mode.value != product.unit_mode:
            raise ValidationError("Changing product unit mode is not supported.")

        product.product_name = normalize_product_name(product_name)
        prices = self._normalize_enabled_prices(requested_unit_mode, enabled_prices)
        self._sync_product_prices(session, product, prices)
        session.flush()
        return product

    def delete_product(self, session: Session, product_id: int) -> ProductDeleteResult:
        product = self._repository.get_product_for_update(session, product_id)
        if self._repository.product_has_history(session, product.id):
            product.is_active = False
            session.flush()
            return ProductDeleteResult(product_id=product.id, action="deactivated")

        session.delete(product)
        session.flush()
        return ProductDeleteResult(product_id=product_id, action="hard_deleted")

    def list_products(self, session: Session, *, include_inactive: bool = False, search: str = "") -> list[Product]:
        return self._repository.list_products(session, include_inactive=include_inactive, search=search)

    def get_product(self, session: Session, product_id: int) -> Product:
        return self._repository.get_product(session, product_id)

    def get_or_create_balance(self, session: Session, product_id: int) -> InventoryBalance:
        product = self._repository.get_product_for_update(session, product_id)
        balance = self._repository.get_or_create_balance(session, product)
        session.flush()
        return balance

    def increase_stock(
        self,
        session: Session,
        product_id: int,
        quantity: Decimal | int | str,
        unit_type: UnitType | str,
        note: str | None = None,
        record_adjustment: bool = True,
    ) -> InventoryBalance:
        return self._apply_stock_change(session, product_id, quantity, unit_type, increase=True, note=note, record_adjustment=record_adjustment)

    def decrease_stock(
        self,
        session: Session,
        product_id: int,
        quantity: Decimal | int | str,
        unit_type: UnitType | str,
        note: str | None = None,
        record_adjustment: bool = True,
    ) -> InventoryBalance:
        return self._apply_stock_change(session, product_id, quantity, unit_type, increase=False, note=note, record_adjustment=record_adjustment)

    def set_stock_to_target(
        self,
        session: Session,
        product_id: int,
        target_quantity: Decimal | int | str,
        unit_type: UnitType | str,
        note: str | None = None,
        adjustment_datetime: datetime | None = None,
    ) -> InventoryBalance:
        product = self._repository.get_product_for_update(session, product_id)
        mode = UnitMode(product.unit_mode)
        normalized_unit_type = coerce_unit_type(unit_type)
        validate_unit_type_for_mode(mode, normalized_unit_type)
        normalized_target = to_quantity(target_quantity)
        balance = self._repository.get_inventory_balance_for_update(session, product.id)
        if balance is None:
            balance = self._repository.create_inventory_balance(session, product)
            session.flush()

        if mode == UnitMode.BAO_KG:
            current_canonical = balance.on_hand_bao_decimal or Decimal("0")
            target_canonical = normalized_target if normalized_unit_type == UnitType.BAO else kg_to_bao(normalized_target)
            current_for_unit = current_canonical if normalized_unit_type == UnitType.BAO else bao_to_kg(current_canonical)
            delta_for_unit = normalized_target - current_for_unit
            balance.on_hand_bao_decimal = target_canonical
            balance_after = balance.on_hand_bao_decimal
        else:
            current_for_unit = balance.on_hand_bich_integer or Decimal("0")
            delta_for_unit = normalized_target - current_for_unit
            balance.on_hand_bich_integer = normalized_target
            balance_after = balance.on_hand_bich_integer

        if delta_for_unit == Decimal("0"):
            raise ValidationError("Target stock is unchanged.")

        self._repository.add_stock_adjustment(
            session,
            StockAdjustment(
                product_id=product.id,
                adjustment_datetime=adjustment_datetime or datetime.now(timezone.utc),
                movement_type="STOCK_SET",
                unit_type=normalized_unit_type.value,
                quantity=abs(delta_for_unit),
                quantity_delta=delta_for_unit,
                balance_after=balance_after,
                note=note.strip() if note and note.strip() else None,
            ),
        )
        session.flush()
        return balance

    def list_product_movements(self, session: Session, product_id: int) -> list[object]:
        self._repository.get_product(session, product_id)
        return self._repository.list_product_movements(session, product_id)

    def _apply_stock_change(
        self,
        session: Session,
        product_id: int,
        quantity: Decimal | int | str,
        unit_type: UnitType | str,
        *,
        increase: bool,
        note: str | None,
        record_adjustment: bool,
    ) -> InventoryBalance:
        product = self._repository.get_product_for_update(session, product_id)
        mode = UnitMode(product.unit_mode)
        normalized_unit_type = coerce_unit_type(unit_type)
        validate_unit_type_for_mode(mode, normalized_unit_type)
        normalized_quantity = to_quantity(quantity)
        sign = Decimal("1") if increase else Decimal("-1")
        balance = self._repository.get_inventory_balance_for_update(session, product.id)
        if balance is None:
            balance = self._repository.create_inventory_balance(session, product)
            session.flush()

        if mode == UnitMode.BAO_KG:
            delta = normalized_quantity if normalized_unit_type == UnitType.BAO else kg_to_bao(normalized_quantity)
            balance.on_hand_bao_decimal = (balance.on_hand_bao_decimal or Decimal("0")) + (delta * sign)
        else:
            balance.on_hand_bich_integer = (balance.on_hand_bich_integer or Decimal("0")) + (normalized_quantity * sign)

        if record_adjustment:
            balance_after = balance.on_hand_bich_integer if mode == UnitMode.BICH else balance.on_hand_bao_decimal
            self._repository.add_stock_adjustment(
                session,
                StockAdjustment(
                    product_id=product.id,
                    adjustment_datetime=datetime.now(timezone.utc),
                    movement_type="STOCK_INCREASE" if increase else "STOCK_DECREASE",
                    unit_type=normalized_unit_type.value,
                    quantity=normalized_quantity,
                    quantity_delta=normalized_quantity * sign,
                    balance_after=balance_after,
                    note=note.strip() if note and note.strip() else None,
                ),
            )
        session.flush()
        return balance

    def _reactivate_existing_product(
        self,
        session: Session,
        product: Product,
        *,
        requested_name: str,
        requested_unit_mode: UnitMode,
        enabled_prices: dict[UnitType, Decimal],
    ) -> Product:
        if product.product_name.strip() != requested_name:
            raise ValidationError("Product code existed before with a different name.")
        if product.unit_mode != requested_unit_mode.value:
            raise ValidationError("Product code existed before with a different unit mode.")

        product.is_active = True
        self._sync_product_prices(session, product, enabled_prices)
        self._repository.get_or_create_balance(session, product)
        session.flush()
        return product

    def _normalize_enabled_prices(
        self,
        unit_mode: UnitMode,
        enabled_prices: Mapping[UnitType | str, Decimal | int | str],
    ) -> dict[UnitType, Decimal]:
        if not enabled_prices:
            raise ValidationError("At least one enabled price is required.")

        normalized: dict[UnitType, Decimal] = {}
        for raw_unit_type, raw_price in enabled_prices.items():
            unit_type = coerce_unit_type(raw_unit_type)
            validate_unit_type_for_mode(unit_mode, unit_type)
            normalized[unit_type] = require_positive_money(raw_price, "price")

        if not normalized:
            raise ValidationError("At least one enabled price is required.")
        return normalized

    def _sync_product_prices(
        self,
        session: Session,
        product: Product,
        enabled_prices: dict[UnitType, Decimal],
    ) -> None:
        existing_prices = self._repository.load_product_prices_for_update(session, product.id)
        existing_by_unit = {UnitType(price.unit_type): price for price in existing_prices}
        allowed_units = (UnitType.BAO, UnitType.KG) if product.unit_mode == UnitMode.BAO_KG.value else (UnitType.BICH,)

        for unit_type in allowed_units:
            if unit_type in enabled_prices:
                if unit_type in existing_by_unit:
                    existing_by_unit[unit_type].price = enabled_prices[unit_type]
                    existing_by_unit[unit_type].is_enabled = True
                else:
                    session.add(
                        ProductPrice(
                            product_id=product.id,
                            unit_type=unit_type.value,
                            price=enabled_prices[unit_type],
                            is_enabled=True,
                        )
                    )
            elif unit_type in existing_by_unit:
                existing_by_unit[unit_type].is_enabled = False
