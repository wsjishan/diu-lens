from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Protocol


ALLOWED_ANGLES: tuple[str, ...] = (
    "front",
    "left",
    "right",
    "up",
    "down",
    "natural_front",
)
REQUIRED_CAPTURE_ANGLES: tuple[str, ...] = (
    "front",
    "left",
    "right",
    "up",
    "down",
)
_STUDENT_ID_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")
_ANGLE_FILE_PATTERN = re.compile(
    r"^(front|left|right|up|down|natural_front)_(?P<index>\d+)\.(jpg|png|webp)$"
)


class StorageService(Protocol):
    def sanitize_student_id(self, student_id: str) -> str: ...

    def resolve_relative_path(self, relative_path: str) -> Path: ...

    def read_enrollments_json(self) -> list[dict[str, Any]]: ...

    def write_enrollments_json(self, enrollments: list[dict[str, Any]]) -> None: ...

    def save_raw_upload(
        self,
        *,
        student_id: str,
        angle: str,
        content_type: str,
        file_bytes: bytes,
    ) -> str: ...

    def save_processed_crop(
        self,
        *,
        student_id: str,
        angle: str,
        source_rel_path: str,
        image_bytes: bytes,
    ) -> str: ...

    def save_json_artifact(
        self,
        *,
        relative_path: str,
        payload: dict[str, Any],
    ) -> str: ...

    def list_student_uploads(self, student_id: str) -> dict[str, list[str]]: ...

    def list_processed_files(self, student_id: str) -> dict[str, list[str]]: ...

    def remove_relative_file(self, relative_path: str) -> None: ...

    def clear_student_uploads(self, student_id: str) -> None: ...

    def clear_student_processed(self, student_id: str) -> None: ...

    def clear_all_uploads(self) -> None: ...

    def clear_all_processed(self) -> None: ...

    def list_all_relative_files(self, root: str) -> list[str]: ...


