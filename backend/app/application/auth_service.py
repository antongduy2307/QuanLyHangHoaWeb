from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.domain.auth import UserRole
from app.domain.exceptions import AuthenticationError, ConflictError, ValidationError
from app.infrastructure.db.models.auth import RefreshToken, User
from app.infrastructure.db.repositories.auth import AuthRepository
from app.schemas.auth import AuthenticatedUser, AuthTokenPair, LoginResult


class AuthService:
    def __init__(
        self,
        repository: AuthRepository | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._repository = repository or AuthRepository()
        self._settings = settings or get_settings()

    def create_user(
        self,
        session: Session,
        *,
        username: str,
        password: str,
        display_name: str,
        role: UserRole | str,
        email: str | None = None,
        is_active: bool = True,
    ) -> User:
        normalized_username = self._normalize_username(username)
        normalized_display_name = self._normalize_required_text(display_name, "display_name")
        normalized_role = self._normalize_role(role)
        normalized_email = self._normalize_email(email)
        if self._repository.get_user_by_username(session, normalized_username) is not None:
            raise ConflictError(f"User '{normalized_username}' already exists.")

        user = User(
            username=normalized_username,
            email=normalized_email,
            display_name=normalized_display_name,
            password_hash=hash_password(password),
            role=normalized_role.value,
            is_active=is_active,
        )
        self._repository.add_user(session, user)
        try:
            session.flush()
        except IntegrityError as exc:
            raise ConflictError(f"User '{normalized_username}' already exists.") from exc
        return user

    def authenticate_user(self, session: Session, username: str, password: str) -> User:
        normalized_username = self._normalize_username(username)
        user = self._repository.get_user_by_username(session, normalized_username)
        if user is None or not verify_password(password, user.password_hash):
            raise AuthenticationError("Invalid username or password.")
        if not user.is_active:
            raise AuthenticationError("User account is inactive.")
        return user

    def login(
        self,
        session: Session,
        *,
        username: str,
        password: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> LoginResult:
        user = self.authenticate_user(session, username, password)
        self._repository.update_last_login_at(session, user)
        tokens = self._issue_token_pair(session, user, user_agent=user_agent, ip_address=ip_address)
        session.flush()
        return LoginResult(tokens=tokens, user=self._authenticated_user(user))

    def refresh(
        self,
        session: Session,
        refresh_token: str,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> LoginResult:
        token_hash = hash_refresh_token(refresh_token)
        stored_token = self._repository.get_refresh_token_by_hash(session, token_hash)
        if stored_token is None or stored_token.revoked_at is not None:
            raise AuthenticationError("Refresh token is invalid.")
        now = datetime.now(UTC)
        if self._as_utc(stored_token.expires_at) <= now:
            raise AuthenticationError("Refresh token has expired.")

        user = self._repository.require_user_by_id(session, stored_token.user_id)
        if not user.is_active:
            raise AuthenticationError("User account is inactive.")

        stored_token.last_used_at = now
        self._repository.revoke_refresh_token(session, stored_token, now)
        tokens = self._issue_token_pair(session, user, user_agent=user_agent, ip_address=ip_address)
        session.flush()
        return LoginResult(tokens=tokens, user=self._authenticated_user(user))

    def logout(self, session: Session, refresh_token: str) -> None:
        token_hash = hash_refresh_token(refresh_token)
        stored_token = self._repository.get_refresh_token_by_hash(session, token_hash)
        if stored_token is not None:
            self._repository.revoke_refresh_token(session, stored_token)
        session.flush()

    def logout_all(self, session: Session, user_id: int) -> None:
        self._repository.revoke_all_user_refresh_tokens(session, user_id)

    def get_current_user_from_token(self, session: Session, access_token: str) -> User:
        payload = decode_access_token(access_token, self._settings)
        try:
            user_id = int(payload["sub"])
        except (TypeError, ValueError) as exc:
            raise AuthenticationError("Access token is invalid.") from exc

        user = self._repository.get_user_by_id(session, user_id)
        if user is None:
            raise AuthenticationError("Access token user was not found.")
        if not user.is_active:
            raise AuthenticationError("User account is inactive.")
        if user.role != payload.get("role"):
            raise AuthenticationError("Access token role is stale.")
        return user

    def _issue_token_pair(
        self,
        session: Session,
        user: User,
        *,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> AuthTokenPair:
        plain_refresh_token = generate_refresh_token()
        refresh_token = RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(plain_refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=self._settings.refresh_token_expire_days),
            user_agent=self._normalize_optional_text(user_agent),
            ip_address=self._normalize_optional_text(ip_address),
        )
        self._repository.add_refresh_token(session, refresh_token)
        access_token = create_access_token(user.id, user.role, self._settings)
        return AuthTokenPair(
            access_token=access_token,
            refresh_token=plain_refresh_token,
            token_type="bearer",
            expires_in=self._settings.access_token_expire_minutes * 60,
        )

    def _authenticated_user(self, user: User) -> AuthenticatedUser:
        return AuthenticatedUser(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            role=self._normalize_role(user.role),
            is_active=user.is_active,
        )

    def _normalize_username(self, username: str) -> str:
        normalized = self._normalize_required_text(username, "username").lower()
        if len(normalized) > 64:
            raise ValidationError("username must be 64 characters or fewer.")
        return normalized

    def _normalize_email(self, email: str | None) -> str | None:
        normalized = self._normalize_optional_text(email)
        if normalized is None:
            return None
        return normalized.lower()

    def _normalize_role(self, role: UserRole | str) -> UserRole:
        try:
            return role if isinstance(role, UserRole) else UserRole(str(role))
        except ValueError as exc:
            raise ValidationError(f"Unknown user role: {role}.") from exc

    def _normalize_required_text(self, value: str, field_name: str) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValidationError(f"{field_name} is required.")
        return normalized

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _as_utc(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
