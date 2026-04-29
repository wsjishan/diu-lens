"""Face processing pipeline for enrollment uploads.

Phase 7 scope:
- detect face
- crop/alignment
- embedding generation
- save processed crops and result snapshots locally
"""

from __future__ import annotations

import hashlib
import re
from threading import Lock
from typing import Any
from pathlib import Path

import cv2
import numpy as np

from app.core.enrollment_db import (
    EnrollmentInvalidStateError,
    EnrollmentNotFoundError,
    EnrollmentPersistenceError,
    get_processing_source_images,
)
from app.core.storage_service import ALLOWED_ANGLES, StorageService
_STUDENT_ID_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")
_PROBE_LABEL_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9_-]+")

_ANALYZER_LOCK = Lock()
_ANALYZER: Any = None
_ANALYZER_INIT_ERROR: str | None = None
_MIN_DET_SCORE = 0.45
_MIN_FACE_AREA_RATIO = 0.06
_MIN_BLUR_VARIANCE = 22.0
_MIN_BRIGHTNESS = 35.0
_MAX_BRIGHTNESS = 235.0
_EXTREME_MIN_DET_SCORE = 0.20
_EXTREME_MIN_FACE_AREA_RATIO = 0.03
_EXTREME_MIN_BLUR_VARIANCE = 10.0
_EXTREME_MIN_BRIGHTNESS = 20.0
_EXTREME_MAX_BRIGHTNESS = 245.0
_TOP_FRAMES_PER_ANGLE = 3
_MIN_SELECTED_FRAMES_PER_ANGLE = 2
_MIN_EMBEDDING_DISTANCE_FROM_TOP = 0.08
_MIN_EMBEDDING_DISTANCE_BETWEEN_SELECTED = 0.04


class FacePipelineError(Exception):
    """Raised for recoverable processing failures."""


def _sanitize_student_id(student_id: str) -> str:
    normalized = _STUDENT_ID_SANITIZE_PATTERN.sub("_", student_id.strip())
    sanitized = normalized.strip("._")
    if not sanitized:
        raise FacePipelineError("Invalid student_id for processing path.")
    return sanitized


def _sanitize_probe_label(probe_label: str | None) -> str:
    raw = (probe_label or "probe").strip()
    normalized = _PROBE_LABEL_SANITIZE_PATTERN.sub("_", raw)
    sanitized = normalized.strip("._")
    return sanitized or "probe"


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

    norm = float(np.linalg.norm(vector))
    if norm <= 0:
        raise FacePipelineError("Generated embedding norm is zero.")
    normalized = vector / norm
    return normalized.tolist()


def _compute_blur_and_brightness(image: np.ndarray) -> tuple[float, float]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    return blur, brightness


def _compute_face_area_ratio(face: Any, image: np.ndarray) -> float:
    bbox = getattr(face, "bbox", None)
    if bbox is None or len(bbox) != 4:
        return 0.0
    height, width = image.shape[:2]
    if height <= 0 or width <= 0:
        return 0.0
    x1, y1, x2, y2 = [float(v) for v in bbox]
    area = max(0.0, (x2 - x1) * (y2 - y1))
    return area / float(width * height)


def _compute_center_offset(face: Any, image: np.ndarray) -> float:
    bbox = getattr(face, "bbox", None)
    if bbox is None or len(bbox) != 4:
        return 1.0
    height, width = image.shape[:2]
    if height <= 0 or width <= 0:
        return 1.0
    x1, y1, x2, y2 = [float(v) for v in bbox]
    center_x = (x1 + x2) / 2.0
    center_y = (y1 + y2) / 2.0
    norm_x = center_x / float(width)
    norm_y = center_y / float(height)
    return float(np.hypot(norm_x - 0.5, norm_y - 0.5))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _compute_quality_score(
    *,
    det_score: float | None,
    face_area_ratio: float,
    blur_score: float,
    brightness: float,
    center_offset: float,
) -> float:
    det_component = _clamp01((det_score or 0.0) / 1.0)
    size_component = _clamp01(face_area_ratio / 0.25)
    blur_component = _clamp01(blur_score / 120.0)
    brightness_component = 1.0 - _clamp01(abs(brightness - 130.0) / 130.0)
    center_component = 1.0 - _clamp01(center_offset / 0.35)

    weighted = (
        det_component * 0.35
        + size_component * 0.25
        + blur_component * 0.20
        + brightness_component * 0.10
        + center_component * 0.10
    )
    return round(weighted * 100.0, 4)


