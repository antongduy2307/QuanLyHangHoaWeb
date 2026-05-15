# Architecture

## Target Overview

QuanLyHangHoaWeb is the web migration target for the existing QuanLyHangHoa desktop application. The target stack is:

- Python and FastAPI backend.
- SQLAlchemy 2.x ORM.
- Alembic migrations.
- PostgreSQL database.
- React and TypeScript frontend in a later phase.
- pytest for automated verification.

The first skeleton intentionally establishes only the platform foundation. It does not port inventory, customer, sales, returns, orders, reporting, or attendance business logic yet.

## Backend Layers

The backend is structured to leave room for a modular business application:

- `app/main.py`: FastAPI application factory and route composition.
- `app/api/`: HTTP route modules and future request/response schemas.
- `app/core/`: configuration and common application exceptions.
- `app/infrastructure/db/`: SQLAlchemy declarative base, engine, and session management.
- `tests/`: backend tests runnable from the `backend/` folder.
- `alembic/`: migration environment and future migration versions.

Future backend layers should add application services, domain modules, repositories, and API schemas without mixing HTTP concerns into domain logic.

## Future Frontend Layers

The current `frontend/` folder is a placeholder. The future React/TypeScript implementation should be split by application surface:

- Admin web app for inventory, customers, sales, returns, orders, reporting, and settings.
- Employee attendance portal for day entry, review, and attendance-specific workflows.
- Shared UI package for reusable controls, tables, forms, and layout primitives.
- Shared API client and TypeScript domain enums generated from or aligned with backend API contracts.

## Database Strategy

The target database is PostgreSQL. The web app should use a single PostgreSQL database with Alembic-managed schema revisions.

The desktop reference currently has two SQLite databases: `app.db` and `attendance.db`. The web target should avoid preserving that split unless a future operational requirement justifies it. Keeping the future data in one PostgreSQL database allows real foreign keys, stronger transactions, and safer attendance-to-inventory integration.

## Desktop Reference Is Read-Only

`../QuanLyHangHoa/` is a cloned desktop reference repository. It must stay stable while the web migration is built. The reference app is used only to inspect architecture, behavior, tests, and data semantics.

Changing the desktop reference during web setup would make the migration target unstable and make it harder to distinguish existing behavior from migration work.

## Why Business Logic Is Not Ported Yet

This first step is foundation setup only. Business logic is intentionally deferred until the backend project has:

- deterministic settings,
- database connectivity,
- Alembic migration wiring,
- test execution,
- documentation,
- and a clean repository structure.

Porting business logic before this foundation would mix infrastructure decisions with domain migration decisions and increase migration risk.

