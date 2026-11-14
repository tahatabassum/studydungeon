# StudyDungeon: Remaining Backend Work (Person B to Person A)

Date: 2026-11-12. Written by Person B after running the frontend contract tests against the latest `main` backend (commit `c82a9ec`, local SQLite, `AI_PROVIDER=mock`). Result: **25 passed, 0 failed, 15 skipped**. Everything that exists works. The skips are the features below, which return 404 today.

This file is self-contained. Deeper background for each section is in `docs/handoff/BACKEND_REQUIREMENTS_V2.md` (section letters in brackets) and `docs/handoff/B-to-A.md` (section "frontend-10 live players").

---

## 0. Instruction for the AI agent (paste this as is)

```
You are working on the StudyDungeon backend (FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2) in backend/.
Your job: build every feature in docs/handoff/BACKEND_REMAINING_WORK.md, in the build order of Section 12,
so that the existing frontend (frontend/, already built) switches each feature on with no frontend change
(except the few items marked "FRONTEND CHANGE NEEDED", which Person B will do after you ship).

Rules:
1. Read this whole file first, then docs/handoff/BACKEND_REQUIREMENTS_V2.md, then backend/app/**.
2. Do NOT touch frontend/**. Do NOT change the shape of any existing response field listed in Section 1.
   Only ADD fields and endpoints. New response fields must use exactly the names, types and enum values
   given here: the frontend validates every response with zod and a wrong type breaks the screen.
3. An endpoint that is not built yet must answer 404 (FastAPI default). Never answer 200 with a partial
   or placeholder body: the frontend treats any 2xx as "feature is live".
4. The server computes every number (points, ranks, unlocks, quota, counts). Never trust a value sent by
   the client. No AI provider call for packs, runs, attempts, leaderboard or counters.
5. Plan with Kiro specs (one spec per build step in Section 12: requirements -> design -> tasks), then
   implement step by step. Write pytest tests for every acceptance criterion in this file.
6. After each step: update .kiro/steering/api-contract.md, regenerate docs/openapi.json
   (backend/scripts/export_openapi.py), add response_model to every new route, and append a dated entry
   to docs/handoff/A-to-B.md with the exact request/response JSON you shipped.
7. After each step run the frontend contract suite against your local backend (Section 11) and report
   which skipped cases now pass.
8. Errors always use {"detail": {"code": "UPPER_SNAKE", "message": "Human sentence.", ...extras}}.
   429 and capacity 503 responses also send a Retry-After header (seconds).
9. If anything in this file is ambiguous or conflicts with the code, stop and ask Person A before
   building on a guess.
```

---

## 1. What already works (do not break it)

Verified live on `main`: demo session, `GET /dungeons`, `GET /dungeons/{id}`, `POST /runs`, `GET /runs/{id}`, `POST /runs/{id}/attempts` (idempotent per `attempt_id`, real `monster_hp_remaining`), room clear, finish, `GET /progress`, `GET /reviews/due`, register, login, logout, `GET /auth/me`, `POST /guests/name-check`, `POST /guests` (now returns `dungeon_id`), `POST /auth/upgrade`, `DELETE /auth/me`, the document pipeline.

The frontend reads these fields today. Keep their names and types exactly:

| Endpoint | Fields the frontend reads |
| --- | --- |
| `GET /dungeons/{id}` | `id, title, is_public_demo?, rooms[{id, room_number, topic_name, monster_name, monster_type, monster_hp (int > 0), is_boss, questions[{id, prompt, options (>= 2 strings), difficulty}]}]` (at least 1 room) |
| `POST /runs`, `GET /runs/{id}` | `id, dungeon_id, current_hp, current_score, current_streak, xp_earned, status, started_at?, rooms[{room_id, room_number, topic_name, monster_name, monster_max_hp, monster_current_hp, is_cleared, is_boss}]` (at least 1 room) |
| `POST /runs/{id}/attempts` | `attempt_id?, is_correct, damage_dealt, damage_taken, is_critical, current_hp, current_score, current_streak, monster_hp_remaining` (all non-negative ints), `explanation?, evidence_quote?` |
| `POST /runs/{id}/rooms/{room_id}/clear` | `xp_delta` (int, required), `success?, room_id?, is_cleared?, is_boss?` |
| `POST /runs/{id}/finish` | `id?, score, xp_earned, correct_count, total_attempts` (ints), `accuracy` (0 to 1), `mastery_band` (string), `status?` |
| `GET /progress` | `user_id?, level (>= 1), total_xp, unlocked_weapons` (list of weapon names) |
| `GET /reviews/due` | **A bare JSON array** of `{question_id, prompt, options, next_review_at?, repetition_count?}`. **Keep it a bare array.** Changing it to an object breaks the frontend today (see Section 9). |
| `GET /documents/{id}/status` | `id, status (processing, accepted, rejected, failed), relevance_score?, readability_score?, rejection_reason?, chunks_count?` |
| user objects | `id, username (string or null), is_guest, created_at?, expires_at?, public_id?, display_name?, tag?, handle?` |

