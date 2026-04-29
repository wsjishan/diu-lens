from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.approval_hygiene import ApprovalEvidenceIssue, assert_approval_hygiene
from app.core.storage import ALLOWED_ANGLES, empty_uploaded_images, get_storage_service
from app.db.models import (
    AuditLog,
    Enrollment,
    EnrollmentImage,
    FaceEmbedding,
    SelectedCrop,
    Student,
)
from app.db.session import get_session_factory


class EnrollmentPersistenceError(Exception):
    """Raised when enrollment metadata persistence fails."""


class StudentAlreadyRegisteredError(EnrollmentPersistenceError):
    """Raised when a student_id already exists."""


class EnrollmentNotFoundError(EnrollmentPersistenceError):
    """Raised when no enrollment exists for the provided student_id."""


class EnrollmentInvalidStateError(EnrollmentPersistenceError):
    """Raised when an admin action is not allowed for current enrollment state."""

    def __init__(
        self,
        message: str,
        *,
        debug_details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.debug_details = debug_details


@dataclass(frozen=True)
class EnrollmentAdminActionResult:
    success: bool
    message: str
    debug_details: dict[str, Any] | None = None


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
    frame_metadata_by_path: dict[str, dict[str, Any]]
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


def _to_datetime_from_epoch_ms(value: object) -> datetime | None:
    if value is None:
        return None
    try:
        milliseconds = int(value)
    except (TypeError, ValueError):
        return None
    if milliseconds <= 0:
        return None
    return datetime.fromtimestamp(milliseconds / 1000.0, tz=timezone.utc)


def _to_optional_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _latest_enrollment_for_student(db: Session, student_id: str) -> Enrollment | None:
    return db.scalar(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.id.desc())
        .limit(1)
    )


def _get_student_and_enrollment(
    db: Session, student_id: str
) -> tuple[Student | None, Enrollment | None]:
    student = db.scalar(select(Student).where(Student.student_id == student_id))
    if student is None:
        return None, None

    enrollment = db.scalar(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.id.desc())
        .limit(1)
    )
    return student, enrollment


def _create_enrollment(db: Session, payload: EnrollmentRecordInput) -> Enrollment:
    enrollment = Enrollment(
        student_id=payload.student_id,
        status=payload.status,
        verification_completed=payload.verification_completed,
        total_required_shots=payload.total_required_shots,
        total_accepted_shots=payload.total_accepted_shots,
        validation_passed=payload.validation_passed,
        rejection_reason=None,
    )
    db.add(enrollment)
    db.flush()
    return enrollment


