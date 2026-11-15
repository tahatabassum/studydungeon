# StudyDungeon: status

Last updated: 2026-11-17. Branch `feature/frontend-live-players`.

## Current state

- **Frontend (Person B):** all required tasks in frontend-04, 06, 07, 08, 10 and 11 are done. Playable against the mock and against the real backend.
- **Backend (Person A):** specs backend-01 to 06 are done and backend-08 (packs, floors, unlocks) is merged. backend-07 (identity) shows 0 of 6 tasks ticked, but its endpoints (`/guests`, `/guests/name-check`, `/auth/upgrade`, `DELETE /auth/me`) are live, so its checklist is probably stale. backend-08 has no `tasks.md`.
- **Last verified numbers (frontend):** typecheck, lint and build clean; `npm test` 1508 passed and 27 skipped; `test:contract` 46 passed and 1 skipped; `layout:check` 240/240 (30 route states at 8 window sizes, including the question panel).

## Next steps

1. Person A: build the features that still answer 404, listed with exact shapes in `docs/handoff/BACKEND_REMAINING_WORK.md` (real leaderboard and points, `/stats/players`, `/uploads/quota` with guest uploads, file-size limits, run modes and Daily Haunt, floor retry, learning-loop extras). About 15 contract cases skip until then.
2. Person A: decide whether rejected or failed uploads use the daily quota (open question in `docs/handoff/B-to-A.md`).
3. Person A: send CORS headers on unhandled 500s (see Known issues).
4. Person B: when `POST /runs` accepts `floor_id` and `mode`, switch them on in `frontend/src/api/client.ts` and turn on the `modes` and `dailyHaunt` capabilities.
5. Optional frontend tests still open: frontend-00 (5.3, 6.7, 8.5), frontend-03 (8.6), frontend-08 (11.10), frontend-10 (9.3 to 9.5, 11.5 to 11.7).

## Known issues

- **A 500 looks like a CORS error in the browser.** The generic `Exception` handler's response is built outside `CORSMiddleware`, so an unhandled 500 carries no `access-control-*` headers. Reproduced on commit `bc7da57` (second question of a generated dungeon, `MissingGreenlet`); fixed in `0d15f34`, but the next unhandled error will show the same symptom. Fix is in `backend/` (Person A).
- **Deployed URLs not verified.** `studydungeon-api.onrender.com` and `studydungeon.vercel.app` both answered 404 on 2026-11-17 (`x-render-routing: no-server`). The real Render URL needs confirming; `frontend/vercel.json` points at the first one.
- **Live region not tested with a real screen reader.** The result announcements (inside the question dialog while it is open, otherwise the shell region) are only checked in jsdom. Test with NVDA, JAWS or VoiceOver.
- **Manual browser checks still open** at 1366x768, 1920x1080 and 1280x720: full demo run to victory, defeat run, retreat and re-engage, pause and exit, mute, reduced motion.
- `backend/.env` points at a Supabase database. Do not run the backend tests or seeds against it; use a temporary SQLite `DATABASE_URL` with `AI_PROVIDER=mock`.

## How to run things

Frontend commands run in `frontend/` (PowerShell: use `npm.cmd` if `npm` is blocked by the execution policy).

| What | Command |
| --- | --- |
| Dev server (mock mode) | `npm run dev` (with `VITE_USE_MOCKS=true` in `.env.local`) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit and component tests | `npm test` |
| Production build | `npm run build` |
| Layout check, all routes and sizes | `npm run layout:check` (takes about 20 minutes) |
| Layout check, some routes or sizes | `npm run layout:check -- --routes /play,/upload --sizes 1366x768,360x740` |
| Layout check with screenshots | add `--screenshots <dir>` |

The layout check starts its own Vite server in mock mode and drives a local Chrome or Edge over the DevTools protocol. Set `LAYOUT_BROWSER` to the browser path if none is found, or `LAYOUT_URL` to use a server that is already running. `--routes /play` opens the floor map, presses Continue, walks to the first monster and measures the question panel.

### Contract suite

`npm run test:contract` always runs the mock suite (46 tests). The same suite runs against a real backend when these are set; one case is skipped without a backend.

```powershell
# 1. Start a disposable backend from backend/ (its own database, mock AI):
$env:DATABASE_URL = 'sqlite+aiosqlite:///./contract.db'
$env:AI_PROVIDER = 'mock'; $env:GEMINI_MODEL = 'mock'; $env:GEMINI_API_KEY = ''
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# 2. In frontend/ (second terminal):
$env:VITE_API_BASE = 'http://localhost:8000'; $env:VITE_USE_MOCKS = 'false'
npm run test:contract
```

The identity cases create and delete accounts, so only use a disposable backend. Never point it at the Supabase database in `backend/.env`.

### Backend tests

From `backend/`: `.\.venv\Scripts\python.exe -m pytest` (uses SQLite; `pytest.ini` sets `asyncio_mode = auto`). Lint with `ruff check .`.

## Where things are

- Specs: `.kiro/specs/<name>/` (`requirements.md`, `design.md`, `tasks.md`).
- Logs: `docs/kiro-log-frontend.md`, `docs/kiro-log-backend.md`.
- Handoff between the two owners: `docs/handoff/` (`A-to-B.md`, `B-to-A.md`, `BACKEND_REMAINING_WORK.md`, `PERSON_A_BACKEND_TASKS.md`, `BACKEND_REQUIREMENTS_V2.md`).
- Shared contract: `.kiro/steering/` (changes need both owners' agreement).