---

## 2. Packs 1 to 3 and unlocking  [V2 B]

**Frontend status: READY.** The packs page, the "Next dungeon unlocked" screen and the "All dungeons conquered" screen are built. They switch on when `GET /packs` answers 2xx with this shape.

### 2.1 Content

- At least **3 hand-reviewed packs**. **Pack 1 is the current seeded demo.** Packs 2 and 3 have different topics and questions.
- Each question has prompt, 2 to 4 options (or True/False), the correct option, difficulty (`easy`, `medium`, `hard`), explanation, an evidence quote taken verbatim from the pack's source text, and a source location.
- Store packs as versioned JSON files (for example `backend/app/demo/packs/pack-1.json`) and seed them at startup idempotently: re-seed only when the stored version is older.
- Add a validation script: unique ids, every correct option is one of the options, evidence quotes not empty, at least 2 options.
- **Packs never call an AI provider**, not to seed, serve, play or score.

### 2.2 `GET /packs`

Public. With a session, the statuses are that player's; without one, pack 1 is `available` and the rest are `locked`, with progress fields 0.

```json
{
  "packs": [
    { "id": "pack-1", "order": 1, "title": "Computer Systems Crypt", "description": "CPU, memory and storage basics.",
      "dungeon_id": "61c0bced-...", "floors_total": 2, "floors_cleared": 2, "final_boss_cleared": true,
      "status": "completed", "points_earned": 2350 },
    { "id": "pack-2", "order": 2, "title": "Networking Catacombs", "description": "Packets, protocols and routing.",
      "dungeon_id": "a1b2...", "floors_total": 2, "floors_cleared": 1, "final_boss_cleared": false,
      "status": "in_progress", "points_earned": 640 },
    { "id": "pack-3", "order": 3, "title": "Database Ossuary", "description": "Tables, keys and queries.",
      "dungeon_id": "c3d4...", "floors_total": 3, "floors_cleared": 0, "final_boss_cleared": false,
      "status": "locked", "points_earned": 0 }
  ],
  "next_pack_id": "pack-2",
  "all_completed": false
}
```

Exact types the frontend validates:
- `packs[]`: `id` (non-empty string), `order` (int), `title` (string), `description` (string), `dungeon_id` (non-empty string), `floors_total` (int >= 0), `floors_cleared` (int >= 0), `final_boss_cleared` (bool), `status` (one of `locked`, `available`, `in_progress`, `completed`), `points_earned` (int >= 0).
- `next_pack_id`: string or `null`.
- `all_completed`: bool.

### 2.3 Rules

- Pack N+1 unlocks for a player when that player has cleared pack N's final boss at least once.
- `POST /runs` on a locked pack's dungeon answers **403** with `{"detail": {"code": "PACK_LOCKED", "message": "Clear the previous dungeon's final boss to unlock it."}}`.
- When every published pack is completed, `all_completed` is `true`. Adding a new pack later makes it `false` again.
- Replaying a completed pack is allowed (reduced points, Section 3).
- Guests and registered players can play every pack they have unlocked.

### 2.4 Finish response addition

`POST /runs/{id}/finish` adds `pack_progress` (or `null`, or omits it) when the run belonged to a pack:

```json
{ "...existing fields...": "...",
  "pack_progress": { "pack_id": "pack-1", "status": "completed", "unlocked_pack_id": "pack-2", "all_completed": false } }
```

`pack_id` (non-empty string), `status` (pack status enum), `unlocked_pack_id` (string or `null`), `all_completed` (bool). The frontend shows "Next dungeon unlocked" from `unlocked_pack_id` and "All dungeons conquered" from `all_completed`.

### 2.5 Acceptance

1. A fresh DB plus startup gives 3 valid packs; a second startup changes nothing.
2. A new guest sees pack 1 `available`, packs 2 and 3 `locked`; `POST /runs` on pack 2 is 403 `PACK_LOCKED`.
3. After clearing pack 1's final boss, `GET /packs` shows pack 1 `completed`, pack 2 `available`, and finish returned `pack_progress.unlocked_pack_id = "pack-2"`.
4. With the AI provider stubbed to fail on any call, every pack can be seeded, loaded, played and finished.
5. No dungeon or run response reveals a correct option, explanation or evidence quote before an answer.

