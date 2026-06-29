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
    AttendanceExtraCutLogInput,
    LEGACY_BLOW_DEFAULT_WORK_TYPES,
    AttendancePeriodService,
    AttendanceWorkLogInput,
)
from app.application.inventory_service import InventoryService
from app.application.auth_service import AuthService
from app.domain.attendance import (
    GLOVE_EXCLUSIVE_GROUP,
    AttendanceRecordStatus,
    AttendanceTeam,
    AttendanceWorkInputType,
    AttendanceWorkPricingRule,
)
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ConflictError, ValidationError
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


@pytest.fixture
def employee_service() -> AttendanceEmployeeService:
    return AttendanceEmployeeService()


@pytest.fixture
def period_service() -> AttendancePeriodService:
    return AttendancePeriodService()


@pytest.fixture
def config_service() -> AttendanceConfigService:
    return AttendanceConfigService()


@pytest.fixture
def day_entry_service() -> AttendanceDayEntryService:
    return AttendanceDayEntryService()


def create_employee(session: Session, employee_service: AttendanceEmployeeService, *, name: str, team: AttendanceTeam, is_active: bool = True):
    employee = employee_service.create_employee(session, display_name=name, team=team, is_active=is_active)
    session.flush()
    return employee


def create_work_type(
    session: Session,
    config_service: AttendanceConfigService,
    *,
    name: str,
    input_type: AttendanceWorkInputType,
    pricing_rule: AttendanceWorkPricingRule,
    unit_price: Decimal | int | str,
    quota_quantity: Decimal | int | str | None = None,
    exclusive_group: str | None = None,
):
    work_type = config_service.create_work_type(
        session,
        name=name,
        input_type=input_type,
        pricing_rule=pricing_rule,
        unit_price=unit_price,
        quota_quantity=quota_quantity,
        exclusive_group=exclusive_group,
    )
    session.flush()
    return work_type


def create_bag_type(
    session: Session,
    config_service: AttendanceConfigService,
    *,
    name: str,
    quota_quantity: Decimal | int | str,
    excess_unit_price: Decimal | int | str,
    is_product_linked: bool = True,
    is_excluded_from_attendance: bool = False,
    is_legacy: bool = False,
):
    product_id = None
    if is_product_linked:
        product = InventoryService().create_product(
            session,
            product_code_base=f"{name}-code",
            product_name=f"{name} Product",
            unit_mode=UnitMode.BAO_KG,
            enabled_prices={UnitType.BAO: "100.00"},
        )
        product_id = product.id
    bag_type = config_service.create_bag_type(
        session,
        name=name,
        quota_quantity=quota_quantity,
        excess_unit_price=excess_unit_price,
        is_product_linked=is_product_linked,
        is_excluded_from_attendance=is_excluded_from_attendance,
        is_legacy=is_legacy,
        product_id=product_id,
        source_product_name_snapshot=f"{name} Product" if product_id is not None else None,
    )
    session.flush()
    return bag_type


def test_create_list_update_and_delete_employee(session: Session, employee_service: AttendanceEmployeeService) -> None:
    employee = employee_service.create_employee(session, display_name="Worker A", team=AttendanceTeam.BLOW)
    session.commit()

    listed = employee_service.list_employees(session)
    assert [row.display_name for row in listed] == ["Worker A"]
    assert listed[0].team == AttendanceTeam.BLOW.value

    updated = employee_service.update_employee(
        session,
        employee.id,
        display_name="Worker B",
        team=AttendanceTeam.CUT,
        is_active=False,
    )
    session.commit()

    assert updated.display_name == "Worker B"
    assert updated.team == AttendanceTeam.CUT.value
    assert updated.is_active is False

    result = employee_service.delete_employee(session, employee.id)
    session.commit()

    assert result.action == "hard_deleted"
    assert employee_service.list_employees(session, include_inactive=True) == []


