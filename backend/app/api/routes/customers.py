from __future__ import annotations

from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.customer_service import BalanceAdjustmentResult, CustomerService, DebtPaymentResult
from app.domain.auth import UserRole
from app.domain.exceptions import NotFoundError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.customer import CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.repositories.customer import CustomerRepository
from app.schemas.customers import (
    BalanceAdjustmentRequest,
    BalanceAdjustmentResponse,
    CustomerCreateRequest,
    CustomerDeleteResponse,
    CustomerLedgerResponse,
    CustomerResponse,
    CustomerUpdateRequest,
    DebtPaymentRequest,
    DebtPaymentResponse,
    DebtPaymentResultResponse,
)

router = APIRouter(prefix="/customers", tags=["customers"])
SessionDep = Annotated[Session, Depends(get_session)]
CustomerReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]
CustomerWriteDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN))]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _ledger_response(ledger: CustomerBalanceLedger) -> CustomerLedgerResponse:
    return CustomerLedgerResponse.model_validate(ledger)


def _debt_payment_response(payment: DebtPayment) -> DebtPaymentResponse:
    return DebtPaymentResponse.model_validate(payment)


def _debt_payment_result_response(result: DebtPaymentResult, current_balance) -> DebtPaymentResultResponse:
    return DebtPaymentResultResponse(
        payment=_debt_payment_response(result.payment),
        ledger=_ledger_response(result.ledger) if result.ledger is not None else None,
        current_balance=current_balance,
    )


def _balance_adjustment_response(result: BalanceAdjustmentResult) -> BalanceAdjustmentResponse:
    return BalanceAdjustmentResponse(
        customer=CustomerResponse.model_validate(result.customer),
        ledger=_ledger_response(result.ledger),
    )


def _ensure_payment_belongs_to_customer(session: Session, customer_id: int, payment_id: int) -> None:
    payment = CustomerRepository().get_debt_payment_for_update(session, payment_id)
    if payment.customer_id != customer_id:
        raise NotFoundError(f"Debt payment {payment_id} was not found for customer {customer_id}.")


@router.get("", response_model=list[CustomerResponse])
def list_customers(
    session: SessionDep,
    _: CustomerReadDep,
    include_inactive: bool = False,
    search: str = "",
    only_positive_debt: bool = False,
) -> list[CustomerResponse]:
    customers = CustomerService().list_customers(
        session,
        include_inactive=include_inactive,
        search=search,
        only_positive_debt=only_positive_debt,
    )
    return [CustomerResponse.model_validate(customer) for customer in customers]


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreateRequest, session: SessionDep, _: CustomerWriteDep) -> CustomerResponse:
    service = CustomerService()

    def operation() -> int:
        customer = service.create_customer(
            session,
            customer_name=payload.customer_name,
            phone=payload.phone,
            address=payload.address,
            note=payload.note,
            opening_balance=payload.opening_balance,
            total_sales=payload.total_sales,
        )
        return customer.id

    customer_id = _run_in_transaction(session, operation)
    return CustomerResponse.model_validate(service.get_customer(session, customer_id))


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, session: SessionDep, _: CustomerReadDep) -> CustomerResponse:
    return CustomerResponse.model_validate(CustomerService().get_customer(session, customer_id))


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    payload: CustomerUpdateRequest,
    session: SessionDep,
    _: CustomerWriteDep,
) -> CustomerResponse:
    service = CustomerService()

    def operation() -> int:
        customer = service.update_customer(
            session,
            customer_id,
            customer_name=payload.customer_name,
            phone=payload.phone,
            address=payload.address,
            note=payload.note,
            total_sales=payload.total_sales,
        )
        return customer.id

    updated_id = _run_in_transaction(session, operation)
    return CustomerResponse.model_validate(service.get_customer(session, updated_id))


@router.delete("/{customer_id}", response_model=CustomerDeleteResponse)
def delete_customer(customer_id: int, session: SessionDep, _: CustomerWriteDep) -> CustomerDeleteResponse:
    result = _run_in_transaction(session, lambda: CustomerService().delete_customer(session, customer_id))
    return CustomerDeleteResponse(customer_id=result.customer_id, action=result.action)


