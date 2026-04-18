# DIU Lens API (FastAPI)

Minimal backend foundation for DIU Lens under `apps/api`.

## 1. Create a virtual environment

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
```

## 2. Install dependencies

```bash
pip install -r requirements.txt
```

## 3. Configure environment

```bash
cp .env.example .env
```

`DATABASE_URL` is required. Use a PostgreSQL DSN, for example:

```bash
DATABASE_URL=postgresql+psycopg://<user>:<password>@localhost:5432/diu_lens
```

Auth settings are also required:

```bash
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
APP_ENV=development
```

Optional face matching settings:

```bash
FACE_MATCH_DISTANCE_THRESHOLD=0.45
FACE_MATCH_TOP_K=5
FACE_MATCH_CANDIDATE_POOL_LIMIT=200
```

## 4. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 5. Quick checks

- Health check: `GET http://127.0.0.1:8000/health`
- Enrollment placeholder: `POST http://127.0.0.1:8000/enroll`
- DB debug check: `GET http://127.0.0.1:8000/debug/db`
- Face processing trigger: `POST http://127.0.0.1:8000/debug/process/{student_id}`
- Admin approve: `POST http://127.0.0.1:8000/admin/enrollments/{student_id}/approve`
- Admin reject: `POST http://127.0.0.1:8000/admin/enrollments/{student_id}/reject`
- Admin reset: `POST http://127.0.0.1:8000/admin/enrollments/{student_id}/reset`
- Admin login: `POST http://127.0.0.1:8000/auth/admin/login`
- Admin me: `GET http://127.0.0.1:8000/auth/admin/me`
- Face matching: `POST http://127.0.0.1:8000/admin/recognition/match`

## 6. Bootstrap first super admin

```bash
cd apps/api
python -m app.scripts.create_super_admin \
  --email admin@example.com \
  --full-name \"Initial Super Admin\" \
  --password \"change-me\" \
  --role super_admin
```

## 7. Database migrations

```bash
cd apps/api
alembic upgrade head
```

Create a new migration later with:

```bash
alembic revision --autogenerate -m "add tables"
```

## 8. pgvector prerequisites

`face_embeddings` uses PostgreSQL `pgvector`. Install it on the database server, then verify:

```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```
