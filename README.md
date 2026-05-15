# QuanLyHangHoaWeb

This repository is the new web migration project for QuanLyHangHoa.

The existing desktop application lives outside this repository at `../QuanLyHangHoa/`. That folder is a read-only reference for architecture, behavior, and future migration planning. Do not modify it from this web repository.

Current status: foundation skeleton only. No desktop business logic has been ported yet.

## Stack

- Backend: Python, FastAPI
- ORM: SQLAlchemy 2.x
- Migrations: Alembic
- Database: PostgreSQL
- Tests: pytest
- Future frontend: React and TypeScript

## Repository Layout

```text
backend/   FastAPI backend skeleton
frontend/  Placeholder for future React/TypeScript app
docs/      Architecture, migration, setup, and implementation notes
```

## First Milestone

The first milestone establishes the backend foundation only: health endpoint, typed settings, database session foundation, Alembic wiring, local PostgreSQL compose service, and smoke tests.

