from __future__ import annotations

from datetime import date
from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.attendance_inventory_diagnostic_service import AttendanceInventoryDiagnosticService
from app.application.attendance_report_service import AttendanceReportService
from app.application.attendance_service import (
    AttendanceConfigService,
    AttendanceCutLogInput,
    AttendanceDayEntrySavePayload,
    AttendanceDayEntryService,
    AttendanceEmployeeService,
    AttendanceExtraCutLogInput,
    AttendancePeriodService,
    AttendanceWorkLogInput,
)
from app.domain.attendance import AttendanceRecordStatus, AttendanceTeam
from app.domain.auth import UserRole
from app.domain.exceptions import ValidationError
from app.infrastructure.db.models.auth import User
from app.schemas.attendance import (
    AttendanceBagTypeResponse,
    AttendanceBagTypeCreateRequest,
    AttendanceBagTypeFromProductRequest,
    AttendanceBagTypeUpdateRequest,
    AttendanceCutProductSearchResponse,
    AttendanceDayEntryEmployeeStatusResponse,
    AttendanceDayEntryResponse,
    AttendanceDayEntrySaveRequest,
    AttendanceDayEntrySaveResponse,
    AttendanceEmployeeCreateRequest,
    AttendanceEmployeeDeleteResponse,
    AttendanceEmployeeResponse,
    AttendanceEmployeeUpdateRequest,
    AttendanceEnsurePeriodRequest,
    AttendancePeriodResponse,
    AttendancePeriodUpdateRequest,
    AttendancePeriodReportResponse,
    AttendanceReferenceResponse,
    AttendanceMonthlyReportResponse,
    AttendanceInventoryDiagnosticIssueResponse,
    AttendanceWorkTypeCreateRequest,
    AttendanceWorkTypeResponse,
    AttendanceWorkTypeSeedResponse,
    AttendanceWorkTypeUpdateRequest,
)

router = APIRouter(prefix="/attendance", tags=["attendance"])
SessionDep = Annotated[Session, Depends(get_session)]
AttendanceReadDep = Annotated[
    User,
    Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ATTENDANCE_MANAGER, UserRole.READ_ONLY)),
]
AttendanceWriteDep = Annotated[
    User,
    Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ATTENDANCE_MANAGER)),
]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


@router.get("/reference", response_model=AttendanceReferenceResponse)
def attendance_reference(_: AttendanceReadDep) -> AttendanceReferenceResponse:
    return AttendanceReferenceResponse(
        teams=[team.value for team in AttendanceTeam],
        record_statuses=[record_status.value for record_status in AttendanceRecordStatus],
    )


@router.get("/employees", response_model=list[AttendanceEmployeeResponse])
def list_attendance_employees(
    session: SessionDep,
    _: AttendanceReadDep,
    search: str = "",
    include_inactive: bool = False,
    team: str | None = None,
) -> list[AttendanceEmployeeResponse]:
    resolved_team = _parse_team_filter(team)
    employees = AttendanceEmployeeService().list_employees(
        session,
        search=search,
        include_inactive=include_inactive,
        team=resolved_team,
    )
    return [AttendanceEmployeeResponse.model_validate(employee) for employee in employees]


