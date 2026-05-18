from __future__ import annotations

from datetime import datetime

OPENING_BALANCE_DATETIME = datetime(1900, 1, 1, 0, 0, 0)


def normalize_optional_text(value: str | None) -> str | None:
    normalized = (value or "").strip()
    return normalized or None


def normalize_customer_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        from app.domain.exceptions import ValidationError

        raise ValidationError("Customer name is required.")
    return normalized

