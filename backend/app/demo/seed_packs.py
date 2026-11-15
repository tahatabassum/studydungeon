import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.demo.packs_validator import load_all_packs
from app.models.all_models import (
    ContentPack,
    Document,
    DocumentChunk,
    Dungeon,
    DungeonRoom,
    Question,
    Topic,
    User,
)

logger = logging.getLogger("studydungeon.seed_packs")


async def seed_content_packs(db: AsyncSession) -> list[ContentPack]:
    """
    Idempotently seed the 3 reviewed packs into the database.
    Re-seed only when a pack is missing or has a newer version.
    """
    # 1. Ensure system_demo user exists
    sys_user_res = await db.execute(select(User).where(User.username == "system_demo"))
    sys_user = sys_user_res.scalar_one_or_none()
    if not sys_user:
        sys_user = User(username="system_demo", is_guest=False, is_system=True, password_hash=None)
        db.add(sys_user)
        await db.flush()

    packs_data = load_all_packs()
    seeded_packs = []

    for p_data in packs_data:
        pack_id = p_data["id"]
        res = await db.execute(select(ContentPack).where(ContentPack.id == pack_id))
        existing_pack = res.scalar_one_or_none()

        if existing_pack:
            # Packs seeded before this fix used 1-based room_order; run logic is 0-based
            # (boss = room_order == total_rooms - 1). Shift those rows down once.
            rooms_res = await db.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == existing_pack.dungeon_id))
            existing_rooms = rooms_res.scalars().all()
            offset = min((r.room_order for r in existing_rooms), default=0)
            # They also stored the role ("minion", "floor_boss") as the monster name.
            names = {rm["id"]: rm.get("monster_name") for f in p_data["floors"] for rm in f["rooms"]}
            if p_data.get("final_boss_room"):
                names[p_data["final_boss_room"]["id"]] = p_data["final_boss_room"].get("monster_name")
            renamed = False
            for r in existing_rooms:
                if names.get(r.id) and r.monster_type != names[r.id]:
                    r.monster_type = names[r.id]
                    renamed = True
            if offset > 0:
                for r in existing_rooms:
                    r.room_order -= offset
            # Ensure Pack 1's dungeon is marked is_public_demo = True
            if pack_id == "pack-1":
                d_res = await db.execute(select(Dungeon).where(Dungeon.id == existing_pack.dungeon_id))
                d_obj = d_res.scalar_one_or_none()
                if d_obj and not d_obj.is_public_demo:
                    d_obj.is_public_demo = True
                    renamed = True
            if offset > 0 or renamed:
                await db.commit()
            seeded_packs.append(existing_pack)
            continue

        # Create Document for Pack
        doc = Document(
            user_id=sys_user.id,
            title=p_data["title"],
            original_filename=f"{pack_id}.json",
            file_type="json",
            status="accepted",
            relevance_score=1.0,
            readability_score=1.0,
        )
        db.add(doc)
        await db.flush()

        # Create Dungeon
        is_demo = (pack_id == "pack-1")  # Pack 1 serves as the public demo dungeon
        dungeon = Dungeon(
            user_id=sys_user.id,
            document_id=doc.id,
            title=p_data["title"],
            is_public_demo=is_demo,
        )
        db.add(dungeon)
        await db.flush()

        # Create Floors & Rooms
        room_order = 0  # 0-based, matching seed.py and the run logic
        for floor in p_data["floors"]:
            floor_id = floor["id"]
            for room in floor["rooms"]:
                # Create Topic & Chunk
                topic = Topic(
                    document_id=doc.id,
                    user_id=sys_user.id,
                    name=room["topic_name"],
                    description=f"{floor['title']} topic",
                    order_index=room_order,
                )
                db.add(topic)
                await db.flush()

                chunk = DocumentChunk(
                    document_id=doc.id,
                    user_id=sys_user.id,
                    chunk_index=room_order,
                    text=f"Study notes for {room['topic_name']}.",
                    page_number=floor["index"],
                    slide_number=None,
                    source_meta={},
                )
                db.add(chunk)
                await db.flush()

                d_room = DungeonRoom(
                    id=room["id"],
                    dungeon_id=dungeon.id,
                    topic_id=topic.id,
                    room_order=room_order,
                    monster_type=room.get("monster_name") or room["monster_type"],
                    monster_hp=room["monster_hp"],
                    floor_id=floor_id,
                    monster_kind=room.get("monster_kind", "paper_wraith"),
                )
                db.add(d_room)
                await db.flush()

                # Add questions
                for q_spec in room["questions"]:
                    question = Question(
                        id=q_spec["id"],
                        topic_id=topic.id,
                        source_chunk_id=chunk.id,
                        prompt=q_spec["prompt"],
                        options=q_spec["options"],
                        correct_option=q_spec["correct_option"],
                        difficulty=q_spec.get("difficulty", "medium"),
                        evidence_quote=q_spec["evidence_quote"],
                        explanation=q_spec.get("explanation"),
                    )
                    db.add(question)
                room_order += 1

        # Create Final Boss Room
        final_room = p_data.get("final_boss_room")
        if final_room:
            topic = Topic(
                document_id=doc.id,
                user_id=sys_user.id,
                name=final_room["topic_name"],
                description="Final Boss room",
                order_index=room_order,
            )
            db.add(topic)
            await db.flush()

            chunk = DocumentChunk(
                document_id=doc.id,
                user_id=sys_user.id,
                chunk_index=room_order,
                text=f"Final exam notes for {p_data['title']}.",
                page_number=p_data["floors_total"] + 1,
                slide_number=None,
                source_meta={},
            )
            db.add(chunk)
            await db.flush()

            fb_room = DungeonRoom(
                id=final_room["id"],
                dungeon_id=dungeon.id,
                topic_id=topic.id,
                room_order=room_order,
                monster_type=final_room.get("monster_name") or final_room["monster_type"],
                monster_hp=final_room["monster_hp"],
                floor_id=None,  # Final boss is not part of normal floors
                monster_kind=final_room.get("monster_kind", "exam_warden"),
            )
            db.add(fb_room)
            await db.flush()

            for q_spec in final_room["questions"]:
                question = Question(
                    id=q_spec["id"],
                    topic_id=topic.id,
                    source_chunk_id=chunk.id,
                    prompt=q_spec["prompt"],
                    options=q_spec["options"],
                    correct_option=q_spec["correct_option"],
                    difficulty=q_spec.get("difficulty", "hard"),
                    evidence_quote=q_spec["evidence_quote"],
                    explanation=q_spec.get("explanation"),
                )
                db.add(question)

        # Create ContentPack record
        pack_rec = ContentPack(
            id=pack_id,
            order=p_data["order"],
            title=p_data["title"],
            description=p_data["description"],
            dungeon_id=dungeon.id,
            floors_total=p_data["floors_total"],
            version=1,
        )
        db.add(pack_rec)
        await db.commit()
        seeded_packs.append(pack_rec)
        logger.info("Successfully seeded content pack: %s (Dungeon ID: %s)", pack_id, dungeon.id)

    return seeded_packs
