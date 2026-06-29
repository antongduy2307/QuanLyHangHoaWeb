from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.inventory_service import InventoryService
from app.domain.enums import UnitMode, UnitType
from app.domain.exceptions import ValidationError
from app.infrastructure.db.models.attendance import (
    AttendanceDailyRecord,
    AttendanceInventoryEffect,
)
from app.infrastructure.db.models.inventory import Product

ATTENDANCE_CUT_NOTE = "Attendance CUT production"
ATTENDANCE_EXTRA_CUT_NOTE = "Attendance extra CUT production"
ATTENDANCE_REVERSAL_NOTE = "Attendance inventory effect reversal"


@dataclass(frozen=True, slots=True)
class AttendanceInventoryEffectLineResult:
    product_id: int
    quantity_delta: Decimal
    unit_type: UnitType


@dataclass(frozen=True, slots=True)
class AttendanceInventoryReconcileResult:
    reversed_count: int
    applied_count: int
    applied_lines: tuple[AttendanceInventoryEffectLineResult, ...]


class AttendanceInventoryEffectService:
    def __init__(self, inventory_service: InventoryService | None = None) -> None:
        self._inventory_service = inventory_service or InventoryService()

    def reconcile_daily_record(self, session: Session, record: AttendanceDailyRecord) -> AttendanceInventoryReconcileResult:
        existing_effects = self._list_effects(session, record.id)
        movement_datetime = self._movement_datetime(record.work_date)

        for effect in existing_effects:
            self._inventory_service.decrease_stock(
                session,
                effect.product_id,
                effect.quantity_delta,
                effect.unit_type,
                note=ATTENDANCE_REVERSAL_NOTE,
                record_adjustment=True,
                adjustment_datetime=movement_datetime,
            )
            session.delete(effect)
        session.flush()

        if record.status != "done" or record.is_absent:
            return AttendanceInventoryReconcileResult(
                reversed_count=len(existing_effects),
                applied_count=0,
                applied_lines=(),
            )

        applied_lines: list[AttendanceInventoryEffectLineResult] = []
        for log in record.cut_logs:
            bag_type = log.bag_type
            if bag_type is None:
                raise ValidationError(f"Attendance bag type {log.bag_type_id} was not found.")
            product_id = self._require_linked_product_id(bag_type.product_id, log.bag_type_id)
            unit_type = self._inventory_unit_type_for_product(session, product_id)
            self._inventory_service.increase_stock(
                session,
                product_id,
                log.quantity,
                unit_type,
                note=ATTENDANCE_CUT_NOTE,
                record_adjustment=True,
                adjustment_datetime=movement_datetime,
            )
            session.add(
                AttendanceInventoryEffect(
                    daily_record_id=record.id,
                    cut_log_id=log.id,
                    extra_cut_log_id=None,
                    employee_id=record.employee_id,
                    work_date=record.work_date,
                    bag_type_id=log.bag_type_id,
                    product_id=product_id,
                    quantity_delta=log.quantity,
                    unit_type=unit_type.value,
                    movement_datetime=movement_datetime,
                    note=ATTENDANCE_CUT_NOTE,
                )
            )
            applied_lines.append(
                AttendanceInventoryEffectLineResult(
                    product_id=product_id,
                    quantity_delta=Decimal(str(log.quantity)),
                    unit_type=unit_type,
                )
            )

        for log in record.extra_cut_logs:
            bag_type = log.bag_type
            if bag_type is None:
                raise ValidationError(f"Attendance bag type {log.bag_type_id} was not found.")
            product_id = self._require_linked_product_id(bag_type.product_id, log.bag_type_id)
            unit_type = self._inventory_unit_type_for_product(session, product_id)
            self._inventory_service.increase_stock(
                session,
                product_id,
                log.quantity,
                unit_type,
                note=ATTENDANCE_EXTRA_CUT_NOTE,
                record_adjustment=True,
                adjustment_datetime=movement_datetime,
            )
            session.add(
                AttendanceInventoryEffect(
                    daily_record_id=record.id,
                    cut_log_id=None,
                    extra_cut_log_id=log.id,
                    employee_id=record.employee_id,
                    work_date=record.work_date,
                    bag_type_id=log.bag_type_id,
                    product_id=product_id,
                    quantity_delta=log.quantity,
                    unit_type=unit_type.value,
                    movement_datetime=movement_datetime,
                    note=ATTENDANCE_EXTRA_CUT_NOTE,
                )
            )
            applied_lines.append(
                AttendanceInventoryEffectLineResult(
                    product_id=product_id,
                    quantity_delta=Decimal(str(log.quantity)),
                    unit_type=unit_type,
                )
            )

        session.flush()
        return AttendanceInventoryReconcileResult(
            reversed_count=len(existing_effects),
            applied_count=len(applied_lines),
            applied_lines=tuple(applied_lines),
        )

    def _list_effects(self, session: Session, daily_record_id: int) -> list[AttendanceInventoryEffect]:
        statement = (
            select(AttendanceInventoryEffect)
            .where(AttendanceInventoryEffect.daily_record_id == daily_record_id)
            .order_by(AttendanceInventoryEffect.id.asc())
        )
        return list(session.scalars(statement).all())

    def _inventory_unit_type_for_product(self, session: Session, product_id: int) -> UnitType:
        product = session.get(Product, product_id)
        if product is None:
            raise ValidationError(f"Attendance linked product {product_id} was not found.")
        if product.unit_mode == UnitMode.BAO_KG.value:
            return UnitType.BAO
        if product.unit_mode == UnitMode.BICH.value:
            return UnitType.BICH
        raise ValidationError(f"Unsupported inventory unit mode for attendance effects: {product.unit_mode}.")

    def _require_linked_product_id(self, product_id: int | None, bag_type_id: int) -> int:
        if product_id is None:
            raise ValidationError(f"Attendance bag type {bag_type_id} is missing a linked product.")
        return product_id

    def _movement_datetime(self, work_date) -> datetime:
        return datetime.combine(work_date, time.min, tzinfo=timezone.utc)
