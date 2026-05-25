from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DashboardSummaryResponse(BaseModel):
    total_products: int
    total_customers: int
    total_customer_debt: Decimal
    total_inventory_items: int
    today_sales_total: Decimal
    month_sales_total: Decimal
    today_return_total: Decimal
    month_return_total: Decimal
    invoice_count_today: int
    positive_debt_customer_count: int


class DashboardOverviewResponse(BaseModel):
    today_invoice_count: int
    today_sales_total: Decimal
    today_return_count: int
    today_return_total: Decimal
    this_month_sales_total: Decimal
    last_month_sales_total: Decimal
    last_7_days_sales_total: Decimal
    current_customer_debt: Decimal
    positive_debt_customer_count: int


class CustomerDebtReportRow(BaseModel):
    customer_id: int
    customer_name: str
    phone: str | None
    current_balance: Decimal
    total_sales: Decimal
    is_active: bool


class ReportProductPrice(BaseModel):
    unit_type: str
    price: Decimal
    is_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class InventorySummaryRow(BaseModel):
    product_id: int
    product_code_base: str
    product_name: str
    unit_mode: str
    is_active: bool
    balance_value: Decimal | None
    balance_unit: str | None
    prices: list[ReportProductPrice]


class SalesSummaryDayRow(BaseModel):
    date: date
    invoice_count: int
    total_sales: Decimal
    total_paid: Decimal


class SalesSummaryResponse(BaseModel):
    total_sales: Decimal
    total_paid: Decimal
    invoice_count: int
    average_invoice_total: Decimal
    by_day: list[SalesSummaryDayRow]


class SalesTimeseriesBucketResponse(BaseModel):
    label: str
    start_datetime: datetime
    end_datetime: datetime
    sales_total: Decimal
    invoice_count: int


class SalesTimeseriesResponse(BaseModel):
    period: str
    granularity: str
    buckets: list[SalesTimeseriesBucketResponse]


class TopProductReportRow(BaseModel):
    product_id: int
    product_code: str
    product_name: str
    unit_type: str
    total_quantity: Decimal
    total_revenue: Decimal
    invoice_count: int


class ReturnsSummaryDayRow(BaseModel):
    date: date
    return_count: int
    total_returns: Decimal


class ReturnsSummaryResponse(BaseModel):
    total_returns: Decimal
    return_count: int
    by_day: list[ReturnsSummaryDayRow]
