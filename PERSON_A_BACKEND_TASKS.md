# StudyDungeon: Backend Work for Person A (complete list)

Date: 2026-11-15. Written by Person B after a full real-mode playtest: frontend at `localhost:5173` with `VITE_USE_MOCKS=false`, backend at `localhost:8000`, `AI_PROVIDER=gemini` (`gemini-2.5-flash`), fresh local SQLite.

This file replaces `BACKEND_REMAINING_WORK.md` (root and `docs/handoff/`). Everything Person A still has to build or fix in `backend/` is here. **Person B does all frontend work** (Appendix B lists it, so you know what will consume each endpoint).

Contract test result against the current backend: **27 passed, 0 failed, 13 skipped**. The skips are the missing features below.

---

## 0. Instruction for the AI agent (paste this as is)

```
You are working on the StudyDungeon backend (FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2) in backend/.
Build and fix everything in docs/handoff/PERSON_A_BACKEND_TASKS.md, in the order of Section 13, so that the
existing frontend (frontend/, already built by Person B) switches each feature on with no frontend change,
except the items marked "FRONTEND CHANGE", which Person B makes after you ship.

Rules:
1. Read this whole file first, then backend/app/**, then .kiro/steering/api-contract.md.
2. Do NOT touch frontend/**. Do NOT rename or retype any existing response field (Section 1.2).
   Only ADD fields and endpoints, with exactly the names, types and enum values given here.
   The frontend validates every response with zod: a wrong type, an unknown enum value, or null where
   the field must be absent makes the whole screen fail ("The server sent an unexpected response").
3. Read Section 2 (contract rules learned in the playtest) before writing any route.
4. A feature that is not built must answer 404 (FastAPI default). Never answer 2xx with a placeholder
   body: the frontend treats any 2xx as "this feature is live".
5. The server computes every number (points, ranks, unlocks, quota, counts). Never trust client values.
   No AI call for packs, runs, attempts, leaderboard or counters.
6. Plan with one Kiro spec per build step (requirements -> design -> tasks), then implement.
   Write pytest tests for every acceptance criterion. Tests that call more than one endpoint must use a
   fresh session per request (see backend/tests/test_runs_fresh_session.py), like the real server.
7. After each step: update .kiro/steering/api-contract.md, regenerate docs/openapi.json
   (backend/scripts/export_openapi.py), add response_model to every new route, append a dated entry to
   docs/handoff/A-to-B.md with the exact JSON shipped, and run the frontend contract suite (Section 12).
8. Errors always use {"detail": {"code": "UPPER_SNAKE", "message": "Human sentence.", ...extras}}.
   429 and 503 also send a Retry-After header (seconds).
9. If anything here is ambiguous or conflicts with the code, stop and ask Person A. Do not guess.
```

---

## 1. Current state

### 1.1 Works today (verified in the browser, do not break)

Guest name screen and `POST /guests`, register, login, logout, `GET /auth/me`, `POST /auth/upgrade`, `DELETE /auth/me`, `GET /packs`, `PACK_LOCKED`, `GET /dungeons`, `GET /dungeons/{id}` (with `floors` and `final_boss` for packs), `POST /runs`, answering, room clear, finish with `pack_progress`, resume (`GET /runs/{id}`), `GET /progress`, `GET /reviews/due`, upload of a PDF, Gemini topic and question generation, playing the generated dungeon.

A scripted full run of Pack 1 on the live server: 16 answers, 5 rooms cleared, finish returned `unlocked_pack_id: "pack-2"`, then Pack 1 `completed`, Pack 2 `available`, and a Pack 2 run started.

### 1.2 Fields the frontend reads today (keep names and types exactly)

| Endpoint | Fields |
| --- | --- |
| `GET /dungeons/{id}` | `id, title, is_public_demo?, created_at?, rooms[{id, room_number, topic_name, monster_name, monster_type, monster_hp (int > 0), is_boss, questions[{id, prompt, options (>= 2), difficulty}], floor_id?}]` (>= 1 room), `floors?`, `final_boss?` |
| `POST /runs`, `GET /runs/{id}` | `id, dungeon_id, current_hp, current_score, current_streak, xp_earned, status, started_at?, rooms[{room_id, room_number, topic_name, monster_name, monster_max_hp, monster_current_hp, is_cleared, is_boss}]` |
| `POST /runs/{id}/attempts` | `attempt_id?, is_correct, damage_dealt, damage_taken, is_critical, current_hp, current_score, current_streak, monster_hp_remaining` (ints >= 0), `explanation?, evidence_quote?` |
| `POST /runs/{id}/rooms/{room_id}/clear` | `xp_delta` (int, required), `success?, room_id?, is_cleared?, is_boss?` |
| `POST /runs/{id}/finish` | `id?, score, xp_earned, correct_count, total_attempts, accuracy (0..1), mastery_band, status?, pack_progress?` |
| `GET /packs` | see Section 1.3 |
| `GET /progress` | `user_id?, level (>= 1), total_xp, unlocked_weapons` |
| `GET /reviews/due` | **a bare JSON array** of `{question_id, prompt, options, next_review_at?, repetition_count?}`. Do not turn it into an object. |
| `GET /documents/{id}/status` | `id, status (processing, accepted, rejected, failed), relevance_score?, readability_score?, rejection_reason?, chunks_count?` |
| `POST /documents/{id}/generate-dungeon` | same shape as `GET /dungeons/{id}` |
| user objects | `id, username (string or null), is_guest, created_at?, expires_at?, public_id?, display_name?, tag?, handle?` |

