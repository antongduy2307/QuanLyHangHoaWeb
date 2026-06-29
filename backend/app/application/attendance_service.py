from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.application.inventory_service import InventoryService
from app.domain.attendance import (
    BLOW_QUANTITY_STEP,
    DEFAULT_EXCESS_QUOTA,
    GLOVE_EXCLUSIVE_GROUP,
    AttendancePeriodBounds,
    AttendanceRecordStatus,
    AttendanceTeam,
    AttendanceWorkInputType,
    AttendanceWorkPricingRule,
    calculate_ten_day_period_bounds,
    round_attendance_money,
    to_decimal_quantity,
)
from app.domain.exceptions import ConflictError, ValidationError
from app.application.attendance_inventory_service import AttendanceInventoryEffectService
from app.infrastructure.db.models.attendance import (
    AttendanceBagType,
    AttendanceCutLog,
    AttendanceDailyRecord,
    AttendanceEmployee,
    AttendanceExtraCutLog,
    AttendancePeriod,
    AttendanceWorkLog,
    AttendanceWorkType,
)
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.repositories.attendance import (
    AttendanceConfigRepository,
    AttendanceDayEntryRepository,
    AttendanceEmployeeRepository,
    AttendancePeriodRepository,
)
from app.infrastructure.db.repositories.auth import AuthRepository


@dataclass(frozen=True, slots=True)
class AttendanceEmployeeDeleteResult:
    employee_id: int
    action: str


@dataclass(frozen=True, slots=True)
class AttendanceWorkTypeSeedResult:
    created_count: int
    skipped_count: int
    created_names: tuple[str, ...]
    skipped_names: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class AttendanceWorkLogInput:
    work_type_id: int
    quantity: Decimal | int | str | None = None


@dataclass(frozen=True, slots=True)
class AttendanceCutLogInput:
    bag_type_id: int
    quantity: Decimal | int | str


@dataclass(frozen=True, slots=True)
class AttendanceExtraCutLogInput:
    bag_type_id: int
    quantity: Decimal | int | str


@dataclass(frozen=True, slots=True)
class AttendanceDayEntrySavePayload:
    employee_id: int
    selected_date: date
    is_absent: bool = False
    blow_work: list[AttendanceWorkLogInput] = field(default_factory=list)
    cut_work: list[AttendanceCutLogInput] = field(default_factory=list)
    extra_cut_work: list[AttendanceExtraCutLogInput] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class AttendanceEmployeeStatusRow:
    id: int
    display_name: str
    team: str
    is_active: bool
    status: str
    record_status: str | None
    is_absent: bool


@dataclass(frozen=True, slots=True)
class AttendanceWorkTypeOption:
    id: int
    name: str
    input_type: str
    pricing_rule: str
    quota_quantity: Decimal | None
    unit_price: Decimal
    exclusive_group: str | None
    is_active: bool


@dataclass(frozen=True, slots=True)
class AttendanceBagTypeOption:
    id: int
    name: str
    product_id: int | None
    product_code_base: str | None
    product_name: str | None
    source_product_name_snapshot: str | None
    quota_quantity: Decimal
    excess_unit_price: Decimal
    is_active: bool
    is_product_linked: bool
    is_excluded_from_attendance: bool
    is_legacy: bool


@dataclass(frozen=True, slots=True)
class AttendanceWorkLogValue:
    work_type_id: int
    quantity: Decimal
    unit_price_snapshot: Decimal
    amount_snapshot: Decimal


@dataclass(frozen=True, slots=True)
class AttendanceCutLogValue:
    bag_type_id: int
    quantity: Decimal
    quota_quantity_snapshot: Decimal | None
    excess_unit_price_snapshot: Decimal
    amount_snapshot: Decimal


@dataclass(frozen=True, slots=True)
class AttendanceExtraCutLogValue:
    bag_type_id: int
    quantity: Decimal
    excess_unit_price_snapshot: Decimal
    amount_snapshot: Decimal


@dataclass(frozen=True, slots=True)
class AttendanceDayEntryView:
    employee_id: int
    display_name: str
    team: str
    selected_date: date
    status: str
    record_status: str | None
    is_absent: bool
    total_amount_snapshot: Decimal
    work_types: list[AttendanceWorkTypeOption] = field(default_factory=list)
    bag_types: list[AttendanceBagTypeOption] = field(default_factory=list)
    work_logs: list[AttendanceWorkLogValue] = field(default_factory=list)
    cut_logs: list[AttendanceCutLogValue] = field(default_factory=list)
    extra_cut_logs: list[AttendanceExtraCutLogValue] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class AttendanceDayEntrySaveResult:
    record_id: int
    status: str
    is_absent: bool
    total_amount_snapshot: Decimal


@dataclass(frozen=True, slots=True)
class AttendanceCutProductSearchResult:
    product_id: int
    product_code_base: str
    product_name: str
    unit_mode: str
    linked_bag_type_id: int | None
    linked_bag_type_name: str | None
    quota_quantity: Decimal | None
    excess_unit_price: Decimal | None
    is_active: bool
    is_excluded_from_attendance: bool
    is_legacy: bool
    is_configured_for_attendance: bool


