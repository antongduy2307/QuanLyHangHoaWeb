from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.inventory_service import InventoryService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.inventory import Product, ProductPrice


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
def service() -> InventoryService:
    return InventoryService()


def create_bao_kg_product(
    service: InventoryService,
    session: Session,
    *,
    code: str = "gao-01",
    name: str = "Gao Thom",
    prices: dict[UnitType, str] | None = None,
) -> Product:
    return service.create_product(
        session,
        product_code_base=code,
        product_name=name,
        unit_mode=UnitMode.BAO_KG,
        enabled_prices=prices or {UnitType.BAO: "250000"},
    )


def enabled_prices(session: Session, product_id: int) -> dict[str, Decimal]:
    rows = session.scalars(
        select(ProductPrice).where(ProductPrice.product_id == product_id).where(ProductPrice.is_enabled.is_(True))
    ).all()
    return {row.unit_type: row.price for row in rows}


@pytest.mark.parametrize(
    ("prices", "expected_units"),
    [
        ({UnitType.BAO: "250000"}, {"BAO"}),
        ({UnitType.KG: "12000"}, {"KG"}),
        ({UnitType.BAO: "250000", UnitType.KG: "12000"}, {"BAO", "KG"}),
    ],
)
def test_create_bao_kg_product_with_supported_price_shapes(
    session: Session,
    service: InventoryService,
    prices: dict[UnitType, str],
    expected_units: set[str],
) -> None:
    product = create_bao_kg_product(service, session, prices=prices)

    assert product.product_code_base == "GAO-01"
    assert product.unit_mode == "BAO_KG"
    assert set(enabled_prices(session, product.id)) == expected_units
    assert product.inventory_balance.on_hand_bao_decimal == Decimal("0")


def test_create_bich_product_with_bich_price(session: Session, service: InventoryService) -> None:
    product = service.create_product(
        session,
        product_code_base="bich-01",
        product_name="Bich Sua",
        unit_mode=UnitMode.BICH,
        enabled_prices={UnitType.BICH: "5000"},
    )

    assert product.unit_mode == "BICH"
    assert enabled_prices(session, product.id) == {"BICH": Decimal("5000.00")}
    assert product.inventory_balance.on_hand_bich_integer == Decimal("0")


@pytest.mark.parametrize(
    ("unit_mode", "prices"),
    [
        (UnitMode.BAO_KG, {UnitType.BICH: "5000"}),
        (UnitMode.BICH, {UnitType.BAO: "250000"}),
        (UnitMode.BICH, {UnitType.KG: "12000"}),
    ],
)
def test_reject_invalid_unit_price_combinations(
    session: Session,
    service: InventoryService,
    unit_mode: UnitMode,
    prices: dict[UnitType, str],
) -> None:
    with pytest.raises(ValidationError):
        service.create_product(
            session,
            product_code_base="p-1",
            product_name="Product",
            unit_mode=unit_mode,
            enabled_prices=prices,
        )


@pytest.mark.parametrize("prices", [{}, {UnitType.BAO: "0"}, {UnitType.BAO: "-1"}])
def test_reject_missing_or_non_positive_enabled_prices(
    session: Session,
    service: InventoryService,
    prices: dict[UnitType, str],
) -> None:
    with pytest.raises(ValidationError):
        service.create_product(
            session,
            product_code_base="p-1",
            product_name="Product",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices=prices,
        )


def test_normalize_product_code_and_update_name(session: Session, service: InventoryService) -> None:
    product = create_bao_kg_product(service, session, code="  ga o  ", name="  Old Name  ")

    updated = service.update_product(
        session,
        product.id,
        product_name="  New Name  ",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "260000"},
    )

    assert updated.product_code_base == "GA O"
    assert updated.product_name == "New Name"
    assert enabled_prices(session, product.id)["BAO"] == Decimal("260000.00")