def _replace_enrollment_images(
    db: Session,
    enrollment_id: int,
    uploaded_images: dict[str, list[str]],
    frame_metadata_by_path: dict[str, dict[str, Any]],
    validation_passed: bool,
) -> None:
    db.execute(
        delete(EnrollmentImage).where(EnrollmentImage.enrollment_id == enrollment_id)
    )

    for angle in ALLOWED_ANGLES:
        for relative_path in uploaded_images.get(angle, []):
            metadata = frame_metadata_by_path.get(relative_path, {})
            if not isinstance(metadata, dict):
                metadata = {}
            captured_at = _to_datetime_from_epoch_ms(metadata.get("captured_at"))
            db.add(
                EnrollmentImage(
                    enrollment_id=enrollment_id,
                    angle=angle,
                    file_path=relative_path,
                    file_name=Path(relative_path).name or "unknown",
                    content_type=None,
                    file_size=None,
                    passed_validation=validation_passed,
                    captured_at=captured_at,
                    blur_score=_to_optional_float(metadata.get("blur_score")),
                    brightness=_to_optional_float(metadata.get("brightness")),
                    face_area_ratio=_to_optional_float(metadata.get("face_area_ratio")),
                    center_offset=_to_optional_float(metadata.get("center_offset")),
                    detection_confidence=_to_optional_float(
                        metadata.get("detection_confidence")
                    ),
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


def _is_active_blocking_status(status: str) -> bool:
    return status not in {"rejected", "reset"}


def _delete_operational_data_by_student_id(db: Session, student_id: str) -> int:
    enrollment_ids = db.scalars(
        select(Enrollment.id).where(Enrollment.student_id == student_id)
    ).all()

    if enrollment_ids:
        db.execute(
            delete(EnrollmentImage).where(EnrollmentImage.enrollment_id.in_(enrollment_ids))
        )
        db.execute(
            delete(SelectedCrop).where(SelectedCrop.enrollment_id.in_(enrollment_ids))
        )

    db.execute(delete(FaceEmbedding).where(FaceEmbedding.student_id == student_id))
    db.execute(delete(Enrollment).where(Enrollment.student_id == student_id))

    has_remaining_enrollment = db.scalar(
        select(Enrollment.id)
        .where(Enrollment.student_id == student_id)
        .limit(1)
    )
    deleted_students = 0
    if has_remaining_enrollment is None:
        deleted_students = db.execute(
            delete(Student).where(Student.student_id == student_id)
        ).rowcount or 0

    return int(deleted_students or 0)


def approve_enrollment_by_student_id(db: Session, student_id: str) -> bool:
    """Admin action: approve a student's enrollment."""
    student, enrollment = _get_student_and_enrollment(db, student_id)
    if student is None or enrollment is None:
        raise EnrollmentNotFoundError("Enrollment not found for this student_id")

    if enrollment.status == "approved":
        return False

    if enrollment.status not in {"validated", "processed"}:
        raise EnrollmentInvalidStateError(
            "Only validated enrollments can be approved. "
            f"Current status: {enrollment.status}"
        )

    try:
        assert_approval_hygiene(
            db,
            student_id=student_id,
            enrollment_id=enrollment.id,
        )
    except ApprovalEvidenceIssue as exc:
        raise EnrollmentInvalidStateError(
            exc.message,
            debug_details=exc.debug_details,
        ) from exc

    enrollment.status = "approved"
    enrollment.rejection_reason = None
    _create_audit_log(
        db,
        event_type="enrollment_approved",
        student_pk=student.id,
        enrollment_pk=enrollment.id,
        message=f"Enrollment approved for student_id={student_id}",
    )
    db.flush()
    return True


def reject_enrollment_by_student_id(
    db: Session, student_id: str, reason: str | None = None
) -> None:
    """Admin action: reject a validated student's enrollment and clear operational data."""
    student, enrollment = _get_student_and_enrollment(db, student_id)
    if student is None or enrollment is None:
        raise EnrollmentNotFoundError("Enrollment not found for this student_id")

    if enrollment.status != "validated":
        raise EnrollmentInvalidStateError(
            "Only validated enrollments can be rejected. "
            f"Current status: {enrollment.status}"
        )

    reason_text = reason.strip() if reason else ""
    enrollment.rejection_reason = reason_text or None
    message = (
        f"Enrollment rejected and cleared for re-registration for student_id={student_id}"
    )
    if reason_text:
        message = f"{message}. reason={reason_text}"

    _create_audit_log(
        db,
        event_type="enrollment_rejected",
        student_pk=student.id,
        enrollment_pk=enrollment.id,
        message=message,
    )
    db.flush()
    _delete_operational_data_by_student_id(db, student_id)


def reset_enrollment_by_student_id(db: Session, student_id: str) -> None:
    """Super-admin action: destructive reset for approved student re-registration."""
    student, enrollment = _get_student_and_enrollment(db, student_id)
    if student is None or enrollment is None:
        raise EnrollmentNotFoundError("Enrollment not found for this student_id")

    if enrollment.status not in {"approved", "processed"}:
        raise EnrollmentInvalidStateError(
            "Only approved enrollments can be reset. "
            f"Current status: {enrollment.status}"
        )

    _create_audit_log(
        db,
        event_type="enrollment_reset",
        student_pk=student.id,
        enrollment_pk=enrollment.id,
        message=(
            f"Enrollment reset and cleared for re-registration for student_id={student_id}"
        ),
    )
    db.flush()
    _delete_operational_data_by_student_id(db, student_id)


def approve_enrollment(student_id: str) -> EnrollmentAdminActionResult:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            updated = approve_enrollment_by_student_id(db, student_id)
            db.commit()
        except EnrollmentNotFoundError:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message="Enrollment not found for this student_id",
            )
        except EnrollmentInvalidStateError as exc:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message=str(exc),
                debug_details=exc.debug_details,
            )
        except SQLAlchemyError as exc:
            db.rollback()
            raise EnrollmentPersistenceError("Failed to approve enrollment.") from exc

    if updated:
        return EnrollmentAdminActionResult(
            success=True,
            message="Enrollment approved successfully",
        )
    return EnrollmentAdminActionResult(
        success=True,
        message="Enrollment is already approved",
    )


def reject_enrollment(
    student_id: str, reason: str | None = None
) -> EnrollmentAdminActionResult:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            reject_enrollment_by_student_id(db, student_id, reason=reason)
            db.commit()
        except EnrollmentNotFoundError:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message="Enrollment not found for this student_id",
            )
        except EnrollmentInvalidStateError as exc:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message=str(exc),
            )
        except SQLAlchemyError as exc:
            db.rollback()
            raise EnrollmentPersistenceError("Failed to reject enrollment.") from exc

    return EnrollmentAdminActionResult(
        success=True,
        message="Enrollment rejected and cleared successfully",
    )


