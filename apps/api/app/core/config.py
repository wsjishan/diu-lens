from dataclasses import dataclass
import os

from dotenv import load_dotenv


load_dotenv()


def _parse_origins(raw_origins: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",")]
    return [origin for origin in origins if origin]


def _require_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url

    raise RuntimeError(
        "DATABASE_URL is required. "
        "Set a PostgreSQL DSN, for example: "
        "'postgresql+psycopg://<user>:<password>@localhost:5432/diu_lens'."
    )


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    allowed_origins: list[str]
    database_url: str


settings = Settings(
    app_name=os.getenv("APP_NAME", "DIU Lens API"),
    version=os.getenv("APP_VERSION", "0.1.0"),
    allowed_origins=_parse_origins(
        os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
    ),
    database_url=_require_database_url(),
)