---

## 3. Leaderboard points  [V2 C]

**Frontend status: READY.** The frontend shows "+N points" next to the damage number, the reason for reduced points, and "Leaderboard points" on the scorecard. These are a separate number from the run score ("Dungeon score"). Never mix the two.

### 3.1 Response additions (all optional, never sent by the client)

```json
POST /runs/{id}/attempts      + { "points_awarded": 10, "points_reason": "repeat_correct", "points_bonus": 25,
                                  "player_points": { "preloaded": 1250, "own_notes": 0, "overall": 1250 } }
POST /runs/{id}/rooms/{room_id}/clear   + { "points_awarded": 50, "points_reason": "room_clear" }
POST /runs/{id}/finish        + { "points_earned": 830,
                                  "player_points": { "preloaded": 2080, "own_notes": 0, "overall": 2080 } }
```

Types: `points_awarded`, `points_bonus`, `points_earned` are int >= 0. `points_reason` is a string. `player_points` has `preloaded`, `own_notes`, `overall` (ints >= 0).

`points_reason` values the frontend words: `first_correct`, `repeat_correct`, `retry`, `wrong`, `too_fast`, `practice`, `not_ranked`, `daily_cap`, `room_clear`, `boss_clear`, `pack_complete`. Any other value is shown without reason text. Tell Person B if you add one.

### 3.2 Point table (server config; defaults)

| Event | Points | Rule |
| --- | --- | --- |
| First correct answer to a question in the week | 100 (`easy`/`medium`), 150 (`hard`) | Once per player, question and week. |
| Repeat correct in the same week | 10 | Never full points twice in a week. |
| Second-chance retry in the same run | half, rounded half to even | |
| Wrong answer | 0 | |
| Streak bonus | Person A defines the exact rule in `game-design.md` (placeholder: +25 at every 3rd consecutive full-point correct answer) | Reported as `points_bonus`. |
| Room cleared (first time this week) | 50 | Once per player, room and week. |
| Floor boss or final boss defeated (first time this week) | 200 | Once per player, boss room and week. |
| Pack completed (first time ever) | 500 | Once per player and pack. |
| Answer faster than `MIN_ANSWER_MS` (default 800 ms after the previous attempt) | 25 percent (`too_fast`) | Reduced, never zero; damage and HP still apply. |
| Daily Haunt and practice modes | 50 percent of answer values (`practice`), no room, boss or pack bonus | |
| Own-notes dungeon below the ranking minimum | 0 (`not_ranked`) | |
| Own-notes points above the daily cap (default 2000 per UTC day) | 0 (`daily_cap`) | |

The week runs Monday 00:00 UTC to the next Monday 00:00 UTC. Board kind of a point: `preloaded` (pack dungeons) or `own_notes` (own dungeons that count for ranking); overall = both.

### 3.3 Rules

- Points are computed on the server only. A request body with `points`, `score` or `damage` keys has no effect.
- **Append-only ledger** (`point_events`). The attempt, its point events and the player totals (`player_stats`, `player_week_stats`) are written in **one transaction**. Lock the run row (`SELECT ... FOR UPDATE`).
- **Idempotent**: `(user_id, attempt_id)` is unique. A repeated `attempt_id` returns the stored response including the stored `points_awarded`.
- "First correct" is enforced by a partial unique index on `(user_id, question_id, week_start) WHERE reason = 'first_correct'`. On conflict, record `repeat_correct`. The same pattern applies to `room_clear`, `boss_clear` and `pack_complete`.
- Add a rebuild script that recomputes the totals from the ledger and reports differences.

### 3.4 Acceptance

1. First correct answer gives 100 (150 hard); a second correct answer to the same question that week gives 10; after the weekly reset it gives full points again.
2. Two parallel requests for the same first correct give exactly one `first_correct` and one `repeat_correct`.
3. Replaying the same `attempt_id` returns identical JSON and the ledger does not grow.
4. An attempt 300 ms after the previous one earns 25 percent with `too_fast`; one at 900 ms earns full points.
5. After any sequence, the totals equal the ledger sum (property test).
---

## 4. Real leaderboard  [V2 D]

**Frontend status: READY.** The leaderboard page shows tabs (Preloaded, Own notes, Overall, All-time, This week), a podium for the top 3, ranks 4 to 20, and a pinned "Your live rank" panel. It switches from the demo board to the real one when this endpoint answers 2xx. Ghost Rivals never appear in real mode.

