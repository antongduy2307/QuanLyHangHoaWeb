from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import AppError
from app.domain.exceptions import AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AuthenticationError)
    async def authentication_handler(_: Request, exc: AuthenticationError) -> JSONResponse:
        response = _error_response(status.HTTP_401_UNAUTHORIZED, "authentication_error", str(exc))
        response.headers["WWW-Authenticate"] = "Bearer"
        return response

    @app.exception_handler(AuthorizationError)
    async def authorization_handler(_: Request, exc: AuthorizationError) -> JSONResponse:
        return _error_response(status.HTTP_403_FORBIDDEN, "authorization_error", str(exc))

    @app.exception_handler(NotFoundError)
    async def not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
        return _error_response(status.HTTP_404_NOT_FOUND, "not_found", str(exc))

    @app.exception_handler(ConflictError)
    async def conflict_handler(_: Request, exc: ConflictError) -> JSONResponse:
        return _error_response(status.HTTP_409_CONFLICT, "conflict", str(exc))

    @app.exception_handler(ValidationError)
    async def validation_handler(_: Request, exc: ValidationError) -> JSONResponse:
        return _error_response(422, "validation_error", str(exc))

    @app.exception_handler(IntegrityError)
    async def integrity_handler(_: Request, __: IntegrityError) -> JSONResponse:
        return _error_response(status.HTTP_409_CONFLICT, "conflict", "Database constraint conflict.")

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error_response(status.HTTP_400_BAD_REQUEST, "application_error", str(exc))
