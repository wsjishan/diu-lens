from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from statistics import mean, pvariance
from typing import Any

import numpy as np
from sqlalchemy import select

from app.core.embeddings_db import EMBEDDING_DIMENSION
from app.core.face_pipeline import FacePipelineError, extract_query_face_features
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
    if a_norm <= 0.0 or b_norm <= 0.0:
        return 1.0
    similarity = float(np.dot(a, b) / (a_norm * b_norm))
    similarity = max(-1.0, min(1.0, similarity))
    return 1.0 - similarity


def _embedding_norm(vector: list[float]) -> float:
    return float(np.linalg.norm(np.asarray(vector, dtype=np.float32)))


def _load_active_embeddings(student_id: str) -> list[EmbeddingRow]:
    session_factory = get_session_factory()
    rows: list[EmbeddingRow] = []

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

    return rows


def _resolve_relative_path(relative_path: str) -> Path:
    storage = get_storage_service()
    return storage.resolve_relative_path(relative_path)


def _copy_debug_image(
    source_path: Path,
    *,
    output_dir: Path,
    label: str,
    digest: str,
) -> str | None:
    if not source_path.exists():
        return None
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_label = label.replace(" ", "_")
    destination = output_dir / f"{safe_label}_{digest}.jpg"
    shutil.copyfile(source_path, destination)
    return destination.as_posix()


def _compute_stats(distances: list[float]) -> dict[str, float] | None:
    if not distances:
        return None
    return {
        "min": float(min(distances)),
        "max": float(max(distances)),
        "avg": float(mean(distances)),
        "variance": float(pvariance(distances)) if len(distances) > 1 else 0.0,
        "std_dev": float(math.sqrt(pvariance(distances))) if len(distances) > 1 else 0.0,
    }


