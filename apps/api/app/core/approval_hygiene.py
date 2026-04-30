from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import (
    ALLOWED_ANGLES,
    REQUIRED_CAPTURE_ANGLES,
    get_storage_service,
)
from app.db.models import Enrollment, EnrollmentImage


NEAR_DUPLICATE_DHASH_MAX_DISTANCE = 4
DHASH_BITS = 64
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ApprovalEvidenceIssue(Exception):
    message: str
    debug_details: dict[str, Any] | None = None


@dataclass(frozen=True)
class _ImageEvidence:
    angle: str
    path: str
    sha256: str
    dhash: int | None


@dataclass(frozen=True)
class _OtherImageEvidence:
    angle: str
    path: str
    student_id: str
    enrollment_id: int


def _read_file_bytes(relative_path: str) -> bytes | None:
    storage = get_storage_service()
    absolute_path: Path = storage.resolve_relative_path(relative_path)
    if not absolute_path.exists() or not absolute_path.is_file():
        return None
    try:
        return absolute_path.read_bytes()
    except OSError:
        return None


def _compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _compute_dhash(content: bytes) -> int | None:
    np_buffer = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(np_buffer, cv2.IMREAD_GRAYSCALE)
    if image is None or image.size == 0:
        return None

    resized = cv2.resize(image, (9, 8), interpolation=cv2.INTER_AREA)
    diff = resized[:, 1:] > resized[:, :-1]
    hash_value = 0
    for bit in diff.flatten():
        hash_value = (hash_value << 1) | int(bool(bit))
    return hash_value


def _hamming_distance(hash_a: int, hash_b: int) -> int:
    return (hash_a ^ hash_b).bit_count()


def _near_duplicate_score(distance: int) -> float:
    score = (DHASH_BITS - distance) / float(DHASH_BITS)
    return round(max(0.0, min(1.0, score)), 4)


def _build_cleanup_recommendation(matched_student_id: str) -> str:
    return (
        "Potential test-data contamination detected. "
        f"Reset/clean existing student_id={matched_student_id} before real-data approval testing."
    )


def _build_issue_details(
    *,
    duplicate_type: str,
    blocked_student_id: str,
    blocked_angle: str,
    blocked_image_path: str,
    matched_existing_student_id: str,
    matched_existing_angle: str,
    matched_existing_image_path: str,
    matched_existing_enrollment_id: int,
    dhash_distance: int | None,
) -> dict[str, Any]:
    if duplicate_type == "byte-identical":
        score: float | None = 1.0
    elif dhash_distance is not None:
        score = _near_duplicate_score(dhash_distance)
    else:
        score = None

    return {
        "blocked_student_id": blocked_student_id,
        "blocked_angle": blocked_angle,
        "blocked_image_path": blocked_image_path,
        "matched_existing_student_id": matched_existing_student_id,
        "matched_existing_angle": matched_existing_angle,
        "matched_existing_image_path": matched_existing_image_path,
        "matched_existing_enrollment_id": matched_existing_enrollment_id,
        "duplicate_type": duplicate_type,
        "dhash_distance": dhash_distance,
        "duplicate_score": score,
        "dhash_max_distance_threshold": NEAR_DUPLICATE_DHASH_MAX_DISTANCE,
        "cleanup_recommendation": _build_cleanup_recommendation(matched_existing_student_id),
    }


