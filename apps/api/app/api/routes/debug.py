from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.core.auth import bearer_scheme, require_super_admin
from app.core.config import settings
from app.core.enrollment_db import (
    approve_enrollment,
    EnrollmentPersistenceError,
    reject_enrollment,
    record_processing_completed_in_db,
    reset_enrollment,
)
from app.core.embeddings_db import (
    FaceEmbeddingPersistenceError,
    list_active_embeddings_for_student,
    persist_face_embeddings,
)
from app.core.face_pipeline import FacePipelineError, process_student_images
from app.db.session import check_database_connection
from app.core.storage import (
    get_enrollments_snapshot,
    get_storage_service,
    list_uploaded_images_for_student,
)


router = APIRouter(tags=["debug"])


class RejectEnrollmentRequest(BaseModel):
    reason: str | None = None


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"message": message})


@router.get("/debug/db")
async def debug_db() -> dict[str, object]:
    configured = bool(settings.database_url)
    connected, message = check_database_connection()
    return {
        "configured": configured,
        "connected": connected,
        "message": message,
    }


@router.get("/debug/enrollments")
async def debug_enrollments() -> dict[str, object]:
    try:
        snapshot = get_enrollments_snapshot()
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to read enrollments storage."},
        ) from exc

    return {
        "total": snapshot["total"],
        "latest": snapshot["latest"],
        "enrollments": snapshot["enrollments"],
    }


@router.get("/debug/uploads/{student_id}")
async def debug_uploads(student_id: str) -> dict[str, object]:
    if not student_id.strip():
        raise HTTPException(
            status_code=400,
            detail={"message": "student_id is required."},
        )

    try:
        uploads = list_uploaded_images_for_student(student_id)
    except FileNotFoundError as exc:
        raise _not_found(str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc)}) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to inspect uploads directory."},
        ) from exc

    return {
        "student_id": student_id,
        "angles": uploads,
    }


@router.post("/debug/process/{student_id}")
async def debug_process_student_uploads(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_super_admin(credentials)
    if not student_id.strip():
        raise HTTPException(
            status_code=400,
            detail={"message": "student_id is required."},
        )

    try:
        result = process_student_images(student_id, storage=get_storage_service())
        try:
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
        except (EnrollmentPersistenceError, FaceEmbeddingPersistenceError, RuntimeError) as exc:
            raise HTTPException(
                status_code=500,
                detail={"message": str(exc)},
            ) from exc
        return result
    except FacePipelineError as exc:
        raise HTTPException(
            status_code=400,
            detail={"message": str(exc)},
        ) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to write processed outputs."},
        ) from exc


@router.get("/debug/embeddings/{student_id}")
async def debug_embeddings(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_super_admin(credentials)
    if not student_id.strip():
        raise HTTPException(
            status_code=400,
            detail={"message": "student_id is required."},
        )

    try:
        rows = list_active_embeddings_for_student(student_id)
    except FaceEmbeddingPersistenceError as exc:
        raise HTTPException(
            status_code=500,
            detail={"message": str(exc)},
        ) from exc

    return {
        "student_id": student_id,
        "active_embeddings_count": len(rows),
        "embeddings": rows,
    }


@router.post("/debug/admin/approve/{student_id}")
async def admin_approve_enrollment(
    student_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
    require_super_admin(credentials)
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


@router.post("/debug/admin/reject/{student_id}")
async def admin_reject_enrollment(
    student_id: str,
    payload: RejectEnrollmentRequest | None = None,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    # TODO(auth): Restrict to admin/super-admin role.
    require_super_admin(credentials)
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


@router.post("/debug/admin/reset/{student_id}")
async def admin_reset_enrollment(
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
