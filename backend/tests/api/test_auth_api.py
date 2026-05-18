from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_session
from app.application.auth_service import AuthService
from app.domain.auth import UserRole
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.auth import RefreshToken, User
from app.core.security import hash_refresh_token
from app.main import app


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    try:
        yield SessionLocal
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(session_factory) -> Iterator[TestClient]:
    def override_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_user(
    session_factory,
    *,
    username: str = "admin",
    password: str = "strong-password",
    role: UserRole = UserRole.OWNER,
    is_active: bool = True,
) -> int:
    with session_factory() as session:
        user = AuthService().create_user(
            session,
            username=username,
            password=password,
            display_name="Admin",
            role=role,
            is_active=is_active,
        )
        session.commit()
        return user.id


def test_login_success(client: TestClient, session_factory) -> None:
    create_user(session_factory)

    response = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["expires_in"] == 1800
    assert payload["user"]["username"] == "admin"
    assert payload["user"]["role"] == "owner"


def test_login_wrong_password_returns_401(client: TestClient, session_factory) -> None:
    create_user(session_factory)

    response = client.post("/api/auth/login", json={"username": "admin", "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_inactive_user_cannot_login(client: TestClient, session_factory) -> None:
    create_user(session_factory, is_active=False)

    response = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"})

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


def test_refresh_rotates_token(client: TestClient, session_factory) -> None:
    create_user(session_factory)
    login = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"}).json()

    response = client.post("/api/auth/refresh", json={"refresh_token": login["refresh_token"]})

    assert response.status_code == 200
    refreshed = response.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"] != login["refresh_token"]
    assert refreshed["user"] is None
    with session_factory() as session:
        old_token = session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(login["refresh_token"]))
        )
        assert old_token is not None
        assert old_token.revoked_at is not None


def test_logout_revokes_refresh_token(client: TestClient, session_factory) -> None:
    create_user(session_factory)
    login = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"}).json()

    response = client.post("/api/auth/logout", json={"refresh_token": login["refresh_token"]})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    with session_factory() as session:
        stored_token = session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(login["refresh_token"]))
        )
        assert stored_token is not None
        assert stored_token.revoked_at is not None


def test_me_works_with_bearer_token(client: TestClient, session_factory) -> None:
    user_id = create_user(session_factory)
    login = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"}).json()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"})

    assert response.status_code == 200
    assert response.json()["id"] == user_id
    assert response.json()["username"] == "admin"


def test_me_rejects_missing_and_invalid_token(client: TestClient, session_factory) -> None:
    create_user(session_factory)

    missing = client.get("/api/auth/me")
    invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid-token"})

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert missing.json()["error"]["code"] == "authentication_error"
    assert invalid.json()["error"]["code"] == "authentication_error"


def test_me_rejects_deactivated_user(client: TestClient, session_factory) -> None:
    user_id = create_user(session_factory)
    login = client.post("/api/auth/login", json={"username": "admin", "password": "strong-password"}).json()
    with session_factory() as session:
        user = session.get(User, user_id)
        user.is_active = False
        session.commit()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"})

    assert response.status_code == 401