### 4.1 `GET /leaderboard?board=preloaded|own_notes|overall&period=all|week`

Public (guests and visitors can read it). Defaults: `board=overall`, `period=all`. Always top 20.

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
    "live": true, "public_id": "p_8f3k2m", "handle": "Bat#2231",
    "rank": 37, "points": 610,
    "next_above": { "rank": 36, "handle": "Owl#7710", "points": 640, "points_needed": 31 },
    "top20": { "in_top20": false, "cutoff_points": 1120, "points_needed": 511 }
  }
}
```

Exact types the frontend validates:
- `board`: `preloaded`, `own_notes` or `overall`. `period`: `all` or `week`.
- `week`: optional or `null`; when present `timezone` (IANA name), `starts_at`, `resets_at` (ISO strings).
- `updated_at`, `next_refresh_at`: ISO strings (required). `total_ranked_players`: optional int >= 0.
- `entries[]`: `rank` (int >= 1), `public_id` (non-empty string), `handle` (string), `display_name?`, `tag?`, `is_guest` (bool), `level` (int >= 0), `points` (int >= 0), `rooms_cleared` (int >= 0), `badge_ids?` (string array).
- `me`: `null` without a session. Otherwise `live` (bool), `public_id?`, `handle?`, `rank` (int >= 1 or `null`), `points` (int >= 0), `next_above` (object or `null`), `top20` (object, required), `reason?` (string).

### 4.2 Rules

- **Never return** `username`, the internal user `id` or IP data in entries or `me`.
- **Real players only.** Exclude `is_test`, `is_system`, inactive and purged users, and players with 0 points on that board and period. Guests are included. No seeded rivals.
- **Snapshot**: `entries` come from a snapshot recomputed at most once per hour. Lazy refresh: if the snapshot for (board, period, week) is older than 1 hour or missing, one request recomputes it under a Postgres advisory lock (`pg_try_advisory_xact_lock`); other requests serve the old one. No cron dependency. `next_refresh_at = updated_at + 1 hour`.
- **`me` is live**: computed from the live totals, not the snapshot.
- **Tie-breaks** give unique ranks: points descending, then `reached_at` ascending (who reached the total first), then `public_id` ascending. Because earlier wins ties, `points_needed` to pass = `above.points - me.points + 1`. The frontend shows `points_needed` exactly as sent and never recomputes it.
- `me.rank = null` with `reason: "no_points_yet"` when the player has 0 points. `next_above = null` at rank 1. `top20.points_needed = 0` inside the top 20. With fewer than 20 ranked players, `cutoff_points = 0`.
- Unknown `board` or `period` answers 422 `VALIDATION_ERROR`.
- Headers: `Cache-Control: private, no-store` when `me` is present; `public, max-age=60` otherwise.
- The frontend asks at most once per 60 s per board and period, at `next_refresh_at`, and when the tab becomes visible again. Keep `me` cheap (one indexed count query).

Rank query (per board column, same pattern on the weekly table):

```sql
CREATE INDEX ix_ps_overall ON player_stats (points_overall DESC, reached_at_overall ASC, public_id)
  WHERE is_ranked AND points_overall > 0;
SELECT count(*) + 1 AS rank FROM player_stats s
WHERE s.is_ranked AND s.points_overall > 0
  AND (s.points_overall > :p
       OR (s.points_overall = :p AND s.reached_at_overall < :r)
       OR (s.points_overall = :p AND s.reached_at_overall = :r AND s.public_id < :pid));
```

### 4.3 Acceptance

1. No cookie: 200, at most 20 entries, `me: null`, `updated_at` and `next_refresh_at` one hour apart, no `username` key anywhere.
2. Two requests in the same hour return the same `updated_at`; 50 parallel requests on a stale snapshot recompute once.
3. A player who earns points sees the new rank in `me` immediately; `entries` change only after the next refresh.
4. Ranks are 1..n without gaps; equal points are ordered by who reached the total first.
5. `is_test` and `is_system` users and 0-point players never appear.
6. On Monday 00:00 UTC the weekly board starts empty; all-time is unchanged.
7. Preloaded + own_notes = overall for every player (property test).
8. A registered user's `handle` is their display name and tag, never their login name.

---

## 5. Player counter  [V2 E]

**Frontend status: READY.** The title screen shows "N explorers have braved the dungeon" for 10 or more, "Be among the first explorers" for 1 to 9, and nothing for 0 or on any error.

### 5.1 `GET /stats/players`

Public.

```json
{ "players": 143, "rooms_cleared_total": 982, "answers_total": 15230, "packs_completed_total": 61,
  "updated_at": "2026-11-20T12:00:00Z", "cache_seconds": 300 }
