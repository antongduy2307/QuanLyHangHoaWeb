from __future__ import annotations

import jwt
import pytest

from app.core.config import Settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_refresh_token,
)
from app.domain.auth import UserRole
from app.domain.exceptions import AuthenticationError, ValidationError


def _settings(**overrides) -> Settings:
    values = {
        "APP_ENV": "test",
        "AUTH_SECRET_KEY": "test-secret-key-for-auth-token-tests",
        "AUTH_ISSUER": "QuanLyHangHoaWebTest",
    }
    values.update(overrides)
    return Settings(**values)


def test_password_hash_verifies_and_rejects_wrong_password() -> None:
    hashed = hash_password("correct-password")

    assert hashed != "correct-password"
    assert verify_password("correct-password", hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_short_password_is_rejected() -> None:
    with pytest.raises(ValidationError):
        hash_password("too-short")


def test_access_token_decode_returns_user_id_and_role() -> None:
    settings = _settings()
    token = create_access_token(123, UserRole.OWNER, settings)

    payload = decode_access_token(token, settings)

    assert payload["sub"] == "123"
    assert payload["role"] == "owner"
    assert payload["iss"] == settings.auth_issuer
    assert payload["jti"]


def test_expired_token_is_rejected() -> None:
    settings = _settings(ACCESS_TOKEN_EXPIRE_MINUTES=-1)
    token = create_access_token(123, UserRole.ADMIN, settings)

    with pytest.raises(AuthenticationError):
        decode_access_token(token, settings)


def test_invalid_and_wrong_issuer_tokens_are_rejected() -> None:
    settings = _settings()
    other_settings = _settings(AUTH_ISSUER="OtherIssuer")
    token = create_access_token(123, UserRole.ADMIN, settings)
    wrong_issuer_token = jwt.encode(
        {"sub": "123", "role": "admin", "iss": "WrongIssuer", "jti": "jti"},
        settings.auth_secret_key,
        algorithm="HS256",
    )

    with pytest.raises(AuthenticationError):
        decode_access_token("not-a-token", settings)
    with pytest.raises(AuthenticationError):
        decode_access_token(token, other_settings)
    with pytest.raises(AuthenticationError):
        decode_access_token(wrong_issuer_token, settings)


def test_refresh_token_hashing_is_deterministic_and_verifiable() -> None:
    token = generate_refresh_token()
    token_hash = hash_refresh_token(token)

    assert token_hash != token
    assert verify_refresh_token(token, token_hash) is True
    assert verify_refresh_token("wrong-token", token_hash) is False
