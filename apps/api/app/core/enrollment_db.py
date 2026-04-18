from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.storage import ALLOWED_ANGLES, empty_uploaded_images
from app.db.models import AuditLog, Enrollment, EnrollmentImage, SelectedCrop, Student
from app.db.session import get_session_factory


class EnrollmentPersistenceError(Exception):
    """Raised when enrollment metadata persistence fails."""


class StudentAlreadyRegisteredError(EnrollmentPersistenceError):
    """Raised when a student_id already exists."""


@dataclass(frozen=True)
class EnrollmentRecordInput:
    student_id: str
    full_name: str
    phone: str
    university_email: str
    status: str
    verification_completed: bool
    total_required_shots: int
    total_accepted_shots: int
    validation_passed: bool
    uploaded_images: dict[str, list[str]]
    event_type: str
    event_message: str
    mode: str  # "basic" | "final"


def student_exists_in_db(student_id: str) -> bool:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            student = db.scalar(select(Student.id).where(Student.student_id == student_id))
            return student is not None
        except SQLAlchemyError as exc:
            raise EnrollmentPersistenceError(str(exc)) from exc


def _create_student(db: Session, payload: EnrollmentRecordInput) -> Student:
    student = Student(
        student_id=payload.student_id,
        full_name=payload.full_name,
        phone=payload.phone,
        university_email=payload.university_email,
    )
    db.add(student)
    db.flush()
    return student


def _latest_enrollment_for_student(db: Session, student_id: str) -> Enrollment | None:
    return db.scalar(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.id.desc())
        .limit(1)
    )


def _create_enrollment(db: Session, payload: EnrollmentRecordInput) -> Enrollment:
    enrollment = Enrollment(
        student_id=payload.student_id,
        status=payload.status,
        verification_completed=payload.verification_completed,
        total_required_shots=payload.total_required_shots,
        total_accepted_shots=payload.total_accepted_shots,
        validation_passed=payload.validation_passed,
    )
    db.add(enrollment)
    db.flush()
    return enrollment


def _replace_enrollment_images(
    db: Session,
    enrollment_id: int,
    uploaded_images: dict[str, list[str]],
    validation_passed: bool,
) -> None:
    db.execute(
        delete(EnrollmentImage).where(EnrollmentImage.enrollment_id == enrollment_id)
    )

    for angle in ALLOWED_ANGLES:
        for relative_path in uploaded_images.get(angle, []):
            db.add(
                EnrollmentImage(
                    enrollment_id=enrollment_id,
                    angle=angle,
                    file_path=relative_path,
                    file_name=Path(relative_path).name or "unknown",
                    content_type=None,
                    file_size=None,
                    passed_validation=validation_passed,
                )
            )


def _create_audit_log(
    db: Session,
    *,
    event_type: str,
    student_pk: int | None,
    enrollment_pk: int | None,
    message: str,
) -> None:
    db.add(
        AuditLog(
            event_type=event_type,
            student_id=student_pk,
            enrollment_id=enrollment_pk,
            message=message,
        )
    )


def persist_enrollment_to_db(payload: EnrollmentRecordInput) -> None:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            existing_student = db.scalar(
                select(Student.id).where(Student.student_id == payload.student_id)
            )
            if existing_student is not None:
                raise StudentAlreadyRegisteredError("You are already registered")

            student = _create_student(db, payload)
            enrollment = _create_enrollment(db, payload)

            if payload.mode == "final":
                _replace_enrollment_images(
                    db,
                    enrollment_id=enrollment.id,
                    uploaded_images=payload.uploaded_images,
                    validation_passed=payload.validation_passed,
                )

            _create_audit_log(
                db,
                event_type=payload.event_type,
                student_pk=student.id,
                enrollment_pk=enrollment.id,
                message=payload.event_message,
            )
            db.commit()
        except StudentAlreadyRegisteredError:
            db.rollback()
            raise
        except IntegrityError as exc:
            db.rollback()
            raise StudentAlreadyRegisteredError("You are already registered") from exc
        except SQLAlchemyError as exc:
            db.rollback()
            raise EnrollmentPersistenceError(str(exc)) from exc


