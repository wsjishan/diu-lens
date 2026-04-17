from fastapi import APIRouter, HTTPException

from app.core.storage import get_enrollments_snapshot, list_uploaded_images_for_student


router = APIRouter(tags=["debug"])


def _not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"message": message})


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
