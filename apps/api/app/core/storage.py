import json
import re
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import UploadFile


ALLOWED_ANGLES: tuple[str, ...] = ("front", "left", "right", "up", "down")
ALLOWED_IMAGE_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

_STORAGE_LOCK = Lock()
_BASE_DIR = Path(__file__).resolve().parents[2]
_STORAGE_DIR = _BASE_DIR / "storage"
_UPLOADS_DIR = _STORAGE_DIR / "uploads"
_ENROLLMENTS_FILE = _STORAGE_DIR / "enrollments.json"
_STUDENT_ID_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")
_ANGLE_FILE_PATTERN = re.compile(
    r"^(front|left|right|up|down)_(?P<index>\d+)\.(jpg|png|webp)$"
)


def empty_uploaded_images() -> dict[str, list[str]]:
    return {angle: [] for angle in ALLOWED_ANGLES}


def _sanitize_student_id(student_id: str) -> str:
    normalized = _STUDENT_ID_SANITIZE_PATTERN.sub("_", student_id.strip())
    sanitized = normalized.strip("._")
    if not sanitized:
        raise ValueError("Invalid student_id for storage path.")
    return sanitized


def _ensure_enrollments_file() -> None:
    _STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    if not _ENROLLMENTS_FILE.exists():
        _ENROLLMENTS_FILE.write_text("[]", encoding="utf-8")


def _save_enrollments(enrollments: list[dict[str, Any]]) -> None:
    _ensure_enrollments_file()
    _ENROLLMENTS_FILE.write_text(
        json.dumps(enrollments, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_enrollments() -> list[dict[str, Any]]:
    _ensure_enrollments_file()
    raw = _ENROLLMENTS_FILE.read_text(encoding="utf-8").strip()

    if not raw:
        _save_enrollments([])
        return []

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        _save_enrollments([])
        return []

    if not isinstance(parsed, list):
        _save_enrollments([])
        return []

    return parsed


def append_enrollment(entry: dict[str, Any]) -> None:
    with _STORAGE_LOCK:
        enrollments = load_enrollments()
        enrollments.append(entry)
        _save_enrollments(enrollments)


def get_enrollments_snapshot() -> dict[str, Any]:
    enrollments = load_enrollments()
    latest = enrollments[-1] if enrollments else None
    return {
        "total": len(enrollments),
        "latest": latest,
        "enrollments": enrollments,
    }


def _next_image_index(angle_dir: Path) -> int:
    max_index = 0
    for path in angle_dir.iterdir():
        if not path.is_file():
            continue
        match = _ANGLE_FILE_PATTERN.match(path.name)
        if not match:
            continue
        file_index = int(match.group("index"))
        if file_index > max_index:
            max_index = file_index
    return max_index + 1


def _ensure_student_upload_dirs(student_id: str) -> tuple[str, Path]:
    sanitized_student_id = _sanitize_student_id(student_id)
    student_dir = _UPLOADS_DIR / sanitized_student_id
    for angle in ALLOWED_ANGLES:
        (student_dir / angle).mkdir(parents=True, exist_ok=True)
    return sanitized_student_id, student_dir


def list_uploaded_images_for_student(student_id: str) -> dict[str, list[str]]:
    sanitized_student_id = _sanitize_student_id(student_id)
    student_dir = _UPLOADS_DIR / sanitized_student_id
    if not student_dir.exists() or not student_dir.is_dir():
        raise FileNotFoundError(f"No uploads found for student_id: {student_id}")

    grouped: dict[str, list[str]] = empty_uploaded_images()
    for angle in ALLOWED_ANGLES:
        angle_dir = student_dir / angle
        if not angle_dir.exists() or not angle_dir.is_dir():
            continue

        files = sorted(path.name for path in angle_dir.iterdir() if path.is_file())
        grouped[angle] = files

    return grouped


async def save_uploaded_images(
    student_id: str, files_by_angle: dict[str, list[UploadFile]]
) -> dict[str, list[str]]:
    _ensure_enrollments_file()
    sanitized_student_id, student_dir = _ensure_student_upload_dirs(student_id)
    uploaded_images = empty_uploaded_images()
    saved_paths_on_disk: list[Path] = []

    try:
        for angle in ALLOWED_ANGLES:
            angle_files = files_by_angle.get(angle, [])
            angle_dir = student_dir / angle
            next_index = _next_image_index(angle_dir)

            for upload in angle_files:
                content_type = (upload.content_type or "").lower()
                extension = ALLOWED_IMAGE_CONTENT_TYPES.get(content_type)
                if not extension:
                    raise ValueError(f"Unsupported file type for angle: {angle}")

                file_bytes = await upload.read()
                if not file_bytes:
                    raise ValueError(f"Uploaded file for '{angle}' is empty.")

                if len(file_bytes) > MAX_UPLOAD_IMAGE_SIZE_BYTES:
                    raise ValueError(f"File too large for angle: {angle}")

                filename = f"{angle}_{next_index}{extension}"
                destination = angle_dir / filename
                destination.write_bytes(file_bytes)

                saved_paths_on_disk.append(destination)
                uploaded_images[angle].append(
                    (Path("uploads") / sanitized_student_id / angle / filename).as_posix()
                )
                next_index += 1
    except Exception:
        for saved_path in saved_paths_on_disk:
            try:
                saved_path.unlink(missing_ok=True)
            except OSError:
                continue
        raise
    finally:
        for angle_files in files_by_angle.values():
            for upload in angle_files:
                await upload.close()

    return uploaded_images