def test_update_prices_disables_removed_existing_price(session: Session, service: InventoryService) -> None:
    product = create_bao_kg_product(
        service,
        session,
        prices={UnitType.BAO: "250000", UnitType.KG: "12000"},
    )

    service.update_product(
        session,
        product.id,
        product_name="Gao Thom",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.KG: "13000"},
    )

    prices = session.scalars(select(ProductPrice).where(ProductPrice.product_id == product.id)).all()
    price_by_unit = {price.unit_type: price for price in prices}
    assert price_by_unit["BAO"].is_enabled is False
    assert price_by_unit["KG"].is_enabled is True
    assert price_by_unit["KG"].price == Decimal("13000.00")


def test_reject_unit_mode_change_and_active_duplicate_code(session: Session, service: InventoryService) -> None:
    product = create_bao_kg_product(service, session, code="dup")

    with pytest.raises(ValidationError):
        service.update_product(
            session,
            product.id,
            product_name="Gao Thom",
            unit_mode=UnitMode.BICH,
            enabled_prices={UnitType.BICH: "5000"},
        )

    with pytest.raises(ValidationError):
        create_bao_kg_product(service, session, code=" dup ", name="Other")


def test_delete_unused_product_hard_deletes(session: Session, service: InventoryService) -> None:
    product = create_bao_kg_product(service, session)

    result = service.delete_product(session, product.id)

    assert result.action == "hard_deleted"
    assert session.get(Product, product.id) is None


def test_reactivate_inactive_product_with_same_identity(session: Session, service: InventoryService) -> None:
    product = create_bao_kg_product(service, session, code="inactive", name="Same")
    product.is_active = False
    session.flush()

    reactivated = service.create_product(
        session,
        product_code_base="inactive",
        product_name="Same",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.KG: "12000"},
    )

    assert reactivated.id == product.id
    assert reactivated.is_active is True
    assert enabled_prices(session, product.id) == {"KG": Decimal("12000.00")}


def test_reject_inactive_code_recreation_with_different_name_or_unit_mode(
    session: Session,
    service: InventoryService,
) -> None:
    product = create_bao_kg_product(service, session, code="inactive", name="Same")
    product.is_active = False
    session.flush()

    with pytest.raises(ValidationError):
        service.create_product(
            session,
            product_code_base="inactive",
            product_name="Different",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: "250000"},
        )

    product.product_name = "Same"
    session.flush()
    with pytest.raises(ValidationError):
        service.create_product(
            session,
            product_code_base="inactive",
            product_name="Same",
            unit_mode=UnitMode.BICH,
            enabled_prices={UnitType.BICH: "5000"},
        )


def test_stock_operations_for_bao_and_kg_use_canonical_bao_decimal(
    session: Session,
    service: InventoryService,
) -> None:
    product = create_bao_kg_product(service, session)

    service.increase_stock(session, product.id, "2", UnitType.BAO)
    service.increase_stock(session, product.id, "25", UnitType.KG)
    balance = service.decrease_stock(session, product.id, "12.5", UnitType.KG)

    assert balance.on_hand_bao_decimal == Decimal("2.500")
    assert balance.on_hand_bich_integer is None


def test_bich_stock_and_negative_stock_persist(session: Session, service: InventoryService) -> None:
    product = service.create_product(
        session,
        product_code_base="bich",
        product_name="Bich",
        unit_mode=UnitMode.BICH,
        enabled_prices={UnitType.BICH: "5000"},
    )

    service.increase_stock(session, product.id, "3", UnitType.BICH)
    balance = service.decrease_stock(session, product.id, "5", UnitType.BICH)

    assert balance.on_hand_bich_integer == Decimal("-2.000")
    assert balance.on_hand_bao_decimal is None


def test_list_products_excludes_inactive_by_default(session: Session, service: InventoryService) -> None:
    active = create_bao_kg_product(service, session, code="active", name="Active")
    inactive = create_bao_kg_product(service, session, code="inactive", name="Inactive")
    inactive.is_active = False
    session.flush()

    assert service.list_products(session) == [active]
    assert {product.id for product in service.list_products(session, include_inactive=True)} == {active.id, inactive.id}