### 1.3 Pack shapes (already shipped, keep)

`GET /packs`: `{packs[{id, order, title, description, dungeon_id, floors_total, floors_cleared, final_boss_cleared, status (locked|available|in_progress|completed), points_earned}], next_pack_id (string|null), all_completed}`.
Finish `pack_progress`: `{pack_id, status, unlocked_pack_id (string|null), all_completed}`.

### 1.4 Fixes Person B made in `backend/` during the playtest (review them, keep them)

All are on branch `feature/frontend-live-players`, each with a pytest file.

| Commit | Fix | Test |
| --- | --- | --- |
| `b10096d` | Pack dungeons were 404 on `GET /dungeons/{id}` (system-owned, not public demo). Pack rooms were seeded 1-based while all run logic is 0-based, so the final boss was never the boss. `monster_type` stored the role (`minion`) instead of the monster name. Finish reported `unlocked_pack_id` on every replay. Legacy rows are corrected on startup in `seed_packs.py`. | `tests/test_pack_progress_replay.py` |
| `bb4abab` | Floor `status` was `"available"` (not a frontend value) and `rank` was dropped by `response_model_exclude_none`, so every pack failed to load. Status is now `ready`/`locked`/`cleared`; `rank` is always present. A completed run marks every floor `cleared` and the final boss `unlocked`. | same file |
| `bc7da57` | `generate-dungeon` checked each `evidence_quote` against chunk 0 only, so all Gemini questions were dropped (dungeons with 0 questions). Quotes now match any chunk (whitespace-normalised), malformed questions are dropped, topics with no question get no room, and nothing grounded answers 502 `GENERATION_FAILED`. The response now omits null fields (`floor_id: null` broke the frontend). Gemini: read timeout 90 s, `thinkingBudget: 0` for 2.5 Flash (it timed out at 25 s), the error log names the exception. | `tests/test_generation_grounding.py` |
| `0d15f34` | Every answer after the first crashed with `MissingGreenlet` (lazy load of `attempt.question` under the async session). All four run routes now `selectinload(GameRun.attempts).selectinload(Attempt.question)`. | `tests/test_runs_fresh_session.py` |

---

## 2. Contract rules learned in the playtest (read before writing any route)

Every bug found in the playtest broke one of these:

1. **Optional means absent, not null.** A field typed `field?: string` in this file must be left out when it has no value. Sending `null` fails validation. Use `response_model_exclude_none=True` on routes that return dungeons, or build the dict without the key. Only fields written as "string or `null`" may be `null`.
2. **Required-but-nullable fields must be present.** `floors[].rank`, `next_pack_id`, `pack_progress.unlocked_pack_id`, `me` and `me.rank` must always be in the JSON (as `null` when empty). With `exclude_none` on, add them back (see `DungeonFloorView._keep_rank` in `app/schemas/dungeons.py`).
3. **Enums are closed.** Only the values listed here. Floor status: `locked, ready, generating, failed, cleared`. Pack status: `locked, available, in_progress, completed`. Rank: `S, A, B, C`.
4. **Eager-load every relationship a route reads.** A lazy load under `AsyncSession` raises `MissingGreenlet` and the request fails with 500. Tests that share one session do not catch it; test with a fresh session per request.
5. **A 500 shows in the browser as a CORS error** (Section 3.1). Until that is fixed, read the backend log, not the browser console.
6. **Room order is 0-based** everywhere (`room_order == total_rooms - 1` is the boss; `room_number = room_order + 1`).
7. **Ids in floor `room_ids` and `final_boss.id` must be ids of rooms in the same response.**

---
## 3. Bugs and small fixes (do these first, about one day)

### 3.1 A 500 response has no CORS headers
`app.add_exception_handler(Exception, generic_exception_handler)` is served by Starlette's `ServerErrorMiddleware`, which sits outside `CORSMiddleware`. So every crash reaches the browser as "blocked by CORS policy" and the frontend cannot show the error message.
- Fix: catch unhandled exceptions inside the CORS layer (a small middleware added before `CORSMiddleware`, or set the `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` headers in the generic handler for allowed origins only).
- Acceptance: a route that raises answers 500 with `{"detail": {"code": "INTERNAL_SERVER_ERROR", ...}}` and `Access-Control-Allow-Origin: http://localhost:5173` for that origin; a disallowed origin still gets no CORS header.

### 3.2 Uploads stuck at "processing"
Document processing runs in a FastAPI `BackgroundTask`. If the server restarts mid-job, the document stays `processing` forever, still counts toward the 5-document limit, and cannot be played.
- Fix: on startup, mark documents still `processing` and older than `INGESTION_TIMEOUT_SECONDS * 4` as `failed` with `rejection_reason: "Processing was interrupted. Please retry."`. `POST /documents/{id}/retry` already exists for them.
- Acceptance: a document left `processing` before a restart is `failed` after startup and can be retried.