@router.post("/employees", response_model=AttendanceEmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_attendance_employee(
    payload: AttendanceEmployeeCreateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceEmployeeResponse:
    service = AttendanceEmployeeService()

    def operation() -> int:
        employee = service.create_employee(
            session,
            display_name=payload.display_name,
            team=payload.team,
            is_active=payload.is_active,
            user_id=payload.user_id,
            legacy_employee_id=payload.legacy_employee_id,
        )
        return employee.id

    employee_id = _run_in_transaction(session, operation)
    return AttendanceEmployeeResponse.model_validate(service.get_employee(session, employee_id))


@router.get("/employees/{employee_id}", response_model=AttendanceEmployeeResponse)
def get_attendance_employee(employee_id: int, session: SessionDep, _: AttendanceReadDep) -> AttendanceEmployeeResponse:
    return AttendanceEmployeeResponse.model_validate(AttendanceEmployeeService().get_employee(session, employee_id))


@router.patch("/employees/{employee_id}", response_model=AttendanceEmployeeResponse)
def update_attendance_employee(
    employee_id: int,
    payload: AttendanceEmployeeUpdateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceEmployeeResponse:
    service = AttendanceEmployeeService()

    def operation() -> int:
        employee = service.update_employee(
            session,
            employee_id,
            display_name=payload.display_name if "display_name" in payload.model_fields_set else None,
            team=payload.team if "team" in payload.model_fields_set else None,
            is_active=payload.is_active if "is_active" in payload.model_fields_set else None,
            user_id=payload.user_id if "user_id" in payload.model_fields_set and payload.user_id is not None else None,
            clear_user_id="user_id" in payload.model_fields_set and payload.user_id is None,
            legacy_employee_id=payload.legacy_employee_id
            if "legacy_employee_id" in payload.model_fields_set
            else None,
        )
        return employee.id

    updated_id = _run_in_transaction(session, operation)
    return AttendanceEmployeeResponse.model_validate(service.get_employee(session, updated_id))


@router.delete("/employees/{employee_id}", response_model=AttendanceEmployeeDeleteResponse)
def delete_attendance_employee(
    employee_id: int,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceEmployeeDeleteResponse:
    result = _run_in_transaction(session, lambda: AttendanceEmployeeService().delete_employee(session, employee_id))
    return AttendanceEmployeeDeleteResponse(employee_id=result.employee_id, action=result.action)


@router.get("/periods", response_model=list[AttendancePeriodResponse])
def list_attendance_periods(session: SessionDep, _: AttendanceReadDep) -> list[AttendancePeriodResponse]:
    periods = AttendancePeriodService().list_periods(session)
    return [AttendancePeriodResponse.model_validate(period) for period in periods]


@router.post("/periods/ensure-for-date", response_model=AttendancePeriodResponse, status_code=status.HTTP_201_CREATED)
def ensure_attendance_period_for_date(
    payload: AttendanceEnsurePeriodRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendancePeriodResponse:
    service = AttendancePeriodService()
    period_id = _run_in_transaction(session, lambda: service.ensure_period_for_date(session, payload.selected_date).id)
    return AttendancePeriodResponse.model_validate(service.get_period(session, period_id))


@router.patch("/periods/{period_id}", response_model=AttendancePeriodResponse)
def update_attendance_period(
    period_id: int,
    payload: AttendancePeriodUpdateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendancePeriodResponse:
    service = AttendancePeriodService()
    updated_id = _run_in_transaction(session, lambda: service.set_period_locked(session, period_id, locked=payload.locked).id)
    return AttendancePeriodResponse.model_validate(service.get_period(session, updated_id))


@router.get("/work-types", response_model=list[AttendanceWorkTypeResponse])
def list_attendance_work_types(
    session: SessionDep,
    _: AttendanceReadDep,
    include_inactive: bool = False,
) -> list[AttendanceWorkTypeResponse]:
    rows = AttendanceConfigService().list_work_types(session, include_inactive=include_inactive)
    return [AttendanceWorkTypeResponse.model_validate(row) for row in rows]


@router.post("/work-types", response_model=AttendanceWorkTypeResponse, status_code=status.HTTP_201_CREATED)
def create_attendance_work_type(
    payload: AttendanceWorkTypeCreateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceWorkTypeResponse:
    service = AttendanceConfigService()
    work_type_id = _run_in_transaction(
        session,
        lambda: service.create_work_type(
            session,
            name=payload.name,
            input_type=payload.input_type,
            pricing_rule=payload.pricing_rule,
            unit_price=payload.unit_price,
            quota_quantity=payload.quota_quantity,
            exclusive_group=payload.exclusive_group,
            is_active=payload.is_active,
            legacy_work_type_id=payload.legacy_work_type_id,
        ).id,
    )
    return AttendanceWorkTypeResponse.model_validate(service.get_work_type(session, work_type_id))


@router.patch("/work-types/{work_type_id}", response_model=AttendanceWorkTypeResponse)
def update_attendance_work_type(
    work_type_id: int,
    payload: AttendanceWorkTypeUpdateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceWorkTypeResponse:
    service = AttendanceConfigService()
    updated_id = _run_in_transaction(
        session,
        lambda: service.update_work_type(
            session,
            work_type_id,
            name=payload.name,
            input_type=payload.input_type,
            pricing_rule=payload.pricing_rule,
            unit_price=payload.unit_price,
            quota_quantity=payload.quota_quantity,
            exclusive_group=payload.exclusive_group,
            is_active=payload.is_active,
        ).id,
    )
    return AttendanceWorkTypeResponse.model_validate(service.get_work_type(session, updated_id))


@router.post("/work-types/seed-defaults", response_model=AttendanceWorkTypeSeedResponse)
def seed_attendance_work_type_defaults(
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceWorkTypeSeedResponse:
    result = _run_in_transaction(session, lambda: AttendanceConfigService().seed_default_blow_work_types(session))
    return AttendanceWorkTypeSeedResponse.model_validate(result)


@router.get("/cut-work-items", response_model=list[AttendanceBagTypeResponse])
def list_attendance_bag_types(
    session: SessionDep,
    _: AttendanceReadDep,
    include_inactive: bool = False,
    search: str = "",
) -> list[AttendanceBagTypeResponse]:
    rows = AttendanceConfigService().list_bag_types(session, include_inactive=include_inactive, search=search)
    return [AttendanceBagTypeResponse.model_validate(row) for row in rows]


@router.post("/cut-work-items", response_model=AttendanceBagTypeResponse, status_code=status.HTTP_201_CREATED)
def create_attendance_bag_type(
    payload: AttendanceBagTypeCreateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceBagTypeResponse:
    service = AttendanceConfigService()
    bag_type_id = _run_in_transaction(
        session,
        lambda: service.create_bag_type(
            session,
            name=payload.name,
            quota_quantity=payload.quota_quantity,
            excess_unit_price=payload.excess_unit_price,
            is_active=payload.is_active,
            is_product_linked=payload.is_product_linked,
            is_excluded_from_attendance=payload.is_excluded_from_attendance,
            is_legacy=payload.is_legacy,
            product_id=payload.product_id,
            source_product_name_snapshot=payload.source_product_name_snapshot,
            legacy_bag_type_id=payload.legacy_bag_type_id,
        ).id,
    )
    return AttendanceBagTypeResponse.model_validate(service.get_bag_type(session, bag_type_id))


@router.patch("/cut-work-items/{bag_type_id}", response_model=AttendanceBagTypeResponse)
def update_attendance_bag_type(
    bag_type_id: int,
    payload: AttendanceBagTypeUpdateRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceBagTypeResponse:
    service = AttendanceConfigService()
    updated_id = _run_in_transaction(
        session,
        lambda: service.update_bag_type(
            session,
            bag_type_id,
            name=payload.name,
            quota_quantity=payload.quota_quantity,
            excess_unit_price=payload.excess_unit_price,
            is_active=payload.is_active,
            is_product_linked=payload.is_product_linked,
            is_excluded_from_attendance=payload.is_excluded_from_attendance,
            is_legacy=payload.is_legacy,
            product_id=payload.product_id,
            source_product_name_snapshot=payload.source_product_name_snapshot,
        ).id,
    )
    return AttendanceBagTypeResponse.model_validate(service.get_bag_type(session, updated_id))


@router.get("/cut-products/search", response_model=list[AttendanceCutProductSearchResponse])
def search_attendance_cut_products(
    session: SessionDep,
    _: AttendanceReadDep,
    search: str,
) -> list[AttendanceCutProductSearchResponse]:
    rows = AttendanceConfigService().search_cut_products(session, search=search)
    return [AttendanceCutProductSearchResponse.model_validate(row) for row in rows]


@router.post("/cut-work-items/from-product", response_model=AttendanceBagTypeResponse)
def upsert_attendance_bag_type_from_product(
    payload: AttendanceBagTypeFromProductRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
) -> AttendanceBagTypeResponse:
    service = AttendanceConfigService()
    bag_type_id = _run_in_transaction(
        session,
        lambda: service.upsert_bag_type_from_product(
            session,
            product_id=payload.product_id,
            quota_quantity=payload.quota_quantity,
            excess_unit_price=payload.excess_unit_price,
        ).id,
    )
    return AttendanceBagTypeResponse.model_validate(service.get_bag_type(session, bag_type_id))


@router.get("/day-entry", response_model=list[AttendanceDayEntryEmployeeStatusResponse])
def list_attendance_day_entry_rows(
    session: SessionDep,
    _: AttendanceReadDep,
    date_value: date = Query(alias="date"),
) -> list[AttendanceDayEntryEmployeeStatusResponse]:
    rows = AttendanceDayEntryService().list_day_entry_employees(session, selected_date=date_value)
    return [AttendanceDayEntryEmployeeStatusResponse.model_validate(row) for row in rows]


@router.get("/day-entry/{employee_id}", response_model=AttendanceDayEntryResponse)
def get_attendance_day_entry(
    employee_id: int,
    session: SessionDep,
    _: AttendanceReadDep,
    date_value: date = Query(alias="date"),
) -> AttendanceDayEntryResponse:
    entry = AttendanceDayEntryService().get_day_entry(session, employee_id=employee_id, selected_date=date_value)
    return AttendanceDayEntryResponse.model_validate(entry)


@router.put("/day-entry/{employee_id}", response_model=AttendanceDayEntrySaveResponse)
def save_attendance_day_entry(
    employee_id: int,
    payload: AttendanceDayEntrySaveRequest,
    session: SessionDep,
    _: AttendanceWriteDep,
    date_value: date = Query(alias="date"),
    finalize: bool = False,
) -> AttendanceDayEntrySaveResponse:
    service = AttendanceDayEntryService()

    def operation():
        return service.save_day_entry(
            session,
            payload=AttendanceDayEntrySavePayload(
                employee_id=employee_id,
                selected_date=date_value,
                is_absent=payload.is_absent,
                blow_work=[
                    AttendanceWorkLogInput(work_type_id=item.work_type_id, quantity=item.quantity) for item in payload.blow_work
                ],
                cut_work=[AttendanceCutLogInput(bag_type_id=item.bag_type_id, quantity=item.quantity) for item in payload.cut_work],
                extra_cut_work=[
                    AttendanceExtraCutLogInput(bag_type_id=item.bag_type_id, quantity=item.quantity)
                    for item in payload.extra_cut_work
                ],
            ),
            finalize=finalize,
        )

    result = _run_in_transaction(session, operation)
    return AttendanceDayEntrySaveResponse.model_validate(result)


@router.get("/reports/period", response_model=AttendancePeriodReportResponse)
def get_attendance_period_report(
    session: SessionDep,
    _: AttendanceReadDep,
    team: str,
    period_id: int,
) -> AttendancePeriodReportResponse:
    return AttendanceReportService().build_period_report(session, team=team, period_id=period_id)


@router.get("/reports/monthly", response_model=AttendanceMonthlyReportResponse)
def get_attendance_monthly_report(
    session: SessionDep,
    _: AttendanceReadDep,
    team: str,
    month: str,
) -> AttendanceMonthlyReportResponse:
    return AttendanceReportService().build_monthly_report(session, team=team, month=month)


@router.get("/inventory-diagnostics", response_model=list[AttendanceInventoryDiagnosticIssueResponse])
def list_attendance_inventory_diagnostics(
    session: SessionDep,
    _: AttendanceReadDep,
) -> list[AttendanceInventoryDiagnosticIssueResponse]:
    issues = AttendanceInventoryDiagnosticService().list_issues(session)
    return [AttendanceInventoryDiagnosticIssueResponse.model_validate(issue) for issue in issues]


def _parse_team_filter(team: str | None) -> AttendanceTeam | None:
    if team is None:
        return None
    try:
        return AttendanceTeam(team)
    except ValueError as exc:
        raise ValidationError(f"Unknown attendance team: {team}.") from exc
