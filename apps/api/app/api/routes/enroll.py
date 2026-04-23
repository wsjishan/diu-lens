import json
import logging
from collections import Counter
from datetime import datetime, timezone
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
    validate_uploaded_image_integrity,
)
from app.core.storage import (
    ALLOWED_ANGLES,
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_UPLOAD_IMAGE_SIZE_BYTES,
    empty_uploaded_images,
    save_uploaded_images,
)


REQUIRED_IMAGES_PER_ANGLE = 1
REQUIRED_TOTAL_SHOTS = 5
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

    files_by_angle: dict[str, list[UploadFile]] = {angle: [] for angle in ALLOWED_ANGLES}

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

        if key not in ALLOWED_ANGLES:
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

    if payload.total_required_shots != REQUIRED_TOTAL_SHOTS:
        raise _bad_request(
            f"total_required_shots must equal {REQUIRED_TOTAL_SHOTS}"
        )

    if payload.total_accepted_shots != REQUIRED_TOTAL_SHOTS:
        raise _bad_request(
            f"total_accepted_shots must equal {REQUIRED_TOTAL_SHOTS}"
        )

    angle_names = [summary.angle for summary in payload.angles]
    duplicate_angles = sorted(
        angle for angle, count in Counter(angle_names).items() if count > 1
    )
    if duplicate_angles:
        joined = ", ".join(duplicate_angles)
        raise _bad_request(f"Duplicate angle summaries are not allowed: {joined}")

    provided_angles = set(angle_names)
    required_angles = set(ALLOWED_ANGLES)

    missing_angles = sorted(required_angles - provided_angles)
    if missing_angles:
        joined = ", ".join(missing_angles)
        raise _bad_request(f"Missing required angles: {joined}")

    extra_angles = sorted(provided_angles - required_angles)
    if extra_angles:
        joined = ", ".join(extra_angles)
        raise _bad_request(f"Unexpected angles in metadata: {joined}")

    if len(payload.angles) != len(ALLOWED_ANGLES):
        raise _bad_request(
            f"Exactly {len(ALLOWED_ANGLES)} angle summaries are required"
        )

    for summary in payload.angles:
        if summary.required_shots != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(
                f"required_shots must be {REQUIRED_IMAGES_PER_ANGLE} for angle: {summary.angle}"
            )
        if summary.accepted_shots != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(
                f"accepted_shots must be {REQUIRED_IMAGES_PER_ANGLE} for angle: {summary.angle}"
            )


def _validate_file_counts(files_by_angle: dict[str, list[UploadFile]]) -> None:
    for angle in ALLOWED_ANGLES:
        file_count = len(files_by_angle.get(angle, []))
        if file_count != REQUIRED_IMAGES_PER_ANGLE:
            raise _bad_request(
                f"Exactly {REQUIRED_IMAGES_PER_ANGLE} images are required for angle: {angle}"
            )


async def _validate_files(files_by_angle: dict[str, list[UploadFile]]) -> dict[str, object]:
    image_reports: list[dict[str, object]] = []

    for angle in ALLOWED_ANGLES:
        for upload in files_by_angle.get(angle, []):
            content_type = (upload.content_type or "").lower()
            if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
                raise _bad_request(f"Unsupported file type for angle: {angle}")

            sample = await upload.read(MAX_UPLOAD_IMAGE_SIZE_BYTES + 1)
            await upload.seek(0)

            if not sample:
                raise _bad_request(f"Uploaded file is empty for angle: {angle}")

            if len(sample) > MAX_UPLOAD_IMAGE_SIZE_BYTES:
                raise _bad_request(f"File too large for angle: {angle}")

            file_name = upload.filename or "unknown"
            image_report = validate_uploaded_image_integrity(
                image_bytes=sample,
                file_name=file_name,
                angle=angle,
            )
            logger.info(
                "[review] angle=%s dimensionsOk=%s valid=%s",
                angle,
                image_report.get("dimensions_ok"),
                image_report.get("passed"),
            )
            if not bool(image_report.get("passed")):
                logger.info(
                    "[review] blocker=%s angle=%s",
                    image_report.get("blocker", "unknown"),
                    angle,
                )
            image_reports.append(image_report)

    summary = build_validation_summary(image_reports)
    logger.info(
        "[verification] image validation summary total=%s passed=%s failed=%s",
        summary.get("total_images_checked"),
        summary.get("total_images_passed"),
        summary.get("failed_images_count"),
    )
    if not summary["validation_passed"]:
        logger.warning(
            "[verification] image quality validation failed details=%s",
            summary.get("image_reports", []),
        )
        raise HTTPException(
            status_code=400,
            detail={
                "status": "failed",
                "message": "Image integrity validation failed for uploaded enrollment images.",
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
        "validation_passed": True,
        "total_images_checked": 0,
        "total_images_passed": 0,
        "failed_images_count": 0,
        "image_reports": [],
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
    if not isinstance(validation, dict):
        validation = {}
    if not isinstance(uploaded_images, dict):
        uploaded_images = empty_uploaded_images()

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
    return _default_validation_summary()


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
) -> tuple[EnrollmentRequest, dict[str, list[str]], dict[str, object]]:
    form_data = await request.form()
    payload = _parse_multipart_metadata(form_data.get("metadata"))

    files_by_angle = _extract_multipart_files(form_data)
    validation_summary = _default_validation_summary()
    uploaded_images = empty_uploaded_images()

    try:
        _validate_final_multipart_metadata(payload)
        _validate_file_counts(files_by_angle)
        validation_summary = await _validate_files(files_by_angle)
    except HTTPException as exc:
        await _close_upload_files(files_by_angle)
        failed_validation = _extract_failed_validation_summary(exc)
        failed_entry = _build_enrollment_entry(
            payload=payload,
            uploaded_images=uploaded_images,
            validation_summary=failed_validation,
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
    except ValueError as exc:
        raise _bad_request(str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded verification images.",
        ) from exc

    return payload, uploaded_images, validation_summary


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
    logger.info("[verification] enroll/verification request received")
    content_type = request.headers.get("content-type", "").lower()
    if "multipart/form-data" not in content_type:
        raise HTTPException(
            status_code=415,
            detail={"message": "Unsupported content type for /enroll/verification. Use multipart form data."},
        )

    payload, uploaded_images, validation_summary = await _handle_multipart_enrollment(
        request
    )
    entry = _build_enrollment_entry(
        payload=payload,
        uploaded_images=uploaded_images,
        validation_summary=validation_summary,
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

    logger.info("[verification] verification completed for student_id=%s", payload.student_id)
    return EnrollmentResponse(
        success=True,
        message="Verification images uploaded successfully",
    )
