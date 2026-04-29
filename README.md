# DIU Lens Monorepo

DIU Lens is a full-stack app with:

- `apps/api`: FastAPI backend with PostgreSQL + pgvector
- `apps/web`: Next.js frontend

## Stack

- FastAPI, SQLAlchemy, Alembic
- PostgreSQL + pgvector
- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide

## Prerequisites

- Node.js compatible with Next.js 16 and pnpm
- Python 3.x and pip
- PostgreSQL with `psql` on PATH
- pgvector extension installed in the database

## Install dependencies

From the repository root:

```bash
pnpm install
```

Backend dependencies:

```bash
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

## Configure backend environment

Create or update `apps/api/.env` with:

```bash
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/diu_lens
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Optional face matching tuning:

```bash
FACE_MATCH_DISTANCE_THRESHOLD=0.38
FACE_MATCH_TOP_K=5
FACE_MATCH_CANDIDATE_POOL_LIMIT=200
```

Enable pgvector once per database:

```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## Run locally

### Backend

```bash
cd apps/api
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
pnpm --filter web dev
```

The root shortcut runs the frontend only:

```bash
pnpm dev
```

## One-command dev (macOS/Linux)

From the repository root:

```bash
make dev
# or
./scripts/devctl.sh dev
```

This will:

- detect local PostgreSQL connection mode (socket or localhost)
- ensure database `diu_lens` exists (override with `DB_NAME`)
- run `alembic upgrade head` in `apps/api`
- start backend (`uvicorn`) and frontend (`next dev`) together
- stream both logs with `[api]` and `[web]` prefixes

Environment overrides:

- `API_PORT` (default 8000)
- `WEB_PORT` (default 3000)
- `DB_NAME` (default `diu_lens`)

Windows note: `make` and `scripts/devctl.sh` require a bash-compatible shell
(WSL or Git Bash). Otherwise start backend and frontend separately.

## Other commands

```bash
make migrate   # DB detection + DB create + alembic upgrade head
make api       # backend only (after migrate)
make web       # frontend only
make db-setup  # only detect PostgreSQL and ensure diu_lens exists
```

Frontend production + lint:

```bash
pnpm --filter web build
pnpm --filter web start
pnpm --filter web lint
```

Backend tests:

```bash
cd apps/api
pytest
```

## Project structure

```text
apps/
  api/
  web/
```