### 3.3 Demo and guest sessions point at the old seeded demo, not Pack 1
`POST /demo/session` and `POST /guests` return the `is_public_demo` dungeon ("Computer Systems & Architecture (Seeded Demo)", 4 rooms, no floors). So "Try the Demo" plays a dungeon with no floors that never counts for Pack 1, and players see two near-identical dungeons.
- Fix: return Pack 1's `dungeon_id` from both endpoints, and keep the old seeded demo out of `GET /dungeons` (or mark Pack 1's dungeon `is_public_demo=true` and stop seeding the old one). Keep the old one in the DB for existing runs.
- Acceptance: a new guest's `dungeon_id` equals `GET /packs` pack 1 `dungeon_id`; `GET /dungeons` lists one demo.

### 3.4 Pressing Summon twice makes two dungeons
`POST /documents/{id}/generate-dungeon` creates a new dungeon on every call (and makes a new Gemini call each time).
- Fix: if the document already has a dungeon, return it (200) without calling the AI. A regenerate option, if wanted later, is a separate explicit flag.
- Acceptance: two calls return the same `id`; the AI provider is called once.
- Person B also disables the button while the request runs.

### 3.5 Topics list is empty before Summon
`GET /documents/{id}/topics` returns `[]` until generation, because topics are created in `generate-dungeon`. The upload screen shows "Topics found (0)" before Summon.
- Choose one and tell Person B in A-to-B.md: (a) detect topics during ingestion (no questions yet) so the list fills before Summon, or (b) keep it and Person B changes the copy to "Topics appear when you summon". (b) is fine for the hackathon.

### 3.6 Floor titles and per-player floor state
In `GET /dungeons/{id}`:
- Floor `title` is built as `"Floor N: <first topic>"`. Use the floor `title` from the pack JSON (`"The Entry Crypt (CPU & Registers)"`), and the floor boss `name` from the JSON too.
- Floor `status` is `ready` for floor 1 and `locked` for the rest until the whole dungeon is completed. With floor-scoped runs (Section 9) it must be per player: a floor is `cleared` when the player finished a run that cleared its boss room, the next floor becomes `ready` then, `final_boss.unlocked` is true when every floor is cleared.
- `rank` is always `null` today. Fill it from the player's best finished run of that floor (Section 9.4 rule).
- `topics[].mastery` is always 0. Fill it from the player's attempts on that topic (0 to 100, first-try accuracy is fine).

### 3.7 Small fixes
1. `GEMINI_MODEL` default in `config.py` is `gemini-2.0-flash`. Make the env value required when `AI_PROVIDER=gemini` (the deployed `.env` uses `gemini-2.5-flash`).
2. `COOKIE_SECURE=true` in the deployed environment (local HTTP stays false). Document it in `render.yaml`.
3. Guests return an internal `guest_xxxxxxxx` as `username`. Return `null` for guests (the frontend never shows it; the type already allows null).
4. `tests/test_break_baseline.py::test_session_attack_tampered_signature` fails (it expects 401 and gets 200). Check whether a tampered session cookie is really accepted; if it is, that is a security bug: fix the verification, not the test.
5. `uvicorn` logs every request at INFO through `stderr`; fine locally. On Render, set `--log-level warning` or keep INFO, your choice.

---

## 4. Leaderboard points  [Frontend: READY]

The frontend shows "+N points" next to the damage number, a reason line for reduced points, and "Leaderboard points" on the scorecard. Leaderboard points are a separate number from the run score ("Dungeon score"). Never mix them.

### 4.1 Response additions (all optional; the client never sends them)

```json
POST /runs/{id}/attempts               + { "points_awarded": 10, "points_reason": "repeat_correct", "points_bonus": 25,
                                           "player_points": { "preloaded": 1250, "own_notes": 0, "overall": 1250 } }
POST /runs/{id}/rooms/{room_id}/clear  + { "points_awarded": 50, "points_reason": "room_clear" }
POST /runs/{id}/finish                 + { "points_earned": 830,
                                           "player_points": { "preloaded": 2080, "own_notes": 0, "overall": 2080 } }
GET  /packs                            packs[].points_earned = that player's points on that pack (all time)
```

Types: `points_awarded`, `points_bonus`, `points_earned` int >= 0. `points_reason` string. `player_points` has `preloaded`, `own_notes`, `overall` (ints >= 0).

`points_reason` values the frontend words: `first_correct`, `repeat_correct`, `retry`, `wrong`, `too_fast`, `practice`, `not_ranked`, `daily_cap`, `room_clear`, `boss_clear`, `pack_complete`. Other values show without a reason line; tell Person B if you add one.

### 4.2 Point table (server config, defaults)

| Event | Points | Rule |
| --- | --- | --- |
| First correct answer to a question in the week | 100 (`easy`/`medium`), 150 (`hard`) | Once per player, question and week |
| Repeat correct in the same week | 10 | |
| Second-chance retry in the same run | half, rounded half to even | |
| Wrong answer | 0 | |
| Streak bonus | your rule in `game-design.md` (placeholder: +25 at every 3rd consecutive full-point correct) | `points_bonus` |
| Room cleared (first time this week) | 50 | Once per player, room and week |
| Floor boss or final boss defeated (first time this week) | 200 | Once per player, boss room and week |
| Pack completed (first time ever) | 500 | Once per player and pack |
| Answer faster than `MIN_ANSWER_MS` (800 ms) after the previous attempt | 25 percent, `too_fast` | Damage and HP still apply |
| Daily Haunt and practice modes | 50 percent of answer values, `practice`; no room, boss or pack bonus | |
| Own-notes dungeon below the ranking minimum (last paragraph of 4.2) | 0, `not_ranked` | |
| Own-notes points above `OWN_NOTES_DAILY_POINTS_CAP` (2000 per UTC day) | 0, `daily_cap` | |

