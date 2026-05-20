from __future__ import annotations

from datetime import datetime
from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.sales_service import SalesService
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.sales import Invoice
from app.schemas.sales import (
    InvoiceCreateRequest,
    InvoiceItemInput,
    InvoiceItemResponse,
    InvoiceResponse,
    InvoiceUpdateRequest,
)

router = APIRouter(prefix="/sales", tags=["sales"])
SessionDep = Annotated[Session, Depends(get_session)]
SalesReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]
SalesWriteDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN))]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _item_inputs(payload: InvoiceCreateRequest | InvoiceUpdateRequest) -> tuple[InvoiceItemInput, ...]:
    return tuple(
        InvoiceItemInput(
            product_id=item.product_id,
            unit_type=item.unit_type,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
        )
        for item in payload.items
    )


def _invoice_response(invoice: Invoice) -> InvoiceResponse:
    items = sorted(invoice.items, key=lambda item: item.id or 0)
    return InvoiceResponse(
        id=invoice.id,
        invoice_code=invoice.invoice_code,
        customer_id=invoice.customer_id,
        customer_snapshot_name=invoice.customer_snapshot_name,
        invoice_datetime=invoice.invoice_datetime,
        total_amount=invoice.total_amount,
        paid_amount=invoice.paid_amount,
        payment_method=invoice.payment_method,
        status=invoice.status,
        note=invoice.note,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        items=[
            InvoiceItemResponse(
                id=item.id,
                product_id=item.product_id,
                unit_type=item.unit_type,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
                product_code_snapshot=item.product_code_snapshot,
                product_name_snapshot=item.product_name_snapshot,
            )
            for item in items
        ],
    )


@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    session: SessionDep,
    _: SalesReadDep,
    customer_id: int | None = None,
    search: str = "",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[InvoiceResponse]:
    invoices = SalesService().list_invoices(
        session,
        customer_id=customer_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return [_invoice_response(invoice) for invoice in invoices]


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: InvoiceCreateRequest, session: SessionDep, _: SalesWriteDep) -> InvoiceResponse:
    service = SalesService()

    def operation() -> int:
        invoice = service.create_invoice(
            session,
            customer_id=payload.customer_id,
            invoice_datetime=payload.invoice_datetime,
            items=_item_inputs(payload),
            paid_amount=payload.paid_amount,
            customer_snapshot_name=payload.customer_snapshot_name,
            payment_method=payload.payment_method,
            note=payload.note,
        )
        return invoice.id

    invoice_id = _run_in_transaction(session, operation)
    return _invoice_response(service.get_invoice(session, invoice_id))


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, session: SessionDep, _: SalesReadDep) -> InvoiceResponse:
    return _invoice_response(SalesService().get_invoice(session, invoice_id))


@router.patch("/invoices/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    payload: InvoiceUpdateRequest,
    session: SessionDep,
    _: SalesWriteDep,
) -> InvoiceResponse:
    service = SalesService()

    def operation() -> int:
        current = service.get_invoice(session, invoice_id)
        invoice = service.update_invoice(
            session,
            invoice_id,
            customer_id=payload.customer_id,
            invoice_datetime=payload.invoice_datetime,
            items=_item_inputs(payload),
            paid_amount=current.paid_amount if payload.paid_amount is None else payload.paid_amount,
            customer_snapshot_name=payload.customer_snapshot_name,
            payment_method=payload.payment_method,
            note=payload.note,
        )
        return invoice.id

    updated_id = _run_in_transaction(session, operation)
    return _invoice_response(service.get_invoice(session, updated_id))


@router.delete("/invoices/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_id: int, session: SessionDep, _: SalesWriteDep) -> Response:
    _run_in_transaction(session, lambda: SalesService().delete_invoice(session, invoice_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
