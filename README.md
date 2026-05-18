# QuanLyHangHoaWeb

This repository is the new web migration project for QuanLyHangHoa.

The existing desktop application lives outside this repository at `../QuanLyHangHoa/`. That folder is a read-only reference for architecture, behavior, and future migration planning. Do not modify it from this web repository.

Current status: the backend foundation is in place with PostgreSQL/Alembic, authentication, protected inventory/customer APIs, protected sales/returns APIs, and import/rehearsal tooling for the existing desktop `app.db`. The frontend now has a Vite React TypeScript admin shell with login/logout, bearer-token auth flow, refresh handling, protected routes, role guards, and inventory/customer/sales/returns mutation screens.

Still not implemented: attendance, orders, reporting workflows, user management UI, production deployment, and attendance database migration.

## Stack

- Backend: Python, FastAPI
- ORM: SQLAlchemy 2.x
- Migrations: Alembic
- Database: PostgreSQL
- Tests: pytest
- Frontend: React, TypeScript, Vite, React Router, TanStack Query, Vitest

## Repository Layout

```text
backend/   FastAPI backend, domain services, import tooling, tests
frontend/  Vite React TypeScript admin app shell
docs/      Architecture, migration, setup, and implementation notes
```

## Current Milestones

- Backend foundation: health endpoint, typed settings, SQLAlchemy session foundation, Alembic wiring, PostgreSQL compose service, and smoke tests.
- Phase 2 inventory/customer: schema, services, protected APIs, import validation, core import, and disposable import rehearsal.
- Phase 3 sales/returns: schema, services, update behavior, protected APIs, historical import tooling, and full Phase 2 + Phase 3 rehearsal.
- Auth: users, refresh tokens, password hashing, JWT access tokens, login/refresh/logout/me APIs, owner bootstrap, and route protection.
- Frontend Batch 1: Vite React TypeScript tooling, admin shell, placeholder routes, tests.
- Frontend Batch 2: login/logout, token storage, refresh-on-401 handling, protected route shell, role guards.

The Docker PostgreSQL service is mapped to host port `5433` by default:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web
```

Frontend local development uses:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

For local browser stability, CORS preflight, and auth bypass commands, see `docs/LOCAL_RUNTIME_STABILITY_FIX.md`.
