# StudyDungeon: status

Last updated: 2026-11-24. Branch `feature/frontend-live-players`.

## Current state

Feature complete for the hackathon build. Everything below runs end to end against the real backend (mock AI, local database).

- **Play:** demo dungeon and 3 preloaded packs as floor campaigns (floors unlock in order, then the Final Boss), floor ranks S to C, a chest with real bonus XP, pack unlocks after the Final Boss.
- **Own notes:** upload (PDF, DOCX, PPTX, TXT, images) with the AI notice, as many as you like (no count limits by default; see Upload limits), then summon a dungeon. Generated dungeons get floors of 2 rooms plus a Final Boss, like the packs. My Notes on the dashboard lists notes, links to their dungeon and deletes them (freeing a slot).
- **Learning loop:** Memory Scroll with the correct answer after a miss, questions return 3 later, spaced repetition, Daily Haunt (review run of due memories with a daily streak), Weak Topics (2 worst topics) and Exam (every topic) practice modes.
- **Competition:** points ledger, real leaderboard (preloaded, own notes, overall; all time and weekly), player counter, levels with XP to next level.
- **Accounts:** guest names with tags, register and login, upgrade a guest, delete account.

**Last verified numbers:** backend `pytest` 125 passed, ruff clean, Alembic upgrade, step-down and upgrade clean. Frontend typecheck, lint, build clean; `npm test` 1517 passed, 27 skipped; `test:contract` (mock) 46 passed, 1 skipped; live contract suite against the backend 38 passed, 0 failed, 2 skipped (they need the mock answer key); `layout:check` 67/68 on the changed screens (see Known issues).

## Next steps (in order)

1. **Test locally** (see "Run it locally").
2. **Deploy** (see `docs/DEPLOY_CHECKLIST.md`):
   - Render: create the web service from `backend/render.yaml` (Docker). Set `DATABASE_URL` (Supabase pooler URL), `SECRET_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROVIDER=gemini`, `FRONTEND_ORIGIN` (the Vercel URL), `COOKIE_SECURE=true`. Migrations run on start (`alembic upgrade head` in the Dockerfile).
   - Confirm the Render URL. If it is not `https://studydungeon-api.onrender.com`, change the destination in `frontend/vercel.json`.
   - Vercel: root `frontend/`, env `VITE_USE_MOCKS=false`, `VITE_API_BASE=/api` (the rewrite keeps cookies first-party).
   - After deploy: open `/api/health` on the Vercel URL, play the demo, register, upload a short PDF.
3. **Submission:** fill the `[FILL IN]` parts of `docs/KIRO_WRITEUP.md` (your own Kiro experience), record the video with `docs/DEMO_VIDEO_SCRIPT.md`, submit before December 4.

## Upload limits

Uploads are unlimited by default: no daily, stored, per-network or global count. File checks stay (15 MB, 30 PDF pages, 30 slides, 60,000 DOCX characters, at least 500 characters of text). To bring a count limit back, set one of these on the backend (0 = unlimited): `UPLOAD_GUEST_DAILY_LIMIT`, `UPLOAD_PLAYER_DAILY_LIMIT`, `UPLOAD_GUEST_STORED_LIMIT`, `UPLOAD_PLAYER_STORED_LIMIT`, `UPLOAD_IP_DAILY_LIMIT`, `UPLOAD_GLOBAL_DAILY_LIMIT`. Every upload calls Gemini, so on the free tier watch the AI quota; when Gemini is out, the OpenRouter fallback uses whichever free models exist that day.

## Known issues

- **Not tested with a real screen reader.** The result announcements (inside the question dialog while it is open) are checked in jsdom only.
- **Real AI and Supabase not exercised by the tests.** All runs used the mock AI and SQLite. Watch the first upload and the first migration on the deployed service.
- **Dashboard moon (cosmetic):** at 1366x650 the decorative moon floats behind the edge of the guest "Create an account" button (it renders behind the card, so the button stays readable and clickable). The layout check flags it.
- **Manual browser checks** still worth doing once: a full run to victory, a defeat, retreat and re-engage, pause and exit, mute, reduced motion, phone portrait.
- Optional property tests from earlier specs are still open (frontend-00, 03, 08, 10).

## Run it locally

Backend (from `backend/`, PowerShell). Use a local SQLite file so the Supabase database in `.env` is never touched:

```powershell
$env:DATABASE_URL = 'sqlite+aiosqlite:///./local.db'
$env:AI_PROVIDER = 'mock'; $env:GEMINI_MODEL = 'mock'; $env:GEMINI_API_KEY = ''
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Use `AI_PROVIDER=gemini` with your key and model to try real question generation.

Frontend (from `frontend/`): `npm run dev`. `.env.local` decides the mode: `VITE_USE_MOCKS=true` for the built-in mock, or `VITE_USE_MOCKS=false` with `VITE_API_BASE=http://localhost:8000` (or `VITE_API_BASE=/api`, which goes through the dev proxy like production).

| What | Command |
| --- | --- |
| Backend tests | `.\.venv\Scripts\python.exe -m pytest` (from `backend/`) |
| Backend lint | `.\.venv\Scripts\python.exe -m ruff check .` |
| Frontend typecheck, lint, tests, build | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` |
| Layout check | `npm run layout:check` (all screens and sizes, about 20 minutes) or `-- --routes /play,/upload --sizes 1366x768,360x740` |

### Contract suite against a real backend

Start a disposable backend as above (add `$env:UPLOAD_IP_DAILY_LIMIT='1000'`, because the suite uploads many files from one address), then in `frontend/`:

```powershell
$env:VITE_CONTRACT_LIVE = 'true'; $env:VITE_API_BASE = 'http://localhost:8000'; $env:VITE_USE_MOCKS = 'false'
$env:VITE_CONTRACT_UPLOADS = 'true'   # only with AI_PROVIDER=mock
npm run test:contract
```

The live suite is opt-in (`VITE_CONTRACT_LIVE`), so a `.env.local` pointing at a backend never makes `npm test` fail. Use a fresh database for each full run.

## Where things are

- Specs: `.kiro/specs/<name>/`. Logs: `docs/kiro-log-frontend.md`, `docs/kiro-log-backend.md`.
- Handoff between the two owners: `docs/handoff/` (`B-to-A.md` has every backend change Person B made, with reasons).
- Shared contract: `.kiro/steering/` (changes need both owners; a proposed update is in `B-to-A.md`).