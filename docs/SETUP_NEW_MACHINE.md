# SETUP_NEW_MACHINE

## 1. Mục tiêu

Tài liệu này hướng dẫn setup **repo web hiện tại** `QuanLyHangHoaWeb` trên một máy Windows mới.

Thành phần chính của repo:

- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + TypeScript + Vite
- Database local: PostgreSQL, thường chạy qua Docker Compose

Repo này **không dùng** desktop installer/update flow của repo Qt cũ.

---

## 2. Phần mềm cần cài trước

### 2.1 Git

Tải Git for Windows:

- [https://git-scm.com/download/win](https://git-scm.com/download/win)

Kiểm tra:

```powershell
git --version
```

### 2.2 Python

Repo backend hiện yêu cầu:

- `backend/pyproject.toml` -> `requires-python = ">=3.11"`

Khuyến nghị cho máy mới:

- Python `3.12.x`

Tải từ:

- [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/)

Khi cài đặt:

- bật `Add python.exe to PATH`
- cài Python launcher `py`

Kiểm tra:

```powershell
python --version
py --version
```

### 2.3 uv

Repo có `backend/uv.lock`, vì vậy nên cài `uv`.

Lệnh cài:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Mở terminal mới rồi kiểm tra:

```powershell
uv --version
```

### 2.4 Node.js

`frontend/package.json` hiện **không khai báo** `engines`, nên khuyến nghị:

- Node.js LTS hiện hành

Tải từ:

- [https://nodejs.org/](https://nodejs.org/)

Kiểm tra:

```powershell
node --version
npm --version
```

### 2.5 Docker Desktop

Repo có `docker-compose.yml` ở root và đang dùng Docker để chạy PostgreSQL local.

Tải:

- [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)

Sau khi cài:

- mở Docker Desktop
- chờ Docker chạy xong

Kiểm tra:

```powershell
docker --version
docker compose version
```

### 2.6 Công cụ tùy chọn

Có thể cài thêm:

- VS Code
- DBeaver / pgAdmin
- Windows Terminal

---

## 3. Clone repo

Thay `<REPO_URL>` bằng URL Git thật của repo:

```powershell
git clone <REPO_URL>
cd <REPO_FOLDER>
```

Ví dụ nếu thư mục clone là `QuanLyHangHoaWeb`:

```powershell
cd QuanLyHangHoaWeb
```

---

## 4. Tạo environment files

### 4.1 Root backend env

Repo hiện có file mẫu:

- `.env.example`

Tạo file local:

```powershell
copy .env.example .env
```

Biến chính trong file này đang gồm:

- `APP_NAME`
- `APP_ENV`
- `API_PREFIX`
- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `AUTH_SECRET_KEY`
- `AUTH_BYPASS`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `REFRESH_TOKEN_EXPIRE_DAYS`
- `AUTH_ISSUER`
- `CORS_ALLOWED_ORIGINS`

### 4.2 Frontend env

Repo hiện có file mẫu:

- `frontend/.env.example`

Khuyến nghị tạo file local override:

```powershell
copy frontend\.env.example frontend\.env.local
```

Biến hiện có:

- `VITE_API_BASE_URL`
- `VITE_AUTH_BYPASS`

### 4.3 Lưu ý quan trọng

- `.env`, `.env.local`, `frontend/.env.local` là file local
- **không commit** các file này lên Git
- repo hiện **không có** `backend/.env.example`, vì backend đang đọc config từ root `.env`

---

## 5. Start PostgreSQL database

Repo hiện có `docker-compose.yml` và dùng PostgreSQL 16.

Từ root repo:

```powershell
docker compose up -d
docker compose ps
```

Port local hiện tại:

- host: `5433`
- container: `5432`

Database URL mặc định:

```text
postgresql+psycopg://quanlyhanghoa:quanlyhanghoa_dev@localhost:5433/quanlyhanghoa_web
```

Dừng dịch vụ:

```powershell
docker compose down
```

---

## 6. Backend setup

### 6.1 Cài dependency backend

```powershell
cd backend
uv sync
```

### 6.2 Chạy migration

```powershell
uv run alembic upgrade head
```

### 6.3 Chạy backend local

```powershell
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

URL thường dùng:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

---

## 7. Frontend setup

Từ root repo:

```powershell
cd frontend
npm install
npm.cmd run dev
```

URL dev mặc định:

```text
http://127.0.0.1:5173
```

Nếu muốn cố định host/port giống các tài liệu local runtime:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

---

## 8. Chạy backend + frontend cùng lúc

Khuyến nghị mở 3 terminal riêng.

### Terminal 1

```powershell
cd <REPO_FOLDER>
docker compose up -d
```

### Terminal 2

```powershell
cd <REPO_FOLDER>\backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 3

```powershell
cd <REPO_FOLDER>\frontend
npm install
npm.cmd run dev
```

---

## 9. Chạy test local

### 9.1 Backend tests

```powershell
cd backend
uv run pytest
```

### 9.2 Backend compile check

Để tránh lỗi quyền ghi `__pycache__`, dùng `PYTHONPYCACHEPREFIX`:

```powershell
cd backend
$env:PYTHONPYCACHEPREFIX="$env:TEMP\quanlyhanghoa_pycache"
python -m compileall app tests
```

### 9.3 Frontend tests và quality checks

```powershell
cd frontend
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```

### 9.4 Trạng thái kiểm tra gần nhất đã xác nhận

Từ lần audit repo gần nhất:

- backend `uv run pytest`: passed
- frontend `npm.cmd run build`: passed
- frontend `npm.cmd run lint`: passed
- frontend `npm.cmd test -- --run`: hiện có **1 test fail**
- backend `python -m compileall app tests`: có thể fail nếu terminal ghi `__pycache__` vào chỗ bị hạn chế quyền; dùng `PYTHONPYCACHEPREFIX` như trên

Không nên giả định test suite hiện hoàn toàn xanh nếu bạn chưa chạy lại trên máy mới.

---

## 10. Database migration / reset

### 10.1 Apply migrations

```powershell
cd backend
uv run alembic upgrade head
```

### 10.2 Tạo migration mới khi thay model

```powershell
cd backend
uv run alembic revision --autogenerate -m "message"
```

### 10.3 Lưu ý reset database

- không reset database nếu đang chứa dữ liệu thật
- với máy dev mới, reset chỉ an toàn khi bạn chắc chắn đó là data local disposable

Command an toàn để kiểm tra trạng thái:

```powershell
docker compose ps
docker volume ls
```

Repo hiện **không** cung cấp command xoá volume mặc định trong tài liệu này để tránh thao tác hủy dữ liệu ngoài ý muốn.

---

## 11. Import legacy desktop data, nếu cần

Không cần cho setup dev cơ bản.

Chỉ dùng khi bạn muốn test migration từ desktop source cũ.

Tài liệu / script hiện có:

- runbook:
  - `docs/IMPORT_REHEARSAL_AND_CUTOVER_RUNBOOK.md`
- attendance dry-run script:
  - `backend/scripts/attendance_import_dry_run.py`

Ví dụ dry-run attendance source:

```powershell
cd backend
uv run python scripts\attendance_import_dry_run.py
```

Legacy source được nhắc trong repo:

- desktop `app.db`
- desktop `attendance.db`

Hai file này là **legacy source**, không phải runtime database của web app hiện tại.

---

## 12. Common problems

### 12.1 `python` not recognized

- cài lại Python
- bật `Add python.exe to PATH`
- thử lại bằng `py`

### 12.2 `uv` not recognized

- mở terminal mới sau khi cài
- chạy lại:

```powershell
uv --version
```

### 12.3 Docker không chạy

- mở Docker Desktop
- chờ Docker engine lên xong rồi chạy lại:

```powershell
docker compose ps
```

### 12.4 PostgreSQL connection refused

Kiểm tra:

```powershell
docker compose ps
```

Xác nhận lại:

- port `5433`
- `DATABASE_URL`
- `TEST_DATABASE_URL`

### 12.5 Alembic migration fails

Kiểm tra:

- PostgreSQL đã chạy chưa
- `DATABASE_URL` có đúng không
- bạn đang đứng trong `backend/` chưa

### 12.6 Frontend không gọi được backend

Kiểm tra:

- backend đang chạy ở `127.0.0.1:8000`
- `frontend/.env.local` có `VITE_API_BASE_URL` đúng không
- CORS trong `.env` có chứa:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

### 12.7 Frontend test fails

Hiện repo đã từng xác nhận có 1 failing test ở:

- `frontend/src/features/settings/SettingsPage.test.tsx`

Nếu máy mới gặp đúng fail này thì đó là tình trạng đã biết, không nhất thiết là do setup sai.

### 12.8 `compileall` / `__pycache__` permission issue

Dùng:

```powershell
$env:PYTHONPYCACHEPREFIX="$env:TEMP\quanlyhanghoa_pycache"
python -m compileall app tests
```

---

## 13. Git workflow trên máy mới

### 13.1 Kiểm tra trạng thái branch

```powershell
git status
git pull
git checkout -b <branch-name>
```

### 13.2 Trước khi commit

```powershell
git status --short
git diff
```

### 13.3 Trước khi push

```powershell
cd backend
uv run pytest

cd ..\frontend
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --run
```

### 13.4 Commit và push

```powershell
git add .
git commit -m "message"
git push origin <branch-name>
```

### 13.5 Cảnh báo

Không commit:

- `.env`
- `.env.local`
- `frontend/.env.local`
- `node_modules`
- `.venv`
- local DB files
- dumps
- caches
- temp test output

---

## 14. Những gì nên commit

- source code backend/frontend
- tests
- Alembic migrations
- docs
- `docker-compose.yml`
- package files
- lockfiles:
  - `backend/uv.lock`
  - `frontend/package-lock.json`
- `.env.example`
- `frontend/.env.example`

---

## 15. Những gì không nên commit

- `.env`
- `.env.local`
- `frontend/.env.local`
- `node_modules`
- `.venv`
- `__pycache__`
- `.pytest_cache`
- `.uv-cache`
- logs
- local DB files
- DB dumps / backups
- build outputs
- `backend/.tmp-tests`

---

## 16. Quick command checklist

### Setup nhanh

```powershell
git clone <REPO_URL>
cd <REPO_FOLDER>
copy .env.example .env
copy frontend\.env.example frontend\.env.local
docker compose up -d
```

### Backend

```powershell
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```powershell
cd frontend
npm install
npm.cmd run dev
```

### Test checklist

```powershell
cd backend
uv run pytest
$env:PYTHONPYCACHEPREFIX="$env:TEMP\quanlyhanghoa_pycache"
python -m compileall app tests

cd ..\frontend
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
```
