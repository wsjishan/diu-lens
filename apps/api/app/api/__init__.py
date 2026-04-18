from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.debug import router as debug_router
from app.api.routes.enroll import router as enroll_router
from app.api.routes.health import router as health_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(enroll_router)
api_router.include_router(admin_router)
api_router.include_router(debug_router)
