"""Reset operational student/enrollment/recognition data while keeping admin setup."""

from __future__ import annotations

import argparse
from typing import Any

from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session

import app.core.storage as storage_module
from app.db.models import Enrollment, EnrollmentImage, FaceEmbedding, SelectedCrop, Student
import app.db.session as db_session_module


def _count(db: Session, model: Any) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def reset_operational_data(*, clear_storage: bool = True) -> dict[str, Any]:
    before_counts: dict[str, int]
    after_counts: dict[str, int]

    session_factory = db_session_module.get_session_factory()
    storage = storage_module.get_storage_service()

    with session_factory() as db:
        before_counts = {
            "students": _count(db, Student),
            "enrollments": _count(db, Enrollment),
            "enrollment_images": _count(db, EnrollmentImage),
            "selected_crops": _count(db, SelectedCrop),
            "face_embeddings": _count(db, FaceEmbedding),
        }

        db.execute(delete(FaceEmbedding))
        db.execute(delete(SelectedCrop))
        db.execute(delete(EnrollmentImage))
        db.execute(delete(Enrollment))
        db.execute(delete(Student))
        db.commit()

        after_counts = {
            "students": _count(db, Student),
            "enrollments": _count(db, Enrollment),
            "enrollment_images": _count(db, EnrollmentImage),
            "selected_crops": _count(db, SelectedCrop),
            "face_embeddings": _count(db, FaceEmbedding),
        }

    if clear_storage:
        storage.clear_all_uploads()
        storage.clear_all_processed()

    return {
        "database": {
            "before": before_counts,
            "after": after_counts,
        },
        "storage": {
            "uploads_cleared": bool(clear_storage),
            "processed_cleared": bool(clear_storage),
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete operational student/enrollment/recognition data and clear storage folders."
    )
    parser.add_argument(
        "--no-storage-clear",
        action="store_true",
        help="Only clear database operational tables; keep uploads/processed files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = reset_operational_data(clear_storage=not args.no_storage_clear)
    print(report)


if __name__ == "__main__":
    main()
