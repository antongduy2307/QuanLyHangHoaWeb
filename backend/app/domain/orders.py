from __future__ import annotations

from enum import StrEnum


class OrderStatus(StrEnum):
    OPEN = "OPEN"
    PREPARED = "PREPARED"
    CONVERTED = "CONVERTED"
