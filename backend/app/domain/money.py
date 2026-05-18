from __future__ import annotations

from decimal import Decimal

from app.domain.exceptions import ValidationError


def to_money(value: Decimal | int | str) -> Decimal:
    try:
        return value if isinstance(value, Decimal) else Decimal(str(value))
    except Exception as exc:
        raise ValidationError("Money value must be numeric.") from exc


def require_positive_money(value: Decimal | int | str, field_name: str) -> Decimal:
    amount = to_money(value)
    if amount <= Decimal("0"):
        raise ValidationError(f"{field_name} must be > 0.")
    return amount


def require_non_negative_money(value: Decimal | int | str, field_name: str) -> Decimal:
    amount = to_money(value)
    if amount < Decimal("0"):
        raise ValidationError(f"{field_name} must be >= 0.")
    return amount

