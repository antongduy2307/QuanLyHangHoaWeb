from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_LOCAL_CORS_ALLOWED_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


class Settings(BaseSettings):
    app_name: str = Field(default="QuanLyHangHoaWeb", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    api_prefix: str = Field(default="/api", alias="API_PREFIX")
    database_url: str = Field(
        default="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web",
        alias="DATABASE_URL",
    )
    auth_secret_key: str = Field(default="local-dev-auth-secret-change-me", alias="AUTH_SECRET_KEY")
    auth_bypass: bool = Field(default=False, alias="AUTH_BYPASS")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    auth_issuer: str = Field(default="QuanLyHangHoaWeb", alias="AUTH_ISSUER")
    cors_allowed_origins: str = Field(
        default=",".join(DEFAULT_LOCAL_CORS_ALLOWED_ORIGINS),
        alias="CORS_ALLOWED_ORIGINS",
    )

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def normalize_cors_allowed_origins(cls, value: object) -> object:
        if isinstance(value, list | tuple):
            return ",".join(str(origin) for origin in value)
        return value

    @model_validator(mode="after")
    def validate_auth_secret(self) -> Settings:
        local_envs = {"local", "dev", "development", "test"}
        if self.app_env.lower() not in local_envs and self.auth_secret_key == "local-dev-auth-secret-change-me":
            msg = "AUTH_SECRET_KEY must be set to a strong non-placeholder value outside local/dev/test."
            raise ValueError(msg)
        if self.app_env.lower() not in local_envs and self.auth_bypass:
            msg = "AUTH_BYPASS can only be enabled in local/dev/test environments."
            raise ValueError(msg)
        if self.app_env.lower() not in local_envs and "*" in self.cors_origins:
            msg = "Wildcard CORS origins are only allowed in local/dev/test environments."
            raise ValueError(msg)
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
