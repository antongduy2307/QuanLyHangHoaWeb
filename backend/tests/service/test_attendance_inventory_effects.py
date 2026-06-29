from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.attendance_inventory_diagnostic_service import AttendanceInventoryDiagnosticService
from app.application.attendance_service import (
    AttendanceConfigService,
    AttendanceCutLogInput,
    AttendanceDayEntrySavePayload,
    AttendanceDayEntryService,
    AttendanceEmployeeService,
    AttendanceExtraCutLogInput,
    AttendancePeriodService,
)
from app.application.inventory_service import InventoryService
from app.domain.attendance import AttendanceTeam
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.attendance import AttendanceBagType, AttendanceInventoryEffect, AttendancePeriod
from app.infrastructure.db.models.inventory import InventoryBalance


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


def create_product(session: Session, *, code: str, name: str, unit_mode: UnitMode) -> int:
    product = InventoryService().create_product(
        session,
        product_code_base=code,
        product_name=name,
        unit_mode=unit_mode,
        enabled_prices={UnitType.BAO: "100.00"} if unit_mode == UnitMode.BAO_KG else {UnitType.BICH: "5.00"},
    )
    session.flush()
    return product.id


def create_linked_bag_type(
    session: Session,
    *,
    name: str,
    product_id: int,
    quota_quantity: int,
    excess_unit_price: int,
    is_product_linked: bool = True,
    is_excluded_from_attendance: bool = False,
    is_legacy: bool = False,
) -> AttendanceBagType:
    bag_type = AttendanceConfigService().create_bag_type(
        session,
        name=name,
        product_id=product_id if is_product_linked else None,
        source_product_name_snapshot=name,
        quota_quantity=quota_quantity,
        excess_unit_price=excess_unit_price,
        is_product_linked=is_product_linked,
        is_excluded_from_attendance=is_excluded_from_attendance,
        is_legacy=is_legacy,
    )
    session.flush()
    return bag_type


def inventory_quantity(session: Session, product_id: int) -> tuple[Decimal | None, Decimal | None]:
    balance = session.scalars(select(InventoryBalance).where(InventoryBalance.product_id == product_id)).one()
    return balance.on_hand_bao_decimal, balance.on_hand_bich_integer


def effect_rows(session: Session, daily_record_id: int) -> list[AttendanceInventoryEffect]:
    return list(session.scalars(select(AttendanceInventoryEffect).where(AttendanceInventoryEffect.daily_record_id == daily_record_id)).all())


def test_draft_cut_record_does_not_change_inventory(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Draft", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-DRAFT", name="Cut Draft Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao Draft", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    session.commit()

    result = AttendanceDayEntryService().save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=False,
    )
    session.commit()

    assert result.status == "draft"
    assert inventory_quantity(session, product_id) == (Decimal("0"), None)
    assert effect_rows(session, result.record_id) == []


def test_finalized_cut_record_increases_inventory_and_maps_bao(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Done", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-BAO", name="Cut Bao Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao 25kg", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    session.commit()

    result = AttendanceDayEntryService().save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10.5")],
        ),
        finalize=True,
    )
    session.commit()

    assert inventory_quantity(session, product_id) == (Decimal("10.500"), None)
    effects = effect_rows(session, result.record_id)
    assert len(effects) == 1
    assert effects[0].unit_type == UnitType.BAO.value
    assert effects[0].quantity_delta == Decimal("10.500")


def test_finalized_extra_cut_vk_increases_inventory_and_maps_bich(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Blow VK", team=AttendanceTeam.BLOW)
    product_id = create_product(session, code="VK-BICH", name="VK Bich Product", unit_mode=UnitMode.BICH)
    bag_type = create_linked_bag_type(session, name="VK Bich", product_id=product_id, quota_quantity=25, excess_unit_price=3500)
    session.commit()

    result = AttendanceDayEntryService().save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag_type.id, quantity="4.25")],
        ),
        finalize=True,
    )
    session.commit()

    assert inventory_quantity(session, product_id) == (None, Decimal("4.250"))
    effects = effect_rows(session, result.record_id)
    assert len(effects) == 1
    assert effects[0].unit_type == UnitType.BICH.value


def test_absent_after_finalized_reverses_effects(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Absent", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-ABSENT", name="Cut Absent Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao Reverse", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    service = AttendanceDayEntryService()
    session.commit()

    finalized = service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()
    assert inventory_quantity(session, product_id) == (Decimal("10.000"), None)

    absent = service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(employee_id=employee.id, selected_date=date(2026, 5, 6), is_absent=True),
        finalize=True,
    )
    session.commit()

    assert absent.is_absent is True
    assert inventory_quantity(session, product_id) == (Decimal("0.000"), None)
    assert effect_rows(session, finalized.record_id) == []


