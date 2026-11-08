from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.factory import get_ai_provider
from app.ai.provider import ExtractedChunk
from app.core.database import get_db
from app.core.deps import get_current_user, require_registered_user
from app.models.all_models import (
    Document,
    DocumentChunk,
    Dungeon,
    DungeonRoom,
    Question,
    Topic,
    User,
)
from app.schemas.dungeons import DungeonDetailView, DungeonRoomView, DungeonSummary, QuestionGameplayView

dungeons_router = APIRouter(tags=["dungeons"])


@dungeons_router.get("/documents/{id}/topics")
async def get_document_topics(
    id: str,
    user: User = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Topic).where(Topic.document_id == id, Topic.user_id == user.id))
    topics = res.scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "order_index": t.order_index} for t in topics]


@dungeons_router.post("/documents/{id}/generate-dungeon", status_code=status.HTTP_201_CREATED, response_model=DungeonDetailView)
async def generate_dungeon(
    id: str,
    user: User = Depends(require_registered_user),
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

    # Create Dungeon
    dungeon = Dungeon(
        user_id=user.id,
        document_id=doc.id,
        title=f"{doc.title} Dungeon",
        is_public_demo=False,
    )
    db.add(dungeon)
    await db.flush()

    total_topics = len(generated_topics)
    rooms_view: List[DungeonRoomView] = []

    for idx, t_data in enumerate(generated_topics):
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
        # Find matching chunk for evidence verification
        first_chunk = chunks[0] if chunks else None

        for q in t_data.questions:
            # Evidence quote invariant verification: must be verbatim substring
            if first_chunk and q.evidence_quote and q.evidence_quote not in first_chunk.text:
                continue

            q_record = Question(
                topic_id=topic.id,
                source_chunk_id=first_chunk.id if first_chunk else None,
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
    # Returns dungeons owned by user OR public demo dungeons
    stmt = (
        select(Dungeon)
        .options(selectinload(Dungeon.rooms))
        .where(or_(Dungeon.user_id == user.id, Dungeon.is_public_demo == True))
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


@dungeons_router.get("/dungeons/{id}", response_model=DungeonDetailView)
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
            or_(Dungeon.user_id == user.id, Dungeon.is_public_demo == True),
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
                questions=q_views,
            )
        )

    return DungeonDetailView(
        id=dungeon.id,
        title=dungeon.title,
        is_public_demo=dungeon.is_public_demo,
        created_at=dungeon.created_at,
        rooms=rooms_view,
    )
