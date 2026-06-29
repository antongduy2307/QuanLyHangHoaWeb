from __future__ import annotations

from datetime import date

from app.domain.attendance import (
    AttendanceRecordStatus,
    AttendanceTeam,
    AttendanceWorkInputType,
    AttendanceWorkPricingRule,
    calculate_ten_day_period_bounds,
)


def test_attendance_enum_values() -> None:
    assert AttendanceTeam.BLOW.value == "blow"
    assert AttendanceTeam.CUT.value == "cut"
    assert AttendanceRecordStatus.DRAFT.value == "draft"
    assert AttendanceRecordStatus.DONE.value == "done"
    assert AttendanceWorkInputType.TICK.value == "tick"
    assert AttendanceWorkInputType.QUANTITY.value == "quantity"
    assert AttendanceWorkPricingRule.FLAT_TICK.value == "flat_tick"
    assert AttendanceWorkPricingRule.QUANTITY_FULL.value == "quantity_full"
    assert AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA.value == "quantity_excess_over_quota"


def test_calculate_ten_day_period_bounds() -> None:
    assert calculate_ten_day_period_bounds(date(2026, 5, 1)) == calculate_ten_day_period_bounds(date(2026, 5, 10))
    assert calculate_ten_day_period_bounds(date(2026, 5, 11)).start_date == date(2026, 5, 11)
    assert calculate_ten_day_period_bounds(date(2026, 5, 20)).end_date == date(2026, 5, 20)
    assert calculate_ten_day_period_bounds(date(2026, 5, 21)).start_date == date(2026, 5, 21)
    assert calculate_ten_day_period_bounds(date(2024, 2, 29)).end_date == date(2024, 2, 29)
