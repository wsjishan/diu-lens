from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sqlalchemy import select

from app.core.config import settings
from app.core.embeddings_db import EMBEDDING_DIMENSION
from app.core.face_pipeline import (
    FacePipelineError,
    _load_analyzer,
    extract_query_face_features,
)
from app.core.storage import get_storage_service
from app.db.models import FaceEmbedding
from app.db.session import get_session_factory


@dataclass
class EmbeddingRow:
    embedding_id: int | None
    angle: str
    source_image_path: str
    crop_path: str
    embedding: list[float]


def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    a_norm = float(np.linalg.norm(a))
    b_norm = float(np.linalg.norm(b))
    if a_norm <= 0 or b_norm <= 0:
        return 1.0
    similarity = float(np.dot(a, b) / (a_norm * b_norm))
    similarity = max(-1.0, min(1.0, similarity))
    return 1.0 - similarity


def _compute_blur_and_brightness(image: np.ndarray) -> tuple[float, float]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    return blur, brightness


def _audit_image_quality(
    image_path: Path,
    *,
    angle_label: str,
    strict_face_checks: bool = True,
    min_blur: float = 45.0,
    min_brightness: float = 70.0,
    max_brightness: float = 200.0,
    min_face_area_ratio: float = 0.09,
) -> dict[str, Any]:
    analyzer = _load_analyzer()
    image = cv2.imread(str(image_path))
    if image is None:
        return {
            "path": str(image_path),
            "angle_label": angle_label,
            "readable": False,
            "weak": True,
            "weak_reasons": ["image_unreadable"],
        }

    height, width = image.shape[:2]
    blur, brightness = _compute_blur_and_brightness(image)

    faces = analyzer.get(image)
    det_conf = None
    face_area_ratio = 0.0
    bbox = None
    if faces:
        main_face = max(
            faces,
            key=lambda f: max(
                0.0,
                float((f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])),
            ),
        )
        bbox_raw = getattr(main_face, "bbox", None)
        if bbox_raw is not None and len(bbox_raw) == 4:
            x1, y1, x2, y2 = [float(v) for v in bbox_raw]
            face_area_ratio = max(0.0, ((x2 - x1) * (y2 - y1)) / float(width * height))
            bbox = [x1, y1, x2, y2]
        det_score_raw = getattr(main_face, "det_score", None)
        det_conf = float(det_score_raw) if det_score_raw is not None else None

    weak_reasons: list[str] = []
    if blur < min_blur:
        weak_reasons.append(f"low_blur_score({blur:.2f}<{min_blur:.2f})")
    if not (min_brightness <= brightness <= max_brightness):
        weak_reasons.append(
            f"bad_brightness({brightness:.2f} not in {min_brightness:.2f}-{max_brightness:.2f})"
        )
    if strict_face_checks:
        if face_area_ratio < min_face_area_ratio:
            weak_reasons.append(
                f"small_face_area({face_area_ratio:.4f}<{min_face_area_ratio:.4f})"
            )
        if det_conf is None:
            weak_reasons.append("det_conf_missing")
        elif det_conf < 0.65:
            weak_reasons.append(f"low_det_conf({det_conf:.4f}<0.6500)")

    return {
        "path": str(image_path),
        "angle_label": angle_label,
        "readable": True,
        "blur_score": blur,
        "brightness": brightness,
        "face_area": face_area_ratio,
        "crop_size": {"width": int(width), "height": int(height)},
        "detection_confidence": det_conf,
        "bbox": bbox,
        "weak": len(weak_reasons) > 0,
        "weak_reasons": weak_reasons,
    }


def _load_active_embeddings(student_id: str) -> tuple[list[EmbeddingRow], str]:
    rows: list[EmbeddingRow] = []

    try:
        session_factory = get_session_factory()
        with session_factory() as db:
            db_rows = db.execute(
                select(FaceEmbedding)
                .where(
                    FaceEmbedding.student_id == student_id,
                    FaceEmbedding.is_active.is_(True),
                )
                .order_by(FaceEmbedding.id.asc())
            ).scalars()

            for row in db_rows:
                vector = [float(v) for v in row.embedding]
                if len(vector) != EMBEDDING_DIMENSION:
                    continue
                rows.append(
                    EmbeddingRow(
                        embedding_id=int(row.id),
                        angle=str(row.angle),
                        source_image_path=str(row.source_image_path),
                        crop_path=str(row.crop_path),
                        embedding=vector,
                    )
                )
    except Exception:
        rows = []

    if rows:
        return rows, "database_active_embeddings"

    processing_result = (
        Path("storage") / "processed" / student_id / "processing_result.json"
    )
    if processing_result.exists():
        parsed = json.loads(processing_result.read_text(encoding="utf-8"))
        for index, item in enumerate(parsed.get("processed_crops", []), start=1):
            vector = [float(v) for v in item.get("embedding", [])]
            if len(vector) != EMBEDDING_DIMENSION:
                continue
            rows.append(
                EmbeddingRow(
                    embedding_id=None,
                    angle=str(item.get("angle", "unknown")),
                    source_image_path=str(item.get("source_image", "")),
                    crop_path=str(item.get("crop_path", "")),
                    embedding=vector,
                )
            )
        if rows:
            return rows, "processing_result_fallback"

    raise RuntimeError(
        f"No active embeddings found for student_id={student_id} (DB and processing_result checked)."
    )


