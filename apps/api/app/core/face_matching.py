"""Face matching service layer using pgvector embeddings."""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.embeddings_db import EMBEDDING_DIMENSION
from app.core.face_pipeline import FacePipelineError, extract_query_face_features
from app.db.models import Enrollment, FaceEmbedding
from app.db.session import get_session_factory


class FaceMatchingError(Exception):
    """Raised for face matching failures."""


def generate_query_embedding(image_bytes: bytes) -> list[float]:
    """Generate a normalized query embedding vector from a probe image."""
    try:
        features = extract_query_face_features(image_bytes)
    except FacePipelineError as exc:
        raise FaceMatchingError(str(exc)) from exc

    embedding = features.get("embedding")
    if not isinstance(embedding, list):
        raise FaceMatchingError("Query embedding generation failed.")

    if len(embedding) != EMBEDDING_DIMENSION:
        raise FaceMatchingError(
            f"Query embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, got {len(embedding)}."
        )

    return [float(v) for v in embedding]


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
            distance_expr,
        )
        .join(Enrollment, Enrollment.student_id == FaceEmbedding.student_id)
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
            "distance": float(row["distance"]),
        }
        for row in rows
    ]


def aggregate_student_candidates(
    embedding_rows: list[dict[str, Any]],
    *,
    top_k: int,
    threshold: float,
) -> list[dict[str, Any]]:
    """Aggregate nearest embedding rows into ranked student-level candidates."""
    if top_k <= 0:
        raise FaceMatchingError("top_k must be greater than 0.")
    if threshold <= 0:
        raise FaceMatchingError("threshold must be greater than 0.")

    by_student: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "distances": [],
            "angles": set(),
            "best_row": None,
        }
    )

    for row in embedding_rows:
        student_id = str(row["student_id"])
        distance = float(row["distance"])
        bucket = by_student[student_id]
        bucket["distances"].append(distance)
        bucket["angles"].add(str(row.get("angle", "unknown")))

        best_row = bucket["best_row"]
        if best_row is None or distance < float(best_row["distance"]):
            bucket["best_row"] = row

    scored: list[dict[str, Any]] = []
    for student_id, bucket in by_student.items():
        distances = sorted(float(d) for d in bucket["distances"])
        best_distance = distances[0]
        top_avg_distance = mean(distances[: min(3, len(distances))])
        support_count = len(distances)
        best_row = bucket["best_row"]

        scored.append(
            {
                "student_id": student_id,
                "best_distance": best_distance,
                "support_count": support_count,
                "matched_angles": sorted(bucket["angles"]),
                "representative_crop_path": str(best_row["crop_path"]) if best_row else None,
                "representative_source_image_path": (
                    str(best_row["source_image_path"]) if best_row else None
                ),
                "top_avg_distance": top_avg_distance,
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

    candidates: list[dict[str, Any]] = []
    for index, row in enumerate(scored[:top_k], start=1):
        best_distance = float(row["best_distance"])
        candidates.append(
            {
                "rank": index,
                "student_id": row["student_id"],
                "best_distance": best_distance,
                "support_count": int(row["support_count"]),
                "matched_angles": row["matched_angles"],
                "representative_crop_path": row["representative_crop_path"],
                "representative_source_image_path": row["representative_source_image_path"],
                "is_likely_match": best_distance <= threshold,
            }
        )

    return candidates


def match_face_probe(
    image_bytes: bytes,
    *,
    threshold: float | None = None,
    top_k: int | None = None,
    candidate_pool_limit: int | None = None,
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

    query_embedding = generate_query_embedding(image_bytes)
    embedding_rows = search_face_matches(
        query_embedding,
        candidate_pool_limit=resolved_candidate_pool_limit,
    )
    candidates = aggregate_student_candidates(
        embedding_rows,
        top_k=resolved_top_k,
        threshold=resolved_threshold,
    )

    match_found = any(bool(candidate["is_likely_match"]) for candidate in candidates)

    return {
        "match_found": match_found,
        "threshold_used": resolved_threshold,
        "top_k": resolved_top_k,
        "candidate_pool_limit": resolved_candidate_pool_limit,
        "query_embedding_dim": len(query_embedding),
        "searched_embedding_rows": len(embedding_rows),
        "candidates": candidates,
    }
