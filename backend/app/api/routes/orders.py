from __future__ import annotations

from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.order_service import OrderService
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.models.orders import OrderRequest
from app.schemas.orders import (
    OrderConvertedRequest,
    OrderCreateRequest,
    OrderItemInput,
    OrderItemResponse,
    OrderPreparedRequest,
    OrderQuantitySummaryResponse,
    OrderResponse,
    OrderUpdateRequest,
)

router = APIRouter(prefix="/orders", tags=["orders"])
SessionDep = Annotated[Session, Depends(get_session)]
OrdersReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]
OrdersWriteDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN))]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _item_inputs(payload: OrderCreateRequest | OrderUpdateRequest) -> tuple[OrderItemInput, ...]:
    return tuple(
        OrderItemInput(
            product_id=item.product_id,
            unit_type=item.unit_type,
            quantity=item.quantity,
        )
        for item in payload.items
    )


def _order_response(order: OrderRequest) -> OrderResponse:
    items = sorted(order.items, key=lambda item: item.id or 0)
    return OrderResponse(
        id=order.id,
        order_code=order.order_code,
        customer_id=order.customer_id,
        customer_name_snapshot=order.customer_name_snapshot,
        order_datetime=order.order_datetime,
        required_delivery_datetime=order.required_delivery_datetime,
        note=order.note,
        status=order.status,
        source_invoice_id=order.source_invoice_id,
        completed_at=order.completed_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[
            OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name_snapshot=item.product_name_snapshot,
                unit_type=item.unit_type,
                quantity=item.quantity,
                created_at=item.created_at,
            )
            for item in items
        ],
    )


@router.get("/quantity-summary", response_model=list[OrderQuantitySummaryResponse])
def list_order_quantity_summary(session: SessionDep, _: OrdersReadDep) -> list[OrderQuantitySummaryResponse]:
    rows = OrderService().list_active_quantity_summary(session)
    return [
        OrderQuantitySummaryResponse(
            product_id=row.product_id,
            product_name=row.product_name,
            unit_type=row.unit_type,
            quantity=row.quantity,
            stock_available=row.stock_available,
        )
        for row in rows
    ]


@router.get("", response_model=list[OrderResponse])
def list_orders(session: SessionDep, _: OrdersReadDep) -> list[OrderResponse]:
    orders = OrderService().list_active_orders(session)
    return [_order_response(order) for order in orders]


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreateRequest, session: SessionDep, _: OrdersWriteDep) -> OrderResponse:
    service = OrderService()

    def operation() -> int:
        order = service.create_order(
            session,
            customer_id=payload.customer_id,
            customer_snapshot_name=payload.customer_snapshot_name,
            order_datetime=payload.order_datetime,
            required_delivery_datetime=payload.required_delivery_datetime,
            items=_item_inputs(payload),
            note=payload.note,
        )
        return order.id

    order_id = _run_in_transaction(session, operation)
    return _order_response(service.get_order(session, order_id))


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, session: SessionDep, _: OrdersReadDep) -> OrderResponse:
    return _order_response(OrderService().get_order(session, order_id))


@router.patch("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    payload: OrderUpdateRequest,
    session: SessionDep,
    _: OrdersWriteDep,
) -> OrderResponse:
    service = OrderService()

    def operation() -> int:
        order = service.update_order(
            session,
            order_id,
            customer_id=payload.customer_id,
            customer_snapshot_name=payload.customer_snapshot_name,
            order_datetime=payload.order_datetime,
            required_delivery_datetime=payload.required_delivery_datetime,
            items=_item_inputs(payload),
            note=payload.note,
        )
        return order.id

    updated_id = _run_in_transaction(session, operation)
    return _order_response(service.get_order(session, updated_id))


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, session: SessionDep, _: OrdersWriteDep) -> Response:
    _run_in_transaction(session, lambda: OrderService().delete_order(session, order_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{order_id}/prepared", response_model=OrderResponse)
def mark_order_prepared(
    order_id: int,
    payload: OrderPreparedRequest,
    session: SessionDep,
    _: OrdersWriteDep,
) -> OrderResponse:
    service = OrderService()
    updated_id = _run_in_transaction(session, lambda: service.mark_prepared(session, order_id, payload.prepared).id)
    return _order_response(service.get_order(session, updated_id))


@router.post("/{order_id}/converted", response_model=OrderResponse)
def mark_order_converted(
    order_id: int,
    payload: OrderConvertedRequest,
    session: SessionDep,
    _: OrdersWriteDep,
) -> OrderResponse:
    service = OrderService()
    updated_id = _run_in_transaction(session, lambda: service.mark_converted(session, order_id, payload.invoice_id).id)
    return _order_response(service.get_order(session, updated_id))
