"""Face embeddings persistence service layer."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import Enrollment, FaceEmbedding, Student
from app.db.session import get_session_factory


class FaceEmbeddingPersistenceError(Exception):
    """Raised when face embedding persistence fails."""


EMBEDDING_DIMENSION = 512


def deactivate_embeddings_for_student(db: Session, student_id: str) -> int:
    result = db.execute(
        update(FaceEmbedding)
        .where(FaceEmbedding.student_id == student_id, FaceEmbedding.is_active.is_(True))
        .values(is_active=False)
    )
    return result.rowcount or 0


def persist_face_embeddings(
    student_id: str,
    processed_crops: list[dict[str, Any]],
) -> dict[str, int]:
    """Persist processed face embeddings for a student.

    Policy: deactivate existing active embeddings for student before inserting new ones.
    """
    if not processed_crops:
        return {"deactivated_count": 0, "inserted_count": 0}

    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            student = db.scalar(select(Student).where(Student.student_id == student_id))
            if student is None:
                raise FaceEmbeddingPersistenceError(
                    f"Student not found for embedding persistence: {student_id}"
                )

            enrollment = db.scalar(
                select(Enrollment)
                .where(Enrollment.student_id == student_id)
                .order_by(Enrollment.id.desc())
                .limit(1)
            )
            enrollment_id = enrollment.id if enrollment is not None else None

            deactivated_count = deactivate_embeddings_for_student(db, student_id)

            inserted_count = 0
            for index, row in enumerate(processed_crops):
                vector = row.get("embedding")
                if not isinstance(vector, list):
                    raise FaceEmbeddingPersistenceError(
                        f"Invalid embedding payload at index={index}: embedding must be a list."
                    )
                if len(vector) != EMBEDDING_DIMENSION:
                    raise FaceEmbeddingPersistenceError(
                        f"Invalid embedding dimension at index={index}: "
                        f"expected {EMBEDDING_DIMENSION}, got {len(vector)}."
                    )

                angle = str(row.get("angle", "unknown"))
                source_image = str(row.get("source_image", ""))
                crop_path = str(row.get("crop_path", ""))
                if not source_image or not crop_path:
                    raise FaceEmbeddingPersistenceError(
                        f"Invalid embedding payload at index={index}: source/crop path is required."
                    )

                db.add(
                    FaceEmbedding(
                        student_id=student_id,
                        enrollment_id=enrollment_id,
                        angle=angle,
                        source_image_path=source_image,
                        crop_path=crop_path,
                        embedding=[float(v) for v in vector],
                        embedding_dim=EMBEDDING_DIMENSION,
                        is_active=True,
                    )
                )
                inserted_count += 1

            if inserted_count == 0:
                raise FaceEmbeddingPersistenceError(
                    "No valid embeddings were provided for persistence."
                )

            db.commit()
            return {
                "deactivated_count": deactivated_count,
                "inserted_count": inserted_count,
            }
        except SQLAlchemyError as exc:
            db.rollback()
            raise FaceEmbeddingPersistenceError(str(exc)) from exc


def list_active_embeddings_for_student(student_id: str) -> list[dict[str, Any]]:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            rows = db.execute(
                select(FaceEmbedding)
                .where(
                    FaceEmbedding.student_id == student_id,
                    FaceEmbedding.is_active.is_(True),
                )
                .order_by(FaceEmbedding.id.asc())
            ).scalars()

            return [
                {
                    "id": row.id,
                    "student_id": row.student_id,
                    "enrollment_id": row.enrollment_id,
                    "angle": row.angle,
                    "source_image_path": row.source_image_path,
                    "crop_path": row.crop_path,
                    "embedding_dim": row.embedding_dim,
                    "is_active": row.is_active,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
        except SQLAlchemyError as exc:
            raise FaceEmbeddingPersistenceError(str(exc)) from exc