class LocalStorageService:
    def __init__(self, base_dir: Path | None = None) -> None:
        resolved_base = base_dir or Path(__file__).resolve().parents[2]
        self._storage_dir = resolved_base / "storage"
        self._uploads_dir = self._storage_dir / "uploads"
        self._processed_dir = self._storage_dir / "processed"
        self._enrollments_file = self._storage_dir / "enrollments.json"
        self._content_type_extensions: dict[str, str] = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }

    def sanitize_student_id(self, student_id: str) -> str:
        normalized = _STUDENT_ID_SANITIZE_PATTERN.sub("_", student_id.strip())
        sanitized = normalized.strip("._")
        if not sanitized:
            raise ValueError("Invalid student_id for storage path.")
        return sanitized

    def resolve_relative_path(self, relative_path: str) -> Path:
        return self._storage_dir / relative_path

    def read_enrollments_json(self) -> list[dict[str, Any]]:
        self._ensure_enrollments_file()
        raw = self._enrollments_file.read_text(encoding="utf-8").strip()

        if not raw:
            self.write_enrollments_json([])
            return []

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            self.write_enrollments_json([])
            return []

        if not isinstance(parsed, list):
            self.write_enrollments_json([])
            return []

        return parsed

    def write_enrollments_json(self, enrollments: list[dict[str, Any]]) -> None:
        self._ensure_enrollments_file()
        self._enrollments_file.write_text(
            json.dumps(enrollments, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def save_raw_upload(
        self,
        *,
        student_id: str,
        angle: str,
        content_type: str,
        file_bytes: bytes,
    ) -> str:
        if angle not in ALLOWED_ANGLES:
            raise ValueError(f"Unsupported angle: {angle}")

        extension = self._content_type_extensions.get(content_type.lower())
        if not extension:
            raise ValueError(f"Unsupported file type for angle: {angle}")

        sanitized_student_id = self.sanitize_student_id(student_id)
        angle_dir = self._uploads_dir / sanitized_student_id / angle
        angle_dir.mkdir(parents=True, exist_ok=True)

        next_index = self._next_image_index(angle_dir)
        filename = f"{angle}_{next_index}{extension}"
        destination = angle_dir / filename
        destination.write_bytes(file_bytes)

        return (Path("uploads") / sanitized_student_id / angle / filename).as_posix()

    def save_processed_crop(
        self,
        *,
        student_id: str,
        angle: str,
        source_rel_path: str,
        image_bytes: bytes,
    ) -> str:
        if angle not in ALLOWED_ANGLES:
            raise ValueError(f"Unsupported angle: {angle}")

        sanitized_student_id = self.sanitize_student_id(student_id)
        source_name = Path(source_rel_path).stem
        student_dir = self._processed_dir / sanitized_student_id / angle
        student_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{source_name}_crop.jpg"
        destination = student_dir / filename
        destination.write_bytes(image_bytes)

        return (Path("processed") / sanitized_student_id / angle / filename).as_posix()

    def save_json_artifact(
        self,
        *,
        relative_path: str,
        payload: dict[str, Any],
    ) -> str:
        destination = self.resolve_relative_path(relative_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return relative_path

    def list_student_uploads(self, student_id: str) -> dict[str, list[str]]:
        sanitized_student_id = self.sanitize_student_id(student_id)
        student_dir = self._uploads_dir / sanitized_student_id
        if not student_dir.exists() or not student_dir.is_dir():
            raise FileNotFoundError(f"No uploads found for student_id: {student_id}")

        grouped: dict[str, list[str]] = {angle: [] for angle in ALLOWED_ANGLES}
        for angle in ALLOWED_ANGLES:
            angle_dir = student_dir / angle
            if not angle_dir.exists() or not angle_dir.is_dir():
                continue
            grouped[angle] = sorted(path.name for path in angle_dir.iterdir() if path.is_file())

        return grouped

    def list_processed_files(self, student_id: str) -> dict[str, list[str]]:
        sanitized_student_id = self.sanitize_student_id(student_id)
        student_dir = self._processed_dir / sanitized_student_id
        if not student_dir.exists() or not student_dir.is_dir():
            return {angle: [] for angle in ALLOWED_ANGLES}

        grouped: dict[str, list[str]] = {angle: [] for angle in ALLOWED_ANGLES}
        for angle in ALLOWED_ANGLES:
            angle_dir = student_dir / angle
            if not angle_dir.exists() or not angle_dir.is_dir():
                continue
            grouped[angle] = sorted(path.name for path in angle_dir.iterdir() if path.is_file())

        return grouped

    def remove_relative_file(self, relative_path: str) -> None:
        self.resolve_relative_path(relative_path).unlink(missing_ok=True)

    def clear_student_uploads(self, student_id: str) -> None:
        sanitized_student_id = self.sanitize_student_id(student_id)
        self._remove_tree(self._uploads_dir / sanitized_student_id)

    def clear_student_processed(self, student_id: str) -> None:
        sanitized_student_id = self.sanitize_student_id(student_id)
        self._remove_tree(self._processed_dir / sanitized_student_id)

    def clear_all_uploads(self) -> None:
        self._uploads_dir.mkdir(parents=True, exist_ok=True)
        for path in self._uploads_dir.iterdir():
            self._remove_tree(path)

    def clear_all_processed(self) -> None:
        self._processed_dir.mkdir(parents=True, exist_ok=True)
        for path in self._processed_dir.iterdir():
            self._remove_tree(path)

    def list_all_relative_files(self, root: str) -> list[str]:
        if root == "uploads":
            base = self._uploads_dir
        elif root == "processed":
            base = self._processed_dir
        else:
            raise ValueError(f"Unsupported root for listing files: {root}")

        if not base.exists() or not base.is_dir():
            return []

        relative_paths: list[str] = []
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            relative_paths.append(path.relative_to(self._storage_dir).as_posix())
        return relative_paths

    def _ensure_enrollments_file(self) -> None:
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        self._uploads_dir.mkdir(parents=True, exist_ok=True)
        if not self._enrollments_file.exists():
            self._enrollments_file.write_text("[]", encoding="utf-8")

    @staticmethod
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

    @staticmethod
    def _remove_tree(path: Path) -> None:
        if not path.exists():
            return
        if path.is_file():
            path.unlink(missing_ok=True)
            return

        for child in sorted(path.rglob("*"), reverse=True):
            if child.is_file():
                child.unlink(missing_ok=True)
            elif child.is_dir():
                child.rmdir()
        path.rmdir()
