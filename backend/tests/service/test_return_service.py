from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.application.return_service import ReturnService
from app.application.sales_service import SalesService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.domain.returns import ReturnHandlingMode
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import CustomerBalanceLedger
from app.infrastructure.db.models.inventory import Product
from app.schemas.returns import ReturnItemInput
from app.schemas.sales import InvoiceItemInput


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
def sales_service() -> SalesService:
    return SalesService()


@pytest.fixture
def return_service() -> ReturnService:
    return ReturnService()


def create_product(session: Session, inventory_service: InventoryService) -> Product:
    product = inventory_service.create_product(
        session,
        product_code_base="GAO",
        product_name="Gao",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000", UnitType.KG: "12000"},
    )
    inventory_service.increase_stock(session, product.id, "10", UnitType.BAO)
    return product


def ledger_rows(session: Session, customer_id: int) -> list[CustomerBalanceLedger]:
    return list(
        session.scalars(
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .order_by(CustomerBalanceLedger.display_order, CustomerBalanceLedger.id)
        )
    )


def test_generate_return_code_and_create_quick_walk_in_refund(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert return_invoice.return_code == "TR20260516-001"
    assert return_invoice.is_quick_return is True
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("11.000")


def test_generate_same_day_return_codes_sequentially(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    first = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    second = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert first.return_code == "TR20260516-001"
    assert second.return_code == "TR20260516-002"


def test_generate_return_codes_with_per_day_counters(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    first_day = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    second_day = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 17, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert first_day.return_code == "TR20260516-001"
    assert second_day.return_code == "TR20260517-001"


def test_generate_return_code_skips_imported_existing_code_without_counter(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    imported = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Imported",
        return_datetime=datetime(2026, 5, 16, 8, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        return_code="TR20260516-005",
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    generated = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert imported.return_code == "TR20260516-005"
    assert generated.return_code == "TR20260516-006"


def test_reject_walk_in_store_credit(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    with pytest.raises(ValidationError):
        return_service.create_return(
            session,
            source_invoice_id=None,
            customer_id=None,
            customer_snapshot_name="Walk In",
            return_datetime=datetime(2026, 5, 16, 10, 0, 0),
            handling_mode=ReturnHandlingMode.STORE_CREDIT,
            items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
        )


def test_customer_store_credit_return_reduces_balance_and_total_sales(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="500000",
        total_sales="500000",
    )

    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    rows = ledger_rows(session, customer.id)
    assert customer.current_balance == Decimal("250000.00")
    assert customer.total_sales == Decimal("250000.00")
    assert rows[-1].event_type == "RETURN_STORE_CREDIT"
    assert rows[-1].ref_id == return_invoice.id
    assert rows[-1].source_ref_type == "RETURN"
    assert rows[-1].display_order == 0


def test_customer_store_credit_return_can_create_negative_balance(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="100000",
        total_sales="500000",
    )

    return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer.current_balance == Decimal("-150000.00")
    assert customer.total_sales == Decimal("250000.00")


def test_customer_refund_now_uses_min_positive_balance(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="100000",
        total_sales="500000",
    )

    return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer.current_balance == Decimal("0.00")
    assert customer.total_sales == Decimal("250000.00")


def test_customer_refund_now_does_not_reduce_negative_balance_further(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="-100000",
        total_sales="500000",
    )

    return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    rows = ledger_rows(session, customer.id)
    assert customer.current_balance == Decimal("-100000.00")
    assert customer.total_sales == Decimal("250000.00")
    assert [row.event_type for row in rows] == ["OPENING_BALANCE"]


def test_linked_return_cannot_exceed_remaining_quantity(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    source_item = invoice.items[0]

    return_service.create_return(
        session,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "1", source_invoice_item_id=source_item.id)],
    )

    with pytest.raises(ValidationError):
        return_service.create_return(
            session,
            source_invoice_id=invoice.id,
            customer_id=None,
            customer_snapshot_name=None,
            return_datetime=datetime(2026, 5, 16, 11, 0, 0),
            handling_mode=ReturnHandlingMode.REFUND_NOW,
            items=[ReturnItemInput(None, UnitType.BAO, "2", source_invoice_item_id=source_item.id)],
        )


def test_quick_return_has_no_source_quantity_ceiling(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)

    first = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "20")],
    )
    second = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "30")],
    )

    assert first.total_amount == Decimal("5000000.00")
    assert second.total_amount == Decimal("7500000.00")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("60.000")


