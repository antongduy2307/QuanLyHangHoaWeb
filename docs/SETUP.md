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
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5432/quanlyhanghoa_web
```

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

