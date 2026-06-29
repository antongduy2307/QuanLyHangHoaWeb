from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class AttendanceEmployeeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1)
    team: str
    is_active: bool = True
    user_id: int | None = None
    legacy_employee_id: int | None = None


class AttendanceEmployeeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1)
    team: str | None = None
    is_active: bool | None = None
    user_id: int | None = None
    legacy_employee_id: int | None = None


class AttendanceEmployeeResponse(BaseModel):
    id: int
    display_name: str
    team: str
    is_active: bool
    user_id: int | None
    legacy_employee_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceEmployeeDeleteResponse(BaseModel):
    employee_id: int
    action: str


class AttendanceEnsurePeriodRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selected_date: date


class AttendancePeriodUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locked: bool


class AttendancePeriodResponse(BaseModel):
    id: int
    start_date: date
    end_date: date
    locked: bool
    legacy_period_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceReferenceResponse(BaseModel):
    teams: list[str]
    record_statuses: list[str]


class AttendanceWorkTypeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    input_type: str
    pricing_rule: str
    unit_price: Decimal
    quota_quantity: Decimal | None = None
    exclusive_group: str | None = None
    is_active: bool = True
    legacy_work_type_id: int | None = None


class AttendanceWorkTypeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    input_type: str
    pricing_rule: str
    unit_price: Decimal
    quota_quantity: Decimal | None = None
    exclusive_group: str | None = None
    is_active: bool = True


class AttendanceWorkTypeResponse(BaseModel):
    id: int
    name: str
    team: str
    input_type: str
    pricing_rule: str
    quota_quantity: Decimal | None
    unit_price: Decimal
    exclusive_group: str | None
    is_active: bool
    legacy_work_type_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceWorkTypeSeedResponse(BaseModel):
    created_count: int
    skipped_count: int
    created_names: list[str]
    skipped_names: list[str]

    model_config = ConfigDict(from_attributes=True)


class AttendanceBagTypeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    quota_quantity: Decimal
    excess_unit_price: Decimal
    is_active: bool = True
    is_product_linked: bool = True
    is_excluded_from_attendance: bool = False
    is_legacy: bool = False
    product_id: int | None = None
    source_product_name_snapshot: str | None = None
    legacy_bag_type_id: int | None = None


class AttendanceBagTypeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    quota_quantity: Decimal
    excess_unit_price: Decimal
    is_active: bool
    is_product_linked: bool
    is_excluded_from_attendance: bool
    is_legacy: bool
    product_id: int | None = None
    source_product_name_snapshot: str | None = None


class AttendanceBagTypeResponse(BaseModel):
    id: int
    name: str
    product_id: int | None
    product_code_base: str | None = None
    product_name: str | None = None
    source_product_name_snapshot: str | None
    quota_quantity: Decimal
    excess_unit_price: Decimal
    is_active: bool
    is_product_linked: bool
    is_excluded_from_attendance: bool
    is_legacy: bool
    legacy_bag_type_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryEmployeeStatusResponse(BaseModel):
    id: int
    display_name: str
    team: str
    is_active: bool
    status: str
    record_status: str | None
    is_absent: bool

    model_config = ConfigDict(from_attributes=True)


class AttendanceWorkLogItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    work_type_id: int
    quantity: Decimal | None = None


class AttendanceCutLogItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bag_type_id: int
    quantity: Decimal


class AttendanceExtraCutLogItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bag_type_id: int
    quantity: Decimal


class AttendanceDayEntrySaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_absent: bool = False
    blow_work: list[AttendanceWorkLogItemRequest] = Field(default_factory=list)
    cut_work: list[AttendanceCutLogItemRequest] = Field(default_factory=list)
    extra_cut_work: list[AttendanceExtraCutLogItemRequest] = Field(default_factory=list)


class AttendanceDayEntryWorkLogResponse(BaseModel):
    work_type_id: int
    quantity: Decimal
    unit_price_snapshot: Decimal
    amount_snapshot: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryCutLogResponse(BaseModel):
    bag_type_id: int
    quantity: Decimal
    quota_quantity_snapshot: Decimal | None
    excess_unit_price_snapshot: Decimal
    amount_snapshot: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryExtraCutLogResponse(BaseModel):
    bag_type_id: int
    quantity: Decimal
    excess_unit_price_snapshot: Decimal
    amount_snapshot: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryWorkTypeOptionResponse(BaseModel):
    id: int
    name: str
    input_type: str
    pricing_rule: str
    quota_quantity: Decimal | None
    unit_price: Decimal
    exclusive_group: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryBagTypeOptionResponse(BaseModel):
    id: int
    name: str
    product_id: int | None
    product_code_base: str | None = None
    product_name: str | None = None
    source_product_name_snapshot: str | None
    quota_quantity: Decimal
    excess_unit_price: Decimal
    is_active: bool
    is_product_linked: bool
    is_excluded_from_attendance: bool
    is_legacy: bool

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntryResponse(BaseModel):
    employee_id: int
    display_name: str
    team: str
    selected_date: date
    status: str
    record_status: str | None
    is_absent: bool
    total_amount_snapshot: Decimal
    work_types: list[AttendanceDayEntryWorkTypeOptionResponse]
    bag_types: list[AttendanceDayEntryBagTypeOptionResponse]
    work_logs: list[AttendanceDayEntryWorkLogResponse]
    cut_logs: list[AttendanceDayEntryCutLogResponse]
    extra_cut_logs: list[AttendanceDayEntryExtraCutLogResponse]

    model_config = ConfigDict(from_attributes=True)


class AttendanceDayEntrySaveResponse(BaseModel):
    record_id: int
    status: str
    is_absent: bool
    total_amount_snapshot: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttendancePeriodReportEmployeeValueResponse(BaseModel):
    employee_id: int
    display_name: str
    details: dict[str, str]
    total_amount: Decimal
    is_absent: bool
    status: str | None


class AttendancePeriodReportRowResponse(BaseModel):
    work_date: date
    employee_values: list[AttendancePeriodReportEmployeeValueResponse]
    day_total: Decimal


class AttendancePeriodReportEmployeeSummaryResponse(BaseModel):
    employee_id: int
    display_name: str
    total_amount: Decimal
    paid_workdays: int


class AttendancePeriodReportResponse(BaseModel):
    team: str
    period_id: int
    start_date: date
    end_date: date
    detail_labels: list[str]
    employee_summaries: list[AttendancePeriodReportEmployeeSummaryResponse]
    rows: list[AttendancePeriodReportRowResponse]
    grand_total: Decimal
    total_paid_workdays: int


class AttendanceMonthlyReportRowResponse(BaseModel):
    employee_id: int
    display_name: str
    details: dict[str, str]
    total_amount: Decimal
    paid_workdays: int


class AttendanceMonthlyReportResponse(BaseModel):
    team: str
    month: str
    month_start: date
    month_end: date
    detail_labels: list[str]
    rows: list[AttendanceMonthlyReportRowResponse]
    grand_total: Decimal
    total_paid_workdays: int


class AttendanceInventoryDiagnosticIssueResponse(BaseModel):
    issue_type: str
    daily_record_id: int
    employee_id: int
    work_date: date
    message: str

    model_config = ConfigDict(from_attributes=True)


class AttendanceCutProductSearchResponse(BaseModel):
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

    model_config = ConfigDict(from_attributes=True)


class AttendanceBagTypeFromProductRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int
    quota_quantity: Decimal | None = None
    excess_unit_price: Decimal | None = None
