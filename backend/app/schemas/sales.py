from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import UnitType
from app.domain.sales import PaymentMethod


@dataclass(frozen=True, slots=True)
class InvoiceItemInput:
    product_id: int
    unit_type: UnitType | str
    quantity: Decimal | int | str
    unit_price: Decimal | int | str | None = None
    line_total: Decimal | int | str | None = None


@dataclass(frozen=True, slots=True)
class InvoiceCreateInput:
    customer_id: int | None
    invoice_datetime: datetime
    items: tuple[InvoiceItemInput, ...]
    paid_amount: Decimal | int | str = Decimal("0")
    customer_snapshot_name: str | None = None
    payment_method: PaymentMethod | str | None = None
    note: str | None = None
    invoice_code: str | None = None


class InvoiceItemRequest(BaseModel):
    product_id: int
    unit_type: UnitType
    quantity: Decimal
    unit_price: Decimal | None = None
    line_total: Decimal | None = None


class InvoiceCreateRequest(BaseModel):
    customer_id: int | None = None
    customer_snapshot_name: str | None = None
    invoice_datetime: datetime
    items: list[InvoiceItemRequest] = Field(min_length=1)
    paid_amount: Decimal = Decimal("0")
    payment_method: PaymentMethod | None = None
    note: str | None = None


class InvoiceUpdateRequest(InvoiceCreateRequest):
    pass


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    unit_type: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    product_code_snapshot: str
    product_name_snapshot: str


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_code: str
    customer_id: int | None
    customer_snapshot_name: str
    invoice_datetime: datetime
    total_amount: Decimal
    paid_amount: Decimal
    payment_method: str | None
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime
    items: list[InvoiceItemResponse]
