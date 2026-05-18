from __future__ import annotations

from decimal import Decimal

from app.domain.enums import BAO_TO_KG_RATIO, UnitMode, UnitType, allowed_unit_types
from app.domain.exceptions import ValidationError
from app.domain.quantity import to_quantity


def coerce_unit_mode(value: UnitMode | str) -> UnitMode:
    if isinstance(value, UnitMode):
        return value
    try:
        return UnitMode(str(value))
    except ValueError as exc:
        raise ValidationError(f"Unsupported unit mode: {value}") from exc


def coerce_unit_type(value: UnitType | str) -> UnitType:
    if isinstance(value, UnitType):
        return value
    try:
        return UnitType(str(value))
    except ValueError as exc:
        raise ValidationError(f"Unsupported unit type: {value}") from exc


def normalize_product_code(value: str) -> str:
    normalized = value.strip().upper()
    if not normalized:
        raise ValidationError("Product code is required.")
    return normalized


def normalize_product_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValidationError("Product name is required.")
    return normalized


def validate_unit_type_for_mode(unit_mode: UnitMode, unit_type: UnitType) -> None:
    if unit_type not in allowed_unit_types(unit_mode):
        allowed = ", ".join(item.value for item in allowed_unit_types(unit_mode))
        raise ValidationError(f"Unit type {unit_type.value} is invalid for {unit_mode.value}. Allowed: {allowed}.")


def kg_to_bao(value: Decimal | int | str) -> Decimal:
    return to_quantity(value) / BAO_TO_KG_RATIO


def bao_to_kg(value: Decimal | int | str) -> Decimal:
    return to_quantity(value) * BAO_TO_KG_RATIO

