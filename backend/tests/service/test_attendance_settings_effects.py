from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.attendance_service import (
    AttendanceConfigService,
    AttendanceCutLogInput,
    AttendanceDayEntrySavePayload,
    AttendanceDayEntryService,
    AttendanceEmployeeService,
    AttendanceWorkLogInput,
)
from app.application.inventory_service import InventoryService
from app.domain.attendance import AttendanceTeam, AttendanceWorkInputType, AttendanceWorkPricingRule
from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.base import Base


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


def test_inactive_blow_work_type_disappears_from_future_day_entry_but_history_keeps_snapshot(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Blow Settings", team=AttendanceTeam.BLOW)
    config_service = AttendanceConfigService()
    day_entry_service = AttendanceDayEntryService()
    work_type = config_service.create_work_type(
        session,
        name="Work Snapshot",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price="60000",
    )
    session.commit()

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 10),
            blow_work=[AttendanceWorkLogInput(work_type_id=work_type.id, quantity="2")],
        ),
        finalize=True,
    )
    session.commit()

    config_service.update_work_type(
        session,
        work_type.id,
        name=work_type.name,
        input_type=work_type.input_type,
        pricing_rule=work_type.pricing_rule,
        unit_price=work_type.unit_price,
        quota_quantity=work_type.quota_quantity,
        exclusive_group=work_type.exclusive_group,
        is_active=False,
    )
    session.commit()

    future_entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 11))
    historical_entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 10))

    assert all(item.id != work_type.id for item in future_entry.work_types)
    assert historical_entry.work_logs[0].unit_price_snapshot == Decimal("60000")
    assert historical_entry.work_logs[0].amount_snapshot == Decimal("120000")


def test_cut_item_setting_changes_affect_future_records_only_and_excluded_items_disappear(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Settings", team=AttendanceTeam.CUT)
    config_service = AttendanceConfigService()
    day_entry_service = AttendanceDayEntryService()
    product_id = create_product(session, code="CUT-SNAP-01", name="Cut Snapshot Product")
    bag_type = config_service.create_bag_type(
        session,
        name="Cut Snapshot Product",
        product_id=product_id,
        source_product_name_snapshot="Cut Snapshot Product",
        quota_quantity="20",
        excess_unit_price="10000",
        is_product_linked=True,
    )
    session.commit()

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 10),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="30")],
        ),
        finalize=True,
    )
    session.commit()

    config_service.update_bag_type(
        session,
        bag_type.id,
        name=bag_type.name,
        product_id=product_id,
        source_product_name_snapshot=bag_type.source_product_name_snapshot,
        quota_quantity="25",
        excess_unit_price="12000",
        is_active=True,
        is_product_linked=True,
        is_excluded_from_attendance=False,
        is_legacy=False,
    )
    session.commit()

    future_result = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 11),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="30")],
        ),
        finalize=True,
    )
    session.commit()

    historical_entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 10))
    future_entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 11))

    assert historical_entry.cut_logs[0].quota_quantity_snapshot == Decimal("20")
    assert historical_entry.cut_logs[0].excess_unit_price_snapshot == Decimal("10000")
    assert future_entry.cut_logs[0].quota_quantity_snapshot == Decimal("25")
    assert future_entry.cut_logs[0].excess_unit_price_snapshot == Decimal("12000")
    assert future_result.total_amount_snapshot == Decimal("60000")

    config_service.update_bag_type(
        session,
        bag_type.id,
        name=bag_type.name,
        product_id=product_id,
        source_product_name_snapshot=bag_type.source_product_name_snapshot,
        quota_quantity="25",
        excess_unit_price="12000",
        is_active=True,
        is_product_linked=True,
        is_excluded_from_attendance=True,
        is_legacy=False,
    )
    session.commit()

    selectable_entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 12))
    historical_after_exclude = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 10))

    assert all(item.id != bag_type.id for item in selectable_entry.bag_types)
    assert historical_after_exclude.cut_logs[0].bag_type_id == bag_type.id
