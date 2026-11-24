> **Current status (2026-11-24): see `docs/STATUS.md`.** Parts of this report were written before the Daily Haunt, practice modes, floors for own notes, My Notes and the 2026-11-24 fixes; where they differ, STATUS.md is right.

# StudyDungeon — Master Project Analysis, Current Status & Roadmap

**Project Name**: StudyDungeon  
**Category**: Kiroween 2026 Hackathon (Frankenstein Category)  
**Date**: November 2026  
**Repository Branch**: `feature/frontend-live-players`  
**Authors**: Person A (Backend/AI Lead - M Taha Tabassum) & Person B (Frontend/Game Lead)  

---

## 1. Executive Project Overview & Architecture

### 1.1 What is StudyDungeon?
StudyDungeon is an adaptive educational RPG that converts dry academic study notes (PDFs, DOCX, PPTX, TXT, scanned lecture slides) into an interactive 2D gothic retro dungeon crawler. 

Instead of flipping through repetitive flashcards, students explore procedural dungeon chambers where each room represents an academic topic, and monsters represent core concepts. Students attack monsters by answering grounded, syllabus-aligned multiple-choice questions.

### 1.2 The Frankenstein Architecture & Core Guarantee
The central engineering innovation of StudyDungeon is its **strict dual-ownership architecture and authoritative game loop**:

```mermaid
flowchart TD
    subgraph Client ["Frontend: React 19 + Phaser 3 + Tailwind CSS"]
        UI["React Web Shell (Auth, Quota, Upload, Leaderboard)"]
        Canvas["Phaser 3 Canvas (GameScene, Particle FX, Audio)"]
        ClientAPI["ApiClient + Runtime Zod Wire Schemas"]
    end

    subgraph Server ["Backend: FastAPI + Async SQLAlchemy 2.0"]
        API["REST Endpoints (/auth, /dungeons, /runs, /leaderboard)"]
        Engine["Authoritative Combat Math & SM-2 Leitner Engine"]
        Ledger["Points Ledger & Player Stats"]
        DB[(PostgreSQL / SQLite)]
    end

    subgraph AI ["AI Multimodal Processing"]
        Extractors["Extractors (PyMuPDF, python-docx, pptx, OCR)"]
        Gemini["Google Gemini (gemini-2.5-flash)"]
    end

    UI <--> ClientAPI
    Canvas <--> UI
    ClientAPI -->|HTTP REST + HttpOnly Cookie| API
    API --> Engine
    API --> Ledger
    API --> DB
    API --> Extractors
    Extractors --> Gemini
```

#### The Authoritative Engine Rule: Zero AI During Gameplay
- **AI Is Used Exclusively for Content Ingestion**: The AI model (Google Gemini 2.5 Flash) is called **only** when a student uploads notes to cluster chunks into 2–6 topics and generate candidate questions with verbatim source quotes.
- **Combat Is 100% Deterministic Python**: When a player attacks, deals damage, takes damage, builds streaks, unlocks weapons, earns XP, or updates spaced repetition (SRS) schedules, **no LLM is invoked**. Everything runs in milliseconds with zero latency, zero hallucination risk, and zero quota consumption.
- **Zero Answer Leakage**: All dungeon queries (`GET /dungeons/{id}`) strictly omit correct options, evidence quotes, and explanations. These are only revealed server-side upon submitting an answer attempt (`POST /runs/{id}/attempts`).

---

## 2. What Has Been Completed So Far

The project has achieved an exceptionally high level of engineering completeness, backed by 112 backend tests (100% passing) and over 1,500 frontend tests.

### 2.1 Backend Implementation (Person A)
1. **Authentication & Session Security**:
   - User registration and login using Argon2id password hashing with timing-attack mitigation (`DUMMY_ARGON2_HASH`).
   - Guest sessions (`POST /demo/session`, `POST /guests`, `POST /guests/name-check`) with 24-hour TTL and lazy purging of expired guests.
   - Session tokens stored strictly in `HttpOnly` cookies with `session_version` revocation on logout and GDPR-compliant cascade deletion (`DELETE /auth/me`).
   - Spoofed proxy protection: Client IP extracted from the right-hand side using `TRUSTED_PROXY_COUNT`.
