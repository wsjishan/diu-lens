"""Cleanup contaminated recognition enrollments based on a hygiene report."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enrollment_db import reset_enrollment_by_student_id
from app.db.models import AuditLog, Enrollment, EnrollmentImage, FaceEmbedding, Student
from app.db.session import get_session_factory


def _default_hygiene_report_path() -> Path:
    # .../apps/api/app/scripts -> .../apps/.logs
    return (
        Path(__file__).resolve().parents[3]
        / ".logs"
        / "recognition_hygiene_calibration_report.json"
    )


def _default_cleanup_report_path() -> Path:
    return (
        Path(__file__).resolve().parents[3]
        / ".logs"
        / "recognition_data_cleanup_report.json"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cleanup contaminated approved recognition enrollments"
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=_default_hygiene_report_path(),
        help="Path to recognition_hygiene_calibration_report.json",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=_default_cleanup_report_path(),
        help="Where to write cleanup report JSON",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.07,
        help="Temporary provisional threshold currently applied in config",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute actions and report without mutating database",
    )
    return parser.parse_args()


@dataclass(frozen=True)
class StudentEvidence:
    student_id: str
    status: str
    enrollment_id: int
    enrollment_image_count: int
    active_embedding_count: int


def _extract_student_id_from_upload_path(path: str) -> str | None:
    parts = path.split("/")
    if len(parts) < 3 or parts[0] != "uploads":
        return None
    return parts[1]


def _collect_contaminated_approved_students(
    report: dict[str, Any],
) -> tuple[set[str], dict[str, set[str]]]:
    approved_students = set(report.get("approved_students", []))
    duplicate_findings = report.get("duplicate_findings", {})
    reasons: dict[str, set[str]] = defaultdict(set)
    contaminated: set[str] = set()

    for item in duplicate_findings.get(
        "byte_identical_clusters_affecting_approved_images",
        [],
    ):
        sid = _extract_student_id_from_upload_path(str(item.get("approved_image", "")))
        if sid is None:
            continue
        if sid in approved_students:
            contaminated.add(sid)
            reasons[sid].add(
                "approved_enrollment_images_duplicated_across_many_student_ids"
            )

    for item in duplicate_findings.get(
        "near_duplicate_hits_affecting_approved_images",
        [],
    ):
        sid = _extract_student_id_from_upload_path(str(item.get("approved_image", "")))
        if sid is None:
            continue
        if sid in approved_students:
            contaminated.add(sid)
            reasons[sid].add(
                "approved_enrollment_images_reused_or_replayed_near_duplicates"
            )

    for item in duplicate_findings.get("embedding_collisions_cross_student", []):
        for key in ("student_a", "student_b"):
            sid = item.get(key)
            if not isinstance(sid, str):
                continue
            if sid in approved_students:
                contaminated.add(sid)
                reasons[sid].add("embedding_collision_cross_identity")

    approved_with_active_embeddings = set(
        report.get("approved_students_with_active_embeddings", [])
    )
    for sid in approved_students:
        if sid not in approved_with_active_embeddings:
            contaminated.add(sid)
            reasons[sid].add(
                "approved_without_usable_active_embeddings_in_hygiene_report"
            )

    return contaminated, reasons


def _latest_enrollment_for_student(db: Session, student_id: str) -> Enrollment | None:
    return db.scalar(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.id.desc())
        .limit(1)
    )


def _fetch_approved_evidence(db: Session) -> dict[str, StudentEvidence]:
    approved_rows = db.scalars(
        select(Enrollment)
        .where(Enrollment.status == "approved")
        .order_by(Enrollment.student_id.asc())
    ).all()

    evidence: dict[str, StudentEvidence] = {}
    for enrollment in approved_rows:
        image_count = int(
            db.scalar(
                select(func.count())
                .select_from(EnrollmentImage)
                .where(EnrollmentImage.enrollment_id == enrollment.id)
            )
            or 0
        )
        active_embedding_count = int(
            db.scalar(
                select(func.count())
                .select_from(FaceEmbedding)
                .where(
                    FaceEmbedding.student_id == enrollment.student_id,
                    FaceEmbedding.is_active.is_(True),
                )
            )
            or 0
        )

        evidence[enrollment.student_id] = StudentEvidence(
            student_id=enrollment.student_id,
            status=enrollment.status,
            enrollment_id=enrollment.id,
            enrollment_image_count=image_count,
            active_embedding_count=active_embedding_count,
        )
    return evidence


def _add_db_evidence_reasons(
    reasons: dict[str, set[str]],
    approved_evidence: dict[str, StudentEvidence],
) -> set[str]:
    invalid: set[str] = set()
    for sid, item in approved_evidence.items():
        no_images = item.enrollment_image_count <= 0
        no_embeddings = item.active_embedding_count <= 0
        if no_images:
            invalid.add(sid)
            reasons[sid].add("approved_with_zero_enrollment_images")
        if no_embeddings:
            invalid.add(sid)
            reasons[sid].add("approved_with_zero_active_embeddings")
        if no_images or no_embeddings:
            reasons[sid].add("approved_without_usable_enrollment_evidence")
    return invalid


def _create_audit_log(
    db: Session,
    *,
    student_pk: int | None,
    enrollment_pk: int | None,
    message: str,
) -> None:
    db.add(
        AuditLog(
            event_type="recognition_hygiene_cleanup",
            student_id=student_pk,
            enrollment_id=enrollment_pk,
            message=message,
        )
    )
    db.flush()


def _recognized_eligible_students(db: Session) -> list[str]:
    rows = db.scalars(
        select(Enrollment.student_id)
        .join(
            FaceEmbedding,
            FaceEmbedding.student_id == Enrollment.student_id,
        )
        .where(
            Enrollment.status == "approved",
            FaceEmbedding.is_active.is_(True),
        )
        .distinct()
        .order_by(Enrollment.student_id.asc())
    ).all()
    return list(rows)


def _active_embedding_count(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(FaceEmbedding)
            .where(FaceEmbedding.is_active.is_(True))
        )
        or 0
    )


def main() -> None:
    args = parse_args()
    report_path: Path = args.report
    output_path: Path = args.output
    provisional_threshold = float(args.threshold)
    dry_run = bool(args.dry_run)

    report = json.loads(report_path.read_text(encoding="utf-8"))
    contaminated_from_report, reasons = _collect_contaminated_approved_students(report)

    session_factory = get_session_factory()

    reset_results: list[dict[str, Any]] = []
    skipped_results: list[dict[str, Any]] = []
    approved_before: list[str] = []
    approved_after: list[str] = []
    eligible_after: list[str] = []
    active_embeddings_after = 0

    with session_factory() as db:
        approved_before = db.scalars(
            select(Enrollment.student_id)
            .where(Enrollment.status == "approved")
            .order_by(Enrollment.student_id.asc())
        ).all()

        approved_evidence = _fetch_approved_evidence(db)
        invalid_approved = _add_db_evidence_reasons(reasons, approved_evidence)
        target_students = sorted(contaminated_from_report.union(invalid_approved))

        for sid in target_students:
            enrollment = _latest_enrollment_for_student(db, sid)
            student = db.scalar(select(Student).where(Student.student_id == sid))

            if enrollment is None or student is None:
                skipped_results.append(
                    {
                        "student_id": sid,
                        "action": "skipped",
                        "reason": "student_or_enrollment_not_found",
                    }
                )
                continue

            if enrollment.status not in {"approved", "processed"}:
                skipped_results.append(
                    {
                        "student_id": sid,
                        "action": "skipped",
                        "reason": f"status_not_resettable:{enrollment.status}",
                    }
                )
                continue

            before_images = int(
                db.scalar(
                    select(func.count())
                    .select_from(EnrollmentImage)
                    .where(EnrollmentImage.enrollment_id == enrollment.id)
                )
                or 0
            )
            before_active_embeddings = int(
                db.scalar(
                    select(func.count())
                    .select_from(FaceEmbedding)
                    .where(
                        FaceEmbedding.student_id == sid,
                        FaceEmbedding.is_active.is_(True),
                    )
                )
                or 0
            )

            cleanup_reason_list = sorted(reasons.get(sid, {"manual_cleanup_requested"}))
            _create_audit_log(
                db,
                student_pk=student.id,
                enrollment_pk=enrollment.id,
                message=(
                    "Recognition hygiene cleanup initiated "
                    f"for student_id={sid}. reasons={cleanup_reason_list}. "
                    f"source_report={report_path.name}."
                ),
            )

            if not dry_run:
                reset_enrollment_by_student_id(db, sid)

            reset_results.append(
                {
                    "student_id": sid,
                    "action": "reset" if not dry_run else "would_reset",
                    "previous_status": enrollment.status,
                    "previous_enrollment_image_count": before_images,
                    "previous_active_embedding_count": before_active_embeddings,
                    "reasons": cleanup_reason_list,
                }
            )

        if not dry_run:
            db.commit()
        else:
            db.rollback()

    with session_factory() as db:
        approved_after = db.scalars(
            select(Enrollment.student_id)
            .where(Enrollment.status == "approved")
            .order_by(Enrollment.student_id.asc())
        ).all()
        eligible_after = _recognized_eligible_students(db)
        active_embeddings_after = _active_embedding_count(db)

    clean_eval = report.get("clean_evaluation_set", {})
    true_probe_count = int(clean_eval.get("clean_true_probe_count", 0) or 0)
    false_probe_count = int(clean_eval.get("clean_false_probe_count", 0) or 0)

    missing_collection_notes: list[str] = []
    if true_probe_count <= 0:
        missing_collection_notes.append(
            "Collect clean true holdout probes for approved identities (currently 0)."
        )
    if not eligible_after:
        missing_collection_notes.append(
            "No recognition-eligible students remain; collect fresh unique enrollments and re-approve."
        )
    if reset_results:
        missing_collection_notes.append(
            "For each reset student, recapture unique front/left/right/up/down images and regenerate embeddings."
        )
    if false_probe_count <= 0:
        missing_collection_notes.append(
            "Collect clean false probes for threshold stress testing."
        )

    output_payload: dict[str, Any] = {
        "cleanup_mode": "dry_run" if dry_run else "applied",
        "source_hygiene_report": str(report_path),
        "threshold_change": {
            "previous_threshold": report.get("current_threshold"),
            "new_threshold": provisional_threshold,
            "status": "temporary_provisional_until_clean_calibration",
        },
        "approved_students_before": approved_before,
        "approved_students_after": approved_after,
        "students_reset_or_unapproved": reset_results,
        "students_skipped": skipped_results,
        "students_still_recognition_eligible_after": eligible_after,
        "active_embedding_count_after": active_embeddings_after,
        "clean_data_still_required": missing_collection_notes,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output_payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    print(json.dumps(output_payload, indent=2, sort_keys=True))
    print(f"\nCleanup report written to: {output_path}")


if __name__ == "__main__":
    main()
