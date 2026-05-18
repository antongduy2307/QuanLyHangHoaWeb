from __future__ import annotations

from decimal import Decimal
from enum import StrEnum


class UnitMode(StrEnum):
    BAO_KG = "BAO_KG"
    BICH = "BICH"


class UnitType(StrEnum):
    BAO = "BAO"
    KG = "KG"
    BICH = "BICH"


BAO_TO_KG_RATIO = Decimal("25")

UNIT_TYPES_BY_MODE: dict[UnitMode, tuple[UnitType, ...]] = {
    UnitMode.BAO_KG: (UnitType.BAO, UnitType.KG),
    UnitMode.BICH: (UnitType.BICH,),
}


def allowed_unit_types(unit_mode: UnitMode) -> tuple[UnitType, ...]:
    return UNIT_TYPES_BY_MODE[unit_mode]

