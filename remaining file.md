# StudyDungeon: Master Handoff & Remaining Work (Backend & Frontend)

**Project**: StudyDungeon (Educational RPG / Kiroween Hackathon)  
**Target Audience**: Person A & Person A's AI Agent  
**Repository Branch**: `feature/frontend-live-players`  
**Date**: November 2026  

---

## 0. Directive for Person A's AI Agent

```text
You are an autonomous AI software engineer continuing development on StudyDungeon.
Your mission: Implement the remaining Backend and Frontend features specified in this document.

CORE RULES:
1. Ground truth: Never break existing passing tests. The backend currently has 114 passing pytest tests; the frontend has 192 passing test suites (1,500+ unit tests).
2. Wire Protocol Parity: The frontend validates API responses using strict runtime Zod schemas (frontend/src/api/schemas.ts). Never rename, remove, or change the types of existing response fields. Only ADD fields according to the exact contracts documented below.
3. Authoritative Game Loop: The backend is 100% authoritative for all calculations (HP, damage, XP, scores, streaks, points, unlocks, SRS schedules, and leaderboards). AI (Google Gemini / OpenRouter) is used ONLY for document chunking and question generation during note upload; NEVER during live gameplay or combat.
4. Error Handling: All error responses must strictly follow the format:
   {"detail": {"code": "UPPER_SNAKE_CASE", "message": "Human-readable sentence.", ...extras}}
   Rate limits (429) and temporary outages (503) must include the "Retry-After" HTTP header (seconds).
5. Verification: After every change, run backend pytest and frontend vitest to verify zero regressions.
```

---

## 1. Current System Status & Verified Baseline

### 1.1 What Is Already Completed and Working (Do NOT Break)
1. **Authentication & Identity**:
   - Argon2id password hashing, HttpOnly session cookies, session version revocation on logout, GDPR account deletion (`DELETE /auth/me`).
   - Guest sessions (`POST /demo/session`, `POST /guests`, `POST /guests/name-check`) with 24h TTL and lazy purge.
2. **Preloaded Content Packs (1, 2, and 3)**:
   - Hand-reviewed syllabus packs seeded idempotently on startup.
   - Pack 1 serves as the free public demo dungeon.
   - Sequential unlocking: defeating Pack $N$'s final boss unlocks Pack $N+1$ (`PACK_LOCKED` 403 on premature runs).
3. **Points Ledger & Authoritative Leaderboards**:
   - Append-only transactional ledger (`point_events`).
   - `GET /leaderboard`: top 20 rankings, snapshot caching, dynamic tie-breaker (`reached_at`), and `me` personal rank block. Handles fall back to `public_id` (zero username leakage).
   - `GET /stats/players`: 5-minute cached count of ranked players.
4. **Upload Quota & Pre-AI File Limit Gating**:
   - `GET /uploads/quota`: daily and stored file limits for guests (1/day, 2 stored) and registered users (3/day, 5 stored).
   - Pre-AI gating: rejects files over 30 pages (PDF), 30 slides (PPTX), or 60k chars (DOCX) with 422 before calling external AI.
   - Strict `accept_ai_notice` consent check (422 `AI_NOTICE_NOT_ACCEPTED` if omitted).
5. **Floor Progression & Floor-Scoped Combat**:
   - Floor-based runs (`POST /runs` with `floor_id` and `mode="floor"`).
   - Dynamic room-level HP scaling matching available question count so questions do not repeat within a room.
   - In-memory attempt and question caching for fast combat resolution.
6. **Database Support**:
   - Local development on SQLite (`sqlite+aiosqlite:///./studydungeon.db`).
   - Cloud production support for PostgreSQL / Supabase IPv4 Transaction Pooler (port 6543) with Alembic migration head `f920da71bc45`.

---

## 2. Remaining Backend Work (Person A)

### Priority 1: Daily Haunt & Spaced Repetition Practice Mode (`mode="daily_haunt"`)
- **Location**: `backend/app/api/runs.py`, `backend/app/schemas/runs.py`
- **Objective**: Implement the Daily Haunt mode that turns due SRS questions into a combat run.
- **Requirements**:
  1. In `POST /runs`, accept `mode: "daily_haunt"`.
  2. Query the player's due review items (from `UserQuestionReview` where `next_review_at <= now()`).
  3. If no items are due:
     - Return HTTP 409 Conflict with detail:
       ```json
       {
         "detail": {
           "code": "NOTHING_DUE",
           "message": "No memories are due for review right now.",
           "next_due_at": "2026-11-20T14:00:00Z"
         }
       }
       ```
  4. If items are due:
     - Cap the batch at 8 questions maximum.
     - Create a special run without normal dungeon monsters. The questions are presented as `revenants`.
     - Answering questions in this run updates the question's Leitner schedule and increments the player's `daily_streak`.
  5. Add test coverage in `backend/tests/test_daily_haunt_mode.py`.

### Priority 2: Practice Modes (`weak_topics` and `exam`)
- **Location**: `backend/app/api/runs.py`
- **Requirements**:
  1. `mode: "weak_topics"`: Gathers questions from topics where the player's past accuracy is under 60%.
  2. `mode: "exam"`: High-stakes full dungeon run where questions do not repeat on wrong answers and monster damage is increased.

### Priority 3: Floor Retry & Mastery Progression
- **Location**: `backend/app/api/floors.py` (or `backend/app/api/dungeons.py`)
- **Endpoint**: `POST /floors/{floor_id}/retry`
- **Requirements**:
  1. Allow a player to replay a completed floor to improve their accuracy and earn a higher rank (`S`, `A`, `B`, `C`).
  2. Starting a retry run must not wipe previously earned floor points or downgrade existing higher ranks.
  3. Acceptance Criteria: Returns a `Run` response scoped to the specified `floor_id`.

