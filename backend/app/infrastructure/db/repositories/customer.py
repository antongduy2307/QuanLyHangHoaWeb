from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment


class CustomerRepository:
    def get_customer(self, session: Session, customer_id: int) -> Customer:
        customer = session.get(Customer, customer_id)
        if customer is None:
            raise NotFoundError(f"Customer {customer_id} was not found.")
        return customer

    def get_customer_for_update(self, session: Session, customer_id: int) -> Customer:
        statement = select(Customer).where(Customer.id == customer_id).with_for_update()
        customer = session.scalars(statement).one_or_none()
        if customer is None:
            raise NotFoundError(f"Customer {customer_id} was not found.")
        return customer

    def list_customers(
        self,
        session: Session,
        *,
        include_inactive: bool = False,
        search: str = "",
        only_positive_debt: bool = False,
    ) -> list[Customer]:
        statement = select(Customer).order_by(Customer.customer_name.asc(), Customer.id.asc())
        if not include_inactive:
            statement = statement.where(Customer.is_active.is_(True))
        needle = search.strip()
        if needle:
            statement = statement.where(Customer.customer_name.ilike(f"%{needle}%"))
        if only_positive_debt:
            statement = statement.where(Customer.current_balance > 0)
        return list(session.scalars(statement).all())

    def add_customer(self, session: Session, customer: Customer) -> None:
        session.add(customer)

    def get_ledger(self, session: Session, ledger_id: int) -> CustomerBalanceLedger:
        statement = (
            select(CustomerBalanceLedger)
            .options(selectinload(CustomerBalanceLedger.customer))
            .where(CustomerBalanceLedger.id == ledger_id)
        )
        ledger = session.scalars(statement).one_or_none()
        if ledger is None:
            raise NotFoundError(f"Customer ledger {ledger_id} was not found.")
        return ledger

    def list_customer_ledgers(self, session: Session, customer_id: int) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .order_by(
                CustomerBalanceLedger.transaction_datetime.asc(),
                CustomerBalanceLedger.display_order.asc(),
                CustomerBalanceLedger.id.asc(),
            )
        )
        return list(session.scalars(statement).all())

    def list_customer_ledgers_for_update(self, session: Session, customer_id: int) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .order_by(
                CustomerBalanceLedger.transaction_datetime.asc(),
                CustomerBalanceLedger.display_order.asc(),
                CustomerBalanceLedger.id.asc(),
            )
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def find_debt_payment_ledgers(self, session: Session, customer_id: int, ref_id: int) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .where(CustomerBalanceLedger.ref_type == "DEBT_PAYMENT")
            .where(CustomerBalanceLedger.ref_id == ref_id)
            .order_by(CustomerBalanceLedger.id.asc())
        )
        return list(session.scalars(statement).all())

    def list_debt_payment_ledgers_for_update(
        self,
        session: Session,
        customer_id: int,
        debt_payment_id: int,
    ) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .where(CustomerBalanceLedger.ref_type == "DEBT_PAYMENT")
            .where(CustomerBalanceLedger.ref_id == debt_payment_id)
            .order_by(CustomerBalanceLedger.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def add_debt_payment(self, session: Session, debt_payment: DebtPayment) -> None:
        session.add(debt_payment)

    def get_debt_payment_for_update(
        self,
        session: Session,
        debt_payment_id: int,
        *,
        include_deleted: bool = False,
    ) -> DebtPayment:
        statement = select(DebtPayment).where(DebtPayment.id == debt_payment_id).with_for_update()
        if not include_deleted:
            statement = statement.where(DebtPayment.is_deleted.is_(False))
        debt_payment = session.scalars(statement).one_or_none()
        if debt_payment is None:
            raise NotFoundError(f"Debt payment {debt_payment_id} was not found.")
        return debt_payment

    def list_debt_payments(
        self,
        session: Session,
        customer_id: int,
        *,
        include_deleted: bool = False,
    ) -> list[DebtPayment]:
        statement = (
            select(DebtPayment)
            .where(DebtPayment.customer_id == customer_id)
            .order_by(DebtPayment.payment_datetime.asc(), DebtPayment.id.asc())
        )
        if not include_deleted:
            statement = statement.where(DebtPayment.is_deleted.is_(False))
        return list(session.scalars(statement).all())

    def list_ledgers_by_source_for_update(
        self,
        session: Session,
        customer_id: int,
        source_ref_type: str,
        source_ref_id: int,
    ) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .where(CustomerBalanceLedger.source_ref_type == source_ref_type)
            .where(CustomerBalanceLedger.source_ref_id == source_ref_id)
            .order_by(CustomerBalanceLedger.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def list_ledgers_by_ref_for_update(
        self,
        session: Session,
        customer_id: int,
        ref_type: str,
        ref_id: int,
    ) -> list[CustomerBalanceLedger]:
        statement = (
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .where(CustomerBalanceLedger.ref_type == ref_type)
            .where(CustomerBalanceLedger.ref_id == ref_id)
            .order_by(CustomerBalanceLedger.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def customer_has_history(self, session: Session, customer_id: int) -> bool:
        statement = select(CustomerBalanceLedger.id).where(CustomerBalanceLedger.customer_id == customer_id).limit(1)
        return session.scalar(statement) is not None
