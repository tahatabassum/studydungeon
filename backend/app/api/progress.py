from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import Question, ReviewItem, User, UserProgress
from app.services.progression import visible_daily_streak, xp_to_next_level

progress_router = APIRouter(tags=["progress"])


class ProgressResponse(BaseModel):
    user_id: str
    level: int
    total_xp: int
    unlocked_weapons: List[str]
    # XP still needed for the next level (curve: total XP of 100 x level reaches level + 1).
    xp_to_next: int = 100
    # Consecutive UTC days with a finished Daily Haunt (0 once a day is missed).
    daily_streak: int = 0
    # Reviews due now, and when the next one becomes due (null when none is scheduled).
    due_review_count: int = 0
    next_due_at: Optional[datetime] = None


class ScorecardResponse(BaseModel):
    user_id: str
    level: int
    total_score: int
    total_xp: int
    accuracy: float
    mastery_band: str  # Weak <50, Learning 50-79, Strong >=80


class ReviewQuestionItem(BaseModel):
    question_id: str
    prompt: str
    options: List[str]
    next_review_at: datetime
    repetition_count: int


@progress_router.get("/progress", response_model=ProgressResponse)
async def get_user_progress(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
    prog = res.scalar_one_or_none()
    now = datetime.utcnow()
    due_count = (
        await db.execute(select(func.count(ReviewItem.id)).where(ReviewItem.user_id == user.id, ReviewItem.due_at <= now))
    ).scalar_one()
    next_due = (
        await db.execute(select(func.min(ReviewItem.due_at)).where(ReviewItem.user_id == user.id, ReviewItem.due_at > now))
    ).scalar_one()
    level = prog.level if prog else 1
    total_xp = prog.total_xp if prog else 0
    return ProgressResponse(
        user_id=user.id,
        level=level,
        total_xp=total_xp,
        unlocked_weapons=(prog.unlocked_weapons if prog else None) or ["Rusty Dagger"],
        xp_to_next=xp_to_next_level(level, total_xp),
        daily_streak=visible_daily_streak(prog.daily_streak or 0, prog.last_haunt_on, now) if prog else 0,
        due_review_count=due_count,
        next_due_at=next_due,
    )


@progress_router.get("/progress/scorecard", response_model=ScorecardResponse)
async def get_user_scorecard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns user aggregate metrics and mastery band:
    Weak <50%, Learning 50-79%, Strong >=80%.
    """
    from app.models.all_models import Attempt, GameRun

    # Fetch attempts
    stmt = (
        select(Attempt.is_correct)
        .join(GameRun, Attempt.run_id == GameRun.id)
        .where(GameRun.user_id == user.id)
    )
    res = await db.execute(stmt)
    attempts = res.scalars().all()

    total_attempts = len(attempts)
    correct_count = sum(1 for a in attempts if a)
    accuracy = (correct_count / total_attempts) if total_attempts > 0 else 1.0
    accuracy_pct = accuracy * 100

    if accuracy_pct >= 80:
        band = "Strong"
    elif accuracy_pct >= 50:
        band = "Learning"
    else:
        band = "Weak"

    # Fetch total score
    run_stmt = select(GameRun.current_score).where(GameRun.user_id == user.id)
    run_res = await db.execute(run_stmt)
    scores = run_res.scalars().all()
    total_score = sum(scores)

    # Fetch progress
    prog_res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
    prog = prog_res.scalar_one_or_none()
    level = prog.level if prog else 1
    total_xp = prog.total_xp if prog else 0

    return ScorecardResponse(
        user_id=user.id,
        level=level,
        total_score=total_score,
        total_xp=total_xp,
        accuracy=round(accuracy, 2),
        mastery_band=band,
    )


@progress_router.get("/reviews/due", response_model=List[ReviewQuestionItem])
async def get_due_reviews(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    stmt = (
        select(ReviewItem, Question)
        .join(Question, ReviewItem.question_id == Question.id)
        .where(ReviewItem.user_id == user.id, ReviewItem.due_at <= now)
        .order_by(ReviewItem.due_at.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()
    items = []
    for r_item, q in rows:
        items.append(
            ReviewQuestionItem(
                question_id=q.id,
                prompt=q.prompt,
                options=q.options,
                next_review_at=r_item.due_at,
                repetition_count=r_item.repetition,
            )
        )
    return items