### Priority 4: Learning Loop Extras on Attempts & Progress
- **Location**: `backend/app/api/runs.py`, `backend/app/api/progress.py`
- **Requirements**:
  1. **Reveal Correct Option Only on Miss**:
     - In `POST /runs/{id}/attempts`, if `is_correct == False`, include `correct_answer: str` in the response (so the frontend Memory Scroll can display it).
     - If `is_correct == True`, omit `correct_answer` or set to `null`.
  2. **Requeue Gap**:
     - Return `requeue_after: int` on wrong answers, specifying how many questions later the missed item will re-appear in the current run queue.
  3. **XP to Next Level**:
     - In `GET /progress`, return `xp_to_next: int` (XP required to reach `level + 1`) alongside `level` and `total_xp`.

### Priority 5: Rate Limiting & Global Billing Cap
- **Location**: `backend/app/api/documents.py`, `backend/app/core/rate_limit.py`
- **Requirements**:
  1. **IP Daily Upload Limit**:
     - Enforce `UPLOAD_LIMIT_IP` (max 5 uploads per IP per 24 hours).
     - On exceed: return HTTP 429 with `Retry-After` header and code `"UPLOAD_LIMIT_IP"`.
     - Extract client IP safely using `TRUSTED_PROXY_COUNT`.
  2. **Global Daily Kill-Switch**:
     - Enforce global daily cap (e.g. 50 total uploads/day across the instance) to avoid unexpected AI provider costs.
     - On exceed: return HTTP 503 with code `"UPLOADS_PAUSED_TODAY"` and `"offer_packs": true`.

---

## 3. Remaining Frontend Work (Person A)

### Priority 1: Activate Capabilities in Frontend Client
- **Location**: `frontend/src/api/client.ts`
- **Action**:
  Update `HTTP_CAPABILITIES` once backend endpoints are ready:
  ```typescript
  export const HTTP_CAPABILITIES: ApiCapabilities = Object.freeze({
    roomRevenants: false,
    floors: true,        // Flip to true when floor endpoints are live
    modes: true,         // Flip to true when practice modes are live
    dailyHaunt: true,    // Flip to true when Daily Haunt is live
    leaderboard: true,   // Already functional on live backend
    guestIdentity: true,
    accountUpgrade: true,
    accountDelete: true,
    packs: 'unproven',
    liveBoard: 'unproven',
    playerCounter: 'unproven',
    uploadQuota: 'unproven',
    guestUpload: 'unproven',
  })
  ```

### Priority 2: "My Notes" Document Management Panel
- **Location**: `frontend/src/dashboard/` or `frontend/src/upload/`
- **Objective**: Give registered players a UI to manage their stored study materials.
- **Requirements**:
  1. Call `GET /documents` to display a list of the user's uploaded documents (title, status, created date, chunk count).
  2. Provide a "Delete Note" button that calls `DELETE /documents/{id}` with a confirmation prompt.
  3. Deleting a document frees up a stored document slot against `stored_limit` in `GET /uploads/quota`.

### Priority 3: Wire Floor Retry Action
- **Location**: `frontend/src/campaign/CampaignPage.tsx`
- **Action**: Connect the "Replay Floor" button to `POST /floors/{floor_id}/retry` instead of the current 501 stub.

### Priority 4: XP to Next Level in HUD
- **Location**: `frontend/src/components/Hud.tsx`
- **Action**: Read `xp_to_next` from `GET /progress` and display the progress percentage towards the next level on the player's XP bar.

---

## 4. Verification & Testing Commands

### Backend Verification
Run from `backend/`:
```powershell
cd backend
# Run full pytest suite (must pass 100%)
.\.venv\Scripts\python.exe -m pytest tests/ -q

# Run Alembic migration check
.\.venv\Scripts\python.exe -m alembic upgrade head
```

### Frontend Verification
Run from `frontend/`:
```powershell
cd frontend
# Run unit & integration tests
npm test

# Run contract tests against local backend (backend must be running on localhost:8000)
$env:VITE_API_BASE='http://127.0.0.1:8000'; $env:VITE_USE_MOCKS='false'; npx vitest --run src/contract/http.contract.test.ts

# Run production build check
npm run build
```

---

## 5. Deployment Checklist (Production Release)

1. **Production Database (Supabase / Neon)**:
   - Run `alembic upgrade head` against the production PostgreSQL connection string.
   - Verify that all tables (`users`, `dungeons`, `dungeon_rooms`, `content_packs`, `game_runs`, `attempts`, `point_events`, `documents`, `document_chunks`) are present.
2. **Backend Service (Render / Cloud Run)**:
   - Set environment variables:
     - `DATABASE_URL`: Production asyncpg connection string.
     - `GEMINI_API_KEY`: Official Gemini API Key.
     - `CORS_ORIGINS`: Include production frontend domain (e.g. `https://studydungeon.vercel.app`).
     - `SESSION_SECRET`: 64+ character random hex string.
     - `COOKIE_SECURE`: `true`.
     - `TRUSTED_PROXY_COUNT`: `1`.
3. **Frontend Service (Vercel)**:
   - Configure `frontend/vercel.json` rewrite:
     ```json
     {
       "rewrites": [
         { "source": "/api/:path*", "destination": "https://<your-render-backend-url>/api/:path*" }
       ]
     }
     ```
   - Set `VITE_API_BASE_URL="/api"`.
4. **Hackathon Submission**:
   - Complete `docs/KIRO_WRITEUP.md` with final project details.
   - Record demo video using `docs/DEMO_VIDEO_SCRIPT.md`.
