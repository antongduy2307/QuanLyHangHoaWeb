# Setup

## Create a Virtual Environment

From `QuanLyHangHoaWeb/QuanLyHangHoaWeb/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

## Install Dependencies

From `backend/`:

```bash
python -m pip install -e ".[dev]"
```

## Start PostgreSQL

From the repository root `QuanLyHangHoaWeb/QuanLyHangHoaWeb`:

```bash
docker compose up -d postgres
```

The local development database URL is:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web
```

This repository maps the Docker PostgreSQL container to host port `5433` so it can coexist with a Windows/local PostgreSQL service on port `5432`. If you change `docker-compose.yml` back to `5432:5432`, update `DATABASE_URL` and `TEST_DATABASE_URL` accordingly.

## Run FastAPI Locally

From `backend/`:

```bash
uvicorn app.main:app --reload
```

Health check:

```text
GET http://localhost:8000/api/health
```

Expected response:

```json
{"status":"ok","service":"QuanLyHangHoaWeb"}
```

## Run Tests

From `backend/`:

```bash
pytest
```

To run PostgreSQL-marked integration tests against the Docker database on host port `5433`:

```powershell
$env:DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
$env:TEST_DATABASE_URL="postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web"
pytest -m postgres
```

Auth settings for local development can stay in `.env`:

```powershell
$env:AUTH_SECRET_KEY="local-dev-auth-secret-change-me"
$env:ACCESS_TOKEN_EXPIRE_MINUTES="30"
$env:REFRESH_TOKEN_EXPIRE_DAYS="14"
$env:AUTH_ISSUER="QuanLyHangHoaWeb"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
```

Production must provide a strong `AUTH_SECRET_KEY` through deployment secret storage. Do not reuse the local placeholder outside local/dev/test environments.

For local end-to-end browser testing with auth bypass:

```powershell
$env:APP_ENV="local"
$env:AUTH_BYPASS="true"
$env:CORS_ALLOWED_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Then run the frontend with `VITE_API_BASE_URL=http://127.0.0.1:8000/api`. See `LOCAL_RUNTIME_STABILITY_FIX.md` for preflight and mutation smoke commands.

Optional compile check:

```bash
python -m compileall app tests
```

## Run Alembic Commands

From `backend/`:

```bash
alembic current
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

No domain migrations exist yet. The current Alembic setup is only the baseline migration environment.
