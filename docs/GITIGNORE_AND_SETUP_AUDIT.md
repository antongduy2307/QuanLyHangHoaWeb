# GITIGNORE_AND_SETUP_AUDIT

## A. Current repo type and scope

Repo hiện tại là **web migration repo** cho `QuanLyHangHoa`, không phải repo desktop Qt cũ.

Stack thực tế đã xác nhận:

- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL
- Frontend: React + TypeScript + Vite
- Docker Compose: có ở root, dùng để chạy PostgreSQL local
- Env sample files:
  - `.env.example`
  - `frontend/.env.example`

Không thấy trong repo hiện tại:

- `core/version.py`
- `version.json`
- packaged installer files
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## B. `.gitignore` changes made

Đã cập nhật root `.gitignore` theo hướng:

- giữ lại toàn bộ source/tests/migrations/docs quan trọng
- ignore local env files
- ignore Python caches / virtual envs
- ignore frontend build output và `node_modules`
- ignore local temp runtime/test output, đặc biệt:
  - `backend/.tmp-tests/`
- bỏ các rule sai trước đây đang ignore nhầm docs thật:
  - `docs/*_INVESTIGATION.md`
  - `docs/*_IMPLEMENTATION.md`
  - `docs/*_REPORT.md`

## C. Important files confirmed not ignored

Các nhóm file quan trọng được giữ trackable:

- `backend/app/**`
- `backend/tests/**`
- `backend/alembic/**`
- `backend/alembic.ini`
- `backend/pyproject.toml`
- `backend/uv.lock`
- `frontend/src/**`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig*.json`
- `frontend/eslint.config.js`
- `docs/**`
- `docker-compose.yml`
- `.env.example`
- `frontend/.env.example`
- `README.md`

## D. Files/folders intentionally ignored

### Python / backend

- `__pycache__/`
- `*.py[cod]`
- `.pytest_cache/`
- `.mypy_cache/`
- `.ruff_cache/`
- `.coverage`
- `htmlcov/`
- `.venv/`
- `venv/`
- `env/`
- `*.egg-info/`

### Env / secrets

- `.env`
- `.env.local`
- `.env.*`
- `backend/.env*`
- `frontend/.env*`

Ngoại lệ được giữ:

- `.env.example`
- `.env.template`
- `backend/.env.example`
- `backend/.env.template`
- `frontend/.env.example`
- `frontend/.env.template`

### Frontend generated

- `node_modules/`
- `frontend/node_modules/`
- `frontend/dist/`
- `frontend/build/`
- `frontend/.vite/`
- `frontend/.vitest/`
- `frontend/coverage/`

### Temp / local runtime / local output

- `*.log`
- `logs/`
- `tmp/`
- `temp/`
- `exports/`
- `diagnostics/`
- `backend/logs/`
- `backend/tmp/`
- `backend/temp/`
- `backend/exports/`
- `backend/diagnostics/`
- `backend/.tmp-tests/`

### Local DB / dumps

- `*.db`
- `*.sqlite`
- `*.sqlite3`
- `*.dump`
- `*.backup`
- `*.bak`
- `*.pgdump`
- `db_dumps/`
- `backups/`

### OS / editor

- `.DS_Store`
- `Thumbs.db`
- `Desktop.ini`
- `.idea/`
- `.vscode/`

## E. Env / secrets handling

Repo hiện dùng:

- root `.env.example` cho backend/root settings
- `frontend/.env.example` cho frontend settings

Các file local thực tế phát hiện:

- `.env.local`
- `frontend/.env.local`

Các file này phải được coi là local-only và không push lên Git.

## F. Lockfile handling

Đã xác nhận lockfiles quan trọng hiện có:

- `backend/uv.lock`
- `frontend/package-lock.json`

Các file này **không bị ignore** và nên commit.

Không thấy:

- `backend/poetry.lock`
- `backend/requirements*.txt`
- `frontend/pnpm-lock.yaml`
- `frontend/yarn.lock`

## G. Generated or suspicious untracked files

Qua `git status --short` và `git status --ignored --short`, phát hiện:

- nhiều thư mục local test artifact dưới `backend/.tmp-tests/`
- local env files:
  - `.env.local`
  - `frontend/.env.local`
- caches:
  - `.pytest_cache/`
  - `.uv-cache/`
  - `backend/.pytest_cache/`
  - `backend/.uv-cache/`
  - nhiều `__pycache__/`
- generated frontend output:
  - `frontend/dist/`
  - `frontend/node_modules/`

Ngoài ra có một worktree đang bẩn với nhiều source/docs uncommitted và deleted files không thuộc task này. Audit này **không** sửa hoặc revert các thay đổi đó.

## H. Setup guide created

Đã tạo:

- `docs/SETUP_NEW_MACHINE.md`

Nội dung guide này bao gồm:

- cài Git / Python / uv / Node / Docker Desktop
- clone repo
- tạo env files từ sample files thực tế
- start PostgreSQL bằng Docker Compose
- setup backend
- setup frontend
- chạy test local
- migration / reset cautions
- import legacy data notes
- troubleshooting
- Git workflow trước khi push từ máy mới

## I. Commands verified or inspected

Đã inspect hoặc chạy các command sau:

```powershell
git status --short
git status --ignored --short
Get-Content .gitignore
Get-ChildItem -Force
Get-ChildItem -Force backend
Get-ChildItem -Force frontend
Get-ChildItem -Force docs
Get-Content docker-compose.yml
Get-Content backend\pyproject.toml
Get-Content frontend\package.json
Get-Content .env.example
Get-Content frontend\.env.example
Get-Content docs\SETUP.md
Get-Content docs\LOCAL_RUNTIME_STABILITY_FIX.md
```

Verification state đã biết từ lần kiểm tra gần nhất trong repo:

- backend `uv run pytest`: passed
- frontend `npm.cmd run build`: passed
- frontend `npm.cmd run lint`: passed
- frontend `npm.cmd test -- --run`: còn 1 failing test

## J. Known caveats

1. `.gitignore` cũ đã ignore nhầm nhiều docs thật; nếu người dùng từng dựa vào `git status` trước đây thì có thể đã không thấy các file docs cần commit.
2. Repo đang có worktree bẩn từ công việc khác, nên trước khi push cần kiểm tra lại kỹ file nào thực sự muốn đưa lên.
3. Repo có các file JSON report và DB snapshot đã được track sẵn trong `backend/` và `backend/validation_sources/`.
   - Audit này **không** tự ý bỏ track hoặc xoá chúng.
4. Frontend test suite hiện chưa hoàn toàn xanh.
5. `compileall` trên Windows có thể dính lỗi quyền ghi `__pycache__` nếu không đặt `PYTHONPYCACHEPREFIX`.

## K. Recommended user commands before first push

```powershell
git status --short
git diff -- .gitignore docs/SETUP_NEW_MACHINE.md docs/GITIGNORE_AND_SETUP_AUDIT.md
git status --ignored --short
```

Sau đó kiểm tra backend/frontend:

```powershell
cd backend
uv run pytest
$env:PYTHONPYCACHEPREFIX="$env:TEMP\quanlyhanghoa_pycache"
python -m compileall app tests

cd ..\frontend
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --run
```

Và cuối cùng:

```powershell
cd ..
git add .gitignore docs/SETUP_NEW_MACHINE.md docs/GITIGNORE_AND_SETUP_AUDIT.md
git status --short
```
