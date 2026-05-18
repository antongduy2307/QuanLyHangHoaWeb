from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.enums import UnitMode, UnitType


@dataclass(frozen=True, slots=True)
class ProductPriceData:
    unit_type: str
    price: Decimal
    is_enabled: bool


@dataclass(frozen=True, slots=True)
class InventoryBalanceData:
    product_id: int
    on_hand_bao_decimal: Decimal | None
    on_hand_bich_integer: Decimal | None


@dataclass(frozen=True, slots=True)
class ProductData:
    id: int
    product_code_base: str
    product_name: str
    unit_mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    prices: tuple[ProductPriceData, ...] = ()
    balance: InventoryBalanceData | None = None


class ProductPriceRequest(BaseModel):
    unit_type: UnitType
    price: Decimal
    is_enabled: bool = True


class ProductCreateRequest(BaseModel):
    product_code_base: str = Field(min_length=1)
    product_name: str = Field(min_length=1)
    unit_mode: UnitMode
    prices: list[ProductPriceRequest]


class ProductUpdateRequest(BaseModel):
    product_name: str = Field(min_length=1)
    prices: list[ProductPriceRequest]


class StockChangeRequest(BaseModel):
    unit_type: UnitType
    quantity: Decimal
    note: str | None = None


class ProductPriceResponse(BaseModel):
    unit_type: str
    price: Decimal
    is_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class InventoryBalanceResponse(BaseModel):
    product_id: int
    on_hand_bao_decimal: Decimal | None
    on_hand_bich_integer: Decimal | None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProductResponse(BaseModel):
    id: int
    product_code_base: str
    product_name: str
    unit_mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    prices: list[ProductPriceResponse]
    balance: InventoryBalanceResponse | None = None


class ProductDeleteResponse(BaseModel):
    product_id: int
    action: str
