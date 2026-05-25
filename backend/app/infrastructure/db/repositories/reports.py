from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.db.models.customer import Customer
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.models.returns import ReturnInvoice
from app.infrastructure.db.models.sales import Invoice, InvoiceItem

ZERO = Decimal("0")


class ReportsRepository:
    def count_products(self, session: Session) -> int:
        return int(session.scalar(select(func.count(Product.id))) or 0)

    def count_customers(self, session: Session) -> int:
        return int(session.scalar(select(func.count(Customer.id)).where(Customer.is_walk_in.is_(False))) or 0)

    def sum_positive_customer_debt(self, session: Session) -> Decimal:
        return session.scalar(
            select(func.coalesce(func.sum(Customer.current_balance), ZERO)).where(
                Customer.is_walk_in.is_(False),
                Customer.current_balance > ZERO,
            ),
        ) or ZERO

    def count_positive_debt_customers(self, session: Session) -> int:
        return int(
            session.scalar(
                select(func.count(Customer.id)).where(
                    Customer.is_walk_in.is_(False),
                    Customer.current_balance > ZERO,
                ),
            )
            or 0,
        )

    def sum_sales_for_date(self, session: Session, target_date: date) -> Decimal:
        start, end = _day_bounds(target_date)
        return session.scalar(
            select(func.coalesce(func.sum(Invoice.total_amount), ZERO)).where(
                Invoice.invoice_datetime >= start,
                Invoice.invoice_datetime < end,
            ),
        ) or ZERO

    def sum_sales_for_month(self, session: Session, target_date: date) -> Decimal:
        start, end = _month_bounds(target_date)
        return session.scalar(
            select(func.coalesce(func.sum(Invoice.total_amount), ZERO)).where(
                Invoice.invoice_datetime >= start,
                Invoice.invoice_datetime < end,
            ),
        ) or ZERO

    def invoice_count_for_date(self, session: Session, target_date: date) -> int:
        start, end = _day_bounds(target_date)
        return int(
            session.scalar(
                select(func.count(Invoice.id)).where(
                    Invoice.invoice_datetime >= start,
                    Invoice.invoice_datetime < end,
                ),
            )
            or 0,
        )

    def sum_returns_for_date(self, session: Session, target_date: date) -> Decimal:
        start, end = _day_bounds(target_date)
        return session.scalar(
            select(func.coalesce(func.sum(ReturnInvoice.total_amount), ZERO)).where(
                ReturnInvoice.return_datetime >= start,
                ReturnInvoice.return_datetime < end,
            ),
        ) or ZERO

    def sum_returns_for_month(self, session: Session, target_date: date) -> Decimal:
        start, end = _month_bounds(target_date)
        return session.scalar(
            select(func.coalesce(func.sum(ReturnInvoice.total_amount), ZERO)).where(
                ReturnInvoice.return_datetime >= start,
                ReturnInvoice.return_datetime < end,
            ),
        ) or ZERO

    def return_count_for_date(self, session: Session, target_date: date) -> int:
        start, end = _day_bounds(target_date)
        return int(
            session.scalar(
                select(func.count(ReturnInvoice.id)).where(
                    ReturnInvoice.return_datetime >= start,
                    ReturnInvoice.return_datetime < end,
                ),
            )
            or 0,
        )

    def list_customer_debts(self, session: Session) -> list[Customer]:
        return list(
            session.scalars(
                select(Customer)
                .where(Customer.is_walk_in.is_(False))
                .order_by(Customer.current_balance.desc(), Customer.customer_name.asc(), Customer.id.asc()),
            ),
        )

    def list_inventory_summary(self, session: Session) -> list[Product]:
        return list(
            session.scalars(
                select(Product)
                .options(selectinload(Product.prices), selectinload(Product.inventory_balance))
                .order_by(Product.product_code_base.asc(), Product.id.asc()),
            ),
        )

    def sales_summary_totals(self, session: Session, date_from: date | None, date_to: date | None) -> tuple[Decimal, Decimal, int]:
        statement = select(
            func.coalesce(func.sum(Invoice.total_amount), ZERO),
            func.coalesce(func.sum(Invoice.paid_amount), ZERO),
            func.count(Invoice.id),
        )
        statement = self._apply_invoice_date_range(statement, date_from, date_to)
        total_sales, total_paid, invoice_count = session.execute(statement).one()
        return total_sales or ZERO, total_paid or ZERO, int(invoice_count or 0)

    def sales_summary_by_day(self, session: Session, date_from: date | None, date_to: date | None) -> list[tuple[date, int, Decimal, Decimal]]:
        invoice_date = func.date(Invoice.invoice_datetime)
        statement = (
            select(
                invoice_date.label("invoice_date"),
                func.count(Invoice.id),
                func.coalesce(func.sum(Invoice.total_amount), ZERO),
                func.coalesce(func.sum(Invoice.paid_amount), ZERO),
            )
            .group_by(invoice_date)
            .order_by(invoice_date.asc())
        )
        statement = self._apply_invoice_date_range(statement, date_from, date_to)
        return [(date.fromisoformat(str(row[0])), int(row[1]), row[2] or ZERO, row[3] or ZERO) for row in session.execute(statement)]

    def list_sales_invoices_between(self, session: Session, start: datetime, end: datetime) -> list[tuple[datetime, Decimal]]:
        statement = (
            select(Invoice.invoice_datetime, Invoice.total_amount)
            .where(
                Invoice.invoice_datetime >= start,
                Invoice.invoice_datetime < end,
            )
            .order_by(Invoice.invoice_datetime.asc(), Invoice.id.asc())
        )
        return [(invoice_datetime, total_amount or ZERO) for invoice_datetime, total_amount in session.execute(statement)]

    def list_top_products_by_revenue(
        self,
        session: Session,
        *,
        start: datetime,
        end: datetime,
        limit: int,
    ) -> list[tuple[int, str, str, str, Decimal, Decimal, int]]:
        total_quantity = func.coalesce(func.sum(InvoiceItem.quantity), ZERO)
        total_revenue = func.coalesce(func.sum(InvoiceItem.line_total), ZERO)
        statement = (
            select(
                InvoiceItem.product_id,
                InvoiceItem.product_code_snapshot,
                InvoiceItem.product_name_snapshot,
                InvoiceItem.unit_type,
                total_quantity.label("total_quantity"),
                total_revenue.label("total_revenue"),
                func.count(func.distinct(Invoice.id)).label("invoice_count"),
            )
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(
                Invoice.invoice_datetime >= start,
                Invoice.invoice_datetime < end,
            )
            .group_by(
                InvoiceItem.product_id,
                InvoiceItem.product_code_snapshot,
                InvoiceItem.product_name_snapshot,
                InvoiceItem.unit_type,
            )
            .order_by(
                total_revenue.desc(),
                total_quantity.desc(),
                InvoiceItem.product_name_snapshot.asc(),
                InvoiceItem.product_id.asc(),
            )
            .limit(limit)
        )
        return [
            (
                int(product_id),
                product_code,
                product_name,
                unit_type,
                quantity or ZERO,
                revenue or ZERO,
                int(invoice_count or 0),
            )
            for product_id, product_code, product_name, unit_type, quantity, revenue, invoice_count in session.execute(statement)
        ]

    def returns_summary_totals(self, session: Session, date_from: date | None, date_to: date | None) -> tuple[Decimal, int]:
        statement = select(func.coalesce(func.sum(ReturnInvoice.total_amount), ZERO), func.count(ReturnInvoice.id))
        statement = self._apply_return_date_range(statement, date_from, date_to)
        total_returns, return_count = session.execute(statement).one()
        return total_returns or ZERO, int(return_count or 0)

    def returns_summary_by_day(self, session: Session, date_from: date | None, date_to: date | None) -> list[tuple[date, int, Decimal]]:
        return_date = func.date(ReturnInvoice.return_datetime)
        statement = (
            select(
                return_date.label("return_date"),
                func.count(ReturnInvoice.id),
                func.coalesce(func.sum(ReturnInvoice.total_amount), ZERO),
            )
            .group_by(return_date)
            .order_by(return_date.asc())
        )
        statement = self._apply_return_date_range(statement, date_from, date_to)
        return [(date.fromisoformat(str(row[0])), int(row[1]), row[2] or ZERO) for row in session.execute(statement)]

    @staticmethod
    def _apply_invoice_date_range(statement, date_from: date | None, date_to: date | None):
        if date_from is not None:
            statement = statement.where(Invoice.invoice_datetime >= _date_start(date_from))
        if date_to is not None:
            statement = statement.where(Invoice.invoice_datetime < _date_start(date_to + timedelta(days=1)))
        return statement

    @staticmethod
    def _apply_return_date_range(statement, date_from: date | None, date_to: date | None):
        if date_from is not None:
            statement = statement.where(ReturnInvoice.return_datetime >= _date_start(date_from))
        if date_to is not None:
            statement = statement.where(ReturnInvoice.return_datetime < _date_start(date_to + timedelta(days=1)))
        return statement


def _date_start(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _day_bounds(value: date) -> tuple[datetime, datetime]:
    start = _date_start(value)
    return start, start + timedelta(days=1)


def _month_bounds(value: date) -> tuple[datetime, datetime]:
    start = _date_start(value.replace(day=1))
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end
