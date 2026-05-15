from __future__ import annotations


class AppError(Exception):
    """Base application error for future domain and API exceptions."""


class ConfigurationError(AppError):
    """Raised when application configuration is invalid."""

