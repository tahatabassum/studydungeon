from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.factory import get_ai_provider
from app.ai.provider import ExtractedChunk
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import (
    Attempt,
    ContentPack,
    Document,
    DocumentChunk,
    Dungeon,
    DungeonRoom,
    GameRun,
    Question,
    Topic,
    User,
)
from app.schemas.dungeons import DungeonDetailView, DungeonRoomView, DungeonSummary, QuestionGameplayView
from app.services.progression import counts_for_progress, floor_ids_in_order, is_full_run, progress_from_runs

dungeons_router = APIRouter(tags=["dungeons"])


def _floor_plan(dungeon_id: str, total_topics: int) -> List[Optional[str]]:
    """Floor id for each topic room: pairs of rooms per floor, the last room (Final_Boss) on no floor."""
    if total_topics <= 1:
        return [None] * total_topics
    plan: List[Optional[str]] = []
    for idx in range(total_topics - 1):
        plan.append(f"{dungeon_id[:8]}-f{idx // 2 + 1}")
    plan.append(None)
    return plan


@dungeons_router.get("/documents/{id}/topics")
async def get_document_topics(
    id: str,
    # Guests may upload within their quota (frontend-10), so they may also read their own topics and summon.
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Topic).where(Topic.document_id == id, Topic.user_id == user.id))
    topics = res.scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "order_index": t.order_index} for t in topics]


