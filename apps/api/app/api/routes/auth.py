from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import (
    AuthError,
    authenticate_admin_user,
    bearer_scheme,
    create_access_token,
    get_current_admin_user,
)


router = APIRouter(prefix="/auth", tags=["auth"])


class AdminLoginRequest(BaseModel):
    email: str = Field(
        ...,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
    )
    password: str = Field(..., min_length=1)


class AdminSummary(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool


@router.post("/admin/login")
async def admin_login(payload: AdminLoginRequest) -> dict[str, object]:
    try:
        admin = authenticate_admin_user(payload.email, payload.password)
    except AuthError as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )

    if admin is None:
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "Invalid email or password."},
        )

    access_token = create_access_token(
        admin_id=admin.id,
        email=admin.email,
        role=admin.role,
    )
    admin_summary = {
        "id": admin.id,
        "email": admin.email,
        "full_name": admin.full_name,
        "role": admin.role,
        "is_active": admin.is_active,
    }
    return {
        "success": True,
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "role": admin.role,
        "admin": admin_summary,
    }


@router.get("/admin/me")
async def admin_me(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    admin = get_current_admin_user(credentials)
    return {
        "success": True,
        "message": "Admin profile fetched successfully",
        "admin": {
            "id": admin.id,
            "email": admin.email,
            "full_name": admin.full_name,
            "role": admin.role,
            "is_active": admin.is_active,
        },
    }
