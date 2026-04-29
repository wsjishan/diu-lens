"""add enrollment image per-frame quality metadata

Revision ID: 20260429_0007
Revises: 20260418_0006
Create Date: 2026-04-29 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260429_0007"
down_revision = "20260418_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "enrollment_images",
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "enrollment_images",
        sa.Column("blur_score", sa.Float(), nullable=True),
    )
    op.add_column(
        "enrollment_images",
        sa.Column("brightness", sa.Float(), nullable=True),
    )
    op.add_column(
        "enrollment_images",
        sa.Column("face_area_ratio", sa.Float(), nullable=True),
    )
    op.add_column(
        "enrollment_images",
        sa.Column("center_offset", sa.Float(), nullable=True),
    )
    op.add_column(
        "enrollment_images",
        sa.Column("detection_confidence", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("enrollment_images", "detection_confidence")
    op.drop_column("enrollment_images", "center_offset")
    op.drop_column("enrollment_images", "face_area_ratio")
    op.drop_column("enrollment_images", "brightness")
    op.drop_column("enrollment_images", "blur_score")
    op.drop_column("enrollment_images", "captured_at")
