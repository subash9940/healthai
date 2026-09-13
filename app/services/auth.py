import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from dataclasses import dataclass

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import asyncpg

from app.db import get_pool

JWT_SECRET = os.environ.get("JWT_SECRET", "swasthya-setu-super-secure-facility-jwt-secret-key-32chars-min")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

security_scheme = HTTPBearer(auto_error=False)


def hash_mpin(mpin: str) -> str:
    """Hash an MPIN string using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(mpin.strip().encode("utf-8"), salt).decode("utf-8")


def verify_mpin(plain_mpin: str, hashed_mpin: str) -> bool:
    """Verify plain MPIN against stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_mpin.strip().encode("utf-8"),
            hashed_mpin.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


@dataclass
class StaffSession:
    staff_id: str
    name: str
    phone_or_username: str
    role: str
    facility_id: str
    facility_name: Optional[str] = None
    facility_level: Optional[str] = None


async def get_current_facility_staff(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    pool: asyncpg.Pool = Depends(get_pool),
) -> StaffSession:
    """
    FastAPI dependency: authenticates incoming requests via Bearer JWT token,
    validates the staff user in the database, and returns their StaffSession
    containing staff_id and facility_id.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    staff_id_str = payload.get("sub")
    if not staff_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed session token (missing subject).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        staff_uuid = uuid.UUID(staff_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid staff identifier in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                fs.id,
                fs.name,
                fs.phone_or_username,
                fs.role,
                fs.facility_id,
                fs.active,
                f.name AS facility_name,
                f.level AS facility_level
            FROM facility_staff fs
            LEFT JOIN facilities f ON fs.facility_id = f.id
            WHERE fs.id = $1
            """,
            staff_uuid,
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Staff account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not row["active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff account has been deactivated.",
        )

    return StaffSession(
        staff_id=str(row["id"]),
        name=row["name"],
        phone_or_username=row["phone_or_username"],
        role=row["role"],
        facility_id=str(row["facility_id"]),
        facility_name=row["facility_name"],
        facility_level=row["facility_level"],
    )
