from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import (
    Attempt,
    ContentPack,
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
from app.services.progression import (
    ALLOWED_MODES,
    FLOOR_MODES,
    HAUNT_MODE,
    PRACTICE_MODES,
    WEAK_TOPIC_ROOMS,
    counts_for_progress,
    final_boss_room,
    floor_ids_in_order,
    is_final_boss_target,
    load_progress,
    next_daily_streak,
    run_rooms,
    sorted_rooms,
)
from app.services.srs import calculate_next_review_interval

runs_router = APIRouter(prefix="/runs", tags=["runs"])

# XP in the chest after a floor (added to the run's XP once, at its first finish).
FLOOR_CHEST_XP = 40


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

    # Check if dungeon belongs to a preloaded content pack
    pack_res = await db.execute(select(ContentPack).where(ContentPack.dungeon_id == dungeon.id))
    content_pack = pack_res.scalar_one_or_none()

    if content_pack:
        # Pack 1 is always unlocked; pack N+1 needs pack N's final boss (a floor clear is not enough).
        if content_pack.order > 1:
            prev_pack_res = await db.execute(select(ContentPack).where(ContentPack.order == content_pack.order - 1))
            prev_pack = prev_pack_res.scalar_one_or_none()
            if prev_pack and prev_pack.dungeon_id:
                prev = (await load_progress(db, user.id, [prev_pack.dungeon_id]))[prev_pack.dungeon_id]
                if not prev.final_boss_cleared:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "PACK_LOCKED",
                            "message": "Clear the previous dungeon's final boss to unlock it.",
                        },
                    )
    else:
        # Private dungeons are playable only by their owner (guests included: they may upload their own notes).
        if not dungeon.is_public_demo and dungeon.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "You do not own this dungeon."},
            )

    mode = req.mode or None
    if mode == "full":
        mode = None
    if mode not in ALLOWED_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_MODE", "message": f"Unknown run mode '{req.mode}'."},
        )
    floor_id = req.floor_id or None
    if mode in PRACTICE_MODES or mode == HAUNT_MODE:
        floor_id = None
    if mode in FLOOR_MODES and not floor_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "FLOOR_REQUIRED", "message": "A floor run needs a floor_id."},
        )

    all_rooms = sorted_rooms(dungeon.rooms)
    floor_ids = floor_ids_in_order(all_rooms)
    picked_room_ids = None

    if mode == HAUNT_MODE:
        now = datetime.utcnow()
        due_count = (
            await db.execute(
                select(func.count(ReviewItem.id)).where(ReviewItem.user_id == user.id, ReviewItem.due_at <= now)
            )
        ).scalar_one()
        if not due_count:
            next_due = (
                await db.execute(select(func.min(ReviewItem.due_at)).where(ReviewItem.user_id == user.id))
            ).scalar_one()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "NOTHING_DUE",
                    "message": "No memories are due right now.",
                    "next_due_at": next_due.isoformat() + "Z" if next_due else None,
                },
            )
    elif mode in PRACTICE_MODES:
        topic_rooms = [r for r in all_rooms if r.topic_id]
        if mode == "weak_topics":
            picked = await _weakest_rooms(db, user.id, topic_rooms)
        else:
            picked = topic_rooms
        if not picked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "NO_TOPICS", "message": "This dungeon has no topics to practise."},
            )
        picked_room_ids = [r.id for r in picked]
    elif floor_id and floor_ids:
        progress = (await load_progress(db, user.id, [dungeon.id]))[dungeon.id]
        if is_final_boss_target(floor_id, all_rooms):
            if not progress.final_boss_cleared and progress.floors_cleared(floor_ids) < len(floor_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "FINAL_BOSS_LOCKED", "message": "Clear all dungeon floors before challenging the final boss."},
                )
        elif floor_id not in floor_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "FLOOR_NOT_FOUND", "message": "That floor is not part of this dungeon."},
            )
        else:
            f_idx = floor_ids.index(floor_id)
            if f_idx > 0 and floor_ids[f_idx - 1] not in progress.cleared_floor_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "FLOOR_LOCKED", "message": "Clear the previous floor's boss to unlock this floor."},
                )
            if mode == "replay_floor" and floor_id not in progress.cleared_floor_ids:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"code": "FLOOR_NOT_CLEARED", "message": "Cannot replay a floor that has not been cleared yet."},
                )

    run = GameRun(
        user_id=user.id,
        dungeon_id=dungeon.id,
        floor_id=floor_id,
        mode=mode,
        room_ids=picked_room_ids,
        current_hp=100,
        current_score=0,
        current_streak=0,
        xp_earned=0,
        status="active",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return _run_detail(run, all_rooms, attempts=[])


async def _weakest_rooms(db: AsyncSession, user_id: str, rooms: list) -> list:
    """The WEAK_TOPIC_ROOMS rooms whose topics the player answers worst (untried topics count as 0%)."""
    topic_ids = [r.topic_id for r in rooms]
    if not topic_ids:
        return []
    rows = await db.execute(
        select(Question.topic_id, func.count(Attempt.id), func.coalesce(func.sum(func.cast(Attempt.is_correct, Integer)), 0))
        .join(Question, Attempt.question_id == Question.id)
        .where(Attempt.user_id == user_id, Question.topic_id.in_(topic_ids))
        .group_by(Question.topic_id)
    )
    accuracy = {tid: (correct / total if total else 0.0) for tid, total, correct in rows.all()}
    ranked = sorted(rooms, key=lambda r: (accuracy.get(r.topic_id, 0.0), r.room_order))
    picked = ranked[:WEAK_TOPIC_ROOMS]
    return sorted(picked, key=lambda r: r.room_order)


def _run_detail(run: GameRun, all_rooms: list, attempts: list) -> RunDetailResponse:
    """The run as the client sees it: only its own rooms, numbered 1..n, the last one its boss."""
    if run.mode == HAUNT_MODE:
        # Display only: the client builds its Haunted Halls from the due list.
        room_states = [
            RunRoomState(
                room_id="hall-1",
                room_number=1,
                topic_name="Haunted Hall",
                monster_name="Haunted Hall",
                monster_max_hp=0,
                monster_current_hp=0,
                is_cleared=False,
                is_boss=False,
            )
        ]
        target_rooms = []
    else:
        target_rooms = run_rooms(run, all_rooms)
        room_states = []
        for idx, r in enumerate(target_rooms):
            dmg_dealt = sum(a.damage_dealt for a in attempts if a.question and a.question.topic_id == r.topic_id)
            current_monster_hp = max(0, r.monster_hp - dmg_dealt)
            room_states.append(
                RunRoomState(
                    room_id=r.id,
                    room_number=idx + 1,
                    topic_name=r.topic.name if r.topic else "General",
                    monster_name=r.monster_type,
                    monster_max_hp=r.monster_hp,
                    monster_current_hp=current_monster_hp,
                    is_cleared=current_monster_hp == 0,
                    is_boss=(idx == len(target_rooms) - 1),
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
        room_ids=[r.id for r in target_rooms],
        floor_id=run.floor_id,
        mode=run.mode,
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
            selectinload(GameRun.attempts).selectinload(Attempt.question),
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
    return _run_detail(run, sorted_rooms(run.dungeon.rooms), attempts=run.attempts)


# Keyed by (user id, run id, attempt id): an attempt id is client-made, so it must never be shared across players.
_PROCESSED_ATTEMPTS: dict[tuple[str, str, str], AttemptResponse] = {}
_QUESTION_CACHE: dict[str, Question] = {}


@runs_router.post("/{id}/attempts", response_model=AttemptResponse, response_model_exclude_none=True)
async def submit_attempt(
    id: str,
    req: AttemptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fast in-memory idempotency check (0ms), per player and run
    cache_key = (user.id, id, req.attempt_id)
    if req.attempt_id and cache_key in _PROCESSED_ATTEMPTS:
        return _PROCESSED_ATTEMPTS[cache_key]

    # 1. Fetch run with dungeon, rooms, and content pack in 1 query
    run_res = await db.execute(
        select(GameRun)
        .options(
            joinedload(GameRun.dungeon).joinedload(Dungeon.rooms),
            joinedload(GameRun.dungeon).joinedload(Dungeon.pack),
        )
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.unique().scalar_one_or_none()
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

    # 2. Database Idempotency Check fallback (only if not found in memory cache)
    existing_attempt = None
    if req.attempt_id:
        existing_attempt_res = await db.execute(select(Attempt).where(Attempt.id == req.attempt_id).limit(1))
        existing_attempt = existing_attempt_res.scalar_one_or_none()
        if existing_attempt and (existing_attempt.run_id != id or existing_attempt.user_id != user.id):
            # attempt_id is a global key: reusing one from another run (or player) is a client error, never a replay.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ATTEMPT_ID_CONFLICT", "message": "This attempt id was already used. Send a new one."},
            )

    if existing_attempt:
        cached_q_res = await db.execute(select(Question).where(Question.id == existing_attempt.question_id))
        cached_q = cached_q_res.scalar_one_or_none()
        remaining_hp = 0
        cached_correct_answer = None
        cached_combo = None
        if cached_q:
            target_r = next((r for r in run_rooms(run, run.dungeon.rooms) if r.topic_id == cached_q.topic_id), None)
            if target_r:
                dmg_res = await db.execute(
                    select(func.coalesce(func.sum(Attempt.damage_dealt), 0))
                    .join(Question, Attempt.question_id == Question.id)
                    .where(Attempt.run_id == id, Question.topic_id == target_r.topic_id)
                )
                tot_dmg = dmg_res.scalar() or 0
                remaining_hp = max(0, target_r.monster_hp - tot_dmg)
            cached_ans_text = cached_q.options[cached_q.correct_option] if cached_q.correct_option < len(cached_q.options) else ""
            if not existing_attempt.is_correct:
                cached_correct_answer = cached_ans_text
                cached_combo = 0
            else:
                cached_combo = run.current_streak

        from app.models.all_models import PlayerStats, PointEvent
        pe_res = await db.execute(select(PointEvent).where(PointEvent.attempt_id == req.attempt_id).limit(1))
        pe = pe_res.scalar_one_or_none()
        ps_res = await db.execute(select(PlayerStats).where(PlayerStats.user_id == user.id))
        ps = ps_res.scalar_one_or_none()
        pp_dict = None
        if ps:
            pp_dict = {
                "preloaded": ps.points_preloaded,
                "own_notes": ps.points_own_notes,
                "overall": ps.points_overall,
            }
        replayed_resp = AttemptResponse(
            attempt_id=existing_attempt.id,
            is_correct=existing_attempt.is_correct,
            damage_dealt=existing_attempt.damage_dealt,
            damage_taken=existing_attempt.damage_taken,
            is_critical=False,
            current_hp=run.current_hp,
            current_score=run.current_score,
            current_streak=run.current_streak,
            monster_hp_remaining=remaining_hp,
            explanation=cached_q.explanation if cached_q else "Idempotent replay.",
            evidence_quote=cached_q.evidence_quote if cached_q else None,
            points_awarded=pe.points if pe else 0,
            points_reason=pe.reason if pe else ("first_correct" if existing_attempt.is_correct else "wrong"),
            points_bonus=0,
            player_points=pp_dict,
            correct_answer=cached_correct_answer,
            combo=cached_combo,
        )
        if req.attempt_id:
            _PROCESSED_ATTEMPTS[cache_key] = replayed_resp
        return replayed_resp

    # 3. Fetch Question and ReviewItem (leveraging in-memory question cache)
    question = _QUESTION_CACHE.get(req.question_id)
    existing_rev = None
    if not question:
        q_rev_res = await db.execute(
            select(Question, ReviewItem)
            .outerjoin(
                ReviewItem,
                (ReviewItem.question_id == Question.id) & (ReviewItem.user_id == user.id)
            )
            .where(Question.id == req.question_id)
        )
        row = q_rev_res.first()
        if not row or not row[0]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "QUESTION_NOT_FOUND", "message": "Question does not exist."},
            )
        question = row[0]
        existing_rev = row[1]
        _QUESTION_CACHE[req.question_id] = question
    else:
        rev_res = await db.execute(
            select(ReviewItem).where(ReviewItem.question_id == req.question_id, ReviewItem.user_id == user.id)
        )
        existing_rev = rev_res.scalar_one_or_none()

    # Validate weapon exists and user has unlocked it
    from app.services.combat import WEAPON_BASE_DAMAGE, is_weapon_unlocked
    if req.weapon_name not in WEAPON_BASE_DAMAGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "UNKNOWN_WEAPON", "message": f"Weapon '{req.weapon_name}' is not recognized."},
        )

    # Only query UserProgress if using a non-default starter weapon
    if req.weapon_name != "Rusty Dagger":
        prog_res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
        user_prog = prog_res.scalar_one_or_none()
        user_unlocked = user_prog.unlocked_weapons if user_prog and user_prog.unlocked_weapons else ["Rusty Dagger"]
        level = user_prog.level if user_prog else 1
        total_xp = user_prog.total_xp if user_prog else 0
        if req.weapon_name not in user_unlocked and not is_weapon_unlocked(req.weapon_name, level=level, xp=total_xp):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "WEAPON_LOCKED", "message": f"Weapon '{req.weapon_name}' is locked. Meet unlock requirements first."},
            )

    # Scope: the question must belong to this run. A room run answers its own rooms' questions; a Daily Haunt
    # answers the player's own review questions. Anything else (another player's private question) is 404.
    this_run_rooms = run_rooms(run, run.dungeon.rooms)
    if run.mode == HAUNT_MODE:
        target_room = None
        if existing_rev is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "QUESTION_NOT_FOUND", "message": "Question does not exist."},
            )
    else:
        target_room = next((r for r in this_run_rooms if r.topic_id == question.topic_id), None)
        if target_room is None and req.question_id in _QUESTION_CACHE:
            # The cached copy may be stale (packs are re-seeded with new topic ids): read it again once.
            _QUESTION_CACHE.pop(req.question_id, None)
            fresh = (await db.execute(select(Question).where(Question.id == req.question_id))).scalar_one_or_none()
            if fresh is not None:
                question = fresh
                _QUESTION_CACHE[req.question_id] = fresh
                target_room = next((r for r in this_run_rooms if r.topic_id == question.topic_id), None)
        if target_room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "QUESTION_NOT_FOUND", "message": "Question does not exist."},
            )

    # Damage dealt per topic in this run, from the database every time (one grouped query). A per-room cache here
    # forgot the earlier rooms' damage, so the order check below refused the next room after a clear.
    damage_rows = await db.execute(
        select(Question.topic_id, func.coalesce(func.sum(Attempt.damage_dealt), 0))
        .join(Question, Attempt.question_id == Question.id)
        .where(Attempt.run_id == id)
        .group_by(Question.topic_id)
    )
    topic_damage = {r[0]: r[1] for r in damage_rows.all()}

    if target_room:
        # Order is checked inside the run's own rooms (a Floor 2 run does not replay Floor 1).
        for idx_r, r in enumerate(this_run_rooms):
            if r.room_order < target_room.room_order:
                dmg = topic_damage.get(r.topic_id, 0)
                if dmg < r.monster_hp:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"code": "OUT_OF_ORDER_ROOM", "message": f"Must defeat room {idx_r + 1} before challenging this room."},
                    )
            elif r.room_order == target_room.room_order:
                dmg = topic_damage.get(r.topic_id, 0)
                if dmg >= r.monster_hp:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"code": "ROOM_ALREADY_CLEARED", "message": "This room's monster has already been defeated."},
                    )

    # Determine correctness
    correct_text = question.options[question.correct_option] if question.correct_option < len(question.options) else ""
    is_correct = (req.selected_answer.strip().lower() == correct_text.strip().lower())

    # The run's last room holds its boss (the floor boss in a floor run).
    is_boss = bool(target_room and this_run_rooms and target_room.id == this_run_rooms[-1].id)

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

    # 5.1 Award Authoritative Points Ledger
    from app.services.points import award_attempt_points
    pts_awarded, pts_reason, pts_bonus, player_pts = await award_attempt_points(
        user=user,
        run=run,
        dungeon=run.dungeon,
        question_id=question.id,
        attempt_id=req.attempt_id,
        is_correct=is_correct,
        difficulty=question.difficulty,
        duration_ms=0,
        db=db,
    )

    # 6. SRS Queue Update
    current_rep = existing_rev.repetition if existing_rev else 0
    rep, interval, next_due = calculate_next_review_interval(
        current_repetition=current_rep,
        is_correct=is_correct,
        marked_hard=(question.difficulty == "hard"),
    )

    if existing_rev:
        existing_rev.repetition = rep
        existing_rev.interval_days = interval
        existing_rev.due_at = next_due
        existing_rev.last_result = "correct" if is_correct else "wrong"
    else:
        review_item = ReviewItem(
            user_id=user.id,
            question_id=question.id,
            due_at=next_due,
            repetition=rep,
            interval_days=interval,
            last_result="correct" if is_correct else "wrong",
        )
        db.add(review_item)

    total_dmg_to_room = topic_damage.get(target_room.topic_id, 0) + damage_dealt if target_room else damage_dealt
    monster_remaining = max(0, target_room.monster_hp - total_dmg_to_room) if target_room else 0

    await db.commit()

    final_resp = AttemptResponse(
        attempt_id=req.attempt_id,
        is_correct=is_correct,
        damage_dealt=damage_dealt,
        damage_taken=damage_taken,
        is_critical=is_critical,
        current_hp=run.current_hp,
        current_score=run.current_score,
        current_streak=run.current_streak,
        monster_hp_remaining=monster_remaining,
        explanation=question.explanation,
        evidence_quote=question.evidence_quote,
        points_awarded=pts_awarded,
        points_reason=pts_reason,
        points_bonus=pts_bonus,
        player_points=player_pts,
        correct_answer=correct_text if not is_correct else None,
        combo=run.current_streak if is_correct else 0,
    )

    if req.attempt_id:
        _PROCESSED_ATTEMPTS[cache_key] = final_resp

    return final_resp


