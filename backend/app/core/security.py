from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from jwt import ExpiredSignatureError, InvalidIssuerError, InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import Settings
from app.domain.auth import UserRole
from app.domain.exceptions import AuthenticationError, ValidationError


ACCESS_TOKEN_ALGORITHM = "HS256"
MIN_PASSWORD_LENGTH = 10

_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    _validate_password(password)
    return _password_hash.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return _password_hash.verify(plain, hashed)
    except Exception:  # noqa: BLE001 - invalid legacy hash strings should simply fail verification.
        return False


def create_access_token(user_id: int, role: UserRole | str, settings: Settings) -> str:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_expire_minutes)
    role_value = role.value if isinstance(role, UserRole) else str(role)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role_value,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": settings.auth_issuer,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm=ACCESS_TOKEN_ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[ACCESS_TOKEN_ALGORITHM],
            issuer=settings.auth_issuer,
        )
    except ExpiredSignatureError as exc:
        raise AuthenticationError("Access token has expired.") from exc
    except (InvalidIssuerError, InvalidTokenError) as exc:
        raise AuthenticationError("Access token is invalid.") from exc

    if not payload.get("sub") or not payload.get("role") or not payload.get("jti"):
        raise AuthenticationError("Access token is invalid.")
    return payload


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    if not token:
        raise ValidationError("Refresh token is required.")
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_refresh_token(candidate: str, stored_hash: str) -> bool:
    if not candidate or not stored_hash:
        return False
    return hmac.compare_digest(hash_refresh_token(candidate), stored_hash)


def _validate_password(password: str) -> None:
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")
