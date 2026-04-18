"""Database engine, session factory, and connectivity helpers."""

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Create and cache the SQLAlchemy engine."""
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
    if _is_sqlite(settings.database_url):
        engine_kwargs["connect_args"] = {"check_same_thread": False}

    return create_engine(settings.database_url, **engine_kwargs)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the SQLAlchemy session factory."""
    return sessionmaker(
        bind=get_engine(),
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )


def get_db_session() -> Generator[Session, None, None]:
    """FastAPI dependency-style DB session provider for future routes."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> tuple[bool, str | None]:
    """Return connectivity status and optional diagnostic message."""
    if not settings.database_url:
        return False, "DATABASE_URL is not configured."

    try:
        engine = get_engine()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)

    return True, None