class AttendanceEmployeeService:
    def __init__(
        self,
        repository: AttendanceEmployeeRepository | None = None,
        auth_repository: AuthRepository | None = None,
    ) -> None:
        self._repository = repository or AttendanceEmployeeRepository()
        self._auth_repository = auth_repository or AuthRepository()

    def list_employees(
        self,
        session: Session,
        *,
        search: str = "",
        include_inactive: bool = False,
        team: AttendanceTeam | None = None,
    ) -> list[AttendanceEmployee]:
        return self._repository.list_employees(
            session,
            search=search,
            include_inactive=include_inactive,
            team=team,
        )

    def get_employee(self, session: Session, employee_id: int) -> AttendanceEmployee:
        return self._repository.get_employee(session, employee_id)

    def create_employee(
        self,
        session: Session,
        *,
        display_name: str,
        team: AttendanceTeam | str,
        is_active: bool = True,
        user_id: int | None = None,
        legacy_employee_id: int | None = None,
    ) -> AttendanceEmployee:
        normalized_name = self._normalize_display_name(display_name)
        normalized_team = self._normalize_team(team)
        normalized_user_id = self._validate_user_id(session, user_id)
        self._ensure_unique_display_name(session, normalized_name)
        self._ensure_unique_user_assignment(session, normalized_user_id)

        employee = AttendanceEmployee(
            display_name=normalized_name,
            team=normalized_team.value,
            is_active=is_active,
            user_id=normalized_user_id,
            legacy_employee_id=legacy_employee_id,
        )
        self._repository.add_employee(session, employee)
        self._flush_with_conflict_translation(session, normalized_name)
        return employee

    def update_employee(
        self,
        session: Session,
        employee_id: int,
        *,
        display_name: str | None = None,
        team: AttendanceTeam | str | None = None,
        is_active: bool | None = None,
        user_id: int | None = None,
        clear_user_id: bool = False,
        legacy_employee_id: int | None = None,
    ) -> AttendanceEmployee:
        employee = self._repository.get_employee_for_update(session, employee_id)

        if display_name is not None:
            normalized_name = self._normalize_display_name(display_name)
            if normalized_name != employee.display_name:
                self._ensure_unique_display_name(session, normalized_name, exclude_employee_id=employee_id)
                employee.display_name = normalized_name

        if team is not None:
            employee.team = self._normalize_team(team).value

        if is_active is not None:
            employee.is_active = is_active

        normalized_user_id = employee.user_id
        if clear_user_id:
            normalized_user_id = None
        elif user_id is not None:
            normalized_user_id = self._validate_user_id(session, user_id)

        if normalized_user_id != employee.user_id:
            self._ensure_unique_user_assignment(session, normalized_user_id, exclude_employee_id=employee_id)
            employee.user_id = normalized_user_id

        if legacy_employee_id is not None:
            employee.legacy_employee_id = legacy_employee_id

        self._flush_with_conflict_translation(session, employee.display_name)
        return employee

    def delete_employee(self, session: Session, employee_id: int) -> AttendanceEmployeeDeleteResult:
        employee = self._repository.get_employee_for_update(session, employee_id)
        if self._repository.has_attendance_history(session, employee_id):
            employee.is_active = False
            session.flush()
            return AttendanceEmployeeDeleteResult(employee_id=employee.id, action="deactivated")

        self._repository.delete_employee(session, employee)
        return AttendanceEmployeeDeleteResult(employee_id=employee_id, action="hard_deleted")

    def _normalize_display_name(self, display_name: str) -> str:
        normalized = (display_name or "").strip()
        if not normalized:
            raise ValidationError("display_name is required.")
        return normalized

    def _normalize_team(self, team: AttendanceTeam | str) -> AttendanceTeam:
        try:
            return team if isinstance(team, AttendanceTeam) else AttendanceTeam(str(team))
        except ValueError as exc:
            raise ValidationError(f"Unknown attendance team: {team}.") from exc

    def _validate_user_id(self, session: Session, user_id: int | None) -> int | None:
        if user_id is None:
            return None
        self._auth_repository.require_user_by_id(session, user_id)
        return user_id

    def _ensure_unique_display_name(
        self,
        session: Session,
        display_name: str,
        *,
        exclude_employee_id: int | None = None,
    ) -> None:
        existing = self._repository.get_employee_by_display_name(session, display_name)
        if existing is None:
            return
        if exclude_employee_id is not None and existing.id == exclude_employee_id:
            return
        raise ConflictError(f"Attendance employee '{display_name}' already exists.")

    def _ensure_unique_user_assignment(
        self,
        session: Session,
        user_id: int | None,
        *,
        exclude_employee_id: int | None = None,
    ) -> None:
        if user_id is None:
            return
        existing = self._repository.get_employee_by_user_id(session, user_id)
        if existing is None:
            return
        if exclude_employee_id is not None and existing.id == exclude_employee_id:
            return
        raise ConflictError(f"User {user_id} is already linked to another attendance employee.")

    def _flush_with_conflict_translation(self, session: Session, display_name: str) -> None:
        try:
            session.flush()
        except IntegrityError as exc:
            raise ConflictError(f"Attendance employee '{display_name}' conflicts with an existing record.") from exc


class AttendancePeriodService:
    def __init__(self, repository: AttendancePeriodRepository | None = None) -> None:
        self._repository = repository or AttendancePeriodRepository()

    def calculate_period_bounds(self, selected_date: date) -> AttendancePeriodBounds:
        return calculate_ten_day_period_bounds(selected_date)

    def ensure_period_for_date(self, session: Session, selected_date: date) -> AttendancePeriod:
        existing = self._repository.find_period_covering_date(session, selected_date)
        if existing is not None:
            return existing

        bounds = self.calculate_period_bounds(selected_date)
        exact = self._repository.find_period_by_bounds(session, bounds.start_date, bounds.end_date)
        if exact is not None:
            return exact

        period = AttendancePeriod(
            start_date=bounds.start_date,
            end_date=bounds.end_date,
            locked=False,
        )
        self._repository.add_period(session, period)
        session.flush()
        return period

    def list_periods(self, session: Session) -> list[AttendancePeriod]:
        return self._repository.list_periods(session)

    def get_period(self, session: Session, period_id: int) -> AttendancePeriod:
        return self._repository.get_period(session, period_id)

    def set_period_locked(self, session: Session, period_id: int, *, locked: bool) -> AttendancePeriod:
        period = self._repository.get_period_for_update(session, period_id)
        period.locked = locked
        session.flush()
        return period