2. **Preloaded Content Packs 1 to 3**:
   - Three hand-reviewed academic content packs stored as versioned JSON files (`pack-1.json`, `pack-2.json`, `pack-3.json`).
   - Idempotent startup seeder (`seed_packs.py`) that populates or updates packs without duplicate rows.
   - Pack 1 ("Computer Systems Crypt") acts as the public demo dungeon and requires zero external AI keys.
   - Sequential pack unlocking: clearing Pack $N$'s final boss unlocks Pack $N+1$ (`PACK_LOCKED` 403 enforcement).
3. **Multimodal Document Ingestion Pipeline**:
   - Extractors for PDF (PyMuPDF), DOCX (python-docx), PPTX (python-pptx), plain text, and scanned image OCR.
   - Text normalization, 500-character minimum threshold, and AI relevance/readability gating.
   - Strict verbatim evidence citation check: questions must cite quotes present in the original document chunks.
   - Idempotent document summoning: calling `POST /documents/{id}/generate-dungeon` twice returns the existing dungeon without re-calling Gemini.
   - Background job recovery: interrupted ingestion jobs older than 4x timeout are automatically marked `failed` on server startup.
4. **Day 4 Milestones (Points Ledger, Leaderboard, Quota, Limits)**:
   - **Points Ledger**: Append-only transactional ledger (`point_events`), tracking points for preloaded packs vs own notes across weekly windows and lifetime totals, with tie-breaker timestamps (`reached_at_*`).
   - **Authoritative Leaderboard (`GET /leaderboard`)**: Top 20 ranking with 1-hour snapshot caching, dynamic tie-breaking, and live personal rank (`me` block). Privacy guaranteed: public handles fall back to `public_id`, never leaking internal usernames.
   - **Player Counter (`GET /stats/players`)**: 5-minute cached count of ranked players who have cleared at least one room.
   - **Upload Quota (`GET /uploads/quota`)**: Separate daily and storage limits for guests (1/day, 2 stored) and registered players (3/day, 5 stored).
   - **Strict Pre-AI File Limits**: Rejects over-limit files before any AI invocation (PDF > 30 pages: 422 `TOO_MANY_PAGES`, PPTX > 30 slides: 422 `TOO_MANY_SLIDES`, DOCX/TXT > 60k chars: 422 `TOO_MUCH_TEXT`).
   - **Mandatory AI Notice**: Rejects uploads without explicit user consent (422 `AI_NOTICE_NOT_ACCEPTED`).
   - **Guest Ingestion Access**: Guests can upload within their quota and summon dungeons for their study session.

### 2.2 Frontend & Game Engine Implementation (Person B)
1. **React 19 & Tailwind CSS v4 Web Shell**:
   - Responsive gothic aesthetic utilizing fonts (`Cinzel`, `Pirata One`, `Inter`), dark stone frames, parchment overlays, and custom HUDs.
   - Full user flows: landing page with instant demo access, path choice, login/register, packs directory, dashboard with Top 5 leaderboard snippet, and account settings.
   - Upload wizard with real-time file validation, quota chip, rules card, and stepper progress indicator.
2. **Phaser 3 2D Retro Game Engine**:
   - Embedded in React via typed event bridge (`FromGameEvent` / `ToGameEvent`).
   - Decoupled subsystems: `MovementSystem`, `InteractionSystem`, `LightSystem`, `AtmosphereSystem`, `BossPhaseSystem`, `BossDeathSystem`, `LootBurstSystem`, and `RevenantSystem`.
   - **Zero Per-Frame Allocations**: Update loops reuse pre-allocated vectors, point objects, and array iterators to eliminate garbage collection pauses.
   - **CanvasTexture Baking (`RoomBaker`)**: Dynamically bakes room geometry to prevent rendering lag.
3. **Responsive Layout & Accessibility**:
   - Automated headless DevTools layout suite (`npm run layout:check`) verifying 216/216 checks across 8 distinct viewports (from 360x740 mobile up to 2560x1440 2K desktop).
   - Touch mode: automatic 44px minimum touch targets and virtual joystick on mobile devices.
   - Accessibility: ARIA live announcements dynamically routed to polite live regions inside modal dialogs.
