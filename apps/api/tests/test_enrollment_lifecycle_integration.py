from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Any

import cv2
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, sessionmaker

import app.api.routes.debug as debug_routes
import app.api.routes.enroll as enroll_routes
import app.core.face_matching as face_matching_module
from app.core.storage_service import ALLOWED_ANGLES, LocalStorageService
from app.db.models import AuditLog, Enrollment, EnrollmentImage, FaceEmbedding, Student


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _basic_payload(student_id: str) -> dict[str, object]:
    return {
        "student_id": student_id,
        "full_name": f"Student {student_id}",
        "phone": "01700000000",
        "university_email": f"{student_id.replace('-', '')}@diu.edu.bd",
    }


def _verification_metadata(student_id: str) -> dict[str, object]:
    return {
        "student_id": student_id,
        "full_name": f"Student {student_id}",
        "phone": "01700000000",
        "university_email": f"{student_id.replace('-', '')}@diu.edu.bd",
        "verification_completed": True,
        "total_required_shots": len(ALLOWED_ANGLES),
        "total_accepted_shots": len(ALLOWED_ANGLES),
        "angles": [
            {
                "angle": angle,
                "accepted_shots": 1,
                "required_shots": 1,
            }
            for angle in ALLOWED_ANGLES
        ],
    }


def _verification_files(metadata: dict[str, object]) -> list[tuple[str, tuple[Any, ...]]]:
    student_id = str(metadata.get("student_id", "unknown"))
    files: list[tuple[str, tuple[Any, ...]]] = [
        ("metadata", (None, json.dumps(metadata), "application/json")),
    ]
    for angle in ALLOWED_ANGLES:
        files.append(
            (
                angle,
                (f"{angle}.jpg", _build_image_bytes(student_id=student_id, angle=angle), "image/jpeg"),
            )
        )
    return files


