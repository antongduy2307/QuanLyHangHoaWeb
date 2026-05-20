from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.application.sales_service import SalesService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.customer import CustomerBalanceLedger, DebtPayment
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.models.sales import Invoice
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


def create_bao_product(session: Session, inventory_service: InventoryService) -> Product:
    product = inventory_service.create_product(
        session,
        product_code_base="GAO",
        product_name="Gao",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000", UnitType.KG: "12000"},
    )
    inventory_service.increase_stock(session, product.id, "10", UnitType.BAO)
    return product


def create_bich_product(session: Session, inventory_service: InventoryService) -> Product:
    product = inventory_service.create_product(
        session,
        product_code_base="BICH",
        product_name="Bich",
        unit_mode=UnitMode.BICH,
        enabled_prices={UnitType.BICH: "5000"},
    )
    inventory_service.increase_stock(session, product.id, "10", UnitType.BICH)
    return product


def ledger_rows(session: Session, customer_id: int) -> list[CustomerBalanceLedger]:
    return list(
        session.scalars(
            select(CustomerBalanceLedger)
            .where(CustomerBalanceLedger.customer_id == customer_id)
            .order_by(CustomerBalanceLedger.display_order, CustomerBalanceLedger.id)
        )
    )


def test_generate_invoice_code_and_create_walk_in_invoice(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert invoice.invoice_code == "HD20260516-001"
    assert invoice.status == "COMPLETED"
    assert invoice.items[0].product_code_snapshot == "GAO"
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("9.000")


def test_invoice_codes_are_sequential_per_invoice_date(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    first = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )
    second = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )
    different_day = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 17, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert first.invoice_code == "HD20260516-001"
    assert second.invoice_code == "HD20260516-002"
    assert different_day.invoice_code == "HD20260517-001"


def test_invoice_code_generation_avoids_existing_imported_codes(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    session.add(
        Invoice(
            invoice_code="HD20260516-009",
            customer_id=None,
            customer_snapshot_name="Imported",
            invoice_datetime=datetime(2026, 5, 16, 8, 0, 0),
            total_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            status="COMPLETED",
        )
    )
    session.flush()

    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert invoice.invoice_code == "HD20260516-010"


def test_reject_unpaid_walk_in_invoice(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    with pytest.raises(ValidationError):
        sales_service.create_invoice(
            session,
            customer_id=None,
            customer_snapshot_name="Walk In",
            invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
            paid_amount="0",
            items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
        )


def test_reject_new_invoice_for_inactive_customer(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Inactive")
    customer.is_active = False
    session.flush()

    with pytest.raises(ValidationError):
        sales_service.create_invoice(
            session,
            customer_id=customer.id,
            customer_snapshot_name=None,
            invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
            paid_amount="0",
            items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
        )


def test_inactive_historical_customer_invoice_detail_and_update_still_work(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Historical")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )
    customer.is_active = False
    session.flush()

    loaded = sales_service.get_invoice(session, invoice.id)
    updated = sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert loaded.customer_id == customer.id
    assert loaded.customer_snapshot_name == "Historical"
    assert updated.customer_id == customer.id
    assert updated.customer_snapshot_name == "Historical"
    assert customer.current_balance == Decimal("150000.00")


def test_customer_unpaid_invoice_creates_charge_ledger(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")

    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    rows = ledger_rows(session, customer.id)
    assert customer.current_balance == Decimal("250000.00")
    assert customer.total_sales == Decimal("250000.00")
    assert [(row.event_type, row.ref_type, row.ref_id, row.display_order) for row in rows] == [
        ("INVOICE_CHARGE", "INVOICE", invoice.id, 10)
    ]


def test_customer_partial_payment_creates_charge_and_payment_ledger(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")

    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    rows = ledger_rows(session, customer.id)
    payment = session.scalars(select(DebtPayment)).one()
    assert customer.current_balance == Decimal("150000.00")
    assert payment.amount == Decimal("100000.00")
    assert [(row.event_type, row.ref_type, row.source_ref_type, row.source_ref_id) for row in rows] == [
        ("INVOICE_CHARGE", "INVOICE", "INVOICE", invoice.id),
        ("DEBT_PAYMENT", "DEBT_PAYMENT", "INVOICE", invoice.id),
    ]
    assert rows[1].ref_id == payment.id


def test_customer_overpayment_can_make_balance_negative(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")

    sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="300000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer.current_balance == Decimal("-50000.00")


def test_stock_decreases_for_bao_kg_and_bich(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    bao = create_bao_product(session, inventory_service)
    bich = create_bich_product(session, inventory_service)

    sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="300000",
        items=[InvoiceItemInput(bao.id, UnitType.KG, "25")],
    )
    sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 1, 0),
        paid_amount="5000",
        items=[InvoiceItemInput(bich.id, UnitType.BICH, "1")],
    )

    assert bao.inventory_balance.on_hand_bao_decimal == Decimal("9.000")
    assert bich.inventory_balance.on_hand_bich_integer == Decimal("9.000")


def test_manual_price_and_line_total_behavior(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="33333",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "3", line_total="33333")],
    )

    assert invoice.items[0].unit_price == Decimal("11111.00")
    assert invoice.items[0].line_total == Decimal("33333.00")


def test_default_line_total_rounds_to_currency_cents(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="1.01",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "3", unit_price="0.335")],
    )

    assert invoice.total_amount == Decimal("1.01")
    assert invoice.items[0].line_total == Decimal("1.01")


def test_line_total_can_override_quantity_price_rounding(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)

    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="1.00",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "3", unit_price="0.335", line_total="1.00")],
    )

    assert invoice.total_amount == Decimal("1.00")
    assert invoice.items[0].unit_price == Decimal("0.335")
    assert invoice.items[0].line_total == Decimal("1.00")


