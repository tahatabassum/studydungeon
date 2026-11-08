import pytest
from httpx import AsyncClient
from hypothesis import given
from hypothesis import strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import Document, DocumentChunk, User


@pytest.mark.asyncio
async def test_guest_cannot_generate_dungeon(async_client: AsyncClient, db_session: AsyncSession):
    """Guests (is_guest=True) must be blocked from POST /documents/{id}/generate-dungeon with 403."""
    guest = User(username="guest_dungeon_user", is_guest=True, password_hash=None)
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)

    token = create_session_token(guest.id, session_version=guest.session_version, is_guest=True)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = await async_client.post("/documents/some-doc-id/generate-dungeon")
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] in ("GUEST_FORBIDDEN", "GUEST_RESTRICTED")


@pytest.mark.asyncio
async def test_dungeon_generation_and_answer_hiding_in_detail_view(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test full dungeon generation flow:
    1. Registered user creates document and chunks.
    2. Calls POST /documents/{id}/generate-dungeon.
    3. GET /dungeons lists the dungeon + public demo.
    4. GET /dungeons/{id} returns room layouts and questions BUT NEVER reveals correct_option or explanations.
    """
    user = User(username="dungeon_master", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    doc = Document(
        user_id=user.id,
        title="Distributed Systems",
        original_filename="dist_sys.txt",
        file_type="txt",
        status="accepted",
        relevance_score=0.95,
        readability_score=0.90,
    )
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)

    chunk = DocumentChunk(
        document_id=doc.id,
        user_id=user.id,
        chunk_index=0,
        text="The Raft consensus algorithm relies on leader election and log replication for consistency.",
        page_number=1,
    )
    db_session.add(chunk)
    await db_session.commit()

    token = create_session_token(user.id, session_version=user.session_version, is_guest=False)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Generate Dungeon
    gen_resp = await async_client.post(f"/documents/{doc.id}/generate-dungeon")
    assert gen_resp.status_code == 201
    dungeon_data = gen_resp.json()
    dungeon_id = dungeon_data["id"]
    assert len(dungeon_data["rooms"]) >= 1

    # 2. List Dungeons
    list_resp = await async_client.get("/dungeons")
    assert list_resp.status_code == 200
    dungeons = list_resp.json()
    assert any(d["id"] == dungeon_id for d in dungeons)

    # 3. GET /dungeons/{id} layout: verify answers and explanations are NEVER leaked during gameplay
    detail_resp = await async_client.get(f"/dungeons/{dungeon_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    for room in detail["rooms"]:
        for q in room["questions"]:
            assert "correct_option" not in q, "Security leak: correct_option exposed in gameplay endpoint!"
            assert "explanation" not in q, "Security leak: explanation exposed in gameplay endpoint!"
            assert "evidence_quote" not in q, "Security leak: evidence_quote exposed in gameplay endpoint!"


def verify_evidence_quote_in_chunk(evidence_quote: str, chunk_text: str) -> bool:
    """Deterministic validation: evidence quote must be a verbatim substring."""
    return bool(evidence_quote and evidence_quote.strip() in chunk_text)


@given(
    st.text(min_size=10, max_size=50),
    st.text(min_size=100, max_size=500),
)
def test_pbt_evidence_quote_invariant(sub_quote, base_text):
    """Hypothesis PBT: Verifies that only true substrings pass evidence quote verification."""
    full_text = f"prefix text {sub_quote} suffix text"
    assert verify_evidence_quote_in_chunk(sub_quote, full_text) is True
    # If quote is randomized or fabricated, verification strictly rejects it
    fabricated = sub_quote + "XYZ_NON_EXISTENT_TOKEN_123"
    assert verify_evidence_quote_in_chunk(fabricated, full_text) is False