def _extreme_rejection_reason(
    *,
    det_score: float | None,
    face_area_ratio: float,
    blur_score: float,
    brightness: float,
) -> str | None:
    if det_score is not None and det_score < _EXTREME_MIN_DET_SCORE:
        return (
            "extreme_low_detection_confidence"
            f"({det_score:.3f}<{_EXTREME_MIN_DET_SCORE:.3f})"
        )
    if face_area_ratio < _EXTREME_MIN_FACE_AREA_RATIO:
        return (
            "extreme_small_face_area_ratio"
            f"({face_area_ratio:.4f}<{_EXTREME_MIN_FACE_AREA_RATIO:.4f})"
        )
    if blur_score < _EXTREME_MIN_BLUR_VARIANCE:
        return (
            "extreme_low_blur_score"
            f"({blur_score:.2f}<{_EXTREME_MIN_BLUR_VARIANCE:.2f})"
        )
    if brightness < _EXTREME_MIN_BRIGHTNESS or brightness > _EXTREME_MAX_BRIGHTNESS:
        return (
            "extreme_brightness_out_of_range"
            f"({brightness:.2f} not in {_EXTREME_MIN_BRIGHTNESS:.2f}-{_EXTREME_MAX_BRIGHTNESS:.2f})"
        )
    return None


def _embedding_cosine_distance(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float32).flatten()
    vb = np.asarray(b, dtype=np.float32).flatten()
    if va.size == 0 or vb.size == 0 or va.size != vb.size:
        return 1.0
    dot = float(np.dot(va, vb))
    na = float(np.linalg.norm(va))
    nb = float(np.linalg.norm(vb))
    if na <= 0.0 or nb <= 0.0:
        return 1.0
    cosine_similarity = max(-1.0, min(1.0, dot / (na * nb)))
    return 1.0 - cosine_similarity


def _select_diverse_candidates(
    candidates_sorted: list[dict[str, Any]],
    *,
    max_count: int,
) -> list[dict[str, Any]]:
    if not candidates_sorted:
        return []
    top = candidates_sorted[0]
    selected: list[dict[str, Any]] = [top]
    top_embedding = list(top.get("embedding", []))

    for candidate in candidates_sorted[1:]:
        if len(selected) >= max_count:
            break
        embedding = list(candidate.get("embedding", []))
        if not embedding or not top_embedding:
            continue
        distance_from_top = _embedding_cosine_distance(embedding, top_embedding)
        if distance_from_top < _MIN_EMBEDDING_DISTANCE_FROM_TOP:
            continue

        too_close_to_selected = False
        for chosen in selected:
            chosen_embedding = list(chosen.get("embedding", []))
            distance_to_chosen = _embedding_cosine_distance(embedding, chosen_embedding)
            if distance_to_chosen < _MIN_EMBEDDING_DISTANCE_BETWEEN_SELECTED:
                too_close_to_selected = True
                break
        if too_close_to_selected:
            continue

        selected.append(candidate)

    # Fallback to quality order when diversity constraints cannot fill target count.
    if len(selected) < max_count:
        selected_ids = {id(item) for item in selected}
        for candidate in candidates_sorted[1:]:
            if len(selected) >= max_count:
                break
            if id(candidate) in selected_ids:
                continue
            selected.append(candidate)
            selected_ids.add(id(candidate))

    return selected


def _extract_pose(face: Any) -> dict[str, float] | None:
    pose_raw = getattr(face, "pose", None)
    if pose_raw is None:
        return None
    values = np.asarray(pose_raw, dtype=np.float32).flatten()
    if values.size < 3:
        return None
    return {
        "pitch": float(values[0]),
        "yaw": float(values[1]),
        "roll": float(values[2]),
    }


def _infer_angle_from_pose(pose: dict[str, float] | None) -> str:
    if pose is None:
        return "unknown"
    yaw = float(pose.get("yaw", 0.0))
    pitch = float(pose.get("pitch", 0.0))
    if yaw >= 16:
        return "left"
    if yaw <= -16:
        return "right"
    if pitch >= 12:
        return "up"
    if pitch <= -12:
        return "down"
    return "front"


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


