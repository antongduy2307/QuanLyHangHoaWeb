from __future__ import annotations

import argparse

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.application.auth_service import AuthService
from app.core.config import get_settings
from app.domain.auth import UserRole
from app.domain.exceptions import ConflictError, ValidationError
from app.infrastructure.db.repositories.auth import AuthRepository


def bootstrap_owner(
    session: Session,
    *,
    username: str,
    password: str,
    display_name: str,
    email: str | None = None,
) -> int:
    repository = AuthRepository()
    if repository.owner_exists(session):
        raise ConflictError("Owner user already exists.")
    service = AuthService(repository=repository)
    user = service.create_user(
        session,
        username=username,
        password=password,
        display_name=display_name,
        email=email,
        role=UserRole.OWNER,
    )
    session.flush()
    return user.id


def main(argv: list[str] | None = None, *, target_session: Session | None = None) -> int:
    parser = argparse.ArgumentParser(description="Create the initial owner user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--email")
    args = parser.parse_args(argv)

    if target_session is not None:
        try:
            user_id = bootstrap_owner(
                target_session,
                username=args.username,
                password=args.password,
                display_name=args.display_name,
                email=args.email,
            )
            target_session.commit()
        except (ConflictError, ValidationError) as exc:
            target_session.rollback()
            print(f"Owner bootstrap failed: {exc}")
            return 1
        print(f"Owner user created: id={user_id}, username={args.username.strip().lower()}")
        return 0

    settings = get_settings()
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        with SessionLocal() as session:
            try:
                user_id = bootstrap_owner(
                    session,
                    username=args.username,
                    password=args.password,
                    display_name=args.display_name,
                    email=args.email,
                )
                session.commit()
            except (ConflictError, ValidationError) as exc:
                session.rollback()
                print(f"Owner bootstrap failed: {exc}")
                return 1
    except SQLAlchemyError as exc:
        print(f"Owner bootstrap failed: database error: {exc}")
        return 2
    finally:
        engine.dispose()

    print(f"Owner user created: id={user_id}, username={args.username.strip().lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
