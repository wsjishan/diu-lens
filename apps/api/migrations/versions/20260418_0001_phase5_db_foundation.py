"""phase 5 db foundation

Revision ID: 20260418_0001
Revises:
Create Date: 2026-04-18 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260418_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Intentionally empty: Phase 5 sets up migration infrastructure only.
    pass


def downgrade() -> None:
    pass
