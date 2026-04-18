"""Face processing pipeline for enrollment uploads.

Phase 7 scope:
- detect face
- crop/alignment
- embedding generation
- save processed crops and result snapshots locally
"""

from __future__ import annotations

import re
from threading import Lock
from typing import Any

import cv2
import numpy as np

from app.core.storage_service import ALLOWED_ANGLES, StorageService
_STUDENT_ID_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")

_ANALYZER_LOCK = Lock()
_ANALYZER: Any = None
_ANALYZER_INIT_ERROR: str | None = None


class FacePipelineError(Exception):
    """Raised for recoverable processing failures."""


def _sanitize_student_id(student_id: str) -> str:
    normalized = _STUDENT_ID_SANITIZE_PATTERN.sub("_", student_id.strip())
    sanitized = normalized.strip("._")
    if not sanitized:
        raise FacePipelineError("Invalid student_id for processing path.")
    return sanitized


def _load_analyzer() -> Any:
    global _ANALYZER
    global _ANALYZER_INIT_ERROR

    if _ANALYZER is not None:
        return _ANALYZER

    with _ANALYZER_LOCK:
        if _ANALYZER is not None:
            return _ANALYZER

        if _ANALYZER_INIT_ERROR is not None:
            raise FacePipelineError(_ANALYZER_INIT_ERROR)

        try:
            from insightface.app import FaceAnalysis
        except Exception as exc:  # noqa: BLE001
            _ANALYZER_INIT_ERROR = (
                "InsightFace is not available. Install insightface and onnxruntime. "
                f"Details: {exc}"
            )
            raise FacePipelineError(_ANALYZER_INIT_ERROR) from exc

        try:
            analyzer = FaceAnalysis(
                name="buffalo_l",
                providers=["CPUExecutionProvider"],
            )
            analyzer.prepare(ctx_id=-1, det_size=(640, 640))
        except Exception as exc:  # noqa: BLE001
            _ANALYZER_INIT_ERROR = f"Failed to initialize InsightFace model: {exc}"
            raise FacePipelineError(_ANALYZER_INIT_ERROR) from exc

        _ANALYZER = analyzer
        return _ANALYZER


def _pick_main_face(faces: list[Any]) -> Any:
    if not faces:
        raise FacePipelineError("No face detected.")

    def bbox_area(face: Any) -> float:
        bbox = getattr(face, "bbox", None)
        if bbox is None or len(bbox) != 4:
            return 0.0
        return max(0.0, float((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])))

    return max(faces, key=bbox_area)


def _crop_from_bbox(image: np.ndarray, face: Any) -> np.ndarray:
    bbox = getattr(face, "bbox", None)
    if bbox is None or len(bbox) != 4:
        raise FacePipelineError("Face bounding box missing.")

    x1, y1, x2, y2 = [int(v) for v in bbox]
    height, width = image.shape[:2]
    x1 = max(0, min(x1, width - 1))
    x2 = max(0, min(x2, width))
    y1 = max(0, min(y1, height - 1))
    y2 = max(0, min(y2, height))

    if x2 <= x1 or y2 <= y1:
        raise FacePipelineError("Detected face box is invalid.")

    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        raise FacePipelineError("Face crop is empty.")

    # Keep fallback crop size consistent with aligned output.
    return cv2.resize(crop, (112, 112), interpolation=cv2.INTER_AREA)


def _align_face(image: np.ndarray, face: Any) -> np.ndarray:
    kps = getattr(face, "kps", None)
    if kps is None:
        return _crop_from_bbox(image, face)

    try:
        from insightface.utils import face_align

        aligned = face_align.norm_crop(image, landmark=kps)
    except Exception as exc:  # noqa: BLE001
        raise FacePipelineError(f"Face alignment failed: {exc}") from exc

    if aligned is None or aligned.size == 0:
        raise FacePipelineError("Aligned face crop is empty.")

    return aligned


