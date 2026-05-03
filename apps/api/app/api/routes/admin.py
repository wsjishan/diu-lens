from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import func, select

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
from app.db.models.enrollment_images import EnrollmentImage
from app.db.models.enrollments import Enrollment
from app.db.session import get_session_factory


router = APIRouter(prefix="/admin", tags=["admin"])


class RejectEnrollmentRequest(BaseModel):
    reason: str | None = None


@router.get("/enrollments")
async def list_admin_enrollments(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)
    session_factory = get_session_factory()
    with session_factory() as db:
        rows = db.execute(
            select(
                Enrollment.student_id,
                Enrollment.status,
                Enrollment.created_at,
                func.count(EnrollmentImage.id).label("total_images"),
            )
            .outerjoin(EnrollmentImage, EnrollmentImage.enrollment_id == Enrollment.id)
            .group_by(Enrollment.id)
            .order_by(Enrollment.created_at.desc())
        ).all()

    return {
        "enrollments": [
            {
                "student_id": str(student_id),
                "status": str(status),
                "created_at": created_at.isoformat() if created_at is not None else None,
                "total_images": int(total_images or 0),
            }
            for student_id, status, created_at, total_images in rows
        ]
    }


def _run_student_processing(student_id: str) -> dict[str, object]:
    print(f"[processing] start student_id={student_id}")
    try:
        assert_enrollment_processable(student_id)
    except EnrollmentNotFoundError as exc:
        return {
            "ok": False,
            "status_code": 404,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": str(exc),
        }
    except EnrollmentInvalidStateError as exc:
        return {
            "ok": False,
            "status_code": 400,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": str(exc),
        }
    except EnrollmentPersistenceError as exc:
        return {
            "ok": False,
            "status_code": 500,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": str(exc),
        }

    try:
        result = process_student_images(student_id, storage=get_storage_service())
        processed_images_count = int(result.get("processed_images_count", 0))
        embeddings_generated_count = int(result.get("embeddings_generated_count", 0))
        processing_passed = bool(result.get("processing_passed", False))
        if processing_passed and embeddings_generated_count > 0:
            persisted = persist_face_embeddings(
                student_id=student_id,
                processed_crops=list(result.get("processed_crops", [])),
            )
            print(
                "[processing] embeddings_saved "
                f"student_id={student_id} inserted_count={int(persisted.get('inserted_count', 0))} "
                f"deactivated_count={int(persisted.get('deactivated_count', 0))}"
            )
        elif processing_passed and embeddings_generated_count <= 0:
            processing_passed = False

        record_processing_completed_in_db(
            student_id,
            processed_images_count=processed_images_count,
            processing_passed=processing_passed,
        )
        return {
            "ok": processing_passed,
            "status_code": 200 if processing_passed else 500,
            "processing_passed": processing_passed,
            "processed_images_count": processed_images_count,
            "embeddings_generated_count": embeddings_generated_count,
            "processing_error": (
                None
                if processing_passed
                else (
                    "Processing completed but embeddings were not generated."
                    if embeddings_generated_count <= 0
                    else "Processing did not pass."
                )
            ),
            "processing_result": result,
        }
    except FacePipelineError as exc:
        print(f"[processing] end student_id={student_id} success=false reason={exc}")
        record_processing_completed_in_db(
            student_id,
            processed_images_count=0,
            processing_passed=False,
        )
        return {
            "ok": False,
            "status_code": 400,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": str(exc),
        }
    except (EnrollmentPersistenceError, FaceEmbeddingPersistenceError, RuntimeError) as exc:
        print(f"[processing] end student_id={student_id} success=false reason={exc}")
        record_processing_completed_in_db(
            student_id,
            processed_images_count=0,
            processing_passed=False,
        )
        return {
            "ok": False,
            "status_code": 500,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": str(exc),
        }
    except OSError:
        print("[processing] end student_id=%s success=false reason=io_error" % student_id)
        record_processing_completed_in_db(
            student_id,
            processed_images_count=0,
            processing_passed=False,
        )
        return {
            "ok": False,
            "status_code": 500,
            "processing_passed": False,
            "processed_images_count": 0,
            "embeddings_generated_count": 0,
            "processing_error": "Failed to write processed outputs.",
        }
    finally:
        print(f"[processing] end student_id={student_id}")


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

    processing = _run_student_processing(student_id)
    payload["processing_attempted"] = True
    payload["processing_passed"] = bool(processing.get("processing_passed", False))
    payload["processed_images_count"] = int(processing.get("processed_images_count", 0))
    payload["embeddings_generated_count"] = int(
        processing.get("embeddings_generated_count", 0)
    )
    payload["processing_error"] = processing.get("processing_error")
    if bool(processing.get("ok", False)):
        payload["message"] = "Enrollment approved and processed successfully."
    else:
        payload["message"] = (
            "Enrollment approved, but processing failed. "
            "Use Process to retry."
        )
    return payload


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

    processing = _run_student_processing(student_id)
    if not bool(processing.get("ok", False)):
        return JSONResponse(
            status_code=int(processing.get("status_code", 500)),
            content={
                "success": False,
                "message": str(processing.get("processing_error") or "Processing failed."),
                "processing_passed": False,
                "processed_images_count": int(processing.get("processed_images_count", 0)),
                "embeddings_generated_count": int(
                    processing.get("embeddings_generated_count", 0)
                ),
            },
        )

    result = processing.get("processing_result", {})
    if not isinstance(result, dict):
        result = {}
    return {
        "success": True,
        "message": "Enrollment processing completed.",
        **result,
    }
