from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


# Ensure app settings import succeeds in tests.
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/diu_lens")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("APP_ENV", "development")


import app.core.auth as auth_module
import app.core.embeddings_db as embeddings_db_module
import app.core.enrollment_db as enrollment_db_module
import app.core.face_matching as face_matching_module
import app.core.storage as storage_module
import app.db.models  # noqa: F401
import app.db.session as db_session_module
from app.core.auth import hash_password
from app.core.storage_service import LocalStorageService
from app.db.base import Base
from app.db.models import AdminUser
from app.main import create_app


@pytest.fixture
def db_session_factory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: "pytest.TempPathFactory"
) -> Generator[sessionmaker[Session], None, None]:
    db_file = tmp_path / "test.sqlite3"
    engine = create_engine(
        f"sqlite+pysqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    session_factory = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=engine)

    get_factory = lambda: session_factory

    monkeypatch.setattr(db_session_module, "get_engine", lambda: engine)
    monkeypatch.setattr(db_session_module, "get_session_factory", get_factory)
    monkeypatch.setattr(auth_module, "get_session_factory", get_factory)
    monkeypatch.setattr(enrollment_db_module, "get_session_factory", get_factory)
    monkeypatch.setattr(embeddings_db_module, "get_session_factory", get_factory)
    monkeypatch.setattr(face_matching_module, "get_session_factory", get_factory)

    yield session_factory

    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def storage_service(
    monkeypatch: pytest.MonkeyPatch, tmp_path: "pytest.TempPathFactory"
) -> LocalStorageService:
    service = LocalStorageService(base_dir=tmp_path)
    monkeypatch.setattr(storage_module, "_STORAGE_SERVICE", service)
    return service


@pytest.fixture
def client(
    db_session_factory: sessionmaker[Session],
    storage_service: LocalStorageService,
) -> Generator[TestClient, None, None]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_tokens(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
) -> dict[str, str]:
    with db_session_factory() as db:
        db.add_all(
            [
                AdminUser(
                    email="admin@example.com",
                    full_name="Admin User",
                    password_hash=hash_password("admin-pass"),
                    role="admin",
                    is_active=True,
                ),
                AdminUser(
                    email="super@example.com",
                    full_name="Super Admin",
                    password_hash=hash_password("super-pass"),
                    role="super_admin",
                    is_active=True,
                ),
            ]
        )
        db.commit()

    admin_login = client.post(
        "/auth/admin/login",
        json={"email": "admin@example.com", "password": "admin-pass"},
    )
    super_login = client.post(
        "/auth/admin/login",
        json={"email": "super@example.com", "password": "super-pass"},
    )

    assert admin_login.status_code == 200, admin_login.text
    assert super_login.status_code == 200, super_login.text

    admin_payload = admin_login.json()
    super_payload = super_login.json()

    assert admin_payload.get("success") is True
    assert super_payload.get("success") is True

    return {
        "admin": str(admin_payload["access_token"]),
        "super_admin": str(super_payload["access_token"]),
    }
