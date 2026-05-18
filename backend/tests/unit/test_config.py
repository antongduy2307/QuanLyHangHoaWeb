from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_auth_config_defaults_are_local_development_safe() -> None:
    settings = Settings()

    assert settings.auth_secret_key == "local-dev-auth-secret-change-me"
    assert settings.auth_bypass is False
    assert settings.access_token_expire_minutes == 30
    assert settings.refresh_token_expire_days == 14
    assert settings.auth_issuer == "QuanLyHangHoaWeb"
    assert "http://localhost:5173" in settings.cors_origins
    assert "http://127.0.0.1:5173" in settings.cors_origins
    assert "http://localhost:3000" in settings.cors_origins
    assert "http://127.0.0.1:3000" in settings.cors_origins


def test_cors_origins_parse_comma_separated_env_value() -> None:
    settings = Settings(
        CORS_ALLOWED_ORIGINS="http://localhost:5173, http://127.0.0.1:5173,,http://localhost:3000"
    )

    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]


def test_auth_secret_placeholder_is_rejected_outside_local_env() -> None:
    with pytest.raises(ValidationError):
        Settings(APP_ENV="production", AUTH_SECRET_KEY="local-dev-auth-secret-change-me")


def test_auth_bypass_is_rejected_outside_local_env() -> None:
    with pytest.raises(ValidationError):
        Settings(APP_ENV="production", AUTH_SECRET_KEY="production-secret", AUTH_BYPASS=True)


def test_wildcard_cors_origin_is_rejected_outside_local_env() -> None:
    with pytest.raises(ValidationError):
        Settings(APP_ENV="production", AUTH_SECRET_KEY="production-secret", CORS_ALLOWED_ORIGINS="*")
