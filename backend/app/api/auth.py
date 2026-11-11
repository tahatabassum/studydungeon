import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.identity import (
    generate_guest_tag,
    generate_public_id,
    normalize_display_name_for_moderation,
    validate_display_name,
)
from app.core.rate_limit import check_rate_limit
from app.core.security import (
    DUMMY_ARGON2_HASH,
    create_session_token,
    hash_password,
    verify_password,
    verify_session_token,
)
from app.models.all_models import Dungeon, RateLimitRecord, User, UserProgress
from app.schemas.auth import (
    CreateGuestRequest,
    CreateGuestResponse,
    DeleteAccountRequest,
    DemoSessionResponse,
    GuestNameCheckRequest,
    GuestNameCheckResponse,
    UpgradeGuestRequest,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
demo_router = APIRouter(prefix="/demo", tags=["Demo"])
guests_router = APIRouter(prefix="/guests", tags=["Guests"])


@auth_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    clean_username = req.username

    # Check duplicate
    existing = await db.execute(select(User).where(User.username == clean_username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "USERNAME_TAKEN", "message": "This username is already taken."},
        )

    user = User(
        username=clean_username,
        password_hash=hash_password(req.password),
        is_guest=False,
    )
    db.add(user)
    await db.flush()

    progress = UserProgress(user_id=user.id)
    db.add(progress)
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        is_guest=user.is_guest,
        created_at=user.created_at,
        expires_at=user.expires_at,
    )


@auth_router.post("/login", response_model=UserResponse)
async def login(
    req: UserLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Enforce database-backed IP rate limit (10 requests per minute)
    await check_rate_limit(request, db, action="login", max_requests=10, window_seconds=60)

    clean_username = req.username
    result = await db.execute(select(User).where(User.username == clean_username, User.is_guest == False))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        # Constant-time mitigation
        verify_password(req.password, DUMMY_ARGON2_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."},
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."},
        )

    user.last_login_at = datetime.utcnow()
    await db.commit()

    token = create_session_token(
        user.id,
        session_version=user.session_version,
        is_guest=False,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return UserResponse(
        id=user.id,
        username=user.username,
        is_guest=user.is_guest,
        created_at=user.created_at,
        expires_at=user.expires_at,
    )


@auth_router.post("/logout")
async def logout(
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Invalidate session by incrementing session_version in database
    user.session_version += 1
    await db.commit()

    response.delete_cookie(key=settings.SESSION_COOKIE_NAME)
    return {"success": True, "message": "Logged out successfully."}


@auth_router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    handle = f"{user.display_name}#{user.tag}" if user.display_name and user.tag else user.username
    return UserResponse(
        id=user.id,
        public_id=user.public_id,
        username=user.username,
        display_name=user.display_name,
        tag=user.tag,
        handle=handle,
        is_guest=user.is_guest,
        created_at=user.created_at,
        expires_at=user.expires_at,
    )


@auth_router.delete("/me")
async def delete_me(
    response: Response,
    req: Optional[DeleteAccountRequest] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes user account and cascades deletion of all documents, chunks, topics,
    questions, dungeons, runs, attempts, and progress.
    Protected: Any user with is_system=True (or username 'system_demo') cannot be deleted.
    If req is provided, requires confirm == 'DELETE' if confirm key is sent.
    """
    if req and req.confirm is not None and req.confirm != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "CONFIRMATION_REQUIRED", "message": "Confirmation string 'DELETE' is required to delete account."},
        )

    if user.is_system or user.username == "system_demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "SYSTEM_USER_PROTECTED", "message": "The system user cannot be deleted."},
        )

    await db.delete(user)
    await db.commit()

    response.delete_cookie(key=settings.SESSION_COOKIE_NAME)
    return {"success": True, "message": "Your account and all of its study data were deleted."}


@auth_router.post("/upgrade", response_model=UserResponse)
async def upgrade_guest_account(
    req: UpgradeGuestRequest,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upgrades the current guest into a registered user in place (keeps user.id, public_id, points, runs).
    """
    if not user.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_A_GUEST", "message": "Only guest accounts can be upgraded to registered accounts."},
        )

    await check_rate_limit(request, db, action="auth_upgrade", max_requests=10, window_seconds=3600)

    clean_username = req.username
    existing = await db.execute(select(User).where(User.username == clean_username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "USERNAME_TAKEN", "message": "This username is already taken."},
        )

    user.username = clean_username
    user.password_hash = hash_password(req.password)
    user.is_guest = False
    user.expires_at = None
    user.upgraded_at = datetime.utcnow()
    user.session_version += 1

    await db.commit()
    await db.refresh(user)

    token = create_session_token(
        user.id,
        session_version=user.session_version,
        is_guest=False,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    handle = f"{user.display_name}#{user.tag}" if user.display_name and user.tag else user.username
    return UserResponse(
        id=user.id,
        public_id=user.public_id,
        username=user.username,
        display_name=user.display_name,
        tag=user.tag,
        handle=handle,
        is_guest=user.is_guest,
        created_at=user.created_at,
        expires_at=user.expires_at,
    )


@guests_router.post("/name-check", response_model=GuestNameCheckResponse)
async def check_guest_display_name(
    req: GuestNameCheckRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await check_rate_limit(request, db, action="guest_name_check", max_requests=30, window_seconds=60)
    is_valid, reason, msg = validate_display_name(req.display_name)
    if not is_valid:
        return GuestNameCheckResponse(ok=False, reason=reason, message=msg)
    return GuestNameCheckResponse(ok=True, display_name=req.display_name.strip())


@guests_router.post("", response_model=CreateGuestResponse, status_code=status.HTTP_201_CREATED)
async def create_guest(
    req: CreateGuestRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Check if existing session cookie present
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token and verify_session_token(cookie_token):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "SESSION_EXISTS", "message": "An active session already exists. Use GET /auth/me."},
        )

    # 1. Rate limits
    await check_rate_limit(request, db, action="create_guest", max_requests=30, window_seconds=3600)

    # Global hourly cap check
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)
    hourly_created_res = await db.execute(
        select(User).where(User.is_guest == True, User.created_at >= one_hour_ago)
    )
    if len(hourly_created_res.scalars().all()) >= settings.GUEST_CREATE_GLOBAL_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "GUEST_CREATION_PAUSED", "message": "Guest creation capacity reached for this hour. Try again later."},
            headers={"Retry-After": "3600"},
        )

    # 2. Public notice check
    if not req.accept_public_notice:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "NOTICE_NOT_ACCEPTED", "message": "Public notice must be accepted to proceed."},
        )

    # 3. Name validation
    is_valid, reason, msg = validate_display_name(req.display_name)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "NAME_INVALID", "reason": reason, "message": msg},
        )

    clean_display_name = req.display_name.strip()
    norm_display = normalize_display_name_for_moderation(clean_display_name)

    # Unique tag generation
    tag = generate_guest_tag()
    for _ in range(20):
        collision_res = await db.execute(
            select(User).where(User.display_name_norm == norm_display, User.tag == tag)
        )
        if not collision_res.scalar_one_or_none():
            break
        tag = generate_guest_tag()
    else:
        tag = str(secrets.randbelow(90000) + 10000)

    public_id = generate_public_id()
    guest_username = f"guest_{secrets.token_hex(4)}"
    expires_at = now + timedelta(days=settings.GUEST_SESSION_DAYS)

    guest = User(
        public_id=public_id,
        username=guest_username,
        display_name=clean_display_name,
        display_name_norm=norm_display,
        tag=tag,
        is_guest=True,
        notice_accepted_at=now,
        notice_version="2026-11",
        created_at=now,
        last_active_at=now,
        expires_at=expires_at,
    )
    db.add(guest)
    await db.flush()

    progress = UserProgress(user_id=guest.id)
    db.add(progress)

    # Lazy purge of guests inactive for >30 days
    thirty_days_ago = now - timedelta(days=settings.GUEST_SESSION_DAYS)
    await db.execute(delete(User).where(User.is_guest == True, User.last_active_at < thirty_days_ago))
    await db.execute(delete(RateLimitRecord).where(RateLimitRecord.timestamp < now - timedelta(hours=1)))

    await db.commit()
    await db.refresh(guest)

    # Set 30-day sliding cookie
    token = create_session_token(
        guest.id,
        session_version=guest.session_version,
        is_guest=True,
        expires_in_seconds=settings.GUEST_SESSION_DAYS * 86400,
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.GUEST_SESSION_DAYS * 86400,
    )

    handle = f"{guest.display_name}#{guest.tag}"
    return CreateGuestResponse(
        user=UserResponse(
            id=guest.id,
            public_id=guest.public_id,
            username=guest.username,
            display_name=guest.display_name,
            tag=guest.tag,
            handle=handle,
            is_guest=True,
            created_at=guest.created_at,
            expires_at=guest.expires_at,
        ),
        notice_version="2026-11",
    )


