from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.attendance_report_service import AttendanceReportService
from app.application.attendance_service import (
    AttendanceConfigService,
    AttendanceCutLogInput,
    AttendanceDayEntrySavePayload,
    AttendanceDayEntryService,
    AttendanceEmployeeService,
    AttendanceExtraCutLogInput,
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


def seed_work_type(session: Session, *, name: str, input_type: AttendanceWorkInputType, pricing_rule: AttendanceWorkPricingRule, unit_price: int, quota_quantity=None, exclusive_group=None):
    return AttendanceConfigService().create_work_type(
        session,
        name=name,
        input_type=input_type,
        pricing_rule=pricing_rule,
        unit_price=unit_price,
        quota_quantity=quota_quantity,
        exclusive_group=exclusive_group,
    )


def seed_bag_type(session: Session, *, name: str, quota_quantity: int, excess_unit_price: int):
    product = InventoryService().create_product(
        session,
        product_code_base=f"{name}-code",
        product_name=f"{name} Product",
        unit_mode=UnitMode.BAO_KG,
        enabled_prices={UnitType.BAO: "100.00"},
    )
    return AttendanceConfigService().create_bag_type(
        session,
        name=name,
        quota_quantity=quota_quantity,
        excess_unit_price=excess_unit_price,
        product_id=product.id,
        source_product_name_snapshot=f"{name} Product",
    )


def test_period_report_totals_and_inactive_history_included(session: Session) -> None:
    employee_service = AttendanceEmployeeService()
    day_entry_service = AttendanceDayEntryService()
    report_service = AttendanceReportService()

    blow = employee_service.create_employee(session, display_name="Blow A", team=AttendanceTeam.BLOW)
    cut = employee_service.create_employee(session, display_name="Cut B", team=AttendanceTeam.CUT)
    inactive_cut = employee_service.create_employee(session, display_name="Cut C", team=AttendanceTeam.CUT)

    qty_type = seed_work_type(
        session,
        name="Máy nhỏ",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )
    bag_25 = seed_bag_type(session, name="Bao 25kg", quota_quantity=20, excess_unit_price=10000)
    bag_50 = seed_bag_type(session, name="Bao 50kg", quota_quantity=30, excess_unit_price=20000)
    session.commit()

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=blow.id,
            selected_date=date(2026, 5, 2),
            blow_work=[AttendanceWorkLogInput(work_type_id=qty_type.id, quantity="2")],
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag_25.id, quantity="10")],
        ),
        finalize=True,
    )
    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=cut.id,
            selected_date=date(2026, 5, 2),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_25.id, quantity="10"), AttendanceCutLogInput(bag_type_id=bag_50.id, quantity="20")],
        ),
        finalize=True,
    )
    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=inactive_cut.id,
            selected_date=date(2026, 5, 3),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_25.id, quantity="10"), AttendanceCutLogInput(bag_type_id=bag_50.id, quantity="20")],
        ),
        finalize=True,
    )
    employee_service.update_employee(session, inactive_cut.id, is_active=False)
    session.commit()

    cut_period_id = day_entry_service._ensure_period_for_date(session, date(2026, 5, 2)).id
    period_report = report_service.build_period_report(session, team=AttendanceTeam.CUT, period_id=cut_period_id)

    assert period_report.grand_total == 200000
    assert [summary.display_name for summary in period_report.employee_summaries] == ["Cut B", "Cut C"]
    assert period_report.employee_summaries[0].total_amount == 100000
    assert period_report.employee_summaries[1].total_amount == 100000
    assert period_report.total_paid_workdays == 2
    assert "Bao 25kg" in period_report.detail_labels
    assert "Bao 50kg" in period_report.detail_labels


def test_monthly_report_counts_paid_workdays_and_sums_details(session: Session) -> None:
    employee_service = AttendanceEmployeeService()
    day_entry_service = AttendanceDayEntryService()
    report_service = AttendanceReportService()

    blow = employee_service.create_employee(session, display_name="Blow Monthly", team=AttendanceTeam.BLOW)
    qty_type = seed_work_type(
        session,
        name="Máy nhỏ",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )
    bag_25 = seed_bag_type(session, name="Bao 25kg", quota_quantity=25, excess_unit_price=3500)
    session.commit()

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=blow.id,
            selected_date=date(2026, 5, 2),
            blow_work=[AttendanceWorkLogInput(work_type_id=qty_type.id, quantity="2")],
        ),
        finalize=True,
    )
    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=blow.id,
            selected_date=date(2026, 5, 3),
            is_absent=True,
        ),
        finalize=True,
    )
    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=blow.id,
            selected_date=date(2026, 5, 4),
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag_25.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()

    monthly_report = report_service.build_monthly_report(session, team=AttendanceTeam.BLOW, month="2026-05")
    assert monthly_report.grand_total == 95000
    assert monthly_report.total_paid_workdays == 2
    assert monthly_report.rows[0].paid_workdays == 2
    assert monthly_report.rows[0].details["Máy nhỏ"] == "2"
    assert monthly_report.rows[0].details["VK"] == "35000"
