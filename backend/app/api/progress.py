from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import Question, ReviewItem, User, UserProgress

progress_router = APIRouter(tags=["progress"])


class ProgressResponse(BaseModel):
    user_id: str
    level: int
    total_xp: int
    unlocked_weapons: List[str]


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
    if not prog:
        return ProgressResponse(
            user_id=user.id,
            level=1,
            total_xp=0,
            unlocked_weapons=["Rusty Dagger"],
        )
    return ProgressResponse(
        user_id=user.id,
        level=prog.level,
        total_xp=prog.total_xp,
        unlocked_weapons=prog.unlocked_weapons or ["Rusty Dagger"],
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
