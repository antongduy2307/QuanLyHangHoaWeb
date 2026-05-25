from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.application.order_service import OrderService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.domain.orders import OrderStatus
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import CustomerBalanceLedger
from app.infrastructure.db.models.sales import Invoice
from app.infrastructure.db.repositories.orders import OrderRepository


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
def inventory_service() -> InventoryService:
    return InventoryService()


@pytest.fixture
def customer_service() -> CustomerService:
    return CustomerService()


@pytest.fixture
def order_service() -> OrderService:
    return OrderService()


@pytest.fixture
def order_repository() -> OrderRepository:
    return OrderRepository()


def create_bao_product(session: Session, inventory_service: InventoryService):
    return inventory_service.create_product(
        session,
        product_code_base="GAO",
        product_name="Gao",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000", UnitType.KG: "10000"},
    )


def create_bich_product(session: Session, inventory_service: InventoryService):
    return inventory_service.create_product(
        session,
        product_code_base="BICH",
        product_name="Bich",
        unit_mode=UnitMode.BICH,
        enabled_prices={UnitType.BICH: "5000"},
    )


def create_customer(session: Session, customer_service: CustomerService):
    return customer_service.create_customer(session, customer_name="Khach A")


def test_repository_generates_order_code_per_business_date(session: Session, order_repository: OrderRepository) -> None:
    code = order_repository.generate_order_code(session, datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc))
    assert code == "DH20260521-001"


def test_repository_code_generation_advances_from_existing_codes(
    session: Session,
    order_service: OrderService,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_repository: OrderRepository,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
    )

    code = order_repository.generate_order_code(session, datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc))
    assert code == "DH20260521-002"


def test_create_order_does_not_touch_inventory_invoice_or_customer_ledger(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)

    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "3"}],
        note="Can giao som",
    )

    assert order.status == OrderStatus.OPEN.value
    assert [item.quantity for item in order.items] == [Decimal("3.000")]
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("0.000")
    assert session.scalars(select(Invoice)).all() == []
    assert session.scalars(select(CustomerBalanceLedger)).all() == []
    assert customer.current_balance == Decimal("0.00")


def test_order_can_exceed_current_stock_without_side_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)

    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "999"}],
    )

    assert order.items[0].quantity == Decimal("999.000")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("0.000")


def test_order_preserves_decimal_quantity_and_summary_stock(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    inventory_service.increase_stock(session, product.id, "12.5", UnitType.BAO)

    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "4.8"}],
    )
    summary = order_service.list_active_quantity_summary(session)

    assert order.items[0].quantity == Decimal("4.800")
    assert summary[0].quantity == Decimal("4.800")
    assert summary[0].stock_available == Decimal("12.500")


def test_active_quantity_summary_groups_same_product_and_unit_only(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    bao_product = create_bao_product(session, inventory_service)
    bich_product = create_bich_product(session, inventory_service)
    customer = create_customer(session, customer_service)

    order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[
            {"product_id": bao_product.id, "unit_type": UnitType.BAO, "quantity": "2"},
            {"product_id": bich_product.id, "unit_type": UnitType.BICH, "quantity": "1"},
        ],
    )
    order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[
            {"product_id": bao_product.id, "unit_type": UnitType.BAO, "quantity": "3"},
            {"product_id": bao_product.id, "unit_type": UnitType.KG, "quantity": "5"},
        ],
    )

    summary = {
        (row.product_id, row.unit_type): row.quantity
        for row in order_service.list_active_quantity_summary(session)
    }

    assert summary == {
        (bao_product.id, UnitType.BAO): Decimal("5.000"),
        (bao_product.id, UnitType.KG): Decimal("5.000"),
        (bich_product.id, UnitType.BICH): Decimal("1.000"),
    }


def test_prepared_orders_remain_active_and_sort_first(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    open_order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
    )
    prepared_order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 10, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
    )

    order_service.mark_prepared(session, prepared_order.id, True)
    rows = order_service.list_active_orders(session)

    assert [row.id for row in rows] == [prepared_order.id, open_order.id]
    assert rows[0].status == OrderStatus.PREPARED.value
    assert rows[0].completed_at is not None


def test_mark_prepared_false_returns_order_to_open(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
    )

    order_service.mark_prepared(session, order.id, True)
    updated = order_service.mark_prepared(session, order.id, False)

    assert updated.status == OrderStatus.OPEN.value
    assert updated.completed_at is None


def test_converted_order_hidden_and_cannot_edit_or_delete(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "2"}],
    )

    converted = order_service.mark_converted(session, order.id, 51)

    assert converted.status == OrderStatus.CONVERTED.value
    assert converted.source_invoice_id == 51
    assert converted.completed_at is not None
    assert order_service.list_active_orders(session) == []
    assert order_service.list_active_quantity_summary(session) == []

    with pytest.raises(ValidationError):
        order_service.update_order(
            session,
            order.id,
            customer_id=customer.id,
            customer_snapshot_name=None,
            order_datetime=datetime(2026, 5, 21, 11, 0, tzinfo=timezone.utc),
            required_delivery_datetime=None,
            items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
        )

    with pytest.raises(ValidationError):
        order_service.delete_order(session, order.id)


def test_update_order_changes_fields_without_business_side_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "2"}],
    )

    updated = order_service.update_order(
        session,
        order.id,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 22, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=datetime(2026, 5, 23, 9, 0, tzinfo=timezone.utc),
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "5"}],
        note="Updated",
    )

    assert updated.items[0].quantity == Decimal("5.000")
    assert updated.note == "Updated"
    assert updated.required_delivery_datetime == datetime(2026, 5, 23, 9, 0, tzinfo=timezone.utc)
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("0.000")
    assert session.scalars(select(CustomerBalanceLedger)).all() == []
    assert session.scalars(select(Invoice)).all() == []


def test_delete_order_removes_it_without_side_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = create_customer(session, customer_service)
    order = order_service.create_order(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "2"}],
    )

    order_service.delete_order(session, order.id)

    assert order_service.list_active_orders(session) == []
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("0.000")
    assert customer.current_balance == Decimal("0.00")
    assert session.scalars(select(CustomerBalanceLedger)).all() == []


def test_walk_in_order_defaults_snapshot_name(
    session: Session,
    inventory_service: InventoryService,
    order_service: OrderService,
) -> None:
    product = create_bao_product(session, inventory_service)

    order = order_service.create_order(
        session,
        customer_id=None,
        customer_snapshot_name="",
        order_datetime=datetime(2026, 5, 21, 9, 0, tzinfo=timezone.utc),
        required_delivery_datetime=None,
        items=[{"product_id": product.id, "unit_type": UnitType.BAO, "quantity": "1"}],
    )

    assert order.customer_id is None
    assert order.customer_name_snapshot == "Khách lẻ"
