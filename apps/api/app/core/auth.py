"""Authentication and authorization helpers for admin access."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AdminUser
from app.db.session import get_session_factory

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


class AuthError(Exception):
    """Raised for authentication flow errors."""


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(*, admin_id: int, email: str, role: str) -> str:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire_at = datetime.now(UTC) + expires_delta
    payload = {
        "sub": str(admin_id),
        "email": email,
        "role": role,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"success": False, "message": "Invalid or missing authentication token."},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"success": False, "message": "You do not have permission for this action."},
    )


def authenticate_admin_user(email: str, password: str) -> AdminUser | None:
    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            admin = db.scalar(select(AdminUser).where(AdminUser.email == email.strip().lower()))
        except SQLAlchemyError as exc:
            raise AuthError("Authentication lookup failed.") from exc

        if admin is None or not admin.is_active:
            return None
        if not verify_password(password, admin.password_hash):
            return None
        return admin


def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials | None,
) -> AdminUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    token = credentials.credentials.strip()
    if not token:
        raise _unauthorized()

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        subject = payload.get("sub")
    except JWTError as exc:
        raise _unauthorized() from exc

    if subject is None:
        raise _unauthorized()

    session_factory = get_session_factory()
    with session_factory() as db:
        try:
            admin = db.scalar(select(AdminUser).where(AdminUser.id == int(subject)))
        except (ValueError, SQLAlchemyError) as exc:
            raise _unauthorized() from exc

        if admin is None or not admin.is_active:
            raise _unauthorized()
        return admin


def require_admin(credentials: HTTPAuthorizationCredentials | None) -> AdminUser:
    admin = get_current_admin_user(credentials)
    if admin.role not in {"admin", "super_admin"}:
        raise _forbidden()
    return admin


def require_super_admin(credentials: HTTPAuthorizationCredentials | None) -> AdminUser:
    admin = get_current_admin_user(credentials)
    if admin.role != "super_admin":
        raise _forbidden()
    return admin
