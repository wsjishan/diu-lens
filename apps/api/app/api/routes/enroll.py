import json
import logging
from collections import Counter
from datetime import datetime, timezone
from time import perf_counter
from typing import Literal, cast

from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, ValidationError

from app.core.enrollment_db import (
    EnrollmentNotFoundError,
    EnrollmentPersistenceError,
    EnrollmentRecordInput,
    persist_enrollment_to_db,
    persist_enrollment_verification_to_db,
    student_exists_in_db,
    StudentAlreadyRegisteredError,
)
from app.core.image_validation import (
    build_validation_summary,
    extract_image_quality_metadata,
    validate_uploaded_image_integrity,
)
from app.core.storage import (
    ALLOWED_ANGLES,
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_UPLOAD_IMAGE_SIZE_BYTES,
    REQUIRED_CAPTURE_ANGLES,
    empty_uploaded_images,
    save_uploaded_images,
)


MIN_IMAGES_PER_ANGLE = 2
MAX_IMAGES_PER_ANGLE = 5
REQUIRED_IMAGES_PER_ANGLE = 3
EXPECTED_REQUIRED_ANGLES: tuple[str, ...] = REQUIRED_CAPTURE_ANGLES
EXPECTED_TOTAL_SHOTS = len(EXPECTED_REQUIRED_ANGLES) * REQUIRED_IMAGES_PER_ANGLE
EYES_VISIBLE_VALUES: tuple[str, ...] = ("passed", "failed", "not_yet_implemented")
ENROLLMENT_STATUSES: tuple[str, ...] = (
    "pending",
    "uploaded",
    "validated",
    "failed",
    "processing",
    "processed",
    "approved",
    "rejected",
    "reset",
)
EnrollmentStatus = Literal[
    "pending",
    "uploaded",
    "validated",
    "failed",
    "processing",
    "processed",
    "approved",
    "rejected",
    "reset",
]


class AngleCaptureSummary(BaseModel):
    angle: str
    accepted_shots: int = Field(..., ge=0)
    required_shots: int = Field(..., ge=0)


class FrameMetadata(BaseModel):
    captured_at: int | None = Field(default=None, ge=0)


class AngleFrameMetadata(BaseModel):
    angle: str
    frames: list[FrameMetadata] = Field(default_factory=list)


class EnrollmentRequest(BaseModel):
    student_id: str
    full_name: str
    phone: str
    university_email: str = Field(
        ...,
        pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$",
        description="University email address",
    )
    verification_completed: bool = False
    total_required_shots: int = Field(default=0, ge=0)
    total_accepted_shots: int = Field(default=0, ge=0)
    angles: list[AngleCaptureSummary] = Field(default_factory=list)
    frame_metadata_by_angle: list[AngleFrameMetadata] = Field(default_factory=list)


class EnrollmentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter(tags=["enrollment"])
logger = logging.getLogger(__name__)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"message": message})


