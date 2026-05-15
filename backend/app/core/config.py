from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="QuanLyHangHoaWeb", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    api_prefix: str = Field(default="/api", alias="API_PREFIX")
    database_url: str = Field(
        default="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5432/quanlyhanghoa_web",
        alias="DATABASE_URL",
    )

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
