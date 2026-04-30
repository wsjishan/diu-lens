from __future__ import annotations

from threading import Lock
from typing import Any

from fastapi import UploadFile

from app.core.storage_service import (
    ALLOWED_ANGLES,
    REQUIRED_CAPTURE_ANGLES,
    LocalStorageService,
)


ALLOWED_IMAGE_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

_STORAGE_LOCK = Lock()
_STORAGE_SERVICE = LocalStorageService()


def get_storage_service() -> LocalStorageService:
    return _STORAGE_SERVICE


def empty_uploaded_images() -> dict[str, list[str]]:
    return {angle: [] for angle in ALLOWED_ANGLES}


def load_enrollments() -> list[dict[str, Any]]:
    return get_storage_service().read_enrollments_json()


def append_enrollment(entry: dict[str, Any]) -> None:
    with _STORAGE_LOCK:
        enrollments = load_enrollments()
        enrollments.append(entry)
        get_storage_service().write_enrollments_json(enrollments)


def get_enrollments_snapshot() -> dict[str, Any]:
    try:
        from app.core.enrollment_db import (
            EnrollmentPersistenceError,
            get_enrollments_snapshot_from_db,
        )

        return get_enrollments_snapshot_from_db()
    except (EnrollmentPersistenceError, RuntimeError):
        enrollments = load_enrollments()
        latest = enrollments[-1] if enrollments else None
        return {
            "total": len(enrollments),
            "latest": latest,
            "enrollments": enrollments,
        }


def list_uploaded_images_for_student(student_id: str) -> dict[str, list[str]]:
    return get_storage_service().list_student_uploads(student_id)


def list_processed_files_for_student(student_id: str) -> dict[str, list[str]]:
    return get_storage_service().list_processed_files(student_id)


async def save_uploaded_images(
    student_id: str, files_by_angle: dict[str, list[UploadFile]]
) -> dict[str, list[str]]:
    storage = get_storage_service()
    uploaded_images = empty_uploaded_images()
    saved_relative_paths: list[str] = []

    try:
        # Prevent stale image carry-over across re-verification attempts.
        storage.clear_student_uploads(student_id)
        for angle in ALLOWED_ANGLES:
            for upload in files_by_angle.get(angle, []):
                content_type = (upload.content_type or "").lower()
                if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
                    raise ValueError(f"Unsupported file type for angle: {angle}")

                file_bytes = await upload.read()
                if not file_bytes:
                    raise ValueError(f"Uploaded file for '{angle}' is empty.")

                if len(file_bytes) > MAX_UPLOAD_IMAGE_SIZE_BYTES:
                    raise ValueError(f"File too large for angle: {angle}")

                relative_path = storage.save_raw_upload(
                    student_id=student_id,
                    angle=angle,
                    content_type=content_type,
                    file_bytes=file_bytes,
                )
                saved_relative_paths.append(relative_path)
                uploaded_images[angle].append(relative_path)
    except Exception:
        for relative_path in saved_relative_paths:
            try:
                storage.remove_relative_file(relative_path)
            except OSError:
                continue
        raise
    finally:
        for angle_files in files_by_angle.values():
            for upload in angle_files:
                await upload.close()

    return uploaded_images
