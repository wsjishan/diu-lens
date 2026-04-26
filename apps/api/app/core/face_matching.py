"""Face matching service layer using pgvector embeddings."""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.embeddings_db import EMBEDDING_DIMENSION
from app.core.face_pipeline import FacePipelineError, extract_query_face_features
from app.core.storage import get_storage_service
from app.db.models import Enrollment, FaceEmbedding, Student
from app.db.session import get_session_factory


class FaceMatchingError(Exception):
    """Raised for face matching failures."""


def _encode_mirrored_probe(image_bytes: bytes) -> bytes | None:
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None
    flipped = cv2.flip(image, 1)
    ok, encoded = cv2.imencode(".jpg", flipped, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        return None
    return encoded.tobytes()


def _angles_compatible(probe_angle: str | None, enrollment_angle: str | None) -> bool:
    probe = (probe_angle or "").strip().lower()
    enroll = (enrollment_angle or "").strip().lower()
    if not probe or probe == "unknown" or not enroll or enroll == "unknown":
        return True
    if probe == enroll:
        return True

    if probe == "front":
        return enroll in {"left", "right", "up", "down"}
    if probe in {"left", "right"}:
        return enroll in {"front", "left", "right"}
    if probe in {"up", "down"}:
        return enroll in {"front", "up", "down"}
    return False


def _merge_embedding_rows_by_min_distance(
    primary_rows: list[dict[str, Any]],
    mirrored_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    if not mirrored_rows:
        for row in primary_rows:
            row["probe_variant"] = "original"
        return primary_rows, 0

    merged: dict[int, dict[str, Any]] = {}
    mirrored_wins = 0

    for row in primary_rows:
        key = int(row["embedding_id"])
        merged[key] = {**row, "probe_variant": "original"}

    for row in mirrored_rows:
        key = int(row["embedding_id"])
        current = merged.get(key)
        row_distance = float(row["distance"])
        if current is None or row_distance < float(current["distance"]):
            if current is not None:
                mirrored_wins += 1
            merged[key] = {**row, "probe_variant": "mirrored"}

    merged_rows = sorted(
        merged.values(),
        key=lambda item: (float(item["distance"]), int(item["embedding_id"])),
    )
    return merged_rows, mirrored_wins


def generate_query_features(
    image_bytes: bytes,
    *,
    debug: bool = False,
    probe_label: str | None = None,
) -> dict[str, Any]:
    """Generate query embedding and optional probe diagnostics."""
    try:
        features = extract_query_face_features(
            image_bytes,
            storage=get_storage_service() if debug else None,
            save_debug_crop=debug,
            probe_label=probe_label,
        )
    except FacePipelineError as exc:
        raise FaceMatchingError(str(exc)) from exc

    embedding = features.get("embedding")
    if not isinstance(embedding, list):
        raise FaceMatchingError("Query embedding generation failed.")

    if len(embedding) != EMBEDDING_DIMENSION:
        raise FaceMatchingError(
            f"Query embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, got {len(embedding)}."
        )

    preprocessing_warnings = list(features.get("preprocessing_warnings", []))
    mirror_embedding: list[float] | None = None
    mirrored_probe_bytes = _encode_mirrored_probe(image_bytes)
    if mirrored_probe_bytes is None:
        preprocessing_warnings.append("mirrored_probe_preprocessing_unavailable")
    else:
        try:
            mirrored_features = extract_query_face_features(mirrored_probe_bytes)
            mirrored_embedding = mirrored_features.get("embedding")
            if not isinstance(mirrored_embedding, list):
                mirror_embedding = None
            elif len(mirrored_embedding) != EMBEDDING_DIMENSION:
                mirror_embedding = None
                preprocessing_warnings.append(
                    "mirrored_probe_embedding_dimension_mismatch"
                )
            else:
                mirror_embedding = [float(v) for v in mirrored_embedding]
        except FacePipelineError as exc:
            preprocessing_warnings.append(f"mirrored_probe_embedding_failed:{exc}")

    return {
        "embedding": [float(v) for v in embedding],
        "mirror_embedding": mirror_embedding,
        "embedding_dim": len(embedding),
        "query_image_size": features.get("query_image_size"),
        "face_bbox": features.get("face_bbox"),
        "face_detection_confidence": features.get("face_detection_confidence"),
        "query_crop_size": features.get("query_crop_size"),
        "query_crop_path": features.get("query_crop_path"),
        "embedding_norm": features.get("embedding_norm"),
        "probe_pose": features.get("probe_pose"),
        "probe_inferred_angle": features.get("probe_inferred_angle"),
        "face_area_ratio": features.get("face_area_ratio"),
        "blur_score": features.get("blur_score"),
        "brightness": features.get("brightness"),
        "preprocessing_warnings": preprocessing_warnings,
    }


def generate_query_embedding(image_bytes: bytes) -> list[float]:
    """Backward-compatible query embedding helper."""
    features = generate_query_features(image_bytes)
    return list(features["embedding"])


def search_face_matches(
    query_embedding: list[float],
    *,
    candidate_pool_limit: int,
) -> list[dict[str, Any]]:
    """Return nearest embedding rows for approved, active enrollment records."""
    if len(query_embedding) != EMBEDDING_DIMENSION:
        raise FaceMatchingError(
            f"Invalid query embedding length: {len(query_embedding)}."
        )

    if candidate_pool_limit <= 0:
        raise FaceMatchingError("candidate_pool_limit must be greater than 0.")

    distance_expr = FaceEmbedding.embedding.cosine_distance(query_embedding).label("distance")

    stmt = (
        select(
            FaceEmbedding.id.label("embedding_id"),
            FaceEmbedding.student_id,
            FaceEmbedding.enrollment_id,
            FaceEmbedding.angle,
            FaceEmbedding.source_image_path,
            FaceEmbedding.crop_path,
            Student.full_name.label("full_name"),
            Student.university_email.label("university_email"),
            Student.phone.label("phone"),
            distance_expr,
        )
        .join(Enrollment, Enrollment.student_id == FaceEmbedding.student_id)
        .outerjoin(Student, Student.student_id == FaceEmbedding.student_id)
        .where(
            FaceEmbedding.is_active.is_(True),
            Enrollment.status == "approved",
        )
        .order_by(distance_expr.asc(), FaceEmbedding.id.asc())
        .limit(candidate_pool_limit)
    )

    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            rows = db.execute(stmt).mappings().all()
        except SQLAlchemyError as exc:
            raise FaceMatchingError("Failed to search face embeddings.") from exc

    return [
        {
            "embedding_id": int(row["embedding_id"]),
            "student_id": str(row["student_id"]),
            "enrollment_id": int(row["enrollment_id"]) if row["enrollment_id"] is not None else None,
            "angle": str(row["angle"]),
            "source_image_path": str(row["source_image_path"]),
            "crop_path": str(row["crop_path"]),
            "full_name": str(row["full_name"]) if row["full_name"] is not None else None,
            "university_email": (
                str(row["university_email"]) if row["university_email"] is not None else None
            ),
            "phone": str(row["phone"]) if row["phone"] is not None else None,
            "distance": float(row["distance"]),
        }
        for row in rows
    ]


def aggregate_student_candidates(
    embedding_rows: list[dict[str, Any]],
    *,
    top_k: int,
    threshold: float,
    probe_angle: str | None = None,
) -> list[dict[str, Any]]:
    """Aggregate nearest embedding rows into ranked student-level candidates."""
    if top_k <= 0:
        raise FaceMatchingError("top_k must be greater than 0.")
    if threshold <= 0:
        raise FaceMatchingError("threshold must be greater than 0.")

    by_student: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "distances": [],
            "compatible_distances": [],
            "angles": set(),
            "compatible_angles": set(),
            "distances_by_angle": defaultdict(list),
            "best_row": None,
            "best_compatible_distance": None,
        }
    )

    for row in embedding_rows:
        student_id = str(row["student_id"])
        distance = float(row["distance"])
        angle = str(row.get("angle", "unknown"))
        bucket = by_student[student_id]
        bucket["distances"].append(distance)
        bucket["angles"].add(angle)
        bucket["distances_by_angle"][angle].append(distance)
        if _angles_compatible(probe_angle, angle):
            bucket["compatible_distances"].append(distance)
            bucket["compatible_angles"].add(angle)
            best_compatible_distance = bucket.get("best_compatible_distance")
            if best_compatible_distance is None or distance < float(best_compatible_distance):
                bucket["best_compatible_distance"] = distance

        best_row = bucket["best_row"]
        if best_row is None or distance < float(best_row["distance"]):
            bucket["best_row"] = row

    scored: list[dict[str, Any]] = []
    for student_id, bucket in by_student.items():
        distances = sorted(float(d) for d in bucket["distances"])
        compatible_distances = sorted(float(d) for d in bucket["compatible_distances"])
        best_distance = distances[0]
        top_avg_distance = mean(distances[: min(3, len(distances))])
        top_avg_compatible_distance = (
            mean(compatible_distances[: min(3, len(compatible_distances))])
            if compatible_distances
            else None
        )
        support_count = len(distances)
        compatible_support_count = len(compatible_distances)
        matched_angles_count = len(bucket["angles"])
        compatible_angles_count = len(bucket["compatible_angles"])
        best_row = bucket["best_row"]
        distances_by_angle_raw = bucket["distances_by_angle"]
        angle_best_distances = {
            str(angle): min(float(value) for value in angle_distances)
            for angle, angle_distances in distances_by_angle_raw.items()
            if angle_distances
        }

        scored.append(
            {
                "student_id": student_id,
                "best_distance": best_distance,
                "support_count": support_count,
                "compatible_support_count": compatible_support_count,
                "matched_angles": sorted(bucket["angles"]),
                "matched_angles_count": matched_angles_count,
                "compatible_matched_angles": sorted(bucket["compatible_angles"]),
                "compatible_matched_angles_count": compatible_angles_count,
                "best_compatible_distance": bucket.get("best_compatible_distance"),
                "representative_crop_path": str(best_row["crop_path"]) if best_row else None,
                "representative_source_image_path": (
                    str(best_row["source_image_path"]) if best_row else None
                ),
                "best_angle": str(best_row["angle"]) if best_row else None,
                "full_name": (
                    str(best_row["full_name"])
                    if best_row is not None and best_row.get("full_name") is not None
                    else None
                ),
                "university_email": (
                    str(best_row["university_email"])
                    if best_row is not None and best_row.get("university_email") is not None
                    else None
                ),
                "phone": (
                    str(best_row["phone"])
                    if best_row is not None and best_row.get("phone") is not None
                    else None
                ),
                "top_avg_distance": top_avg_distance,
                "top_avg_compatible_distance": top_avg_compatible_distance,
                "angle_best_distances": angle_best_distances,
            }
        )

    scored.sort(
        key=lambda item: (
            float(item["best_distance"]),
            -int(item["support_count"]),
            float(item["top_avg_distance"]),
            str(item["student_id"]),
        )
    )

    for index, row in enumerate(scored):
        next_row = scored[index + 1] if index + 1 < len(scored) else None
        rank_gap = (
            float(next_row["best_distance"]) - float(row["best_distance"])
            if next_row is not None
            else None
        )
        row["rank_gap_to_next"] = rank_gap

    candidates: list[dict[str, Any]] = []
    for index, row in enumerate(scored[:top_k], start=1):
        best_distance = float(row["best_distance"])
        top_avg_distance = float(row["top_avg_distance"])
        best_compatible_distance_raw = row.get("best_compatible_distance")
        best_compatible_distance = (
            float(best_compatible_distance_raw)
            if best_compatible_distance_raw is not None
            else None
        )
        top_avg_compatible_distance_raw = row.get("top_avg_compatible_distance")
        top_avg_compatible_distance = (
            float(top_avg_compatible_distance_raw)
            if top_avg_compatible_distance_raw is not None
            else None
        )
        support_count = int(row["support_count"])
        compatible_support_count = int(row["compatible_support_count"])
        matched_angles_count = int(row["matched_angles_count"])
        compatible_matched_angles_count = int(row["compatible_matched_angles_count"])
        rank_gap_to_next_raw = row.get("rank_gap_to_next")
        rank_gap_to_next = (
            float(rank_gap_to_next_raw) if rank_gap_to_next_raw is not None else None
        )

        effective_best_distance = (
            best_compatible_distance
            if best_compatible_distance is not None
            else best_distance
        )
        effective_top_avg_distance = (
            top_avg_compatible_distance
            if top_avg_compatible_distance is not None
            else top_avg_distance
        )
        effective_support_count = (
            compatible_support_count if compatible_support_count > 0 else support_count
        )
        distance_ok = effective_best_distance <= threshold
        very_strong_best = effective_best_distance <= (threshold * 0.5)
        top_avg_limit = max(threshold * 1.25, threshold + 0.01)
        top_avg_ok = effective_top_avg_distance <= top_avg_limit
        support_ok = effective_support_count >= 2 or (
            effective_support_count == 1 and effective_best_distance <= (threshold * 0.65)
        )
        rank_gap_limit = max(0.01, threshold * 0.2)
        rank_gap_ok = rank_gap_to_next is None or rank_gap_to_next >= rank_gap_limit
        is_likely_match = (
            distance_ok and rank_gap_ok and very_strong_best
        ) or (
            distance_ok and top_avg_ok and support_ok and rank_gap_ok
        )

        decision_reasons: list[str] = []
        decision_reasons.append(
            "best_distance_within_threshold"
            if distance_ok
            else "best_distance_above_threshold"
        )
        decision_reasons.append(
            "probe_angle_compatible_support"
            if compatible_support_count > 0
            else "probe_angle_compatible_support_unavailable"
        )
        decision_reasons.append(
            "best_distance_very_strong" if very_strong_best else "best_distance_not_very_strong"
        )
        decision_reasons.append("top_avg_consistent" if top_avg_ok else "top_avg_inconsistent")
        decision_reasons.append("support_sufficient" if support_ok else "support_insufficient")
        decision_reasons.append(
            "rank_gap_safe_or_unavailable" if rank_gap_ok else "rank_gap_too_small"
        )

        candidates.append(
            {
                "rank": index,
                "student_id": row["student_id"],
                "best_distance": best_distance,
                "top_avg_distance": top_avg_distance,
                "support_count": support_count,
                "best_angle": row["best_angle"],
                "best_compatible_distance": best_compatible_distance,
                "top_avg_compatible_distance": top_avg_compatible_distance,
                "compatible_support_count": compatible_support_count,
                "matched_angles": row["matched_angles"],
                "matched_angles_count": matched_angles_count,
                "compatible_matched_angles": row["compatible_matched_angles"],
                "compatible_matched_angles_count": compatible_matched_angles_count,
                "rank_gap_to_next": rank_gap_to_next,
                "angle_best_distances": row["angle_best_distances"],
                "representative_crop_path": row["representative_crop_path"],
                "representative_source_image_path": row["representative_source_image_path"],
                "full_name": row["full_name"],
                "university_email": row["university_email"],
                "phone": row["phone"],
                "decision_reasons": decision_reasons,
                "is_likely_match": is_likely_match,
            }
        )

    return candidates


