from __future__ import annotations

from collections.abc import Callable, Generator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.application.auth_service import AuthService
from app.core.config import get_settings
from app.domain.auth import UserRole
from app.domain.exceptions import AuthenticationError, AuthorizationError
from app.infrastructure.db.models.auth import User
from app.infrastructure.db.session import get_db_session


def get_session() -> Generator[Session, None, None]:
    yield from get_db_session()


SessionDep = Annotated[Session, Depends(get_session)]
bearer_scheme = HTTPBearer(auto_error=False)
LOCAL_AUTH_BYPASS_ENVS = {"local", "dev", "development", "test"}


def _local_bypass_user() -> User:
    return User(
        id=0,
        username="local-admin",
        email=None,
        display_name="Local Admin",
        password_hash="local-auth-bypass",
        role=UserRole.OWNER.value,
        is_active=True,
    )


def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    settings = get_settings()
    if settings.auth_bypass and settings.app_env.lower() in LOCAL_AUTH_BYPASS_ENVS:
        return _local_bypass_user()

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing bearer token.")
    return AuthService().get_current_user_from_token(session, credentials.credentials)


def require_roles(*roles: UserRole | str) -> Callable[[User], User]:
    allowed_roles = {role.value if isinstance(role, UserRole) else str(role) for role in roles}

    def dependency(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in allowed_roles:
            raise AuthorizationError("User does not have permission to perform this action.")
        return current_user

    return dependency
