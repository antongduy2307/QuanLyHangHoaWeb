from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.reporting_service import ReportingService
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import User
from app.schemas.reports import (
    CustomerDebtReportRow,
    DashboardSummaryResponse,
    InventorySummaryRow,
    ReturnsSummaryResponse,
    SalesSummaryResponse,
)

router = APIRouter(prefix="/reports", tags=["reports"])
SessionDep = Annotated[Session, Depends(get_session)]
ReportsReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]


@router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
def dashboard_summary(session: SessionDep, _: ReportsReadDep) -> DashboardSummaryResponse:
    return ReportingService().dashboard_summary(session)


@router.get("/customer-debts", response_model=list[CustomerDebtReportRow])
def customer_debts(session: SessionDep, _: ReportsReadDep) -> list[CustomerDebtReportRow]:
    return ReportingService().customer_debts(session)


@router.get("/inventory-summary", response_model=list[InventorySummaryRow])
def inventory_summary(session: SessionDep, _: ReportsReadDep) -> list[InventorySummaryRow]:
    return ReportingService().inventory_summary(session)


@router.get("/sales-summary", response_model=SalesSummaryResponse)
def sales_summary(
    session: SessionDep,
    _: ReportsReadDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SalesSummaryResponse:
    return ReportingService().sales_summary(session, date_from=date_from, date_to=date_to)


@router.get("/returns-summary", response_model=ReturnsSummaryResponse)
def returns_summary(
    session: SessionDep,
    _: ReportsReadDep,
    date_from: date | None = None,
    date_to: date | None = None,
) -> ReturnsSummaryResponse:
    return ReportingService().returns_summary(session, date_from=date_from, date_to=date_to)