class AttendanceConfigService:
    def __init__(
        self,
        repository: AttendanceConfigRepository | None = None,
        inventory_service: InventoryService | None = None,
    ) -> None:
        self._repository = repository or AttendanceConfigRepository()
        self._inventory_service = inventory_service or InventoryService()

    def list_work_types(self, session: Session, *, include_inactive: bool = False) -> list[AttendanceWorkType]:
        return self._repository.list_work_types(session, include_inactive=include_inactive)

    def get_work_type(self, session: Session, work_type_id: int) -> AttendanceWorkType:
        return self._repository.get_work_type(session, work_type_id)

    def seed_default_blow_work_types(self, session: Session) -> AttendanceWorkTypeSeedResult:
        created_names: list[str] = []
        skipped_names: list[str] = []
        for optional_name in OPTIONAL_BLOW_WORK_TYPE_NAMES:
            existing_optional = self._repository.get_work_type_by_team_name(
                session,
                team=AttendanceTeam.BLOW,
                name=optional_name,
            )
            if existing_optional is not None and existing_optional.is_active:
                existing_optional.is_active = False

        for spec in LEGACY_BLOW_DEFAULT_WORK_TYPES:
            existing = self._repository.get_work_type_by_team_name(
                session,
                team=AttendanceTeam.BLOW,
                name=spec["name"],
            )
            if existing is not None:
                skipped_names.append(spec["name"])
                continue
            work_type = AttendanceWorkType(
                name=spec["name"],
                team=AttendanceTeam.BLOW.value,
                input_type=spec["input_type"].value,
                pricing_rule=spec["pricing_rule"].value,
                quota_quantity=spec["quota_quantity"],
                unit_price=Decimal(str(spec["unit_price"])),
                exclusive_group=spec["exclusive_group"],
                is_active=spec["is_active"],
                legacy_work_type_id=None,
            )
            self._validate_work_type_rules(work_type)
            self._repository.add_work_type(session, work_type)
            created_names.append(spec["name"])

        session.flush()
        return AttendanceWorkTypeSeedResult(
            created_count=len(created_names),
            skipped_count=len(skipped_names),
            created_names=tuple(created_names),
            skipped_names=tuple(skipped_names),
        )

    def create_work_type(
        self,
        session: Session,
        *,
        name: str,
        input_type: AttendanceWorkInputType | str,
        pricing_rule: AttendanceWorkPricingRule | str,
        unit_price: Decimal | int | str,
        quota_quantity: Decimal | int | str | None = None,
        exclusive_group: str | None = None,
        is_active: bool = True,
        legacy_work_type_id: int | None = None,
    ) -> AttendanceWorkType:
        normalized_name = self._normalize_name(name)
        if self._repository.get_work_type_by_team_name(session, team=AttendanceTeam.BLOW, name=normalized_name) is not None:
            raise ConflictError(f"Attendance work type '{normalized_name}' already exists.")

        work_type = AttendanceWorkType(
            name=normalized_name,
            team=AttendanceTeam.BLOW.value,
            input_type=self._normalize_input_type(input_type).value,
            pricing_rule=self._normalize_pricing_rule(pricing_rule).value,
            quota_quantity=None if quota_quantity is None else self._non_negative_decimal(quota_quantity, "quota_quantity"),
            unit_price=self._non_negative_money(unit_price, "unit_price"),
            exclusive_group=self._normalize_optional_text(exclusive_group),
            is_active=is_active,
            legacy_work_type_id=legacy_work_type_id,
        )
        self._validate_work_type_rules(work_type)
        self._repository.add_work_type(session, work_type)
        session.flush()
        return work_type

    def update_work_type(
        self,
        session: Session,
        work_type_id: int,
        *,
        name: str,
        input_type: AttendanceWorkInputType | str,
        pricing_rule: AttendanceWorkPricingRule | str,
        unit_price: Decimal | int | str,
        quota_quantity: Decimal | int | str | None = None,
        exclusive_group: str | None = None,
        is_active: bool = True,
    ) -> AttendanceWorkType:
        work_type = self._repository.get_work_type(session, work_type_id)
        normalized_name = self._normalize_name(name)
        existing = self._repository.get_work_type_by_team_name(session, team=AttendanceTeam.BLOW, name=normalized_name)
        if existing is not None and existing.id != work_type_id:
            raise ConflictError(f"Attendance work type '{normalized_name}' already exists.")

        work_type.name = normalized_name
        work_type.input_type = self._normalize_input_type(input_type).value
        work_type.pricing_rule = self._normalize_pricing_rule(pricing_rule).value
        work_type.unit_price = self._non_negative_money(unit_price, "unit_price")
        work_type.quota_quantity = None if quota_quantity is None else self._non_negative_decimal(quota_quantity, "quota_quantity")
        work_type.exclusive_group = self._normalize_optional_text(exclusive_group)
        work_type.is_active = is_active
        self._validate_work_type_rules(work_type)
        session.flush()
        return work_type

    def list_bag_types(
        self,
        session: Session,
        *,
        include_inactive: bool = False,
        search: str = "",
    ) -> list[AttendanceBagType]:
        return self._repository.list_bag_types(session, include_inactive=include_inactive, search=search)

    def get_bag_type(self, session: Session, bag_type_id: int) -> AttendanceBagType:
        return self._repository.get_bag_type(session, bag_type_id)

    def search_cut_products(
        self,
        session: Session,
        *,
        search: str,
        limit: int = 20,
    ) -> list[AttendanceCutProductSearchResult]:
        needle = search.strip()
        if not needle:
            return []

        pattern = f"%{needle}%"
        statement = (
            select(Product)
            .where(Product.is_active.is_(True))
            .where(or_(Product.product_name.ilike(pattern), Product.product_code_base.ilike(pattern)))
            .order_by(Product.product_name.asc(), Product.id.asc())
            .limit(limit)
        )
        products = list(session.scalars(statement).all())
        bag_types_by_product_id = {
            bag_type.product_id: bag_type
            for bag_type in self._repository.list_bag_types_by_product_ids(session, {product.id for product in products})
            if bag_type.product_id is not None
        }
        return [
            self._build_cut_product_search_result(product, bag_types_by_product_id.get(product.id))
            for product in products
        ]

    def create_bag_type(
        self,
        session: Session,
        *,
        name: str,
        quota_quantity: Decimal | int | str,
        excess_unit_price: Decimal | int | str,
        is_active: bool = True,
        is_product_linked: bool = True,
        is_excluded_from_attendance: bool = False,
        is_legacy: bool = False,
        product_id: int | None = None,
        source_product_name_snapshot: str | None = None,
        legacy_bag_type_id: int | None = None,
    ) -> AttendanceBagType:
        normalized_name = self._normalize_name(name)
        if self._repository.get_bag_type_by_name(session, normalized_name) is not None:
            raise ConflictError(f"Attendance bag type '{normalized_name}' already exists.")
        bag_type = AttendanceBagType(
            name=normalized_name,
            product_id=product_id,
            source_product_name_snapshot=self._normalize_optional_text(source_product_name_snapshot),
            quota_quantity=self._non_negative_decimal(quota_quantity, "quota_quantity"),
            excess_unit_price=self._non_negative_money(excess_unit_price, "excess_unit_price"),
            is_active=is_active,
            is_product_linked=is_product_linked,
            is_excluded_from_attendance=is_excluded_from_attendance,
            is_legacy=is_legacy,
            legacy_bag_type_id=legacy_bag_type_id,
        )
        self._validate_bag_type_product_link(bag_type)
        self._repository.add_bag_type(session, bag_type)
        session.flush()
        return bag_type

    def upsert_bag_type_from_product(
        self,
        session: Session,
        *,
        product_id: int,
        quota_quantity: Decimal | int | str | None = None,
        excess_unit_price: Decimal | int | str | None = None,
    ) -> AttendanceBagType:
        product = self._inventory_service.get_product(session, product_id)
        if not product.is_active:
            raise ValidationError("Inactive products cannot be linked to attendance cut work.")

        bag_type = self._repository.get_bag_type_by_product_id(session, product_id)
        normalized_quota = None if quota_quantity is None else self._non_negative_decimal(quota_quantity, "quota_quantity")
        normalized_excess_price = (
            None if excess_unit_price is None else self._non_negative_money(excess_unit_price, "excess_unit_price")
        )

        if bag_type is None and (normalized_quota is None or normalized_excess_price is None):
            raise ValidationError("Selected product is not configured for attendance. Enter quota and excess price.")

        if bag_type is not None and normalized_quota is None and normalized_excess_price is None:
            if self._is_bag_type_ready_for_day_entry(bag_type):
                return bag_type
            raise ValidationError("Selected product is not configured for attendance. Enter quota and excess price.")

        if normalized_quota is None or normalized_excess_price is None:
            raise ValidationError("Both quota quantity and excess unit price are required.")

        if bag_type is None:
            bag_type = AttendanceBagType(
                name=product.product_name,
                product_id=product.id,
                source_product_name_snapshot=product.product_name,
                quota_quantity=normalized_quota,
                excess_unit_price=normalized_excess_price,
                is_active=True,
                is_product_linked=True,
                is_excluded_from_attendance=False,
                is_legacy=False,
            )
            self._validate_bag_type_product_link(bag_type)
            self._repository.add_bag_type(session, bag_type)
            session.flush()
            return bag_type

        bag_type.name = product.product_name
        bag_type.product_id = product.id
        bag_type.source_product_name_snapshot = product.product_name
        bag_type.quota_quantity = normalized_quota
        bag_type.excess_unit_price = normalized_excess_price
        bag_type.is_active = True
        bag_type.is_product_linked = True
        bag_type.is_excluded_from_attendance = False
        bag_type.is_legacy = False
        self._validate_bag_type_product_link(bag_type)
        session.flush()
        return bag_type

    def update_bag_type(
        self,
        session: Session,
        bag_type_id: int,
        *,
        name: str,
        quota_quantity: Decimal | int | str,
        excess_unit_price: Decimal | int | str,
        is_active: bool,
        is_product_linked: bool,
        is_excluded_from_attendance: bool,
        is_legacy: bool,
        product_id: int | None = None,
        source_product_name_snapshot: str | None = None,
    ) -> AttendanceBagType:
        bag_type = self._repository.get_bag_type(session, bag_type_id)
        normalized_name = self._normalize_name(name)
        existing = self._repository.get_bag_type_by_name(session, normalized_name)
        if existing is not None and existing.id != bag_type_id:
            raise ConflictError(f"Attendance bag type '{normalized_name}' already exists.")
        bag_type.name = normalized_name
        bag_type.product_id = product_id
        bag_type.source_product_name_snapshot = self._normalize_optional_text(source_product_name_snapshot)
        bag_type.quota_quantity = self._non_negative_decimal(quota_quantity, "quota_quantity")
        bag_type.excess_unit_price = self._non_negative_money(excess_unit_price, "excess_unit_price")
        bag_type.is_active = is_active
        bag_type.is_product_linked = is_product_linked
        bag_type.is_excluded_from_attendance = is_excluded_from_attendance
        bag_type.is_legacy = is_legacy
        self._validate_bag_type_product_link(bag_type)
        session.flush()
        return bag_type

    def _build_cut_product_search_result(
        self,
        product: Product,
        bag_type: AttendanceBagType | None,
    ) -> AttendanceCutProductSearchResult:
        return AttendanceCutProductSearchResult(
            product_id=product.id,
            product_code_base=product.product_code_base,
            product_name=product.product_name,
            unit_mode=product.unit_mode,
            linked_bag_type_id=None if bag_type is None else bag_type.id,
            linked_bag_type_name=None if bag_type is None else bag_type.name,
            quota_quantity=None if bag_type is None else Decimal(str(bag_type.quota_quantity)),
            excess_unit_price=None if bag_type is None else Decimal(str(bag_type.excess_unit_price)),
            is_active=False if bag_type is None else bag_type.is_active,
            is_excluded_from_attendance=False if bag_type is None else bag_type.is_excluded_from_attendance,
            is_legacy=False if bag_type is None else bag_type.is_legacy,
            is_configured_for_attendance=False if bag_type is None else self._is_bag_type_ready_for_day_entry(bag_type),
        )

    def _is_bag_type_ready_for_day_entry(self, bag_type: AttendanceBagType) -> bool:
        return (
            bool(bag_type.is_active)
            and bool(bag_type.is_product_linked)
            and bag_type.product_id is not None
            and not bool(bag_type.is_excluded_from_attendance)
            and not bool(bag_type.is_legacy)
            and Decimal(str(bag_type.quota_quantity)) > 0
            and Decimal(str(bag_type.excess_unit_price)) > 0
        )

    def _normalize_name(self, name: str) -> str:
        normalized = (name or "").strip()
        if not normalized:
            raise ValidationError("name is required.")
        return normalized

    def _normalize_input_type(self, input_type: AttendanceWorkInputType | str) -> AttendanceWorkInputType:
        try:
            return input_type if isinstance(input_type, AttendanceWorkInputType) else AttendanceWorkInputType(str(input_type))
        except ValueError as exc:
            raise ValidationError(f"Unknown attendance work input type: {input_type}.") from exc

    def _normalize_pricing_rule(self, pricing_rule: AttendanceWorkPricingRule | str) -> AttendanceWorkPricingRule:
        try:
            return (
                pricing_rule
                if isinstance(pricing_rule, AttendanceWorkPricingRule)
                else AttendanceWorkPricingRule(str(pricing_rule))
            )
        except ValueError as exc:
            raise ValidationError(f"Unknown attendance work pricing rule: {pricing_rule}.") from exc

    def _non_negative_decimal(self, value: Decimal | int | str, field_name: str) -> Decimal:
        normalized = to_decimal_quantity(value)
        if normalized < 0:
            raise ValidationError(f"{field_name} must be non-negative.")
        return normalized

    def _non_negative_money(self, value: Decimal | int | str, field_name: str) -> Decimal:
        normalized = to_decimal_quantity(value)
        if normalized < 0:
            raise ValidationError(f"{field_name} must be non-negative.")
        return round_attendance_money(normalized)

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _validate_work_type_rules(self, work_type: AttendanceWorkType) -> None:
        if work_type.input_type == AttendanceWorkInputType.TICK.value and work_type.pricing_rule != AttendanceWorkPricingRule.FLAT_TICK.value:
            raise ValidationError("Tick work types must use the flat_tick pricing rule.")
        if work_type.pricing_rule == AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA.value:
            if work_type.quota_quantity is None:
                raise ValidationError("Excess-over-quota work types require quota_quantity.")
        if work_type.pricing_rule != AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA.value:
            if work_type.quota_quantity is not None and work_type.quota_quantity < 0:
                raise ValidationError("quota_quantity must be non-negative.")

    def _validate_bag_type_product_link(self, bag_type: AttendanceBagType) -> None:
        if bag_type.is_product_linked and bag_type.product_id is None:
            raise ValidationError("Product-linked cut work items require product_id.")
        if not bag_type.is_product_linked and bag_type.product_id is not None:
            raise ValidationError("Non product-linked cut work items cannot keep product_id.")


