import logging
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.bootstrap import initialize_database
from app.db.session import check_database_connection


def _configure_logging() -> None:
    level = logging.DEBUG if settings.environment == "development" else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(message)s",
    )


def _validate_storage_path() -> None:
    storage_path = Path(settings.storage_path).expanduser().resolve()
    try:
        storage_path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise RuntimeError(
            f"STORAGE_PATH is not writable or cannot be created: {storage_path}"
        ) from exc

    test_file = storage_path / ".write_test"
    try:
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
    except OSError as exc:
        raise RuntimeError(
            f"STORAGE_PATH is not writable: {storage_path}"
        ) from exc


def create_app() -> FastAPI:
    _configure_logging()
    logger = logging.getLogger(__name__)

    app = FastAPI(title=settings.app_name, version=settings.version)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def create_tables() -> None:
        try:
            logger.info("Validating storage path: %s", settings.storage_path)
            _validate_storage_path()
            logger.info("Storage path validated successfully.")
            
            logger.info("Testing database connection...")
            initialize_database()
            
            logger.info(
                "Startup completed environment=%s storage_path=%s allowed_origins=%s",
                settings.environment,
                settings.storage_path,
                ",".join(settings.allowed_origins),
            )
            logger.info("API active bind address and port should be inferred from uvicorn logs or your configured reverse proxy.")
        except Exception:
            logger.exception("Critical startup failure during database initialization")
            raise

    app.include_router(api_router)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_info = {"method": request.method, "path": request.url.path}
        if exc.status_code >= 500:
            logger.exception("HTTP exception: %s", exc.detail)
            detail: dict[str, object] = {
                "message": "Internal server error",
                "request": request_info,
                "error_type": type(exc).__name__,
            }
            if settings.environment == "development":
                detail["error"] = repr(exc)
                detail["traceback"] = traceback.format_exc()
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": detail},
            )
        logger.warning("HTTP exception: status=%s detail=%s", exc.status_code, exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail, "request": request_info},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        request_info = {"method": request.method, "path": request.url.path}
        detail: dict[str, object] = {
            "message": "Internal server error",
            "request": request_info,
            "error_type": type(exc).__name__,
        }
        if settings.environment == "development":
            detail["error"] = repr(exc)
            detail["traceback"] = traceback.format_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": detail},
        )

    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": settings.version,
            "status": "running",
        }

    return app


app = create_app()

