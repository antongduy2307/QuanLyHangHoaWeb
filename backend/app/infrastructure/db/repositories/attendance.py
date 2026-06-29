from __future__ import annotations

from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.domain.attendance import AttendanceTeam
from app.domain.exceptions import NotFoundError
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


class AttendanceEmployeeRepository:
    def get_employee(self, session: Session, employee_id: int) -> AttendanceEmployee:
        employee = session.get(AttendanceEmployee, employee_id)
        if employee is None:
            raise NotFoundError(f"Attendance employee {employee_id} was not found.")
        return employee

    def get_employee_for_update(self, session: Session, employee_id: int) -> AttendanceEmployee:
        statement = select(AttendanceEmployee).where(AttendanceEmployee.id == employee_id).with_for_update()
        employee = session.scalars(statement).one_or_none()
        if employee is None:
            raise NotFoundError(f"Attendance employee {employee_id} was not found.")
        return employee

    def list_employees(
        self,
        session: Session,
        *,
        search: str = "",
        include_inactive: bool = False,
        team: AttendanceTeam | None = None,
    ) -> list[AttendanceEmployee]:
        statement = select(AttendanceEmployee).order_by(AttendanceEmployee.display_name.asc(), AttendanceEmployee.id.asc())
        if not include_inactive:
            statement = statement.where(AttendanceEmployee.is_active.is_(True))
        if team is not None:
            statement = statement.where(AttendanceEmployee.team == team.value)
        needle = search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = statement.where(AttendanceEmployee.display_name.ilike(pattern))
        return list(session.scalars(statement).all())

    def list_active_employees(self, session: Session) -> list[AttendanceEmployee]:
        statement = (
            select(AttendanceEmployee)
            .where(AttendanceEmployee.is_active.is_(True))
            .order_by(AttendanceEmployee.display_name.asc(), AttendanceEmployee.id.asc())
        )
        return list(session.scalars(statement).all())

    def get_employee_by_display_name(self, session: Session, display_name: str) -> AttendanceEmployee | None:
        return session.scalar(select(AttendanceEmployee).where(AttendanceEmployee.display_name == display_name))

    def get_employee_by_user_id(self, session: Session, user_id: int) -> AttendanceEmployee | None:
        return session.scalar(select(AttendanceEmployee).where(AttendanceEmployee.user_id == user_id))

    def add_employee(self, session: Session, employee: AttendanceEmployee) -> AttendanceEmployee:
        session.add(employee)
        return employee

    def delete_employee(self, session: Session, employee: AttendanceEmployee) -> None:
        session.delete(employee)
        session.flush()

    def has_attendance_history(self, session: Session, employee_id: int) -> bool:
        statement = select(AttendanceDailyRecord.id).where(AttendanceDailyRecord.employee_id == employee_id).limit(1)
        return session.scalar(statement) is not None


class AttendancePeriodRepository:
    def get_period(self, session: Session, period_id: int) -> AttendancePeriod:
        period = session.get(AttendancePeriod, period_id)
        if period is None:
            raise NotFoundError(f"Attendance period {period_id} was not found.")
        return period

    def get_period_for_update(self, session: Session, period_id: int) -> AttendancePeriod:
        statement = select(AttendancePeriod).where(AttendancePeriod.id == period_id).with_for_update()
        period = session.scalars(statement).one_or_none()
        if period is None:
            raise NotFoundError(f"Attendance period {period_id} was not found.")
        return period

    def find_period_covering_date(self, session: Session, selected_date: date) -> AttendancePeriod | None:
        statement = (
            select(AttendancePeriod)
            .where(AttendancePeriod.start_date <= selected_date)
            .where(AttendancePeriod.end_date >= selected_date)
            .order_by(AttendancePeriod.start_date.asc(), AttendancePeriod.id.asc())
        )
        return session.scalars(statement).first()

    def find_period_by_bounds(self, session: Session, start_date: date, end_date: date) -> AttendancePeriod | None:
        statement = select(AttendancePeriod).where(
            AttendancePeriod.start_date == start_date,
            AttendancePeriod.end_date == end_date,
        )
        return session.scalars(statement).one_or_none()

    def list_periods(self, session: Session) -> list[AttendancePeriod]:
        statement = select(AttendancePeriod).order_by(AttendancePeriod.start_date.desc(), AttendancePeriod.id.desc())
        return list(session.scalars(statement).all())

    def add_period(self, session: Session, period: AttendancePeriod) -> AttendancePeriod:
        session.add(period)
        return period