LEGACY_BLOW_DEFAULT_WORK_TYPES: tuple[dict[str, object], ...] = (
    {
        "name": "Thừa máy",
        "input_type": AttendanceWorkInputType.QUANTITY,
        "pricing_rule": AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA,
        "quota_quantity": Decimal("3"),
        "unit_price": Decimal("80000"),
        "exclusive_group": None,
        "is_active": True,
    },
    {
        "name": "Máy nhỏ",
        "input_type": AttendanceWorkInputType.QUANTITY,
        "pricing_rule": AttendanceWorkPricingRule.QUANTITY_FULL,
        "quota_quantity": None,
        "unit_price": Decimal("30000"),
        "exclusive_group": None,
        "is_active": True,
    },
    {
        "name": "Máy to",
        "input_type": AttendanceWorkInputType.QUANTITY,
        "pricing_rule": AttendanceWorkPricingRule.QUANTITY_FULL,
        "quota_quantity": None,
        "unit_price": Decimal("40000"),
        "exclusive_group": None,
        "is_active": True,
    },
    {
        "name": "Phụ cắt",
        "input_type": AttendanceWorkInputType.QUANTITY,
        "pricing_rule": AttendanceWorkPricingRule.QUANTITY_FULL,
        "quota_quantity": None,
        "unit_price": Decimal("50000"),
        "exclusive_group": None,
        "is_active": True,
    },
    {
        "name": "Phụ găng 1 máy",
        "input_type": AttendanceWorkInputType.TICK,
        "pricing_rule": AttendanceWorkPricingRule.FLAT_TICK,
        "quota_quantity": None,
        "unit_price": Decimal("30000"),
        "exclusive_group": GLOVE_EXCLUSIVE_GROUP,
        "is_active": True,
    },
    {
        "name": "Phụ găng 2 máy",
        "input_type": AttendanceWorkInputType.TICK,
        "pricing_rule": AttendanceWorkPricingRule.FLAT_TICK,
        "quota_quantity": None,
        "unit_price": Decimal("50000"),
        "exclusive_group": GLOVE_EXCLUSIVE_GROUP,
        "is_active": True,
    },
)

