from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.customer_service import CustomerService
from app.domain.customer import OPENING_BALANCE_DATETIME
from app.domain.exceptions import ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import Customer, CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.returns import ReturnInvoice
from app.infrastructure.db.models.sales import Invoice


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def service() -> CustomerService:
    return CustomerService()


def ledger_rows(session: Session, customer_id: int) -> list[CustomerBalanceLedger]:
    return CustomerService()._repository.list_customer_ledgers(session, customer_id)


def test_create_customer_normalizes_optional_fields(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(
        session,
        customer_name="  Nguyen Van A  ",
        phone=" ",
        address="  123 Street  ",
        note="",
    )

    assert customer.customer_name == "Nguyen Van A"
    assert customer.phone is None
    assert customer.address == "123 Street"
    assert customer.note is None
    assert customer.current_balance == Decimal("0")


@pytest.mark.parametrize("opening_balance", ["150000", "-50000"])
def test_create_customer_with_opening_balance_creates_opening_ledger(
    session: Session,
    service: CustomerService,
    opening_balance: str,
) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance=opening_balance)
    ledgers = ledger_rows(session, customer.id)

    assert len(ledgers) == 1
    assert ledgers[0].event_type == "OPENING_BALANCE"
    assert ledgers[0].transaction_datetime == OPENING_BALANCE_DATETIME
    assert ledgers[0].amount_delta == Decimal(opening_balance).quantize(Decimal("0.01"))
    assert customer.current_balance == Decimal(opening_balance).quantize(Decimal("0.01"))


def test_reject_blank_customer_name_and_negative_total_sales(session: Session, service: CustomerService) -> None:
    with pytest.raises(ValidationError):
        service.create_customer(session, customer_name=" ")

    with pytest.raises(ValidationError):
        service.create_customer(session, customer_name="Customer", total_sales="-1")