def reset_enrollment(student_id: str) -> EnrollmentAdminActionResult:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            reset_enrollment_by_student_id(db, student_id)
            db.commit()
        except EnrollmentNotFoundError:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message="Enrollment not found for this student_id",
            )
        except EnrollmentInvalidStateError as exc:
            db.rollback()
            return EnrollmentAdminActionResult(
                success=False,
                message=str(exc),
            )
        except SQLAlchemyError as exc:
            db.rollback()
            raise EnrollmentPersistenceError("Failed to reset enrollment.") from exc

    return EnrollmentAdminActionResult(
        success=True,
        message="Enrollment reset successfully",
    )


def assert_enrollment_processable(student_id: str) -> None:
    """Ensure heavy processing can run for the student's latest enrollment."""
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            enrollment = _latest_enrollment_for_student(db, student_id)
            if enrollment is None:
                raise EnrollmentNotFoundError("Enrollment not found for this student_id")

            if enrollment.status not in {"approved", "processed"}:
                raise EnrollmentInvalidStateError(
                    "Only approved enrollments can be processed. "
                    f"Current status: {enrollment.status}"
                )
        except EnrollmentNotFoundError:
            raise
        except EnrollmentInvalidStateError:
            raise
        except SQLAlchemyError as exc:
            raise EnrollmentPersistenceError(str(exc)) from exc


def get_processing_source_images(student_id: str) -> dict[str, Any]:
    """Return DB-scoped processing source images after integrity validation."""
    session_factory = get_session_factory()
    storage = get_storage_service()
    with session_factory() as db:
        try:
            student = db.scalar(select(Student).where(Student.student_id == student_id))
            if student is None:
                raise EnrollmentNotFoundError("Student not found for this student_id")

            enrollment = _latest_enrollment_for_student(db, student_id)
            if enrollment is None:
                raise EnrollmentNotFoundError("Enrollment not found for this student_id")

            if enrollment.student_id != student_id:
                raise EnrollmentInvalidStateError(
                    "Processing integrity check failed: enrollment/student mismatch."
                )
            if enrollment.status not in {"approved", "processed"}:
                raise EnrollmentInvalidStateError(
                    "Processing integrity check failed: enrollment is not in processable status."
                )

            rows = db.scalars(
                select(EnrollmentImage)
                .where(EnrollmentImage.enrollment_id == enrollment.id)
                .order_by(EnrollmentImage.id.asc())
            ).all()

            if not rows:
                raise EnrollmentInvalidStateError(
                    "Processing integrity check failed: no enrollment images found."
                )

            expected_prefix = f"uploads/{student_id}/"
            counts_by_angle = {angle: 0 for angle in ALLOWED_ANGLES}
            source_images: list[dict[str, str]] = []

            for row in rows:
                angle = str(row.angle)
                file_path = str(row.file_path)

                if angle not in counts_by_angle:
                    raise EnrollmentInvalidStateError(
                        f"Processing integrity check failed: unsupported angle '{angle}'."
                    )

                if not file_path.startswith(expected_prefix):
                    raise EnrollmentInvalidStateError(
                        "Processing integrity check failed: enrollment image path is outside "
                        "the target student's uploads scope."
                    )

                absolute_path = storage.resolve_relative_path(file_path)
                if not absolute_path.exists() or not absolute_path.is_file():
                    raise EnrollmentInvalidStateError(
                        f"Processing integrity check failed: missing source file '{file_path}'."
                    )

                counts_by_angle[angle] += 1
                source_images.append(
                    {
                        "angle": angle,
                        "source_image": file_path,
                        "captured_at": (
                            row.captured_at.isoformat()
                            if row.captured_at is not None
                            else None
                        ),
                        "blur_score": row.blur_score,
                        "brightness": row.brightness,
                        "face_area_ratio": row.face_area_ratio,
                        "center_offset": row.center_offset,
                        "detection_confidence": row.detection_confidence,
                    }
                )

            missing_angles = [angle for angle in ALLOWED_ANGLES if counts_by_angle[angle] <= 0]
            if missing_angles:
                raise EnrollmentInvalidStateError(
                    "Processing integrity check failed: required angles missing "
                    f"({', '.join(missing_angles)})."
                )

            return {
                "student_id": student_id,
                "enrollment_id": int(enrollment.id),
                "source_images": source_images,
            }
        except EnrollmentNotFoundError:
            raise
        except EnrollmentInvalidStateError:
            raise
        except SQLAlchemyError as exc:
            raise EnrollmentPersistenceError(str(exc)) from exc


