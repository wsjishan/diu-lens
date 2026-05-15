import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.core.auth import bearer_scheme, require_admin, require_super_admin
from app.core.enrollment_db import (
    assert_enrollment_processable,
    EnrollmentInvalidStateError,
    EnrollmentPersistenceError,
    EnrollmentNotFoundError,
    approve_enrollment,
    get_enrollments_snapshot_from_db,
    record_processing_completed_in_db,
    reject_enrollment,
    reset_enrollment,
)
from app.core.embeddings_db import (
    FaceEmbeddingPersistenceError,
    persist_face_embeddings,
)
from app.core.face_pipeline import FacePipelineError, process_student_images
from app.core.storage import get_storage_service


router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


class RejectEnrollmentRequest(BaseModel):
    reason: str | None = None


@router.get("/enrollments")
async def list_admin_enrollments(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)
    snapshot = get_enrollments_snapshot_from_db()
    return {
        "total": snapshot.get("total", 0),
        "latest": snapshot.get("latest"),
        "enrollments": snapshot.get("enrollments", []),
    }


from app.tasks.biometric_tasks import process_student_enrollment_task

@router.post("/enrollments/{student_id}/approve")
async def approve_enrollment_admin(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)
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

    payload: dict[str, object] = {
        "success": result.success,
        "approved": bool(result.success),
        "message": result.message,
        "processing_attempted": False,
        "processing_passed": False,
        "processed_images_count": 0,
        "embeddings_generated_count": 0,
        "processing_error": None,
    }
    if result.debug_details is not None:
        payload["hygiene_debug"] = result.debug_details
    if not result.success:
        return payload

    if result.was_updated:
        process_student_enrollment_task.delay(student_id)
        payload["processing_attempted"] = True
        payload["message"] = "Enrollment approved and queued for background processing."
    else:
        payload["processing_attempted"] = False
        payload["message"] = "Enrollment was already approved."
        
    return payload


@router.post("/enrollments/{student_id}/reject")
async def reject_enrollment_admin(
    student_id: str,
    payload: RejectEnrollmentRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)
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
async def reset_enrollment_admin(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_super_admin(credentials)
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


@router.post("/enrollments/{student_id}/process")
async def process_enrollment_admin(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)
    if not student_id.strip():
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "student_id is required."},
        )

    process_student_enrollment_task.delay(student_id)

    return {
        "success": True,
        "message": "Enrollment processing queued successfully.",
    }
