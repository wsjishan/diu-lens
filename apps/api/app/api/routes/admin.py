from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.enrollment_db import (
    EnrollmentPersistenceError,
    approve_enrollment,
    reject_enrollment,
    reset_enrollment,
)


router = APIRouter(prefix="/admin", tags=["admin"])


class RejectEnrollmentRequest(BaseModel):
    reason: str | None = None


@router.post("/enrollments/{student_id}/approve")
async def approve_enrollment_admin(student_id: str) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
    if not student_id.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "student_id is required."},
        )

    try:
        result = approve_enrollment(student_id)
    except EnrollmentPersistenceError as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )

    return {"success": result.success, "message": result.message}


@router.post("/enrollments/{student_id}/reject")
async def reject_enrollment_admin(
    student_id: str, payload: RejectEnrollmentRequest | None = None
) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
    if not student_id.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "student_id is required."},
        )

    try:
        result = reject_enrollment(
            student_id,
            reason=payload.reason if payload is not None else None,
        )
    except EnrollmentPersistenceError as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )

    return {"success": result.success, "message": result.message}


@router.post("/enrollments/{student_id}/reset")
async def reset_enrollment_admin(student_id: str) -> dict[str, object]:
    # TODO(auth): Restrict to super-admin role only.
    if not student_id.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "student_id is required."},
        )

    try:
        result = reset_enrollment(student_id)
    except EnrollmentPersistenceError as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )

    return {"success": result.success, "message": result.message}