def test_list_returns_searches_return_customer_and_source_invoice_and_date_range(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Cong ty Minh Anh")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    older = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Khach Cu",
        return_datetime=datetime(2025, 1, 1, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    current = return_service.create_return(
        session,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(None, UnitType.BAO, "1", source_invoice_item_id=invoice.items[0].id)],
    )

    assert [row.id for row in return_service.list_returns(session, search="TR20260516")] == [current.id]
    assert [row.id for row in return_service.list_returns(session, search="minh anh")] == [current.id]
    assert [row.id for row in return_service.list_returns(session, search=invoice.invoice_code)] == [current.id]
    assert [row.id for row in return_service.list_returns(session, search="khach cu")] == [older.id]
    assert [
        row.id
        for row in return_service.list_returns(
            session,
            date_from=datetime(2026, 1, 1, 0, 0, 0),
            date_to=datetime(2026, 12, 31, 23, 59, 59),
        )
    ] == [current.id]


def test_inactive_historical_customer_linked_return_detail_and_update_still_work(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Historical")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    customer.is_active = False
    session.flush()

    return_invoice = return_service.create_return(
        session,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(None, UnitType.BAO, "1", source_invoice_item_id=invoice.items[0].id)],
    )
    loaded = return_service.get_return(session, return_invoice.id)
    updated = return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(None, UnitType.BAO, "1", source_invoice_item_id=invoice.items[0].id)],
    )

    assert loaded.customer_id == customer.id
    assert loaded.customer_snapshot_name == "Historical"
    assert updated.customer_id == customer.id
    assert updated.customer_snapshot_name == "Historical"
    assert customer.current_balance == Decimal("250000.00")


def test_product_snapshots_preserved_and_delete_rolls_back_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="500000",
        total_sales="500000",
    )
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert return_invoice.items[0].product_code_snapshot == "GAO"
    return_service.delete_return(session, return_invoice.id)

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("10.000")
    assert customer.current_balance == Decimal("500000.00")
    assert customer.total_sales == Decimal("500000.00")
    assert [row.event_type for row in ledger_rows(session, customer.id)] == ["OPENING_BALANCE"]


def test_update_historical_quick_return_with_inactive_product_still_works(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    product.is_active = False
    session.flush()

    updated = return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "2")],
    )

    assert updated.items[0].product_id == product.id
    assert updated.items[0].product_name_snapshot == "Gao"
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("12.000")


def test_reject_new_quick_return_for_inactive_product(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    product.is_active = False
    session.flush()

    with pytest.raises(ValidationError):
        return_service.create_return(
            session,
            source_invoice_id=None,
            customer_id=None,
            customer_snapshot_name="Walk In",
            return_datetime=datetime(2026, 5, 16, 10, 0, 0),
            handling_mode=ReturnHandlingMode.REFUND_NOW,
            items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
        )


def test_update_return_quantity_changes_inventory_without_double_counting(
    session: Session,
    inventory_service: InventoryService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    updated = return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "2")],
    )

    assert updated.return_code == return_invoice.return_code
    assert updated.total_amount == Decimal("500000.00")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("12.000")


def test_update_store_credit_return_rebuilds_customer_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="500000",
        total_sales="500000",
    )
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 17, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "2")],
    )

    rows = ledger_rows(session, customer.id)
    assert customer.current_balance == Decimal("0.00")
    assert customer.total_sales == Decimal("0.00")
    assert rows[-1].event_type == "RETURN_STORE_CREDIT"
    assert rows[-1].transaction_datetime == datetime(2026, 5, 17, 10, 0, 0)


def test_update_refund_now_uses_min_positive_balance(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    customer = customer_service.create_customer(
        session,
        customer_name="Customer",
        opening_balance="100000",
        total_sales="500000",
    )
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer.current_balance == Decimal("0.00")
    assert customer.total_sales == Decimal("250000.00")


def test_update_linked_return_validates_remaining_quantity(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    source_item = invoice.items[0]
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "1", source_invoice_item_id=source_item.id)],
    )

    return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "2", source_invoice_item_id=source_item.id)],
    )

    with pytest.raises(ValidationError):
        return_service.update_return(
            session,
            return_invoice.id,
            source_invoice_id=invoice.id,
            customer_id=None,
            customer_snapshot_name=None,
            return_datetime=datetime(2026, 5, 16, 12, 0, 0),
            handling_mode=ReturnHandlingMode.REFUND_NOW,
            items=[ReturnItemInput(None, UnitType.BAO, "3", source_invoice_item_id=source_item.id)],
        )


def test_update_linked_return_excludes_current_return_from_prior_return_total(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    source_item = invoice.items[0]
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "2", source_invoice_item_id=source_item.id)],
    )

    updated = return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "2", source_invoice_item_id=source_item.id)],
    )

    assert updated.total_amount == Decimal("500000.00")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("10.000")


def test_update_quick_return_to_linked_return_and_delete_latest_effects(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
    return_service: ReturnService,
) -> None:
    product = create_product(session, inventory_service)
    return_invoice = return_service.create_return(
        session,
        source_invoice_id=None,
        customer_id=None,
        customer_snapshot_name="Walk In",
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    source_item = invoice.items[0]

    product.product_name = "New Name"
    return_service.update_return(
        session,
        return_invoice.id,
        source_invoice_id=invoice.id,
        customer_id=None,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 11, 0, 0),
        handling_mode=ReturnHandlingMode.REFUND_NOW,
        items=[ReturnItemInput(None, UnitType.BAO, "2", source_invoice_item_id=source_item.id)],
    )

    assert return_invoice.return_code == "TR20260516-001"
    assert return_invoice.is_quick_return is False
    assert return_invoice.items[0].product_name_snapshot == "New Name"

    return_service.delete_return(session, return_invoice.id)

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("8.000")
