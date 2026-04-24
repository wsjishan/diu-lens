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


class RejectEnrollmentRequest(BaseModel):
    reason: str | None = None


@router.post("/enrollments/{student_id}/approve")
async def approve_enrollment_admin(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
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

    return {"success": result.success, "message": result.message}


@router.post("/enrollments/{student_id}/reject")
async def reject_enrollment_admin(
    student_id: str,
    payload: RejectEnrollmentRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
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
    # TODO(auth): Restrict to super-admin role only.
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

    try:
        assert_enrollment_processable(student_id)
    except EnrollmentNotFoundError as exc:
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": str(exc)},
        )
    except EnrollmentInvalidStateError as exc:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(exc)},
        )
    except EnrollmentPersistenceError as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )

    try:
        result = process_student_images(student_id, storage=get_storage_service())

        if bool(result.get("processing_passed")) and int(
            result.get("embeddings_generated_count", 0)
        ) > 0:
            persist_face_embeddings(
                student_id=student_id,
                processed_crops=list(result.get("processed_crops", [])),
            )

        record_processing_completed_in_db(
            student_id,
            processed_images_count=int(result.get("processed_images_count", 0)),
            processing_passed=bool(result.get("processing_passed", False)),
        )
    except FacePipelineError as exc:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(exc)},
        )
    except (EnrollmentPersistenceError, FaceEmbeddingPersistenceError, RuntimeError) as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(exc)},
        )
    except OSError:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Failed to write processed outputs."},
        )

    return {
        "success": True,
        "message": "Enrollment processing completed.",
        **result,
    }