```

Types: `players` int >= 0 (required). The others are optional; integers >= 0, `updated_at` ISO string, `cache_seconds` number >= 0. The frontend caches the answer for `cache_seconds` (300 when absent).

### 5.2 Rules

- `players` = players who **completed at least one room** (a successful room clear), excluding `is_test` and `is_system`. Guests count; purged guests no longer count.
- Read it from `player_stats.rooms_cleared > 0` (kept up to date in the room-clear transaction), not by scanning attempts.
- Cache in memory for `STATS_CACHE_SECONDS` (default 300) and send `Cache-Control: public, max-age=300`.

### 5.3 Acceptance

1. A guest who only answers questions does not change `players`; after their first room clear (and the cache expiry) it grows by 1.
2. Test and system accounts never change the numbers.
3. 100 requests within 5 minutes cause at most one database query.

---

## 6. Guest upload and quota  [V2 G]

**Frontend status: READY.** The upload page already shows a quota chip, the AI notice with its required checkbox, the blocked states with "Play preloaded dungeons instead", and "The summoning circle is busy". Guests get the wizard as soon as `GET /uploads/quota` answers 2xx for a guest. Today `POST /documents` answers 403 `GUEST_FORBIDDEN` for guests, and the frontend shows "Create an account to upload your own notes".

### 6.1 `GET /uploads/quota`

Session required, guests included.

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

Types: `can_upload` (bool). `reason` is `null` or one of `player_daily_limit`, `ip_daily_limit`, `stored_limit`, `global_daily_limit`, `ai_unavailable`. `player` (required) has `is_guest` (bool), `used_today`, `limit_today`, `stored`, `stored_limit` (ints >= 0) and `resets_at?` (ISO). `global?` has `available` (bool). `ranking?` has `min_chars` and `min_topics` (ints >= 0).

### 6.2 Changes to `POST /documents`

- **Allow guests** within the guest limits (replaces 403 `GUEST_FORBIDDEN`).
- Require the multipart form field **`accept_ai_notice=true`**. The frontend already sends it. Store `ai_notice_accepted_at` and the notice version on the document. Missing or false answers 422 `AI_NOTICE_NOT_ACCEPTED`.
- Check the quotas **before any AI call**, in this order: per IP, per player per day, stored documents, global per day.

Default limits (env settings): registered 3 generations per UTC day and 5 stored documents; guest 1 per day and 2 stored; 3 per IP per day; 40 generations per day in total.

New error codes (all in `{"detail": {...}}`):

| Status | Code | When |
| --- | --- | --- |
| 429 | `UPLOAD_LIMIT_PLAYER` | Player daily limit (with `Retry-After` until the UTC day ends). |
| 429 | `UPLOAD_LIMIT_IP` | IP daily limit (with `Retry-After`). |
| 400 | `QUOTA_EXCEEDED` | Stored documents limit (existing code). |
| 503 | `UPLOADS_PAUSED_TODAY` | Global daily cap reached. |
| 503 | `AI_BUSY` | Every AI provider failed. Add `"retry_after_seconds": 600, "offer_packs": true` to `detail`. |
| 422 | `AI_NOTICE_NOT_ACCEPTED` | `accept_ai_notice` missing or not true. |

### 6.3 Document status additions

`GET /documents/{id}/status` may add (all optional):

```json
{ "...existing fields...": "...",
  "counts_for_ranking": false,
  "ranking_note": "Notes this short do not count toward the Own notes leaderboard.",
  "dungeon_id": "d_5",
  "floors": [ { "id": "f_1", "status": "ready" }, { "id": "f_2", "status": "generating" } ] }