def _group_by_angle(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        angle = str(row.get("angle", "unknown"))
        grouped.setdefault(angle, []).append(row)

    for angle in grouped:
        grouped[angle] = sorted(
            grouped[angle], key=lambda item: float(item.get("distance", 1.0))
        )
    return grouped


def _angle_best_distance(grouped: dict[str, list[dict[str, Any]]]) -> dict[str, float]:
    best: dict[str, float] = {}
    for angle, rows in grouped.items():
        if not rows:
            continue
        best[angle] = float(rows[0]["distance"])
    return best


def _angle_worst_distance(grouped: dict[str, list[dict[str, Any]]]) -> dict[str, float]:
    worst: dict[str, float] = {}
    for angle, rows in grouped.items():
        if not rows:
            continue
        worst[angle] = float(max(row["distance"] for row in rows))
    return worst


def _format_float(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.6f}"


def _print_summary(
    *,
    probe_embedding_norm: float,
    stats: dict[str, float] | None,
    best_match_angle: str | None,
    worst_match_angle: str | None,
    distances_sorted: list[dict[str, Any]],
    embedding_norms: list[dict[str, Any]],
    probe_crop_path: str | None,
    best_crop_saved: str | None,
    worst_crop_saved: str | None,
) -> None:
    top_closest = distances_sorted[:5]
    top_farthest = list(reversed(distances_sorted[-5:]))

    norms = [float(item.get("norm", 0.0)) for item in embedding_norms if item.get("norm")]
    norms_min = min(norms) if norms else None
    norms_max = max(norms) if norms else None

    print("=== PROBE DEBUG SUMMARY ===")
    print(f"Probe embedding norm: {_format_float(probe_embedding_norm)}")
    print("Cluster stats:")
    print(f"- min distance: {_format_float(stats.get('min') if stats else None)}")
    print(f"- max distance: {_format_float(stats.get('max') if stats else None)}")
    print(f"- avg distance: {_format_float(stats.get('avg') if stats else None)}")
    print(f"- std dev: {_format_float(stats.get('std_dev') if stats else None)}")
    print(f"Best match angle: {best_match_angle or 'n/a'}")
    print(f"Worst match angle: {worst_match_angle or 'n/a'}")

    print("Top 5 closest embeddings:")
    for index, row in enumerate(top_closest, start=1):
        angle = str(row.get("angle", "unknown"))
        distance = float(row.get("distance", 1.0))
        print(f"{index}. {angle} - {_format_float(distance)}")

    print("Top 5 farthest embeddings:")
    for index, row in enumerate(top_farthest, start=1):
        angle = str(row.get("angle", "unknown"))
        distance = float(row.get("distance", 1.0))
        print(f"{index}. {angle} - {_format_float(distance)}")

    print("Embedding norms (sample):")
    print(f"- min: {_format_float(norms_min)}")
    print(f"- max: {_format_float(norms_max)}")

    print("Saved debug images:")
    print(f"- probe: {probe_crop_path or 'n/a'}")
    print(f"- best match: {best_crop_saved or 'n/a'}")
    print(f"- worst match: {worst_crop_saved or 'n/a'}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Debug recognition mismatch by comparing probe embedding to enrollment embeddings."
    )
    parser.add_argument("student_id", help="Student id to inspect.")
    parser.add_argument("probe_image", help="Absolute or relative path to probe image.")
    parser.add_argument(
        "--output-json",
        default=None,
        help="Optional path for JSON report output.",
    )
    parser.add_argument(
        "--label",
        default="probe_debug",
        help="Label to include in debug crop filenames.",
    )

    args = parser.parse_args()

    probe_path = Path(args.probe_image)
    if not probe_path.exists() or not probe_path.is_file():
        raise SystemExit(f"Probe image not found: {probe_path}")

    probe_bytes = probe_path.read_bytes()
    if not probe_bytes:
        raise SystemExit("Probe image is empty.")

    try:
        query_features = extract_query_face_features(
            probe_bytes,
            storage=get_storage_service(),
            save_debug_crop=True,
            probe_label=args.label,
        )
    except FacePipelineError as exc:
        raise SystemExit(f"Failed to generate probe embedding: {exc}")

    probe_embedding = query_features.get("embedding")
    if not isinstance(probe_embedding, list) or len(probe_embedding) != EMBEDDING_DIMENSION:
        raise SystemExit("Probe embedding generation failed or had invalid dimension.")

    probe_embedding_norm = float(query_features.get("embedding_norm") or 0.0)
    probe_crop_path = query_features.get("query_crop_path")
    probe_angle = query_features.get("probe_inferred_angle")

    embeddings = _load_active_embeddings(args.student_id)
    if not embeddings:
        raise SystemExit(
            f"No active embeddings found for student_id={args.student_id}."
        )

    probe_vec = np.asarray(probe_embedding, dtype=np.float32)

    distances: list[dict[str, Any]] = []
    embedding_norms: list[dict[str, Any]] = []

    for row in embeddings:
        stored_vec = np.asarray(row.embedding, dtype=np.float32)
        distance = _cosine_distance(probe_vec, stored_vec)
        distances.append(
            {
                "embedding_id": row.embedding_id,
                "angle": row.angle,
                "source_image_path": row.source_image_path,
                "crop_path": row.crop_path,
                "distance": float(distance),
            }
        )
        embedding_norms.append(
            {
                "embedding_id": row.embedding_id,
                "angle": row.angle,
                "norm": _embedding_norm(row.embedding),
            }
        )

    distances_sorted = sorted(distances, key=lambda item: float(item["distance"]))
    grouped_by_angle = _group_by_angle(distances_sorted)

    stats = _compute_stats([float(item["distance"]) for item in distances_sorted])
    angle_best = _angle_best_distance(grouped_by_angle)
    angle_worst = _angle_worst_distance(grouped_by_angle)

    best_match = distances_sorted[0] if distances_sorted else None
    worst_match = distances_sorted[-1] if distances_sorted else None

    digest = hashlib.sha256(probe_bytes).hexdigest()[:12]
    output_dir = _resolve_relative_path("processed/probe_debug")

    best_crop_saved = None
    worst_crop_saved = None

    if best_match:
        best_path = _resolve_relative_path(str(best_match["crop_path"]))
        best_crop_saved = _copy_debug_image(
            best_path,
            output_dir=output_dir,
            label="best_match",
            digest=digest,
        )

    if worst_match:
        worst_path = _resolve_relative_path(str(worst_match["crop_path"]))
        worst_crop_saved = _copy_debug_image(
            worst_path,
            output_dir=output_dir,
            label="worst_match",
            digest=digest,
        )

    report = {
        "student_id": args.student_id,
        "probe_image": probe_path.as_posix(),
        "probe_crop_path": probe_crop_path,
        "probe_inferred_angle": probe_angle,
        "probe_embedding_norm": probe_embedding_norm,
        "distances": distances_sorted,
        "distances_grouped_by_angle": grouped_by_angle,
        "angle_best_distances": angle_best,
        "angle_worst_distances": angle_worst,
        "best_match_angle": best_match.get("angle") if best_match else None,
        "worst_match_angle": worst_match.get("angle") if worst_match else None,
        "cluster_stats": stats,
        "cluster_spread": stats.get("std_dev") if stats else None,
        "embedding_norms": embedding_norms,
        "debug_crops": {
            "probe": probe_crop_path,
            "best_match": best_crop_saved,
            "worst_match": worst_crop_saved,
        },
    }

    _print_summary(
        probe_embedding_norm=probe_embedding_norm,
        stats=stats,
        best_match_angle=best_match.get("angle") if best_match else None,
        worst_match_angle=worst_match.get("angle") if worst_match else None,
        distances_sorted=distances_sorted,
        embedding_norms=embedding_norms,
        probe_crop_path=probe_crop_path,
        best_crop_saved=best_crop_saved,
        worst_crop_saved=worst_crop_saved,
    )

    output = json.dumps(report, indent=2)
    if args.output_json:
        output_path = Path(args.output_json)
        output_path.write_text(output, encoding="utf-8")
        print(f"Saved report: {output_path}")


if __name__ == "__main__":
    main()
