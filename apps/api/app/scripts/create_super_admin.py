"""CLI utility to create an initial admin/super-admin user."""

from __future__ import annotations

import argparse

from sqlalchemy import select

from app.core.auth import hash_password
from app.db.models import AdminUser
from app.db.session import get_session_factory


ALLOWED_ROLES = {"admin", "super_admin"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create an admin user")
    parser.add_argument("--email", required=True, help="Admin email")
    parser.add_argument("--full-name", required=True, help="Admin full name")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument(
        "--role",
        default="super_admin",
        choices=sorted(ALLOWED_ROLES),
        help="Admin role (default: super_admin)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    email = args.email.strip().lower()

    session_factory = get_session_factory()
    with session_factory() as db:
        existing = db.scalar(select(AdminUser).where(AdminUser.email == email))
        if existing is not None:
            print(f"Admin user already exists for email: {email}")
            return

        admin = AdminUser(
            email=email,
            full_name=args.full_name.strip(),
            password_hash=hash_password(args.password),
            role=args.role,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Created {args.role} user: {email}")


if __name__ == "__main__":
    main()
