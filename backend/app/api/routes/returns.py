from __future__ import annotations

from datetime import datetime
from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.return_service import ReturnService
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.returns import ReturnInvoice
from app.schemas.returns import (
    ReturnCreateRequest,
    ReturnItemInput,
    ReturnItemResponse,
    ReturnResponse,
    ReturnUpdateRequest,
)

router = APIRouter(prefix="/returns", tags=["returns"])
SessionDep = Annotated[Session, Depends(get_session)]
ReturnsReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]
ReturnsWriteDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN))]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _item_inputs(payload: ReturnCreateRequest | ReturnUpdateRequest) -> tuple[ReturnItemInput, ...]:
    return tuple(
        ReturnItemInput(
            product_id=item.product_id,
            unit_type=item.unit_type,
            quantity=item.quantity,
            unit_price=item.unit_price,
            line_total=item.line_total,
            source_invoice_item_id=item.source_invoice_item_id,
        )
        for item in payload.items
    )


def _return_response(return_invoice: ReturnInvoice) -> ReturnResponse:
    items = sorted(return_invoice.items, key=lambda item: item.id or 0)
    return ReturnResponse(
        id=return_invoice.id,
        return_code=return_invoice.return_code,
        source_invoice_id=return_invoice.source_invoice_id,
        customer_id=return_invoice.customer_id,
        customer_snapshot_name=return_invoice.customer_snapshot_name,
        is_quick_return=return_invoice.is_quick_return,
        return_datetime=return_invoice.return_datetime,
        total_amount=return_invoice.total_amount,
        handling_mode=return_invoice.handling_mode,
        note=return_invoice.note,
        created_at=return_invoice.created_at,
        updated_at=return_invoice.updated_at,
        items=[
            ReturnItemResponse(
                id=item.id,
                source_invoice_item_id=item.source_invoice_item_id,
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


@router.get("", response_model=list[ReturnResponse])
def list_returns(
    session: SessionDep,
    _: ReturnsReadDep,
    customer_id: int | None = None,
    search: str = "",
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[ReturnResponse]:
    return_invoices = ReturnService().list_returns(
        session,
        customer_id=customer_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return [_return_response(return_invoice) for return_invoice in return_invoices]


@router.post("", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
def create_return(payload: ReturnCreateRequest, session: SessionDep, _: ReturnsWriteDep) -> ReturnResponse:
    service = ReturnService()

    def operation() -> int:
        return_invoice = service.create_return(
            session,
            source_invoice_id=payload.source_invoice_id,
            customer_id=payload.customer_id,
            customer_snapshot_name=payload.customer_snapshot_name,
            return_datetime=payload.return_datetime,
            handling_mode=payload.handling_mode,
            items=_item_inputs(payload),
            note=payload.note,
        )
        return return_invoice.id

    return_id = _run_in_transaction(session, operation)
    return _return_response(service.get_return(session, return_id))


@router.get("/{return_id}", response_model=ReturnResponse)
def get_return(return_id: int, session: SessionDep, _: ReturnsReadDep) -> ReturnResponse:
    return _return_response(ReturnService().get_return(session, return_id))


@router.patch("/{return_id}", response_model=ReturnResponse)
def update_return(
    return_id: int,
    payload: ReturnUpdateRequest,
    session: SessionDep,
    _: ReturnsWriteDep,
) -> ReturnResponse:
    service = ReturnService()

    def operation() -> int:
        return_invoice = service.update_return(
            session,
            return_id,
            source_invoice_id=payload.source_invoice_id,
            customer_id=payload.customer_id,
            customer_snapshot_name=payload.customer_snapshot_name,
            return_datetime=payload.return_datetime,
            handling_mode=payload.handling_mode,
            items=_item_inputs(payload),
            note=payload.note,
        )
        return return_invoice.id

    updated_id = _run_in_transaction(session, operation)
    return _return_response(service.get_return(session, updated_id))


@router.delete("/{return_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_return(return_id: int, session: SessionDep, _: ReturnsWriteDep) -> Response:
    _run_in_transaction(session, lambda: ReturnService().delete_return(session, return_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
