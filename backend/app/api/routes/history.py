from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_session, require_roles
from app.application.history_service import HistoryEvent, HistoryService
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import User
from app.schemas.history import HistoryEventResponse, HistoryListResponse

router = APIRouter(prefix="/history", tags=["history"])
SessionDep = Annotated[Session, Depends(get_session)]
HistoryReadDep = Annotated[User, Depends(require_roles(UserRole.OWNER, UserRole.ADMIN, UserRole.READ_ONLY))]


def _history_response(event: HistoryEvent) -> HistoryEventResponse:
    return HistoryEventResponse.model_validate(event)


@router.get("", response_model=HistoryListResponse)
def list_history(
    session: SessionDep,
    _: HistoryReadDep,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    event_type: str | None = None,
    customer_id: int | None = None,
    product_id: int | None = None,
    search: str = "",
    page: int = 1,
    page_size: int = 50,
) -> HistoryListResponse:
    history_page = HistoryService().list_history(
        session,
        date_from=date_from,
        date_to=date_to,
        event_type=event_type,
        customer_id=customer_id,
        product_id=product_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return HistoryListResponse(
        page=history_page.page,
        page_size=history_page.page_size,
        total=history_page.total,
        items=[_history_response(event) for event in history_page.items],
    )