The week runs Monday 00:00 UTC to the next Monday 00:00 UTC. Board of a point: `preloaded` (pack dungeons) or `own_notes` (own dungeons that count for ranking); `overall` is both. An own-notes dungeon counts for ranking only with at least `RANKING_MIN_CHARS` (3000) extracted characters and at least 2 topics.

### 4.3 Rules
- Server-side only. Request keys like `points`, `score`, `damage` have no effect.
- **Append-only ledger** `point_events (id, user_id, attempt_id?, run_id, board, reason, points, week_start, created_at, question_id?, room_id?, pack_id?)`. Totals in `player_stats (user_id, public_id, points_preloaded, points_own_notes, points_overall, reached_at_* , rooms_cleared, is_ranked)` and `player_week_stats (same, per week_start)`.
- The attempt, its point events and the totals are written in **one transaction**, with the run row locked (`SELECT ... FOR UPDATE` on Postgres; SQLite serialises writes).
- **Idempotent**: `(user_id, attempt_id)` unique. A repeated `attempt_id` returns the stored response including the stored `points_awarded`.
- "First correct" uses a partial unique index on `(user_id, question_id, week_start) WHERE reason = 'first_correct'`; on conflict record `repeat_correct`. Same pattern for `room_clear`, `boss_clear`, `pack_complete`.
- `reached_at_*` is updated whenever the total changes (used for tie-breaks).
- Add `scripts/rebuild_points.py`: recompute totals from the ledger and report differences.
- Alembic migration for all tables and indexes; must run on SQLite (tests, local) and Postgres (Supabase).

### 4.4 Acceptance
1. First correct gives 100 (150 hard); a second correct to the same question that week gives 10 with `repeat_correct`; after the weekly reset it gives full points again.
2. Two parallel requests for the same first correct give exactly one `first_correct` and one `repeat_correct`.
3. Replaying an `attempt_id` returns identical JSON and the ledger does not grow.
4. An attempt 300 ms after the previous one earns 25 percent with `too_fast`; at 900 ms full points.
5. Clearing Pack 1's final boss for the first time adds `boss_clear` 200 and `pack_complete` 500; the replay adds neither.
6. After any sequence, totals equal the ledger sum (Hypothesis property test).
7. `GET /packs` `points_earned` equals the sum of that player's preloaded points on that pack.

---
## 5. Real leaderboard  [Frontend: READY]

The leaderboard page (tabs Preloaded, Own notes, Overall, All time, This week; podium for the top 3; ranks 4 to 20; pinned "Your live rank" panel), the dashboard Top 5 and the scorecard rank all switch from the demo board to real players as soon as this endpoint answers 2xx. Today it is 404, so the frontend shows nothing in real mode (Ghost Rivals are never shown in real mode).

### 5.1 `GET /leaderboard?board=preloaded|own_notes|overall&period=all|week`

Public (visitors and guests can read it). Defaults `board=overall`, `period=all`. Always the top 20.

```json
{
  "board": "preloaded",
  "period": "week",
  "week": { "timezone": "UTC", "starts_at": "2026-11-16T00:00:00Z", "resets_at": "2026-11-23T00:00:00Z" },
  "updated_at": "2026-11-20T12:00:00Z",
  "next_refresh_at": "2026-11-20T13:00:00Z",
  "total_ranked_players": 143,
  "entries": [
    { "rank": 1, "public_id": "p_x81kq0", "handle": "Raven#4821", "display_name": "Raven", "tag": "4821",
      "is_guest": true, "level": 4, "points": 2450, "rooms_cleared": 12, "badge_ids": ["boss_slayer"] }
  ],
  "me": {
    "live": true, "public_id": "p_8f3k2m", "handle": "Bat#2231", "rank": 37, "points": 610,
    "next_above": { "rank": 36, "handle": "Owl#7710", "points": 640, "points_needed": 31 },
    "top20": { "in_top20": false, "cutoff_points": 1120, "points_needed": 511 }
  }
}
```

Types the frontend validates:
- `board`: `preloaded|own_notes|overall`. `period`: `all|week`.
- `week`: object or `null` (null for `period=all`); `timezone` (IANA), `starts_at`, `resets_at` (ISO).
- `updated_at`, `next_refresh_at`: ISO strings, required. `total_ranked_players`: optional int >= 0.
- `entries[]`: `rank` (int >= 1), `public_id` (non-empty), `handle`, `display_name?`, `tag?`, `is_guest` (bool), `level` (int >= 0), `points` (int >= 0), `rooms_cleared` (int >= 0), `badge_ids?` (string array).
- `me`: `null` without a session. Otherwise `live` (bool), `public_id?`, `handle?`, `rank` (int >= 1 or `null`), `points` (int >= 0), `next_above` (object or `null`; `rank, handle, points, points_needed`), `top20` (required; `in_top20` bool, `cutoff_points` int >= 0, `points_needed` int >= 0), `reason?` (string).