def record_processing_completed_in_db(
    student_id: str,
    *,
    processed_images_count: int,
    processing_passed: bool,
) -> None:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            student = db.scalar(select(Student).where(Student.student_id == student_id))
            enrollment_id: int | None = None

            if student is not None:
                enrollment = _latest_enrollment_for_student(db, student.student_id)
                if enrollment is not None:
                    enrollment_id = enrollment.id
                    if processing_passed:
                        enrollment.status = "processed"
                    db.flush()

            _create_audit_log(
                db,
                event_type="processing_completed",
                student_pk=student.id if student is not None else None,
                enrollment_pk=enrollment_id,
                message=(
                    f"Processing completed for student_id={student_id}. "
                    f"processing_passed={processing_passed}, "
                    f"processed_images_count={processed_images_count}"
                ),
            )
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise EnrollmentPersistenceError(str(exc)) from exc


def delete_enrollment_data_by_student_id(db: Session, student_id: str) -> None:
    student_db_id = db.scalar(select(Student.id).where(Student.student_id == student_id))
    if student_db_id is None:
        return

    enrollment_ids = db.scalars(
        select(Enrollment.id).where(Enrollment.student_id == student_id)
    ).all()
    if enrollment_ids:
        db.execute(delete(EnrollmentImage).where(EnrollmentImage.enrollment_id.in_(enrollment_ids)))
        db.execute(delete(SelectedCrop).where(SelectedCrop.enrollment_id.in_(enrollment_ids)))

    db.execute(delete(Enrollment).where(Enrollment.student_id == student_id))
    # Embeddings table is not introduced yet, so nothing to delete there.
    # Audit logs are intentionally preserved.


def get_enrollments_snapshot_from_db() -> dict[str, Any]:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            enrollment_rows = db.execute(
                select(Enrollment, Student)
                .join(Student, Enrollment.student_id == Student.student_id)
                .order_by(Enrollment.id.asc())
            ).all()

            if not enrollment_rows:
                return {
                    "total": 0,
                    "latest": None,
                    "enrollments": [],
                }

            enrollment_ids = [row[0].id for row in enrollment_rows]
            image_rows = db.execute(
                select(EnrollmentImage).where(EnrollmentImage.enrollment_id.in_(enrollment_ids))
            ).scalars()

            images_by_enrollment: dict[int, dict[str, list[str]]] = {
                enrollment_id: empty_uploaded_images() for enrollment_id in enrollment_ids
            }
            for image in image_rows:
                grouped = images_by_enrollment.get(image.enrollment_id)
                if grouped is None:
                    continue
                if image.angle not in grouped:
                    grouped[image.angle] = []
                grouped[image.angle].append(image.file_path)

            entries: list[dict[str, Any]] = []
            for enrollment, student in enrollment_rows:
                uploaded_images = images_by_enrollment.get(enrollment.id, empty_uploaded_images())
                total_images_checked = sum(len(paths) for paths in uploaded_images.values())
                total_images_passed = (
                    total_images_checked if enrollment.validation_passed else 0
                )

                entries.append(
                    {
                        "student_id": student.student_id,
                        "full_name": student.full_name,
                        "phone": student.phone,
                        "university_email": student.university_email,
                        "status": enrollment.status,
                        "verification_completed": enrollment.verification_completed,
                        "total_required_shots": enrollment.total_required_shots,
                        "total_accepted_shots": enrollment.total_accepted_shots,
                        "angles": [],
                        "uploaded_images": uploaded_images,
                        "validation": {
                            "validation_passed": enrollment.validation_passed,
                            "total_images_checked": total_images_checked,
                            "total_images_passed": total_images_passed,
                            "failed_images_count": total_images_checked - total_images_passed,
                            "image_reports": [],
                        },
                        "created_at": enrollment.created_at.isoformat(),
                        "updated_at": enrollment.updated_at.isoformat(),
                    }
                )

            return {
                "total": len(entries),
                "latest": entries[-1],
                "enrollments": entries,
            }
        except SQLAlchemyError as exc:
            raise EnrollmentPersistenceError(str(exc)) from exc