def _parse_enrollment_payload(raw_payload: object) -> EnrollmentRequest:
    try:
        return EnrollmentRequest.model_validate(raw_payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def _parse_multipart_metadata(metadata_value: object) -> EnrollmentRequest:
    if not isinstance(metadata_value, str) or not metadata_value.strip():
        raise _bad_request("Missing metadata field in multipart request.")

    try:
        metadata_object = json.loads(metadata_value)
    except json.JSONDecodeError as exc:
        raise _bad_request("Invalid metadata JSON.") from exc

    return _parse_enrollment_payload(metadata_object)


def _extract_multipart_files(
    form_data: object,
) -> dict[str, list[UploadFile]]:
    if not hasattr(form_data, "keys") or not hasattr(form_data, "getlist"):
        raise _bad_request("Invalid multipart form data.")

    files_by_angle: dict[str, list[UploadFile]] = {
        angle: [] for angle in EXPECTED_REQUIRED_ANGLES
    }

    for key in form_data.keys():
        if key == "metadata":
            continue

        form_items = form_data.getlist(key)
        angle_files = [
            cast(UploadFile, item)
            for item in form_items
            if hasattr(item, "filename") and hasattr(item, "read")
        ]

        if not angle_files:
            continue

        if key not in EXPECTED_REQUIRED_ANGLES:
            raise _bad_request(f"Unsupported angle field in files: {key}")

        files_by_angle[key].extend(angle_files)

    if not any(files_by_angle.values()):
        raise _bad_request("No verification image files were provided.")

    return files_by_angle


def _validate_final_multipart_metadata(payload: EnrollmentRequest) -> None:
    if not payload.verification_completed:
        raise _bad_request(
            "verification_completed must be true for final multipart enrollment"
        )

    if payload.total_required_shots != EXPECTED_TOTAL_SHOTS:
        raise _bad_request(
            f"total_required_shots must be exactly {EXPECTED_TOTAL_SHOTS}"
        )

    angle_names = [summary.angle for summary in payload.angles]
    duplicate_angles = sorted(
        angle for angle, count in Counter(angle_names).items() if count > 1
    )
    if duplicate_angles:
        joined = ", ".join(duplicate_angles)
        raise _bad_request(f"Duplicate angle summaries are not allowed: {joined}")

    provided_angles = set(angle_names)
    required_angles = set(EXPECTED_REQUIRED_ANGLES)

    missing_angles = sorted(required_angles - provided_angles)
    if missing_angles:
        raise _bad_request(f"Missing angle: {missing_angles[0]}")

    extra_angles = sorted(provided_angles - required_angles)
    if extra_angles:
        raise _bad_request(f"Unknown angle in metadata: {extra_angles[0]}")

    if len(payload.angles) != len(EXPECTED_REQUIRED_ANGLES):
        raise _bad_request(
            f"Metadata must include exactly {len(EXPECTED_REQUIRED_ANGLES)} angle summaries."
        )

    for summary in payload.angles:
        if summary.required_shots != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(
                f"Invalid required_shots for angle: {summary.angle}. "
                f"Expected {REQUIRED_IMAGES_PER_ANGLE}."
            )
        if summary.accepted_shots != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(
                f"Invalid accepted_shots for angle: {summary.angle}. "
                f"Expected {REQUIRED_IMAGES_PER_ANGLE}."
            )


def _validate_file_counts(
    files_by_angle: dict[str, list[UploadFile]],
    payload: EnrollmentRequest,
) -> None:
    expected_by_angle = {
        summary.angle: int(summary.accepted_shots) for summary in payload.angles
    }
    expected_angles = set(expected_by_angle)
    for angle in EXPECTED_REQUIRED_ANGLES:
        if angle not in expected_angles:
            raise _bad_request(f"Missing required angle metadata: {angle}")

    uploaded_angles = {angle for angle, files in files_by_angle.items() if files}
    if uploaded_angles != set(EXPECTED_REQUIRED_ANGLES):
        missing_upload_angles = sorted(set(EXPECTED_REQUIRED_ANGLES) - uploaded_angles)
        if missing_upload_angles:
            raise _bad_request(f"Missing angle: {missing_upload_angles[0]}")
        unknown_upload_angles = sorted(uploaded_angles - set(EXPECTED_REQUIRED_ANGLES))
        if unknown_upload_angles:
            raise _bad_request(f"Unknown angle in upload files: {unknown_upload_angles[0]}")

    for angle, expected_count in expected_by_angle.items():
        file_count = len(files_by_angle.get(str(angle), []))
        if file_count != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(f"Invalid image count for angle: {angle}")
        if file_count != expected_count:
            raise _bad_request(
                f"Metadata/upload count mismatch for angle {angle}: "
                f"metadata={expected_count}, uploaded={file_count}"
            )

    actual_uploaded_count = sum(len(files_by_angle.get(angle, [])) for angle in EXPECTED_REQUIRED_ANGLES)
    if payload.total_accepted_shots != actual_uploaded_count:
        raise _bad_request(
            "total_accepted_shots does not match uploaded image count."
        )


def _capture_timestamps_by_angle(
    payload: EnrollmentRequest,
) -> dict[str, list[int | None]]:
    mapping: dict[str, list[int | None]] = {
        angle: [] for angle in EXPECTED_REQUIRED_ANGLES
    }
    for entry in payload.frame_metadata_by_angle:
        angle = str(entry.angle)
        if angle not in mapping:
            continue
        mapping[angle] = [frame.captured_at for frame in entry.frames]
    return mapping


def _build_frame_metadata_by_path(
    uploaded_images: dict[str, list[str]],
    validation_summary: dict[str, object],
) -> dict[str, dict[str, object]]:
    metadata_by_path: dict[str, dict[str, object]] = {}
    quality_by_angle_raw = validation_summary.get("quality_by_angle", {})
    quality_by_angle = (
        quality_by_angle_raw
        if isinstance(quality_by_angle_raw, dict)
        else {}
    )

    for angle in ALLOWED_ANGLES:
        paths = uploaded_images.get(angle, [])
        quality_rows_raw = quality_by_angle.get(angle, [])
        quality_rows = quality_rows_raw if isinstance(quality_rows_raw, list) else []

        for index, path in enumerate(paths):
            quality = quality_rows[index] if index < len(quality_rows) else {}
            if not isinstance(quality, dict):
                quality = {}
            metadata_by_path[str(path)] = {
                "captured_at": quality.get("captured_at"),
                "blur_score": quality.get("blur_score"),
                "brightness": quality.get("brightness"),
                "face_area_ratio": quality.get("face_area_ratio"),
                "center_offset": quality.get("center_offset"),
                "detection_confidence": quality.get("detection_confidence"),
            }

    return metadata_by_path


def _extract_sanity_failure_details(
    image_reports: list[dict[str, object]],
) -> list[dict[str, object]]:
    details: list[dict[str, object]] = []

    for report in image_reports:
        if bool(report.get("passed", False)):
            continue

        failure_reasons_raw = report.get("failure_reasons", [])
        failure_reasons = (
            [str(reason) for reason in failure_reasons_raw]
            if isinstance(failure_reasons_raw, list)
            else []
        )
        reason = failure_reasons[0] if failure_reasons else str(report.get("blocker", "unknown"))

        details.append(
            {
                "angle": str(report.get("angle", "unknown")),
                "file_name": str(report.get("file_name", "unknown")),
                "reason": reason,
                "error_code": reason.split("(", 1)[0].strip() or "unknown",
                "image_size_bytes": int(report.get("image_size_bytes", 0) or 0),
                "decoded_shape": report.get("decoded_shape"),
            }
        )

    return details


def _dimensions_from_report(report: dict[str, object]) -> str:
    dimensions = report.get("dimensions")
    if isinstance(dimensions, str) and dimensions.strip():
        return dimensions
    decoded_shape = report.get("decoded_shape")
    if isinstance(decoded_shape, list) and len(decoded_shape) >= 2:
        try:
            height = int(decoded_shape[0])
            width = int(decoded_shape[1])
            return f"{width}x{height}"
        except (TypeError, ValueError):
            return "unknown"
    return "unknown"


async def _validate_files(
    files_by_angle: dict[str, list[UploadFile]],
    capture_timestamps_by_angle: dict[str, list[int | None]],
) -> dict[str, object]:
    image_reports: list[dict[str, object]] = []
    total_uploaded_bytes = 0
    quality_by_angle: dict[str, list[dict[str, object]]] = {
        angle: [] for angle in EXPECTED_REQUIRED_ANGLES
    }

    for angle in EXPECTED_REQUIRED_ANGLES:
        for index, upload in enumerate(files_by_angle.get(angle, [])):
            content_type = (upload.content_type or "").lower()
            if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
                raise _bad_request(f"Unsupported file type for angle: {angle}")

            sample = await upload.read(MAX_UPLOAD_IMAGE_SIZE_BYTES + 1)
            await upload.seek(0)

            if not sample:
                raise _bad_request(f"Uploaded file is empty for angle: {angle}")

            if len(sample) > MAX_UPLOAD_IMAGE_SIZE_BYTES:
                raise _bad_request(f"File too large for angle: {angle}")
            total_uploaded_bytes += len(sample)

            file_name = upload.filename or "unknown"
            image_report = validate_uploaded_image_integrity(
                image_bytes=sample,
                file_name=file_name,
                angle=angle,
            )
            quality = extract_image_quality_metadata(sample)
            captured_at_rows = capture_timestamps_by_angle.get(angle, [])
            captured_at = (
                captured_at_rows[index]
                if index < len(captured_at_rows)
                else None
            )
            quality_by_angle[angle].append(
                {
                    "file_name": file_name,
                    "captured_at": captured_at,
                    "blur_score": quality.get("blur_score"),
                    "brightness": quality.get("brightness"),
                    "face_area_ratio": quality.get("face_area_ratio"),
                    "center_offset": quality.get("center_offset"),
                    "detection_confidence": quality.get("detection_confidence"),
                }
            )
            blocking_reasons = image_report.get("blocking_reasons", [])
            non_blocking_reasons = image_report.get("non_blocking_reasons", [])
            if not isinstance(blocking_reasons, list):
                blocking_reasons = []
            if not isinstance(non_blocking_reasons, list):
                non_blocking_reasons = []
            is_blocking = bool(image_report.get("is_blocking_failure", False))
            logger.info(
                "[guided-sanity] route_review angle=%s file=%s readable=%s dimensions=%s "
                "face_detected=%s blocking=%s blocking_reasons=%s non_blocking_reasons=%s "
                "final_decision=%s bytes=%s",
                angle,
                file_name,
                bool(image_report.get("readable", False)),
                _dimensions_from_report(image_report),
                bool(image_report.get("face_detected", False)),
                is_blocking,
                blocking_reasons,
                non_blocking_reasons,
                image_report.get("final_decision", "reject"),
                len(sample),
            )
            if is_blocking:
                logger.warning(
                    "[guided-sanity] route_blocked angle=%s file=%s reason=%s",
                    angle,
                    file_name,
                    image_report.get("blocker", "unknown"),
                )
            image_reports.append(image_report)

    summary = build_validation_summary(image_reports)
    logger.info(
        "[guided-sanity] summary total=%s passed=%s failed=%s",
        summary.get("total_images_checked"),
        summary.get("total_images_passed"),
        summary.get("failed_images_count"),
    )
    summary["total_uploaded_bytes"] = total_uploaded_bytes
    summary["quality_by_angle"] = quality_by_angle
    if not summary["validation_passed"]:
        failure_details = _extract_sanity_failure_details(image_reports)
        logger.warning(
            "[guided-sanity] validation_failed details=%s",
            failure_details,
        )
        specific_message = "Image validation failed."
        if failure_details:
            first_failure = failure_details[0]
            reason = str(first_failure.get("reason", "unknown"))
            angle = str(first_failure.get("angle", "unknown"))
            if reason.startswith("invalid_image_data"):
                specific_message = f"Corrupted image for angle: {angle}"
            elif reason.startswith("image_too_small"):
                specific_message = f"Image too small for angle: {angle}"
            elif reason.startswith("missing_image_data"):
                specific_message = f"Uploaded file is empty for angle: {angle}"
            else:
                specific_message = f"Image validation failed for angle: {angle}"
        raise HTTPException(
            status_code=400,
            detail={
                "error": "sanity_failed",
                "status": "failed",
                "message": specific_message,
                "details": failure_details,
                "validation": summary,
            },
        )

    return summary


async def _close_upload_files(files_by_angle: dict[str, list[UploadFile]]) -> None:
    for angle_files in files_by_angle.values():
        for upload in angle_files:
            await upload.close()


def _default_validation_summary() -> dict[str, object]:
    return {
        "validation_passed": False,
        "total_images_checked": 0,
        "total_images_passed": 0,
        "failed_images_count": 0,
        "image_reports": [],
        "quality_by_angle": {angle: [] for angle in ALLOWED_ANGLES},
    }


def _normalize_angle_summaries(
    angles: list[AngleCaptureSummary],
) -> list[dict[str, object]]:
    by_angle: dict[str, dict[str, object]] = {
        angle: {
            "angle": angle,
            "accepted_shots": 0,
            "required_shots": 0,
        }
        for angle in ALLOWED_ANGLES
    }

    for angle_summary in angles:
        if angle_summary.angle not in by_angle:
            continue
        by_angle[angle_summary.angle] = {
            "angle": angle_summary.angle,
            "accepted_shots": int(angle_summary.accepted_shots),
            "required_shots": int(angle_summary.required_shots),
        }

    return [by_angle[angle] for angle in ALLOWED_ANGLES]


def _normalize_uploaded_images(
    uploaded_images: dict[str, list[str]],
) -> dict[str, list[str]]:
    normalized = empty_uploaded_images()
    for angle in ALLOWED_ANGLES:
        normalized[angle] = list(uploaded_images.get(angle, []))
    return normalized


def _normalize_validation_summary(
    validation_summary: dict[str, object],
) -> dict[str, object]:
    image_reports_input = validation_summary.get("image_reports", [])
    image_reports: list[dict[str, object]] = []

    if isinstance(image_reports_input, list):
        for report in image_reports_input:
            if not isinstance(report, dict):
                continue

            eyes_visible = str(report.get("eyes_visible", "not_yet_implemented"))
            if eyes_visible not in EYES_VISIBLE_VALUES:
                eyes_visible = "not_yet_implemented"

            failure_reasons_raw = report.get("failure_reasons", [])
            failure_reasons = (
                [str(reason) for reason in failure_reasons_raw]
                if isinstance(failure_reasons_raw, list)
                else []
            )

            image_reports.append(
                {
                    "file_name": str(report.get("file_name", "unknown")),
                    "angle": str(report.get("angle", "unknown")),
                    "passed": bool(report.get("passed", False)),
                    "blocker": str(report.get("blocker", "unknown")),
                    "image_size_bytes": int(report.get("image_size_bytes", 0) or 0),
                    "decoded_shape": report.get("decoded_shape"),
                    "blur_ok": bool(report.get("blur_ok", False)),
                    "brightness_ok": bool(report.get("brightness_ok", False)),
                    "dimensions_ok": bool(report.get("dimensions_ok", False)),
                    "face_detected": bool(report.get("face_detected", False)),
                    "face_centered": bool(report.get("face_centered", False)),
                    "eyes_visible": eyes_visible,
                    "failure_reasons": failure_reasons,
                }
            )

    total_images_checked = len(image_reports)
    total_images_passed = sum(1 for report in image_reports if bool(report["passed"]))
    failed_images_count = total_images_checked - total_images_passed
    validation_passed = bool(validation_summary.get("validation_passed", True))
    if total_images_checked > 0:
        validation_passed = failed_images_count == 0

    return {
        "validation_passed": validation_passed,
        "total_images_checked": total_images_checked,
        "total_images_passed": total_images_passed,
        "failed_images_count": failed_images_count,
        "image_reports": image_reports,
    }


def _resolve_enrollment_status(
    payload: EnrollmentRequest,
    validation_summary: dict[str, object],
) -> EnrollmentStatus:
    if (
        payload.verification_completed
        and bool(validation_summary.get("validation_passed"))
        and int(validation_summary.get("total_images_checked", 0)) > 0
    ):
        return "validated"

    return "uploaded"


def _build_enrollment_entry(
    payload: EnrollmentRequest,
    uploaded_images: dict[str, list[str]],
    validation_summary: dict[str, object],
    frame_metadata_by_path: dict[str, dict[str, object]],
    *,
    status_override: EnrollmentStatus | None = None,
) -> dict[str, object]:
    normalized_validation = _normalize_validation_summary(validation_summary)
    normalized_uploaded_images = _normalize_uploaded_images(uploaded_images)
    normalized_angles = _normalize_angle_summaries(payload.angles)
    status = status_override or _resolve_enrollment_status(payload, normalized_validation)
    if status not in ENROLLMENT_STATUSES:
        status = "uploaded"
    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "student_id": payload.student_id,
        "full_name": payload.full_name,
        "phone": payload.phone,
        "university_email": payload.university_email,
        "status": status,
        "verification_completed": payload.verification_completed,
        "total_required_shots": payload.total_required_shots,
        "total_accepted_shots": payload.total_accepted_shots,
        "angles": normalized_angles,
        "uploaded_images": normalized_uploaded_images,
        "frame_metadata_by_path": frame_metadata_by_path,
        "validation": normalized_validation,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


def _persist_enrollment_metadata(
    entry: dict[str, object],
    *,
    mode: str,
    event_type: str,
    event_message: str,
    update_existing: bool = False,
) -> None:
    validation = entry.get("validation", {})
    uploaded_images = entry.get("uploaded_images", {})
    frame_metadata_raw = entry.get("frame_metadata_by_path", {})
    if not isinstance(validation, dict):
        validation = {}
    if not isinstance(uploaded_images, dict):
        uploaded_images = empty_uploaded_images()
    if not isinstance(frame_metadata_raw, dict):
        frame_metadata_raw = {}

    try:
        payload = EnrollmentRecordInput(
            student_id=str(entry.get("student_id", "")),
            full_name=str(entry.get("full_name", "")),
            phone=str(entry.get("phone", "")),
            university_email=str(entry.get("university_email", "")),
            status=str(entry.get("status", "uploaded")),
            verification_completed=bool(entry.get("verification_completed", False)),
            total_required_shots=int(entry.get("total_required_shots", 0)),
            total_accepted_shots=int(entry.get("total_accepted_shots", 0)),
            validation_passed=bool(validation.get("validation_passed", False)),
            uploaded_images={
                angle: [str(path) for path in uploaded_images.get(angle, [])]
                if isinstance(uploaded_images.get(angle, []), list)
                else []
                for angle in ALLOWED_ANGLES
            },
            frame_metadata_by_path={
                str(path): (
                    metadata if isinstance(metadata, dict) else {}
                )
                for path, metadata in frame_metadata_raw.items()
            },
            event_type=event_type,
            event_message=event_message,
            mode=mode,
        )

        if update_existing:
            persist_enrollment_verification_to_db(payload)
        else:
            persist_enrollment_to_db(payload)
    except StudentAlreadyRegisteredError:
        raise
    except RuntimeError as exc:
        raise EnrollmentPersistenceError(str(exc)) from exc


def _extract_failed_validation_summary(exc: HTTPException) -> dict[str, object]:
    detail = exc.detail
    if isinstance(detail, dict):
        validation = detail.get("validation")
        if isinstance(validation, dict):
            return validation
    return {
        "validation_passed": False,
        "total_images_checked": 0,
        "total_images_passed": 0,
        "failed_images_count": 1,
        "image_reports": [],
    }


def _total_uploaded_bytes_from_validation_summary(
    validation_summary: dict[str, object],
) -> int:
    explicit_total = validation_summary.get("total_uploaded_bytes")
    if explicit_total is not None:
        try:
            return int(explicit_total)
        except (TypeError, ValueError):
            pass

    image_reports = validation_summary.get("image_reports")
    if not isinstance(image_reports, list):
        return 0

    total_bytes = 0
    for report in image_reports:
        if not isinstance(report, dict):
            continue
        total_bytes += int(report.get("image_size_bytes", 0) or 0)
    return total_bytes


async def _handle_json_enrollment(
    request: Request,
) -> tuple[EnrollmentRequest, dict[str, list[str]], dict[str, object]]:
    try:
        raw_payload = await request.json()
    except json.JSONDecodeError as exc:
        raise _bad_request("Invalid JSON body.") from exc

    payload = _parse_enrollment_payload(raw_payload)
    return payload, empty_uploaded_images(), _default_validation_summary()


async def _handle_multipart_enrollment(
    request: Request,
) -> tuple[EnrollmentRequest, dict[str, list[str]], dict[str, object], dict[str, float]]:
    multipart_started_at = perf_counter()
    form_data = await request.form()
    after_form_parse_at = perf_counter()
    payload = _parse_multipart_metadata(form_data.get("metadata"))
    after_metadata_parse_at = perf_counter()

    files_by_angle = _extract_multipart_files(form_data)
    capture_timestamps_by_angle = _capture_timestamps_by_angle(payload)
    after_file_access_at = perf_counter()
    logger.info(
        "[verification-timing] metadata parsed ms=%s",
        round((after_metadata_parse_at - after_form_parse_at) * 1000, 2),
    )
    logger.info(
        "[verification-timing] form parsing / file access complete ms=%s",
        round((after_file_access_at - multipart_started_at) * 1000, 2),
    )
    validation_summary = _default_validation_summary()
    uploaded_images = empty_uploaded_images()
    after_validation_at = after_file_access_at
    after_file_save_at = after_file_access_at

    try:
        _validate_final_multipart_metadata(payload)
        _validate_file_counts(files_by_angle, payload)
        validation_summary = await _validate_files(
            files_by_angle,
            capture_timestamps_by_angle,
        )
        after_validation_at = perf_counter()
        logger.info(
            "[verification-timing] integrity validation complete ms=%s",
            round((after_validation_at - after_file_access_at) * 1000, 2),
        )
    except HTTPException as exc:
        await _close_upload_files(files_by_angle)
        failed_validation = _extract_failed_validation_summary(exc)
        failed_payload = payload.model_copy(
            update={
                "verification_completed": False,
                "total_required_shots": 0,
                "total_accepted_shots": 0,
                "angles": [],
            }
        )
        failed_entry = _build_enrollment_entry(
            payload=failed_payload,
            uploaded_images=uploaded_images,
            validation_summary=failed_validation,
            frame_metadata_by_path={},
            status_override="pending",
        )
        try:
            _persist_enrollment_metadata(
                failed_entry,
                mode="final",
                event_type="enrollment_failed",
                event_message=(
                    f"Final enrollment validation failed for student_id={payload.student_id}"
                ),
                update_existing=True,
            )
        except (OSError, EnrollmentPersistenceError):
            # Validation response should still be returned even if persistence fallback fails.
            pass
        raise exc

    try:
        uploaded_images = await save_uploaded_images(
            payload.student_id,
            files_by_angle,
        )
        after_file_save_at = perf_counter()
        logger.info(
            "[verification-timing] file save complete ms=%s",
            round((after_file_save_at - after_validation_at) * 1000, 2),
        )
    except ValueError as exc:
        raise _bad_request(str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded verification images.",
        ) from exc

    return (
        payload,
        uploaded_images,
        validation_summary,
        {
            "form_parse_file_access_ms": round(
                (after_file_access_at - multipart_started_at) * 1000, 2
            ),
            "metadata_parse_ms": round(
                (after_metadata_parse_at - after_form_parse_at) * 1000, 2
            ),
            "integrity_validation_ms": round(
                (after_validation_at - after_file_access_at) * 1000, 2
            ),
            "save_files_ms": round((after_file_save_at - after_validation_at) * 1000, 2),
            "multipart_total_ms": round(
                (after_file_save_at - multipart_started_at) * 1000, 2
            ),
        },
    )


@router.post("/enroll", response_model=EnrollmentResponse)
async def enroll(request: Request) -> EnrollmentResponse:
    content_type = request.headers.get("content-type", "").lower()
    if "application/json" not in content_type:
        raise HTTPException(
            status_code=415,
            detail={"message": "Unsupported content type for /enroll. Use JSON."},
        )

    mode = "basic"
    event_type = "basic_info_uploaded"
    event_message = "Basic enrollment info submitted."
    payload, uploaded_images, validation_summary = await _handle_json_enrollment(request)

    try:
        if student_exists_in_db(payload.student_id):
            return EnrollmentResponse(
                success=False,
                message="You are already registered",
            )
    except EnrollmentPersistenceError:
        pass

    entry = _build_enrollment_entry(
        payload=payload,
        uploaded_images=uploaded_images,
        validation_summary=validation_summary,
        frame_metadata_by_path={},
        status_override="pending" if mode == "basic" else None,
    )

    try:
        _persist_enrollment_metadata(
            entry,
            mode=mode,
            event_type=event_type,
            event_message=event_message,
        )
    except StudentAlreadyRegisteredError:
        return EnrollmentResponse(
            success=False,
            message="You are already registered",
        )
    except (OSError, EnrollmentPersistenceError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save enrollment metadata.",
        ) from exc

    return EnrollmentResponse(
        success=True,
        message="Enrollment saved successfully",
    )


@router.post("/enroll/verification", response_model=EnrollmentResponse)
async def enroll_verification(request: Request) -> EnrollmentResponse:
    request_started_at = perf_counter()
    total_uploaded_bytes = 0
    logger.info("[verification-timing] route entered")
    logger.info("[verification] request start path=/enroll/verification")
    try:
        content_type = request.headers.get("content-type", "").lower()
        if "multipart/form-data" not in content_type:
            raise HTTPException(
                status_code=415,
                detail={"message": "Unsupported content type for /enroll/verification. Use multipart form data."},
            )

        try:
            (
                payload,
                uploaded_images,
                validation_summary,
                multipart_timing,
            ) = await _handle_multipart_enrollment(
                request
            )
            total_uploaded_bytes = _total_uploaded_bytes_from_validation_summary(
                validation_summary
            )
            logger.info(
                "[verification] uploaded bytes=%s student_id=%s",
                total_uploaded_bytes,
                payload.student_id,
            )
            logger.info(
                "[verification-timing] multipart breakdown form_parse_file_access_ms=%s metadata_parse_ms=%s integrity_validation_ms=%s save_files_ms=%s multipart_total_ms=%s",
                multipart_timing.get("form_parse_file_access_ms", 0.0),
                multipart_timing.get("metadata_parse_ms", 0.0),
                multipart_timing.get("integrity_validation_ms", 0.0),
                multipart_timing.get("save_files_ms", 0.0),
                multipart_timing.get("multipart_total_ms", 0.0),
            )
        except HTTPException as exc:
            failed_validation = _extract_failed_validation_summary(exc)
            total_uploaded_bytes = _total_uploaded_bytes_from_validation_summary(
                failed_validation
            )
            logger.info("[verification] uploaded bytes=%s", total_uploaded_bytes)
            logger.warning(
                "[verification] request failed detail=%s",
                exc.detail,
            )
            raise

        entry = _build_enrollment_entry(
            payload=payload,
            uploaded_images=uploaded_images,
            validation_summary=validation_summary,
            frame_metadata_by_path=_build_frame_metadata_by_path(
                uploaded_images,
                validation_summary,
            ),
        )

        try:
            _persist_enrollment_metadata(
                entry,
                mode="final",
                event_type="enrollment_validated",
                event_message="Final enrollment submitted with validated images.",
                update_existing=True,
            )
        except EnrollmentNotFoundError:
            logger.warning(
                "[verification] no pending enrollment found for student_id=%s",
                payload.student_id,
            )
            return EnrollmentResponse(
                success=False,
                message="No pending enrollment found. Submit basic info first.",
            )
        except (OSError, EnrollmentPersistenceError) as exc:
            logger.exception(
                "[verification] failed to persist enrollment verification for student_id=%s",
                payload.student_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to save enrollment metadata.",
            ) from exc
        logger.info("[verification-timing] DB persistence complete")

        logger.info("[verification] verification completed for student_id=%s", payload.student_id)
        logger.info("[verification-timing] response returned")
        return EnrollmentResponse(
            success=True,
            message="Verification images uploaded successfully",
        )
    finally:
        elapsed_ms = round((perf_counter() - request_started_at) * 1000, 2)
        logger.info("[verification-timing] total route ms=%s", elapsed_ms)
        logger.info(
            "[verification] route elapsed_ms=%s total_uploaded_bytes=%s",
            elapsed_ms,
            total_uploaded_bytes,
        )