### 5.2 Rules
- **Never return** `username`, the internal user `id` or IP data anywhere in this response.
- **Real players only.** Exclude `is_test`, `is_system`, inactive and purged users, and players with 0 points on that board and period. Guests are included (by handle).
- **Snapshot** for `entries`, recomputed at most once per hour per (board, period, week). Lazy refresh: if missing or older than 1 hour, one request recomputes it (Postgres: `pg_try_advisory_xact_lock`; SQLite: a process lock), others serve the old one. No cron. `next_refresh_at = updated_at + 1 hour`.
- **`me` is live** from the totals, not the snapshot. One indexed count query.
- **Tie-breaks** make ranks unique: points desc, then `reached_at` asc, then `public_id` asc. So `points_needed` to pass = `above.points - me.points + 1`. The frontend shows `points_needed` as sent.
- `me.rank = null` with `reason: "no_points_yet"` at 0 points. `next_above = null` at rank 1. `top20.points_needed = 0` inside the top 20. With fewer than 20 ranked players `cutoff_points = 0`.
- Unknown `board` or `period`: 422 `VALIDATION_ERROR`.
- `Cache-Control: private, no-store` when `me` is present, else `public, max-age=60`.
- A registered player's `handle` is `display_name#tag`, never the login name. Registration must set `display_name` and `tag` if missing (use the register username as display name).

Rank query (same pattern per board column and on the weekly table):

```sql
CREATE INDEX ix_ps_overall ON player_stats (points_overall DESC, reached_at_overall ASC, public_id)
  WHERE is_ranked AND points_overall > 0;
SELECT count(*) + 1 FROM player_stats s
WHERE s.is_ranked AND s.points_overall > 0
  AND (s.points_overall > :p
       OR (s.points_overall = :p AND s.reached_at_overall < :r)
       OR (s.points_overall = :p AND s.reached_at_overall = :r AND s.public_id < :pid));
```

### 5.3 Acceptance
1. No cookie: 200, at most 20 entries, `me: null`, `updated_at` and `next_refresh_at` one hour apart, no `username` key anywhere.
2. Two requests in the same hour return the same `updated_at`; 50 parallel requests on a stale snapshot recompute once.
3. A player who earns points sees the new rank in `me` immediately; `entries` change after the next refresh.
4. Ranks are 1..n without gaps; equal points ordered by who reached the total first.
5. `is_test`, `is_system` and 0-point players never appear.
6. On Monday 00:00 UTC the weekly board is empty; all time is unchanged.
7. `preloaded + own_notes = overall` for every player (property test).

---

## 6. Player counter  [Frontend: READY]

Title screen: "N explorers have braved the dungeon" for 10 or more, "Be among the first explorers" for 1 to 9, nothing for 0 or on error.

### 6.1 `GET /stats/players` (public)

```json
{ "players": 143, "rooms_cleared_total": 982, "answers_total": 15230, "packs_completed_total": 61,
  "updated_at": "2026-11-20T12:00:00Z", "cache_seconds": 300 }
```

`players` int >= 0 (required). The rest optional: ints >= 0, `updated_at` ISO, `cache_seconds` number >= 0.

### 6.2 Rules
- `players` = players with at least one successful room clear (`player_stats.rooms_cleared > 0`, updated in the room-clear transaction), excluding `is_test` and `is_system`. Guests count; purged guests stop counting.
- In-memory cache `STATS_CACHE_SECONDS` (300) and `Cache-Control: public, max-age=300`.

### 6.3 Acceptance
1. A guest who only answers does not change `players`; after the first room clear (and cache expiry) it grows by 1.
2. Test and system accounts never change it.
3. 100 requests in 5 minutes make at most one DB query.

---

## 7. Guest upload, quota and AI routing  [Frontend: READY]

The upload page already shows a quota chip, the AI notice with a required checkbox, the blocked states with "Play preloaded dungeons instead", and "The summoning circle is busy". Guests get the wizard as soon as `GET /uploads/quota` answers 2xx for a guest. Today guests get 403 `GUEST_FORBIDDEN` from `POST /documents` and see "Create an account to upload your own notes".

### 7.1 `GET /uploads/quota` (session required, guests included)

```json
{
  "can_upload": true,
  "reason": null,
  "player": { "is_guest": true, "used_today": 0, "limit_today": 1, "stored": 0, "stored_limit": 2,
              "resets_at": "2026-11-21T00:00:00Z" },
  "global": { "available": true },
  "ranking": { "min_chars": 3000, "min_topics": 2 }
}
```

`can_upload` bool. `reason`: `null` or `player_daily_limit`, `ip_daily_limit`, `stored_limit`, `global_daily_limit`, `ai_unavailable`. `player` required: `is_guest` bool, `used_today`, `limit_today`, `stored`, `stored_limit` ints >= 0, `resets_at?` ISO. `global?`: `available` bool. `ranking?`: `min_chars`, `min_topics` ints >= 0.

### 7.2 `POST /documents` changes
- **Allow guests** within guest limits (replace 403 `GUEST_FORBIDDEN`).
- Require multipart field **`accept_ai_notice=true`** (the frontend sends it). Store `ai_notice_accepted_at` and the notice version on the document. Missing or false: 422 `AI_NOTICE_NOT_ACCEPTED`.
- Check quotas **before any AI call**, in this order: per IP, per player per day, stored documents, global per day.

