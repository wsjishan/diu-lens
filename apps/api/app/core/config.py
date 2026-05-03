from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _parse_origins(raw_origins: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",")]
    return [origin for origin in origins if origin]


def _require_env(name: str, hint: str | None = None) -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value
    suffix = f" {hint}" if hint else ""
    raise RuntimeError(
        f"{name} is required.{suffix}"
    )


def _require_positive_int(name: str, hint: str | None = None) -> int:
    raw = _require_env(name, hint)
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer value.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than 0.")
    return value


def _require_positive_float(name: str, hint: str | None = None) -> float:
    raw = _require_env(name, hint)
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a float value.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than 0.")
    return value


def _require_postgresql_url() -> str:
    database_url = _require_env(
        "DATABASE_URL",
        "Set a PostgreSQL DSN, for example: "
        "'postgresql+psycopg://<user>:<password>@localhost:5432/diu_lens'.",
    )
    if not database_url.startswith("postgresql"):
        raise RuntimeError(
            "DATABASE_URL must be a PostgreSQL URL (postgresql+psycopg://...)."
        )
    return database_url


def _get_env(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    environment: str
    allowed_origins: list[str]
    database_url: str
    jwt_secret: str
    algorithm: str
    access_token_expire_minutes: int
    face_match_distance_threshold: float
    face_match_top_k: int
    face_match_candidate_pool_limit: int
    insightface_model_pack: str
    insightface_root: str
    storage_path: str


_environment = _get_env("APP_ENV", "development").lower()
_database_url = os.getenv("DATABASE_URL", "").strip()
_jwt_secret = os.getenv("JWT_SECRET", "").strip()
_storage_path = os.getenv("STORAGE_PATH", "").strip()

if _environment == "production":
    missing = [
        name
        for name, value in (
            ("DATABASE_URL", _database_url),
            ("JWT_SECRET", _jwt_secret),
            ("STORAGE_PATH", _storage_path),
        )
        if not value
    ]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"Missing required environment variable(s) for production: {joined}."
        )


settings = Settings(
    app_name=_require_env("APP_NAME"),
    version=_require_env("APP_VERSION"),
    environment=_environment,
    allowed_origins=_parse_origins(
        _require_env("ALLOWED_ORIGINS")
    ),
    database_url=_require_postgresql_url(),
    jwt_secret=_require_env("JWT_SECRET", "Set a long random secret."),
    algorithm=_require_env("ALGORITHM"),
    access_token_expire_minutes=_require_positive_int(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "Set a positive integer like 60.",
    ),
    # Calibrated default for ArcFace cosine distance with multi-angle enrollment.
    # Keep configurable via FACE_MATCH_DISTANCE_THRESHOLD for production tuning.
    face_match_distance_threshold=_require_positive_float(
        "FACE_MATCH_DISTANCE_THRESHOLD",
        "Set a positive float like 0.38.",
    ),
    face_match_top_k=_require_positive_int(
        "FACE_MATCH_TOP_K",
        "Set a positive integer like 5.",
    ),
    face_match_candidate_pool_limit=_require_positive_int(
        "FACE_MATCH_CANDIDATE_POOL_LIMIT",
        "Set a positive integer like 200.",
    ),
    insightface_model_pack=_require_env("INSIGHTFACE_MODEL_PACK"),
    insightface_root=_require_env("INSIGHTFACE_ROOT"),
    storage_path=_require_env("STORAGE_PATH"),
)
