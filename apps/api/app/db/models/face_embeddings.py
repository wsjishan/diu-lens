"""Face embeddings table model backed by PostgreSQL pgvector."""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.db.base import Base
from app.db.models.mixins import TimestampMixin


class FaceEmbedding(TimestampMixin, Base):
    __tablename__ = "face_embeddings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        ForeignKey("students.student_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enrollment_id: Mapped[int | None] = mapped_column(
        ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    angle: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_image_path: Mapped[str] = mapped_column(Text, nullable=False)
    crop_path: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(512), nullable=False)
    embedding_dim: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=512,
        server_default=text("512"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
        index=True,
    )
