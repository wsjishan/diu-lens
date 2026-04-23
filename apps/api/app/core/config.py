from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


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


def _get_positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer value.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than 0.")
    return value


def _get_positive_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
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


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    environment: str
    allowed_origins: list[str]
    database_url: str
    secret_key: str
    algorithm: str
    access_token_expire_minutes: int
    face_match_distance_threshold: float
    face_match_top_k: int
    face_match_candidate_pool_limit: int


settings = Settings(
    app_name=os.getenv("APP_NAME", "DIU Lens API"),
    version=os.getenv("APP_VERSION", "0.1.0"),
    environment=os.getenv("APP_ENV", "development").strip().lower() or "development",
    allowed_origins=_parse_origins(
        os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
    ),
    database_url=_require_postgresql_url(),
    secret_key=_require_env("SECRET_KEY", "Set a long random secret."),
    algorithm=_require_env("ALGORITHM", "Use 'HS256' unless you have a different JWT setup."),
    access_token_expire_minutes=_require_positive_int(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "Set a positive integer like 60.",
    ),
    # TEMPORARY/PROVISIONAL: tighter threshold until clean calibration data exists.
    face_match_distance_threshold=_get_positive_float(
        "FACE_MATCH_DISTANCE_THRESHOLD",
        0.07,
    ),
    face_match_top_k=_get_positive_int("FACE_MATCH_TOP_K", 5),
    face_match_candidate_pool_limit=_get_positive_int(
        "FACE_MATCH_CANDIDATE_POOL_LIMIT",
        200,
    ),
)
