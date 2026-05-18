from __future__ import annotations

from decimal import Decimal

from app.domain.exceptions import ValidationError


def to_quantity(value: Decimal | int | str) -> Decimal:
    try:
        return value if isinstance(value, Decimal) else Decimal(str(value))
    except Exception as exc:
        raise ValidationError("Quantity value must be numeric.") from exc

