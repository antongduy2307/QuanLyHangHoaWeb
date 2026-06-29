from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.attendance import AttendanceTeam
from app.domain.exceptions import ValidationError
from app.infrastructure.db.models.attendance import (
    AttendanceCutLog,
    AttendanceDailyRecord,
    AttendanceEmployee,
    AttendanceExtraCutLog,
    AttendancePeriod,
    AttendanceWorkLog,
)
from app.schemas.attendance import (
    AttendanceMonthlyReportResponse,
    AttendanceMonthlyReportRowResponse,
    AttendancePeriodReportEmployeeSummaryResponse,
    AttendancePeriodReportEmployeeValueResponse,
    AttendancePeriodReportResponse,
    AttendancePeriodReportRowResponse,
)


class AttendanceReportService:
    def build_period_report(
        self,
        session: Session,
        *,
        team: AttendanceTeam | str,
        period_id: int,
    ) -> AttendancePeriodReportResponse:
        resolved_team = self._normalize_team(team)
        period = session.get(AttendancePeriod, period_id)
        if period is None:
            raise ValidationError(f"Attendance period {period_id} was not found.")

        employees = self._list_report_employees(session, resolved_team, period.start_date, period.end_date)
        records = self._list_records(session, [employee.id for employee in employees], period.start_date, period.end_date)
        detail_labels = self._detail_labels_for_period(resolved_team, records)
        record_by_employee_day = {(record.employee_id, record.work_date): record for record in records}

        rows: list[AttendancePeriodReportRowResponse] = []
        employee_summaries: list[AttendancePeriodReportEmployeeSummaryResponse] = []
        employee_totals: dict[int, Decimal] = {employee.id: Decimal("0") for employee in employees}
        employee_paid_workdays: dict[int, int] = {employee.id: 0 for employee in employees}
        grand_total = Decimal("0")
        total_paid_workdays = 0

        for work_date in self._date_range(period.start_date, period.end_date):
            employee_values: list[AttendancePeriodReportEmployeeValueResponse] = []
            day_total = Decimal("0")
            for employee in employees:
                record = record_by_employee_day.get((employee.id, work_date))
                total_amount = Decimal("0") if record is None else Decimal(str(record.total_amount_snapshot))
                if total_amount > 0:
                    employee_paid_workdays[employee.id] += 1
                    total_paid_workdays += 1
                employee_totals[employee.id] += total_amount
                day_total += total_amount
                employee_values.append(
                    AttendancePeriodReportEmployeeValueResponse(
                        employee_id=employee.id,
                        display_name=employee.display_name,
                        details=self._detail_values_for_record(resolved_team, record),
                        total_amount=total_amount,
                        is_absent=False if record is None else record.is_absent,
                        status=None if record is None else record.status,
                    )
                )
            grand_total += day_total
            rows.append(
                AttendancePeriodReportRowResponse(
                    work_date=work_date,
                    employee_values=employee_values,
                    day_total=day_total,
                )
            )

        for employee in employees:
            employee_summaries.append(
                AttendancePeriodReportEmployeeSummaryResponse(
                    employee_id=employee.id,
                    display_name=employee.display_name,
                    total_amount=employee_totals[employee.id],
                    paid_workdays=employee_paid_workdays[employee.id],
                )
            )

        return AttendancePeriodReportResponse(
            team=resolved_team.value,
            period_id=period.id,
            start_date=period.start_date,
            end_date=period.end_date,
            detail_labels=detail_labels,
            employee_summaries=employee_summaries,
            rows=rows,
            grand_total=grand_total,
            total_paid_workdays=total_paid_workdays,
        )

    def build_monthly_report(
        self,
        session: Session,
        *,
        team: AttendanceTeam | str,
        month: str,
    ) -> AttendanceMonthlyReportResponse:
        resolved_team = self._normalize_team(team)
        month_start = self._parse_month_start(month)
        month_end = date(month_start.year, month_start.month, monthrange(month_start.year, month_start.month)[1])

        employees = self._list_report_employees(session, resolved_team, month_start, month_end)
        records = self._list_records(session, [employee.id for employee in employees], month_start, month_end)
        records_by_employee: dict[int, list[AttendanceDailyRecord]] = {employee.id: [] for employee in employees}
        for record in records:
            records_by_employee.setdefault(record.employee_id, []).append(record)

        detail_labels = self._detail_labels_for_period(resolved_team, records)
        rows: list[AttendanceMonthlyReportRowResponse] = []
        grand_total = Decimal("0")
        total_paid_workdays = 0

        for employee in employees:
            employee_records = records_by_employee.get(employee.id, [])
            details = self._aggregate_monthly_details(resolved_team, employee_records)
            total_amount = sum((Decimal(str(record.total_amount_snapshot)) for record in employee_records), Decimal("0"))
            paid_workdays = sum(1 for record in employee_records if Decimal(str(record.total_amount_snapshot)) > 0)
            grand_total += total_amount
            total_paid_workdays += paid_workdays
            rows.append(
                AttendanceMonthlyReportRowResponse(
                    employee_id=employee.id,
                    display_name=employee.display_name,
                    details=details,
                    total_amount=total_amount,
                    paid_workdays=paid_workdays,
                )
            )

        return AttendanceMonthlyReportResponse(
            team=resolved_team.value,
            month=month,
            month_start=month_start,
            month_end=month_end,
            detail_labels=detail_labels,
            rows=rows,
            grand_total=grand_total,
            total_paid_workdays=total_paid_workdays,
        )

    def _normalize_team(self, team: AttendanceTeam | str) -> AttendanceTeam:
        try:
            return team if isinstance(team, AttendanceTeam) else AttendanceTeam(str(team))
        except ValueError as exc:
            raise ValidationError(f"Unknown attendance team: {team}.") from exc

    def _parse_month_start(self, month: str) -> date:
        try:
            year_text, month_text = month.split("-", 1)
            year_value = int(year_text)
            month_value = int(month_text)
            return date(year_value, month_value, 1)
        except Exception as exc:
            raise ValidationError("Month must use YYYY-MM format.") from exc

    def _list_report_employees(self, session: Session, team: AttendanceTeam, start_date: date, end_date: date) -> list[AttendanceEmployee]:
        history_employee_ids = set(
            session.scalars(
                select(AttendanceDailyRecord.employee_id)
                .where(AttendanceDailyRecord.work_date >= start_date)
                .where(AttendanceDailyRecord.work_date <= end_date)
                .distinct()
            ).all()
        )
        statement = (
            select(AttendanceEmployee)
            .where(AttendanceEmployee.team == team.value)
            .where((AttendanceEmployee.is_active.is_(True)) | (AttendanceEmployee.id.in_(history_employee_ids)))
            .order_by(AttendanceEmployee.display_name.asc(), AttendanceEmployee.id.asc())
        )
        return list(session.scalars(statement).all())

    def _list_records(self, session: Session, employee_ids: list[int], start_date: date, end_date: date) -> list[AttendanceDailyRecord]:
        if not employee_ids:
            return []
        statement = (
            select(AttendanceDailyRecord)
            .options(
                selectinload(AttendanceDailyRecord.work_logs).selectinload(AttendanceWorkLog.work_type),
                selectinload(AttendanceDailyRecord.cut_logs).selectinload(AttendanceCutLog.bag_type),
                selectinload(AttendanceDailyRecord.extra_cut_logs).selectinload(AttendanceExtraCutLog.bag_type),
            )
            .where(AttendanceDailyRecord.employee_id.in_(employee_ids))
            .where(AttendanceDailyRecord.work_date >= start_date)
            .where(AttendanceDailyRecord.work_date <= end_date)
            .order_by(AttendanceDailyRecord.work_date.asc(), AttendanceDailyRecord.id.asc())
        )
        return list(session.scalars(statement).all())

    def _detail_labels_for_period(self, team: AttendanceTeam, records: list[AttendanceDailyRecord]) -> list[str]:
        labels: list[str] = []
        seen: set[str] = set()
        for record in records:
            for label in self._detail_values_for_record(team, record):
                if label not in seen:
                    seen.add(label)
                    labels.append(label)
        return labels

    def _detail_values_for_record(self, team: AttendanceTeam, record: AttendanceDailyRecord | None) -> dict[str, str]:
        if record is None or record.is_absent:
            return {}
        if team == AttendanceTeam.BLOW:
            values: dict[str, str] = {}
            for log in record.work_logs:
                label = log.work_type.name
                if log.work_type.input_type == "tick":
                    values[label] = "1"
                else:
                    values[label] = self._format_quantity(log.quantity)
            extra_amount = sum((Decimal(str(log.amount_snapshot)) for log in record.extra_cut_logs), Decimal("0"))
            if extra_amount > 0:
                values["VK"] = self._format_decimal(extra_amount)
            return values

        values = {}
        for log in record.cut_logs:
            values[log.bag_type.name] = self._format_quantity(log.quantity)
        return values

    def _aggregate_monthly_details(self, team: AttendanceTeam, records: list[AttendanceDailyRecord]) -> dict[str, str]:
        if team == AttendanceTeam.BLOW:
            totals: dict[str, Decimal] = {}
            for record in records:
                if record.is_absent:
                    continue
                for log in record.work_logs:
                    key = log.work_type.name
                    increment = Decimal("1") if log.work_type.input_type == "tick" else Decimal(str(log.quantity))
                    totals[key] = totals.get(key, Decimal("0")) + increment
                extra_amount = sum((Decimal(str(log.amount_snapshot)) for log in record.extra_cut_logs), Decimal("0"))
                if extra_amount > 0:
                    totals["VK"] = totals.get("VK", Decimal("0")) + extra_amount
            return {
                label: (self._format_decimal(value) if label == "VK" else self._format_quantity(value))
                for label, value in totals.items()
                if value != 0
            }

        totals: dict[str, Decimal] = {}
        for record in records:
            if record.is_absent:
                continue
            for log in record.cut_logs:
                key = log.bag_type.name
                totals[key] = totals.get(key, Decimal("0")) + Decimal(str(log.quantity))
        return {label: self._format_quantity(value) for label, value in totals.items() if value != 0}

    def _date_range(self, start_date: date, end_date: date) -> list[date]:
        values: list[date] = []
        current = start_date
        while current <= end_date:
            values.append(current)
            current = date.fromordinal(current.toordinal() + 1)
        return values

    def _format_quantity(self, value: Decimal | str | int) -> str:
        decimal_value = value if isinstance(value, Decimal) else Decimal(str(value))
        text = format(decimal_value.normalize(), "f")
        return text.rstrip("0").rstrip(".") if "." in text else text

    def _format_decimal(self, value: Decimal) -> str:
        return self._format_quantity(value)
