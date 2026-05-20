from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from threading import Lock
from time import time_ns

from sqlalchemy.orm import Session

from app.domain.customer import OPENING_BALANCE_DATETIME, normalize_customer_name, normalize_optional_text
from app.domain.exceptions import NotFoundError, ValidationError
from app.domain.money import require_non_negative_money, require_positive_money, to_money
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.repositories.customer import CustomerRepository


@dataclass(frozen=True, slots=True)
class CustomerDeleteResult:
    customer_id: int
    action: str


@dataclass(frozen=True, slots=True)
class DebtPaymentResult:
    payment: DebtPayment
    ledger: CustomerBalanceLedger | None

    @property
    def payment_id(self) -> int:
        return self.payment.id

    @property
    def ledger_id(self) -> int | None:
        return self.ledger.id if self.ledger is not None else None

    @property
    def ref_id(self) -> int:
        return self.payment.id


@dataclass(frozen=True, slots=True)
class BalanceAdjustmentResult:
    customer: Customer
    ledger: CustomerBalanceLedger

    @property
    def customer_id(self) -> int:
        return self.customer.id

    @property
    def ledger_id(self) -> int:
        return self.ledger.id


_REF_ID_LOCK = Lock()
_LAST_GENERATED_REF_ID = 0


class CustomerService:
    def __init__(self, repository: CustomerRepository | None = None) -> None:
        self._repository = repository or CustomerRepository()

    def create_customer(
        self,
        session: Session,
        *,
        customer_name: str,
        phone: str | None = None,
        address: str | None = None,
        note: str | None = None,
        opening_balance: Decimal | int | str = Decimal("0"),
        total_sales: Decimal | int | str = Decimal("0"),
    ) -> Customer:
        normalized_total_sales = require_non_negative_money(total_sales, "total_sales")
        normalized_opening_balance = to_money(opening_balance)
        customer = Customer(
            customer_name=normalize_customer_name(customer_name),
            phone=normalize_optional_text(phone),
            address=normalize_optional_text(address),
            note=normalize_optional_text(note),
            current_balance=Decimal("0"),
            total_sales=normalized_total_sales,
            is_walk_in=False,
            is_active=True,
        )
        self._repository.add_customer(session, customer)
        session.flush()

        if normalized_opening_balance != Decimal("0"):
            self._append_balance_ledger(
                session,
                customer,
                amount_delta=normalized_opening_balance,
                event_type="OPENING_BALANCE",
                ref_type="OPENING_BALANCE",
                ref_id=customer.id,
                note="Opening balance",
                transaction_datetime=OPENING_BALANCE_DATETIME,
            )
            session.flush()
            self.recompute_customer_balance(session, customer.id)
        session.flush()
        return customer

    def adjust_customer_balance(
        self,
        session: Session,
        customer_id: int,
        *,
        target_balance: Decimal | int | str,
        note: str | None = None,
        adjustment_datetime: datetime | None = None,
    ) -> BalanceAdjustmentResult:
        customer = self._repository.get_customer_for_update(session, customer_id)
        normalized_target = to_money(target_balance)
        amount_delta = normalized_target - customer.current_balance
        if amount_delta == Decimal("0"):
            raise ValidationError("Target balance is unchanged.")
        effective_datetime = adjustment_datetime
        if effective_datetime is None and not self._repository.customer_has_trade_or_debt_history(session, customer.id):
            effective_datetime = OPENING_BALANCE_DATETIME

        ledger = self._append_balance_ledger(
            session,
            customer,
            amount_delta=amount_delta,
            event_type="BALANCE_ADJUSTMENT",
            ref_type="BALANCE_ADJUSTMENT",
            ref_id=self._generate_ref_id(),
            note=normalize_optional_text(note) or "Balance adjustment",
            transaction_datetime=effective_datetime,
        )
        session.flush()
        self.recompute_customer_balance(session, customer.id)
        return BalanceAdjustmentResult(customer=customer, ledger=ledger)

    def update_customer(
        self,
        session: Session,
        customer_id: int,
        *,
        customer_name: str,
        phone: str | None = None,
        address: str | None = None,
        note: str | None = None,
        total_sales: Decimal | int | str | None = None,
    ) -> Customer:
        customer = self._repository.get_customer_for_update(session, customer_id)
        customer.customer_name = normalize_customer_name(customer_name)
        customer.phone = normalize_optional_text(phone)
        customer.address = normalize_optional_text(address)
        customer.note = normalize_optional_text(note)
        if total_sales is not None:
            customer.total_sales = require_non_negative_money(total_sales, "total_sales")
        session.flush()
        return customer

    def delete_customer(self, session: Session, customer_id: int) -> CustomerDeleteResult:
        customer = self._repository.get_customer_for_update(session, customer_id)
        if self._repository.customer_has_history(session, customer_id):
            customer.is_active = False
            session.flush()
            return CustomerDeleteResult(customer_id=customer.id, action="deactivated")

        session.delete(customer)
        session.flush()
        return CustomerDeleteResult(customer_id=customer_id, action="hard_deleted")

    def list_customers(
        self,
        session: Session,
        *,
        include_inactive: bool = False,
        search: str = "",
        only_positive_debt: bool = False,
    ) -> list[Customer]:
        return self._repository.list_customers(
            session,
            include_inactive=include_inactive,
            search=search,
            only_positive_debt=only_positive_debt,
        )

    def get_customer(self, session: Session, customer_id: int) -> Customer:
        return self._repository.get_customer(session, customer_id)

    def create_debt_payment(
        self,
        session: Session,
        customer_id: int,
        *,
        amount: Decimal | int | str,
        note: str | None = None,
        payment_datetime: datetime | None = None,
    ) -> DebtPaymentResult:
        customer = self._repository.get_customer_for_update(session, customer_id)
        normalized_amount = require_positive_money(amount, "amount")
        debt_payment = DebtPayment(
            customer_id=customer.id,
            amount=normalized_amount,
            payment_datetime=payment_datetime or datetime.now(),
            note=normalize_optional_text(note),
            is_deleted=False,
        )
        self._repository.add_debt_payment(session, debt_payment)
        session.flush()
        ledger = self._append_balance_ledger(
            session,
            customer,
            amount_delta=normalized_amount * Decimal("-1"),
            event_type="DEBT_PAYMENT",
            ref_type="DEBT_PAYMENT",
            ref_id=debt_payment.id,
            note=normalize_optional_text(note),
            transaction_datetime=debt_payment.payment_datetime,
            display_order=30,
        )
        session.flush()
        self.recompute_customer_balance(session, customer.id)
        return DebtPaymentResult(payment=debt_payment, ledger=ledger)

    def edit_debt_payment(
        self,
        session: Session,
        debt_payment_id: int,
        *,
        amount: Decimal | int | str,
        note: str | None = None,
        payment_datetime: datetime | None = None,
    ) -> DebtPaymentResult:
        debt_payment = self._repository.get_debt_payment_for_update(session, debt_payment_id)
        customer = self._repository.get_customer_for_update(session, debt_payment.customer_id)
        existing_ledgers = self._repository.list_debt_payment_ledgers_for_update(
            session,
            customer.id,
            debt_payment.id,
        )
        selected_ledger = self._latest_effective_debt_payment_ledger(existing_ledgers)
        normalized_amount = require_positive_money(amount, "amount")
        effective_datetime = payment_datetime or debt_payment.payment_datetime

        self._append_balance_ledger(
            session,
            customer,
            amount_delta=selected_ledger.amount_delta * Decimal("-1"),
            event_type="DEBT_PAYMENT_EDIT_ROLLBACK",
            ref_type="DEBT_PAYMENT",
            ref_id=debt_payment.id,
            note=f"Rollback debt payment {debt_payment.id}",
            transaction_datetime=effective_datetime,
            source_ref_type=selected_ledger.source_ref_type,
            source_ref_id=selected_ledger.source_ref_id,
            display_order=selected_ledger.display_order,
        )
        debt_payment.amount = normalized_amount
        debt_payment.payment_datetime = effective_datetime
        debt_payment.note = normalize_optional_text(note)
        replacement = self._append_balance_ledger(
            session,
            customer,
            amount_delta=normalized_amount * Decimal("-1"),
            event_type="DEBT_PAYMENT",
            ref_type="DEBT_PAYMENT",
            ref_id=debt_payment.id,
            note=debt_payment.note,
            transaction_datetime=effective_datetime,
            source_ref_type=selected_ledger.source_ref_type,
            source_ref_id=selected_ledger.source_ref_id,
            display_order=selected_ledger.display_order,
        )
        session.flush()
        self.recompute_customer_balance(session, customer.id)
        return DebtPaymentResult(payment=debt_payment, ledger=replacement)

    def delete_debt_payment(self, session: Session, debt_payment_id: int) -> None:
        debt_payment = self._repository.get_debt_payment_for_update(session, debt_payment_id)
        customer = self._repository.get_customer_for_update(session, debt_payment.customer_id)
        ledgers = self._repository.list_debt_payment_ledgers_for_update(session, customer.id, debt_payment.id)
        if not ledgers:
            raise NotFoundError(f"Debt payment {debt_payment.id} ledger rows were not found.")
        for ledger in ledgers:
            session.delete(ledger)
        debt_payment.is_deleted = True
        session.flush()
        self.recompute_customer_balance(session, customer.id)

    def recompute_customer_balance(self, session: Session, customer_id: int) -> Decimal:
        customer = self._repository.get_customer_for_update(session, customer_id)
        running_balance = Decimal("0")
        ledgers = self._repository.list_customer_ledgers_for_update(session, customer_id)
        for ledger in ledgers:
            running_balance += ledger.amount_delta
            ledger.balance_after = running_balance
        customer.current_balance = running_balance
        session.flush()
        return running_balance

    def _append_balance_ledger(
        self,
        session: Session,
        customer: Customer,
        *,
        amount_delta: Decimal,
        event_type: str,
        ref_type: str,
        ref_id: int,
        note: str | None,
        transaction_datetime: datetime | None = None,
        source_ref_type: str | None = None,
        source_ref_id: int | None = None,
        display_order: int = 0,
    ) -> CustomerBalanceLedger:
        ledger = CustomerBalanceLedger(
            customer_id=customer.id,
            event_type=event_type,
            ref_type=ref_type,
            ref_id=int(ref_id),
            source_ref_type=source_ref_type,
            source_ref_id=source_ref_id,
            display_order=display_order,
            amount_delta=amount_delta,
            balance_after=customer.current_balance + amount_delta,
            transaction_datetime=transaction_datetime or datetime.now(),
            note=note,
        )
        customer.current_balance = ledger.balance_after
        session.add(ledger)
        return ledger

    def _latest_effective_debt_payment_ledger(
        self,
        ledgers: list[CustomerBalanceLedger],
    ) -> CustomerBalanceLedger:
        payment_ledgers = [ledger for ledger in ledgers if ledger.event_type == "DEBT_PAYMENT"]
        if not payment_ledgers:
            raise NotFoundError("Debt payment ledger rows were not found.")
        return payment_ledgers[-1]

    @staticmethod
    def _generate_ref_id() -> int:
        global _LAST_GENERATED_REF_ID
        with _REF_ID_LOCK:
            generated = time_ns()
            if generated <= _LAST_GENERATED_REF_ID:
                generated = _LAST_GENERATED_REF_ID + 1
            _LAST_GENERATED_REF_ID = generated
            return generated
