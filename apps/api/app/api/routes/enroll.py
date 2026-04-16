from fastapi import APIRouter
from pydantic import BaseModel, Field


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


@router.post("/enroll", response_model=EnrollmentResponse)
async def enroll(payload: EnrollmentRequest) -> EnrollmentResponse:
    _ = payload
    return EnrollmentResponse(
        success=True,
        message="Enrollment and verification payload received",
    )