```

`floors[].status` is one of `locked`, `ready`, `generating`, `failed`, `cleared`. With `floors[]` the wizard lists one row per floor while it generates.

An own-notes dungeon counts for ranking only with at least `RANKING_MIN_CHARS` (default 3000) extracted characters and at least 2 topics.

### 6.4 AI provider routing (same step)

Gemini first; then OpenRouter `:free` models in one request using the `models` fallback array (only `:free` ids; validate at startup); paid OpenRouter only with `OPENROUTER_PAID_ENABLED=true` and under `AI_PAID_DAILY_CAP_USD`; never for packs or the demo. Log every call in `ai_usage` (no document text). Cache by content hash per player. The model name comes from env only (today `GEMINI_MODEL` defaults to `gemini-2.0-flash` in `config.py`: make the default empty and require the env value). Full detail: V2 G.

### 6.5 Acceptance

1. A guest's first upload with `accept_ai_notice=true` is accepted; the second on the same day is 429 `UPLOAD_LIMIT_PLAYER` before any AI call, and `GET /uploads/quota` reports `player_daily_limit`.
2. `POST /documents` without `accept_ai_notice` is 422 `AI_NOTICE_NOT_ACCEPTED`.
3. With every provider failing, generation is 503 `AI_BUSY` with `offer_packs: true`, and no paid call is made unless enabled.
4. Uploading the same file twice as the same player makes no second AI call and uses no second daily generation.
5. The temp upload folder is empty after a successful and after a failed ingestion.

**Open question from Person B:** do rejected or failed uploads use up the daily quota? Please decide and say so in A-to-B.md.

---

## 7. File limits  [V2 G-R11]

**Frontend status: READY.** The wizard shows "This PDF has 42 pages; the limit is 30." from the error.

Check after extraction and before any AI call:

| Type | Limit | Error |
| --- | --- | --- |
| PDF | 30 pages | 422 `TOO_MANY_PAGES` |
| PPTX | 30 slides | 422 `TOO_MANY_SLIDES` |
| DOCX (and TXT) | `MAX_DOCX_CHARS` extracted characters, default 60,000 (**unconfirmed: please confirm or change**) | 422 `TOO_MUCH_TEXT` |

Each error carries integers `limit` and `found` inside `detail`:

```json
{ "detail": { "code": "TOO_MANY_PAGES", "message": "This PDF has 42 pages; the limit is 30.", "limit": 30, "found": 42 } }
```

Acceptance: a 31-page PDF, a 31-slide PPTX and an over-limit DOCX each return their own code with `limit` and `found`, and no AI call is made. If you change a number, tell Person B: the frontend copy lives in `frontend/src/upload/limits.ts`.
---

## 8. Floors, run modes and Daily Haunt  [V2 B-R10, B-to-A frontend-08 items 1, 3, 6, 8]

A dungeon becomes a **campaign of floors**: each floor is 2 topic rooms whose last room holds the floor boss, and a **final boss** unlocks after every floor is cleared. Packs use this model. Today the real demo has 4 rooms and no floors, so the frontend shows one floor, "The Crypt". The frontend mock demo is 2 floors (rooms 1 and 2, rooms 3 and 4) plus the Exam Warden: please shape pack 1 the same way.

### 8.1 `GET /dungeons/{id}` additions  -  Frontend status: READY

Add `floor_id` to each room and these two optional top-level fields. The floor map switches on as soon as `floors` is a non-empty list.

```json
{
  "...existing fields...": "...",
  "rooms": [ { "id": "r_1", "floor_id": "f_1", "room_number": 1, "...": "..." } ],
  "floors": [
    { "id": "f_1", "index": 1, "title": "The Entry Crypt", "status": "cleared",
      "topics": [ { "id": "t_1", "title": "CPU", "mastery": 82 } ],
      "boss": { "id": "m_2", "name": "Memory Wraith", "hp": 90, "kind": "memory_eater" },
      "rank": "A", "room_ids": ["r_1", "r_2"] },
    { "id": "f_2", "index": 2, "title": "The Alchemy Wing", "status": "ready",
      "topics": [], "boss": { "id": "m_4", "name": "Gear Golem", "hp": 85 }, "rank": null, "room_ids": ["r_3", "r_4"] }
  ],
  "final_boss": { "id": "m_5", "name": "The Exam Warden", "hp": 220, "unlocked": false }
}
```

Exact types:
- `floors[]`: `id` (string), `index` (int >= 1; indexes are 1..n with no gaps), `title` (string), `status` (`locked`, `ready`, `generating`, `failed`, `cleared`; per player), `topics[]` with `id`, `title`, `mastery` (0 to 100), `boss` with `id`, `name`, `hp` (> 0) and optional `kind`, `rank` (`S`, `A`, `B`, `C` or `null`), `room_ids` (non-empty; every id is a room of this dungeon).
- `final_boss`: `id`, `name`, `hp` (number), `unlocked` (bool).
- Optional nice-to-have: `monster_kind` on rooms (visual id such as `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`) so the client stops guessing it from `monster_type`.

### 8.2 `POST /runs` body additions  -  FRONTEND CHANGE NEEDED (small)

Accept these **optional** body fields (old clients send only `dungeon_id`, so keep that working):

```json
{ "dungeon_id": "d_1", "floor_id": "f_2", "mode": "floor" }
```

- `mode` is one of `floor`, `daily_haunt`, `weak_topics`, `exam`, `replay_floor`. `floor_id` is `null` for `daily_haunt`, `weak_topics` and `exam`.
- A `floor` or `replay_floor` run contains only that floor's rooms and ends at its floor boss (finish works without the final boss). The final boss is its own run once unlocked.
- The server picks 6 to 8 questions per topic per run from the topic's pool (15 to 20 questions), seeded by the run id, and returns only those.
- `daily_haunt`: a run made only of the player's due review questions (cap 8). Attempts on them must be accepted and update the review schedule; no room monster. A finished Daily Haunt adds a day to `daily_streak`.
- `weak_topics`: the 2 weakest topics. `exam`: all topics.

The frontend sends only `{dungeon_id}` today (to stay compatible). When you ship this, tell Person B in A-to-B.md: one line in `frontend/src/api/client.ts` switches it on, plus turning on the `modes` and `dailyHaunt` capabilities.

### 8.3 Lazy floor generation and retry

- For uploaded notes, generate the topic map and floor 1 first; generate later floors in the background or when the previous floor is cleared. Floor status `generating` -> `ready` or `failed` (shown through `floors[].status` on the dungeon and on the document status).
- `POST /floors/{id}/retry` re-runs a `failed` floor and answers `{"id": "f_2", "status": "generating"}`; 409 `FLOOR_NOT_FAILED` otherwise. **FRONTEND CHANGE NEEDED (small)**: the client stub answers 501 today; Person B wires it after you ship.
- Per-dungeon size cap: 422 `{"detail": {"code": "DUNGEON_TOO_LARGE", "message": "These notes are very large. Upload a smaller section to get the best floors."}}`.

### 8.4 Finish additions for floors (optional, READY)

```json
{ "...": "...", "floor_rank": "A",
  "mastery_by_topic": [ { "topic_id": "t_3", "title": "Networking", "mastery": 71 } ],
  "chest_rewards": [ { "id": "cr_1", "kind": "xp", "label": "Bonus XP", "amount": 40 } ] }
