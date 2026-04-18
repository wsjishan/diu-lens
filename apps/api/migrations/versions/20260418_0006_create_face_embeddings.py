"""create face embeddings table with pgvector

Revision ID: 20260418_0006
Revises: 20260418_0005
Create Date: 2026-04-18 22:10:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.exc import SQLAlchemyError


# revision identifiers, used by Alembic.
revision = "20260418_0006"
down_revision = "20260418_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "pgvector extension is required but not installed on this PostgreSQL server. "
            "Install pgvector for your PostgreSQL version, then rerun migrations."
        ) from exc
    op.create_table(
        "face_embeddings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("student_id", sa.String(length=64), nullable=False),
        sa.Column("enrollment_id", sa.Integer(), nullable=True),
        sa.Column("angle", sa.String(length=32), nullable=False),
        sa.Column("source_image_path", sa.Text(), nullable=False),
        sa.Column("crop_path", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(dim=512), nullable=False),
        sa.Column("embedding_dim", sa.Integer(), nullable=False, server_default="512"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["students.student_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["enrollment_id"], ["enrollments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_face_embeddings_student_id"), "face_embeddings", ["student_id"], unique=False)
    op.create_index(op.f("ix_face_embeddings_enrollment_id"), "face_embeddings", ["enrollment_id"], unique=False)
    op.create_index(op.f("ix_face_embeddings_angle"), "face_embeddings", ["angle"], unique=False)
    op.create_index(op.f("ix_face_embeddings_is_active"), "face_embeddings", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_face_embeddings_is_active"), table_name="face_embeddings")
    op.drop_index(op.f("ix_face_embeddings_angle"), table_name="face_embeddings")
    op.drop_index(op.f("ix_face_embeddings_enrollment_id"), table_name="face_embeddings")
    op.drop_index(op.f("ix_face_embeddings_student_id"), table_name="face_embeddings")
    op.drop_table("face_embeddings")
