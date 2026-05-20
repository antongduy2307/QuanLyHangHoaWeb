from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.repositories.reports import ReportsRepository
from app.schemas.reports import (
    CustomerDebtReportRow,
    DashboardSummaryResponse,
    InventorySummaryRow,
    ReportProductPrice,
    ReturnsSummaryDayRow,
    ReturnsSummaryResponse,
    SalesSummaryDayRow,
    SalesSummaryResponse,
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
