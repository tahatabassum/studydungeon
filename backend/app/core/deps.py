from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_session_token
from app.models.all_models import User


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    # Check session cookie or Authorization header
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    payload = verify_session_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    session_version = payload.get("v", 1)
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        return None

    # Enforce session revocation: cookie version must match active DB version
    if getattr(user, "session_version", 1) != session_version:
        return None

    # Check expiration for guest users
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    if user.is_guest and user.expires_at:
        if user.expires_at < now:
            return None

    # Sliding 30-day session activity update (Issue #1 fix)
    # Update last_active_at and extend guest expires_at
    if (now - user.last_active_at).total_seconds() > 300:  # throttle write to once every 5 minutes
        user.last_active_at = now
        if user.is_guest:
            user.expires_at = now + timedelta(days=settings.GUEST_SESSION_DAYS)
        try:
            await db.commit()
        except Exception:
            await db.rollback()

    return user


async def get_current_user(
    user: Optional[User] = Depends(get_current_user_optional),
) -> User:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication required"},
        )
    return user


async def require_registered_user(
    user: User = Depends(get_current_user),
) -> User:
    if user.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "GUEST_FORBIDDEN", "message": "Guests cannot upload documents or generate dungeons. Please register."},
        )
    return user