@runs_router.post("/{id}/rooms/{room_id}/clear")
async def clear_room(
    id: str,
    room_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run_res = await db.execute(
        select(GameRun)
        .options(
            selectinload(GameRun.attempts).selectinload(Attempt.question),
            selectinload(GameRun.dungeon).selectinload(Dungeon.rooms),
        )
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "RUN_NOT_FOUND", "message": "Run not found."})

    # Find room (only the run's own rooms can be cleared in it)
    this_run_rooms = run_rooms(run, run.dungeon.rooms)
    room = next((r for r in this_run_rooms if r.id == room_id), None)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "ROOM_NOT_FOUND", "message": "Room not found."})

    # Calculate damage dealt to this room monster
    dmg_dealt = sum(a.damage_dealt for a in run.attempts if a.question and a.question.topic_id == room.topic_id)
    if dmg_dealt < room.monster_hp:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "MONSTER_ALIVE", "message": f"Monster is still alive ({room.monster_hp - dmg_dealt} HP remaining)."},
        )

    # Award XP: 25 for a topic room, 100 for the run's boss room (a floor boss in a floor run)
    is_boss = room.id == this_run_rooms[-1].id
    xp_delta = 100 if is_boss else 25

    # Persist room clear XP to run (P3 fix)
    run.xp_earned += xp_delta

    # Authoritative Room Clear Points
    from app.services.points import award_room_clear_points
    pts_awarded, pts_reason = await award_room_clear_points(
        user=user,
        run=run,
        dungeon=run.dungeon,
        room=room,
        db=db,
        is_boss=is_boss,
    )

    await db.commit()

    return {
        "success": True,
        "room_id": room.id,
        "xp_delta": xp_delta,
        "is_boss": is_boss,
        "points_awarded": pts_awarded,
        "points_reason": pts_reason,
    }