def _load_current_enrollment_evidence(
    db: Session,
    enrollment_id: int,
) -> list[_ImageEvidence]:
    rows = db.scalars(
        select(EnrollmentImage)
        .where(EnrollmentImage.enrollment_id == enrollment_id)
        .order_by(EnrollmentImage.id.asc())
    ).all()

    if not rows:
        raise ApprovalEvidenceIssue("enrollment evidence incomplete")

    counts_by_angle = {angle: 0 for angle in ALLOWED_ANGLES}
    evidence: list[_ImageEvidence] = []

    for row in rows:
        if row.angle in counts_by_angle:
            counts_by_angle[row.angle] += 1

        file_bytes = _read_file_bytes(row.file_path)
        if not file_bytes:
            raise ApprovalEvidenceIssue("enrollment evidence incomplete")

        dhash = _compute_dhash(file_bytes)
        if dhash is None:
            raise ApprovalEvidenceIssue("enrollment evidence incomplete")

        evidence.append(
            _ImageEvidence(
                angle=row.angle,
                path=row.file_path,
                sha256=_compute_sha256(file_bytes),
                dhash=dhash,
            )
        )

    missing_angles = [
        angle
        for angle in REQUIRED_CAPTURE_ANGLES
        if counts_by_angle[angle] <= 0
    ]
    if missing_angles:
        raise ApprovalEvidenceIssue("required capture angles missing")

    if len(evidence) < len(REQUIRED_CAPTURE_ANGLES):
        raise ApprovalEvidenceIssue("enrollment evidence incomplete")

    return evidence


def _iter_other_student_enrollment_images(
    db: Session,
    current_student_id: str,
) -> list[_OtherImageEvidence]:
    rows = db.execute(
        select(EnrollmentImage, Enrollment.student_id, Enrollment.id)
        .join(Enrollment, Enrollment.id == EnrollmentImage.enrollment_id)
        .where(Enrollment.student_id != current_student_id)
    ).all()

    evidence: list[_OtherImageEvidence] = []
    for image_row, student_id, enrollment_id in rows:
        evidence.append(
            _OtherImageEvidence(
                angle=str(image_row.angle),
                path=str(image_row.file_path),
                student_id=str(student_id),
                enrollment_id=int(enrollment_id),
            )
        )

    return evidence


def assert_approval_hygiene(
    db: Session,
    *,
    student_id: str,
    enrollment_id: int,
) -> None:
    current_evidence = _load_current_enrollment_evidence(db, enrollment_id)
    other_images = _iter_other_student_enrollment_images(db, student_id)

    if not other_images:
        return

    current_by_sha = {item.sha256: item for item in current_evidence}
    current_by_dhash = [item for item in current_evidence if item.dhash is not None]

    for other in other_images:
        other_bytes = _read_file_bytes(other.path)
        if not other_bytes:
            continue

        other_sha = _compute_sha256(other_bytes)
        if other_sha in current_by_sha:
            blocked = current_by_sha[other_sha]
            details = _build_issue_details(
                duplicate_type="byte-identical",
                blocked_student_id=student_id,
                blocked_angle=blocked.angle,
                blocked_image_path=blocked.path,
                matched_existing_student_id=other.student_id,
                matched_existing_angle=other.angle,
                matched_existing_image_path=other.path,
                matched_existing_enrollment_id=other.enrollment_id,
                dhash_distance=0,
            )
            logger.warning(
                "Approval hygiene blocked: duplicate enrollment evidence detected details=%s",
                details,
            )
            raise ApprovalEvidenceIssue(
                "duplicate enrollment evidence detected",
                debug_details=details,
            )

        other_dhash = _compute_dhash(other_bytes)
        if other_dhash is None:
            continue

        for blocked in current_by_dhash:
            distance = _hamming_distance(int(blocked.dhash), other_dhash)
            if distance <= NEAR_DUPLICATE_DHASH_MAX_DISTANCE:
                details = _build_issue_details(
                    duplicate_type="near-duplicate",
                    blocked_student_id=student_id,
                    blocked_angle=blocked.angle,
                    blocked_image_path=blocked.path,
                    matched_existing_student_id=other.student_id,
                    matched_existing_angle=other.angle,
                    matched_existing_image_path=other.path,
                    matched_existing_enrollment_id=other.enrollment_id,
                    dhash_distance=distance,
                )
                logger.warning(
                    "Approval hygiene blocked: near-duplicate evidence detected details=%s",
                    details,
                )
                raise ApprovalEvidenceIssue(
                    "near-duplicate evidence detected",
                    debug_details=details,
                )
