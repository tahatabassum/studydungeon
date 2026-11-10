# StudyDungeon: Frontend State and Changes (Person B to Person A)

Date: 2026-11-10. Branch: `feature/frontend-campaign` (last commit `5137dbf`, pushed).
Author: Person B (game/frontend), written with Kiro by reading the repository, not the plans.

Read this file first, then `docs/handoff/BACKEND_REQUIREMENTS_V2.md`. Older context lives in `docs/handoff/B-to-A.md` (all PROPOSED items, contract reconciliation, backend observations) and `docs/handoff/A-to-B.md` (Person A's answers and runbook). Where this file and B-to-A.md disagree, this file is newer. "DOC 2" below means `BACKEND_REQUIREMENTS_V2.md`.

Conventions used below:

- **REAL**: the frontend calls it today and the real backend answers in a shape the frontend reads correctly.
- **PROPOSED**: the frontend has a typed slot and mock behaviour for it; the backend has not built it.
- **MOCK-ONLY**: exists only in the mock adapter or the offline module; real mode hides it.
- **MISMATCH**: the backend answers, but the values or shapes differ from what the product needs.
- **PLANNED**: frontend work that is not built yet (Section 9).
- **ASSUMPTION**: something not verified in code or with Person A. All of them are collected in Section 10.

---

## 1. One-page summary

StudyDungeon is a browser RPG that turns study notes into a haunted dungeon. Each room is a topic, each monster asks questions from the notes, a correct answer is an attack and a wrong answer costs HP and schedules the question for review. React owns the product screens and every network call; one Phaser 3.90.0 canvas owns the world (movement, sprites, effects). The backend is authoritative for correctness, damage, HP, score, XP, streaks, ranks, mastery and review dates. The frontend only computes these values inside the mock adapter and the clearly labelled offline demo.

**Current state of the frontend**

- Stack: React 19, TypeScript (strict), Vite, Tailwind 4, Phaser 3.90.0, React Router, zod 4 at the HTTP boundary, Vitest + fast-check (property tests), Testing Library.
- **Mock mode is the default** (`VITE_USE_MOCKS=true`). In mock mode the whole product works end to end without a backend: demo, campaign with floors, Daily Haunt, practice modes, learning loop, badges, leaderboard with Ghost Rivals, upload wizard that produces a playable generated dungeon, auth.
- **Real mode works for the legacy game** (`VITE_USE_MOCKS=false`): demo session, auth, the 5-room demo dungeon shown as one floor ("The Crypt"), attempts, room clear, finish, progress, due reviews, document upload pipeline. Features the backend does not support are hidden by a capabilities object (`HTTP_CAPABILITIES` in `frontend/src/api/client.ts`: floors, modes, Daily Haunt, room revenants and leaderboard are all off until the backend proves them).
- Real mode was last run against a local backend in frontend-08 Phase 1A. It was then paused because the local DB was not seeded and the dev server ran on port 5174 (CORS only allowed 5173). See Section 8.
- A translation layer (`frontend/src/api/wire/`) maps the real backend bodies to a stable domain model (`frontend/src/types/api.ts`). Screens never see wire shapes.
- Full-screen layout without page scrollbars at 1366x650 to 2560x1440. A mobile pass (touch controls, mobile upload) is built.
- Last verification (before this doc): typecheck, lint and build clean; `npm test` 1142 passed, 12 skipped; `npm run test:contract` (mock suite) 31 passed, 1 skipped (the real-backend suite is skipped unless `VITE_API_BASE` is set).
- **Uncommitted work in progress:** six layout/upload fixes (no scrollbar on pause and campaign screens, Upload notes button at the top of the Dashboard, upload starts automatically after a file is picked, upload result spacing, Leaderboard without page scrollbar) and the whole mobile pass. Both are green but not committed yet.

**What the backend needs to do next** is in `BACKEND_REQUIREMENTS_V2.md`: guest display names with 30-day guest identity and upgrade, preloaded packs, server-side points with anti-farming, a real-player leaderboard with an hourly snapshot and a live "You" panel, a public player counter, PostgreSQL operations, AI provider routing, and the PROPOSED campaign fields already listed in B-to-A.md.

---

## 2. Timeline of frontend specs

Spec folders are in `.kiro/specs/`. The prompt pack planned `frontend-01` to `frontend-05`; the real folders are named differently (the plan changed while building). `frontend-01`, `frontend-02` and `frontend-05` do not exist; their content was absorbed by the specs below.

| Spec | What it delivered | Status |
| --- | --- | --- |
| `frontend-00-playable-slice` | Vite/React/TS scaffold, design tokens, landing page with Try the Demo, typed API client + mock adapter (`VITE_USE_MOCKS`), demo rules module, one Phaser room, WASD/arrows + E/Space, question panel, animated damage, room clear, defeat/retry, pause/restart, guest banner, first B-to-A handoff. | Done (3 optional component-test tasks skipped) |
| `frontend-03-phaser-core` | Multi-room dungeon (4 topic rooms + boss), deterministic layout builder, gates, camera follow, per-room monster HP, room clear XP, victory screen, pause/mute/restart/exit, room progress indicator, contract additions (`order`, `is_boss`, `kind`, `current_room_id`, `RunSummary`). | Done (1 optional test task skipped) |
| `frontend-04-rpg-ui-combat-flow` | Continuous combat (press E once, questions follow until a side falls), retreat, RPG palette and typography, HUD, room progression, themed rooms, original pixel art, overlays, synthesized Web Audio sound, level source. | Phases 1 to 6 done; the Phase 7 parent box (responsive/regression polish) is still unchecked. That work was later covered by frontend-07 and the layout pass. ASSUMPTION A1 |
| `frontend-06-halloween-visuals` | Halloween visual overhaul: 5 themed rooms (Library, Witch Lab, Clockwork Crypt, Pumpkin Workshop, Boss Hall), lighting/flicker, prop placement safety, particle caps, renderer fallback, reduced motion, HUD and screens, sound, performance budget and verification. Presentation only. | Done |
| `frontend-07-premium-ux-leaderboard` | P0 housekeeping; P1 full-screen shell; P2 character-led encounter pop-up (portraits, typewriter lines); P3 weapons, criticals, boss enrage (presentation); P4 haunted memories (revenants); P5 scorecard, leaderboard (Ghost Rivals, mock), dashboard; P6 themed auth screens and offline demo fallback; P7 badges, lore intro, share card; P8 upload wizard. | Done |
| `frontend-08-campaign-learning-loop` | P0 contract reconciliation with the real backend (C1 to C31, decisions D1 to D26); P1A wire translation layer for the real API; P1B floors data model, fixtures, `/dev/floors`; P2 floor map and campaign flow; P3 Daily Haunt and run modes (Weak Topics, Exam, Replay Floor); P4 learning loop (second chance, Memory Scroll, mastery bars, progress panel, streak calendar); P5 game feel and floor ranks (combo meter, hit-stop, chests); P6 first-run tutorial, Armory equip, accessibility, docs; then the layout pass (PageShell fit variant, horizontal floor map, flying bats, "How to play" pill). | Done (1 optional presentation task skipped) |
| Mobile pass (no spec folder) | Touch controls (virtual joystick, Engage button, Pause button, rotate hint, touch legend), 44 px targets on touch devices, phone-friendly upload, generated dungeons playable in mock mode. Built in a vibe session after frontend-08. | Built, **uncommitted** |

Commits on the branch: `4b92392` (frontend-08 Phase 0 spec), `58a0ad9` (Phase 1A wire layer), `5137dbf` (everything else plus the layout pass). Earlier work (frontend-00 to frontend-07 P4) was merged to `main` through PR #3 and the premium-ux PR.

---

## 3. Screens and routes

Routes are defined in `frontend/src/App.tsx`. "Session" means a guest or registered session (in mock mode the session lives in memory; in real mode it is the `studydungeon_session` HttpOnly cookie). Routes wrapped in `RequireSession` redirect to `/` without one.

| Route | Purpose | Data it needs (ApiClient calls) | Guest | Registered |
| --- | --- | --- | --- | --- |
| `/` Landing | Title screen: Try the Demo, How to play (30 sec tutorial replay), Login, Create account, links to Dashboard and Leaderboard, flying bats. First visit opens the intro story + tutorial (`sd.introSeen`, `sd.tutorialSeen` in localStorage, UI flags only). | `startDemoSession` on Try the Demo; after 8 s without an answer it offers the Offline demo. | Try the Demo creates the guest and opens `/campaign/{dungeon_id}`. | Same buttons; Dashboard link continues. |
| `/login`, `/register` | Themed username + password forms; inline validation; 429 countdown from `Retry-After`. | `login`, `register`, `getMe`. | A guest who registers gets a new account (no upgrade yet, see Section 9). | Redirect to the Dashboard. |
| `/dashboard` | Home: Dungeon card with Continue and Upload notes, mastery card, progress panel (level, XP, streak calendar, memory strength, weak concepts), badges, recent runs, Daily Haunt slot, leaderboard summary, links. Settings is a "coming soon" placeholder. | `getProgress`, `getDungeon`, `getDueReviews()`, `getLeaderboard` (mock only). | Demo card, stats of this visit only, Create account call to action. No upload. | Full dashboard. |
| `/campaign/:dungeonId` | Floor map (horizontal, scrolls inside its frame), floor nodes with status/rank/mastery, final boss node, fog over locked floors, topic list, mode picker (Weak Topics, Exam, Replay Floor), Daily Haunt button, generation polling for generated dungeons. | `getDungeon` (floors), `getGenerationStatus` (every 2.5 s while a floor is `generating`), `retryFloor`, `getDueReviews()`. | Plays the demo dungeon. | Plays own dungeons too. |
| `/campaign/:id/play/:floorId` | One floor run in Phaser: rooms of the floor, then its floor boss (or the final boss). | `startRun({dungeon_id, floor_id, mode:'floor'})`, `submitAttempt`, `clearRoom`, `finishRun`, `getRun` (resume), `getProgress`. | Yes | Yes |
| `/campaign/:id/mode/:mode/:floorId?` | Practice modes: Weak Topics, Exam (10/20/30 min timer, `?minutes=`), Replay Floor. | `startRun` with the mode, then the same run calls. | Mock: yes. Real: hidden (capability off). | Same |
| `/haunt/:dungeonId` | Daily Haunt: a short run of due items (revenants) in a haunted hall, finale and streak celebration. | `getDueReviews()`, `startRun({mode:'daily_haunt'})`, attempts, finish. | Mock only | Mock only |
| `/play` | Legacy: the whole dungeon in one run, no floor map. | Same run calls with a plain `dungeon_id`. | Yes | Yes |
| `/leaderboard` | Podium + table, All-time / This week tabs, provisional row for a guest's last run, "Ghost Rival - demo" labels. Fit layout: rows scroll inside the table. | `getLeaderboard({dungeonId, period, limit:20})`, polled every 30 s while visible. | Readable without a session. | Readable; own row highlighted. Real mode shows "The leaderboard is coming soon". |
| `/upload` | Upload wizard: drop zone (also camera/photo on phones), auto-start, steps (upload, read, check, topics, summon), rejection reason, retry, topics found, "Enter the dungeon". | `uploadDocument`, `getDocumentStatus` (polling), `getDocumentTopics`, `generateDungeon`, `retryDocument`. | Sign-up prompt: "Create an account to upload your own notes". | Full wizard. |
| `/dev/floors?floors=1\|3\|10\|25`, `/dev/scorecard?case=...` | Dev-only fixture screens (not in production builds). | Fixtures | - | - |

In-game UI (inside play routes): floating HUD (player HP, monster HP, score, streak, combo meter, XP, haunted counter), encounter pop-up with monster portrait and typewriter lines, answer grid (MCQ and True/False), source line ("From your notes" + evidence quote), Memory Scroll after a wrong answer, requeue notice, revenants, pause menu (resume, mute, reduced motion follows the OS setting, Armory, controls legend, exit), victory/defeat overlays, chest rewards, scorecard with rank reveal, share card dialog (PNG generated in the browser), touch controls on touch devices.

Flags for development: `?debug=1` (fps report), `?mockLevel=N` (mock player level), `?touch=1` (force touch controls). None of them reach a real backend.
---

## 4. Deviations from the original plan

Compared against the master roadmap (`docs/StudyDungeon_Complete_Build_Roadmap_and_Kiro_Prompts_UPDATED.docx`, v1.0, 6 Nov 2026) and the Person B prompt pack (`docs/StudyDungeon_PersonB_Game_Frontend_Kiro_Prompts.txt`). The Person A prompt pack is not in the repository; its content is inferred from the roadmap and A-to-B.md (ASSUMPTION A2).

### 4.1 Added (not in the plan)

| Item | What exists now | Backend impact |
| --- | --- | --- |
| **Floors and floor map** | The plan had one dungeon map with 4 to 6 connected rooms. Now a dungeon is a **campaign of floors**: each floor is 2 topic rooms whose last room holds the **floor boss**, and a **final boss** unlocks after every floor is cleared. The demo is split into Floor 1 "The Entry Crypt" (rooms 1 and 2), Floor 2 "The Alchemy Wing" (rooms 3 and 4) and the final boss "The Exam Warden" (room 5). The map is horizontal, with fog over locked floors, per-floor rank and topic mastery. Floor statuses: `locked`, `ready`, `generating`, `failed`, `cleared`. | PROPOSED `floors[]`, `final_boss`, `rooms[].floor_id` on `GET /dungeons/{id}` (B-to-A frontend-08 item 1). Today real mode shows one legacy floor "The Crypt". |
| **Lazy floor generation** | Generated dungeons show floor 1 as playable while later floors are `generating`; the client polls every 2.5 s and offers Retry on a `failed` floor. | PROPOSED `floors[]` on document status, `POST /floors/{id}/retry`, `DUNGEON_TOO_LARGE` (B-to-A item 8). |
| **Question pools and draw** | The plan had 5 to 8 generated questions per topic and 5 to 6 per demo topic. The mock now models **15 to 20 questions per topic** and **draws 6 to 8 per run, seeded by the run id**. The authored demo keeps its own questions (4 per topic room, 8 for the boss); generated mock dungeons use synthetic sample pools. | PROPOSED: the backend stores the pool and **picks the questions per run** (B-to-A item 2). Real mode cycles the room's `questions[]` in the order sent. |
| **Character-led encounters** | The plan had a parchment question panel. Now a pop-up shows a large code-drawn character portrait (5 poses), a speech panel with typewriter lines, then the answer grid. Monsters keep their kinds (`paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`). | Presentation only. PROPOSED `monster_kind` so the client stops deriving the kind from `monster_type`. |
| **Revenants (haunted memories)** | Questions due for review appear as ghosts in cleared rooms (at most 3 per room) and can be laid to rest. | **Mock only.** The earlier proposal (answer a revenant through `POST /attempts` after the monster is dead) was withdrawn because the real backend returns 409 `ROOM_ALREADY_CLEARED`. Real mode hides room revenants; the haunted counter still shows the due count. |
| **Daily Haunt** | A short daily run made only of due items (mock cap 8) in a haunted hall, with a daily streak, a celebration and a 12-week streak calendar. | PROPOSED `mode: "daily_haunt"` on `POST /runs` and the `{due_count, next_due_at, daily_streak, items}` shape for `GET /reviews/due` (B-to-A items 3 and 6). Mock only today. |
| **Run modes** | Weak Topics (2 weakest topics), Exam (10/20/30 min timer, all topics), Replay Floor. | PROPOSED `mode` and `floor_id` on `POST /runs`. Mock only; the real client does not send them yet (D18). |
| **Learning loop** | Second chance (a missed question returns after 3 more questions, at most 2 returns), Memory Scroll after a wrong answer (explanation, evidence quote, and the correct answer when the backend sends it), mastery bars per topic, progress panel (notes conquered, memory strength, weak concepts). | PROPOSED attempt fields `requeue_after`, `is_retry`, `retry_multiplier`, `correct_answer`, `source{page, chunk_id}`; progress fields `notes_conquered_percent`, `memory_strength`, `streak_calendar`, `weak_concepts`, `xp_to_next`. |
| **Combo and floor ranks** | Combo meter tiers at streak 3/5/8/12 (Combo, Hot, Blazing, Legendary), display only. Floor rank S/A/B/C on the scorecard and the map. Chest rewards after a floor. | PROPOSED `combo`, `floor_rank`, `chest_rewards`. Ranks and chests are computed by the mock only. |
| **Badges** | 8 badges: `first_blood`, `streak_5`, `perfect_room`, `no_damage`, `boss_slayer`, `memory_keeper`, `speed_reader` (behind a flag, off), `dungeon_master`. The plan only had a boss badge. | PROPOSED `badges_earned` on finish and `badges` on progress. Computed by mock/offline only. |
| **Leaderboard** | The roadmap listed "live leaderboards" under "what not to build". A mock leaderboard exists per dungeon with All-time and This week, a podium, 8 seeded **Ghost Rivals** labelled "Ghost Rival - demo", a provisional row for guests and the rank reveal on the scorecard. | Real backend has no endpoint; the client declares `leaderboard: false`. The new product decision replaces this with a real-player leaderboard (DOC 2, Section D). |
| **Weapons and Armory** | 5 weapons with the real base damages; the Armory lets the player equip an unlocked weapon (kept in memory only) and sends it as `weapon_name`. | REAL request field. PROPOSED `PUT /progress/equipped-weapon` and `weapon_id` on the attempt response. |
| **Boss enrage** | Below 50 percent HP the boss gets a tint, fog, lightning and different audio. Presentation only. | None (derived from HP). |
| **Tutorial and lore** | Intro story plus a 30-second interactive tutorial on first visit, replayable from the "How to play · 30 sec" button. The plan only asked for a first-run controls hint. | None. |
| **Share card** | A PNG card (score, rank, badges) drawn in the browser, with share text. | None. |
| **Full-screen and mobile** | The plan was desktop-first at 1366x768 with touch "if time remains". Now every main screen fits without page scrollbars from 1366x650 to 2560x1440, and phones get a virtual joystick, an Engage button, a Pause button, a rotate hint and 44 px touch targets. Upload on a phone offers the camera (PNG/JPEG). | None, except that guest upload on phones depends on the guest upload decision (DOC 2, A and G). |
| **Translation layer** | The plan said "types generated from api-contract.md". Because `api-contract.md`, `openapi.json` and A-to-B disagreed, the frontend reads the real bodies through zod schemas in `src/api/wire/` and maps them to the domain model. A wire change that breaks a schema raises a `ContractError` naming the endpoint and field. | Please keep `openapi.json` accurate; the wire schemas follow it. |

### 4.2 Changed

| Item | Plan | Now |
| --- | --- | --- |
| Waking state | Ping `GET /health` with backoff, then call `POST /demo/session` (A-to-B Day 3). | The "Waking up the dungeon..." screen waits on `POST /demo/session` directly (tips rotate every 4 s); after 8 s it also offers the labelled Offline demo. The frontend never calls `/health`. |
| Offline fallback | Bundled JSON + a tiny rules module. | As planned, plus offline floors, offline rivals and the label "Offline demo - progress is not saved". The offline module is only loaded through a dynamic import after the player chooses it. |
| Art and audio | Licensed packs from Kenney/OpenGameArt. | All art is code-drawn originals and all sound is synthesized with Web Audio. Only the three fonts (OFL) are third-party (`frontend/ASSETS_LICENSES.md`). |
| Auth bodies | `{user: ...}` wrapper, logout 204 (B-to-A proposal). | Adopted the real bare user bodies (201/200) and logout `200 {success: true}`. |
| Upload API | `POST /uploads` (B-to-A proposal). | Adopted the real `POST /documents` pipeline. |
| Due reviews | Bare array filtered by dungeon (early proposal). | Real `GET /reviews/due` is global; the client dedupes by `question_id` and resolves rooms itself. The new summary shape is PROPOSED. |
| Balance | 60 HP rooms, 120 HP boss (early mock). | Aligned to the real backend: rooms 80/90/85/85, Exam Warden 220, weapons 20/25/30/35/40, hard x1.25, critical x1.5. |

### 4.3 Dropped or not built

| Item | Status |
| --- | --- |
| Settings screen (sound, reduced motion, logout, delete account/document) | Placeholder card "Coming soon". Mute is in the pause menu, reduced motion follows the OS setting, Log out is on the Dashboard. **Delete my account and data is now PLANNED** (Section 9.8); delete document is still not built (backend has `DELETE /documents/{id}`). |
| Recent dungeons list on the Dashboard | Not built. The Dashboard shows one dungeon (the session's dungeon); `GET /dungeons` and `GET /documents` are not called. |
| Credits screen | Not built; credits are in `frontend/ASSETS_LICENSES.md`. |
| Source preview panel from `GET /documents/{id}/source-preview` | Not called. The source line shows the evidence quote; the page number needs `source.page` (PROPOSED). |
| Potion, coins economy, cosmetics, free-text answers | Not built (stretch in the plan). Mock chest rewards show XP and coins as display only. |
| Touch tap-to-move | Not built; the joystick covers movement. |
| Speed Reader badge | Built behind `VITE_BADGE_SPEED_READER` (off) because attempts carry no timing. |
| Guest 24 h lifetime | Still what the backend does. The new product decision is a 30-day guest (DOC 2, A). |
| OpenRouter as a manual opt-in only | Replaced by the provider routing in DOC 2, G (backend only; the frontend never calls an AI provider). |

---

## 5. Game rules and numbers as the frontend and mock assume them

The real backend decides every value below. The frontend shows what it receives. These numbers matter for the mock (`src/api/mock/`), the offline module (`src/offline/`) and the display labels.

### 5.1 Combat

| Value | Mock / offline | Real backend (read from `backend/app`) | Same? |
| --- | --- | --- | --- |
| Player HP | 100 per run | 100 | Yes |
| Topic monster HP (demo) | 80, 90, 85, 85 (from `demoDungeon.json`) | From the seed (same values) | Yes |
| Final boss HP | 220 (Exam Warden) | 220 | Yes |
| Floor boss HP (generated, mock) | The HP of the floor's last room | No floors | n/a |
| Weapon base damage | Dagger 20, Staff 25, Crossbow 30, Hammer 35, Sigil 40 | Same (`services/combat.py`) | Yes |
| Hard question | x1.25 | x1.25 | Yes |
| Critical | x1.5 when the streak before the answer is at least 2 (3rd correct in a row) | x1.5 on the streak rule in `calculate_combat_damage` | Yes (both use `streak >= 2` before the answer; verified in `combat.py`) |
| Rounding | Half to even (matches Python `round`) | Python `round` | Yes |
| Wrong answer damage to player | 10 in topic rooms, 12 from a boss | 10 / 12 | Yes |
| Damage on a second-chance retry | x0.5 (`RETRY_MULTIPLIER`) | No retry concept | **Needs a decision** |
| Weapon unlocks | Staff 100 XP, Crossbow 2 rooms cleared, Hammer level 3, Sigil first boss | Same rules, but `cleared_rooms` and `boss_cleared` are never passed and progress is never written | **MISMATCH** (B-to-A observation 2 and 3) |

### 5.2 Score, XP and level

| Value | Mock / offline | Real backend | game-design.md | Decision needed |
| --- | --- | --- | --- | --- |
| Score per correct answer | 100 flat | `100 + 20 x streak` (streak after this answer) | +100, +150 hard | **Yes**: three different rules |
| Streak bonus | none | included above | +25 after 3 in a row | **Yes** |
| Room clear / boss clear score | none | none | +50 / +200 | **Yes** |
| XP per correct answer | 10 (x0.5 on a retry) | 10 | not stated | Retry rule |
| Room clear XP | 25 | 25 (computed, **not added** to `xp_earned`) | 25 XP (roadmap) | Persist it |
| Boss clear XP | 100 | 100 (same issue) | 100 XP | Persist it |
| Level curve | Level n to n+1 costs 100 x n XP (L2 at 100, L3 at 300, L4 at 600) | `UserProgress` exists but is never written, so level stays 1 | "100 x current level" | Confirm and persist |
| `xp_to_next` | computed by the mock | not sent | - | PROPOSED field |

The new **leaderboard points** (DOC 2, Section C) are a separate, server-only number. The run score stays a scorecard value. The screens will label them **"Dungeon score"** (run score, HUD and scorecard) and **"Leaderboard points"** (Section 9.9). ASSUMPTION A4: the team wants the two kept separate.

### 5.3 Streaks, combo, ranks, mastery

| Value | Mock / offline | Real backend | Decision needed |
| --- | --- | --- | --- |
| Answer streak | +1 correct, reset to 0 on a wrong answer | Same | No |
| Combo tiers | Display only: 3 Combo, 5 Hot, 8 Blazing, 12 Legendary (`combo` or the streak) | No `combo` field | Optional field |
| Floor rank | First-try accuracy: S at 0.90 or more with no retry, A at 0.80, B at 0.60, else C | No floors | **Yes** (thresholds, does HP lost count) |
| Mastery value | 0 to 100 per topic, EMA alpha 0.3 over answers (mock) | Only a run-level `mastery_band` on finish | **Yes** (per-topic formula) |
| Mastery bands | Weak below 50, Learning 50 to 79, Strong 80 and above | Same bands | No |
| Requeue | Gap 3 questions, at most 2 returns | No requeue | **Yes** |
| Review intervals | Mock: due 24 h after a miss (`MOCK_REVIEW_INTERVAL_MS`) | Wrong 10 min; correct 1 / 3 / 7 / 14 / 30 days | Mock differs on purpose (demo); backend wins |
| Daily Haunt size | At most 8 items | No mode | **Yes** |
| Daily streak | Consecutive days with a finished Daily Haunt | None | **Yes** |
| Exam mode | Same rules as a floor, all topics, timer 10/20/30 min, no different weighting | None | **Yes** |

### 5.4 Upload limits shown in the UI (hints only, the server decides)

PDF, DOCX, PPTX, TXT, PNG, JPEG; at most 15 MB and 30 pages; at least 500 characters of text; at most 5 stored documents per account (`frontend/src/upload/limits.ts`, matching the backend errors `FILE_TOO_LARGE` 413, `UNSUPPORTED_FILE_TYPE` 415, `QUOTA_EXCEEDED` 400). The browser checks are hints only. **Person A must enforce** 30 pages for PDF, 30 slides for PPTX and a character limit for DOCX, each with its own error code (`TOO_MANY_PAGES`, `TOO_MANY_SLIDES`, `TOO_MUCH_TEXT`, DOC 2 G-R11). The frontend will show the `limit` and `found` values from the error.
---

## 6. Contract table

Every call goes through `ApiClient` (`frontend/src/api/ApiClient.ts`). Real implementation: `frontend/src/api/client.ts` (fetch with `credentials: "include"`, JSON, zod validation per endpoint in `WIRE_ENDPOINTS`). Errors are read from `{"detail": {"code", "message"}}`, FastAPI's `{"detail": [...]}` array and a plain string `detail`; `Retry-After` is kept for 429.

### 6.1 Endpoints the frontend calls

| Endpoint | Request the frontend sends | Response fields the frontend reads | Status |
| --- | --- | --- | --- |
| `POST /demo/session` | no body | `user{id, username, is_guest, created_at?, expires_at?}`, `dungeon_id`, `expires_at` | REAL. MISMATCH: on a fresh DB it returns `"demo-dungeon-seeded-id"` for a dungeon that does not exist (the seed runs only from the Dockerfile). |
| `POST /auth/register` | `{username, password}` | bare user (201) | REAL |
| `POST /auth/login` | `{username, password}` | bare user (200); 401; 429 + `Retry-After` | REAL |
| `POST /auth/logout` | no body | `{success: true}` (200) | REAL |
| `GET /auth/me` | cookie | bare user with `expires_at`; 401 means signed out | REAL |
| `GET /dungeons/{id}` | - | `id, title, is_public_demo?, rooms[{id, room_number, topic_name, monster_name, monster_type, monster_hp, is_boss, questions[{id, prompt, options, difficulty}], floor_id?}]`, `floors?`, `final_boss?` | REAL for rooms. PROPOSED: `floors[]`, `final_boss`, `rooms[].floor_id`, `monster_kind`. |
| `POST /runs` | `{dungeon_id}` only (D18: `floor_id` and `mode` are not sent until supported) | `id, dungeon_id, current_hp, current_score, current_streak, xp_earned, status, started_at?, rooms[{room_id, room_number, topic_name, monster_name, monster_max_hp, monster_current_hp, is_cleared, is_boss}]` | REAL. PROPOSED: body `floor_id`, `mode`; response `mode`, `run_seed`, `encounters[]`, `revenants[]`. |
| `GET /runs/{id}` | - | same as `POST /runs` | REAL. MISMATCH: returned 500 after the first attempt on a mock-AI generated dungeon (not seen on the seeded demo). |
| `POST /runs/{id}/attempts` | `{question_id, selected_answer (option text), attempt_id (client UUID, reused on retry), weapon_name}` | `attempt_id?, is_correct, damage_dealt, damage_taken, is_critical, current_hp, current_score, current_streak, monster_hp_remaining, explanation?, evidence_quote?` | REAL. MISMATCH: `monster_hp_remaining` is always 0 (the client computes it from the room HP); 500 on the second question of a generated dungeon. PROPOSED: `requeue_after, is_retry, retry_multiplier, combo, correct_answer` (after wrong answers only), `source{page, chunk_id}`, `weapon_id`; from DOC 2: `points_awarded`, `points_reason`. |
| `POST /runs/{id}/rooms/{room_id}/clear` | no body | `xp_delta` (+ optional `success, room_id, is_cleared, is_boss`) | REAL. MISMATCH: the XP is not added to the run or to progress; no response model in `openapi.json`. |
| `POST /runs/{id}/finish` | no body | `id?, score, xp_earned, correct_count, total_attempts, accuracy (0 to 1), mastery_band, status?` | REAL. PROPOSED: `floor_rank, mastery_by_topic, chest_rewards, badges_earned, leaderboard_rank, weapon_unlocked, level_up`; from DOC 2: `points_earned`, `player_points`. |
| `GET /progress` | - | `user_id?, level, total_xp, unlocked_weapons (names)` | REAL. MISMATCH: never changes (UserProgress is never written). PROPOSED: `xp_to_next, badges, weapons, recent_runs, due_review_count, equipped_weapon, notes_conquered_percent, memory_strength, streak_calendar, weak_concepts`. |
| `GET /reviews/due` | - | bare array `[{question_id, prompt, options, next_review_at?, repetition_count?}]` | REAL. MISMATCH: duplicates per question (a new ReviewItem per attempt). PROPOSED: `{due_count, next_due_at, daily_streak, items[{..., due_at, topic_id, floor_id}]}`. |
| `POST /documents` | multipart `file` | `id, status, message?` (202) | REAL. Guests get 403 `GUEST_FORBIDDEN` (the new decision changes this, DOC 2 A and G). |
| `GET /documents/{id}/status` | - | `id, status (processing, accepted, rejected, failed), relevance_score?, readability_score?, rejection_reason?, chunks_count?` | REAL. PROPOSED: `dungeon_id`, `floors[{id, status}]`. Doc mismatch: `api-contract.md` says `topic_count`. |
| `GET /documents/{id}/topics` | - | `[{id, name, description?, order_index}]` | REAL |
| `POST /documents/{id}/generate-dungeon` | no body | same as `GET /dungeons/{id}` (201) | REAL |
| `POST /documents/{id}/retry` | no body | `id, status, message?`; 400 `NOT_RETRYABLE` | REAL |
| `POST /floors/{id}/retry` | no body | `{id, status: "generating"}`; 409 `FLOOR_NOT_FAILED` | PROPOSED (the real client rejects with 501) |
| `GET /leaderboard` | `?dungeon_id=&period=all\|week&limit=20` | `entries[{id, rank, display_name, is_guest, is_seeded_rival, level, score, accuracy, best_streak, badge_ids}], me{rank, is_provisional, entry}, updated_at` | MOCK-ONLY (the real client rejects with 501, capability off). **Superseded by DOC 2, Section D** (new query and shape). |
| `PUT /progress/equipped-weapon` | `{weapon}` | `{equipped_weapon}` | PROPOSED, not called (the equipped weapon is kept in memory). |

### 6.2 Real endpoints the frontend does not call (yet)

`GET /health`, `GET /health/ready`, `GET /dungeons`, `GET /documents`, `DELETE /documents/{id}`, `GET /documents/{id}/source-preview`, `GET /progress/scorecard`, `DELETE /auth/me`. None of them blocks anything. `GET /documents` will be useful for the PLANNED upload screens if Person A keeps it.

### 6.3 Known mismatches with the real backend (summary)

1. Demo dungeon not seeded in a fresh DB; `POST /demo/session` returns a dungeon id that 404s.
2. `monster_hp_remaining` is always 0 in attempt responses (also on idempotent replays).
3. Progress is never persisted: level stays 1, XP 0, weapons `["Rusty Dagger"]`; room-clear XP is not added to `xp_earned`.
4. Weapon unlock checks never receive `cleared_rooms` / `boss_cleared`.
5. `GET /reviews/due` repeats the same question (one ReviewItem per attempt, repetition always 0).
6. 500 on `POST /runs/{id}/attempts` (second question) and on `GET /runs/{id}` for a mock-AI generated dungeon.
7. Attempts on a cleared room return 409 `ROOM_ALREADY_CLEARED` (by design; this is why room revenants are mock only).
8. Score rule differs from `game-design.md` (`100 + 20 x streak` against +100 / +150 hard / +50 room / +200 boss / +25 streak).
9. Doc drift: `api-contract.md` Section 3 against `openapi.json` (field names), `topic_count` against `chunks_count`, three versions of the finish body, the clear body, username rules (contract 3 to 20 characters, code 3 to 32 lowercased).
10. The session cookie is not `Secure`; CORS allows only `FRONTEND_ORIGIN` (default port 5173), so a Vite dev server on 5174 fails.
11. Guest TTL is 24 h (`DEMO_GUEST_TTL_HOURS`); the new decision is 30 days.
12. No leaderboard, floors, modes, Daily Haunt, packs, points or player counter endpoints.

---

## 7. What is still pending on the frontend

- **Commit the uncommitted work** (six layout/upload fixes and the mobile pass), waiting for Person B's go.
- **Real-mode integration pass** once the backend is seeded and the mismatches above are fixed: run `test:contract` against the API, then play the demo end to end in real mode.
- **Turn capabilities on** as the backend ships them (floors, modes, Daily Haunt, leaderboard, packs). Each one is a flag plus wire schemas; the screens already exist.
- **Send `floor_id` and `mode`** on `POST /runs` once they are accepted (one change in `client.ts`, D18).
- **PLANNED features in Section 9** (guest name, preloaded packs, real leaderboard, player counter, guest upload).
- Settings screen, delete document, recent dungeons list (Section 4.3); delete my account and data, score labels and the warm-up call are PLANNED (Sections 9.8 to 9.10).
- Not tested on a real phone yet (only headless Edge, DevTools device mode and `?touch=1`).
- Optional tasks skipped: a few component tests in frontend-00/03 and presentation-only room events (frontend-08 task 11.10). The frontend-04 Phase 7 parent box is unchecked.

---

## 8. Running the frontend against the real backend

### 8.1 Environment variables (frontend, `frontend/.env.local`)

```
VITE_USE_MOCKS=false
VITE_API_BASE=http://localhost:8000      # local backend
# VITE_API_BASE=/api                # deployed behind the Vercel rewrite
```

`VITE_API_BASE` wins; `VITE_API_BASE_URL` is still read when it is empty. Empty means same origin. No secret ever goes into a `VITE_` variable. Restart the Vite dev server (`npm run dev`) after editing `.env.local`.

### 8.2 Backend prerequisites (local)

1. From `backend/`: `alembic upgrade head`, then **`python -m app.demo.seed`** (otherwise the demo dungeon 404s).
2. Start the API on port 8000 (`uvicorn app.main:app --reload --port 8000`).
3. The frontend dev server must be on **http://localhost:5173**, because CORS allows `FRONTEND_ORIGIN` only. If Vite picks 5174 (port busy), stop the other process or set `FRONTEND_ORIGIN=http://localhost:5174` in `backend/.env`.

### 8.3 Cookies and CORS

- Session cookie: `studydungeon_session`, `HttpOnly; SameSite=Lax; Path=/` (observed: not `Secure`). The frontend never reads it and stores no token.
- Local dev is cross-origin (5173 to 8000) but same-site (both on localhost), so `SameSite=Lax` works with `credentials: "include"`. The backend must answer with `Access-Control-Allow-Credentials: true` and echo the exact origin (it does).
- Production: `frontend/vercel.json` rewrites `/api/:path*` to `https://studydungeon-api.onrender.com/:path*` (the `/api` prefix is stripped because backend routes have no prefix) and every other path to `/index.html` for deep links. With `VITE_API_BASE=/api` the browser sees first-party cookies, so CORS is not involved. ASSUMPTION A3: the deployed Render URL is `studydungeon-api.onrender.com`; replace it in `vercel.json` if it differs.
- Render free cold start: the first request can take about a minute; the frontend shows "Waking up the dungeon..." and offers the Offline demo after 8 s.

### 8.4 Contract tests against the real API

```
cd frontend
$env:VITE_API_BASE='http://localhost:8000'; $env:VITE_USE_MOCKS='false'; npm.cmd run test:contract
```

`src/contract/http.contract.test.ts` runs the shared suite (`src/contract/suite.ts`) against `createHttpClient` with a Node cookie jar (`cookieFetch.ts`). Without those variables it is skipped and only the mock suite runs. The suite covers: demo session, dungeon shape and HP, run start, resume, attempt idempotency (and no answer leakage), floors (legacy fallback), generation status, modes (or the plain run), due reviews (both shapes), progress, leaderboard (or declared unsupported), auth (register, 409, 422, login 401, me, logout) and documents (guest 403, upload/status/topics/generate, rejection and retry, 400 `NOT_RETRYABLE`, 404, 413, 415, 400 `QUOTA_EXCEEDED`). The document tests upload real files and the quota test needs room for 6 uploads, so run the suite against a disposable local DB, never against production.
---

## 9. PLANNED FRONTEND WORK (not built yet)

Everything in this section is **PLANNED**: no code exists yet. Every endpoint listed is **PROPOSED** and defined in `BACKEND_REQUIREMENTS_V2.md` (section letter in brackets). Until an endpoint exists, the feature runs against the mock adapter and stays hidden in real mode through a new capability flag, as the campaign features do today.

### 9.1 Guest display-name entry (PLANNED)

- Try the Demo opens a small "Name your hero" step before anything else: a text field (3 to 16 characters, letters, digits, space, `_` and `-`), a live check after typing stops, and the public notice: "Your name and points are shown on the public leaderboard. Do not use your real full name." with a required checkbox.
- After creation the HUD and leaderboard show the handle with its tag (for example `Raven#4821`). The login username is never shown publicly.
- Returning visitors with a valid guest cookie skip the step (`GET /auth/me` returns the guest).
- "Save your progress" (guest banner, scorecard, dashboard) opens the register form in **upgrade** mode, which keeps the name, points and history.
- Endpoints (PROPOSED): `POST /guests/name-check` (A), `POST /guests` (A), `GET /auth/me` with `public_id`, `display_name`, `tag`, `handle` (A), `POST /auth/upgrade` (A). `POST /demo/session` stays as a fallback until `POST /guests` exists.

### 9.2 Choice between preloaded dungeons and uploading notes (PLANNED)

- After the name step: two large cards, "Play a haunted pack" (preloaded, instant, no AI) and "Summon from your notes" (upload). The second card shows the quota state from the backend (for example "1 summoning left today") or why it is unavailable.
- Endpoints (PROPOSED): `GET /packs` (B), `GET /uploads/quota` (G).

### 9.3 Preloaded pack progression (PLANNED)

- A pack list (pack 1 is today's demo: 2 floors plus the Exam Warden). Each pack shows status (locked, available, in progress, completed), floors cleared and points earned in it. Beating a pack's final boss unlocks the next; the scorecard shows "Next pack unlocked". When every pack is done, an "All packs conquered" screen offers replay (reduced points) and the upload path.
- Endpoints (PROPOSED): `GET /packs` (B), `GET /dungeons/{id}` with `floors[]` and `final_boss` (B, and B-to-A item 1), `POST /runs` with `floor_id` and `mode` (B-to-A item 3), `POST /runs/{id}/finish` with `pack_progress` and `points_earned` (B, C).

### 9.4 Real-player leaderboard (PLANNED)

- Replaces the mock board in real mode. Tabs **Preloaded**, **Own notes**, **Overall**, each with **All-time** and **This week**. A one-line explanation per tab of why it exists (fairness). The weekly tab states the reset: "Resets every Monday 00:00 UTC" (from the response).
- Top 20 only, from the hourly snapshot, with "Updated 14 min ago, next update in 46 min" from `updated_at` and `next_refresh_at`.
- A **live "You" panel** pinned under the table: your live rank and points, "31 points to pass Bat#2231", and when you are outside the top 20, "511 points to enter the top 20". The panel is labelled live because it can be ahead of the snapshot.
- Guests can read it without a session (the You panel then says "Pick a name and play to join").
- Ghost Rivals stay in mock and offline mode only.
- Endpoint (PROPOSED): `GET /leaderboard?board=preloaded|own_notes|overall&period=all|week` (D). Attempt and finish responses carry `points_awarded` / `points_earned` so the HUD and scorecard can show points (C).

### 9.5 Player counter on the title screen (PLANNED)

- A small line under the title: "143 adventurers have braved the crypt". Hidden when the call fails (it is decoration, never blocking).
- Endpoint (PROPOSED): `GET /stats/players` (E).

### 9.6 Guest upload path with quota messages (PLANNED)

- Guests can upload (today they see a sign-up prompt). Before the drop zone the wizard reads the quota and shows one of: allowed with what remains, "You have used today's summoning. Come back tomorrow or play a pack", "The summoning circle is busy today. Try a pack while it rests", "Create an account to keep more than N dungeons".
- During generation it handles `AI_BUSY` (503) with the same message and a "Play a pack instead" button, and 429 limits with the `Retry-After` time.
- If the notes are too small to count for ranking, the result says so: "This dungeon is playable, but notes this short do not count toward the Own notes leaderboard."
- **Upload notice with a confirm checkbox** before the first upload: "Your notes are sent to third-party AI providers (Google Gemini, and models routed through OpenRouter as a fallback) to generate questions. Free tiers may let these providers keep or use the content under their own terms. Do not upload personal or confidential information." The upload button stays disabled until it is ticked, and the request sends `accept_ai_notice=true`. The copy never promises retention or deletion at the providers beyond what their terms support.
- Clear messages for the type limits: "This PDF has 42 pages; the limit is 30.", the same for PPTX slides and DOCX length, using `limit` and `found` from the error.
- Endpoints (PROPOSED): `GET /uploads/quota` (G), `POST /documents` open to guests within limits and with the `accept_ai_notice` field (A, G), document status with `counts_for_ranking` and `floors[]` (C, G), the errors `UPLOAD_LIMIT_PLAYER`, `UPLOAD_LIMIT_IP`, `UPLOADS_PAUSED_TODAY`, `AI_BUSY`, `QUOTA_EXCEEDED`, `AI_NOTICE_NOT_ACCEPTED`, `TOO_MANY_PAGES`, `TOO_MANY_SLIDES`, `TOO_MUCH_TEXT` (G).

### 9.7 Smaller follow-ups tied to DOC 2

- Show `points_awarded` next to the damage number, with a short reason for reduced points ("Already answered this week: +10").
- Remove the per-dungeon `dungeon_id` query from the leaderboard client.
- Hide "Ghost Rival" wording everywhere in real mode (already true; keep it covered by a boundary test).

### 9.8 Delete my account and data (PLANNED)

- A "Delete my account and data" action in the Settings screen (which replaces the placeholder) and in the Dashboard's account area, for guests and registered players.
- A confirm dialog explains what goes (name, points, leaderboard entries, runs, reviews, uploaded notes and dungeons) and asks the player to type `DELETE`. On success the session ends and the player lands on the title screen.
- Endpoint (PROPOSED change to an existing route): `DELETE /auth/me` with `{"confirm": "DELETE"}`, open to guests too (A-R13).

### 9.9 "Dungeon score" and "Leaderboard points" labels (PLANNED)

- The run value is labelled **Dungeon score** everywhere (HUD, victory and defeat overlays, scorecard, share card).
- The leaderboard value is labelled **Leaderboard points** (leaderboard, You panel, points pop-ups, scorecard line "+830 Leaderboard points").
- The scorecard shows both, one under the other, with a one-line tooltip on the difference. No backend change beyond keeping `score` and `points_*` separate (DOC 2, C.1).

### 9.10 Warm-up call on the title screen (PLANNED)

- When the title screen loads, the frontend sends one `GET /health` (fire and forget, no cookie, result ignored) so a sleeping Render service starts waking while the player reads or types a name. In mock and offline mode nothing is sent.
- Endpoint: `GET /health` (existing; DOC 2 F.7 asks that it stay DB-free and fast).

---

## 10. Assumptions in this document

- **A1**: The frontend-04 Phase 7 work (responsive layout, regression, polish) is covered by frontend-07 and the layout pass, even though its parent checkbox is open.
- **A2**: The Person A prompt pack is not in the repository; the "original plan" for the backend is taken from the master roadmap and A-to-B.md.
- **A3**: The deployed backend URL is `https://studydungeon-api.onrender.com` (from A-to-B Day 3 and `vercel.json`).
- **A4**: Leaderboard points (DOC 2, C) are a new server-only number, separate from the run score on the scorecard.
- **A5**: Until Person A ships G-R11, the 30-page limit is only a frontend hint; Person A must enforce 30 pages (PDF), 30 slides (PPTX) and a DOCX character limit with separate error codes.
- **A6**: The mobile pass works on real phones; it was only checked with headless Edge, DevTools device mode and `?touch=1`.
- **A7**: The warm-up `GET /health` on the title screen (9.10) is enough to start waking Render; the waking screen keeps its 8 s offline offer.
- **A8**: The weekly reset shown in 9.4 ("Monday 00:00 UTC") follows the default proposed in DOC 2; the frontend reads the real value from the response.
- **A9**: The planned copy (notice text, quota messages, counter line) is a draft and can change without backend impact.
- **A10**: The upload notice wording in 9.6 is a draft for Person A and the team to check against each provider's current terms.
- **A11**: Guests see "Delete my account and data" too, since they now persist for 30 days and appear on the leaderboard.