def test_search_include_inactive_and_team_filter(session: Session, employee_service: AttendanceEmployeeService) -> None:
    employee_service.create_employee(session, display_name="Alpha Blow", team=AttendanceTeam.BLOW)
    employee_service.create_employee(session, display_name="Beta Cut", team=AttendanceTeam.CUT, is_active=False)
    session.commit()

    default_rows = employee_service.list_employees(session)
    search_rows = employee_service.list_employees(session, search="Alpha")
    inactive_rows = employee_service.list_employees(session, include_inactive=True)
    cut_rows = employee_service.list_employees(session, include_inactive=True, team=AttendanceTeam.CUT)

    assert [row.display_name for row in default_rows] == ["Alpha Blow"]
    assert [row.display_name for row in search_rows] == ["Alpha Blow"]
    assert [row.display_name for row in inactive_rows] == ["Alpha Blow", "Beta Cut"]
    assert [row.display_name for row in cut_rows] == ["Beta Cut"]


def test_employee_display_name_is_globally_unique(session: Session, employee_service: AttendanceEmployeeService) -> None:
    employee_service.create_employee(session, display_name="Unique Name", team=AttendanceTeam.BLOW)
    session.commit()

    with pytest.raises(ConflictError):
        employee_service.create_employee(session, display_name="Unique Name", team=AttendanceTeam.CUT)


def test_create_employee_can_link_user(session: Session, employee_service: AttendanceEmployeeService) -> None:
    user = AuthService().create_user(
        session,
        username="attendance-user",
        password="strong-password",
        display_name="Attendance User",
        role="attendance_manager",
    )
    session.commit()

    employee = employee_service.create_employee(
        session,
        display_name="Linked Worker",
        team=AttendanceTeam.BLOW,
        user_id=user.id,
    )
    session.commit()

    assert employee.user_id == user.id


def test_calculate_ten_day_period_bounds(period_service: AttendancePeriodService) -> None:
    assert period_service.calculate_period_bounds(date(2026, 5, 1)) == period_service.calculate_period_bounds(date(2026, 5, 10))
    assert period_service.calculate_period_bounds(date(2026, 5, 1)).start_date == date(2026, 5, 1)
    assert period_service.calculate_period_bounds(date(2026, 5, 10)).end_date == date(2026, 5, 10)
    assert period_service.calculate_period_bounds(date(2026, 5, 11)).start_date == date(2026, 5, 11)
    assert period_service.calculate_period_bounds(date(2026, 5, 20)).end_date == date(2026, 5, 20)
    assert period_service.calculate_period_bounds(date(2026, 5, 21)).start_date == date(2026, 5, 21)
    assert period_service.calculate_period_bounds(date(2026, 5, 31)).end_date == date(2026, 5, 31)
    assert period_service.calculate_period_bounds(date(2024, 2, 29)).end_date == date(2024, 2, 29)
    assert period_service.calculate_period_bounds(date(2025, 2, 28)).end_date == date(2025, 2, 28)


def test_ensure_period_for_date_is_idempotent_and_can_lock(session: Session, period_service: AttendancePeriodService) -> None:
    first = period_service.ensure_period_for_date(session, date(2026, 5, 6))
    second = period_service.ensure_period_for_date(session, date(2026, 5, 8))
    session.commit()

    assert first.id == second.id
    assert first.start_date == date(2026, 5, 1)
    assert first.end_date == date(2026, 5, 10)

    period_service.set_period_locked(session, first.id, locked=True)
    session.commit()
    assert period_service.get_period(session, first.id).locked is True

    unlocked = period_service.set_period_locked(session, first.id, locked=False)
    session.commit()

    assert unlocked.locked is False


