from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum


class AttendanceTeam(StrEnum):
    BLOW = "blow"
    CUT = "cut"


class AttendanceRecordStatus(StrEnum):
    DRAFT = "draft"
    DONE = "done"


class AttendanceWorkInputType(StrEnum):
    TICK = "tick"
    QUANTITY = "quantity"


class AttendanceWorkPricingRule(StrEnum):
    FLAT_TICK = "flat_tick"
    QUANTITY_FULL = "quantity_full"
    QUANTITY_EXCESS_OVER_QUOTA = "quantity_excess_over_quota"


@dataclass(frozen=True, slots=True)
class AttendancePeriodBounds:
    start_date: date
    end_date: date


def calculate_ten_day_period_bounds(selected_date: date) -> AttendancePeriodBounds:
    if selected_date.day <= 10:
        return AttendancePeriodBounds(
            start_date=selected_date.replace(day=1),
            end_date=selected_date.replace(day=10),
        )
    if selected_date.day <= 20:
        return AttendancePeriodBounds(
            start_date=selected_date.replace(day=11),
            end_date=selected_date.replace(day=20),
        )
    return AttendancePeriodBounds(
        start_date=selected_date.replace(day=21),
        end_date=selected_date.replace(day=monthrange(selected_date.year, selected_date.month)[1]),
    )


BLOW_QUANTITY_STEP = Decimal("0.5")
GLOVE_EXCLUSIVE_GROUP = "glove"
DEFAULT_EXCESS_QUOTA = Decimal("3")


def to_decimal_quantity(value: Decimal | int | str) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def round_attendance_money(value: Decimal | int | str) -> Decimal:
    decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
    return decimal_value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