def match_face_probe(
    image_bytes: bytes,
    *,
    threshold: float | None = None,
    top_k: int | None = None,
    candidate_pool_limit: int | None = None,
    debug: bool = False,
    probe_label: str | None = None,
) -> dict[str, Any]:
    """Full query-image face matching flow."""
    resolved_threshold = (
        float(threshold)
        if threshold is not None
        else float(settings.face_match_distance_threshold)
    )
    resolved_top_k = int(top_k) if top_k is not None else int(settings.face_match_top_k)
    resolved_candidate_pool_limit = (
        int(candidate_pool_limit)
        if candidate_pool_limit is not None
        else int(settings.face_match_candidate_pool_limit)
    )

    query_features = generate_query_features(
        image_bytes,
        debug=debug,
        probe_label=probe_label,
    )
    query_embedding = list(query_features["embedding"])
    mirror_embedding = query_features.get("mirror_embedding")

    primary_rows = search_face_matches(
        query_embedding,
        candidate_pool_limit=resolved_candidate_pool_limit,
    )
    mirrored_rows: list[dict[str, Any]] = []
    if isinstance(mirror_embedding, list) and len(mirror_embedding) == EMBEDDING_DIMENSION:
        mirrored_rows = search_face_matches(
            [float(v) for v in mirror_embedding],
            candidate_pool_limit=resolved_candidate_pool_limit,
        )
    embedding_rows, mirror_wins = _merge_embedding_rows_by_min_distance(
        primary_rows,
        mirrored_rows,
    )
    candidates = aggregate_student_candidates(
        embedding_rows,
        top_k=resolved_top_k,
        threshold=resolved_threshold,
        probe_angle=(
            str(query_features.get("probe_inferred_angle"))
            if query_features.get("probe_inferred_angle") is not None
            else None
        ),
    )

    match_found = any(bool(candidate["is_likely_match"]) for candidate in candidates)

    response: dict[str, Any] = {
        "match_found": match_found,
        "threshold_used": resolved_threshold,
        "top_k": resolved_top_k,
        "candidate_pool_limit": resolved_candidate_pool_limit,
        "query_embedding_dim": int(query_features["embedding_dim"]),
        "probe_inferred_angle": query_features.get("probe_inferred_angle"),
        "mirror_query_enabled": bool(mirrored_rows),
        "mirror_wins_count": int(mirror_wins),
        "searched_embedding_rows": len(embedding_rows),
        "candidates": candidates,
    }

    if debug:
        top_row = embedding_rows[0] if embedding_rows else None
        top_candidate = candidates[0] if candidates else None
        response["query_debug"] = {
            "query_image_size": query_features.get("query_image_size"),
            "face_bbox": query_features.get("face_bbox"),
            "face_detection_confidence": query_features.get("face_detection_confidence"),
            "query_crop_size": query_features.get("query_crop_size"),
            "query_crop_path": query_features.get("query_crop_path"),
            "embedding_norm": query_features.get("embedding_norm"),
            "probe_pose": query_features.get("probe_pose"),
            "probe_inferred_angle": query_features.get("probe_inferred_angle"),
            "face_area_ratio": query_features.get("face_area_ratio"),
            "blur_score": query_features.get("blur_score"),
            "brightness": query_features.get("brightness"),
            "mirror_query_enabled": bool(mirrored_rows),
            "mirror_wins_count": int(mirror_wins),
            "preprocessing_warnings": query_features.get("preprocessing_warnings", []),
        }
        response["top_match_debug"] = {
            "student_id": top_row.get("student_id") if top_row else None,
            "distance": float(top_row["distance"]) if top_row else None,
            "probe_variant": top_row.get("probe_variant") if top_row else None,
            "crop_path": top_row.get("crop_path") if top_row else None,
            "source_image_path": top_row.get("source_image_path") if top_row else None,
            "support_count": int(top_candidate["support_count"]) if top_candidate else 0,
            "compatible_support_count": (
                int(top_candidate["compatible_support_count"]) if top_candidate else 0
            ),
            "top_avg_distance": (
                float(top_candidate["top_avg_distance"]) if top_candidate else None
            ),
            "top_avg_compatible_distance": (
                float(top_candidate["top_avg_compatible_distance"])
                if top_candidate is not None
                and top_candidate.get("top_avg_compatible_distance") is not None
                else None
            ),
            "best_compatible_distance": (
                float(top_candidate["best_compatible_distance"])
                if top_candidate is not None
                and top_candidate.get("best_compatible_distance") is not None
                else None
            ),
            "matched_angles_count": (
                int(top_candidate["matched_angles_count"]) if top_candidate else 0
            ),
            "rank_gap_to_next": (
                float(top_candidate["rank_gap_to_next"])
                if top_candidate is not None
                and top_candidate.get("rank_gap_to_next") is not None
                else None
            ),
            "decision_reasons": (
                list(top_candidate["decision_reasons"]) if top_candidate else []
            ),
        }

    return response