@demo_router.post("/session", response_model=DemoSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # 1. Enforce IP rate limiting for demo sessions (60 requests per hour)
    await check_rate_limit(request, db, action="demo_session", max_requests=settings.DEMO_RATE_LIMIT_PER_HOUR, window_seconds=3600)

    # 2. Lazy purge of expired guests & stale rate limit records
    now = datetime.utcnow()
    await db.execute(delete(User).where(User.is_guest == True, User.expires_at < now))
    await db.execute(delete(RateLimitRecord).where(RateLimitRecord.timestamp < now - timedelta(hours=1)))

    # 3. Create Guest User
    random_suffix = secrets.token_hex(3)
    guest_username = f"guest_{random_suffix}"
    expires_at = now + timedelta(hours=settings.DEMO_GUEST_TTL_HOURS)

    guest_user = User(
        username=guest_username,
        password_hash=None,
        is_guest=True,
        expires_at=expires_at,
    )
    db.add(guest_user)
    await db.flush()

    progress = UserProgress(user_id=guest_user.id)
    db.add(progress)

    # Get public demo dungeon or fallback
    dungeon_res = await db.execute(select(Dungeon).where(Dungeon.is_public_demo == True))
    demo_dungeon = dungeon_res.scalar_one_or_none()
    demo_dungeon_id = demo_dungeon.id if demo_dungeon else "demo-dungeon-seeded-id"

    await db.commit()
    await db.refresh(guest_user)

    token = create_session_token(
        guest_user.id,
        session_version=guest_user.session_version,
        is_guest=True,
        expires_in_seconds=settings.DEMO_GUEST_TTL_HOURS * 3600,
    )
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.DEMO_GUEST_TTL_HOURS * 3600,
    )

    return DemoSessionResponse(
        user=UserResponse(
            id=guest_user.id,
            username=guest_user.username,
            is_guest=True,
            created_at=guest_user.created_at,
            expires_at=guest_user.expires_at,
        ),
        dungeon_id=demo_dungeon_id,
        expires_at=expires_at,
    )
