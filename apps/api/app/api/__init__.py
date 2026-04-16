from fastapi import APIRouter

from app.api.routes.enroll import router as enroll_router
from app.api.routes.health import router as health_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(enroll_router)