@dungeons_router.post(
    "/documents/{id}/generate-dungeon",
    status_code=status.HTTP_201_CREATED,
    response_model=DungeonDetailView,
    # Same shape as GET /dungeons/{id}: absent, not null (the frontend rejects floor_id: null).
    response_model_exclude_none=True,
)
async def generate_dungeon(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify document exists and belongs to user
    doc_res = await db.execute(select(Document).where(Document.id == id, Document.user_id == user.id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found or does not belong to user."},
        )

    # Check if dungeon already exists for this document (idempotent summon)
    existing_dungeon_res = await db.execute(
        select(Dungeon)
        .options(
            selectinload(Dungeon.rooms).selectinload(DungeonRoom.topic).selectinload(Topic.questions)
        )
        .where(Dungeon.document_id == doc.id, Dungeon.user_id == user.id)
    )
    existing_dungeon = existing_dungeon_res.scalar_one_or_none()
    if existing_dungeon:
        return await get_dungeon_detail(id=existing_dungeon.id, user=user, db=db)

    # Fetch chunks
    chunks_res = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index.asc())
    )
    chunks = chunks_res.scalars().all()
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_CHUNKS_AVAILABLE", "message": "Document has no extracted chunks available for dungeon generation."},
        )

    # Call AI Provider
    ai = get_ai_provider()
    ai_chunks = [
        ExtractedChunk(chunk_index=c.chunk_index, text=c.text, page_number=c.page_number)
        for c in chunks
    ]
    generated_topics = await ai.build_topics_and_questions(ai_chunks)
    if not generated_topics:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "GENERATION_FAILED", "message": "AI failed to cluster topics and generate grounded questions."},
        )

    # Keep only questions whose evidence quote appears verbatim (whitespace & quote normalized) in some chunk,
    # with at least 2 options and a valid answer index. A topic left with no questions gets no room.
    def _norm(s: str) -> str:
        s = (s or "").lower()
        s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("—", "-").replace("–", "-")
        return " ".join(s.split())

    norm_chunks = [(c, _norm(c.text)) for c in chunks]

    def _grounded(q):
        quote = _norm(q.evidence_quote)
        if not quote or len(q.options or []) < 2 or not (0 <= q.correct_option < len(q.options)):
            return None
        # 1. Exact normalized match in any chunk
        for c, text in norm_chunks:
            if quote in text:
                return c
        # 2. Window match for long quotes (first or last 6 words)
        words = quote.split()
        if len(words) >= 6:
            lead = " ".join(words[:6])
            tail = " ".join(words[-6:])
            for c, text in norm_chunks:
                if lead in text or tail in text:
                    return c
        return None

    kept = []
    for t_data in generated_topics:
        qs = [(q, src) for q in t_data.questions if (src := _grounded(q)) is not None]
        if qs:
            kept.append((t_data, qs))
    if not kept:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "GENERATION_FAILED",
                "message": "The AI could not write enough questions grounded in these notes. Try again or upload a longer document.",
            },
        )

    # Create Dungeon
    dungeon = Dungeon(
        user_id=user.id,
        document_id=doc.id,
        title=f"{doc.title} Dungeon",
        is_public_demo=False,
    )
    db.add(dungeon)
    await db.flush()

    total_topics = len(kept)
    rooms_view: List[DungeonRoomView] = []
    MONSTER_KINDS = ["paper_wraith", "toxic_slime", "gear_golem", "memory_eater"]
    # Floors like the packs: 2 topic rooms per floor (the second holds the floor boss), the last topic is the
    # Final_Boss outside every floor. One topic: a single boss room, no floors.
    floor_of = _floor_plan(dungeon.id, total_topics)

    for idx, (t_data, grounded_qs) in enumerate(kept):
        topic = Topic(
            document_id=doc.id,
            user_id=user.id,
            name=t_data.name,
            description=t_data.description,
            order_index=idx,
        )
        db.add(topic)
        await db.flush()

        is_boss = (idx == total_topics - 1)
        floor_id = floor_of[idx]
        is_floor_boss = (not is_boss) and floor_id is not None and (idx + 1 >= total_topics - 1 or floor_of[idx + 1] != floor_id)
        if is_boss:
            monster_name = "Spectral Overlord"
        elif is_floor_boss:
            monster_name = f"Warden of {t_data.name[:16]}"
        else:
            monster_name = f"Guardian of {t_data.name[:16]}"
        # Dynamic HP matching question count so questions do not loop unnecessarily
        num_qs = len(grounded_qs)
        if is_boss:
            monster_hp = min(120, max(40, num_qs * 20))
        elif is_floor_boss:
            monster_hp = min(100, max(30, num_qs * 20))
        else:
            monster_hp = min(80, max(20, num_qs * 20))

        room = DungeonRoom(
            dungeon_id=dungeon.id,
            topic_id=topic.id,
            room_order=idx,
            monster_type=monster_name,
            monster_hp=monster_hp,
            floor_id=floor_id,
            monster_kind="exam_warden" if is_boss else MONSTER_KINDS[idx % len(MONSTER_KINDS)],
        )
        db.add(room)
        await db.flush()

        q_views: List[QuestionGameplayView] = []
        for q, src_chunk in grounded_qs:
            q_record = Question(
                topic_id=topic.id,
                source_chunk_id=src_chunk.id,
                question_type="mcq",
                difficulty=q.difficulty,
                prompt=q.prompt,
                options=q.options,
                correct_option=q.correct_option,
                evidence_quote=q.evidence_quote,
                explanation=q.explanation,
            )
            db.add(q_record)
            await db.flush()

            q_views.append(
                QuestionGameplayView(
                    id=q_record.id,
                    prompt=q_record.prompt,
                    options=q_record.options,
                    difficulty=q_record.difficulty,
                )
            )

        rooms_view.append(
            DungeonRoomView(
                id=room.id,
                room_number=idx + 1,
                topic_name=topic.name,
                monster_name=monster_name,
                monster_type=room.monster_type,
                monster_hp=room.monster_hp,
                is_boss=is_boss,
                questions=q_views,
            )
        )

    await db.commit()
    # Same shape as GET /dungeons/{id}, floors and Final_Boss included.
    return await get_dungeon_detail(id=dungeon.id, user=user, db=db)


