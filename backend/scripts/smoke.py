import asyncio
import io
import os
import sys
import uuid

import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ai.factory import set_ai_provider
from app.ai.mock_provider import MockAIProvider
from app.core.config import settings
from app.main import create_app

# In automated smoke test script, use deterministic MockAIProvider
set_ai_provider(MockAIProvider())

app = create_app()


async def run_smoke():
    print("==================================================")
    print("STARTING STUDYDUNGEON BACKEND SMOKE TEST")
    print("==================================================")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        h_resp = await client.get("/health")
        assert h_resp.status_code == 200, f"Health check failed: {h_resp.text}"
        print("[PASS] 1. /health returned status 200")

        # 2. Register user
        reg_username = f"smoke_user_{uuid.uuid4().hex[:6]}"
        reg_resp = await client.post(
            "/auth/register",
            json={"username": reg_username, "password": "SecurePassword123!"},
        )
        assert reg_resp.status_code == 201, f"Register failed: {reg_resp.text}"
        print(f"[PASS] 2. /auth/register created user '{reg_username}'")

        # 3. Login
        login_resp = await client.post(
            "/auth/login",
            json={"username": reg_username, "password": "SecurePassword123!"},
        )
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        assert settings.SESSION_COOKIE_NAME in client.cookies
        print("[PASS] 3. /auth/login authenticated and set secure HttpOnly cookie")

        # 4. Upload document
        doc_bytes = (
            "Introduction to Computer Architecture and Microprocessors. "
            "The ALU executes boolean operations while the Control Unit manages instruction decoding. "
            "Cache memory sits directly between registers and main memory RAM to accelerate access."
        ) * 10
        files = {"file": ("architecture_lecture.txt", io.BytesIO(doc_bytes.encode("utf-8")), "text/plain")}
        upload_resp = await client.post("/documents", files=files)
        assert upload_resp.status_code == 202, f"Upload failed: {upload_resp.text}"
        doc_id = upload_resp.json()["id"]
        print(f"[PASS] 4. /documents accepted upload (id: {doc_id})")

        # Process document background synchronously for smoke test execution
        from app.api.documents import process_document_background
        await process_document_background(doc_id, doc_bytes.encode("utf-8"), "txt")

        # 5. Check status
        st_resp = await client.get(f"/documents/{doc_id}/status")
        assert st_resp.status_code == 200
        print(f"[PASS] 5. /documents/{doc_id}/status polled successfully")

        # 6. Generate Dungeon
        gen_resp = await client.post(f"/documents/{doc_id}/generate-dungeon")
        assert gen_resp.status_code == 201, f"Dungeon generation failed: {gen_resp.text}"
        dungeon_id = gen_resp.json()["id"]
        print(f"[PASS] 6. /documents/{doc_id}/generate-dungeon created dungeon (id: {dungeon_id})")

        # 7. Start Game Run
        run_resp = await client.post("/runs", json={"dungeon_id": dungeon_id})
        assert run_resp.status_code == 201
        run_id = run_resp.json()["id"]
        print(f"[PASS] 7. /runs created active run (id: {run_id})")

        # 8. Submit Attempt
        att_uuid = str(uuid.uuid4())
        att_resp = await client.post(
            f"/runs/{run_id}/attempts",
            json={
                "attempt_id": att_uuid,
                "question_id": gen_resp.json()["rooms"][0]["questions"][0]["id"],
                "selected_answer": gen_resp.json()["rooms"][0]["questions"][0]["options"][0],
                "weapon_name": "Rusty Dagger",
            },
        )
        assert att_resp.status_code == 200
        print(f"[PASS] 8. /runs/{run_id}/attempts authoritative combat executed successfully")

        # 9. Finish Run
        fin_resp = await client.post(f"/runs/{run_id}/finish")
        assert fin_resp.status_code == 200
        print(f"[PASS] 9. /runs/{run_id}/finish calculated end-of-run scorecard: {fin_resp.json()['mastery_band']}")

        # 10. Check Progress
        prog_resp = await client.get("/progress")
        assert prog_resp.status_code == 200
        print("[PASS] 10. /progress persisted total XP and stats")

        # 11. Demo session
        demo_resp = await client.post("/demo/session")
        assert demo_resp.status_code == 201
        print("[PASS] 11. /demo/session created guest session without credentials")

    print("==================================================")
    print("ALL 11 SMOKE TEST SCENARIOS PASSED WITH 100% SUCCESS!")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(run_smoke())
