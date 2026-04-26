"""Audit DB/storage integrity for enrollment and recognition artifacts."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from sqlalchemy import select

import app.core.storage as storage_module
from app.db.models import Enrollment, EnrollmentImage, FaceEmbedding
import app.db.session as db_session_module


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _is_image_path(path: str) -> bool:
    return Path(path).suffix.lower() in IMAGE_SUFFIXES


def run_audit(*, cleanup_unexpected: bool = False) -> dict[str, Any]:
    storage = storage_module.get_storage_service()
    session_factory = db_session_module.get_session_factory()

    image_path_student_mismatch: list[dict[str, Any]] = []
    crop_path_student_mismatch: list[dict[str, Any]] = []
    embedding_student_mismatch: list[dict[str, Any]] = []
    missing_files: list[dict[str, Any]] = []
    duplicate_active_embeddings: list[dict[str, Any]] = []

    referenced_uploads: set[str] = set()
    referenced_processed: set[str] = set()

    with session_factory() as db:
        enrollments = {
            item.id: item
            for item in db.scalars(select(Enrollment)).all()
        }

        enrollment_images = db.scalars(select(EnrollmentImage)).all()
        for row in enrollment_images:
            enrollment = enrollments.get(int(row.enrollment_id))
            expected_student_id = enrollment.student_id if enrollment is not None else None
            file_path = str(row.file_path)
            referenced_uploads.add(file_path)

            if expected_student_id is not None:
                expected_prefix = f"uploads/{expected_student_id}/"
                if not file_path.startswith(expected_prefix):
                    image_path_student_mismatch.append(
                        {
                            "enrollment_image_id": int(row.id),
                            "enrollment_id": int(row.enrollment_id),
                            "expected_student_id": expected_student_id,
                            "file_path": file_path,
                        }
                    )

            resolved = storage.resolve_relative_path(file_path)
            if not resolved.exists() or not resolved.is_file():
                missing_files.append(
                    {
                        "type": "enrollment_image",
                        "id": int(row.id),
                        "path": file_path,
                    }
                )

        embeddings = db.scalars(select(FaceEmbedding)).all()
        active_key_counter: Counter[tuple[str, str, str, str]] = Counter()
        active_examples: dict[tuple[str, str, str, str], FaceEmbedding] = {}

        for row in embeddings:
            student_id = str(row.student_id)
            enrollment = enrollments.get(int(row.enrollment_id)) if row.enrollment_id is not None else None
            source_path = str(row.source_image_path)
            crop_path = str(row.crop_path)

            referenced_uploads.add(source_path)
            referenced_processed.add(crop_path)

            source_prefix = f"uploads/{student_id}/"
            crop_prefix = f"processed/{student_id}/"

            if not source_path.startswith(source_prefix):
                crop_path_student_mismatch.append(
                    {
                        "embedding_id": int(row.id),
                        "student_id": student_id,
                        "field": "source_image_path",
                        "path": source_path,
                    }
                )

            if not crop_path.startswith(crop_prefix):
                crop_path_student_mismatch.append(
                    {
                        "embedding_id": int(row.id),
                        "student_id": student_id,
                        "field": "crop_path",
                        "path": crop_path,
                    }
                )

            if enrollment is not None and str(enrollment.student_id) != student_id:
                embedding_student_mismatch.append(
                    {
                        "embedding_id": int(row.id),
                        "embedding_student_id": student_id,
                        "enrollment_id": int(row.enrollment_id),
                        "enrollment_student_id": str(enrollment.student_id),
                    }
                )

            for label, path in (
                ("embedding_source_image", source_path),
                ("embedding_crop", crop_path),
            ):
                resolved = storage.resolve_relative_path(path)
                if not resolved.exists() or not resolved.is_file():
                    missing_files.append(
                        {
                            "type": label,
                            "id": int(row.id),
                            "path": path,
                        }
                    )

            if bool(row.is_active):
                key = (student_id, str(row.angle), source_path, crop_path)
                active_key_counter[key] += 1
                active_examples.setdefault(key, row)

        for key, count in active_key_counter.items():
            if count <= 1:
                continue
            sample = active_examples[key]
            duplicate_active_embeddings.append(
                {
                    "student_id": key[0],
                    "angle": key[1],
                    "source_image_path": key[2],
                    "crop_path": key[3],
                    "duplicate_active_count": int(count),
                    "example_embedding_id": int(sample.id),
                }
            )

    all_upload_files = set(storage.list_all_relative_files("uploads"))
    all_processed_files = set(storage.list_all_relative_files("processed"))

    unexpected_upload_files = sorted(
        path
        for path in all_upload_files
        if _is_image_path(path) and path not in referenced_uploads
    )
    unexpected_processed_files = sorted(
        path
        for path in all_processed_files
        if _is_image_path(path) and path not in referenced_processed
    )

    removed_unexpected_files: list[str] = []
    if cleanup_unexpected:
        for path in unexpected_upload_files + unexpected_processed_files:
            storage.remove_relative_file(path)
            removed_unexpected_files.append(path)

    return {
        "summary": {
            "image_path_student_mismatch_count": len(image_path_student_mismatch),
            "crop_path_student_mismatch_count": len(crop_path_student_mismatch),
            "embedding_student_mismatch_count": len(embedding_student_mismatch),
            "missing_files_count": len(missing_files),
            "duplicate_active_embeddings_count": len(duplicate_active_embeddings),
            "unexpected_upload_files_count": len(unexpected_upload_files),
            "unexpected_processed_files_count": len(unexpected_processed_files),
            "cleanup_unexpected_applied": bool(cleanup_unexpected),
            "removed_unexpected_files_count": len(removed_unexpected_files),
        },
        "image_path_student_mismatch": image_path_student_mismatch,
        "crop_path_student_mismatch": crop_path_student_mismatch,
        "embedding_student_mismatch": embedding_student_mismatch,
        "missing_files": missing_files,
        "duplicate_active_embeddings": duplicate_active_embeddings,
        "unexpected_upload_files": unexpected_upload_files,
        "unexpected_processed_files": unexpected_processed_files,
        "removed_unexpected_files": removed_unexpected_files,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit storage/DB integrity for enrollment and recognition artifacts."
    )
    parser.add_argument(
        "--cleanup-unexpected",
        action="store_true",
        help="Remove unexpected unreferenced image files under uploads/ and processed/.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = run_audit(cleanup_unexpected=args.cleanup_unexpected)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
