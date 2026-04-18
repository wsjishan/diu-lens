"""Enrollments table model."""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class Enrollment(TimestampMixin, Base):
    __tablename__ = "enrollments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        default="pending",
    )
    verification_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    total_required_shots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_accepted_shots: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    validation_passed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