def test_absent_clears_logs_and_zeroes_total(
    session: Session,
    employee_service: AttendanceEmployeeService,
    config_service: AttendanceConfigService,
    day_entry_service: AttendanceDayEntryService,
) -> None:
    employee = create_employee(session, employee_service, name="Blow A", team=AttendanceTeam.BLOW)
    work_type = create_work_type(
        session,
        config_service,
        name="May nho",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )
    bag_type = create_bag_type(session, config_service, name="Bao 25kg", quota_quantity=25, excess_unit_price=3500)

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[AttendanceWorkLogInput(work_type_id=work_type.id, quantity=Decimal("2"))],
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag_type.id, quantity=Decimal("10"))],
        ),
        finalize=True,
    )
    session.commit()

    result = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            is_absent=True,
        ),
        finalize=True,
    )
    session.commit()

    assert result.is_absent is True
    assert result.total_amount_snapshot == Decimal("0")
    entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 6))
    assert entry.work_logs == []
    assert entry.cut_logs == []
    assert entry.extra_cut_logs == []
    assert entry.record_status == AttendanceRecordStatus.DONE.value
    assert entry.status == "absent"


def test_period_lock_blocks_edits(
    session: Session,
    employee_service: AttendanceEmployeeService,
    config_service: AttendanceConfigService,
    period_service: AttendancePeriodService,
    day_entry_service: AttendanceDayEntryService,
) -> None:
    employee = create_employee(session, employee_service, name="Blow Locked", team=AttendanceTeam.BLOW)
    work_type = create_work_type(
        session,
        config_service,
        name="Locked Qty",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )
    period = period_service.ensure_period_for_date(session, date(2026, 5, 6))
    period_service.set_period_locked(session, period.id, locked=True)
    session.commit()

    with pytest.raises(ValidationError):
        day_entry_service.save_day_entry(
            session,
            payload=AttendanceDayEntrySavePayload(
                employee_id=employee.id,
                selected_date=date(2026, 5, 6),
                blow_work=[AttendanceWorkLogInput(work_type_id=work_type.id, quantity=Decimal("1"))],
            ),
            finalize=False,
        )


def test_blow_tick_and_quantity_work(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Blow Mixed", team=AttendanceTeam.BLOW)
    tick_type = create_work_type(
        session,
        config_service,
        name="Tick Work",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=20000,
    )
    qty_type = create_work_type(
        session,
        config_service,
        name="Qty Work",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )

    result = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[
                AttendanceWorkLogInput(work_type_id=tick_type.id, quantity=None),
                AttendanceWorkLogInput(work_type_id=qty_type.id, quantity=Decimal("8.5")),
            ],
        ),
        finalize=True,
    )
    session.commit()

    assert result.total_amount_snapshot == Decimal("275000")
    entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 6))
    assert len(entry.work_logs) == 2
    assert {log.work_type_id: log.quantity for log in entry.work_logs} == {tick_type.id: Decimal("1"), qty_type.id: Decimal("8.5")}


def test_thua_may_excess_over_quota_3(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Thua May", team=AttendanceTeam.BLOW)
    quota_type = create_work_type(
        session,
        config_service,
        name="Thua may",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA,
        unit_price=30000,
        quota_quantity=3,
    )

    below = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[AttendanceWorkLogInput(work_type_id=quota_type.id, quantity=Decimal("2.5"))],
        ),
        finalize=False,
    )
    session.commit()
    assert below.total_amount_snapshot == Decimal("0")

    above = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[AttendanceWorkLogInput(work_type_id=quota_type.id, quantity=Decimal("5"))],
        ),
        finalize=True,
    )
    session.commit()
    assert above.total_amount_snapshot == Decimal("60000")


