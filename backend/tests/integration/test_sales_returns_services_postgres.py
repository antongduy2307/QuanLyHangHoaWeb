from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.application.document_service import DocumentService
from app.application.customer_service import CustomerService
from app.application.inventory_service import InventoryService
from app.application.return_service import ReturnService
from app.application.sales_service import SalesService
from app.domain.documents import DocumentType
from app.domain.enums import UnitMode, UnitType
from app.domain.returns import ReturnHandlingMode
from app.schemas.returns import ReturnItemInput
from app.schemas.sales import InvoiceItemInput


pytestmark = [pytest.mark.integration, pytest.mark.postgres]


def test_postgres_document_counter_persists_sequences(postgres_session: Session) -> None:
    service = DocumentService()
    business_datetime = datetime(2026, 5, 16, 9, 0, 0)

    assert service.next_document_code(postgres_session, DocumentType.INVOICE, business_datetime.date()) == "HD20260516-001"
    assert service.next_document_code(postgres_session, DocumentType.INVOICE, business_datetime.date()) == "HD20260516-002"
    assert service.next_document_code(postgres_session, DocumentType.RETURN, business_datetime.date()) == "TR20260516-001"


def test_postgres_sales_service_creates_invoice_and_stock_effect(postgres_session: Session) -> None:
    inventory_service = InventoryService()
    sales_service = SalesService()
    product = inventory_service.create_product(
        postgres_session,
        product_code_base="PG-SALE",
        product_name="Postgres Sale Product",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000"},
    )
    inventory_service.increase_stock(postgres_session, product.id, "2", UnitType.BAO)

    invoice = sales_service.create_invoice(
        postgres_session,
        customer_id=None,
        customer_snapshot_name="Walk In",
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="250000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    assert invoice.invoice_code == "HD20260516-001"
    assert invoice.total_amount == Decimal("250000.00")
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("1.000")


def test_postgres_invoice_update_reapplies_stock_and_customer_effects(postgres_session: Session) -> None:
    inventory_service = InventoryService()
    customer_service = CustomerService()
    sales_service = SalesService()
    product = inventory_service.create_product(
        postgres_session,
        product_code_base="PG-UPD-SALE",
        product_name="Postgres Update Sale Product",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000"},
    )
    inventory_service.increase_stock(postgres_session, product.id, "3", UnitType.BAO)
    customer = customer_service.create_customer(postgres_session, customer_name="Postgres Customer")
    invoice = sales_service.create_invoice(
        postgres_session,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 9, 0, 0),
        paid_amount="0",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "1")],
    )

    sales_service.update_invoice(
        postgres_session,
        invoice.id,
        customer_id=customer.id,
        customer_snapshot_name=None,
        invoice_datetime=datetime(2026, 5, 16, 10, 0, 0),
        paid_amount="100000",
        items=[InvoiceItemInput(product.id, UnitType.BAO, "2")],
    )

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("1.000")
    assert customer.current_balance == Decimal("400000.00")
    assert customer.total_sales == Decimal("500000.00")


def test_postgres_return_update_reapplies_stock_and_customer_effects(postgres_session: Session) -> None:
    inventory_service = InventoryService()
    customer_service = CustomerService()
    return_service = ReturnService()
    product = inventory_service.create_product(
        postgres_session,
        product_code_base="PG-UPD-RET",
        product_name="Postgres Update Return Product",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "250000"},
    )
    inventory_service.increase_stock(postgres_session, product.id, "3", UnitType.BAO)
    customer = customer_service.create_customer(
        postgres_session,
        customer_name="Postgres Return Customer",
        opening_balance="500000",
        total_sales="500000",
    )
    return_invoice = return_service.create_return(
        postgres_session,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 9, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "1")],
    )

    return_service.update_return(
        postgres_session,
        return_invoice.id,
        source_invoice_id=None,
        customer_id=customer.id,
        customer_snapshot_name=None,
        return_datetime=datetime(2026, 5, 16, 10, 0, 0),
        handling_mode=ReturnHandlingMode.STORE_CREDIT,
        items=[ReturnItemInput(product.id, UnitType.BAO, "2")],
    )

    assert product.inventory_balance.on_hand_bao_decimal == Decimal("5.000")
    assert customer.current_balance == Decimal("0.00")
    assert customer.total_sales == Decimal("0.00")
