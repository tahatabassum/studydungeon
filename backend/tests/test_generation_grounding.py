import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import set_ai_provider
from app.ai.mock_provider import MockAIProvider
from app.ai.provider import GeneratedQuestionItem, GeneratedTopicItem
from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import Document, DocumentChunk, Question, User

CHUNKS = [
    "Arrays store elements in contiguous memory locations.",
    "The address of element i is base + i * size, which makes access constant time.",
]


def _q(quote: str, options=None, correct=0) -> GeneratedQuestionItem:
    return GeneratedQuestionItem(
        prompt="Pick one", options=options or ["A", "B", "C", "D"], correct_option=correct,
        difficulty="easy", evidence_quote=quote, explanation="x",
    )


class GroundingProvider(MockAIProvider):
    async def build_topics_and_questions(self, chunks):
        return [
            # Quote from the second chunk with different spacing: kept.
            GeneratedTopicItem(name="Addressing", description="d", source_chunk_ids=[1],
                               questions=[_q("base +  i * size"), _q("not in the notes at all")]),
            # Nothing grounded, or malformed: the topic gets no room.
            GeneratedTopicItem(name="Invented", description="d", source_chunk_ids=[0],
                               questions=[_q("made up quote"), _q("Arrays store elements", options=["only one"])]),
            GeneratedTopicItem(name="Storage", description="d", source_chunk_ids=[0],
                               questions=[_q("contiguous memory locations"), _q("Arrays store", correct=9)]),
        ]


@pytest.mark.asyncio
async def test_generation_keeps_quotes_from_any_chunk_and_never_sends_null_floor_id(async_client: AsyncClient, db_session: AsyncSession):
    user = User(username="grounding_tester", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    doc = Document(user_id=user.id, title="Arrays", original_filename="a.pdf", file_type="pdf", status="accepted")
    db_session.add(doc)
    await db_session.commit()
    for i, text in enumerate(CHUNKS):
        db_session.add(DocumentChunk(document_id=doc.id, user_id=user.id, chunk_index=i, text=text, page_number=i + 1))
    await db_session.commit()
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version, is_guest=False))

    set_ai_provider(GroundingProvider())
    try:
        resp = await async_client.post(f"/documents/{doc.id}/generate-dungeon")
    finally:
        set_ai_provider(MockAIProvider())
    assert resp.status_code == 201, resp.text
    rooms = resp.json()["rooms"]
    assert [r["topic_name"] for r in rooms] == ["Addressing", "Storage"]
    assert [len(r["questions"]) for r in rooms] == [1, 1]
    # Never a null floor_id: floor rooms carry their floor, the Final_Boss room has none at all.
    assert all(r.get("floor_id", "absent") is not None for r in rooms)
    assert isinstance(rooms[0]["floor_id"], str)
    assert "floor_id" not in rooms[-1]
    assert rooms[-1]["is_boss"] is True
    body = resp.json()
    assert [f["room_ids"] for f in body["floors"]] == [[rooms[0]["id"]]]
    assert body["floors"][0]["status"] == "ready"
    assert body["final_boss"] == {**body["final_boss"], "id": rooms[-1]["id"], "unlocked": False}
    total = (await db_session.execute(select(func.count(Question.id)))).scalar_one()
    assert total == 2


@pytest.mark.asyncio
async def test_generation_with_no_grounded_question_is_a_clear_error(async_client: AsyncClient, db_session: AsyncSession):
    class Nothing(MockAIProvider):
        async def build_topics_and_questions(self, chunks):
            return [GeneratedTopicItem(name="T", description="d", source_chunk_ids=[0], questions=[_q("invented")])]

    user = User(username="grounding_none", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    doc = Document(user_id=user.id, title="Arrays", original_filename="a.pdf", file_type="pdf", status="accepted")
    db_session.add(doc)
    await db_session.commit()
    db_session.add(DocumentChunk(document_id=doc.id, user_id=user.id, chunk_index=0, text=CHUNKS[0], page_number=1))
    await db_session.commit()
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version, is_guest=False))

    set_ai_provider(Nothing())
    try:
        resp = await async_client.post(f"/documents/{doc.id}/generate-dungeon")
    finally:
        set_ai_provider(MockAIProvider())
    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "GENERATION_FAILED"
