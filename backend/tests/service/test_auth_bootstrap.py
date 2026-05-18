from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.auth.bootstrap_owner import bootstrap_owner, main
from app.domain.exceptions import ConflictError, ValidationError
from app.infrastructure.db.base import Base
from app.infrastructure.db.models.auth import User


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    with SessionLocal() as db_session:
        yield db_session
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_bootstrap_creates_owner(session: Session) -> None:
    user_id = bootstrap_owner(
        session,
        username="admin",
        password="strong-password",
        display_name="Owner",
    )

    user = session.get(User, user_id)
    assert user is not None
    assert user.username == "admin"
    assert user.role == "owner"
    assert user.password_hash != "strong-password"


def test_bootstrap_refuses_second_owner(session: Session) -> None:
    bootstrap_owner(session, username="admin", password="strong-password", display_name="Owner")

    with pytest.raises(ConflictError):
        bootstrap_owner(session, username="other", password="strong-password", display_name="Other")


def test_bootstrap_rejects_weak_password(session: Session) -> None:
    with pytest.raises(ValidationError):
        bootstrap_owner(session, username="admin", password="weak", display_name="Owner")


def test_bootstrap_cli_creates_owner(session: Session) -> None:
    exit_code = main(
        ["--username", "admin", "--password", "strong-password", "--display-name", "Owner"],
        target_session=session,
    )

    assert exit_code == 0
    assert session.scalar(select(User).where(User.username == "admin")) is not None


def test_bootstrap_cli_refuses_second_owner(session: Session) -> None:
    first = main(["--username", "admin", "--password", "strong-password", "--display-name", "Owner"], target_session=session)
    second = main(["--username", "other", "--password", "strong-password", "--display-name", "Other"], target_session=session)

    assert first == 0
    assert second == 1


def test_bootstrap_cli_rejects_weak_password(session: Session) -> None:
    exit_code = main(["--username", "admin", "--password", "weak", "--display-name", "Owner"], target_session=session)

    assert exit_code == 1
