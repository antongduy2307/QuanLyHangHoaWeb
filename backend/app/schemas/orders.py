from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import UnitType


@dataclass(frozen=True, slots=True)
class OrderItemInput:
    product_id: int
    unit_type: UnitType | str
    quantity: Decimal | int | str


@dataclass(frozen=True, slots=True)
class OrderCreateInput:
    customer_id: int | None
    customer_snapshot_name: str | None
    order_datetime: datetime
    required_delivery_datetime: datetime | None
    items: tuple[OrderItemInput, ...]
    note: str | None = None


@dataclass(frozen=True, slots=True)
class OrderUpdateInput:
    customer_id: int | None
    customer_snapshot_name: str | None
    order_datetime: datetime
    required_delivery_datetime: datetime | None
    items: tuple[OrderItemInput, ...]
    note: str | None = None


class OrderItemRequest(BaseModel):
    product_id: int
    unit_type: UnitType
    quantity: Decimal


class OrderCreateRequest(BaseModel):
    customer_id: int | None = None
    customer_snapshot_name: str | None = None
    order_datetime: datetime
    required_delivery_datetime: datetime | None = None
    items: list[OrderItemRequest] = Field(min_length=1)
    note: str | None = None


class OrderUpdateRequest(BaseModel):
    customer_id: int | None = None
    customer_snapshot_name: str | None = None
    order_datetime: datetime
    required_delivery_datetime: datetime | None = None
    items: list[OrderItemRequest] = Field(min_length=1)
    note: str | None = None


class OrderPreparedRequest(BaseModel):
    prepared: bool


class OrderConvertedRequest(BaseModel):
    invoice_id: int


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name_snapshot: str
    unit_type: str
    quantity: Decimal
    created_at: datetime


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_code: str
    customer_id: int | None
    customer_name_snapshot: str
    order_datetime: datetime
    required_delivery_datetime: datetime | None
    note: str | None
    status: str
    source_invoice_id: int | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]


class OrderQuantitySummaryResponse(BaseModel):
    product_id: int
    product_name: str
    unit_type: UnitType
    quantity: Decimal
    stock_available: Decimal | None = None