class AttendanceConfigRepository:
    def list_work_types(self, session: Session, *, include_inactive: bool = False) -> list[AttendanceWorkType]:
        statement = select(AttendanceWorkType).order_by(AttendanceWorkType.id.asc())
        if not include_inactive:
            statement = statement.where(AttendanceWorkType.is_active.is_(True))
        return list(session.scalars(statement).all())

    def get_work_type(self, session: Session, work_type_id: int) -> AttendanceWorkType:
        work_type = session.get(AttendanceWorkType, work_type_id)
        if work_type is None:
            raise NotFoundError(f"Attendance work type {work_type_id} was not found.")
        return work_type

    def get_work_type_by_team_name(self, session: Session, *, team: AttendanceTeam, name: str) -> AttendanceWorkType | None:
        statement = select(AttendanceWorkType).where(
            AttendanceWorkType.team == team.value,
            AttendanceWorkType.name == name,
        )
        return session.scalars(statement).one_or_none()

    def add_work_type(self, session: Session, work_type: AttendanceWorkType) -> AttendanceWorkType:
        session.add(work_type)
        return work_type

    def list_bag_types(
        self,
        session: Session,
        *,
        include_inactive: bool = False,
        search: str = "",
    ) -> list[AttendanceBagType]:
        statement = (
            select(AttendanceBagType)
            .options(selectinload(AttendanceBagType.product))
            .order_by(AttendanceBagType.id.asc())
        )
        if not include_inactive:
            statement = statement.where(AttendanceBagType.is_active.is_(True))
        needle = search.strip()
        if needle:
            pattern = f"%{needle}%"
            statement = (
                statement
                .join(Product, AttendanceBagType.product_id == Product.id, isouter=True)
                .where(
                    or_(
                        AttendanceBagType.name.ilike(pattern),
                        AttendanceBagType.source_product_name_snapshot.ilike(pattern),
                        Product.product_name.ilike(pattern),
                        Product.product_code_base.ilike(pattern),
                    )
                )
            )
        return list(session.scalars(statement).all())

    def get_bag_type(self, session: Session, bag_type_id: int) -> AttendanceBagType:
        bag_type = session.get(AttendanceBagType, bag_type_id)
        if bag_type is None:
            raise NotFoundError(f"Attendance bag type {bag_type_id} was not found.")
        return bag_type

    def get_bag_type_by_name(self, session: Session, name: str) -> AttendanceBagType | None:
        return session.scalar(select(AttendanceBagType).where(AttendanceBagType.name == name))

    def get_bag_type_by_product_id(self, session: Session, product_id: int) -> AttendanceBagType | None:
        statement = (
            select(AttendanceBagType)
            .options(selectinload(AttendanceBagType.product))
            .where(AttendanceBagType.product_id == product_id)
        )
        return session.scalar(statement)

    def add_bag_type(self, session: Session, bag_type: AttendanceBagType) -> AttendanceBagType:
        session.add(bag_type)
        return bag_type

    def list_bag_types_by_product_ids(self, session: Session, product_ids: set[int]) -> list[AttendanceBagType]:
        if not product_ids:
            return []
        statement = (
            select(AttendanceBagType)
            .options(selectinload(AttendanceBagType.product))
            .where(AttendanceBagType.product_id.in_(product_ids))
            .order_by(AttendanceBagType.id.asc())
        )
        return list(session.scalars(statement).all())

    def list_work_types_for_entry(self, session: Session, *, include_ids: set[int] | None = None) -> list[AttendanceWorkType]:
        include_ids = include_ids or set()
        statement = (
            select(AttendanceWorkType)
            .where((AttendanceWorkType.is_active.is_(True)) | (AttendanceWorkType.id.in_(include_ids)))
            .order_by(AttendanceWorkType.id.asc())
        )
        return list(session.scalars(statement).all())

    def list_bag_types_for_entry(self, session: Session, *, include_ids: set[int] | None = None) -> list[AttendanceBagType]:
        include_ids = include_ids or set()
        available_condition = (
            (AttendanceBagType.is_active.is_(True))
            & (AttendanceBagType.is_product_linked.is_(True))
            & (AttendanceBagType.is_excluded_from_attendance.is_(False))
            & (AttendanceBagType.is_legacy.is_(False))
            & (AttendanceBagType.quota_quantity > 0)
            & (AttendanceBagType.excess_unit_price > 0)
        )
        statement = (
            select(AttendanceBagType)
            .options(selectinload(AttendanceBagType.product))
            .where(available_condition | (AttendanceBagType.id.in_(include_ids)))
            .order_by(AttendanceBagType.id.asc())
        )
        return list(session.scalars(statement).all())


class AttendanceDayEntryRepository:
    def get_daily_record(self, session: Session, employee_id: int, work_date: date) -> AttendanceDailyRecord | None:
        statement = (
            select(AttendanceDailyRecord)
            .options(
                selectinload(AttendanceDailyRecord.employee),
                selectinload(AttendanceDailyRecord.period),
                selectinload(AttendanceDailyRecord.work_logs).selectinload(AttendanceWorkLog.work_type),
                selectinload(AttendanceDailyRecord.cut_logs).selectinload(AttendanceCutLog.bag_type),
                selectinload(AttendanceDailyRecord.extra_cut_logs).selectinload(AttendanceExtraCutLog.bag_type),
            )
            .where(
                AttendanceDailyRecord.employee_id == employee_id,
                AttendanceDailyRecord.work_date == work_date,
            )
        )
        return session.scalars(statement).one_or_none()

    def list_daily_records_for_date(self, session: Session, work_date: date) -> list[AttendanceDailyRecord]:
        statement = select(AttendanceDailyRecord).where(AttendanceDailyRecord.work_date == work_date)
        return list(session.scalars(statement).all())

    def create_daily_record(
        self,
        session: Session,
        *,
        employee_id: int,
        work_date: date,
        period_id: int,
    ) -> AttendanceDailyRecord:
        record = AttendanceDailyRecord(
            employee_id=employee_id,
            work_date=work_date,
            period_id=period_id,
        )
        session.add(record)
        session.flush()
        return record
