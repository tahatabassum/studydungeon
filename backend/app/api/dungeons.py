from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.factory import get_ai_provider
from app.ai.provider import ExtractedChunk
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.all_models import (
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

dungeons_router = APIRouter(tags=["dungeons"])


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

    # Keep only questions whose evidence quote appears verbatim (whitespace-normalised) in some chunk,
    # with at least 2 options and a valid answer index. A topic left with no questions gets no room.
    def _norm(s: str) -> str:
        return " ".join((s or "").split()).lower()

    norm_chunks = [(c, _norm(c.text)) for c in chunks]

    def _grounded(q):
        quote = _norm(q.evidence_quote)
        if not quote or len(q.options or []) < 2 or not (0 <= q.correct_option < len(q.options)):
            return None
        return next((c for c, text in norm_chunks if quote in text), None)

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
        monster_name = "Spectral Overlord" if is_boss else f"Guardian of {t_data.name[:16]}"
        monster_hp = 240 if is_boss else 80

        room = DungeonRoom(
            dungeon_id=dungeon.id,
            topic_id=topic.id,
            room_order=idx,
            monster_type=monster_name,
            monster_hp=monster_hp,
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
    await db.refresh(dungeon)

    return DungeonDetailView(
        id=dungeon.id,
        title=dungeon.title,
        is_public_demo=dungeon.is_public_demo,
        created_at=dungeon.created_at,
        rooms=rooms_view,
    )


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

        # One run covers the whole dungeon, so a completed run clears every floor for this player.
        done_res = await db.execute(
            select(GameRun.id)
            .where(GameRun.user_id == user.id, GameRun.dungeon_id == dungeon.id, GameRun.status == "completed")
            .limit(1)
        )
        dungeon_cleared = done_res.scalar_one_or_none() is not None
        from app.schemas.dungeons import DungeonFloorView, FinalBossView, FloorBossView, FloorTopicView
        floors_view = []
        # Sort floor ids deterministically
        sorted_floor_ids = sorted(floor_rooms_map.keys())
        for f_idx, f_id in enumerate(sorted_floor_ids, start=1):
            f_rooms = sorted(floor_rooms_map[f_id], key=lambda x: x.room_order)
            # Find floor boss room (highest room order in this floor)
            f_boss_room = f_rooms[-1]
            f_topics = [
                FloorTopicView(id=rm.topic_id, title=rm.topic.name if rm.topic else "General", mastery=0)
                for rm in f_rooms if rm.topic
            ]
            f_meta = pack_meta_map.get(f_id, {})
            f_title = f_meta.get("title") or f"Floor {f_idx}: {f_rooms[0].topic.name if f_rooms[0].topic else 'Chamber'}"
            boss_meta = f_meta.get("boss", {})
            boss_name = boss_meta.get("name") or f_boss_room.monster_type
            boss_kind = boss_meta.get("kind") or f_boss_room.monster_kind or "silicon_golem"

            floors_view.append(
                DungeonFloorView(
                    id=f_id,
                    index=f_idx,
                    title=f_title,
                    # Frontend contract: ready | locked | cleared | generating | failed.
                    status="cleared" if dungeon_cleared else ("ready" if f_idx == 1 else "locked"),
                    topics=f_topics,
                    boss=FloorBossView(
                        id=f_boss_room.id,
                        name=boss_name,
                        hp=f_boss_room.monster_hp,
                        kind=boss_kind,
                    ),
                    rank=None,
                    room_ids=[rm.id for rm in f_rooms],
                )
            )

        if final_boss_room:
            final_boss_view = FinalBossView(
                id=final_boss_room.id,
                name=final_boss_room.monster_type,
                hp=final_boss_room.monster_hp,
                unlocked=dungeon_cleared,
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
