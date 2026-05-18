from __future__ import annotations

from decimal import Decimal

from app.domain.enums import BAO_TO_KG_RATIO, UnitMode, UnitType, allowed_unit_types


def test_unit_mode_values() -> None:
    assert UnitMode.BAO_KG.value == "BAO_KG"
    assert UnitMode.BICH.value == "BICH"


def test_unit_type_values() -> None:
    assert UnitType.BAO.value == "BAO"
    assert UnitType.KG.value == "KG"
    assert UnitType.BICH.value == "BICH"


def test_bao_to_kg_ratio() -> None:
    assert BAO_TO_KG_RATIO == Decimal("25")


def test_allowed_unit_types() -> None:
    assert allowed_unit_types(UnitMode.BAO_KG) == (UnitType.BAO, UnitType.KG)
    assert allowed_unit_types(UnitMode.BICH) == (UnitType.BICH,)

