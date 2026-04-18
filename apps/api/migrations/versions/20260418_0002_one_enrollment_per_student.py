"""enforce one enrollment per student

Revision ID: 20260418_0002
Revises: 7fd34c67c471
Create Date: 2026-04-18 17:00:00.000000

"""
from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260418_0002"
down_revision = "7fd34c67c471"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(op.f("ix_enrollments_student_id"), table_name="enrollments")
    op.create_index(
        op.f("ix_enrollments_student_id"),
        "enrollments",
        ["student_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_enrollments_student_id"), table_name="enrollments")
    op.create_index(
        op.f("ix_enrollments_student_id"),
        "enrollments",
        ["student_id"],
        unique=False,
    )

