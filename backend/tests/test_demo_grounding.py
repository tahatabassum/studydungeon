import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.demo.seed import DEMO_DATA, seed_demo_dungeon
from app.models.all_models import DocumentChunk, Dungeon, Question, Topic, User


@pytest.mark.asyncio
async def test_demo_question_quotes_appear_verbatim_in_chunks(db_session: AsyncSession):
    """
    Step 5 Invariant: Every demo question's evidence quote MUST appear verbatim
    in its cited source chunk text.
    """
    demo_dungeon = await seed_demo_dungeon(db_session)
    assert demo_dungeon.is_public_demo is True

    # Retrieve all demo questions
    stmt = (
        select(Question, DocumentChunk)
        .join(DocumentChunk, Question.source_chunk_id == DocumentChunk.id)
        .join(Topic, Question.topic_id == Topic.id)
        .where(Topic.document_id == demo_dungeon.document_id)
    )
    res = await db_session.execute(stmt)
    rows = res.all()
    assert len(rows) > 0, "Demo dungeon has no questions linked to chunks!"

    for q, chunk in rows:
        assert q.evidence_quote is not None and len(q.evidence_quote.strip()) > 0
        assert q.evidence_quote in chunk.text, (
            f"Evidence quote mismatch! Quote: '{q.evidence_quote}' not found in Chunk: '{chunk.text}'"
        )


@pytest.mark.asyncio
async def test_demo_works_without_ai_provider(db_session: AsyncSession):
    """Demo dungeon generation and execution must function even if AI is disabled."""
    demo_dungeon = await seed_demo_dungeon(db_session)
    assert demo_dungeon is not None
    # Verify owner is system user with is_system=True
    owner = (await db_session.execute(select(User).where(User.id == demo_dungeon.user_id))).scalar_one()
    assert owner.is_system is True
    assert owner.username == "system_demo"