4. **Wire Layer & Runtime Parity**:
   - All network responses parsed through strict runtime Zod schemas (`src/api/schemas.ts`).
   - Dynamic capability probing (`withCapability`): client gracefully switches features on or off based on backend availability without crashing.

### 2.3 Kiro Spec-Driven Development Workflow
- **9 Immutable Steering Agreements (`.kiro/steering/`)**: Shared architectural standards governing API contracts, tech choices, coding styles, game balance formulas, and team ownership.
- **16 Specifications (`.kiro/specs/`)**: 8 backend specs (`backend-01` to `backend-08`) and 8 frontend specs (`frontend-00` to `frontend-11`) with tracked requirements, designs, and tasks.
- **Automated Hooks (`.kiro/hooks/`)**: On-save hooks for backend pytest test execution and frontend linting/typechecking.
- **Handoff Documentation (`docs/handoff/`)**: `A-to-B.md` and `B-to-A.md` tracking agreed diffs and integration points.

---

## 3. What Is Remaining (The Delta)

To bring the project to 100% completion according to `PERSON_A_BACKEND_TASKS.md` and `docs/handoff/B-to-A.md`, the following items remain:

### 3.1 Backend Remaining Tasks (Person A)
1. **Floor-Scoped Runs & Boss Runs (Section 9.1)**:
   - Update `StartRunRequest` in `backend/app/schemas/runs.py` to accept optional `floor_id: Optional[str]` and `mode: Optional[str] = "full"` (`floor`, `replay_floor`, `daily_haunt`, `weak_topics`, `exam`).
   - In `POST /runs`, when `mode == "floor"`, filter the run's rooms to only include rooms belonging to that `floor_id`.
   - Implement final boss run: single-room run unlocked only when all previous floors are cleared (return 403 `FINAL_BOSS_LOCKED` otherwise).
   - Enforce floor locks: return 403 `FLOOR_LOCKED` if attempting to start an uncleared floor before completing preceding floors.
2. **Per-Player Floor Progress & Rankings (Section 3.6 & 9.4)**:
   - In `GET /dungeons/{id}`, return dynamic per-player floor statuses (`ready`, `locked`, `cleared`) based on whether the player has defeated that floor's boss.
   - Return `floors[].rank` (`S`, `A`, `B`, `C`) calculated from the player's best run accuracy on that floor.
3. **Daily Haunt & SRS Practice Mode (Section 9.2)**:
   - Implement `mode: "daily_haunt"`: constructs a run comprising the player's currently due review questions (capped at 8) with no room monster.
   - Returns due questions in a `revenants` payload; answering them updates their Leitner schedule and increments the player's `daily_streak`.
   - Return 409 `NOTHING_DUE` with `next_due_at` if no questions are due.
4. **Custom Notes Floor Grouping (Section 9.3)**:
   - For user-generated dungeons (`POST /documents/{id}/generate-dungeon`), group topics into floors of 2 rooms each with the second room designated as a floor boss, matching the pack structure.
5. **Learning Loop Extras (Section 10)**:
   - `correct_answer`: in attempt responses, return the correct option text **only on wrong answers** (for the frontend Memory Scroll) and omit it on correct answers.
   - `requeue_after`: return the question queue offset for wrong answers to reappear later in the same run.
6. **IP Daily Limits & Global Cap (Section 7.2)**:
   - Enforce `UPLOAD_LIMIT_IP` (429 with `Retry-After`) using `RateLimitRecord` and `TRUSTED_PROXY_COUNT`.
   - Enforce global daily cap (`UPLOADS_PAUSED_TODAY`, 503) to prevent API credit exhaustion.

### 3.2 Frontend Adjustments (Person B)
1. **Enable Capabilities**:
   - Once backend Section 9 ships, flip `floors: true`, `modes: true`, and `dailyHaunt: true` in `frontend/src/api/client.ts`.
2. **"My Notes" Document Manager**:
   - Provide a UI panel in the dashboard/upload area to view uploaded notes via `GET /documents` and delete notes via `DELETE /documents/{id}` to free up storage slots.

### 3.3 Hackathon Submission & Deployment Checklist
1. **Fill In Documentation Placeholders**:
   - Complete the `[FILL IN]` placeholders in `docs/KIRO_WRITEUP.md` (details on Kiro IDE/CLI usage, custom agents, and vibe vs spec coding).
