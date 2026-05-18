from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import UnitType
from app.domain.returns import ReturnHandlingMode


@dataclass(frozen=True, slots=True)
class ReturnItemInput:
    product_id: int | None
    unit_type: UnitType | str
    quantity: Decimal | int | str
    unit_price: Decimal | int | str | None = None
    line_total: Decimal | int | str | None = None
    source_invoice_item_id: int | None = None


@dataclass(frozen=True, slots=True)
class ReturnCreateInput:
    source_invoice_id: int | None
    customer_id: int | None
    customer_snapshot_name: str | None
    return_datetime: datetime
    handling_mode: ReturnHandlingMode | str
    items: tuple[ReturnItemInput, ...]
    note: str | None = None
    return_code: str | None = None


class ReturnItemRequest(BaseModel):
    product_id: int | None = None
    unit_type: UnitType
    quantity: Decimal
    unit_price: Decimal | None = None
    line_total: Decimal | None = None
    source_invoice_item_id: int | None = None


class ReturnCreateRequest(BaseModel):
    source_invoice_id: int | None = None
    customer_id: int | None = None
    customer_snapshot_name: str | None = None
    return_datetime: datetime
    handling_mode: ReturnHandlingMode
    items: list[ReturnItemRequest] = Field(min_length=1)
    note: str | None = None


class ReturnUpdateRequest(ReturnCreateRequest):
    pass


class ReturnItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_invoice_item_id: int | None
    product_id: int
    unit_type: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal
    product_code_snapshot: str
    product_name_snapshot: str


class ReturnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    return_code: str
    source_invoice_id: int | None
    customer_id: int | None
    customer_snapshot_name: str
    is_quick_return: bool
    return_datetime: datetime
    total_amount: Decimal
    handling_mode: str
    note: str | None
    created_at: datetime
    updated_at: datetime
    items: list[ReturnItemResponse]