def test_refinalize_changed_quantity_reconciles_effects_idempotently(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Edit", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-EDIT", name="Cut Edit Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao Edit", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    service = AttendanceDayEntryService()
    session.commit()

    initial = service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()
    assert inventory_quantity(session, product_id) == (Decimal("10.000"), None)

    updated = service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="12")],
        ),
        finalize=True,
    )
    session.commit()

    assert updated.record_id == initial.record_id
    assert inventory_quantity(session, product_id) == (Decimal("12.000"), None)
    effects = effect_rows(session, updated.record_id)
    assert len(effects) == 1
    assert effects[0].quantity_delta == Decimal("12.000")


def test_locked_period_blocks_inventory_affecting_edits(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Locked", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-LOCK", name="Cut Lock Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao Lock", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    service = AttendanceDayEntryService()
    period_service = AttendancePeriodService()
    session.commit()

    service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()
    period = period_service.ensure_period_for_date(session, date(2026, 5, 6))
    period_service.set_period_locked(session, period.id, locked=True)
    session.commit()

    with pytest.raises(ValidationError):
        service.save_day_entry(
            session,
            payload=AttendanceDayEntrySavePayload(
                employee_id=employee.id,
                selected_date=date(2026, 5, 6),
                cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="12")],
            ),
            finalize=True,
        )


def test_missing_product_link_and_excluded_legacy_items_are_rejected_for_new_entries(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Validation", team=AttendanceTeam.CUT)
    plain_product_id = create_product(session, code="CUT-VALID-PLAIN", name="Cut Validation Plain Product", unit_mode=UnitMode.BAO_KG)
    excluded_product_id = create_product(session, code="CUT-VALID-EXCLUDED", name="Cut Validation Excluded Product", unit_mode=UnitMode.BAO_KG)
    legacy_product_id = create_product(session, code="CUT-VALID-LEGACY", name="Cut Validation Legacy Product", unit_mode=UnitMode.BAO_KG)
    plain_bag = create_linked_bag_type(session, name="Plain", product_id=plain_product_id, quota_quantity=20, excess_unit_price=10000, is_product_linked=False)
    excluded_bag = create_linked_bag_type(session, name="Excluded", product_id=excluded_product_id, quota_quantity=20, excess_unit_price=10000, is_excluded_from_attendance=True)
    legacy_bag = create_linked_bag_type(session, name="Legacy", product_id=legacy_product_id, quota_quantity=20, excess_unit_price=10000, is_legacy=True)
    service = AttendanceDayEntryService()
    session.commit()

    for bag in (plain_bag, excluded_bag, legacy_bag):
        with pytest.raises(ValidationError):
            service.save_day_entry(
                session,
                payload=AttendanceDayEntrySavePayload(
                    employee_id=employee.id,
                    selected_date=date(2026, 5, 6),
                    cut_work=[AttendanceCutLogInput(bag_type_id=bag.id, quantity="10")],
                ),
                finalize=True,
            )


def test_diagnostics_detect_missing_and_mismatched_effects(session: Session) -> None:
    employee = AttendanceEmployeeService().create_employee(session, display_name="Cut Diagnostic", team=AttendanceTeam.CUT)
    product_id = create_product(session, code="CUT-DIAG", name="Cut Diag Product", unit_mode=UnitMode.BAO_KG)
    wrong_product_id = create_product(session, code="CUT-DIAG-WRONG", name="Cut Wrong Product", unit_mode=UnitMode.BAO_KG)
    bag_type = create_linked_bag_type(session, name="Bao Diag", product_id=product_id, quota_quantity=20, excess_unit_price=10000)
    service = AttendanceDayEntryService()
    diagnostics = AttendanceInventoryDiagnosticService()
    session.commit()

    result = service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()

    effect = effect_rows(session, result.record_id)[0]
    session.delete(effect)
    session.commit()
    issues = diagnostics.list_issues(session)
    assert any(issue.issue_type == "finalized_record_missing_inventory_effect" for issue in issues)

    service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_type.id, quantity="10")],
        ),
        finalize=True,
    )
    session.commit()

    effect = effect_rows(session, result.record_id)[0]
    effect.product_id = wrong_product_id
    session.commit()
    issues = diagnostics.list_issues(session)
    assert any(issue.issue_type == "effect_product_mismatch" for issue in issues)