def _save_query_crop_image(
    storage: StorageService,
    *,
    probe_label: str,
    image_bytes: bytes,
    crop: np.ndarray,
) -> str:
    success, encoded = cv2.imencode(".jpg", crop)
    if not success:
        raise FacePipelineError("Failed to write probe crop image.")

    digest = hashlib.sha256(image_bytes).hexdigest()[:12]
    safe_label = _sanitize_probe_label(probe_label)
    relative_path = f"processed/probe_debug/{safe_label}_{digest}_crop.jpg"
    destination = storage.resolve_relative_path(relative_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(encoded.tobytes())
    return relative_path


def _embedding_l2_norm(embedding: list[float]) -> float:
    vector = np.asarray(embedding, dtype=np.float32)
    return float(np.linalg.norm(vector))


def process_student_images(student_id: str, storage: StorageService) -> dict[str, Any]:
    """Process DB-scoped enrollment images for a student."""
    sanitized_student_id = _sanitize_student_id(student_id)

    try:
        source_bundle = get_processing_source_images(sanitized_student_id)
    except (EnrollmentNotFoundError, EnrollmentInvalidStateError, EnrollmentPersistenceError) as exc:
        raise FacePipelineError(str(exc)) from exc

    analyzer = _load_analyzer()
    storage.clear_student_processed(sanitized_student_id)

    processed_crops: list[dict[str, Any]] = []
    failed_images: list[dict[str, str]] = []
    failure_reasons: set[str] = set()
    skipped_images: list[dict[str, Any]] = []
    candidate_by_angle: dict[str, list[dict[str, Any]]] = {
        angle: [] for angle in ALLOWED_ANGLES
    }

    source_images = list(source_bundle.get("source_images", []))
    for row in source_images:
        angle = str(row.get("angle", "unknown"))
        image_rel_path = str(row.get("source_image", ""))
        file_name = Path(image_rel_path).name or "unknown"
        source_abs_path = storage.resolve_relative_path(image_rel_path)

        try:
            image = cv2.imread(str(source_abs_path))
            if image is None:
                raise FacePipelineError("Failed to read image from disk.")

            faces = analyzer.get(image)
            face = _pick_main_face(faces)
            aligned_crop = _align_face(image, face)
            embedding = _extract_embedding(face)
            det_score_raw = getattr(face, "det_score", None)
            det_score = float(det_score_raw) if det_score_raw is not None else None
            face_area_ratio = _compute_face_area_ratio(face, image)
            center_offset = _compute_center_offset(face, image)
            blur_score, brightness = _compute_blur_and_brightness(aligned_crop)
            pose = _extract_pose(face)
            inferred_angle = _infer_angle_from_pose(pose)
            quality_score = _compute_quality_score(
                det_score=det_score,
                face_area_ratio=face_area_ratio,
                blur_score=blur_score,
                brightness=brightness,
                center_offset=center_offset,
            )
            extreme_rejection = _extreme_rejection_reason(
                det_score=det_score,
                face_area_ratio=face_area_ratio,
                blur_score=blur_score,
                brightness=brightness,
            )
            if extreme_rejection is not None:
                skipped_images.append(
                    {
                        "angle": angle,
                        "file_name": file_name,
                        "source_image": image_rel_path,
                        "reason": extreme_rejection,
                        "quality_score": quality_score,
                    }
                )
                failure_reasons.add(extreme_rejection)
                continue

            warnings: list[str] = []
            if det_score is not None and det_score < _MIN_DET_SCORE:
                warnings.append(
                    f"low_detection_confidence({det_score:.3f}<{_MIN_DET_SCORE:.3f})"
                )
            if face_area_ratio < _MIN_FACE_AREA_RATIO:
                warnings.append(
                    f"small_face_area_ratio({face_area_ratio:.4f}<{_MIN_FACE_AREA_RATIO:.4f})"
                )
            if blur_score < _MIN_BLUR_VARIANCE:
                warnings.append(
                    f"low_blur_score({blur_score:.2f}<{_MIN_BLUR_VARIANCE:.2f})"
                )
            if brightness < _MIN_BRIGHTNESS or brightness > _MAX_BRIGHTNESS:
                warnings.append(
                    "brightness_out_of_range"
                    f"({brightness:.2f} not in {_MIN_BRIGHTNESS:.2f}-{_MAX_BRIGHTNESS:.2f})"
                )

            candidate_by_angle.setdefault(angle, []).append(
                {
                    "angle": angle,
                    "source_image": image_rel_path,
                    "aligned_crop": aligned_crop,
                    "embedding": embedding,
                    "embedding_dim": len(embedding),
                    "det_score": det_score,
                    "face_area_ratio": face_area_ratio,
                    "center_offset": center_offset,
                    "blur_score": blur_score,
                    "brightness": brightness,
                    "pose": pose,
                    "inferred_angle": inferred_angle,
                    "quality_score": quality_score,
                    "warnings": warnings,
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

    selection_by_angle: dict[str, list[dict[str, Any]]] = {}
    for angle in ALLOWED_ANGLES:
        candidates = list(candidate_by_angle.get(angle, []))
        candidates.sort(key=lambda item: float(item.get("quality_score", 0.0)), reverse=True)
        selected_count = min(_TOP_FRAMES_PER_ANGLE, len(candidates))
        selected = _select_diverse_candidates(
            candidates,
            max_count=selected_count,
        )
        selection_by_angle[angle] = [
            {
                "source_image": str(item.get("source_image", "")),
                "quality_score": float(item.get("quality_score", 0.0)),
                "selected": True,
                "distance_from_top": (
                    _embedding_cosine_distance(
                        list(item.get("embedding", [])),
                        list(selected[0].get("embedding", [])),
                    )
                    if selected
                    else None
                ),
            }
            for item in selected
        ]
        selected_ids = {id(item) for item in selected}
        for skipped in candidates:
            if id(skipped) in selected_ids:
                continue
            skipped_images.append(
                {
                    "angle": angle,
                    "file_name": Path(str(skipped.get("source_image", ""))).name
                    or "unknown",
                    "source_image": skipped.get("source_image"),
                    "reason": "not_selected_by_quality_ranking",
                    "quality_score": skipped.get("quality_score"),
                }
            )

        if selected_count < _MIN_SELECTED_FRAMES_PER_ANGLE:
            reason = (
                f"insufficient_selected_frames_for_angle:{angle}"
                f"(selected={selected_count},required={_MIN_SELECTED_FRAMES_PER_ANGLE})"
            )
            failure_reasons.add(reason)

        for rank_index, selected_item in enumerate(selected, start=1):
            crop_rel_path = _save_crop_image(
                storage=storage,
                student_id=sanitized_student_id,
                angle=angle,
                source_rel_path=str(selected_item.get("source_image", "")),
                crop=np.asarray(selected_item["aligned_crop"]),
            )
            embedding_vector = [
                float(v) for v in list(selected_item.get("embedding", []))
            ]
            embedding_norm = _embedding_l2_norm(embedding_vector)
            processed_crops.append(
                {
                    "angle": angle,
                    "source_image": selected_item.get("source_image"),
                    "crop_path": crop_rel_path,
                    "embedding": embedding_vector,
                    "embedding_dim": len(embedding_vector),
                    "embedding_norm": embedding_norm,
                    "selection_rank": rank_index,
                    "quality_score": selected_item.get("quality_score"),
                    "det_score": selected_item.get("det_score"),
                    "face_area_ratio": selected_item.get("face_area_ratio"),
                    "center_offset": selected_item.get("center_offset"),
                    "blur_score": selected_item.get("blur_score"),
                    "brightness": selected_item.get("brightness"),
                    "pose": selected_item.get("pose"),
                    "inferred_angle": selected_item.get("inferred_angle"),
                    "warnings": selected_item.get("warnings", []),
                }
            )

    embeddings_generated_count = sum(1 for item in processed_crops if item.get("embedding"))
    missing_angles = [
        angle
        for angle in ALLOWED_ANGLES
        if len([crop for crop in processed_crops if crop.get("angle") == angle])
        < _MIN_SELECTED_FRAMES_PER_ANGLE
    ]
    result = {
        "student_id": sanitized_student_id,
        "processing_passed": bool(processed_crops) and len(missing_angles) == 0,
        "processed_images_count": len(processed_crops),
        "embeddings_generated_count": embeddings_generated_count,
        "selection_policy": {
            "strategy": "quality_plus_diversity",
            "min_embedding_distance_from_top": _MIN_EMBEDDING_DISTANCE_FROM_TOP,
            "min_embedding_distance_between_selected": _MIN_EMBEDDING_DISTANCE_BETWEEN_SELECTED,
        },
        "top_frames_per_angle": _TOP_FRAMES_PER_ANGLE,
        "minimum_selected_frames_per_angle": _MIN_SELECTED_FRAMES_PER_ANGLE,
        "selected_frames_by_angle": {
            angle: len([crop for crop in processed_crops if crop.get("angle") == angle])
            for angle in ALLOWED_ANGLES
        },
        "missing_angles": missing_angles,
        "selection_by_angle": selection_by_angle,
        "processed_crops": processed_crops,
        "failed_images": failed_images,
        "skipped_images": skipped_images,
        "failure_reasons": sorted(failure_reasons),
    }

    _save_processing_snapshot(storage, sanitized_student_id, result)
    return result


def extract_query_face_features(
    image_bytes: bytes,
    *,
    storage: StorageService | None = None,
    save_debug_crop: bool = False,
    probe_label: str | None = None,
) -> dict[str, Any]:
    """Generate a single query embedding from one probe image."""
    if not image_bytes:
        raise FacePipelineError("Probe image is empty.")

    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise FacePipelineError("Failed to decode probe image.")

    analyzer = _load_analyzer()
    faces = analyzer.get(image)
    face = _pick_main_face(faces)
    aligned_crop = _align_face(image, face)
    embedding = _extract_embedding(face)
    embedding_norm = _embedding_l2_norm(embedding)
    pose = _extract_pose(face)
    inferred_angle = _infer_angle_from_pose(pose)
    face_area_ratio = _compute_face_area_ratio(face, image)
    blur_score, brightness = _compute_blur_and_brightness(aligned_crop)

    bbox_raw = getattr(face, "bbox", None)
    bbox = None
    if bbox_raw is not None and len(bbox_raw) == 4:
        bbox = [float(v) for v in bbox_raw]

    det_score_raw = getattr(face, "det_score", None)
    det_score = float(det_score_raw) if det_score_raw is not None else None

    warnings: list[str] = []
    if len(faces) > 1:
        warnings.append(f"multiple_faces_detected={len(faces)}; largest face selected")
    if det_score is None:
        warnings.append("face_detection_confidence_unavailable")
    elif det_score < _MIN_DET_SCORE:
        warnings.append(f"low_face_detection_confidence={det_score:.3f}")
    if bbox is None:
        warnings.append("face_bbox_unavailable")
    if face_area_ratio < _MIN_FACE_AREA_RATIO:
        warnings.append(f"small_face_area_ratio={face_area_ratio:.4f}")
    if blur_score < _MIN_BLUR_VARIANCE:
        warnings.append(f"low_blur_score={blur_score:.2f}")
    if brightness < _MIN_BRIGHTNESS or brightness > _MAX_BRIGHTNESS:
        warnings.append(f"brightness_out_of_range={brightness:.2f}")

    query_crop_path: str | None = None
    if save_debug_crop:
        if storage is None:
            warnings.append("debug_crop_not_saved:no_storage")
        else:
            query_crop_path = _save_query_crop_image(
                storage,
                probe_label=probe_label or "probe",
                image_bytes=image_bytes,
                crop=aligned_crop,
            )

    return {
        "embedding": embedding,
        "embedding_dim": len(embedding),
        "query_image_size": {
            "width": int(image.shape[1]),
            "height": int(image.shape[0]),
        },
        "face_bbox": bbox,
        "face_detection_confidence": det_score,
        "query_crop_size": {
            "width": int(aligned_crop.shape[1]),
            "height": int(aligned_crop.shape[0]),
        },
        "query_crop_path": query_crop_path,
        "embedding_norm": embedding_norm,
        "probe_pose": pose,
        "probe_inferred_angle": inferred_angle,
        "face_area_ratio": face_area_ratio,
        "blur_score": blur_score,
        "brightness": brightness,
        "preprocessing_warnings": warnings,
    }