2. **Deploy to Render & Vercel**:
   - Set up the production PostgreSQL database on Neon or Supabase.
   - Run `alembic upgrade head` against the production database.
   - Deploy backend Docker container to Render and verify the real service URL.
   - Deploy frontend to Vercel and verify the proxy rewrite rule `/api/* -> Render backend`.
3. **Record Video & Submit**:
   - Record a 2–3 minute video following `docs/DEMO_VIDEO_SCRIPT.md`.
   - Submit before the Devpost deadline (December 4, 2026).

---

## 4. Current & Potential Errors and Step-by-Step Solutions

### Error 1: Render Deployed URL Returns 404 (`no-server`)
- **Symptom**: `studydungeon-api.onrender.com` returns 404 with `x-render-routing: no-server`.
- **Cause**: The Render web service is either not deployed yet, is named differently, or has spun down due to inactivity.
- **Solution**:
  1. Log into Render dashboard, create or start the Web Service using `backend/render.yaml` or the Dockerfile.
  2. Confirm the actual public URL (e.g., `studydungeon-api-xxxx.onrender.com`).
  3. If different from `studydungeon-api.onrender.com`, update `frontend/vercel.json` rewrites destination and `frontend/src/config/env.ts`.

### Error 2: Cross-Domain Cookie Rejection in Real Cloud Environment
- **Symptom**: In production, login succeeds (200), but subsequent requests return 401 Unauthorized because the session cookie is missing.
- **Cause**: Vercel serves the frontend on `*.vercel.app` while Render serves the backend on `*.onrender.com`. Browsers block cross-site cookies unless configured with `SameSite=None; Secure`.
- **Solution (Two Options)**:
  - **Option A (Recommended & Already Configured in `vercel.json`)**: Use Vercel's proxy rewrite so that frontend calls `/api/*` on its own domain, which Vercel proxies to Render. Cookies remain First-Party (`SameSite=Lax`).
  - **Option B**: In `backend/app/core/config.py`, set `COOKIE_SAMESITE="none"` and `COOKIE_SECURE=True` in production.

### Error 3: Pytest Missing `alembic.ini` When Run From Root
- **Symptom**: Running `pytest backend/tests` from the root directory causes `test_migration_populated.py` to fail with `CommandError: No 'script_location' key found in configuration`.
- **Cause**: The test calls `Config("alembic.ini")`, expecting the current working directory to be `backend/`.
- **Solution**:
  - Always run tests from the `backend/` directory:
    ```powershell
    cd backend
    .\.venv\Scripts\python.exe -m pytest tests/
    ```
  - Alternatively, update `backend/tests/test_migration_populated.py` to use an absolute path:
    ```python
    alembic_ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    cfg = Config(alembic_ini_path)
    ```

### Error 4: Quota Counted on Rejected Uploads
- **Symptom**: If a student uploads an invalid or non-educational file, it gets rejected, but still consumes one of their daily upload credits.
- **Cause**: `upload_document` counts all rows in `Document` created today where `status.in_(["accepted", "processing"])`. If a document was accepted for processing, it counts against the daily limit.
- **Solution**:
  - In `backend/app/api/documents.py`, when a document is rejected during background processing (`doc.status = "rejected"`), decrement the count or exclude rejected documents from the daily check:
    ```python
    Document.status.in_(["accepted", "processing"]) # Already excludes 'rejected' and 'failed'!
    ```
  - Ensure documents that fail validation immediately during upload do not write a database row prior to limit checks (already handled in Day 4).

### 2.5 Floor Campaign & Learning Loop
- **Floor Scoping (`mode: "floor"`, `floor_id`)**: Runs can be scoped to individual floors, running only that floor's rooms.
- **Progression & Locking**:
  - Floor 1 is `"ready"` (or `"cleared"` once completed).
  - Floor $N$ is `"ready"` if Floor $N-1$ is `"cleared"`, else `"locked"`.
  - Final Boss unlocks only after all dungeon floors are `"cleared"`.
- **Learning Loop & Finish Metrics**:
  - `POST /runs/{id}/attempts` provides `requeue_after=3` and `correct_answer` upon incorrect answers (without leaking on correct answers).
  - `POST /runs/{id}/finish` calculates `floor_rank` (`S`, `A`, `B`, `C`), `mastery_by_topic`, and `chest_rewards`.
  - `GET /dungeons/{id}` reports dynamic floor statuses and per-floor best ranks.