OPTIONAL_BLOW_WORK_TYPE_NAMES = frozenset({"thông ca", "cắt thêm bao"})


class AttendanceDayEntryService:
    def __init__(
        self,
        employee_repository: AttendanceEmployeeRepository | None = None,
        period_repository: AttendancePeriodRepository | None = None,
        config_repository: AttendanceConfigRepository | None = None,
        day_entry_repository: AttendanceDayEntryRepository | None = None,
        inventory_effect_service: AttendanceInventoryEffectService | None = None,
    ) -> None:
        self._employee_repository = employee_repository or AttendanceEmployeeRepository()
        self._period_repository = period_repository or AttendancePeriodRepository()
        self._config_repository = config_repository or AttendanceConfigRepository()
        self._day_entry_repository = day_entry_repository or AttendanceDayEntryRepository()
        self._inventory_effect_service = inventory_effect_service or AttendanceInventoryEffectService()

    def list_day_entry_employees(self, session: Session, *, selected_date: date) -> list[AttendanceEmployeeStatusRow]:
        employees = self._employee_repository.list_active_employees(session)
        records = self._day_entry_repository.list_daily_records_for_date(session, selected_date)
        record_by_employee_id = {record.employee_id: record for record in records}
        return [
            AttendanceEmployeeStatusRow(
                id=employee.id,
                display_name=employee.display_name,
                team=employee.team,
                is_active=employee.is_active,
                status=self._status_from_record(record_by_employee_id.get(employee.id)),
                record_status=None if record_by_employee_id.get(employee.id) is None else record_by_employee_id[employee.id].status,
                is_absent=False if record_by_employee_id.get(employee.id) is None else record_by_employee_id[employee.id].is_absent,
            )
            for employee in employees
        ]

    def get_day_entry(self, session: Session, *, employee_id: int, selected_date: date) -> AttendanceDayEntryView:
        employee = self._employee_repository.get_employee(session, employee_id)
        record = self._day_entry_repository.get_daily_record(session, employee_id, selected_date)

        work_logs = [] if record is None else list(record.work_logs)
        cut_logs = [] if record is None else list(record.cut_logs)
        extra_cut_logs = [] if record is None else list(record.extra_cut_logs)
        work_type_ids = {log.work_type_id for log in work_logs}
        bag_type_ids = {log.bag_type_id for log in cut_logs}
        bag_type_ids.update(log.bag_type_id for log in extra_cut_logs)

        work_types = self._config_repository.list_work_types_for_entry(session, include_ids=work_type_ids)
        bag_types = self._config_repository.list_bag_types_for_entry(session, include_ids=bag_type_ids)

        return AttendanceDayEntryView(
            employee_id=employee.id,
            display_name=employee.display_name,
            team=employee.team,
            selected_date=selected_date,
            status=self._status_from_record(record),
            record_status=None if record is None else record.status,
            is_absent=False if record is None else record.is_absent,
            total_amount_snapshot=Decimal("0") if record is None else Decimal(str(record.total_amount_snapshot)),
            work_types=[
                AttendanceWorkTypeOption(
                    id=work_type.id,
                    name=work_type.name,
                    input_type=work_type.input_type,
                    pricing_rule=work_type.pricing_rule,
                    quota_quantity=None if work_type.quota_quantity is None else Decimal(str(work_type.quota_quantity)),
                    unit_price=Decimal(str(work_type.unit_price)),
                    exclusive_group=work_type.exclusive_group,
                    is_active=work_type.is_active,
                )
                for work_type in work_types
            ],
            bag_types=[
                AttendanceBagTypeOption(
                    id=bag_type.id,
                    name=bag_type.name,
                    product_id=bag_type.product_id,
                    product_code_base=None if bag_type.product is None else bag_type.product.product_code_base,
                    product_name=None if bag_type.product is None else bag_type.product.product_name,
                    source_product_name_snapshot=bag_type.source_product_name_snapshot,
                    quota_quantity=Decimal(str(bag_type.quota_quantity)),
                    excess_unit_price=Decimal(str(bag_type.excess_unit_price)),
                    is_active=bag_type.is_active,
                    is_product_linked=bag_type.is_product_linked,
                    is_excluded_from_attendance=bag_type.is_excluded_from_attendance,
                    is_legacy=bag_type.is_legacy,
                )
                for bag_type in bag_types
            ],
            work_logs=[
                AttendanceWorkLogValue(
                    work_type_id=log.work_type_id,
                    quantity=Decimal(str(log.quantity)),
                    unit_price_snapshot=Decimal(str(log.unit_price_snapshot)),
                    amount_snapshot=Decimal(str(log.amount_snapshot)),
                )
                for log in work_logs
            ],
            cut_logs=[
                AttendanceCutLogValue(
                    bag_type_id=log.bag_type_id,
                    quantity=Decimal(str(log.quantity)),
                    quota_quantity_snapshot=None
                    if log.quota_quantity_snapshot is None
                    else Decimal(str(log.quota_quantity_snapshot)),
                    excess_unit_price_snapshot=Decimal(str(log.excess_unit_price_snapshot)),
                    amount_snapshot=Decimal(str(log.amount_snapshot)),
                )
                for log in cut_logs
            ],
            extra_cut_logs=[
                AttendanceExtraCutLogValue(
                    bag_type_id=log.bag_type_id,
                    quantity=Decimal(str(log.quantity)),
                    excess_unit_price_snapshot=Decimal(str(log.excess_unit_price_snapshot)),
                    amount_snapshot=Decimal(str(log.amount_snapshot)),
                )
                for log in extra_cut_logs
            ],
        )

    def save_day_entry(
        self,
        session: Session,
        *,
        payload: AttendanceDayEntrySavePayload,
        finalize: bool,
    ) -> AttendanceDayEntrySaveResult:
        employee = self._employee_repository.get_employee(session, payload.employee_id)
        if not employee.is_active:
            raise ValidationError("Inactive attendance employees cannot be saved.")

        period = self._ensure_period_for_date(session, payload.selected_date)
        record = self._day_entry_repository.get_daily_record(session, employee.id, payload.selected_date)
        if record is None:
            record = self._day_entry_repository.create_daily_record(
                session,
                employee_id=employee.id,
                work_date=payload.selected_date,
                period_id=period.id,
            )
        elif record.period.locked:
            raise ValidationError("Locked attendance periods cannot be edited.")

        if period.locked:
            raise ValidationError("Locked attendance periods cannot be edited.")

        record.period_id = period.id
        record.status = AttendanceRecordStatus.DRAFT.value
        record.work_logs.clear()
        record.cut_logs.clear()
        record.extra_cut_logs.clear()
        session.flush()

        if payload.is_absent:
            record.is_absent = True
            record.total_amount_snapshot = Decimal("0")
        else:
            record.is_absent = False
            total_amount = Decimal("0")
            if employee.team == AttendanceTeam.BLOW.value:
                total_amount = self._apply_blow_payload(session, record, payload)
            elif employee.team == AttendanceTeam.CUT.value:
                total_amount = self._apply_cut_payload(session, record, payload)
            else:
                raise ValidationError(f"Unknown attendance team: {employee.team}.")
            record.total_amount_snapshot = round_attendance_money(total_amount)

        record.status = AttendanceRecordStatus.DONE.value if finalize else AttendanceRecordStatus.DRAFT.value
        session.flush()
        self._inventory_effect_service.reconcile_daily_record(session, record)
        return AttendanceDayEntrySaveResult(
            record_id=record.id,
            status=record.status,
            is_absent=record.is_absent,
            total_amount_snapshot=Decimal(str(record.total_amount_snapshot)),
        )

    def _apply_blow_payload(
        self,
        session: Session,
        record: AttendanceDailyRecord,
        payload: AttendanceDayEntrySavePayload,
    ) -> Decimal:
        if payload.cut_work:
            raise ValidationError("Cut work payload is invalid for blow employees.")

        total_amount = Decimal("0")
        selected_exclusive_groups: set[str] = set()
        seen_work_type_ids: set[int] = set()
        for item in payload.blow_work:
            if item.work_type_id in seen_work_type_ids:
                raise ValidationError("Duplicate blow work types are not allowed in one daily record.")
            seen_work_type_ids.add(item.work_type_id)

            work_type = self._config_repository.get_work_type(session, item.work_type_id)
            self._validate_blow_work_type(work_type)
            if work_type.exclusive_group:
                if work_type.exclusive_group == GLOVE_EXCLUSIVE_GROUP and work_type.exclusive_group in selected_exclusive_groups:
                    raise ValidationError("Glove work types are mutually exclusive in the same daily record.")
                selected_exclusive_groups.add(work_type.exclusive_group)
            quantity = self._resolve_blow_quantity(work_type, item.quantity)
            if quantity == 0:
                continue
            amount = self._calculate_blow_work_amount(work_type, quantity)
            record.work_logs.append(
                AttendanceWorkLog(
                    work_type_id=work_type.id,
                    quantity=quantity,
                    unit_price_snapshot=work_type.unit_price,
                    amount_snapshot=amount,
                )
            )
            total_amount += amount

        total_amount += self._apply_extra_cut_payload(session, record, payload.extra_cut_work)
        return total_amount

    def _apply_cut_payload(
        self,
        session: Session,
        record: AttendanceDailyRecord,
        payload: AttendanceDayEntrySavePayload,
    ) -> Decimal:
        if payload.blow_work:
            raise ValidationError("Blow work payload is invalid for cut employees.")
        if payload.extra_cut_work:
            raise ValidationError("Extra cut work payload is invalid for cut employees.")

        merged_quantities: dict[int, Decimal] = {}
        for item in payload.cut_work:
            quantity = self._parse_quantity(item.quantity)
            if quantity < 0:
                raise ValidationError("Cut quantity must be non-negative.")
            if quantity == 0:
                continue
            merged_quantities[item.bag_type_id] = merged_quantities.get(item.bag_type_id, Decimal("0")) + quantity

        if not merged_quantities:
            return Decimal("0")

        active_items: list[tuple[AttendanceBagType, Decimal]] = []
        for bag_type_id, quantity in merged_quantities.items():
            bag_type = self._config_repository.get_bag_type(session, bag_type_id)
            self._validate_cut_bag_type(bag_type)
            active_items.append((bag_type, quantity))

        total_amount, line_amounts = self._calculate_cut_bonus(active_items)
        for bag_type, quantity in active_items:
            record.cut_logs.append(
                AttendanceCutLog(
                    bag_type_id=bag_type.id,
                    quantity=quantity,
                    quota_quantity_snapshot=bag_type.quota_quantity,
                    excess_unit_price_snapshot=bag_type.excess_unit_price,
                    amount_snapshot=line_amounts[bag_type.id],
                )
            )
        return total_amount

    def _apply_extra_cut_payload(
        self,
        session: Session,
        record: AttendanceDailyRecord,
        items: list[AttendanceExtraCutLogInput],
    ) -> Decimal:
        merged_quantities: dict[int, Decimal] = {}
        for item in items:
            quantity = self._parse_quantity(item.quantity)
            if quantity < 0:
                raise ValidationError("Extra cut quantity must be non-negative.")
            if quantity == 0:
                continue
            merged_quantities[item.bag_type_id] = merged_quantities.get(item.bag_type_id, Decimal("0")) + quantity

        total_amount = Decimal("0")
        for bag_type_id, quantity in merged_quantities.items():
            bag_type = self._config_repository.get_bag_type(session, bag_type_id)
            self._validate_cut_bag_type(bag_type)
            amount = round_attendance_money(quantity * Decimal(str(bag_type.excess_unit_price)))
            record.extra_cut_logs.append(
                AttendanceExtraCutLog(
                    bag_type_id=bag_type.id,
                    quantity=quantity,
                    excess_unit_price_snapshot=bag_type.excess_unit_price,
                    amount_snapshot=amount,
                )
            )
            total_amount += amount
        return total_amount

    def _ensure_period_for_date(self, session: Session, selected_date: date) -> AttendancePeriod:
        existing = self._period_repository.find_period_covering_date(session, selected_date)
        if existing is not None:
            return existing
        bounds = calculate_ten_day_period_bounds(selected_date)
        exact = self._period_repository.find_period_by_bounds(session, bounds.start_date, bounds.end_date)
        if exact is not None:
            return exact
        period = AttendancePeriod(start_date=bounds.start_date, end_date=bounds.end_date, locked=False)
        self._period_repository.add_period(session, period)
        session.flush()
        return period

    def _validate_blow_work_type(self, work_type: AttendanceWorkType) -> None:
        if not work_type.is_active:
            raise ValidationError("Inactive work types cannot be used in day entry.")
        if work_type.team != AttendanceTeam.BLOW.value:
            raise ValidationError("Only blow work types can be used in blow day entry.")

    def _validate_cut_bag_type(self, bag_type: AttendanceBagType) -> None:
        if not bag_type.is_active:
            raise ValidationError("Inactive cut work items cannot be used in day entry.")
        if not bag_type.is_product_linked:
            raise ValidationError("Cut work items must be product-linked for day entry.")
        if bag_type.product_id is None:
            raise ValidationError("Cut work items must have a linked product for day entry.")
        if bag_type.is_excluded_from_attendance:
            raise ValidationError("Excluded cut work items cannot be used in day entry.")
        if bag_type.is_legacy:
            raise ValidationError("Legacy cut work items cannot be used for new day entry.")
        if Decimal(str(bag_type.quota_quantity)) <= 0 or Decimal(str(bag_type.excess_unit_price)) <= 0:
            raise ValidationError("Cut work items must have positive quota and excess price.")

    def _resolve_blow_quantity(self, work_type: AttendanceWorkType, quantity: Decimal | int | str | None) -> Decimal:
        if work_type.input_type == AttendanceWorkInputType.TICK.value:
            return Decimal("1")
        if quantity is None:
            raise ValidationError("Quantity is required for quantity-based blow work.")
        normalized = self._parse_quantity(quantity)
        if normalized < 0:
            raise ValidationError("Blow quantity must be non-negative.")
        if normalized == 0:
            return normalized
        if normalized % BLOW_QUANTITY_STEP != 0:
            raise ValidationError("Blow quantity must use 0.5 increments.")
        return normalized

    def _calculate_blow_work_amount(self, work_type: AttendanceWorkType, quantity: Decimal) -> Decimal:
        unit_price = Decimal(str(work_type.unit_price))
        if work_type.pricing_rule == AttendanceWorkPricingRule.FLAT_TICK.value:
            return round_attendance_money(unit_price if quantity > 0 else Decimal("0"))
        if work_type.pricing_rule == AttendanceWorkPricingRule.QUANTITY_FULL.value:
            return round_attendance_money(quantity * unit_price)
        if work_type.pricing_rule == AttendanceWorkPricingRule.QUANTITY_EXCESS_OVER_QUOTA.value:
            quota = DEFAULT_EXCESS_QUOTA if work_type.quota_quantity is None else Decimal(str(work_type.quota_quantity))
            return round_attendance_money(max(Decimal("0"), quantity - quota) * unit_price)
        raise ValidationError(f"Unsupported blow pricing rule: {work_type.pricing_rule}.")

    def _calculate_cut_bonus(self, items: list[tuple[AttendanceBagType, Decimal]]) -> tuple[Decimal, dict[int, Decimal]]:
        item_count = Decimal(len(items))
        total_quantity = sum((quantity for _bag_type, quantity in items), Decimal("0"))
        quota_avg = sum((Decimal(str(bag_type.quota_quantity)) for bag_type, _quantity in items), Decimal("0")) / item_count
        if total_quantity <= quota_avg:
            return Decimal("0"), {bag_type.id: Decimal("0") for bag_type, _quantity in items}

        line_amounts: dict[int, Decimal] = {}
        if any(quantity >= Decimal(str(bag_type.quota_quantity)) for bag_type, quantity in items):
            total_amount = Decimal("0")
            for bag_type, quantity in items:
                quota = Decimal(str(bag_type.quota_quantity))
                price = Decimal(str(bag_type.excess_unit_price))
                line_amount = (max(Decimal("0"), quantity - quota) * price) if quantity >= quota else (quantity * price)
                rounded_line = round_attendance_money(line_amount)
                line_amounts[bag_type.id] = rounded_line
                total_amount += rounded_line
            return total_amount, line_amounts

        total_amount = Decimal("0")
        for bag_type, quantity in items:
            per_item_quota = Decimal(str(bag_type.quota_quantity)) / item_count
            price = Decimal(str(bag_type.excess_unit_price))
            line_amount = max(Decimal("0"), quantity - per_item_quota) * price
            rounded_line = round_attendance_money(line_amount)
            line_amounts[bag_type.id] = rounded_line
            total_amount += rounded_line
        return total_amount, line_amounts

    def _parse_quantity(self, value: Decimal | int | str) -> Decimal:
        try:
            return to_decimal_quantity(value)
        except Exception as exc:
            raise ValidationError("Quantity must be numeric.") from exc

    def _status_from_record(self, record: AttendanceDailyRecord | None) -> str:
        if record is None:
            return "not_started"
        if record.is_absent:
            return "absent"
        if record.status == AttendanceRecordStatus.DONE.value:
            return "done"
        return "draft"