def persist_enrollment_to_db(payload: EnrollmentRecordInput) -> None:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            existing_enrollment = db.scalar(
                select(Enrollment)
                .where(Enrollment.student_id == payload.student_id)
                .order_by(Enrollment.id.desc())
                .limit(1)
            )
            if existing_enrollment is not None and _is_active_blocking_status(
                existing_enrollment.status
            ):
                raise StudentAlreadyRegisteredError("You are already registered")

            student = db.scalar(
                select(Student).where(Student.student_id == payload.student_id)
            )
            if student is None:
                student = _create_student(db, payload)
            else:
                student.full_name = payload.full_name
                student.phone = payload.phone
                student.university_email = payload.university_email

            enrollment = _create_enrollment(db, payload)

            if payload.mode == "final":
                _replace_enrollment_images(
                    db,
                    enrollment_id=enrollment.id,
                    uploaded_images=payload.uploaded_images,
                    frame_metadata_by_path=payload.frame_metadata_by_path,
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


def persist_enrollment_verification_to_db(payload: EnrollmentRecordInput) -> None:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            student = db.scalar(
                select(Student).where(Student.student_id == payload.student_id)
            )
            if student is None:
                raise EnrollmentNotFoundError("No existing enrollment found for this student")

            enrollment = _latest_enrollment_for_student(db, payload.student_id)
            if enrollment is None:
                raise EnrollmentNotFoundError("No existing enrollment found for this student")

            if enrollment.status in {"approved", "rejected", "reset"}:
                raise EnrollmentPersistenceError(
                    f"Enrollment cannot be updated in current status: {enrollment.status}"
                )

            student.full_name = payload.full_name
            student.phone = payload.phone
            student.university_email = payload.university_email

            enrollment.status = payload.status
            enrollment.verification_completed = payload.verification_completed
            enrollment.total_required_shots = payload.total_required_shots
            enrollment.total_accepted_shots = payload.total_accepted_shots
            enrollment.validation_passed = payload.validation_passed
            enrollment.rejection_reason = None

            if payload.mode == "final":
                _replace_enrollment_images(
                    db,
                    enrollment_id=enrollment.id,
                    uploaded_images=payload.uploaded_images,
                    frame_metadata_by_path=payload.frame_metadata_by_path,
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
        except EnrollmentNotFoundError:
            db.rollback()
            raise
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
                    db.flush()

            _create_audit_log(
                db,
                event_type=(
                    "processing_completed" if processing_passed else "processing_failed"
                ),
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
    _delete_operational_data_by_student_id(db, student_id)


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
            student_ids = [str(row[0].student_id) for row in enrollment_rows]
            image_rows = db.execute(
                select(EnrollmentImage).where(EnrollmentImage.enrollment_id.in_(enrollment_ids))
            ).scalars()
            active_embedding_rows = db.execute(
                select(
                    FaceEmbedding.student_id,
                    func.count(FaceEmbedding.id),
                )
                .where(
                    FaceEmbedding.is_active.is_(True),
                    FaceEmbedding.student_id.in_(student_ids),
                )
                .group_by(FaceEmbedding.student_id)
            ).all()
            active_embeddings_by_student: dict[str, int] = {
                str(student_id): int(count)
                for student_id, count in active_embedding_rows
            }
            processing_audit_rows = db.execute(
                select(AuditLog)
                .where(
                    AuditLog.enrollment_id.in_(enrollment_ids),
                    AuditLog.event_type.in_(["processing_completed", "processing_failed"]),
                )
                .order_by(AuditLog.id.asc())
            ).scalars()
            latest_processing_audit_by_enrollment: dict[int, AuditLog] = {}
            for audit_row in processing_audit_rows:
                if audit_row.enrollment_id is None:
                    continue
                latest_processing_audit_by_enrollment[int(audit_row.enrollment_id)] = audit_row

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
                active_embeddings_count = int(
                    active_embeddings_by_student.get(str(student.student_id), 0)
                )
                has_active_embeddings = active_embeddings_count > 0
                latest_processing_audit = latest_processing_audit_by_enrollment.get(
                    int(enrollment.id)
                )
                last_processing_passed: bool | None = None
                last_processing_message: str | None = None
                if latest_processing_audit is not None:
                    last_processing_passed = (
                        str(latest_processing_audit.event_type) == "processing_completed"
                    )
                    last_processing_message = str(latest_processing_audit.message)
                if has_active_embeddings:
                    processing_state = "processed"
                elif last_processing_passed is False:
                    processing_state = "processing_failed"
                elif enrollment.status in {"approved", "processed"}:
                    processing_state = "needs_processing"
                else:
                    processing_state = "not_applicable"

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
                        "rejection_reason": enrollment.rejection_reason,
                        "active_embeddings_count": active_embeddings_count,
                        "has_active_embeddings": has_active_embeddings,
                        "processing_state": processing_state,
                        "last_processing_passed": last_processing_passed,
                        "last_processing_message": last_processing_message,
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
