from __future__ import annotations

from enum import StrEnum


class InvoiceStatus(StrEnum):
    COMPLETED = "COMPLETED"


class PaymentMethod(StrEnum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    CARD = "CARD"
    OTHER = "OTHER"