@runs_router.post("/{id}/finish", response_model=RunSummaryResponse, response_model_exclude_none=True)
async def finish_run(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run_res = await db.execute(
        select(GameRun)
        .options(
            selectinload(GameRun.attempts).selectinload(Attempt.question),
            selectinload(GameRun.dungeon).selectinload(Dungeon.rooms).selectinload(DungeonRoom.topic),
        )
        .where(GameRun.id == id, GameRun.user_id == user.id)
    )
    run = run_res.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RUN_NOT_FOUND", "message": "Run not found."},
        )

    all_rooms = sorted_rooms(run.dungeon.rooms)
    this_run_rooms = run_rooms(run, all_rooms)
    fb_room = final_boss_room(all_rooms)
    # Pack completion, unlocks and the dungeon clear need a run that defeated the final boss.
    conquers_dungeon = counts_for_progress(run) and fb_room is not None and any(r.id == fb_room.id for r in this_run_rooms)
    is_floor_run = run.mode in FLOOR_MODES or (bool(run.floor_id) and not conquers_dungeon)

    # Check boss room of this run cleared (a Daily Haunt has no boss)
    boss_room = this_run_rooms[-1] if this_run_rooms else None
    if boss_room:
        boss_dmg = sum(a.damage_dealt for a in run.attempts if a.question and a.question.topic_id == boss_room.topic_id)
        if boss_dmg < boss_room.monster_hp:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "BOSS_NOT_CLEARED", "message": "Cannot finish run until boss monster is defeated."},
            )

    if run.status == "active":
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        # The floor chest's Bonus XP is real XP (it was only shown before).
        if is_floor_run:
            run.xp_earned += FLOOR_CHEST_XP

        # Update UserProgress (P3 fix)
        prog_res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
        user_prog = prog_res.scalar_one_or_none()
        if not user_prog:
            user_prog = UserProgress(user_id=user.id, total_xp=0, level=1, unlocked_weapons=["Rusty Dagger"])
            db.add(user_prog)

        user_prog.total_xp += run.xp_earned
        if run.mode == HAUNT_MODE:
            user_prog.daily_streak = next_daily_streak(user_prog.daily_streak or 0, user_prog.last_haunt_on, run.finished_at)
            user_prog.last_haunt_on = run.finished_at

        # Level curve: 100 * level to reach level + 1
        current_lvl = user_prog.level
        xp_needed = 100 * current_lvl
        while user_prog.total_xp >= xp_needed:
            user_prog.level += 1
            current_lvl = user_prog.level
            xp_needed = 100 * current_lvl

        # Check unlocked weapons
        from app.services.combat import WEAPON_UNLOCK_RULES
        unlocked_set = set(user_prog.unlocked_weapons or ["Rusty Dagger"])
        for w_name, rule in WEAPON_UNLOCK_RULES.items():
            if rule(level=user_prog.level, xp=user_prog.total_xp, cleared_rooms=len(this_run_rooms), boss_cleared=1 if boss_room else 0):
                unlocked_set.add(w_name)
        user_prog.unlocked_weapons = list(unlocked_set)

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

    # Check pack progress if run belonged to a pack
    pack_progress = None
    pack_res = await db.execute(select(ContentPack).where(ContentPack.dungeon_id == run.dungeon_id))
    current_pack = pack_res.scalar_one_or_none()
    if current_pack and conquers_dungeon:
        # Check next pack
        next_pack_res = await db.execute(select(ContentPack).where(ContentPack.order == current_pack.order + 1))
        next_pack = next_pack_res.scalar_one_or_none()

        # Check all packs complete
        all_packs_res = await db.execute(select(ContentPack))
        all_packs = all_packs_res.scalars().all()
        pack_progress_map = await load_progress(db, user.id, [p.dungeon_id for p in all_packs if p.dungeon_id])
        all_completed = all(p.dungeon_id in pack_progress_map and pack_progress_map[p.dungeon_id].final_boss_cleared for p in all_packs)

        # Only the first conquest of a pack reports the unlock; replays get null.
        earlier_res = await db.execute(
            select(GameRun).where(
                GameRun.user_id == user.id,
                GameRun.dungeon_id == run.dungeon_id,
                GameRun.status == "completed",
                GameRun.id != run.id,
                GameRun.finished_at < run.finished_at,
            )
        )
        first_completion = not any(
            counts_for_progress(r) and fb_room is not None and any(x.id == fb_room.id for x in run_rooms(r, all_rooms))
            for r in earlier_res.scalars().all()
        )

        pack_progress = {
            "pack_id": current_pack.id,
            "status": "completed",
            "unlocked_pack_id": next_pack.id if (next_pack and first_completion) else None,
            "all_completed": all_completed,
        }

        # Pack complete points
        if first_completion:
            from app.services.points import award_pack_completion_points
            await award_pack_completion_points(
                user=user,
                run=run,
                pack_id=current_pack.id,
                db=db,
            )

    # Compute points earned in this run from ledger
    from app.models.all_models import PlayerStats, PointEvent
    pe_run_res = await db.execute(
        select(func.coalesce(func.sum(PointEvent.points), 0)).where(PointEvent.run_id == run.id)
    )
    points_earned = pe_run_res.scalar_one()

    ps_res = await db.execute(select(PlayerStats).where(PlayerStats.user_id == user.id))
    ps = ps_res.scalar_one_or_none()
    pp_dict = None
    if ps:
        pp_dict = {
            "preloaded": ps.points_preloaded,
            "own_notes": ps.points_own_notes,
            "overall": ps.points_overall,
        }

    # Calculate floor_rank, mastery_by_topic, chest_rewards
    floor_rank = None
    if is_floor_run:
        floor_rank = "S" if accuracy >= 0.90 else ("A" if accuracy >= 0.80 else ("B" if accuracy >= 0.60 else "C"))

    mastery_by_topic = []
    seen_topics = set()
    for r in this_run_rooms:
        if r.topic and r.topic.id not in seen_topics:
            seen_topics.add(r.topic.id)
            t_attempts = [a for a in run.attempts if a.question and a.question.topic_id == r.topic.id]
            t_correct = sum(1 for a in t_attempts if a.is_correct)
            m_val = int(round((t_correct / len(t_attempts)) * 100)) if t_attempts else 0
            mastery_by_topic.append({"topic_id": r.topic.id, "title": r.topic.name, "mastery": m_val})

    chest_rewards = None
    if is_floor_run:
        chest_rewards = [
            {"id": f"cr_{run.id[:8]}", "kind": "xp", "label": "Bonus XP", "amount": FLOOR_CHEST_XP}
        ]

    return RunSummaryResponse(
        id=run.id,
        score=run.current_score,
        xp_earned=run.xp_earned,
        correct_count=correct_att,
        total_attempts=total_att,
        accuracy=round(accuracy, 2),
        mastery_band=band,
        status=run.status,
        points_earned=points_earned,
        player_points=pp_dict,
        pack_progress=pack_progress,
        floor_rank=floor_rank,
        mastery_by_topic=mastery_by_topic if mastery_by_topic else None,
        chest_rewards=chest_rewards,
    )
