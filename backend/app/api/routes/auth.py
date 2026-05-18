from __future__ import annotations

from typing import Annotated, Callable, TypeVar

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_session
from app.application.auth_service import AuthService
from app.infrastructure.db.models.auth import User
from app.schemas.auth import (
    AuthenticatedUserResponse,
    LoginRequest,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
SessionDep = Annotated[Session, Depends(get_session)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
T = TypeVar("T")


def _run_in_transaction(session: Session, operation: Callable[[], T]) -> T:
    try:
        result = operation()
        session.commit()
        return result
    except Exception:
        session.rollback()
        raise


def _user_response(user: User) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
    )


def _token_response(login_result, *, include_user: bool = True) -> TokenResponse:
    return TokenResponse(
        access_token=login_result.tokens.access_token,
        refresh_token=login_result.tokens.refresh_token,
        token_type=login_result.tokens.token_type,
        expires_in=login_result.tokens.expires_in,
        user=AuthenticatedUserResponse(
            id=login_result.user.id,
            username=login_result.user.username,
            display_name=login_result.user.display_name,
            role=login_result.user.role,
            is_active=login_result.user.is_active,
        )
        if include_user
        else None,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, session: SessionDep) -> TokenResponse:
    def operation():
        return AuthService().login(
            session,
            username=payload.username,
            password=payload.password,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )

    return _token_response(_run_in_transaction(session, operation))


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, session: SessionDep) -> TokenResponse:
    def operation():
        return AuthService().refresh(
            session,
            payload.refresh_token,
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )

    return _token_response(_run_in_transaction(session, operation), include_user=False)


@router.post("/logout", response_model=LogoutResponse)
def logout(payload: LogoutRequest, session: SessionDep) -> LogoutResponse:
    _run_in_transaction(session, lambda: AuthService().logout(session, payload.refresh_token))
    return LogoutResponse(status="ok")


@router.get("/me", response_model=AuthenticatedUserResponse)
def me(current_user: CurrentUserDep) -> AuthenticatedUserResponse:
    return _user_response(current_user)
