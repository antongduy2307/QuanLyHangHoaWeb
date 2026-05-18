from __future__ import annotations

from enum import StrEnum


class ReturnHandlingMode(StrEnum):
    REFUND_NOW = "REFUND_NOW"
    STORE_CREDIT = "STORE_CREDIT"