@dungeons_router.get("/dungeons", response_model=List[DungeonSummary])
async def list_dungeons(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Returns dungeons owned by user OR public demo dungeons (excluding old legacy demo if pack 1 exists)
    pack1_dungeon_id_subq = select(ContentPack.dungeon_id).where(ContentPack.order == 1)
    stmt = (
        select(Dungeon)
        .options(selectinload(Dungeon.rooms))
        .where(
            or_(
                Dungeon.user_id == user.id,
                and_(
                    Dungeon.is_public_demo == True,
                    Dungeon.title != "Computer Systems & Architecture (Seeded Demo)"
                ),
                Dungeon.id.in_(pack1_dungeon_id_subq)
            )
        )
        .order_by(Dungeon.created_at.desc())
    )
    res = await db.execute(stmt)
    dungeons = res.scalars().all()
    return [
        DungeonSummary(
            id=d.id,
            title=d.title,
            is_public_demo=d.is_public_demo,
            created_at=d.created_at,
            rooms_count=len(d.rooms),
        )
        for d in dungeons
    ]


@dungeons_router.get("/dungeons/{id}", response_model=DungeonDetailView, response_model_exclude_none=True)
async def get_dungeon_detail(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Dungeon)
        .options(
            selectinload(Dungeon.rooms).selectinload(DungeonRoom.topic).selectinload(Topic.questions),
        )
        .where(
            Dungeon.id == id,
            or_(
                Dungeon.user_id == user.id,
                Dungeon.is_public_demo == True,
                # Preloaded content packs are readable by every player; POST /runs enforces PACK_LOCKED.
                Dungeon.id.in_(select(ContentPack.dungeon_id)),
            ),
        )
    )
    res = await db.execute(stmt)
    dungeon = res.scalar_one_or_none()
    if not dungeon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DUNGEON_NOT_FOUND", "message": "Dungeon not found or not accessible."},
        )

    rooms_view = []
    total_rooms = len(dungeon.rooms)
    for r in sorted(dungeon.rooms, key=lambda x: x.room_order):
        q_views = [
            QuestionGameplayView(
                id=q.id,
                prompt=q.prompt,
                options=q.options,
                difficulty=q.difficulty,
            )
            for q in (r.topic.questions if r.topic else [])
        ]
        is_boss = (r.room_order == total_rooms - 1)
        rooms_view.append(
            DungeonRoomView(
                id=r.id,
                room_number=r.room_order + 1,
                topic_name=r.topic.name if r.topic else "General",
                monster_name=r.monster_type,
                monster_type=r.monster_type,
                monster_hp=r.monster_hp,
                is_boss=is_boss,
                floor_id=r.floor_id,
                monster_kind=r.monster_kind or ("exam_warden" if is_boss else "paper_wraith"),
                questions=q_views,
            )
        )

    # Build floors & final_boss representation if floors exist
    floors_view = None
    final_boss_view = None

    # Group rooms with floor_id
    floor_rooms_map = {}
    final_boss_room = None
    for r in dungeon.rooms:
        if r.floor_id:
            floor_rooms_map.setdefault(r.floor_id, []).append(r)
        elif r.room_order == total_rooms - 1:
            final_boss_room = r

    if floor_rooms_map:
        # Load pack metadata if available for floor titles and boss metadata
        from app.demo.packs_validator import load_all_packs
        pack_meta_map = {}
        for p in load_all_packs():
            for f in p.get("floors", []):
                pack_meta_map[f["id"]] = f

        # Query completed runs for this user and dungeon
        runs_res = await db.execute(
            select(GameRun)
            .options(selectinload(GameRun.attempts).selectinload(Attempt.question))
            .where(
                GameRun.user_id == user.id,
                GameRun.dungeon_id == dungeon.id,
                GameRun.status == "completed",
            )
        )
        completed_runs = runs_res.scalars().all()
        prog = progress_from_runs(completed_runs, dungeon.rooms)
        dungeon_cleared = prog.final_boss_cleared
        # Practice and review runs never count for floors, ranks or mastery on the map.
        completed_runs = [r for r in completed_runs if counts_for_progress(r)]

        from app.schemas.dungeons import DungeonFloorView, FinalBossView, FloorBossView, FloorTopicView
        floors_view = []
        # Floors in room order (not alphabetical), cleared by a floor run or a full clear
        sorted_floor_ids = floor_ids_in_order(dungeon.rooms)
        cleared_floors = set(prog.cleared_floor_ids)

        rank_weight = {"S": 4, "A": 3, "B": 2, "C": 1}

        for f_idx, f_id in enumerate(sorted_floor_ids, start=1):
            f_rooms = sorted(floor_rooms_map[f_id], key=lambda x: x.room_order)
            f_boss_room = f_rooms[-1]
            floor_topic_ids = {rm.topic_id for rm in f_rooms if rm.topic_id}

            # Topic mastery calculation from user's attempts in completed runs
            f_topics = []
            for rm in f_rooms:
                if not rm.topic:
                    continue
                t_attempts = [
                    a for r in completed_runs
                    for a in r.attempts
                    if a.question and a.question.topic_id == rm.topic_id
                ]
                if t_attempts:
                    t_correct = sum(1 for a in t_attempts if a.is_correct)
                    m_val = int(round((t_correct / len(t_attempts)) * 100))
                else:
                    m_val = 0
                f_topics.append(FloorTopicView(id=rm.topic_id, title=rm.topic.name, mastery=m_val))

            f_meta = pack_meta_map.get(f_id, {})
            f_title = f_meta.get("title") or f"Floor {f_idx}: {f_rooms[0].topic.name if f_rooms[0].topic else 'Chamber'}"
            boss_meta = f_meta.get("boss", {})
            boss_name = boss_meta.get("name") or f_boss_room.monster_type
            boss_kind = boss_meta.get("kind") or f_boss_room.monster_kind or "silicon_golem"

            # Determine best rank on this floor among completed runs covering this floor
            floor_runs = [r for r in completed_runs if r.floor_id == f_id or is_full_run(r, dungeon.rooms)]
            best_rank = None
            if floor_runs:
                ranks_for_floor = []
                for r in floor_runs:
                    f_attempts = [
                        a for a in r.attempts
                        if a.question and a.question.topic_id in floor_topic_ids
                    ]
                    if f_attempts:
                        acc = sum(1 for a in f_attempts if a.is_correct) / len(f_attempts)
                        r_rank = "S" if acc >= 0.90 else ("A" if acc >= 0.80 else ("B" if acc >= 0.60 else "C"))
                        ranks_for_floor.append(r_rank)
                if ranks_for_floor:
                    best_rank = max(ranks_for_floor, key=lambda x: rank_weight.get(x, 0))

            # Floor progression status
            is_f_cleared = f_id in cleared_floors
            if is_f_cleared:
                status_str = "cleared"
            elif f_idx == 1:
                status_str = "ready"
            elif sorted_floor_ids[f_idx - 2] in cleared_floors:
                status_str = "ready"
            else:
                status_str = "locked"

            floors_view.append(
                DungeonFloorView(
                    id=f_id,
                    index=f_idx,
                    title=f_title,
                    status=status_str,
                    topics=f_topics,
                    boss=FloorBossView(
                        id=f_boss_room.id,
                        name=boss_name,
                        hp=f_boss_room.monster_hp,
                        kind=boss_kind,
                    ),
                    rank=best_rank,
                    room_ids=[rm.id for rm in f_rooms],
                )
            )

        if final_boss_room:
            all_floors_cleared = len(cleared_floors) == len(sorted_floor_ids)
            final_boss_cleared = dungeon_cleared
            final_boss_view = FinalBossView(
                id=final_boss_room.id,
                name=final_boss_room.monster_type,
                hp=final_boss_room.monster_hp,
                unlocked=all_floors_cleared or final_boss_cleared,
            )

    return DungeonDetailView(
        id=dungeon.id,
        title=dungeon.title,
        is_public_demo=dungeon.is_public_demo,
        created_at=dungeon.created_at,
        rooms=rooms_view,
        floors=floors_view,
        final_boss=final_boss_view,
    )
