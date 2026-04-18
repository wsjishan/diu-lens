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

## 6. Database migrations (Phase 5 foundation)

```bash
cd apps/api
alembic upgrade head
```

Create a new migration later with:

```bash
alembic revision --autogenerate -m "add tables"
```
