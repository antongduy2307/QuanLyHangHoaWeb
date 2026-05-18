from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from app.domain.exceptions import NotFoundError
from app.domain.auth import UserRole
from app.infrastructure.db.models.auth import RefreshToken, User


class AuthRepository:
    def get_user_by_username(self, session: Session, username: str) -> User | None:
        return session.scalar(select(User).where(User.username == username))

    def get_user_by_id(self, session: Session, user_id: int) -> User | None:
        return session.get(User, user_id)

    def require_user_by_id(self, session: Session, user_id: int) -> User:
        user = self.get_user_by_id(session, user_id)
        if user is None:
            raise NotFoundError(f"User {user_id} was not found.")
        return user

    def add_user(self, session: Session, user: User) -> User:
        session.add(user)
        return user

    def owner_exists(self, session: Session) -> bool:
        return session.scalar(select(exists().where(User.role == UserRole.OWNER.value))) is True

    def update_last_login_at(self, session: Session, user: User, when: datetime | None = None) -> None:
        user.last_login_at = when or datetime.now(UTC)
        session.flush()

    def add_refresh_token(self, session: Session, refresh_token: RefreshToken) -> RefreshToken:
        session.add(refresh_token)
        return refresh_token

    def get_refresh_token_by_hash(self, session: Session, token_hash: str) -> RefreshToken | None:
        return session.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    def revoke_refresh_token(
        self,
        session: Session,
        refresh_token: RefreshToken,
        when: datetime | None = None,
    ) -> None:
        if refresh_token.revoked_at is None:
            refresh_token.revoked_at = when or datetime.now(UTC)
            session.flush()

    def revoke_all_user_refresh_tokens(
        self,
        session: Session,
        user_id: int,
        when: datetime | None = None,
    ) -> None:
        session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=when or datetime.now(UTC))
        )
        session.flush()