### 2.6 Multi-Provider AI Fallback (Gemini + OpenRouter)
- **Automatic Fallback**: If Google Gemini API is unavailable or returns 429 / 503 / quota exhaustion, the engine automatically falls back to OpenRouter free models (`meta-llama/llama-3.3-70b-instruct:free`, `deepseek/deepseek-r1:free`, etc.) with zero user downtime.
- **Strict JSON Parsing**: OpenRouter provider handles Markdown fences and extracts validated JSON outputs matching Pydantic schemas.

### 2.7 Database (PostgreSQL / Supabase Ready)
- **Engine Setup**: Fully compatible with Supabase PostgreSQL (`postgresql+asyncpg://`) with `statement_cache_size=0` for connection pooling (PgBouncer).
- **Alembic Migrations**: Fully in sync, including migration `f920da71bc45` for `game_runs.floor_id` and `game_runs.mode`.

---

## 3. Environment Variables & Setup Guide

### 3.1 Backend `.env`
Create a `.env` file in `backend/` with the following keys:

```env
# Environment & Server
ENVIRONMENT=development
PORT=8000
FRONTEND_ORIGIN=http://localhost:5173

# Database (Local SQLite or Supabase PostgreSQL)
# For local SQLite:
DATABASE_URL=sqlite+aiosqlite:///./studydungeon.db

# For Supabase / PostgreSQL (Production or Staging):
# DATABASE_URL=postgresql+asyncpg://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?ssl=require

# AI Configuration (Gemini + OpenRouter Fallback)
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenRouter Fallback
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_FALLBACK_MODELS=["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-r1:free", "mistralai/mistral-small-24b-instruct-2501:free"]

# Security & Sessions
SECRET_KEY=generate_a_secure_random_64_char_string
SESSION_COOKIE_NAME=sd_session
SESSION_COOKIE_SECURE=false
```

### 3.2 Frontend `.env`
Create a `.env` file in `frontend/` (or leave default for local dev):

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 4. Known Bugs Resolved & Architecture Fixes

### Error 1: OpenRouter Provider Fallback
- **Problem**: When Gemini encounters quota limits (429), document ingestion and question generation would fail.
- **Solution**: Built `OpenRouterProvider` with automatic fallback cascade across free open-source models. Integrated inside `GeminiProvider` catch handlers.

### Error 2: Floor Scoping & Sequencing
- **Problem**: Runs could not be scoped to a single floor, and floor progression was static.
- **Solution**: Implemented `floor_id` and `mode` on `GameRun`, checked sequencing in `start_run`, computed dynamic floor completion and ranks in `get_dungeon_detail`, and awarded `floor_rank`, `mastery_by_topic`, and `chest_rewards` in `finish_run`.

### Error 3: Alembic Script Location in Pytest
- **Problem**: `test_migration_populated.py` failed when pytest ran from project root because it looked for `alembic.ini` in CWD.
- **Solution**: Used `os.path.join(os.path.dirname(__file__), "..", "alembic.ini")`.

### Error 4: Tampered Cookie Test Session
- **Problem**: `test_session_attack_tampered_signature` retained genuine cookies from prior login step.
- **Solution**: Added `async_client.cookies.clear()` prior to tampering.

---

## 5. Project Health Summary Card

| Domain | Metrics / Health | Status |
| :--- | :--- | :--- |
| **Backend Tests** | 114 passed, 0 failed (100% green in 55s) | 🟢 **Pristine** |
| **Frontend Tests** | 1,510 passed, 2 skipped (100% active) | 🟢 **Pristine** |
| **Floor Campaign Flow** | Floors 1..N locking, floor runs, finish ranks | 🟢 **Complete** |
| **AI Reliability** | Gemini 2.5 Flash + OpenRouter multi-model fallback | 🟢 **Complete** |
| **Database Support** | SQLite + Supabase PostgreSQL (asyncpg, ssl) | 🟢 **Complete** |
| **Halloween Aesthetics**| Multi-tiered ghosts, vampires, and bat swarms | 🟢 **Complete** |

*File generated for developer handoff and hackathon presentation.*

