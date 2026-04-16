import json
from datetime import datetime, timezone
from typing import cast

from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, ValidationError

from app.core.storage import (
    ALLOWED_ANGLES,
    append_enrollment,
    empty_uploaded_images,
    save_uploaded_images,
)


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


def _parse_enrollment_payload(raw_payload: object) -> EnrollmentRequest:
    try:
        return EnrollmentRequest.model_validate(raw_payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def _parse_multipart_metadata(metadata_value: object) -> EnrollmentRequest:
    if not isinstance(metadata_value, str) or not metadata_value.strip():
        raise HTTPException(
            status_code=400,
            detail="Missing metadata field in multipart request.",
        )

    try:
        metadata_object = json.loads(metadata_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON.") from exc

    return _parse_enrollment_payload(metadata_object)


def _extract_multipart_files(
    form_data: object,
) -> dict[str, list[UploadFile]]:
    if not hasattr(form_data, "keys") or not hasattr(form_data, "getlist"):
        raise HTTPException(status_code=400, detail="Invalid multipart form data.")

    files_by_angle: dict[str, list[UploadFile]] = {angle: [] for angle in ALLOWED_ANGLES}

    for key in form_data.keys():
        if key == "metadata" or key not in ALLOWED_ANGLES:
            continue

        angle_files: list[UploadFile] = []
        for item in form_data.getlist(key):
            if hasattr(item, "filename") and hasattr(item, "read"):
                angle_files.append(cast(UploadFile, item))

        if angle_files:
            files_by_angle[key].extend(angle_files)

    if not any(files_by_angle.values()):
        raise HTTPException(
            status_code=400,
            detail="No verification image files were provided.",
        )

    return files_by_angle


@router.post("/enroll", response_model=EnrollmentResponse)
async def enroll(request: Request) -> EnrollmentResponse:
    content_type = request.headers.get("content-type", "").lower()
    uploaded_images = empty_uploaded_images()

    if "multipart/form-data" in content_type:
        form_data = await request.form()
        payload = _parse_multipart_metadata(form_data.get("metadata"))
        files_by_angle = _extract_multipart_files(form_data)

        try:
            uploaded_images = await save_uploaded_images(
                payload.student_id,
                files_by_angle,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(
                status_code=500,
                detail="Failed to save uploaded verification images.",
            ) from exc
    else:
        try:
            raw_payload = await request.json()
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid JSON body.") from exc
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