def test_glove_exclusivity(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Glove Blow", team=AttendanceTeam.BLOW)
    glove_1 = create_work_type(
        session,
        config_service,
        name="Glove 1",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=30000,
        exclusive_group=GLOVE_EXCLUSIVE_GROUP,
    )
    glove_2 = create_work_type(
        session,
        config_service,
        name="Glove 2",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=50000,
        exclusive_group=GLOVE_EXCLUSIVE_GROUP,
    )

    with pytest.raises(ValidationError):
        day_entry_service.save_day_entry(
            session,
            payload=AttendanceDayEntrySavePayload(
                employee_id=employee.id,
                selected_date=date(2026, 5, 6),
                blow_work=[
                    AttendanceWorkLogInput(work_type_id=glove_1.id),
                    AttendanceWorkLogInput(work_type_id=glove_2.id),
                ],
            ),
            finalize=True,
        )


def test_cut_quota_bonus_scenarios(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Cut Worker", team=AttendanceTeam.CUT)
    bag_25 = create_bag_type(session, config_service, name="Bao 25kg", quota_quantity=20, excess_unit_price=10000)
    bag_50 = create_bag_type(session, config_service, name="Bao 50kg", quota_quantity=30, excess_unit_price=20000)

    exact_zero = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag_25.id, quantity=Decimal("20"))],
        ),
        finalize=False,
    )
    session.commit()
    assert exact_zero.total_amount_snapshot == Decimal("0")

    split_quota = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[
                AttendanceCutLogInput(bag_type_id=bag_25.id, quantity=Decimal("10")),
                AttendanceCutLogInput(bag_type_id=bag_50.id, quantity=Decimal("20")),
            ],
        ),
        finalize=True,
    )
    session.commit()
    assert split_quota.total_amount_snapshot == Decimal("100000")


def test_cut_decimal_quantity(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Cut Decimal", team=AttendanceTeam.CUT)
    bag = create_bag_type(session, config_service, name="Bao Decimal", quota_quantity=20, excess_unit_price=10000)

    result = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            cut_work=[AttendanceCutLogInput(bag_type_id=bag.id, quantity=Decimal("20.5"))],
        ),
        finalize=True,
    )
    session.commit()

    assert result.total_amount_snapshot == Decimal("5000")
    entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 6))
    assert entry.cut_logs[0].quantity == Decimal("20.5")


def test_blow_extra_cut_vk_parity(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="VK Blow", team=AttendanceTeam.BLOW)
    tick_type = create_work_type(
        session,
        config_service,
        name="Base Tick",
        input_type=AttendanceWorkInputType.TICK,
        pricing_rule=AttendanceWorkPricingRule.FLAT_TICK,
        unit_price=30000,
    )
    bag = create_bag_type(session, config_service, name="VK Bag", quota_quantity=25, excess_unit_price=3500)

    result = day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[AttendanceWorkLogInput(work_type_id=tick_type.id)],
            extra_cut_work=[AttendanceExtraCutLogInput(bag_type_id=bag.id, quantity=Decimal("10.5"))],
        ),
        finalize=True,
    )
    session.commit()

    assert result.total_amount_snapshot == Decimal("66750")
    entry = day_entry_service.get_day_entry(session, employee_id=employee.id, selected_date=date(2026, 5, 6))
    assert entry.extra_cut_logs[0].amount_snapshot == Decimal("36750")


def test_inactive_employee_cannot_be_saved(session: Session, employee_service: AttendanceEmployeeService, config_service: AttendanceConfigService, day_entry_service: AttendanceDayEntryService) -> None:
    employee = create_employee(session, employee_service, name="Inactive Blow", team=AttendanceTeam.BLOW, is_active=False)
    work_type = create_work_type(
        session,
        config_service,
        name="Inactive Qty",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )

    with pytest.raises(ValidationError):
        day_entry_service.save_day_entry(
            session,
            payload=AttendanceDayEntrySavePayload(
                employee_id=employee.id,
                selected_date=date(2026, 5, 6),
                blow_work=[AttendanceWorkLogInput(work_type_id=work_type.id, quantity=Decimal("1"))],
            ),
            finalize=False,
        )


