from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.attendance import (
    AttendanceRecordStatus,
    AttendanceTeam,
    AttendanceWorkInputType,
    AttendanceWorkPricingRule,
)
from app.infrastructure.db.base import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")
TEAM_VALUES = ", ".join(f"'{team.value}'" for team in AttendanceTeam)
STATUS_VALUES = ", ".join(f"'{status.value}'" for status in AttendanceRecordStatus)
INPUT_TYPE_VALUES = ", ".join(f"'{input_type.value}'" for input_type in AttendanceWorkInputType)
PRICING_RULE_VALUES = ", ".join(f"'{rule.value}'" for rule in AttendanceWorkPricingRule)
QUANTITY_TYPE = Numeric(14, 3)
QUOTA_TYPE = Numeric(14, 2)
MONEY_TYPE = Numeric(14, 2)
UNIT_TYPE_VALUES = "'BAO', 'BICH'"


class AttendanceEmployee(Base):
    __tablename__ = "attendance_employees"
    __table_args__ = (
        CheckConstraint("length(trim(display_name)) > 0", name="ck_attendance_employees_display_name_not_blank"),
        CheckConstraint(f"team IN ({TEAM_VALUES})", name="ck_attendance_employees_team_known"),
        UniqueConstraint("display_name", name="uq_attendance_employees_display_name"),
        UniqueConstraint("user_id", name="uq_attendance_employees_user_id"),
        Index("ix_attendance_employees_display_name", "display_name"),
        Index("ix_attendance_employees_team_is_active", "team", "is_active"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    team: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    legacy_employee_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User")
    daily_records = relationship("AttendanceDailyRecord", back_populates="employee", cascade="all, delete-orphan")


class AttendancePeriod(Base):
    __tablename__ = "attendance_periods"
    __table_args__ = (
        UniqueConstraint("start_date", "end_date", name="uq_attendance_periods_start_end"),
        CheckConstraint("start_date <= end_date", name="ck_attendance_periods_date_order"),
        Index("ix_attendance_periods_start_date", "start_date"),
        Index("ix_attendance_periods_end_date", "end_date"),
        Index("ix_attendance_periods_locked", "locked"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    legacy_period_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    daily_records = relationship("AttendanceDailyRecord", back_populates="period", cascade="all, delete-orphan")


class AttendanceDailyRecord(Base):
    __tablename__ = "attendance_daily_records"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_attendance_daily_records_employee_work_date"),
        CheckConstraint(f"status IN ({STATUS_VALUES})", name="ck_attendance_daily_records_status_known"),
        CheckConstraint("total_amount_snapshot >= 0", name="ck_attendance_daily_records_total_amount_non_negative"),
        Index("ix_attendance_daily_records_work_date", "work_date"),
        Index("ix_attendance_daily_records_employee_date", "employee_id", "work_date"),
        Index("ix_attendance_daily_records_period_status", "period_id", "status"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("attendance_employees.id", ondelete="CASCADE"), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_id: Mapped[int] = mapped_column(ForeignKey("attendance_periods.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default=AttendanceRecordStatus.DRAFT.value)
    is_absent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    total_amount_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False, server_default="0", default=Decimal("0"))
    legacy_daily_record_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    employee = relationship("AttendanceEmployee", back_populates="daily_records")
    period = relationship("AttendancePeriod", back_populates="daily_records")
    work_logs = relationship("AttendanceWorkLog", back_populates="daily_record", cascade="all, delete-orphan")
    cut_logs = relationship("AttendanceCutLog", back_populates="daily_record", cascade="all, delete-orphan")
    extra_cut_logs = relationship("AttendanceExtraCutLog", back_populates="daily_record", cascade="all, delete-orphan")


class AttendanceWorkType(Base):
    __tablename__ = "attendance_work_types"
    __table_args__ = (
        CheckConstraint(f"team IN ({TEAM_VALUES})", name="ck_attendance_work_types_team_known"),
        CheckConstraint("team = 'blow'", name="ck_attendance_work_types_team_blow"),
        CheckConstraint("length(trim(name)) > 0", name="ck_attendance_work_types_name_not_blank"),
        CheckConstraint(f"input_type IN ({INPUT_TYPE_VALUES})", name="ck_attendance_work_types_input_type_known"),
        CheckConstraint(f"pricing_rule IN ({PRICING_RULE_VALUES})", name="ck_attendance_work_types_pricing_rule_known"),
        CheckConstraint("quota_quantity IS NULL OR quota_quantity >= 0", name="ck_attendance_work_types_quota_non_negative"),
        CheckConstraint("unit_price >= 0", name="ck_attendance_work_types_unit_price_non_negative"),
        UniqueConstraint("team", "name", name="uq_attendance_work_types_team_name"),
        Index("ix_attendance_work_types_team_active", "team", "is_active"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    team: Mapped[str] = mapped_column(String(16), nullable=False, server_default=AttendanceTeam.BLOW.value)
    input_type: Mapped[str] = mapped_column(String(32), nullable=False)
    pricing_rule: Mapped[str] = mapped_column(String(64), nullable=False)
    quota_quantity: Mapped[Decimal | None] = mapped_column(QUOTA_TYPE, nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False, server_default="0", default=Decimal("0"))
    exclusive_group: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    legacy_work_type_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    work_logs = relationship("AttendanceWorkLog", back_populates="work_type")


class AttendanceWorkLog(Base):
    __tablename__ = "attendance_work_logs"
    __table_args__ = (
        UniqueConstraint("daily_record_id", "work_type_id", name="uq_attendance_work_logs_daily_work_type"),
        CheckConstraint("quantity >= 0", name="ck_attendance_work_logs_quantity_non_negative"),
        CheckConstraint("unit_price_snapshot >= 0", name="ck_attendance_work_logs_unit_price_non_negative"),
        CheckConstraint("amount_snapshot >= 0", name="ck_attendance_work_logs_amount_non_negative"),
        Index("ix_attendance_work_logs_daily_record_id", "daily_record_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    daily_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_daily_records.id", ondelete="CASCADE"), nullable=False)
    work_type_id: Mapped[int] = mapped_column(ForeignKey("attendance_work_types.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(QUANTITY_TYPE, nullable=False)
    unit_price_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False)
    amount_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    daily_record = relationship("AttendanceDailyRecord", back_populates="work_logs")
    work_type = relationship("AttendanceWorkType", back_populates="work_logs")


class AttendanceBagType(Base):
    __tablename__ = "attendance_bag_types"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_attendance_bag_types_name_not_blank"),
        CheckConstraint("quota_quantity >= 0", name="ck_attendance_bag_types_quota_non_negative"),
        CheckConstraint("excess_unit_price >= 0", name="ck_attendance_bag_types_excess_price_non_negative"),
        CheckConstraint(
            "(is_product_linked = false AND product_id IS NULL) OR (is_product_linked = true AND product_id IS NOT NULL)",
            name="ck_attendance_bag_types_product_link_consistent",
        ),
        UniqueConstraint("name", name="uq_attendance_bag_types_name"),
        UniqueConstraint("product_id", name="uq_attendance_bag_types_product_id"),
        Index("ix_attendance_bag_types_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    source_product_name_snapshot: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quota_quantity: Mapped[Decimal] = mapped_column(QUOTA_TYPE, nullable=False, server_default="0", default=Decimal("0"))
    excess_unit_price: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False, server_default="0", default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    is_product_linked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    is_excluded_from_attendance: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    is_legacy: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    legacy_bag_type_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    product = relationship("Product")
    cut_logs = relationship("AttendanceCutLog", back_populates="bag_type")
    extra_cut_logs = relationship("AttendanceExtraCutLog", back_populates="bag_type")
    inventory_effects = relationship("AttendanceInventoryEffect", back_populates="bag_type")

    @property
    def product_code_base(self) -> str | None:
        return None if self.product is None else self.product.product_code_base

    @property
    def product_name(self) -> str | None:
        return None if self.product is None else self.product.product_name


class AttendanceCutLog(Base):
    __tablename__ = "attendance_cut_logs"
    __table_args__ = (
        UniqueConstraint("daily_record_id", "bag_type_id", name="uq_attendance_cut_logs_daily_bag_type"),
        CheckConstraint("quantity >= 0", name="ck_attendance_cut_logs_quantity_non_negative"),
        CheckConstraint(
            "quota_quantity_snapshot IS NULL OR quota_quantity_snapshot >= 0",
            name="ck_attendance_cut_logs_quota_snapshot_non_negative",
        ),
        CheckConstraint("excess_unit_price_snapshot >= 0", name="ck_attendance_cut_logs_excess_snapshot_non_negative"),
        CheckConstraint("amount_snapshot >= 0", name="ck_attendance_cut_logs_amount_non_negative"),
        Index("ix_attendance_cut_logs_daily_record_id", "daily_record_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    daily_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_daily_records.id", ondelete="CASCADE"), nullable=False)
    bag_type_id: Mapped[int] = mapped_column(ForeignKey("attendance_bag_types.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(QUANTITY_TYPE, nullable=False)
    quota_quantity_snapshot: Mapped[Decimal | None] = mapped_column(QUOTA_TYPE, nullable=True)
    excess_unit_price_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False)
    amount_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False, server_default="0", default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    daily_record = relationship("AttendanceDailyRecord", back_populates="cut_logs")
    bag_type = relationship("AttendanceBagType", back_populates="cut_logs")


class AttendanceExtraCutLog(Base):
    __tablename__ = "attendance_extra_cut_logs"
    __table_args__ = (
        UniqueConstraint("daily_record_id", "bag_type_id", name="uq_attendance_extra_cut_logs_daily_bag_type"),
        CheckConstraint("quantity > 0", name="ck_attendance_extra_cut_logs_quantity_positive"),
        CheckConstraint("excess_unit_price_snapshot >= 0", name="ck_attendance_extra_cut_logs_excess_snapshot_non_negative"),
        CheckConstraint("amount_snapshot >= 0", name="ck_attendance_extra_cut_logs_amount_non_negative"),
        Index("ix_attendance_extra_cut_logs_daily_record_id", "daily_record_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    daily_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_daily_records.id", ondelete="CASCADE"), nullable=False)
    bag_type_id: Mapped[int] = mapped_column(ForeignKey("attendance_bag_types.id", ondelete="RESTRICT"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(QUANTITY_TYPE, nullable=False)
    excess_unit_price_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False)
    amount_snapshot: Mapped[Decimal] = mapped_column(MONEY_TYPE, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    daily_record = relationship("AttendanceDailyRecord", back_populates="extra_cut_logs")
    bag_type = relationship("AttendanceBagType", back_populates="extra_cut_logs")


class AttendanceInventoryEffect(Base):
    __tablename__ = "attendance_inventory_effects"
    __table_args__ = (
        CheckConstraint("quantity_delta > 0", name="ck_attendance_inventory_effects_quantity_positive"),
        CheckConstraint(f"unit_type IN ({UNIT_TYPE_VALUES})", name="ck_attendance_inventory_effects_unit_type_known"),
        CheckConstraint(
            "(cut_log_id IS NOT NULL AND extra_cut_log_id IS NULL) OR (cut_log_id IS NULL AND extra_cut_log_id IS NOT NULL)",
            name="ck_attendance_inventory_effects_exactly_one_source",
        ),
        UniqueConstraint("cut_log_id", name="uq_attendance_inventory_effects_cut_log_id"),
        UniqueConstraint("extra_cut_log_id", name="uq_attendance_inventory_effects_extra_cut_log_id"),
        Index("ix_attendance_inventory_effects_daily_record_id", "daily_record_id"),
        Index("ix_attendance_inventory_effects_product_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, Identity(), primary_key=True)
    daily_record_id: Mapped[int] = mapped_column(ForeignKey("attendance_daily_records.id", ondelete="CASCADE"), nullable=False)
    cut_log_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_cut_logs.id", ondelete="CASCADE"), nullable=True)
    extra_cut_log_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_extra_cut_logs.id", ondelete="CASCADE"), nullable=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("attendance_employees.id", ondelete="CASCADE"), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    bag_type_id: Mapped[int] = mapped_column(ForeignKey("attendance_bag_types.id", ondelete="RESTRICT"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity_delta: Mapped[Decimal] = mapped_column(QUANTITY_TYPE, nullable=False)
    unit_type: Mapped[str] = mapped_column(String(16), nullable=False)
    movement_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    daily_record = relationship("AttendanceDailyRecord")
    cut_log = relationship("AttendanceCutLog")
    extra_cut_log = relationship("AttendanceExtraCutLog")
    employee = relationship("AttendanceEmployee")
    bag_type = relationship("AttendanceBagType", back_populates="inventory_effects")
    product = relationship("Product")