def test_update_customer_profile_and_clear_note(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Old", note="Keep", total_sales="10")

    updated = service.update_customer(
        session,
        customer.id,
        customer_name="  New  ",
        phone="0909",
        address=" ",
        note=" ",
    )

    assert updated.customer_name == "New"
    assert updated.phone == "0909"
    assert updated.address is None
    assert updated.note is None
    assert updated.total_sales == Decimal("10.00")


def test_adjust_customer_balance_appends_ledger_and_recomputes(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100000")

    result = service.adjust_customer_balance(
        session,
        customer.id,
        target_balance="250000",
        note="manual correction",
        adjustment_datetime=datetime(2026, 5, 19, 10, 0, 0),
    )
    ledgers = ledger_rows(session, customer.id)

    assert result.customer_id == customer.id
    assert result.ledger_id == result.ledger.id
    assert result.ledger.event_type == "BALANCE_ADJUSTMENT"
    assert result.ledger.ref_type == "BALANCE_ADJUSTMENT"
    assert result.ledger.amount_delta == Decimal("150000.00")
    assert result.ledger.balance_after == Decimal("250000.00")
    assert result.ledger.note == "manual correction"
    assert customer.current_balance == Decimal("250000.00")
    assert [row.event_type for row in ledgers] == ["OPENING_BALANCE", "BALANCE_ADJUSTMENT"]


def test_adjust_customer_balance_without_trade_history_uses_opening_datetime(
    session: Session,
    service: CustomerService,
) -> None:
    customer = service.create_customer(session, customer_name="Customer")

    result = service.adjust_customer_balance(session, customer.id, target_balance="-50000")

    assert result.ledger.transaction_datetime == OPENING_BALANCE_DATETIME
    assert result.ledger.amount_delta == Decimal("-50000.00")
    assert customer.current_balance == Decimal("-50000.00")


def test_adjust_customer_balance_rejects_unchanged_target(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100")

    with pytest.raises(ValidationError):
        service.adjust_customer_balance(session, customer.id, target_balance="100")


def test_standalone_debt_payment_reduces_balance(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100000")

    result = service.create_debt_payment(
        session,
        customer.id,
        amount="30000",
        note="cash",
        payment_datetime=datetime(2026, 1, 1, 8, 0, 0),
    )

    assert result.payment_id == result.payment.id
    assert result.ledger.event_type == "DEBT_PAYMENT"
    assert result.ledger.ref_id == result.payment.id
    assert result.ledger.amount_delta == Decimal("-30000.00")
    assert result.payment.amount == Decimal("30000.00")
    assert result.payment.note == "cash"
    assert customer.current_balance == Decimal("70000.00")


@pytest.mark.parametrize("amount", ["0", "-1"])
def test_debt_payment_amount_must_be_positive(
    session: Session,
    service: CustomerService,
    amount: str,
) -> None:
    customer = service.create_customer(session, customer_name="Customer")

    with pytest.raises(ValidationError):
        service.create_debt_payment(session, customer.id, amount=amount)


def test_overpayment_can_make_balance_negative(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100")

    service.create_debt_payment(session, customer.id, amount="150")

    assert customer.current_balance == Decimal("-50.00")


def test_edit_debt_payment_appends_rollback_and_replacement_ledgers(
    session: Session,
    service: CustomerService,
) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100000")
    original = service.create_debt_payment(session, customer.id, amount="30000", note="old")

    replacement = service.edit_debt_payment(session, original.payment_id, amount="40000", note="new")
    ledgers = ledger_rows(session, customer.id)

    assert replacement.ref_id == original.ref_id
    assert replacement.payment.id == original.payment.id
    assert replacement.payment.amount == Decimal("40000.00")
    assert replacement.payment.note == "new"
    assert [row.event_type for row in ledgers] == [
        "OPENING_BALANCE",
        "DEBT_PAYMENT",
        "DEBT_PAYMENT_EDIT_ROLLBACK",
        "DEBT_PAYMENT",
    ]
    assert [row.amount_delta for row in ledgers[1:]] == [
        Decimal("-30000.00"),
        Decimal("30000.00"),
        Decimal("-40000.00"),
    ]
    assert customer.current_balance == Decimal("60000.00")


def test_delete_debt_payment_removes_all_ledgers_for_reference_and_recomputes(
    session: Session,
    service: CustomerService,
) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="100000")
    original = service.create_debt_payment(session, customer.id, amount="30000")
    service.edit_debt_payment(session, original.payment_id, amount="40000")

    service.delete_debt_payment(session, original.payment_id)
    ledgers = ledger_rows(session, customer.id)
    payment = session.get(DebtPayment, original.payment_id)

    assert [row.event_type for row in ledgers] == ["OPENING_BALANCE"]
    assert payment.is_deleted is True
    assert customer.current_balance == Decimal("100000.00")


def test_unused_customer_hard_deletes(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer")

    result = service.delete_customer(session, customer.id)

    assert result.action == "hard_deleted"
    assert session.get(Customer, customer.id) is None


def test_customer_with_ledger_history_deactivates(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer", opening_balance="1")

    result = service.delete_customer(session, customer.id)

    assert result.action == "deactivated"
    assert customer.is_active is False


def test_customer_with_invoice_history_deactivates_without_ledger(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer")
    session.add(
        Invoice(
            invoice_code="HD-HISTORY",
            customer_id=customer.id,
            customer_snapshot_name=customer.customer_name,
            invoice_datetime=datetime(2026, 5, 19, 8, 0, 0),
            total_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            status="COMPLETED",
        )
    )
    session.flush()

    result = service.delete_customer(session, customer.id)

    assert result.action == "deactivated"
    assert customer.is_active is False


def test_customer_with_return_history_deactivates_without_ledger(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer")
    session.add(
        ReturnInvoice(
            return_code="TR-HISTORY",
            customer_id=customer.id,
            customer_snapshot_name=customer.customer_name,
            is_quick_return=True,
            return_datetime=datetime(2026, 5, 19, 8, 0, 0),
            total_amount=Decimal("0.00"),
            handling_mode="REFUND_NOW",
        )
    )
    session.flush()

    result = service.delete_customer(session, customer.id)

    assert result.action == "deactivated"
    assert customer.is_active is False


def test_customer_with_debt_payment_history_deactivates_without_ledger(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer")
    session.add(
        DebtPayment(
            customer_id=customer.id,
            amount=Decimal("100.00"),
            payment_datetime=datetime(2026, 5, 19, 8, 0, 0),
            is_deleted=True,
        )
    )
    session.flush()

    result = service.delete_customer(session, customer.id)

    assert result.action == "deactivated"
    assert customer.is_active is False


def test_ledger_recompute_order_by_datetime_display_order_id(session: Session, service: CustomerService) -> None:
    customer = service.create_customer(session, customer_name="Customer")
    rows = [
        CustomerBalanceLedger(
            customer_id=customer.id,
            event_type="MANUAL",
            ref_type="MANUAL",
            ref_id=1,
            amount_delta=Decimal("10.00"),
            balance_after=Decimal("0.00"),
            transaction_datetime=datetime(2026, 1, 2, 8, 0, 0),
            display_order=0,
        ),
        CustomerBalanceLedger(
            customer_id=customer.id,
            event_type="MANUAL",
            ref_type="MANUAL",
            ref_id=2,
            amount_delta=Decimal("5.00"),
            balance_after=Decimal("0.00"),
            transaction_datetime=datetime(2026, 1, 1, 8, 0, 0),
            display_order=10,
        ),
        CustomerBalanceLedger(
            customer_id=customer.id,
            event_type="MANUAL",
            ref_type="MANUAL",
            ref_id=3,
            amount_delta=Decimal("3.00"),
            balance_after=Decimal("0.00"),
            transaction_datetime=datetime(2026, 1, 1, 8, 0, 0),
            display_order=20,
        ),
    ]
    session.add_all(rows)
    session.flush()

    balance = service.recompute_customer_balance(session, customer.id)
    ordered = ledger_rows(session, customer.id)

    assert [row.ref_id for row in ordered] == [2, 3, 1]
    assert [row.balance_after for row in ordered] == [Decimal("5.00"), Decimal("8.00"), Decimal("18.00")]
    assert balance == Decimal("18.00")


def test_list_customers_filters_inactive_and_positive_debt(session: Session, service: CustomerService) -> None:
    active = service.create_customer(session, customer_name="Active", opening_balance="10")
    zero = service.create_customer(session, customer_name="Zero")
    inactive = service.create_customer(session, customer_name="Inactive", opening_balance="5")
    inactive.is_active = False
    session.flush()

    assert {customer.id for customer in service.list_customers(session)} == {active.id, zero.id}
    assert {customer.id for customer in service.list_customers(session, only_positive_debt=True)} == {active.id}
    assert {customer.id for customer in service.list_customers(session, include_inactive=True)} == {
        active.id,
        zero.id,
        inactive.id,
    }


def test_list_customers_searches_name_and_phone(session: Session, service: CustomerService) -> None:
    by_name = service.create_customer(session, customer_name="Nguyen Van A", phone="0901000001")
    by_phone = service.create_customer(session, customer_name="Tran B", phone="0902000002")

    assert [customer.id for customer in service.list_customers(session, search="nguyen")] == [by_name.id]
    assert [customer.id for customer in service.list_customers(session, search="090200")] == [by_phone.id]
