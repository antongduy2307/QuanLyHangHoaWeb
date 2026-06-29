from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.domain.enums import UnitMode, UnitType
from app.infrastructure.db.models.attendance import AttendanceDailyRecord, AttendanceInventoryEffect
from app.infrastructure.db.models.inventory import Product
from app.infrastructure.db.models.attendance import AttendanceCutLog, AttendanceExtraCutLog


@dataclass(frozen=True, slots=True)
class AttendanceInventoryDiagnosticIssue:
    issue_type: str
    daily_record_id: int
    employee_id: int
    work_date: object
    message: str


class AttendanceInventoryDiagnosticService:
    def list_issues(self, session: Session) -> list[AttendanceInventoryDiagnosticIssue]:
        records = list(
            session.scalars(
                select(AttendanceDailyRecord)
                .options(
                    selectinload(AttendanceDailyRecord.cut_logs).selectinload(AttendanceCutLog.bag_type),
                    selectinload(AttendanceDailyRecord.extra_cut_logs).selectinload(AttendanceExtraCutLog.bag_type),
                )
                .order_by(AttendanceDailyRecord.id.asc())
            ).all()
        )
        effects = list(session.scalars(select(AttendanceInventoryEffect).order_by(AttendanceInventoryEffect.id.asc())).all())
        effects_by_record: dict[int, list[AttendanceInventoryEffect]] = {}
        for effect in effects:
            effects_by_record.setdefault(effect.daily_record_id, []).append(effect)

        products = {product.id: product for product in session.scalars(select(Product)).all()}
        issues: list[AttendanceInventoryDiagnosticIssue] = []

        for record in records:
            record_effects = effects_by_record.get(record.id, [])
            if record.status != "done" or record.is_absent:
                if record_effects:
                    issues.append(
                        AttendanceInventoryDiagnosticIssue(
                            issue_type="effect_exists_for_draft_or_absent_record",
                            daily_record_id=record.id,
                            employee_id=record.employee_id,
                            work_date=record.work_date,
                            message="Draft or absent attendance record still has inventory effects.",
                        )
                    )
                continue

            expected = self._expected_aggregate(record, products)
            actual = self._effect_aggregate(record_effects)
            if expected and not record_effects:
                issues.append(
                    AttendanceInventoryDiagnosticIssue(
                        issue_type="finalized_record_missing_inventory_effect",
                        daily_record_id=record.id,
                        employee_id=record.employee_id,
                        work_date=record.work_date,
                        message="Finalized attendance production is missing inventory effects.",
                    )
                )
                continue

            if expected and actual:
                if {key[0] for key in expected} != {key[0] for key in actual}:
                    issues.append(
                        AttendanceInventoryDiagnosticIssue(
                            issue_type="effect_product_mismatch",
                            daily_record_id=record.id,
                            employee_id=record.employee_id,
                            work_date=record.work_date,
                            message="Attendance inventory effects point to the wrong product.",
                        )
                    )
                elif expected != actual:
                    issues.append(
                        AttendanceInventoryDiagnosticIssue(
                            issue_type="effect_quantity_mismatch",
                            daily_record_id=record.id,
                            employee_id=record.employee_id,
                            work_date=record.work_date,
                            message="Attendance inventory effect quantities do not match the saved attendance record.",
                        )
                    )

        return issues

    def _expected_aggregate(
        self,
        record: AttendanceDailyRecord,
        products: dict[int, Product],
    ) -> dict[tuple[int, str], Decimal]:
        values: dict[tuple[int, str], Decimal] = {}
        for log in [*record.cut_logs, *record.extra_cut_logs]:
            bag_type = log.bag_type
            if bag_type is None or bag_type.product_id is None:
                continue
            product = products.get(bag_type.product_id)
            if product is None:
                continue
            unit_type = UnitType.BAO.value if product.unit_mode == UnitMode.BAO_KG.value else UnitType.BICH.value
            key = (bag_type.product_id, unit_type)
            values[key] = values.get(key, Decimal("0")) + Decimal(str(log.quantity))
        return values

    def _effect_aggregate(self, effects: list[AttendanceInventoryEffect]) -> dict[tuple[int, str], Decimal]:
        values: dict[tuple[int, str], Decimal] = {}
        for effect in effects:
            key = (effect.product_id, effect.unit_type)
            values[key] = values.get(key, Decimal("0")) + Decimal(str(effect.quantity_delta))
        return values