def _relative_to_storage(path: Path) -> str:
    storage_root = Path("storage").resolve()
    try:
        return path.resolve().relative_to(storage_root).as_posix()
    except Exception:
        return path.as_posix()


def _collect_enrollment_images(student_id: str) -> tuple[list[str], list[str]]:
    uploads_root = Path("storage") / "uploads" / student_id
    processed_root = Path("storage") / "processed" / student_id

    source_images = sorted(
        _relative_to_storage(path)
        for path in uploads_root.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    crop_images = sorted(
        _relative_to_storage(path)
        for path in processed_root.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    return source_images, crop_images


def _embedding_norm(vector: list[float]) -> float:
    return float(np.linalg.norm(np.asarray(vector, dtype=np.float32)))


def _compression_impact(
    *,
    probe_embedding: np.ndarray,
    source_images: list[str],
) -> dict[str, Any]:
    per_image: list[dict[str, Any]] = []

    for rel_path in source_images:
        abs_path = Path("storage") / rel_path
        image = cv2.imread(str(abs_path))
        if image is None:
            continue

        source_h, source_w = image.shape[:2]
        variants: dict[str, tuple[bytes, tuple[int, int], str]] = {}

        for label, width, quality in (
            ("current_480q65", 480, 65),
            ("proposed_640q75", 640, 75),
        ):
            target_w = int(width)
            target_h = max(1, int(round(source_h * target_w / source_w)))
            resized = cv2.resize(
                image,
                (target_w, target_h),
                interpolation=cv2.INTER_AREA if target_w <= source_w else cv2.INTER_CUBIC,
            )
            ok, enc = cv2.imencode(
                ".jpg", resized, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)]
            )
            if not ok:
                continue
            source_type = "simulated_from_current_source"
            variants[label] = (enc.tobytes(), (target_w, target_h), source_type)

        row: dict[str, Any] = {
            "source_image": rel_path,
            "source_size": {"width": int(source_w), "height": int(source_h)},
            "variants": {},
        }

        for variant_name, (image_bytes, dims, source_type) in variants.items():
            try:
                features = extract_query_face_features(image_bytes)
            except FacePipelineError as exc:
                row["variants"][variant_name] = {
                    "error": str(exc),
                    "variant_size": {"width": int(dims[0]), "height": int(dims[1])},
                    "variant_source": source_type,
                }
                continue

            emb = np.asarray(features["embedding"], dtype=np.float32)
            row["variants"][variant_name] = {
                "variant_size": {"width": int(dims[0]), "height": int(dims[1])},
                "variant_source": source_type,
                "probe_distance": _cosine_distance(probe_embedding, emb),
                "embedding_norm": _embedding_norm(features["embedding"]),
            }

        per_image.append(row)

    current_values: list[float] = []
    proposed_values: list[float] = []
    for row in per_image:
        current = row.get("variants", {}).get("current_480q65", {})
        proposed = row.get("variants", {}).get("proposed_640q75", {})
        if isinstance(current, dict) and isinstance(current.get("probe_distance"), (float, int)):
            current_values.append(float(current["probe_distance"]))
        if isinstance(proposed, dict) and isinstance(proposed.get("probe_distance"), (float, int)):
            proposed_values.append(float(proposed["probe_distance"]))

    current_avg = float(np.mean(current_values)) if current_values else None
    proposed_avg = float(np.mean(proposed_values)) if proposed_values else None

    return {
        "per_image": per_image,
        "aggregate": {
            "current_480q65_avg_probe_distance": current_avg,
            "proposed_640q75_avg_probe_distance": proposed_avg,
            "avg_distance_delta_proposed_minus_current": (
                (proposed_avg - current_avg)
                if proposed_avg is not None and current_avg is not None
                else None
            ),
            "note": (
                "Compared with simulated variants encoded from currently stored source files. "
                "A true hardware recapture at 640/0.75 is recommended for final calibration."
            ),
        },
    }