```

`floor_rank`: `S`, `A`, `B`, `C`. `chest_rewards[].kind`: `xp`, `coins`, `weapon`, `badge`. Default rank rule (please decide in `game-design.md`): S at first-try accuracy >= 0.90 with no retry, A >= 0.80, B >= 0.60, else C.

### 8.5 Acceptance

1. `GET /dungeons/{pack-1 dungeon}` returns 2 floors and a final boss; floor indexes are 1 and 2 and every `room_ids` entry is a room of the dungeon.
2. `POST /runs` with `{dungeon_id}` only still works exactly as today.
3. `POST /runs` with `floor_id` and `mode: "floor"` returns only that floor's rooms, and finish works after its floor boss.
4. A `daily_haunt` run accepts attempts on due questions and updates their review dates.
5. Floor 2 of a new upload is `generating` while floor 1 is `ready` and playable.

---

## 9. Learning loop extras  [B-to-A frontend-08 items 4, 6, 7]

| Field | Where | Frontend status |
| --- | --- | --- |
| `correct_answer` (string, the option text) | attempt response, **only after a wrong answer** | READY (shown in the Memory Scroll) |
| `requeue_after` (int >= 0 or `null`) | attempt response: how many questions until a missed one returns | READY |
| `is_retry` (bool), `retry_multiplier` (number) | attempt response, when the answered question is a returned miss | READY |
| `combo` (int >= 0) | attempt response | READY (display only) |
| `source: { "page": 4, "chunk_id": "c_12" }` | attempt response, for "From your notes: page 4" | FRONTEND CHANGE NEEDED (the attempt schema does not read `source` yet) |
| `xp_to_next` (int > 0) | `GET /progress` | FRONTEND CHANGE NEEDED (the progress schema does not read it yet) |
| other progress fields (`equipped_weapon`, `notes_conquered_percent`, `memory_strength`, `streak_calendar`, `weak_concepts`, `badges`, `recent_runs`, `due_review_count`) | `GET /progress` | FRONTEND CHANGE NEEDED (safe to add: unknown fields are ignored) |
| `{due_count, next_due_at, daily_streak, items[]}` summary | due reviews | **Do not change `GET /reviews/due` to this object.** The frontend reads a bare array and would break. Either keep the array and add optional fields per item (`due_at`, `topic_id`, `floor_id` are safe), or add a NEW endpoint such as `GET /reviews/summary` and tell Person B. |

Rules: never put `correct_answer`, `explanation` or `evidence_quote` in `GET /dungeons/{id}` or in run responses. Requeue default: gap 3 questions, at most 2 returns per question per run (please decide).

Acceptance: a wrong answer returns `correct_answer` equal to the correct option text; a correct answer never includes it. A missed question returns with `is_retry: true` after `requeue_after` further questions.

---

## 10. Small fixes noticed in the live run

1. **Cookies in production:** `COOKIE_SECURE` defaults to `False`. Set `COOKIE_SECURE=true` in the deployed environment (local HTTP dev stays false).
2. **Guest `username`:** guests return an internal `guest_xxxxxxxx` as `username`. The frontend never shows it, but returning `null` for guests is cleaner (V2 A.3).
3. **AI model default:** see 6.4 (`GEMINI_MODEL` hard-coded default).
4. **Rejected/failed uploads and quota:** decision needed (Section 6).
5. **Demo shape:** the seeded demo has 4 rooms; when it becomes pack 1, give it floors as in Section 8.

---

## 11. How to test against the frontend

1. Start the backend locally on port 8000 with a fresh DB (`alembic upgrade head`; the demo and packs seed on startup).
2. In `frontend/`, run the real-backend contract suite (PowerShell):

```
$env:VITE_API_BASE='http://localhost:8000'; $env:VITE_USE_MOCKS='false'; npm.cmd run test:contract
```

Use a **disposable** database: the suite creates and deletes accounts. Today's result: 25 passed, 15 skipped. Cases that are skipped now and must pass once you ship:

| Section | Contract cases that switch on |
| --- | --- |
| 2 Packs | `GET /packs` shape and next pack; `PACK_LOCKED` on a locked pack; final boss clear reports `pack_progress` and points |
| 3 Points | covered by the packs case above (points fields on attempt, clear, finish) |
| 4 Leaderboard | at most 20 entries, ranks 1..n, no private keys; `me` block with a session |
| 5 Counter | `GET /stats/players` returns a non-negative integer |
| 6 Upload | `GET /uploads/quota` shape and never offers a blocked upload; `POST /documents` without the notice is 422 |

3. Then play in the browser in real mode: `frontend/.env.local` with `VITE_USE_MOCKS=false` and `VITE_API_BASE=http://localhost:8000`, start the Vite dev server, open http://localhost:5173. The CORS allow-list must contain that origin (it does by default).

