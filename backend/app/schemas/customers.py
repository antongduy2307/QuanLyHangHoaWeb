from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


@dataclass(frozen=True, slots=True)
class CustomerData:
    id: int
    customer_name: str
    phone: str | None
    address: str | None
    note: str | None
    current_balance: Decimal
    total_sales: Decimal
    is_walk_in: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class CustomerLedgerData:
    id: int
    customer_id: int
    event_type: str
    ref_type: str
    ref_id: int
    amount_delta: Decimal
    balance_after: Decimal
    transaction_datetime: datetime | None
    display_order: int
    note: str | None


@dataclass(frozen=True, slots=True)
class DebtPaymentData:
    id: int
    customer_id: int
    amount: Decimal
    payment_datetime: datetime
    note: str | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class CustomerCreateRequest(BaseModel):
    customer_name: str = Field(min_length=1)
    phone: str | None = None
    address: str | None = None
    note: str | None = None
    opening_balance: Decimal = Decimal("0")
    total_sales: Decimal = Decimal("0")


class CustomerUpdateRequest(BaseModel):
    customer_name: str = Field(min_length=1)
    phone: str | None = None
    address: str | None = None
    note: str | None = None
    total_sales: Decimal | None = None


class DebtPaymentRequest(BaseModel):
    amount: Decimal
    payment_datetime: datetime | None = None
    note: str | None = None


class BalanceAdjustmentRequest(BaseModel):
    target_balance: Decimal
    adjustment_datetime: datetime | None = None
    note: str | None = None


class CustomerResponse(BaseModel):
    id: int
    customer_name: str
    phone: str | None
    address: str | None
    note: str | None
    current_balance: Decimal
    total_sales: Decimal
    is_walk_in: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CustomerLedgerResponse(BaseModel):
    id: int
    customer_id: int
    event_type: str
    ref_type: str
    ref_id: int
    amount_delta: Decimal
    balance_after: Decimal
    transaction_datetime: datetime | None
    display_order: int
    note: str | None

    model_config = ConfigDict(from_attributes=True)


class DebtPaymentResponse(BaseModel):
    id: int
    customer_id: int
    amount: Decimal
    payment_datetime: datetime
    note: str | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DebtPaymentResultResponse(BaseModel):
    payment: DebtPaymentResponse
    ledger: CustomerLedgerResponse | None
    current_balance: Decimal


class BalanceAdjustmentResponse(BaseModel):
    customer: CustomerResponse
    ledger: CustomerLedgerResponse


class CustomerDeleteResponse(BaseModel):
    customer_id: int
    action: str
