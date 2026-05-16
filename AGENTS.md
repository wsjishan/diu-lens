# AI Agent Instructions for DIU Lens

This document provides critical operational guidelines, architectural constraints, and workflow rules for any AI agent interacting with the DIU Lens repository.

## 1. Project Context & Architecture

DIU Lens is a robust, full-stack biometric facial recognition system.

*   **Monorepo Structure:** Managed via `pnpm` workspaces (`apps/api` and `apps/web`).
*   **Backend (`apps/api`):** Python-based. Uses **FastAPI** for the REST API, **SQLAlchemy** (async/sync mixed depending on context, default to sync in core logic unless otherwise specified) for ORM, and **Alembic** for migrations. 
*   **Asynchronous Processing:** **Celery** with **Redis** is used for heavy biometric tasks (e.g., face embedding extraction).
*   **Database:** **PostgreSQL** heavily relying on the **`pgvector`** extension for storing and querying 512-dimensional face embeddings.
*   **Frontend (`apps/web`):** **Next.js** (App Router paradigm), **TypeScript**, **Tailwind CSS**, and **shadcn/ui**.

## 2. Core Directives & Mandates

1.  **Strict Architectural Compliance:** Do NOT introduce new architectural layers (e.g., Kubernetes, Kafka, microservices) or change the fundamental stack (e.g., swapping FastAPI for Django) unless explicitly instructed by the user.
2.  **Idempotency & Concurrency:** All operations modifying enrollment states or handling biometric processing MUST be idempotent. You must utilize distributed Redis locks (`redis_client.lock`) to prevent race conditions in background tasks.
3.  **Exhaustive Validation:** Never assume a code change works. You MUST run the backend test suite (`pytest`) after making any modifications to the API or Core logic. If you add a feature or fix a bug, you MUST write or update corresponding tests.
4.  **Context Efficiency:** Keep your file reads targeted. Rely on `grep_search` and `glob` to find usage patterns rather than dumping entire large files into context.

## 3. Backend Development Rules (`apps/api`)

### Database & ORM
*   **Session Management:** Always acquire database sessions using the context manager pattern via `get_session_factory()` to ensure connections are properly closed and returned to the pool.
    ```python
    from app.db.session import get_session_factory
    
    session_factory = get_session_factory()
    with session_factory() as db:
        # database operations
        db.commit()
    ```
*   **Migrations:** Any modification to SQLAlchemy models in `app/db/models/` requires a new Alembic migration. Run `alembic revision --autogenerate -m "description"` to generate it.
*   **Vector Operations:** When dealing with face embeddings, strictly adhere to `pgvector` querying patterns (e.g., cosine distance `<=>`).

### Asynchronous Tasks (Celery)
*   **Task State Machine:** Tasks are tracked in the `biometric_tasks` table. Any new Celery task must update its state (`queued`, `processing`, `success`, `failed`, `retrying`) using functions in `app.core.task_db`.
*   **Zombie Task Prevention:** Tasks must be robust against worker crashes. Ensure recovery mechanisms (like the one in `task_recovery.py`) account for new states if you introduce them.

### Testing
*   **Execution:** Run tests from the `apps/api` directory using: `PYTHONPATH=. .venv/bin/pytest`.
*   **Database Isolation:** Tests utilize a local SQLite database per test session for speed and isolation. When testing functions that instantiate their own database sessions, you MUST use `monkeypatch` to inject the `db_session_factory` fixture to prevent connection errors or cross-test contamination.
    ```python
    def test_example(db_session_factory, monkeypatch):
        monkeypatch.setattr("app.core.target_module.get_session_factory", lambda: db_session_factory)
        # proceed with test
    ```

## 4. Frontend Development Rules (`apps/web`)

*   **UI Components:** Check `apps/web/components/ui/` for existing `shadcn/ui` components before creating new ones or installing new libraries.
*   **Styling:** Use Tailwind CSS utility classes strictly. Avoid creating custom `.css` files unless absolutely necessary for complex animations or global overrides.
*   **Linting:** Ensure code passes `pnpm --filter web lint` before finalizing tasks.

## 5. Standard Commands for Agents

*   **Install Backend Deps:** `cd apps/api && .venv/bin/pip install -r requirements.txt`
*   **Run Backend Tests:** `cd apps/api && PYTHONPATH=. .venv/bin/pytest`
*   **Format/Lint Backend:** Check if `ruff` or `black` is available in requirements, otherwise rely on manual idiomatic formatting.
*   **Generate Migration:** `cd apps/api && .venv/bin/alembic revision --autogenerate -m "..."`
*   **Run Frontend Linter:** `pnpm --filter web lint`