Defaults (env): registered 3 generations per UTC day and 5 stored documents; guest 1 per day and 2 stored; 3 per IP per day; 40 per day in total. The stored limit (5) exists today as a hard-coded `>= 5` in `documents.py`: move it to settings.

| Status | Code | When |
| --- | --- | --- |
| 429 | `UPLOAD_LIMIT_PLAYER` | player daily limit (`Retry-After` until UTC midnight) |
| 429 | `UPLOAD_LIMIT_IP` | IP daily limit (`Retry-After`) |
| 400 | `QUOTA_EXCEEDED` | stored documents limit (existing code, keep the message "You already have 5 documents. Delete an older one before uploading another.") |
| 503 | `UPLOADS_PAUSED_TODAY` | global daily cap |
| 503 | `AI_BUSY` | every AI provider failed; add `"retry_after_seconds": 600, "offer_packs": true` to `detail` |
| 422 | `AI_NOTICE_NOT_ACCEPTED` | notice missing |

**Decision needed** (write it in A-to-B.md): do rejected or failed uploads use up the daily quota? Person B suggests: only accepted documents count.

### 7.3 `GET /documents/{id}/status` additions (optional)

```json
{ "...existing...": "...", "counts_for_ranking": false,
  "ranking_note": "Notes this short do not count toward the Own notes leaderboard.",
  "dungeon_id": "d_5", "floors": [ { "id": "f_1", "status": "ready" }, { "id": "f_2", "status": "generating" } ] }
```

### 7.4 `GET /documents` (already exists) and `DELETE /documents/{id}` (already exists)
Person B is adding a "My notes" screen that lists `GET /documents` and deletes with `DELETE /documents/{id}`. Please confirm in A-to-B.md: the list item fields (today `DocumentResponse`), and that delete also removes the document's dungeon, topics, questions and runs (or detaches them), and frees a stored slot immediately. Add `dungeon_id?` to each list item if a dungeon exists.