def test_reject_inactive_product_and_invalid_unit_type(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    product.is_active = False

    with pytest.raises(ValidationError):
        sales_service.create_invoice(
            session,
            customer_id=None,
            customer_snapshot_name="Walk In",
            invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
            paid_amount="250000",
            items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
        )

    product.is_active = True
    with pytest.raises(ValidationError):
        sales_service.create_invoice(
            session,
            customer_id=None,
            customer_snapshot_name="Walk In",
            invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
            paid_amount="250000",
            items=[InvoiceItemInput(product.id, UnitType.BICH, "1", unit_price="250000")],
        )


def test_update_historical_invoice_with_inactive_product_still_works(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )
    product.is_active = False
    session.flush()

    updated = sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )

    assert updated.items[0].product_id == product.id
    assert updated.items[0].product_name_snapshot == "Gao"
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("8.000")


def test_delete_invoice_restores_inventory_and_customer_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    sales_service.delete_invoice(session, invoice.id)

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("10.000")
    assert customer.current_balance == Decimal("0")
    assert customer.total_sales == Decimal("0.00")
    assert ledger_rows(session, customer.id) == []
    assert session.scalars(select(DebtPayment)).all() == []


def test_update_invoice_quantity_changes_inventory_without_double_counting(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    updated = sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )

    assert updated.invoice_code == invoice.invoice_code
    assert updated.total_amount == Decimal("500000.00")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("8.000")


def test_update_invoice_paid_amount_rebuilds_customer_ledger(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 17, 10, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    rows = ledger_rows(session, customer.id)
    assert customer.current_balance == Decimal("150000.00")
    assert [row.event_type for row in rows] == ["INVOICE_CHARGE", "DEBT_PAYMENT"]
    assert {row.transaction_datetime for row in rows} == {datetime(2026, 5, 17, 10, 0, 0)}


def test_update_invoice_customer_change_and_walk_in_conversion(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer_a = customer_service.create_customer(session, customer_name="A")
    customer_b = customer_service.create_customer(session, customer_name="B")
    invoice = sales_service.create_invoice(
        session,
        customer_id=customer_a.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=customer_b.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer_a.current_balance == Decimal("0")
    assert customer_a.total_sales == Decimal("0.00")
    assert ledger_rows(session, customer_a.id) == []
    assert customer_b.current_balance == Decimal("150000.00")
    assert customer_b.total_sales == Decimal("250000.00")

    sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 11, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer_b.current_balance == Decimal("0")
    assert customer_b.total_sales == Decimal("0.00")
    assert ledger_rows(session, customer_b.id) == []


def test_update_walk_in_invoice_to_customer_applies_customer_effects(
    session: Session,
    inventory_service: InventoryService,
    customer_service: CustomerService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    customer = customer_service.create_customer(session, customer_name="Customer")
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert customer.current_balance == Decimal("250000.00")
    assert customer.total_sales == Decimal("250000.00")


def test_update_invoice_refreshes_snapshots_and_delete_uses_latest_effects(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )
    product.product_name = "New Name"

    sales_service.update_invoice(
        session,
        invoice.id,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="500000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )
    assert invoice.items[0].product_name_snapshot == "New Name"

    sales_service.delete_invoice(session, invoice.id)

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("10.000")


def test_update_invoice_rejects_invalid_product_unit(
    session: Session,
    inventory_service: InventoryService,
    sales_service: SalesService,
) -> None:
    product = create_bao_product(session, inventory_service)
    invoice = sales_service.create_invoice(
        session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    with pytest.raises(ValidationError):
        sales_service.update_invoice(
            session,
            invoice.id,
            customer_id=None,
            customer_snapshot_name="Walk In",
            invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
            paid_amount="250000",
            items=[InvoiceItemInput(product.id, UnitType.BICH, "1", unit_price="250000")],
        )
