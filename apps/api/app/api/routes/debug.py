from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.enrollment_db import (
    EnrollmentPersistenceError,
    record_processing_completed_in_db,
)
from app.core.face_pipeline import FacePipelineError, process_student_images
from app.db.session import check_database_connection
from app.core.storage import (
    get_enrollments_snapshot,
    get_storage_service,
    list_uploaded_images_for_student,
)


router = APIRouter(tags=["debug"])


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
async def debug_process_student_uploads(student_id: str) -> dict[str, object]:
    if not student_id.strip():
        raise HTTPException(
            status_code=400,
            detail={"message": "student_id is required."},
        )

    try:
        result = process_student_images(student_id, storage=get_storage_service())
        try:
            record_processing_completed_in_db(
                student_id,
                processed_images_count=int(result.get("processed_images_count", 0)),
                processing_passed=bool(result.get("processing_passed", False)),
            )
        except (EnrollmentPersistenceError, RuntimeError):
            # Keep debug processing route behavior unchanged if DB persistence is unavailable.
            pass
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
