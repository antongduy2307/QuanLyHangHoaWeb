from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict, Field

from app.domain.auth import UserRole


@dataclass(frozen=True, slots=True)
class AuthTokenPair:
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


@dataclass(frozen=True, slots=True)
class AuthenticatedUser:
    id: int
    username: str
    display_name: str
    role: UserRole
    is_active: bool


@dataclass(frozen=True, slots=True)
class LoginResult:
    tokens: AuthTokenPair
    user: AuthenticatedUser


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthenticatedUserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    role: UserRole
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int
    user: AuthenticatedUserResponse | None = None


class LogoutResponse(BaseModel):
    status: str
