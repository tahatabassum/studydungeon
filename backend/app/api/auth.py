import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    DUMMY_ARGON2_HASH,
    create_session_token,
    hash_password,
    verify_password,
)
from app.models.all_models import Dungeon, User, UserProgress
from app.schemas.auth import (
    DemoSessionResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
demo_router = APIRouter(prefix="/demo", tags=["Demo"])


@auth_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    clean_username = req.username  # already normalized in schema

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
async def login(req: UserLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    clean_username = req.username

    result = await db.execute(select(User).where(User.username == clean_username, User.is_guest == False))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        # Constant-time mitigation: run dummy Argon2 verify to prevent timing enumeration
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
        secure=False,  # Set True in HTTPS
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
    return UserResponse(
        id=user.id,
        username=user.username,
        is_guest=user.is_guest,
        created_at=user.created_at,
        expires_at=user.expires_at,
    )


@demo_router.post("/session", response_model=DemoSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Create Guest User
    random_suffix = secrets.token_hex(3)
    guest_username = f"guest_{random_suffix}"
    expires_at = datetime.utcnow() + timedelta(hours=settings.DEMO_GUEST_TTL_HOURS)

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
