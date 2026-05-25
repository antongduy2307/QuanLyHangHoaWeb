from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.exceptions import NotFoundError
from app.domain.orders import OrderStatus
from app.infrastructure.db.models.orders import OrderRequest, OrderRequestItem


class OrderRepository:
    def add_order(self, session: Session, order: OrderRequest) -> None:
        session.add(order)

    def get_order(self, session: Session, order_id: int) -> OrderRequest:
        statement = (
            select(OrderRequest)
            .options(selectinload(OrderRequest.items))
            .where(OrderRequest.id == order_id)
        )
        order = session.scalars(statement).one_or_none()
        if order is None:
            raise NotFoundError(f"Order {order_id} was not found.")
        return order

    def get_order_for_update(self, session: Session, order_id: int) -> OrderRequest:
        statement = select(OrderRequest).where(OrderRequest.id == order_id).with_for_update()
        order = session.scalars(statement).one_or_none()
        if order is None:
            raise NotFoundError(f"Order {order_id} was not found.")
        self.load_order_items_for_update(session, order.id)
        return order

    def list_active_orders(self, session: Session) -> list[OrderRequest]:
        statement = (
            select(OrderRequest)
            .options(selectinload(OrderRequest.items))
            .where(OrderRequest.status.in_((OrderStatus.OPEN.value, OrderStatus.PREPARED.value)))
            .order_by(
                OrderRequest.status.desc(),
                OrderRequest.required_delivery_datetime.asc().nulls_last(),
                OrderRequest.order_datetime.asc(),
                OrderRequest.id.asc(),
            )
        )
        return list(session.scalars(statement).all())

    def load_order_items(self, session: Session, order_id: int) -> list[OrderRequestItem]:
        statement = (
            select(OrderRequestItem)
            .where(OrderRequestItem.order_request_id == order_id)
            .order_by(OrderRequestItem.id.asc())
        )
        return list(session.scalars(statement).all())

    def load_order_items_for_update(self, session: Session, order_id: int) -> list[OrderRequestItem]:
        statement = (
            select(OrderRequestItem)
            .where(OrderRequestItem.order_request_id == order_id)
            .order_by(OrderRequestItem.id.asc())
            .with_for_update()
        )
        return list(session.scalars(statement).all())

    def delete_order(self, session: Session, order: OrderRequest) -> None:
        session.delete(order)

    def generate_order_code(self, session: Session, order_datetime: datetime) -> str:
        prefix = f"DH{order_datetime.strftime('%Y%m%d')}-"
        statement = (
            select(OrderRequest.order_code)
            .where(OrderRequest.order_code.like(f"{prefix}%"))
            .order_by(OrderRequest.order_code.desc())
            .limit(1)
        )
        last_code = session.scalar(statement)
        next_number = int(last_code.rsplit("-", 1)[1]) + 1 if last_code else 1
        return f"{prefix}{next_number:03d}"