def _build_image_bytes(*, student_id: str, angle: str, variant: int = 0) -> bytes:
    seed_src = f"{student_id}:{angle}:{variant}".encode("utf-8")
    seed = int.from_bytes(hashlib.sha256(seed_src).digest()[:8], "big")
    rng = np.random.default_rng(seed)
    image = rng.integers(0, 255, size=(96, 96, 3), dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    assert ok
    return encoded.tobytes()


def _verification_files_for_images(
    metadata: dict[str, object],
    image_by_angle: dict[str, bytes],
) -> list[tuple[str, tuple[Any, ...]]]:
    files: list[tuple[str, tuple[Any, ...]]] = [
        ("metadata", (None, json.dumps(metadata), "application/json")),
    ]
    for angle in ALLOWED_ANGLES:
        files.append((angle, (f"{angle}.jpg", image_by_angle[angle], "image/jpeg")))
    return files


def _build_near_duplicate_variant(image_bytes: bytes) -> bytes:
    decoded = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    assert decoded is not None
    mutated = decoded.copy()
    mutated[0:3, 0:3, :] = (mutated[0:3, 0:3, :] + 3) % 255
    ok, encoded = cv2.imencode(".jpg", mutated, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    assert ok
    return encoded.tobytes()


def _count(db: Session, model: Any, *conditions: Any) -> int:
    stmt = select(func.count()).select_from(model)
    if conditions:
        stmt = stmt.where(*conditions)
    return int(db.scalar(stmt) or 0)


def _latest_enrollment(db: Session, student_id: str) -> Enrollment | None:
    return db.scalar(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .order_by(Enrollment.id.desc())
        .limit(1)
    )


def _patch_validation_pass(monkeypatch: Any) -> None:
    def _report(image_bytes: bytes, file_name: str, angle: str) -> dict[str, object]:
        return {
            "file_name": file_name,
            "angle": angle,
            "passed": True,
            "blur_ok": True,
            "brightness_ok": True,
            "dimensions_ok": True,
            "face_detected": True,
            "face_centered": True,
            "eyes_visible": "passed",
            "failure_reasons": [],
            "blocker": "ready",
        }

    monkeypatch.setattr(enroll_routes, "validate_uploaded_image_integrity", _report)


def _patch_validation_fail(monkeypatch: Any) -> None:
    def _report(image_bytes: bytes, file_name: str, angle: str) -> dict[str, object]:
        return {
            "file_name": file_name,
            "angle": angle,
            "passed": False,
            "blur_ok": True,
            "brightness_ok": True,
            "dimensions_ok": True,
            "face_detected": False,
            "face_centered": False,
            "eyes_visible": "failed",
            "failure_reasons": ["face_not_detected"],
            "blocker": "face_not_detected",
        }

    monkeypatch.setattr(enroll_routes, "validate_uploaded_image_integrity", _report)


def _enroll_then_validate(
    client: TestClient,
    monkeypatch: Any,
    student_id: str,
    *,
    image_by_angle: dict[str, bytes] | None = None,
) -> None:
    _patch_validation_pass(monkeypatch)

    enroll_response = client.post("/enroll", json=_basic_payload(student_id))
    assert enroll_response.status_code == 200, enroll_response.text
    assert enroll_response.json().get("success") is True

    metadata = _verification_metadata(student_id)
    verify_response = client.post(
        "/enroll/verification",
        files=(
            _verification_files_for_images(metadata, image_by_angle)
            if image_by_angle is not None
            else _verification_files(metadata)
        ),
    )
    assert verify_response.status_code == 200, verify_response.text
    assert verify_response.json().get("success") is True


def _approve(
    client: TestClient,
    student_id: str,
    token: str,
    *,
    expected_status: int = 200,
) -> dict[str, object]:
    response = client.post(
        f"/admin/enrollments/{student_id}/approve",
        headers=_auth_header(token),
    )
    assert response.status_code == expected_status, response.text
    return response.json()


def _process_stub(
    processed_count: int = 2,
) -> Callable[[str, object], dict[str, object]]:
    def _stub(student_id: str, storage: object) -> dict[str, object]:
        processed_crops = []
        for index in range(processed_count):
            angle = ALLOWED_ANGLES[index % len(ALLOWED_ANGLES)]
            processed_crops.append(
                {
                    "angle": angle,
                    "source_image": f"uploads/{student_id}/{angle}/{angle}_{index + 1}.jpg",
                    "crop_path": f"processed/{student_id}/{angle}/{angle}_{index + 1}_crop.jpg",
                    "embedding": [0.01] * 512,
                    "embedding_dim": 512,
                }
            )

        return {
            "student_id": student_id,
            "processing_passed": True,
            "processed_images_count": processed_count,
            "embeddings_generated_count": processed_count,
            "processed_crops": processed_crops,
            "failed_images": [],
            "failure_reasons": [],
        }

    return _stub


def test_enroll_verify_reject_reregister_flow(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1001"
    _enroll_then_validate(client, monkeypatch, student_id)

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "validated"
        assert enrollment.verification_completed is True

    reject_response = client.post(
        f"/admin/enrollments/{student_id}/reject",
        headers=_auth_header(auth_tokens["admin"]),
        json={"reason": "Image mismatch"},
    )
    assert reject_response.status_code == 200, reject_response.text
    reject_payload = reject_response.json()
    assert reject_payload.get("success") is True

    with db_session_factory() as db:
        assert _count(db, Student, Student.student_id == student_id) == 0
        assert _count(db, Enrollment, Enrollment.student_id == student_id) == 0
        assert _count(db, EnrollmentImage) == 0
        assert _count(db, FaceEmbedding) == 0

        audit_events = db.scalars(select(AuditLog.event_type)).all()
        assert "enrollment_rejected" in audit_events

    reregister = client.post("/enroll", json=_basic_payload(student_id))
    assert reregister.status_code == 200, reregister.text
    assert reregister.json().get("success") is True

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "pending"


def test_enroll_verify_approve_duplicate_blocked(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1002"
    _enroll_then_validate(client, monkeypatch, student_id)

    approve_payload = _approve(client, student_id, auth_tokens["admin"])
    assert approve_payload.get("success") is True

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "approved"

    duplicate_response = client.post("/enroll", json=_basic_payload(student_id))
    assert duplicate_response.status_code == 200, duplicate_response.text
    duplicate_payload = duplicate_response.json()
    assert duplicate_payload.get("success") is False
    assert "already registered" in str(duplicate_payload.get("message", "")).lower()

    with db_session_factory() as db:
        assert _count(db, Student, Student.student_id == student_id) == 1
        assert _count(db, Enrollment, Enrollment.student_id == student_id) == 1


def test_approve_process_keeps_status_and_recognition_eligible(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1003"
    _enroll_then_validate(client, monkeypatch, student_id)

    approve_payload = _approve(client, student_id, auth_tokens["admin"])
    assert approve_payload.get("success") is True

    monkeypatch.setattr(debug_routes, "process_student_images", _process_stub(processed_count=2))

    process_response = client.post(
        f"/debug/process/{student_id}",
        headers=_auth_header(auth_tokens["super_admin"]),
    )
    assert process_response.status_code == 200, process_response.text
    process_payload = process_response.json()
    assert process_payload.get("processing_passed") is True
    assert int(process_payload.get("embeddings_generated_count", 0)) == 2

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "approved"
        assert _count(db, FaceEmbedding, FaceEmbedding.student_id == student_id) == 2

    def _query_embedding(_image_bytes: bytes) -> list[float]:
        return [0.0] * 512

    def _search_embeddings(
        query_embedding: list[float],
        *,
        candidate_pool_limit: int,
    ) -> list[dict[str, object]]:
        assert len(query_embedding) == 512
        with db_session_factory() as db:
            rows = db.execute(
                select(FaceEmbedding, Enrollment)
                .join(Enrollment, Enrollment.student_id == FaceEmbedding.student_id)
                .where(
                    FaceEmbedding.is_active.is_(True),
                    Enrollment.status == "approved",
                )
                .order_by(FaceEmbedding.id.asc())
                .limit(candidate_pool_limit)
            ).all()

        return [
            {
                "embedding_id": embedding.id,
                "student_id": embedding.student_id,
                "enrollment_id": embedding.enrollment_id,
                "angle": embedding.angle,
                "source_image_path": embedding.source_image_path,
                "crop_path": embedding.crop_path,
                "distance": 0.01 + (index * 0.005),
            }
            for index, (embedding, _) in enumerate(rows)
        ]

    monkeypatch.setattr(face_matching_module, "generate_query_embedding", _query_embedding)
    monkeypatch.setattr(face_matching_module, "search_face_matches", _search_embeddings)

    match_response = client.post(
        "/admin/recognition/match",
        headers=_auth_header(auth_tokens["admin"]),
        files={"image": ("probe.jpg", b"probe-image", "image/jpeg")},
    )
    assert match_response.status_code == 200, match_response.text
    match_payload = match_response.json()
    assert match_payload.get("success") is True
    assert match_payload.get("match_found") is True

    candidates = match_payload.get("candidates", [])
    assert isinstance(candidates, list)
    assert len(candidates) >= 1
    assert candidates[0]["student_id"] == student_id
    assert candidates[0]["is_likely_match"] is True


def test_approved_processed_student_can_reset_and_reregister(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1004"
    _enroll_then_validate(client, monkeypatch, student_id)

    approve_payload = _approve(client, student_id, auth_tokens["admin"])
    assert approve_payload.get("success") is True

    monkeypatch.setattr(debug_routes, "process_student_images", _process_stub(processed_count=3))
    process_response = client.post(
        f"/debug/process/{student_id}",
        headers=_auth_header(auth_tokens["super_admin"]),
    )
    assert process_response.status_code == 200, process_response.text

    reset_response = client.post(
        f"/admin/enrollments/{student_id}/reset",
        headers=_auth_header(auth_tokens["super_admin"]),
    )
    assert reset_response.status_code == 200, reset_response.text
    reset_payload = reset_response.json()
    assert reset_payload.get("success") is True

    with db_session_factory() as db:
        assert _count(db, Student, Student.student_id == student_id) == 0
        assert _count(db, Enrollment, Enrollment.student_id == student_id) == 0
        assert _count(db, EnrollmentImage) == 0
        assert _count(db, FaceEmbedding, FaceEmbedding.student_id == student_id) == 0

        audit_events = db.scalars(select(AuditLog.event_type)).all()
        assert "enrollment_reset" in audit_events

    reregister_response = client.post("/enroll", json=_basic_payload(student_id))
    assert reregister_response.status_code == 200, reregister_response.text
    assert reregister_response.json().get("success") is True

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "pending"


def test_failed_verification_keeps_pending_consistent_state(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    storage_service: LocalStorageService,
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1005"

    enroll_response = client.post("/enroll", json=_basic_payload(student_id))
    assert enroll_response.status_code == 200, enroll_response.text
    assert enroll_response.json().get("success") is True

    _patch_validation_fail(monkeypatch)

    verify_response = client.post(
        "/enroll/verification",
        files=_verification_files(_verification_metadata(student_id)),
    )
    assert verify_response.status_code == 400, verify_response.text

    payload = verify_response.json()
    detail = payload.get("detail", {})
    assert detail.get("status") == "failed"

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        assert enrollment.status == "pending"
        assert enrollment.verification_completed is False
        assert enrollment.total_required_shots == 0
        assert enrollment.total_accepted_shots == 0

        assert _count(db, EnrollmentImage, EnrollmentImage.enrollment_id == enrollment.id) == 0

    uploads_dir = storage_service.resolve_relative_path(
        f"uploads/{storage_service.sanitize_student_id(student_id)}"
    )
    assert uploads_dir.exists() is False


def test_admin_queue_semantics_validated_only_and_state_targeting(
    client: TestClient,
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    pending_id = "930-26-1006"
    approve_id = "930-26-1007"
    reject_id = "930-26-1008"

    pending_response = client.post("/enroll", json=_basic_payload(pending_id))
    assert pending_response.status_code == 200, pending_response.text
    assert pending_response.json().get("success") is True

    _enroll_then_validate(client, monkeypatch, approve_id)
    _enroll_then_validate(client, monkeypatch, reject_id)

    snapshot_response = client.get("/debug/enrollments")
    assert snapshot_response.status_code == 200, snapshot_response.text
    rows = snapshot_response.json().get("enrollments", [])
    assert isinstance(rows, list)

    review_queue_ids = {row["student_id"] for row in rows if row.get("status") == "validated"}
    assert approve_id in review_queue_ids
    assert reject_id in review_queue_ids
    assert pending_id not in review_queue_ids

    approve_pending = _approve(
        client,
        pending_id,
        auth_tokens["admin"],
        expected_status=500,
    )
    assert approve_pending.get("success") is False
    assert "current status: pending" in str(approve_pending.get("message", "")).lower()

    reject_pending_response = client.post(
        f"/admin/enrollments/{pending_id}/reject",
        headers=_auth_header(auth_tokens["admin"]),
        json={"reason": "Not complete"},
    )
    assert reject_pending_response.status_code == 200, reject_pending_response.text
    reject_pending_payload = reject_pending_response.json()
    assert reject_pending_payload.get("success") is False
    assert "current status: pending" in str(
        reject_pending_payload.get("message", "")
    ).lower()

    approve_validated = _approve(client, approve_id, auth_tokens["admin"])
    assert approve_validated.get("success") is True

    reject_validated = client.post(
        f"/admin/enrollments/{reject_id}/reject",
        headers=_auth_header(auth_tokens["admin"]),
        json={"reason": "Rejected by review"},
    )
    assert reject_validated.status_code == 200, reject_validated.text
    assert reject_validated.json().get("success") is True


def test_approve_blocked_when_required_angle_missing(
    client: TestClient,
    db_session_factory: sessionmaker[Session],
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    student_id = "930-26-1101"
    _enroll_then_validate(client, monkeypatch, student_id)

    with db_session_factory() as db:
        enrollment = _latest_enrollment(db, student_id)
        assert enrollment is not None
        db.execute(
            delete(EnrollmentImage).where(
                EnrollmentImage.enrollment_id == enrollment.id,
                EnrollmentImage.angle == "up",
            )
        )
        db.commit()

    approve_payload = _approve(
        client,
        student_id,
        auth_tokens["admin"],
        expected_status=500,
    )
    assert approve_payload.get("success") is False
    assert approve_payload.get("message") == "required capture angles missing"


def test_approve_blocked_for_cross_student_byte_identical_images(
    client: TestClient,
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    source_id = "930-26-1102"
    target_id = "930-26-1103"
    shared_images = {
        angle: _build_image_bytes(student_id="shared-seed", angle=angle)
        for angle in ALLOWED_ANGLES
    }

    _enroll_then_validate(client, monkeypatch, source_id, image_by_angle=shared_images)
    _enroll_then_validate(client, monkeypatch, target_id, image_by_angle=shared_images)

    approve_payload = _approve(
        client,
        target_id,
        auth_tokens["admin"],
        expected_status=500,
    )
    assert approve_payload.get("success") is False
    assert approve_payload.get("message") == "duplicate enrollment evidence detected"


def test_approve_blocked_for_cross_student_near_duplicate_images(
    client: TestClient,
    auth_tokens: dict[str, str],
    monkeypatch: Any,
) -> None:
    source_id = "930-26-1104"
    target_id = "930-26-1105"
    source_images = {
        angle: _build_image_bytes(student_id="near-seed-source", angle=angle)
        for angle in ALLOWED_ANGLES
    }
    target_images = {
        angle: _build_near_duplicate_variant(source_images[angle])
        for angle in ALLOWED_ANGLES
    }
    for angle in ALLOWED_ANGLES:
        assert target_images[angle] != source_images[angle]

    _enroll_then_validate(client, monkeypatch, source_id, image_by_angle=source_images)
    _enroll_then_validate(client, monkeypatch, target_id, image_by_angle=target_images)

    approve_payload = _approve(
        client,
        target_id,
        auth_tokens["admin"],
        expected_status=500,
    )
    assert approve_payload.get("success") is False
    assert approve_payload.get("message") == "near-duplicate evidence detected"