def _extract_embedding(face: Any) -> list[float]:
    embedding = getattr(face, "normed_embedding", None)
    if embedding is None:
        embedding = getattr(face, "embedding", None)

    if embedding is None:
        raise FacePipelineError("Embedding could not be generated for detected face.")

    vector = np.asarray(embedding, dtype=np.float32).flatten()
    if vector.size == 0:
        raise FacePipelineError("Generated embedding is empty.")

    return vector.tolist()


def _save_crop_image(
    storage: StorageService,
    student_id: str,
    angle: str,
    source_rel_path: str,
    crop: np.ndarray,
) -> str:
    success, encoded = cv2.imencode(".jpg", crop)
    if not success:
        raise FacePipelineError("Failed to write processed crop image.")

    try:
        return storage.save_processed_crop(
            student_id=student_id,
            angle=angle,
            source_rel_path=source_rel_path,
            image_bytes=encoded.tobytes(),
        )
    except OSError as exc:
        raise FacePipelineError("Failed to write processed crop image.") from exc


def _save_processing_snapshot(
    storage: StorageService,
    student_id: str,
    result: dict[str, Any],
) -> None:
    storage.save_json_artifact(
        relative_path=f"processed/{student_id}/processing_result.json",
        payload=result,
    )


def process_student_images(student_id: str, storage: StorageService) -> dict[str, Any]:
    """Process all saved uploaded enrollment images for a student."""
    sanitized_student_id = _sanitize_student_id(student_id)

    try:
        uploads_by_angle = storage.list_student_uploads(sanitized_student_id)
    except FileNotFoundError as exc:
        raise FacePipelineError(str(exc)) from exc
    except ValueError as exc:
        raise FacePipelineError(str(exc)) from exc

    analyzer = _load_analyzer()

    processed_crops: list[dict[str, Any]] = []
    failed_images: list[dict[str, str]] = []
    failure_reasons: set[str] = set()

    for angle in ALLOWED_ANGLES:
        for file_name in uploads_by_angle.get(angle, []):
            image_rel_path = (
                f"uploads/{sanitized_student_id}/{angle}/{file_name}"
            )
            source_abs_path = storage.resolve_relative_path(image_rel_path)

            try:
                image = cv2.imread(str(source_abs_path))
                if image is None:
                    raise FacePipelineError("Failed to read image from disk.")

                faces = analyzer.get(image)
                face = _pick_main_face(faces)
                aligned_crop = _align_face(image, face)
                embedding = _extract_embedding(face)
                crop_rel_path = _save_crop_image(
                    storage=storage,
                    student_id=sanitized_student_id,
                    angle=angle,
                    source_rel_path=image_rel_path,
                    crop=aligned_crop,
                )

                processed_crops.append(
                    {
                        "angle": angle,
                        "source_image": image_rel_path,
                        "crop_path": crop_rel_path,
                        "embedding": embedding,
                        "embedding_dim": len(embedding),
                    }
                )
            except FacePipelineError as exc:
                reason = str(exc)
                failed_images.append(
                    {
                        "angle": angle,
                        "file_name": file_name,
                        "source_image": image_rel_path,
                        "reason": reason,
                    }
                )
                failure_reasons.add(reason)
            except Exception as exc:  # noqa: BLE001
                reason = f"Unexpected processing error: {exc}"
                failed_images.append(
                    {
                        "angle": angle,
                        "file_name": file_name,
                        "source_image": image_rel_path,
                        "reason": reason,
                    }
                )
                failure_reasons.add(reason)

    embeddings_generated_count = sum(1 for item in processed_crops if item.get("embedding"))
    result = {
        "student_id": sanitized_student_id,
        "processing_passed": bool(processed_crops) and not failed_images,
        "processed_images_count": len(processed_crops),
        "embeddings_generated_count": embeddings_generated_count,
        "processed_crops": processed_crops,
        "failed_images": failed_images,
        "failure_reasons": sorted(failure_reasons),
    }

    _save_processing_snapshot(storage, sanitized_student_id, result)
    return result
