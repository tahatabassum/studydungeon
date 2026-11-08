from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import (
    Attempt,
    Dungeon,
    DungeonRoom,
    GameRun,
    Question,
    ReviewItem,
    User,
    UserProgress,
)
from app.schemas.runs import (
    AttemptRequest,
    AttemptResponse,
    RunDetailResponse,
    RunRoomState,
    RunSummaryResponse,
    StartRunRequest,
)
from app.services.combat import calculate_combat_damage
from app.services.srs import calculate_next_review_interval

runs_router = APIRouter(prefix="/runs", tags=["runs"])


@runs_router.post("", status_code=status.HTTP_201_CREATED, response_model=RunDetailResponse)
async def start_run(
    req: StartRunRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify dungeon
    d_res = await db.execute(
        select(Dungeon)
        .options(selectinload(Dungeon.rooms).selectinload(DungeonRoom.topic))
        .where(Dungeon.id == req.dungeon_id)
    )
    dungeon = d_res.scalar_one_or_none()
    if not dungeon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DUNGEON_NOT_FOUND", "message": "Dungeon does not exist."},
        )

    # Guest guard: guests can ONLY play demo dungeon
    if user.is_guest and not dungeon.is_public_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "GUEST_FORBIDDEN", "message": "Guests are only permitted to play the public demo dungeon."},
        )

    # Check dungeon ownership if not public demo
    if not dungeon.is_public_demo and dungeon.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You do not own this dungeon."},
        )

    # Create run
    run = GameRun(
        user_id=user.id,
        dungeon_id=dungeon.id,
        current_hp=100,
        current_score=0,
        current_streak=0,
        xp_earned=0,
        status="active",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Build initial rooms state
    total_rooms = len(dungeon.rooms)
    room_states = [
        RunRoomState(
            room_id=r.id,
            room_number=r.room_order + 1,
            topic_name=r.topic.name if r.topic else "General",
            monster_name=r.monster_type,
            monster_max_hp=r.monster_hp,
            monster_current_hp=r.monster_hp,
            is_cleared=False,
            is_boss=(r.room_order == total_rooms - 1),
        )
        for r in sorted(dungeon.rooms, key=lambda x: x.room_order)
    ]

    return RunDetailResponse(
        id=run.id,
        dungeon_id=run.dungeon_id,
        current_hp=run.current_hp,
        current_score=run.current_score,
        current_streak=run.current_streak,
        xp_earned=run.xp_earned,
        status=run.status,
        started_at=run.started_at,
        rooms=room_states,
    )


@runs_router.get("/{id}", response_model=RunDetailResponse)
async def get_run_status(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run_res = await db.execute(
        select(GameRun)
        .options(
            selectinload(GameRun.attempts),
            selectinload(GameRun.dungeon).selectinload(Dungeon.rooms).selectinload(DungeonRoom.topic),
        )
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": "Run not found or does not belong to user."},
        )

    # Calculate room monster remaining HP
    total_rooms = len(run.dungeon.rooms)
    room_states = []
    for r in sorted(run.dungeon.rooms, key=lambda x: x.room_order):
        # Sum damage dealt in this room
        dmg_dealt = sum(
            a.damage_dealt
            for a in run.attempts
            if a.question and a.question.topic_id == r.topic_id
        )
        current_monster_hp = max(0, r.monster_hp - dmg_dealt)
        is_cleared = (current_monster_hp == 0)

        room_states.append(
            RunRoomState(
                room_id=r.id,
                room_number=r.room_order + 1,
                topic_name=r.topic.name if r.topic else "General",
                monster_name=r.monster_type,
                monster_max_hp=r.monster_hp,
                monster_current_hp=current_monster_hp,
                is_cleared=is_cleared,
                is_boss=(r.room_order == total_rooms - 1),
            )
        )

    return RunDetailResponse(
        id=run.id,
        dungeon_id=run.dungeon_id,
        current_hp=run.current_hp,
        current_score=run.current_score,
        current_streak=run.current_streak,
        xp_earned=run.xp_earned,
        status=run.status,
        started_at=run.started_at,
        rooms=room_states,
    )


@runs_router.post("/{id}/attempts", response_model=AttemptResponse)
async def submit_attempt(
    id: str,
    req: AttemptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Fetch run with dungeon rooms
    run_res = await db.execute(
        select(GameRun)
        .options(
            selectinload(GameRun.attempts),
            selectinload(GameRun.dungeon).selectinload(Dungeon.rooms),
        )
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": "Run not found or does not belong to user."},
        )

    if run.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "RUN_FINISHED", "message": "Cannot submit attempts on a finished or defeated run."},
        )

    # 2. Idempotency Check: if attempt_id was already processed, return stored result
    for a in run.attempts:
        if a.id == req.attempt_id:
            # Load question details if available
            q_res = await db.execute(select(Question).where(Question.id == a.question_id))
            cached_q = q_res.scalar_one_or_none()
            return AttemptResponse(
                attempt_id=a.id,
                is_correct=a.is_correct,
                damage_dealt=a.damage_dealt,
                damage_taken=a.damage_taken,
                is_critical=False,
                current_hp=run.current_hp,
                current_score=run.current_score,
                current_streak=run.current_streak,
                monster_hp_remaining=0,
                explanation=cached_q.explanation if cached_q else "Idempotent replay.",
                evidence_quote=cached_q.evidence_quote if cached_q else None,
            )

    # 3. Fetch Question
    q_res = await db.execute(select(Question).where(Question.id == req.question_id))
    question = q_res.scalar_one_or_none()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "QUESTION_NOT_FOUND", "message": "Question does not exist."},
        )

    # Validate weapon exists and user has unlocked it
    from app.services.combat import WEAPON_BASE_DAMAGE, is_weapon_unlocked
    if req.weapon_name not in WEAPON_BASE_DAMAGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "UNKNOWN_WEAPON", "message": f"Weapon '{req.weapon_name}' is not recognized."},
        )

    # Fetch user progress for weapon validation
    prog_res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
    user_prog = prog_res.scalar_one_or_none()
    user_unlocked = user_prog.unlocked_weapons if user_prog and user_prog.unlocked_weapons else ["Rusty Dagger"]

    # Also check dynamic level/xp unlock
    level = user_prog.level if user_prog else 1
    total_xp = user_prog.total_xp if user_prog else 0
    if req.weapon_name not in user_unlocked and not is_weapon_unlocked(req.weapon_name, level=level, xp=total_xp):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "WEAPON_LOCKED", "message": f"Weapon '{req.weapon_name}' is locked. Meet unlock requirements first."},
        )

    # Determine correctness
    # If selected_answer matches exact text or index
    correct_text = question.options[question.correct_option] if question.correct_option < len(question.options) else ""
    is_correct = (req.selected_answer.strip().lower() == correct_text.strip().lower())

    # Find room to check if boss
    is_boss = False
    total_rooms = len(run.dungeon.rooms)
    for r in run.dungeon.rooms:
        if r.topic_id == question.topic_id:
            is_boss = (r.room_order == total_rooms - 1)
            break

    # 4. Authoritative Damage Calculation
    damage_dealt, damage_taken, is_critical = calculate_combat_damage(
        weapon_name=req.weapon_name,
        difficulty=question.difficulty,
        current_streak=run.current_streak,
        is_correct=is_correct,
        is_boss=is_boss,
    )

    # Update run state
    if is_correct:
        run.current_streak += 1
        run.current_score += 100 + (run.current_streak * 20)
        run.xp_earned += 10
    else:
        run.current_streak = 0
        run.current_hp = max(0, run.current_hp - damage_taken)
        if run.current_hp == 0:
            run.status = "defeated"
            run.finished_at = datetime.utcnow()

    # 5. Persist Attempt
    attempt = Attempt(
        id=req.attempt_id,
        run_id=run.id,
        user_id=user.id,
        question_id=question.id,
        selected_option=question.correct_option if is_correct else 0,
        selected_answer=req.selected_answer,
        is_correct=is_correct,
        damage_dealt=damage_dealt,
        damage_taken=damage_taken,
        created_at=datetime.utcnow(),
    )
    db.add(attempt)

    # 6. SRS Queue Update
    rep, interval, next_due = calculate_next_review_interval(
        current_repetition=0,
        is_correct=is_correct,
        marked_hard=(question.difficulty == "hard"),
    )
    review_item = ReviewItem(
        user_id=user.id,
        question_id=question.id,
        due_at=next_due,
        repetition=rep,
        interval_days=interval,
        last_result="correct" if is_correct else "wrong",
    )
    db.add(review_item)

    await db.commit()
    await db.refresh(run)

    return AttemptResponse(
        attempt_id=req.attempt_id,
        is_correct=is_correct,
        damage_dealt=damage_dealt,
        damage_taken=damage_taken,
        is_critical=is_critical,
        current_hp=run.current_hp,
        current_score=run.current_score,
        current_streak=run.current_streak,
        monster_hp_remaining=0,
        explanation=question.explanation,
        evidence_quote=question.evidence_quote,
    )


@runs_router.post("/{id}/finish", response_model=RunSummaryResponse)
async def finish_run(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run_res = await db.execute(
        select(GameRun)
        .options(selectinload(GameRun.attempts))
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": "Run not found."},
        )

    if run.status == "active":
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        await db.commit()

    total_att = len(run.attempts)
    correct_att = sum(1 for a in run.attempts if a.is_correct)
    accuracy = (correct_att / total_att) if total_att > 0 else 0.0
    pct = accuracy * 100

    if pct >= 80.0:
        band = "Strong"
    elif pct >= 50.0:
        band = "Learning"
    else:
        band = "Weak"

    return RunSummaryResponse(
        id=run.id,
        score=run.current_score,
        xp_earned=run.xp_earned,
        correct_count=correct_att,
        total_attempts=total_att,
        accuracy=round(accuracy, 2),
        mastery_band=band,
        status=run.status,
    )
