from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


import app.infrastructure.db.models  # noqa: E402,F401

