"""store enrollment.student_id as public student identifier

Revision ID: 20260418_0003
Revises: 20260418_0002
Create Date: 2026-04-18 18:10:00.000000

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "20260418_0003"
down_revision = "20260418_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name

    if dialect == "postgresql":
        op.execute(
            "ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey"
        )
        op.execute(
            "ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_student_id_students_student_id"
        )
        op.add_column(
            "enrollments",
            sa.Column("student_id_public", sa.String(length=64), nullable=True),
        )
        op.execute(
            """
            UPDATE enrollments AS e
            SET student_id_public = s.student_id
            FROM students AS s
            WHERE CAST(s.id AS TEXT) = CAST(e.student_id AS TEXT)
            """
        )
        op.drop_index(op.f("ix_enrollments_student_id"), table_name="enrollments")
        op.execute("ALTER TABLE enrollments DROP COLUMN student_id")
        op.execute(
            "ALTER TABLE enrollments RENAME COLUMN student_id_public TO student_id"
        )
        op.execute("ALTER TABLE enrollments ALTER COLUMN student_id SET NOT NULL")
        op.create_index(
            op.f("ix_enrollments_student_id"),
            "enrollments",
            ["student_id"],
            unique=True,
        )
        op.create_foreign_key(
            "fk_enrollments_student_id_students_student_id",
            "enrollments",
            "students",
            ["student_id"],
            ["student_id"],
            ondelete="CASCADE",
        )
        return

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys=OFF")
        op.execute(
            """
            CREATE TABLE enrollments_new (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                student_id VARCHAR(64) NOT NULL,
                status VARCHAR(50) NOT NULL,
                verification_completed BOOLEAN NOT NULL,
                total_required_shots INTEGER NOT NULL,
                total_accepted_shots INTEGER NOT NULL,
                validation_passed BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_enrollments_student_id_students_student_id
                    FOREIGN KEY(student_id) REFERENCES students (student_id) ON DELETE CASCADE
            )
            """
        )
        op.execute(
            """
            INSERT INTO enrollments_new (
                id,
                student_id,
                status,
                verification_completed,
                total_required_shots,
                total_accepted_shots,
                validation_passed,
                created_at,
                updated_at
            )
            SELECT
                e.id,
                s.student_id,
                e.status,
                e.verification_completed,
                e.total_required_shots,
                e.total_accepted_shots,
                e.validation_passed,
                e.created_at,
                e.updated_at
            FROM enrollments AS e
            JOIN students AS s
                ON CAST(s.id AS TEXT) = CAST(e.student_id AS TEXT)
            """
        )
        op.execute("DROP TABLE enrollments")
        op.execute("ALTER TABLE enrollments_new RENAME TO enrollments")
        op.create_index(
            op.f("ix_enrollments_student_id"),
            "enrollments",
            ["student_id"],
            unique=True,
        )
        op.execute("PRAGMA foreign_keys=ON")
        return

    raise RuntimeError(
        f"Unsupported dialect for migration {revision}: {dialect}"
    )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name

    if dialect == "postgresql":
        op.execute(
            "ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_student_id_students_student_id"
        )
        op.add_column(
            "enrollments",
            sa.Column("student_id_internal", sa.Integer(), nullable=True),
        )
        op.execute(
            """
            UPDATE enrollments AS e
            SET student_id_internal = s.id
            FROM students AS s
            WHERE s.student_id = e.student_id
            """
        )
        op.drop_index(op.f("ix_enrollments_student_id"), table_name="enrollments")
        op.execute("ALTER TABLE enrollments DROP COLUMN student_id")
        op.execute(
            "ALTER TABLE enrollments RENAME COLUMN student_id_internal TO student_id"
        )
        op.execute("ALTER TABLE enrollments ALTER COLUMN student_id SET NOT NULL")
        op.create_index(
            op.f("ix_enrollments_student_id"),
            "enrollments",
            ["student_id"],
            unique=True,
        )
        op.create_foreign_key(
            "enrollments_student_id_fkey",
            "enrollments",
            "students",
            ["student_id"],
            ["id"],
            ondelete="CASCADE",
        )
        return

    if dialect == "sqlite":
        op.execute("PRAGMA foreign_keys=OFF")
        op.execute(
            """
            CREATE TABLE enrollments_old_style (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                status VARCHAR(50) NOT NULL,
                verification_completed BOOLEAN NOT NULL,
                total_required_shots INTEGER NOT NULL,
                total_accepted_shots INTEGER NOT NULL,
                validation_passed BOOLEAN NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT enrollments_student_id_fkey
                    FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE
            )
            """
        )
        op.execute(
            """
            INSERT INTO enrollments_old_style (
                id,
                student_id,
                status,
                verification_completed,
                total_required_shots,
                total_accepted_shots,
                validation_passed,
                created_at,
                updated_at
            )
            SELECT
                e.id,
                s.id,
                e.status,
                e.verification_completed,
                e.total_required_shots,
                e.total_accepted_shots,
                e.validation_passed,
                e.created_at,
                e.updated_at
            FROM enrollments AS e
            JOIN students AS s
                ON s.student_id = e.student_id
            """
        )
        op.execute("DROP TABLE enrollments")
        op.execute("ALTER TABLE enrollments_old_style RENAME TO enrollments")
        op.create_index(
            op.f("ix_enrollments_student_id"),
            "enrollments",
            ["student_id"],
            unique=True,
        )
        op.execute("PRAGMA foreign_keys=ON")
        return

    raise RuntimeError(
        f"Unsupported dialect for migration {revision}: {dialect}"
    )