def build_report(student_id: str, probe_image_path: Path) -> dict[str, Any]:
    storage = get_storage_service()
    probe_bytes = probe_image_path.read_bytes()
    probe_label = probe_image_path.stem

    query_features = extract_query_face_features(
        probe_bytes,
        storage=storage,
        save_debug_crop=True,
        probe_label=probe_label,
    )
    probe_embedding = np.asarray(query_features["embedding"], dtype=np.float32)

    active_embeddings, embedding_source = _load_active_embeddings(student_id)
    source_images, crop_images = _collect_enrollment_images(student_id)

    distances: list[dict[str, Any]] = []
    for row in active_embeddings:
        row_embedding = np.asarray(row.embedding, dtype=np.float32)
        distance = _cosine_distance(probe_embedding, row_embedding)
        distances.append(
            {
                "embedding_id": row.embedding_id,
                "angle": row.angle,
                "source_image_path": row.source_image_path,
                "crop_path": row.crop_path,
                "distance": distance,
                "embedding_norm": _embedding_norm(row.embedding),
            }
        )

    distances_sorted = sorted(distances, key=lambda item: float(item["distance"]))
    support_count = len(distances_sorted)
    top3 = distances_sorted[: min(3, support_count)]
    avg_top3_distance = (
        float(np.mean([float(item["distance"]) for item in top3])) if top3 else None
    )
    configured_threshold = float(settings.face_match_distance_threshold)
    top_avg_limit = max(configured_threshold * 1.25, configured_threshold + 0.01)

    by_angle: dict[str, float] = {}
    for item in distances_sorted:
        angle = str(item["angle"])
        by_angle.setdefault(angle, float(item["distance"]))

    source_quality = []
    for rel in source_images:
        abs_path = Path("storage") / rel
        angle = Path(rel).parent.name
        source_quality.append(_audit_image_quality(abs_path, angle_label=angle))

    crop_quality = []
    for rel in crop_images:
        abs_path = Path("storage") / rel
        angle = Path(rel).parent.name
        crop_quality.append(
            _audit_image_quality(
                abs_path,
                angle_label=angle,
                strict_face_checks=False,
            )
        )

    compression = _compression_impact(probe_embedding=probe_embedding, source_images=source_images)

    return {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "student_id": student_id,
        "probe": {
            "original_image": str(probe_image_path),
            "aligned_crop": query_features.get("query_crop_path"),
            "query_image_size": query_features.get("query_image_size"),
            "query_crop_size": query_features.get("query_crop_size"),
            "face_bbox": query_features.get("face_bbox"),
            "face_detection_confidence": query_features.get("face_detection_confidence"),
            "embedding_norm": query_features.get("embedding_norm"),
            "preprocessing_warnings": query_features.get("preprocessing_warnings", []),
        },
        "enrollment": {
            "source_images": source_images,
            "aligned_crops": crop_images,
        },
        "distance_analysis": {
            "embedding_source": embedding_source,
            "distances_to_each_active_embedding": distances_sorted,
            "best_distance_per_angle": by_angle,
            "average_top_3_distance": avg_top3_distance,
            "support_count": support_count,
            "embedding_norms": {
                "probe_embedding_norm": _embedding_norm(query_features["embedding"]),
                "enrollment_embedding_norms": [
                    {
                        "embedding_id": row.get("embedding_id"),
                        "angle": row.get("angle"),
                        "norm": row.get("embedding_norm"),
                    }
                    for row in distances_sorted
                ],
            },
            "legacy_best_only_decision": {
                "threshold": configured_threshold,
                "is_match": bool(
                    distances_sorted
                    and float(distances_sorted[0]["distance"]) <= configured_threshold
                ),
            },
            "combined_decision_preview": {
                "threshold": configured_threshold,
                "is_match": bool(
                    distances_sorted
                    and (
                        float(distances_sorted[0]["distance"]) <= (configured_threshold * 0.5)
                        or (
                            float(distances_sorted[0]["distance"]) <= configured_threshold
                            and (
                                avg_top3_distance is not None
                                and float(avg_top3_distance) <= top_avg_limit
                            )
                            and support_count >= 2
                        )
                    )
                ),
            },
        },
        "enrollment_quality_audit": {
            "source_images": source_quality,
            "aligned_crops": crop_quality,
            "weak_source_frames": [row for row in source_quality if bool(row.get("weak"))],
            "weak_crop_frames": [row for row in crop_quality if bool(row.get("weak"))],
        },
        "compression_impact": compression,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate DIU Lens same-person probe accuracy diagnostics report."
    )
    parser.add_argument("--student-id", required=True)
    parser.add_argument("--probe-image", required=True)
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output JSON file path. Defaults to storage/processed/reports/<student_id>/...",
    )
    args = parser.parse_args()

    student_id = str(args.student_id).strip()
    probe_path = Path(args.probe_image).expanduser().resolve()
    if not probe_path.exists() or not probe_path.is_file():
        raise SystemExit(f"Probe image does not exist: {probe_path}")

    report = build_report(student_id, probe_path)

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
    else:
        stamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_path = (
            Path("storage")
            / "processed"
            / "reports"
            / student_id
            / f"recognition_accuracy_{stamp}.json"
        ).resolve()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps({"report_path": str(output_path), "student_id": student_id}, indent=2))


if __name__ == "__main__":
    main()