def test_delete_employee_with_daily_record_deactivates(
    session: Session,
    employee_service: AttendanceEmployeeService,
    config_service: AttendanceConfigService,
    day_entry_service: AttendanceDayEntryService,
) -> None:
    employee = create_employee(session, employee_service, name="History Worker", team=AttendanceTeam.BLOW)
    work_type = create_work_type(
        session,
        config_service,
        name="History Qty",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=30000,
    )

    day_entry_service.save_day_entry(
        session,
        payload=AttendanceDayEntrySavePayload(
            employee_id=employee.id,
            selected_date=date(2026, 5, 6),
            blow_work=[AttendanceWorkLogInput(work_type_id=work_type.id, quantity=Decimal("1"))],
        ),
        finalize=True,
    )
    session.commit()

    result = employee_service.delete_employee(session, employee.id)
    session.commit()

    assert result.action == "deactivated"
    stored = employee_service.get_employee(session, employee.id)
    assert stored.is_active is False


def test_seed_creates_exact_default_blow_work_types(session: Session, config_service: AttendanceConfigService) -> None:
    result = config_service.seed_default_blow_work_types(session)
    session.commit()

    assert result.created_count == len(LEGACY_BLOW_DEFAULT_WORK_TYPES)
    rows = config_service.list_work_types(session, include_inactive=True)
    assert [row.name for row in rows] == [spec["name"] for spec in LEGACY_BLOW_DEFAULT_WORK_TYPES]

    thua_may = next(row for row in rows if row.name == "Thừa máy")
    glove_1 = next(row for row in rows if row.name == "Phụ găng 1 máy")
    glove_2 = next(row for row in rows if row.name == "Phụ găng 2 máy")

    assert thua_may.pricing_rule == AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA.value
    assert thua_may.quota_quantity == Decimal("3")
    assert thua_may.unit_price == Decimal("80000")
    assert glove_1.input_type == AttendanceWorkInputType.TICK.value
    assert glove_1.exclusive_group == GLOVE_EXCLUSIVE_GROUP
    assert glove_2.exclusive_group == GLOVE_EXCLUSIVE_GROUP


def test_seed_is_idempotent_and_does_not_duplicate(session: Session, config_service: AttendanceConfigService) -> None:
    first = config_service.seed_default_blow_work_types(session)
    session.commit()
    second = config_service.seed_default_blow_work_types(session)
    session.commit()

    assert first.created_count == len(LEGACY_BLOW_DEFAULT_WORK_TYPES)
    assert second.created_count == 0
    assert second.skipped_count == len(LEGACY_BLOW_DEFAULT_WORK_TYPES)
    assert len(config_service.list_work_types(session, include_inactive=True)) == len(LEGACY_BLOW_DEFAULT_WORK_TYPES)


def test_seed_does_not_overwrite_existing_work_type_values(session: Session, config_service: AttendanceConfigService) -> None:
    config_service.create_work_type(
        session,
        name="Máy nhỏ",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=12345,
    )
    session.commit()

    result = config_service.seed_default_blow_work_types(session)
    session.commit()

    may_nho = next(row for row in config_service.list_work_types(session, include_inactive=True) if row.name == "Máy nhỏ")
    assert may_nho.unit_price == Decimal("12345")
    assert "Máy nhỏ" in result.skipped_names


def test_seed_marks_optional_blow_work_types_inactive_when_already_present(session: Session, config_service: AttendanceConfigService) -> None:
    thong_ca = config_service.create_work_type(
        session,
        name="thông ca",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=130000,
        is_active=True,
    )
    cat_them = config_service.create_work_type(
        session,
        name="cắt thêm bao",
        input_type=AttendanceWorkInputType.QUANTITY,
        pricing_rule=AttendanceWorkPricingRule.QUANTITY_FULL,
        unit_price=10000,
        is_active=True,
    )
    config_service.seed_default_blow_work_types(session)
    session.commit()

    reloaded_thong_ca = config_service.get_work_type(session, thong_ca.id)
    reloaded_cat_them = config_service.get_work_type(session, cat_them.id)
    active_rows = config_service.list_work_types(session, include_inactive=False)

    assert reloaded_thong_ca.is_active is False
    assert reloaded_cat_them.is_active is False
    assert "thông ca" not in [row.name for row in active_rows]
    assert "cắt thêm bao" not in [row.name for row in active_rows]
