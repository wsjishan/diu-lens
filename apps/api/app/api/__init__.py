from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.debug import router as debug_router
from app.api.routes.enroll import router as enroll_router
from app.api.routes.health import router as health_router
from app.api.routes.matching import router as matching_router
from app.core.config import settings


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(enroll_router)
api_router.include_router(admin_router)
api_router.include_router(matching_router)
if settings.environment == "development":
    api_router.include_router(debug_router)
