import json
from collections import Counter
from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, ValidationError

from app.core.storage import (
    ALLOWED_ANGLES,
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_UPLOAD_IMAGE_SIZE_BYTES,
    append_enrollment,
    empty_uploaded_images,
    save_uploaded_images,
)


REQUIRED_IMAGES_PER_ANGLE = 3
REQUIRED_TOTAL_SHOTS = 15


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


async def _validate_files(files_by_angle: dict[str, list[UploadFile]]) -> None:
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


async def _close_upload_files(files_by_angle: dict[str, list[UploadFile]]) -> None:
    for angle_files in files_by_angle.values():
        for upload in angle_files:
            await upload.close()


@router.post("/enroll", response_model=EnrollmentResponse)
async def enroll(request: Request) -> EnrollmentResponse:
    content_type = request.headers.get("content-type", "").lower()
    uploaded_images = empty_uploaded_images()

    if "multipart/form-data" in content_type:
        form_data = await request.form()
        payload = _parse_multipart_metadata(form_data.get("metadata"))
        files_by_angle = _extract_multipart_files(form_data)

        try:
            _validate_final_multipart_metadata(payload)
            _validate_file_counts(files_by_angle)
            await _validate_files(files_by_angle)
        except HTTPException as exc:
            await _close_upload_files(files_by_angle)
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
    else:
        try:
            raw_payload = await request.json()
        except json.JSONDecodeError as exc:
            raise _bad_request("Invalid JSON body.") from exc
        payload = _parse_enrollment_payload(raw_payload)

    entry = {
        "student_id": payload.student_id,
        "full_name": payload.full_name,
        "phone": payload.phone,
        "university_email": payload.university_email,
        "verification_completed": payload.verification_completed,
        "total_required_shots": payload.total_required_shots,
        "total_accepted_shots": payload.total_accepted_shots,
        "angles": [angle.model_dump() for angle in payload.angles],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_images": uploaded_images,
    }

    try:
        append_enrollment(entry)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to save enrollment metadata.",
        ) from exc

    return EnrollmentResponse(
        success=True,
        message="Enrollment saved successfully",
    )