@router.post(
    "/{customer_id}/balance-adjustments",
    response_model=BalanceAdjustmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_balance_adjustment(
    customer_id: int,
    payload: BalanceAdjustmentRequest,
    session: SessionDep,
    _: CustomerWriteDep,
) -> BalanceAdjustmentResponse:
    service = CustomerService()

    def operation() -> tuple[int, int]:
        result = service.adjust_customer_balance(
            session,
            customer_id,
            target_balance=payload.target_balance,
            note=payload.note,
            adjustment_datetime=payload.adjustment_datetime,
        )
        return result.customer_id, result.ledger_id

    adjusted_customer_id, ledger_id = _run_in_transaction(session, operation)
    customer = service.get_customer(session, adjusted_customer_id)
    ledger = CustomerRepository().get_ledger(session, ledger_id)
    return _balance_adjustment_response(BalanceAdjustmentResult(customer=customer, ledger=ledger))


@router.get("/{customer_id}/ledger", response_model=list[CustomerLedgerResponse])
def list_customer_ledger(customer_id: int, session: SessionDep, _: CustomerReadDep) -> list[CustomerLedgerResponse]:
    CustomerService().get_customer(session, customer_id)
    ledgers = CustomerRepository().list_customer_ledgers(session, customer_id)
    return [_ledger_response(ledger) for ledger in ledgers]


@router.get("/{customer_id}/debt-payments", response_model=list[DebtPaymentResponse])
def list_debt_payments(customer_id: int, session: SessionDep, _: CustomerReadDep) -> list[DebtPaymentResponse]:
    CustomerService().get_customer(session, customer_id)
    payments = CustomerRepository().list_debt_payments(session, customer_id)
    return [_debt_payment_response(payment) for payment in payments]


@router.post("/{customer_id}/debt-payments", response_model=DebtPaymentResultResponse, status_code=status.HTTP_201_CREATED)
def create_debt_payment(
    customer_id: int,
    payload: DebtPaymentRequest,
    session: SessionDep,
    _: CustomerWriteDep,
) -> DebtPaymentResultResponse:
    service = CustomerService()

    def operation() -> tuple[int, int]:
        result = service.create_debt_payment(
            session,
            customer_id,
            amount=payload.amount,
            payment_datetime=payload.payment_datetime,
            note=payload.note,
        )
        return result.payment_id, result.ledger_id or 0

    payment_id, ledger_id = _run_in_transaction(session, operation)
    payment = CustomerRepository().get_debt_payment_for_update(session, payment_id)
    ledger = session.get(CustomerBalanceLedger, ledger_id) if ledger_id else None
    customer = service.get_customer(session, customer_id)
    return _debt_payment_result_response(DebtPaymentResult(payment=payment, ledger=ledger), customer.current_balance)


@router.patch("/{customer_id}/debt-payments/{payment_id}", response_model=DebtPaymentResultResponse)
def update_debt_payment(
    customer_id: int,
    payment_id: int,
    payload: DebtPaymentRequest,
    session: SessionDep,
    _: CustomerWriteDep,
) -> DebtPaymentResultResponse:
    service = CustomerService()

    def operation() -> tuple[int, int]:
        _ensure_payment_belongs_to_customer(session, customer_id, payment_id)
        result = service.edit_debt_payment(
            session,
            payment_id,
            amount=payload.amount,
            payment_datetime=payload.payment_datetime,
            note=payload.note,
        )
        return result.payment_id, result.ledger_id or 0

    updated_payment_id, ledger_id = _run_in_transaction(session, operation)
    payment = CustomerRepository().get_debt_payment_for_update(session, updated_payment_id)
    ledger = session.get(CustomerBalanceLedger, ledger_id) if ledger_id else None
    customer = service.get_customer(session, customer_id)
    return _debt_payment_result_response(DebtPaymentResult(payment=payment, ledger=ledger), customer.current_balance)


@router.delete("/{customer_id}/debt-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt_payment(customer_id: int, payment_id: int, session: SessionDep, _: CustomerWriteDep) -> Response:
    def operation() -> None:
        _ensure_payment_belongs_to_customer(session, customer_id, payment_id)
        CustomerService().delete_debt_payment(session, payment_id)

    _run_in_transaction(session, operation)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
