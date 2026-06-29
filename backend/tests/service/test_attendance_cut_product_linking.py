from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.attendance_service import (
    AttendanceConfigService,
    AttendanceDayEntrySavePayload,
    AttendanceDayEntryService,
    AttendanceEmployeeService,
    AttendanceExtraCutLogInput,
)
from app.application.inventory_service import InventoryService
from app.domain.attendance import AttendanceTeam
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.attendance import AttendanceInventoryEffect


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_product(session: Session, *, code: str, name: str, unit_mode: UnitMode = UnitMode.BAO_KG) -> int:
    product = InventoryService().create_product(
        session,
        product_code_base=code,
        product_name=name,
        unit_mode=unit_mode,
        enabled_prices={UnitType.BAO: "100.00"} if unit_mode == UnitMode.BAO_KG else {UnitType.BICH: "5.00"},
    )
    session.flush()
    return product.id


def test_search_cut_products_finds_inventory_by_name_or_code_and_shows_existing_link(session: Session) -> None:
    config_service = AttendanceConfigService()
    product_id = create_product(session, code="CUT-SEARCH-01", name="Bao Search")
    other_product_id = create_product(session, code="VK-SEARCH-02", name="Bao VK Search")
    linked = config_service.create_bag_type(
        session,
        name="Bao Search",
        product_id=product_id,
        source_product_name_snapshot="Bao Search",
        quota_quantity="25",
        excess_unit_price="3500",
        is_product_linked=True,
    )
    session.commit()

    by_name = config_service.search_cut_products(session, search="Bao Search")
    by_code = config_service.search_cut_products(session, search="VK-SEARCH-02")

    assert by_name[0].product_id == product_id
    assert by_name[0].linked_bag_type_id == linked.id
    assert by_name[0].is_configured_for_attendance is True
    assert by_code[0].product_id == other_product_id
    assert by_code[0].linked_bag_type_id is None
    assert by_code[0].is_configured_for_attendance is False


def test_upsert_bag_type_from_product_creates_and_requires_configuration(session: Session) -> None:
    config_service = AttendanceConfigService()
    product_id = create_product(session, code="CUT-UPSERT-01", name="Bao Config")
    session.commit()

    with pytest.raises(ValidationError, match="not configured for attendance"):
        config_service.upsert_bag_type_from_product(session, product_id=product_id)

    bag_type = config_service.upsert_bag_type_from_product(
        session,
        product_id=product_id,
        quota_quantity="20",
        excess_unit_price="10000",
    )
    session.commit()

    assert bag_type.product_id == product_id
    assert bag_type.name == "Bao Config"
    assert bag_type.quota_quantity == Decimal("20")
    assert bag_type.excess_unit_price == Decimal("10000")
    assert bag_type.is_active is True
    assert bag_type.is_excluded_from_attendance is False
    assert bag_type.is_legacy is False


def test_upsert_bag_type_from_product_revives_existing_inactive_legacy_link(session: Session) -> None:
    config_service = AttendanceConfigService()
    product_id = create_product(session, code="CUT-UPSERT-02", name="Bao Revive")
    bag_type = config_service.create_bag_type(
        session,
        name="Legacy Bao",
        product_id=product_id,
        source_product_name_snapshot="Legacy Bao",
        quota_quantity="0",
        excess_unit_price="0",
        is_product_linked=True,
        is_active=False,
        is_excluded_from_attendance=True,
        is_legacy=True,
    )
    session.commit()

    updated = config_service.upsert_bag_type_from_product(
        session,
        product_id=product_id,
        quota_quantity="30",
        excess_unit_price="4200",
    )
    session.commit()

    assert updated.id == bag_type.id
    assert updated.name == "Bao Revive"
    assert updated.is_active is True
    assert updated.is_excluded_from_attendance is False
    assert updated.is_legacy is False
    assert updated.quota_quantity == Decimal("30")
    assert updated.excess_unit_price == Decimal("4200")


def test_blow_extra_cut_saves_amount_and_creates_inventory_effect(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Blow VK", team=AttendanceTeam.BLOW)
    product_id = create_product(session, code="VK-BLOW-01", name="VK Bich", unit_mode=UnitMode.BICH)
    bag_type = AttendanceConfigService().upsert_bag_type_from_product(
        session,
        product_id=product_id,
        quota_quantity="25",
        excess_unit_price="3500",
    )
    session.commit()

    result = AttendanceDayEntryService().save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 9),
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag_type.id, quantity="4.5")],
        ),
        finalize=True,
    )
    session.commit()

    record = AttendanceDayEntryService().get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 9))
    effects = list(
        session.scalars(select(AttendanceInventoryEffect).where(AttendanceInventoryEffect.daily_record_id == result.record_id)).all()
    )

    assert record.extra_cut_logs[0].amount_snapshot == Decimal("15750")
    assert result.total_amount_snapshot == Decimal("15750")
    assert len(effects) == 1
    assert effects[0].product_id == product_id
    assert effects[0].quantity_delta == Decimal("4.500")