### 7.5 AI routing
- Gemini first. Then OpenRouter `:free` models in one request with the `models` fallback array (only `:free` ids, validated at startup), only when `OPENROUTER_ENABLED=true`. Paid OpenRouter only with `OPENROUTER_PAID_ENABLED=true` and under `AI_PAID_DAILY_CAP_USD`. Never for packs or the demo.
- Log every AI call in `ai_usage (id, user_id, document_id, provider, model, ok, latency_ms, tokens_in, tokens_out, created_at)`; never store document text there.
- Cache generation by content hash per player: the same file twice makes one AI call and uses one daily generation.
- Keep the playtest settings: read timeout 90 s, `thinkingBudget: 0` for 2.5 Flash JSON calls.
- Generation runs inside the HTTP request today (about 16 s for a 24-chunk PDF). Fine for now; if it grows, move it to the background like ingestion and report floor status (Section 9.3).
- `build_topics_and_questions` sends only the first 15 chunks. For longer notes either send more (Gemini's context is large) or split per floor (Section 9.3). Tell Person B which.

### 7.6 Acceptance
1. A guest's first upload with `accept_ai_notice=true` is accepted; the second the same day is 429 `UPLOAD_LIMIT_PLAYER` before any AI call, and the quota reports `player_daily_limit`.
2. Without `accept_ai_notice`: 422 `AI_NOTICE_NOT_ACCEPTED`.
3. With every provider failing: 503 `AI_BUSY` with `offer_packs: true`, and no paid call unless enabled.
4. The same file twice: one AI call, one daily generation.
5. The temp upload folder is empty after a successful and after a failed ingestion.

---

## 8. File limits  [Frontend: READY]

Check after extraction and before any AI call. Each error carries ints `limit` and `found` in `detail`.

| Type | Limit | Error |
| --- | --- | --- |
| PDF | 30 pages | 422 `TOO_MANY_PAGES` |
| PPTX | 30 slides | 422 `TOO_MANY_SLIDES` |
| DOCX, TXT | `MAX_DOCX_CHARS` extracted characters, default 60,000 (**confirm or change**) | 422 `TOO_MUCH_TEXT` |

```json
{ "detail": { "code": "TOO_MANY_PAGES", "message": "This PDF has 42 pages; the limit is 30.", "limit": 30, "found": 42 } }
```

Acceptance: a 31-page PDF, a 31-slide PPTX and an over-limit DOCX each return their own code with `limit` and `found`, and no AI call is made. If you change a number, tell Person B (`frontend/src/upload/limits.ts`).

---
## 9. Floor runs, practice modes, Daily Haunt  [FRONTEND CHANGE: small, Person B]

A dungeon is a campaign of floors (2 topic rooms each, the second holds the floor boss) plus a final boss that unlocks after every floor is cleared. Packs already have this shape on `GET /dungeons/{id}`. What is missing is playing **one floor per run**: today one run covers every room of the dungeon, so the map can only unlock floor 2 by clearing everything.

### 9.1 `POST /runs` body additions (optional; `{dungeon_id}` alone must keep working exactly as today)

```json
{ "dungeon_id": "d_1", "floor_id": "p1_f2", "mode": "floor" }
```

- `mode`: `floor`, `replay_floor`, `daily_haunt`, `weak_topics`, `exam`. `floor_id` is required for `floor` and `replay_floor`, `null` for the others. For the final boss, send `mode: "floor"` with `floor_id` = the final boss room id (`final_boss.id`).
- `floor` / `replay_floor`: the run contains only that floor's rooms (`room_ids`), in order; the last is the floor boss; finish works after it. `floor` on a `locked` floor: 403 `FLOOR_LOCKED`. `replay_floor` on a floor that is not `cleared`: 409 `FLOOR_NOT_CLEARED`.
- Final boss run: one room; 403 `FINAL_BOSS_LOCKED` until every floor is cleared. Clearing it is what completes the pack (`pack_progress`).
- The run response `rooms` lists only the run's rooms, and adds optional `room_ids` (string array) in run order.
- `weak_topics`: rooms of the 2 weakest topics for this player. `exam`: one room per topic. Both return `room_ids`; finish works after the last.
- Question pools: when a topic has more than 8 questions, pick 6 to 8 per run seeded by the run id, and return only those in the run's rooms.

### 9.2 Daily Haunt
- `mode: "daily_haunt"`: a run made only of the player's due review questions (cap 8), no room monster. The run response adds `revenants: [{question_id, prompt, options, room_id?}]` (no answers).
- Attempts on those questions are accepted (skip the room-order check for this mode) and update the review schedule.
- Finishing a Daily Haunt adds a day to `daily_streak` (store per player, UTC days).
- Nothing due: 409 `NOTHING_DUE` with `next_due_at` (ISO) in `detail`.

### 9.3 Floors for uploaded notes, lazy generation and retry
- Today generated dungeons have no floors (every room `floor_id` null), so they play as one flat dungeon. Group topics into floors of 2 rooms (the second is the floor boss) and return `floors` and `final_boss` like packs.
- Optional, after that: generate the topic map and floor 1 first, later floors in the background; floor status `generating` then `ready` or `failed`, shown on `GET /dungeons/{id}` and `GET /documents/{id}/status`.
- `POST /floors/{id}/retry` re-runs a `failed` floor and answers `{"id": "f_2", "status": "generating"}`; 409 `FLOOR_NOT_FAILED` otherwise.
- Size cap: 422 `DUNGEON_TOO_LARGE` ("These notes are very large. Upload a smaller section to get the best floors.").

### 9.4 Finish additions (optional; frontend READY)

```json
{ "...": "...", "floor_rank": "A",
  "mastery_by_topic": [ { "topic_id": "t_3", "title": "Networking", "mastery": 71 } ],
  "chest_rewards": [ { "id": "cr_1", "kind": "xp", "label": "Bonus XP", "amount": 40 } ] }
```

`floor_rank`: `S|A|B|C`. `chest_rewards[].kind`: `xp|coins|weapon|badge`. Default rank (write the final rule in `game-design.md`): S at first-try accuracy >= 0.90 with no retry, A >= 0.80, B >= 0.60, else C. The best rank per player and floor is what `GET /dungeons/{id}` returns as `floors[].rank`.

### 9.5 Acceptance
1. `{dungeon_id}` only still works exactly as today.
2. `mode: "floor"` on Pack 1 floor 1 returns only rooms `p1_r1`, `p1_r2`; finish works after `p1_r2`; then `GET /dungeons/{id}` shows floor 1 `cleared` with a rank and floor 2 `ready`.
3. Floor 2 before floor 1 is cleared: 403 `FLOOR_LOCKED`. Final boss before both: 403 `FINAL_BOSS_LOCKED`.
4. Clearing the final boss run gives `pack_progress` with `unlocked_pack_id`.
5. A `daily_haunt` run accepts attempts on due questions and moves their review dates.
6. An uploaded document with 4 topics gives 2 floors and a final boss.

---

## 10. Learning loop extras  [mixed]

| Field | Where | Frontend |
| --- | --- | --- |
| `correct_answer` (option text) | attempt response, **only after a wrong answer** | READY (Memory Scroll) |
| `requeue_after` (int >= 0 or `null`) | attempt: questions until a missed one returns | READY |
| `is_retry` (bool), `retry_multiplier` (number) | attempt, when the question is a returned miss | READY |
| `combo` (int >= 0) | attempt | READY |
| `source: {"page": 4, "chunk_id": "c_12"}` | attempt, for "From your notes: page 4" | FRONTEND CHANGE |
| `xp_to_next` (int > 0) | `GET /progress` | FRONTEND CHANGE |
| `due_at`, `topic_id`, `floor_id` per item | `GET /reviews/due` items (keep the bare array) | safe to add |

Never put `correct_answer`, `explanation` or `evidence_quote` in `GET /dungeons/{id}` or run responses. Requeue default: gap 3 questions, at most 2 returns per question per run (decide in `game-design.md`).

Acceptance: a wrong answer returns `correct_answer` equal to the correct option text; a correct answer never includes it. A missed question comes back with `is_retry: true` after `requeue_after` more questions.

---

## 11. Deployment (backend side)

- `render.yaml`: `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-2.5-flash`, `GEMINI_API_KEY` and `DATABASE_URL` as secrets (never in the repo), `SECRET_KEY` generated, `COOKIE_SECURE=true`, `FRONTEND_ORIGIN` = the Vercel URL, `CORS_ORIGINS` includes it.
- Cross-site cookies (Vercel frontend, Render backend on different domains): the session cookie needs `SameSite=None; Secure`, or route the API through a Vercel rewrite so it is same-site (the config already trusts one proxy hop). Pick one and tell Person B; the frontend `VITE_API_BASE` follows it.
- Run `alembic upgrade head` on deploy (pre-deploy command), then startup seeds packs.
- `GET /health/ready` must check the DB.
- **Rotate the Supabase database password**: it was printed in a chat log on 2026-11-15. Update `DATABASE_URL` everywhere after.

---

## 12. How to test against the frontend

1. Backend on port 8000, disposable DB:
   ```
   $env:DATABASE_URL='sqlite+aiosqlite:///./contract_check.db'; python -m alembic upgrade head; python -m uvicorn app.main:app --port 8000
   ```
2. Contract suite (in `frontend/`, PowerShell):
   ```
   $env:VITE_API_BASE='http://127.0.0.1:8000'; $env:VITE_USE_MOCKS='false'; npx vitest --run src/contract/http.contract.test.ts
   ```
   Today: 27 passed, 0 failed, 13 skipped. These must switch from skipped to passed:

   | Section | Contract cases |
   | --- | --- |
   | 4 Points | final boss clear reports `pack_progress` and points |
   | 5 Leaderboard | at most 20 entries, ranks 1..n, no private keys; `me` with a session |
   | 6 Counter | non-negative integer `players` |
   | 7 Upload | quota shape, never offers a blocked upload; `POST /documents` without the notice is 422 |
   | 9 Floors | floor run returns only its rooms (after Person B's client change) |

3. Real browser: `frontend/.env.local` with `VITE_USE_MOCKS=false`, `VITE_API_BASE=http://localhost:8000`, `npm run dev`, open http://localhost:5173. Play Pack 1 to the unlock screen, upload a PDF, play it, check the leaderboard.
4. Backend: `python -m pytest -q` must be fully green (fix 3.7 item 4).

---

## 13. Build order (one Kiro spec each)

| Step | Scope | Size |
| --- | --- | --- |
| 1 | Section 3: CORS on 500, stuck uploads, demo = Pack 1, idempotent Summon, floor titles from JSON, small fixes | 1 day |
| 2 | Section 4: points ledger and response fields | 2 days |
| 3 | Sections 5 and 6: leaderboard and player counter | 1 to 2 days |
| 4 | Sections 7 and 8: guest upload, quota, notice, limits, AI routing, My-notes confirmation | 2 days |
| 5 | Section 9.1, 9.4 and the per-player floor state of 3.6: floor runs, final boss run, ranks, mastery | 2 days |
| 6 | Section 9.2 and 9.3: Daily Haunt, practice modes, floors for uploads, retry | 2 days |
| 7 | Section 10 and 11: learning loop extras, deployment | 1 day |

Steps 2 and 3 make the leaderboard real, the most visible gap. Step 4 can run in parallel with 3.

---

## 14. Checklist for Person A

- [ ] Review and keep Person B's backend fixes (Section 1.4)
- [ ] Step 1: Section 3 bugs and small fixes, full pytest green
- [ ] Step 2: points ledger, `points_awarded` / `points_reason` / `points_bonus` / `player_points` / `points_earned`
- [ ] Step 3: `GET /leaderboard`, `GET /stats/players`
- [ ] Step 4: guest upload, `GET /uploads/quota`, `accept_ai_notice`, limit and busy errors, file limits, AI routing
- [ ] Step 5: floor runs, final boss run, per-player floor status, rank and mastery
- [ ] Step 6: Daily Haunt, practice modes, floors for uploaded notes, floor retry
- [ ] Step 7: learning loop extras, deployment config, Supabase password rotated
- [ ] Decisions written (Appendix A)
- [ ] Every step: contract suite run, `api-contract.md`, `openapi.json`, A-to-B.md entry with the exact JSON

---

## Appendix A. Decisions Person A must write down (`game-design.md` or A-to-B.md)

1. Streak bonus rule (Section 4.2).
2. Floor rank thresholds (Section 9.4).
3. Requeue gap and max returns, retry multiplier (Section 10).
4. DOCX character limit (Section 8).
5. Do rejected or failed uploads use up the daily quota (Section 7.2)?
6. Topics before Summon: detect at ingestion, or keep empty (Section 3.5)?
7. Long notes: more than 15 chunks, or per-floor generation (Section 7.5)?
8. Production cookies: `SameSite=None` or a Vercel rewrite (Section 11)?

## Appendix B. Frontend work Person B does (so you know who consumes what)

| Frontend change | Needs from backend |
| --- | --- |
| "My notes" screen: list and delete documents, free a slot | `GET /documents`, `DELETE /documents/{id}` (exist; 7.4 confirmation) |
| Disable Summon while it runs | nothing (3.4 makes the backend safe too) |
| "Topics appear when you summon" copy, if 3.5 (b) | decision |
| Send `floor_id` and `mode` on `POST /runs`, final boss as its own run, turn on `modes` and `dailyHaunt` | Section 9.1, 9.2 shipped |
| Wire `POST /floors/{id}/retry` (stub answers 501 today) | Section 9.3 |
| Read `source` on attempts and `xp_to_next` on progress | Section 10 |
| Verify leaderboard, counter, quota, guest upload switch on live; fix anything that does not match | Sections 4 to 8 |
| Favicon, real-device HUD check, README, Vercel deploy, demo video | Section 11 cookie decision |
