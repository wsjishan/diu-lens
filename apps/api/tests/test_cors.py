from __future__ import annotations

from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import _get_allowed_origins
from app.main import create_app


def test_localhost_origin_receives_cors_headers(client: TestClient) -> None:
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_127_localhost_origin_receives_cors_headers(client: TestClient) -> None:
    response = client.get(
        "/health",
        headers={"Origin": "http://127.0.0.1:3000"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


def test_options_preflight_succeeds_with_cors_headers(client: TestClient) -> None:
    response = client.options(
        "/enroll",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_deployed_frontend_origins_are_read_from_environment(
    monkeypatch,
) -> None:
    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "https://app.example.com, https://www.example.com",
    )

    assert _get_allowed_origins("production") == [
        "https://app.example.com",
        "https://www.example.com",
    ]


def test_cors_middleware_is_registered_once() -> None:
    app = create_app()

    cors_middleware = [
        middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware
    ]
    manual_http_middleware = [
        middleware for middleware in app.user_middleware if middleware.cls is BaseHTTPMiddleware
    ]

    assert len(cors_middleware) == 1
    assert manual_http_middleware == []
