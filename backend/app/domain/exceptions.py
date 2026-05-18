from __future__ import annotations

from app.core.exceptions import AppError


class DomainError(AppError):
    """Base error for domain-layer failures."""


class ValidationError(DomainError):
    """Raised when data violates a domain rule."""


class ConflictError(ValidationError):
    """Raised when data conflicts with an existing domain object."""


class NotFoundError(DomainError):
    """Raised when a requested domain object does not exist."""


class AuthenticationError(DomainError):
    """Raised when authentication credentials or tokens are invalid."""


class AuthorizationError(DomainError):
    """Raised when an authenticated user lacks permission."""
