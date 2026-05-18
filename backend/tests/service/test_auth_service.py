from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine

from app.application.auth_service import AuthService
from app.core.config import Settings
from app.core.security import decode_access_token, hash_refresh_token, verify_password, verify_refresh_token
from app.domain.auth import UserRole
from app.domain.exceptions import AuthenticationError, ConflictError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.auth import RefreshToken, User


@pytest.fixture
def auth_settings() -> Settings:
    return Settings(
        APP_ENV="test",
        AUTH_SECRET_KEY="test-secret-key-for-auth-service-tests",
        AUTH_ISSUER="QuanLyHangHoaWebAuthTests",
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        REFRESH_TOKEN_EXPIRE_DAYS=14,
    )


@pytest.fixture
def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as db_session:
        yield db_session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def service(auth_settings: Settings) -> AuthService:
    return AuthService(settings=auth_settings)


def test_create_user_stores_hashed_password(session: Session, service: AuthService) -> None:
    user = service.create_user(
        session,
        username=" Owner ",
        password="strong-password",
        display_name="Owner",
        role=UserRole.OWNER,
        email="OWNER@EXAMPLE.COM",
    )

    assert user.username == "owner"
    assert user.email == "owner@example.com"
    assert user.password_hash != "strong-password"
    assert verify_password("strong-password", user.password_hash) is True


def test_duplicate_username_rejected(session: Session, service: AuthService) -> None:
    service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)

    with pytest.raises(ConflictError):
        service.create_user(session, username=" ADMIN ", password="another-password", display_name="Admin", role=UserRole.ADMIN)


def test_inactive_user_cannot_login(session: Session, service: AuthService) -> None:
    service.create_user(
        session,
        username="employee",
        password="strong-password",
        display_name="Employee",
        role=UserRole.EMPLOYEE,
        is_active=False,
    )

    with pytest.raises(AuthenticationError):
        service.login(session, username="employee", password="strong-password")


def test_wrong_password_rejected(session: Session, service: AuthService) -> None:
    service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)

    with pytest.raises(AuthenticationError):
        service.authenticate_user(session, "admin", "wrong-password")


def test_login_returns_tokens_and_updates_last_login(
    session: Session,
    service: AuthService,
    auth_settings: Settings,
) -> None:
    user = service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)

    result = service.login(session, username="admin", password="strong-password", user_agent="pytest", ip_address="127.0.0.1")

    payload = decode_access_token(result.tokens.access_token, auth_settings)
    stored_token = session.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id))
    assert result.user.id == user.id
    assert result.tokens.token_type == "bearer"
    assert payload["sub"] == str(user.id)
    assert payload["role"] == "admin"
    assert user.last_login_at is not None
    assert stored_token is not None
    assert stored_token.user_agent == "pytest"
    assert stored_token.ip_address == "127.0.0.1"
    assert stored_token.token_hash != result.tokens.refresh_token
    assert verify_refresh_token(result.tokens.refresh_token, stored_token.token_hash) is True


def test_refresh_rotates_token_and_revokes_old_token(session: Session, service: AuthService) -> None:
    user = service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    login = service.login(session, username="admin", password="strong-password")
    old_hash = hash_refresh_token(login.tokens.refresh_token)

    refreshed = service.refresh(session, login.tokens.refresh_token)

    old_token = session.scalar(select(RefreshToken).where(RefreshToken.token_hash == old_hash))
    all_tokens = session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)).all()
    assert refreshed.tokens.refresh_token != login.tokens.refresh_token
    assert old_token is not None
    assert old_token.revoked_at is not None
    assert len(all_tokens) == 2
    assert sum(1 for token in all_tokens if token.revoked_at is None) == 1
    with pytest.raises(AuthenticationError):
        service.refresh(session, login.tokens.refresh_token)


def test_refresh_rejects_expired_token(session: Session, service: AuthService) -> None:
    service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    login = service.login(session, username="admin", password="strong-password")
    stored_token = session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(login.tokens.refresh_token)))
    assert stored_token is not None
    stored_token.expires_at = datetime.now(UTC) - timedelta(days=1)

    with pytest.raises(AuthenticationError):
        service.refresh(session, login.tokens.refresh_token)


def test_logout_revokes_refresh_token(session: Session, service: AuthService) -> None:
    service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    login = service.login(session, username="admin", password="strong-password")

    service.logout(session, login.tokens.refresh_token)

    stored_token = session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(login.tokens.refresh_token)))
    assert stored_token is not None
    assert stored_token.revoked_at is not None


def test_logout_all_revokes_all_user_tokens(session: Session, service: AuthService) -> None:
    user = service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    first = service.login(session, username="admin", password="strong-password")
    second = service.login(session, username="admin", password="strong-password")

    service.logout_all(session, user.id)

    tokens = session.scalars(
        select(RefreshToken).where(
            RefreshToken.token_hash.in_([
                hash_refresh_token(first.tokens.refresh_token),
                hash_refresh_token(second.tokens.refresh_token),
            ])
        )
    ).all()
    assert len(tokens) == 2
    assert all(token.revoked_at is not None for token in tokens)


def test_current_user_lookup_rejects_deactivated_user(session: Session, service: AuthService) -> None:
    user = service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    login = service.login(session, username="admin", password="strong-password")
    user.is_active = False

    with pytest.raises(AuthenticationError):
        service.get_current_user_from_token(session, login.tokens.access_token)


def test_current_user_lookup_rejects_stale_role(session: Session, service: AuthService) -> None:
    user = service.create_user(session, username="admin", password="strong-password", display_name="Admin", role=UserRole.ADMIN)
    login = service.login(session, username="admin", password="strong-password")
    user.role = UserRole.READ_ONLY.value

    with pytest.raises(AuthenticationError):
        service.get_current_user_from_token(session, login.tokens.access_token)
