"""Enrollment images table model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EnrollmentImage(Base):
    __tablename__ = "enrollment_images"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    angle: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    passed_validation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    blur_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    brightness: Mapped[float | None] = mapped_column(Float, nullable=True)
    face_area_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    center_offset: Mapped[float | None] = mapped_column(Float, nullable=True)
    detection_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
