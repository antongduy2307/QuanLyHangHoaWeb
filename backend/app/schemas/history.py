from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class HistoryOpenTarget(BaseModel):
    target_type: str
    target_id: int
    route: str | None = None


class HistoryEventResponse(BaseModel):
    event_type: str
    event_id: int
    event_datetime: datetime | None
    display_order: int
    code: str | None
    customer_id: int | None
    customer_name: str | None
    product_id: int | None
    product_name: str | None
    amount: Decimal | None
    paid_amount: Decimal | None = None
    item_count: int | None = None
    quantity: Decimal | None
    unit_type: str | None
    status: str | None
    source_type: str | None
    source_id: int | None
    note: str | None
    open_target: HistoryOpenTarget | None = None

    model_config = ConfigDict(from_attributes=True)


class HistoryListResponse(BaseModel):
    page: int
    page_size: int
    total: int
    items: list[HistoryEventResponse]
