from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.storage import ALLOWED_ANGLES, get_storage_service
from app.db.models import Enrollment, EnrollmentImage


NEAR_DUPLICATE_DHASH_MAX_DISTANCE = 4


@dataclass(frozen=True)
class ApprovalEvidenceIssue(Exception):
    message: str


@dataclass(frozen=True)
class _ImageEvidence:
    angle: str
    path: str
    sha256: str
    dhash: int | None


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

    missing_angles = [angle for angle in ALLOWED_ANGLES if counts_by_angle[angle] <= 0]
    if missing_angles:
        raise ApprovalEvidenceIssue("required capture angles missing")

    if len(evidence) < len(ALLOWED_ANGLES):
        raise ApprovalEvidenceIssue("enrollment evidence incomplete")

    return evidence


def _iter_other_student_enrollment_images(
    db: Session,
    current_student_id: str,
) -> list[EnrollmentImage]:
    rows = db.scalars(
        select(EnrollmentImage)
        .join(Enrollment, Enrollment.id == EnrollmentImage.enrollment_id)
        .where(Enrollment.student_id != current_student_id)
    ).all()
    return list(rows)


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

    current_sha = {item.sha256 for item in current_evidence}
    current_dhash = [item.dhash for item in current_evidence if item.dhash is not None]

    for other in other_images:
        other_bytes = _read_file_bytes(other.file_path)
        if not other_bytes:
            continue

        other_sha = _compute_sha256(other_bytes)
        if other_sha in current_sha:
            raise ApprovalEvidenceIssue("duplicate enrollment evidence detected")

        other_dhash = _compute_dhash(other_bytes)
        if other_dhash is None:
            continue

        for value in current_dhash:
            if _hamming_distance(value, other_dhash) <= NEAR_DUPLICATE_DHASH_MAX_DISTANCE:
                raise ApprovalEvidenceIssue("near-duplicate evidence detected")
