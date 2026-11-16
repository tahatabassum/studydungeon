from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
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

    # Check if dungeon belongs to a preloaded content pack
    pack_res = await db.execute(select(ContentPack).where(ContentPack.dungeon_id == dungeon.id))
    content_pack = pack_res.scalar_one_or_none()

    if content_pack:
        # Pack 1 is always unlocked for everyone (guests and registered)
        if content_pack.order > 1:
            # Must have cleared previous pack's dungeon
            prev_pack_res = await db.execute(select(ContentPack).where(ContentPack.order == content_pack.order - 1))
            prev_pack = prev_pack_res.scalar_one_or_none()
            if prev_pack:
                cleared_run_res = await db.execute(
                    select(GameRun).where(
                        GameRun.user_id == user.id,
                        GameRun.dungeon_id == prev_pack.dungeon_id,
                        GameRun.status == "completed",
                    )
                )
                if not cleared_run_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail={
                            "code": "PACK_LOCKED",
                            "message": "Clear the previous dungeon's final boss to unlock it.",
                        },
                    )
    else:
        # Guest guard: guests can ONLY play demo/pack dungeons
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

    sorted_all_rooms = sorted(dungeon.rooms, key=lambda x: x.room_order)
    total_all_rooms = len(sorted_all_rooms)
    final_boss_room = sorted_all_rooms[-1] if sorted_all_rooms else None

    # Handle floor scoping and modes
    target_rooms = sorted_all_rooms
    mode = req.mode or "full"
    floor_id = req.floor_id

    if floor_id or mode in ("floor", "replay_floor"):
        # Distinct floor ids present in dungeon
        distinct_floor_ids = []
        for r in sorted_all_rooms:
            if r.floor_id and r.floor_id not in distinct_floor_ids:
                distinct_floor_ids.append(r.floor_id)

        # Determine if floor_id targets final boss
        is_final_boss_target = (
            final_boss_room and (floor_id == final_boss_room.id or floor_id == "final_boss" or (not distinct_floor_ids and floor_id))
        )

        if is_final_boss_target:
            # Check all preceding floors cleared
            for fid in distinct_floor_ids:
                cleared_f_res = await db.execute(
                    select(GameRun).where(
                        GameRun.user_id == user.id,
                        GameRun.dungeon_id == dungeon.id,
                        GameRun.floor_id == fid,
                        GameRun.status == "completed",
                    )
                )
                if not cleared_f_res.scalar_one_or_none():
                    # Check if entire dungeon was cleared
                    full_clear_res = await db.execute(
                        select(GameRun).where(
                            GameRun.user_id == user.id,
                            GameRun.dungeon_id == dungeon.id,
                            GameRun.status == "completed",
                        )
                    )
                    if not full_clear_res.scalar_one_or_none():
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={"code": "FINAL_BOSS_LOCKED", "message": "Clear all dungeon floors before challenging the final boss."},
                        )
            target_rooms = [final_boss_room]
        elif floor_id:
            matching_floor_rooms = [r for r in sorted_all_rooms if r.floor_id == floor_id]
            if matching_floor_rooms:
                target_rooms = matching_floor_rooms
                f_idx = distinct_floor_ids.index(floor_id) if floor_id in distinct_floor_ids else 0
                if f_idx > 0:
                    prev_f_id = distinct_floor_ids[f_idx - 1]
                    cleared_prev_res = await db.execute(
                        select(GameRun).where(
                            GameRun.user_id == user.id,
                            GameRun.dungeon_id == dungeon.id,
                            GameRun.floor_id == prev_f_id,
                            GameRun.status == "completed",
                        )
                    )
                    if not cleared_prev_res.scalar_one_or_none():
                        full_clear_res = await db.execute(
                            select(GameRun).where(
                                GameRun.user_id == user.id,
                                GameRun.dungeon_id == dungeon.id,
                                GameRun.status == "completed",
                            )
                        )
                        if not full_clear_res.scalar_one_or_none():
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail={"code": "FLOOR_LOCKED", "message": "Clear the previous floor's boss to unlock this floor."},
                            )
                if mode == "replay_floor":
                    cleared_this_res = await db.execute(
                        select(GameRun).where(
                            GameRun.user_id == user.id,
                            GameRun.dungeon_id == dungeon.id,
                            GameRun.floor_id == floor_id,
                            GameRun.status == "completed",
                        )
                    )
                    if not cleared_this_res.scalar_one_or_none():
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail={"code": "FLOOR_NOT_CLEARED", "message": "Cannot replay a floor that has not been cleared yet."},
                        )
            else:
                target_rooms = sorted_all_rooms

    # Create run
    run = GameRun(
        user_id=user.id,
        dungeon_id=dungeon.id,
        floor_id=floor_id,
        mode=mode,
        current_hp=100,
        current_score=0,
        current_streak=0,
        xp_earned=0,
        status="active",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # Build initial rooms state for this run
    total_target_rooms = len(target_rooms)
    room_states = [
        RunRoomState(
            room_id=r.id,
            room_number=idx + 1,
            topic_name=r.topic.name if r.topic else "General",
            monster_name=r.monster_type,
            monster_max_hp=r.monster_hp,
            monster_current_hp=r.monster_hp,
            is_cleared=False,
            is_boss=(idx == total_target_rooms - 1),
        )
        for idx, r in enumerate(target_rooms)
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
        room_ids=[r.id for r in target_rooms],
        floor_id=floor_id,
        mode=mode if mode != "full" else None,
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

    # Calculate room monster remaining HP
    sorted_all_rooms = sorted(run.dungeon.rooms, key=lambda x: x.room_order)
    final_boss_room = sorted_all_rooms[-1] if sorted_all_rooms else None
    target_rooms = sorted_all_rooms

    if run.floor_id:
        if final_boss_room and (run.floor_id == final_boss_room.id or run.floor_id == "final_boss"):
            target_rooms = [final_boss_room]
        else:
            matching = [r for r in sorted_all_rooms if r.floor_id == run.floor_id]
            if matching:
                target_rooms = matching

    total_target_rooms = len(target_rooms)
    room_states = []
    for idx, r in enumerate(target_rooms):
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
                room_number=idx + 1,
                topic_name=r.topic.name if r.topic else "General",
                monster_name=r.monster_type,
                monster_max_hp=r.monster_hp,
                monster_current_hp=current_monster_hp,
                is_cleared=is_cleared,
                is_boss=(idx == total_target_rooms - 1),
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
        mode=run.mode if run.mode != "full" else None,
    )


_PROCESSED_ATTEMPTS: dict[str, AttemptResponse] = {}
_QUESTION_CACHE: dict[str, Question] = {}
_RUN_TOPIC_DAMAGE: dict[tuple[str, str], int] = {}


@runs_router.post("/{id}/attempts", response_model=AttemptResponse, response_model_exclude_none=True)
async def submit_attempt(
    id: str,
    req: AttemptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fast in-memory idempotency check (0ms)
    if req.attempt_id and req.attempt_id in _PROCESSED_ATTEMPTS:
        return _PROCESSED_ATTEMPTS[req.attempt_id]

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
        existing_attempt_res = await db.execute(
            select(Attempt).where(Attempt.id == req.attempt_id, Attempt.run_id == id).limit(1)
        )
        existing_attempt = existing_attempt_res.scalar_one_or_none()

    if existing_attempt:
        cached_q_res = await db.execute(select(Question).where(Question.id == existing_attempt.question_id))
        cached_q = cached_q_res.scalar_one_or_none()
        remaining_hp = 0
        cached_correct_answer = None
        cached_combo = None
        cached_requeue = None
        if cached_q:
            target_r = next((r for r in run.dungeon.rooms if r.topic_id == cached_q.topic_id), None)
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
                cached_requeue = 3
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
            requeue_after=cached_requeue,
        )
        if req.attempt_id:
            _PROCESSED_ATTEMPTS[req.attempt_id] = replayed_resp
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

    # Determine target room
    target_room = next((r for r in run.dungeon.rooms if r.topic_id == question.topic_id), None)

    # Compute damage dealt per topic in this run (leveraging memory cache)
    dmg_cache_key = (id, target_room.topic_id) if target_room else None
    if dmg_cache_key and dmg_cache_key in _RUN_TOPIC_DAMAGE:
        topic_damage = {target_room.topic_id: _RUN_TOPIC_DAMAGE[dmg_cache_key]}
    else:
        damage_rows = await db.execute(
            select(Question.topic_id, func.coalesce(func.sum(Attempt.damage_dealt), 0))
            .join(Question, Attempt.question_id == Question.id)
            .where(Attempt.run_id == id)
            .group_by(Question.topic_id)
        )
        topic_damage = {r[0]: r[1] for r in damage_rows.all()}
        if dmg_cache_key:
            _RUN_TOPIC_DAMAGE[dmg_cache_key] = topic_damage.get(target_room.topic_id, 0)

    if target_room:
        for r in sorted(run.dungeon.rooms, key=lambda x: x.room_order):
            if r.room_order < target_room.room_order:
                dmg = topic_damage.get(r.topic_id, 0)
                if dmg < r.monster_hp:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={"code": "OUT_OF_ORDER_ROOM", "message": f"Must defeat room {r.room_order + 1} before challenging room {target_room.room_order + 1}."},
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

    # Find room to check if boss
    is_boss = False
    total_rooms = len(run.dungeon.rooms)
    if target_room:
        is_boss = (target_room.room_order == total_rooms - 1)

    # 4. Authoritative Damage Calculation
    damage_dealt, damage_taken, is_critical = calculate_combat_damage(
        weapon_name=req.weapon_name,
        difficulty=question.difficulty,
        current_streak=run.current_streak,
        is_correct=is_correct,
        is_boss=is_boss,
    )

    # Update in-memory topic damage tally
    if dmg_cache_key:
        _RUN_TOPIC_DAMAGE[dmg_cache_key] = _RUN_TOPIC_DAMAGE.get(dmg_cache_key, 0) + damage_dealt

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
        requeue_after=3 if not is_correct else None,
    )

    if req.attempt_id:
        _PROCESSED_ATTEMPTS[req.attempt_id] = final_resp

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

    # Find room
    room = next((r for r in run.dungeon.rooms if r.id == room_id), None)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "ROOM_NOT_FOUND", "message": "Room not found."})

    # Calculate damage dealt to this room monster
    dmg_dealt = sum(a.damage_dealt for a in run.attempts if a.question and a.question.topic_id == room.topic_id)
    if dmg_dealt < room.monster_hp:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "MONSTER_ALIVE", "message": f"Monster is still alive ({room.monster_hp - dmg_dealt} HP remaining)."},
        )

    # Award XP: 25 for normal topic room, 100 for boss room
    total_rooms = len(run.dungeon.rooms)
    is_boss = (room.room_order == total_rooms - 1)
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

    sorted_all_rooms = sorted(run.dungeon.rooms, key=lambda x: x.room_order)
    final_boss_room = sorted_all_rooms[-1] if sorted_all_rooms else None
    run_rooms = sorted_all_rooms

    if run.floor_id:
        if final_boss_room and (run.floor_id == final_boss_room.id or run.floor_id == "final_boss"):
            run_rooms = [final_boss_room]
        else:
            matching = [r for r in sorted_all_rooms if r.floor_id == run.floor_id]
            if matching:
                run_rooms = matching

    # Check boss room of this run cleared
    boss_room = run_rooms[-1] if run_rooms else None
    if boss_room:
        boss_dmg = sum(a.damage_dealt for a in run.attempts if a.question and a.question.topic_id == boss_room.topic_id)
        if boss_dmg < boss_room.monster_hp:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "BOSS_NOT_CLEARED", "message": "Cannot finish run until boss monster is defeated."},
            )

    total_rooms = len(run.dungeon.rooms)
    if run.status == "active":
        run.status = "completed"
        run.finished_at = datetime.utcnow()

        # Update UserProgress (P3 fix)
        prog_res = await db.execute(select(UserProgress).where(UserProgress.user_id == user.id))
        user_prog = prog_res.scalar_one_or_none()
        if not user_prog:
            user_prog = UserProgress(user_id=user.id, total_xp=0, level=1, unlocked_weapons=["Rusty Dagger"])
            db.add(user_prog)

        user_prog.total_xp += run.xp_earned

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
            if rule(level=user_prog.level, xp=user_prog.total_xp, cleared_rooms=total_rooms, boss_cleared=1):
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
    if current_pack:
        # Check next pack
        next_pack_res = await db.execute(select(ContentPack).where(ContentPack.order == current_pack.order + 1))
        next_pack = next_pack_res.scalar_one_or_none()

        # Check all packs complete
        all_packs_res = await db.execute(select(ContentPack))
        all_packs = all_packs_res.scalars().all()
        user_cleared_res = await db.execute(
            select(GameRun.dungeon_id).where(
                GameRun.user_id == user.id,
                GameRun.status == "completed",
            )
        )
        cleared_dungeon_ids = set(user_cleared_res.scalars().all())
        all_completed = all(p.dungeon_id in cleared_dungeon_ids for p in all_packs)

        # Only the first completion of a pack reports the unlock; replays get null.
        earlier_res = await db.execute(
            select(GameRun.id).where(
                GameRun.user_id == user.id,
                GameRun.dungeon_id == run.dungeon_id,
                GameRun.status == "completed",
                GameRun.id != run.id,
                GameRun.finished_at < run.finished_at,
            ).limit(1)
        )
        first_completion = earlier_res.scalar_one_or_none() is None

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
    if run.floor_id or run.mode == "floor":
        floor_rank = "S" if accuracy >= 0.90 else ("A" if accuracy >= 0.80 else ("B" if accuracy >= 0.60 else "C"))

    mastery_by_topic = []
    seen_topics = set()
    for r in run_rooms:
        if r.topic and r.topic.id not in seen_topics:
            seen_topics.add(r.topic.id)
            t_attempts = [a for a in run.attempts if a.question and a.question.topic_id == r.topic.id]
            t_correct = sum(1 for a in t_attempts if a.is_correct)
            m_val = int(round((t_correct / len(t_attempts)) * 100)) if t_attempts else 0
            mastery_by_topic.append({"topic_id": r.topic.id, "title": r.topic.name, "mastery": m_val})

    chest_rewards = None
    if run.floor_id or run.mode == "floor":
        chest_rewards = [
            {"id": f"cr_{run.id[:8]}", "kind": "xp", "label": "Bonus XP", "amount": 40}
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