---

## 12. Build order (one Kiro spec each)

| Step | Scope | Why first |
| --- | --- | --- |
| 1 | **Floors on dungeons** (8.1) and **pack content + `GET /packs` + unlock + `PACK_LOCKED` + `pack_progress`** (Section 2), pack 1 = demo shaped as 2 floors + final boss | Packs, points and the leaderboard all build on this. |
| 2 | **Points ledger** (Section 3): tables, transaction, idempotency, response fields, rebuild script | The leaderboard reads these totals. |
| 3 | **Leaderboard and counter** (Sections 4 and 5) | Needs steps 1 and 2. |
| 4 | **Guest upload, quota, AI notice, file limits, AI routing** (Sections 6 and 7) | Independent; can run in parallel with step 3. |
| 5 | **Run modes, Daily Haunt, lazy floors, floor retry** (8.2 to 8.4) | Person B then makes the small client change. |
| 6 | **Learning loop extras** (Section 9) and the small fixes (Section 10) | Polish. |

After each step: contract suite green, `api-contract.md` and `openapi.json` updated, A-to-B.md entry with the exact JSON.

---

## 13. Checklist for Person A

- [ ] Step 1: floors on dungeons, 3 packs, `GET /packs`, unlock rule, `PACK_LOCKED`, `pack_progress`
- [ ] Step 2: points ledger, `points_awarded` / `points_reason` / `points_bonus` / `player_points` / `points_earned`
- [ ] Step 3: `GET /leaderboard?board=&period=` (snapshot, live `me`, tie-breaks), `GET /stats/players`
- [ ] Step 4: guests can upload, `GET /uploads/quota`, `accept_ai_notice`, limit and busy errors, `TOO_MANY_PAGES` / `TOO_MANY_SLIDES` / `TOO_MUCH_TEXT`, AI routing
- [ ] Step 5: `floor_id` and `mode` on `POST /runs`, Daily Haunt run, lazy floors, `POST /floors/{id}/retry`
- [ ] Step 6: `correct_answer`, `requeue_after`, `is_retry`, `source`, `xp_to_next`, small fixes
- [ ] Decisions written in `game-design.md`: streak bonus rule, floor rank thresholds, requeue gap, retry multiplier, DOCX character limit, whether rejected uploads use the daily quota
- [ ] Every step: contract suite run, `api-contract.md`, `openapi.json`, A-to-B.md entry