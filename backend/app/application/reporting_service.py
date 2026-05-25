from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.repositories.reports import ReportsRepository
from app.schemas.reports import (
    CustomerDebtReportRow,
    DashboardOverviewResponse,
    DashboardSummaryResponse,
    InventorySummaryRow,
    ReportProductPrice,
    ReturnsSummaryDayRow,
    ReturnsSummaryResponse,
    SalesSummaryDayRow,
    SalesSummaryResponse,
    SalesTimeseriesBucketResponse,
    SalesTimeseriesResponse,
    TopProductReportRow,
)

ZERO = Decimal("0")


class ReportingService:
    def __init__(self, repository: ReportsRepository | None = None) -> None:
        self._repository = repository or ReportsRepository()

    def dashboard_summary(self, session: Session, *, today: date | None = None) -> DashboardSummaryResponse:
        target_date = today or date.today()
        return DashboardSummaryResponse(
            total_products=self._repository.count_products(session),
            total_customers=self._repository.count_customers(session),
            total_customer_debt=self._repository.sum_positive_customer_debt(session),
            total_inventory_items=self._repository.count_products(session),
            today_sales_total=self._repository.sum_sales_for_date(session, target_date),
            month_sales_total=self._repository.sum_sales_for_month(session, target_date),
            today_return_total=self._repository.sum_returns_for_date(session, target_date),
            month_return_total=self._repository.sum_returns_for_month(session, target_date),
            invoice_count_today=self._repository.invoice_count_for_date(session, target_date),
            positive_debt_customer_count=self._repository.count_positive_debt_customers(session),
        )

    def dashboard_overview(self, session: Session, *, today: date | None = None) -> DashboardOverviewResponse:
        target_date = today or date.today()
        current_month_start = target_date.replace(day=1)
        previous_month_end = current_month_start - date.resolution
        previous_month_start = previous_month_end.replace(day=1)
        trailing_week_start = target_date - timedelta(days=6)
        this_month_sales_total, _, _ = self._repository.sales_summary_totals(
            session,
            current_month_start,
            target_date,
        )
        last_month_sales_total, _, _ = self._repository.sales_summary_totals(
            session,
            previous_month_start,
            previous_month_end,
        )
        last_7_days_sales_total, _, _ = self._repository.sales_summary_totals(
            session,
            trailing_week_start,
            target_date,
        )
        return DashboardOverviewResponse(
            today_invoice_count=self._repository.invoice_count_for_date(session, target_date),
            today_sales_total=self._repository.sum_sales_for_date(session, target_date),
            today_return_count=self._repository.return_count_for_date(session, target_date),
            today_return_total=self._repository.sum_returns_for_date(session, target_date),
            this_month_sales_total=this_month_sales_total,
            last_month_sales_total=last_month_sales_total,
            last_7_days_sales_total=last_7_days_sales_total,
            current_customer_debt=self._repository.sum_positive_customer_debt(session),
            positive_debt_customer_count=self._repository.count_positive_debt_customers(session),
        )

    def customer_debts(self, session: Session) -> list[CustomerDebtReportRow]:
        return [
            CustomerDebtReportRow(
                customer_id=customer.id,
                customer_name=customer.customer_name,
                phone=customer.phone,
                current_balance=customer.current_balance,
                total_sales=customer.total_sales,
                is_active=customer.is_active,
            )
            for customer in self._repository.list_customer_debts(session)
        ]

    def inventory_summary(self, session: Session) -> list[InventorySummaryRow]:
        return [self._inventory_row(product) for product in self._repository.list_inventory_summary(session)]

    def sales_summary(self, session: Session, *, date_from: date | None = None, date_to: date | None = None) -> SalesSummaryResponse:
        total_sales, total_paid, invoice_count = self._repository.sales_summary_totals(session, date_from, date_to)
        average = total_sales / invoice_count if invoice_count else ZERO
        return SalesSummaryResponse(
            total_sales=total_sales,
            total_paid=total_paid,
            invoice_count=invoice_count,
            average_invoice_total=average,
            by_day=[
                SalesSummaryDayRow(date=row_date, invoice_count=count, total_sales=sales, total_paid=paid)
                for row_date, count, sales, paid in self._repository.sales_summary_by_day(session, date_from, date_to)
            ],
        )

    def returns_summary(self, session: Session, *, date_from: date | None = None, date_to: date | None = None) -> ReturnsSummaryResponse:
        total_returns, return_count = self._repository.returns_summary_totals(session, date_from, date_to)
        return ReturnsSummaryResponse(
            total_returns=total_returns,
            return_count=return_count,
            by_day=[
                ReturnsSummaryDayRow(date=row_date, return_count=count, total_returns=total)
                for row_date, count, total in self._repository.returns_summary_by_day(session, date_from, date_to)
            ],
        )

    def sales_timeseries(
        self,
        session: Session,
        *,
        period: str,
        granularity: str,
        today: date | None = None,
    ) -> SalesTimeseriesResponse:
        target_date = today or date.today()
        start, end = self._period_bounds(period, target_date)
        step = timedelta(hours=1) if granularity == "hour" else timedelta(days=1)
        invoices = self._repository.list_sales_invoices_between(session, start, end)
        buckets: list[SalesTimeseriesBucketResponse] = []
        invoice_index = 0
        cursor = start

        while cursor < end:
            bucket_end = min(cursor + step, end)
            bucket_total = ZERO
            bucket_count = 0
            while invoice_index < len(invoices):
                invoice_datetime, total_amount = invoices[invoice_index]
                normalized_datetime = self._normalized_datetime(invoice_datetime)
                if normalized_datetime >= bucket_end:
                    break
                if normalized_datetime >= cursor:
                    bucket_total += total_amount
                    bucket_count += 1
                invoice_index += 1

            buckets.append(
                SalesTimeseriesBucketResponse(
                    label=self._bucket_label(cursor, granularity),
                    start_datetime=cursor,
                    end_datetime=bucket_end,
                    sales_total=bucket_total,
                    invoice_count=bucket_count,
                ),
            )
            cursor = bucket_end

        return SalesTimeseriesResponse(
            period=period,
            granularity=granularity,
            buckets=buckets,
        )

    def top_products(
        self,
        session: Session,
        *,
        period: str,
        limit: int = 10,
        metric: str = "revenue",
        today: date | None = None,
    ) -> list[TopProductReportRow]:
        if metric != "revenue":
            raise ValueError(f"Unsupported metric: {metric}")

        target_date = today or date.today()
        start, end = self._period_bounds(period, target_date)
        return [
            TopProductReportRow(
                product_id=product_id,
                product_code=product_code,
                product_name=product_name,
                unit_type=unit_type,
                total_quantity=total_quantity,
                total_revenue=total_revenue,
                invoice_count=invoice_count,
            )
            for product_id, product_code, product_name, unit_type, total_quantity, total_revenue, invoice_count in self._repository.list_top_products_by_revenue(
                session,
                start=start,
                end=end,
                limit=max(limit, 1),
            )
        ]

    @staticmethod
    def _inventory_row(product: Product) -> InventorySummaryRow:
        balance_value: Decimal | None = None
        balance_unit: str | None = None
        if product.inventory_balance is not None:
            if product.inventory_balance.on_hand_bich_integer is not None:
                balance_value = product.inventory_balance.on_hand_bich_integer
                balance_unit = "BICH"
            else:
                balance_value = product.inventory_balance.on_hand_bao_decimal
                balance_unit = "BAO"

        return InventorySummaryRow(
            product_id=product.id,
            product_code_base=product.product_code_base,
            product_name=product.product_name,
            unit_mode=product.unit_mode,
            is_active=product.is_active,
            balance_value=balance_value,
            balance_unit=balance_unit,
            prices=[
                ReportProductPrice(unit_type=price.unit_type, price=price.price, is_enabled=price.is_enabled)
                for price in sorted(product.prices, key=lambda candidate: candidate.unit_type)
            ],
        )

    @staticmethod
    def _normalized_datetime(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @staticmethod
    def _bucket_label(cursor: datetime, granularity: str) -> str:
        return cursor.strftime("%H:00") if granularity == "hour" else cursor.date().isoformat()

    @staticmethod
    def _period_bounds(period: str, target_date: date) -> tuple[datetime, datetime]:
        if period == "today":
            start = _date_start(target_date)
            return start, start + timedelta(days=1)
        if period == "yesterday":
            start = _date_start(target_date - timedelta(days=1))
            return start, start + timedelta(days=1)
        if period == "last_7_days":
            start = _date_start(target_date - timedelta(days=6))
            end = _date_start(target_date + timedelta(days=1))
            return start, end
        if period == "this_month":
            return _month_bounds(target_date)
        if period == "last_month":
            previous_month_anchor = target_date.replace(day=1) - date.resolution
            return _month_bounds(previous_month_anchor)
        raise ValueError(f"Unsupported period: {period}")


def _date_start(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _month_bounds(value: date) -> tuple[datetime, datetime]:
    start = _date_start(value.replace(day=1))
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end
