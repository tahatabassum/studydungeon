# StudyDungeon: Backend Requirements V2 (Person B to Person A)

Date: 2026-11-10. Written by Person B with Kiro after reading the repository. Nothing under `backend/` was changed.
Companion document: `docs/handoff/FRONTEND_STATE_AND_CHANGES.md` (read it first).

---

## 0. Instruction for Person A's Kiro (paste this as is)

```
You are assisting Person A (backend/AI owner) on StudyDungeon. Before planning anything:

1. Read, in this order:
   a. docs/handoff/FRONTEND_STATE_AND_CHANGES.md  (what the frontend really does today, the contract
      table, known mismatches with our backend, and the PLANNED frontend features)
   b. docs/handoff/BACKEND_REQUIREMENTS_V2.md     (the product decisions A to J, endpoint shapes,
      acceptance criteria and the suggested build order)
   c. docs/handoff/B-to-A.md                      (older PROPOSED items still referenced by V2:
      floors, run modes, attempt/finish/progress additions, Daily Haunt)
   d. .kiro/steering/*, docs/openapi.json, backend/app/**
2. Do not write code yet. Plan with Kiro specs: create one spec per build step in Section 11 of
   BACKEND_REQUIREMENTS_V2.md (folders .kiro/specs/backend-07-... onward, requirements -> design ->
   tasks), and stop for my review after each spec.
3. Treat every "ASSUMPTION" in both docs as unconfirmed. List the ones you disagree with and ask me
   before building on them. Defaults in V2 are proposals; the backend stays authoritative for every
   game value.
4. Keep the contract in sync on every change: update .kiro/steering/api-contract.md and regenerate
   docs/openapi.json (backend/scripts/export_openapi.py) in the same commit as the code. Add response
   models to every route so openapi.json shows the real bodies.
5. After each finished step, append a dated entry to docs/handoff/A-to-B.md: what is live, exact
   request/response JSON, error codes, env variables, and anything that differs from V2.
6. Never touch frontend/**. If the frontend must change, write it in A-to-B.md.
7. Free-tier limits quoted in V2 were checked on 2026-11-10. Re-check the provider pages before
   relying on a number.
```

---

## 1. Principles that apply to every section

1. **The server is authoritative.** Correctness, damage, HP, score, XP, streaks, points, ranks, mastery, unlocks and review dates are computed on the server from validated data. The client never sends a computed value.
2. **Additive contract.** New response fields are added next to the existing ones; existing fields keep their meaning (the frontend validates with zod and ignores unknown fields). Removing or renaming a field needs an A-to-B entry first.
3. **One error format**: `{"detail": {"code": "UPPER_SNAKE", "message": "Human sentence."}}`, plus optional extra keys inside `detail` (for example `retry_after_seconds`, `reason`). 429 responses also send a `Retry-After` header.
4. **Ownership on every private read and write**: query by id AND the current user (or the public flag).
5. **No AI at play time.** AI runs only during document ingestion and floor generation. Packs, runs, attempts, leaderboards and counters never call a provider.
6. **Real players only** on public surfaces. Ghost Rivals exist only in the frontend's mock and offline modes.
7. All times are stored as UTC `timestamptz` and returned as ISO 8601 with `Z`.

---

## 2. Prerequisites: fix these first (from the frontend's real-mode runs)

These are in `FRONTEND_STATE_AND_CHANGES.md` Section 6.3. They block real-mode play and the points system.

| # | Fix | Acceptance |
| --- | --- | --- |
| P1 | Seed the preloaded content at startup (lifespan), idempotently, or make `POST /demo/session` fail with 503 instead of returning an id that does not exist. | A fresh DB plus app start gives a playable demo; `GET /dungeons/{id}` for the returned id is 200. |
| P2 | Return the real `monster_hp_remaining` from `POST /runs/{id}/attempts` (also on replays). | Remaining HP equals the room's max HP minus the damage dealt so far in this run. |
| P3 | Persist progress: add room-clear XP to `GameRun.xp_earned`, write `UserProgress` (total XP, level, unlocked weapons) when a run finishes, pass `cleared_rooms` and `boss_cleared` to the unlock check. | After a run, `GET /progress` shows the new XP and level; the unlock rules from `game-design.md` hold. |
| P4 | Upsert one `ReviewItem` per user and question (keep the repetition count) instead of inserting one per attempt. | `GET /reviews/due` never repeats a `question_id`. |
| P5 | Fix the 500 on the second attempt and on `GET /runs/{id}` for a generated dungeon. | Regression test with a 2-question generated dungeon. |
| P6 | Make the cookie `Secure` configurable (`COOKIE_SECURE=true` in production) and accept a list of CORS origins (`CORS_ORIGINS`). | Production cookie has `Secure`; dev works on ports 5173 and 5174. |
| P7 | Decide the run score rule (Section 5.2 of the frontend doc lists three versions) and **state the exact streak-bonus rule** (when it triggers, how much, whether it repeats, whether retries or hard questions change it). Write both in `game-design.md`. | One rule in docs and code; C.2 uses the same streak rule. |

---

## A. Guest flow and identity

### A.1 Flow

1. The visitor opens the title screen and presses **Try the Demo**.
2. The frontend asks for a **display name** and shows the **public notice**: "Your name and points are shown on the public leaderboard." The visitor ticks the checkbox.
3. `POST /guests` creates the guest, sets the session cookie and returns the public handle (for example `Raven#4821`).
4. The visitor chooses **(1) play preloaded packs** (Section B) or **(2) upload own notes** (Section G, guest limits apply).
5. Later the guest can **upgrade** to a registered account with a username and password, keeping the same user id, display name, tag, points, runs, reviews and documents.

### A.2 Requirements

| ID | Requirement |
| --- | --- |
| A-R1 | A display name is 3 to 16 characters after trimming and NFKC normalization. Allowed: ASCII letters, digits, space, `_` and `-`. It must start and end with a letter or digit. No two spaces in a row. |
| A-R2 | The server rejects names that are profane or reserved. Matching runs on a normalized form: lowercase, spaces/`_`/`-` removed, common look-alikes mapped (`0`>o, `1`>i, `3`>e, `4`>a, `5`>s, `7`>t, `@`>a, `$`>s). The lists live in a server file (not in the frontend). Reserved at least: `admin`, `administrator`, `mod`, `moderator`, `staff`, `support`, `system`, `root`, `official`, `studydungeon`, `kiro`, `ghostrival`, `ghost rival`, `guest`, `anonymous`, `null`, `undefined`, `examwarden`. The error does not say which list matched. |
| A-R3 | The server appends a random 4-digit **tag** (1000 to 9999). The pair (normalized name, tag) is unique; retry on collision; after 20 collisions use 5 digits. Names themselves are not unique. The public **handle** is `display_name#tag`. |
| A-R4 | A guest is identified only by the HttpOnly session cookie (`studydungeon_session`). The cookie lives 30 days (`Max-Age=2592000`) and is renewed on activity (sliding), so an active guest never expires. `expires_at` = last activity + 30 days. |
| A-R5 | Guests are **not purged after 24 h**. A guest is purged only after 30 days without activity (cascading their runs, attempts, reviews, documents, points and stats). The purge stays lazy (run it from guest creation and from the hourly leaderboard refresh); it must not depend on a cron. Registered accounts are never purged. |
| A-R6 | `POST /guests` requires `accept_public_notice: true` and stores `notice_accepted_at` plus a notice version. |
| A-R7 | **Upgrade**: `POST /auth/upgrade` turns the current guest into a registered user in place (same `id` and `public_id`), sets `username` and `password_hash`, `is_guest=false`, clears `expires_at`, keeps display name and tag, increments `session_version` and issues a fresh cookie. |
| A-R8 | Public surfaces (leaderboard, counters, share data) show only the handle, display name, tag, level, points and badges. They never show the **login username**, internal ids, IP addresses or any contact data. The product collects no email; if an email field is ever added it must never appear in a public response. |
| A-R9 | `users.is_test` (default false) marks test and staff accounts. They can play normally but are excluded from every leaderboard and from the player counter. The existing `is_system` users (the seed owner) are excluded the same way. Set `is_test` with a backend script or an env allowlist of usernames (`TEST_USERNAMES`); there is no public endpoint for it. |
| A-R10 | Registered users get a display name and tag too: on register, the display name defaults to the username with its original casing (cut to 16 characters) and passes the same moderation; if it fails, a neutral default is used (for example `Adventurer`). ASSUMPTION B1. |
| A-R11 | Rate limits: `POST /guests` **30 per hour per IP** (schools, offices and mobile carriers often share one IP, so a low per-IP limit would block real players), plus a **global hourly cap** on new guests (`GUEST_CREATE_GLOBAL_PER_HOUR`, default 300) that returns 503 `GUEST_CREATION_PAUSED` with `Retry-After` when reached. `POST /guests/name-check` 30 per minute per IP; `POST /auth/upgrade` 10 per hour per IP. If the client IP cannot be trusted on the deployed stack (F.7), the per-IP limits fall back to cookie-based limits and the global cap stays. |
| A-R12 | `POST /demo/session` stays working (it creates a guest with a generated name such as `Wanderer#1234`) until the frontend ships the name step; then it can be retired. |
| A-R13 | **Delete my account and data**: any player (guest or registered) can delete their account. It removes the user and every row they own (documents, chunks, dungeons, runs, attempts, reviews, progress, point events, player stats, week stats, rate-limit rows keyed by their id) in one transaction, unlinks their `ai_usage` rows (set `user_id` to null), clears the cookie, and marks every leaderboard snapshot stale so the next request recomputes it without them. The player counter drops them after its cache expires. |

### A.3 Endpoints

**`POST /guests/name-check`** (optional live check; public)

```json
// request
{ "display_name": "Raven" }
// 200, allowed
{ "ok": true, "display_name": "Raven" }
// 200, refused (the field is not an error; the button stays disabled)
{ "ok": false, "reason": "not_allowed", "message": "That name is not available. Try another." }
```

`reason` is one of `too_short`, `too_long`, `characters`, `not_allowed`.

**`POST /guests`** (public; sets the cookie)

```json
// request
{ "display_name": "Raven", "accept_public_notice": true }
// 201
{
  "user": {
    "id": "6f0c...uuid", "public_id": "p_8f3k2m", "username": null,
    "display_name": "Raven", "tag": "4821", "handle": "Raven#4821",
    "is_guest": true, "created_at": "2026-11-20T12:00:00Z", "expires_at": "2026-12-20T12:00:00Z"
  },
  "notice_version": "2026-11"
}
```

Errors: 422 `NAME_INVALID` (`detail.reason` as above), 422 `NOTICE_NOT_ACCEPTED`, 409 `SESSION_EXISTS` (a valid session cookie is already present; the frontend calls `GET /auth/me` instead), 429 `RATE_LIMIT_EXCEEDED` with `Retry-After`.

**`GET /auth/me`** (existing; add the public fields, keep the old ones)

```json
{ "id": "6f0c...", "username": "raven_main", "is_guest": false, "created_at": "...", "expires_at": null,
  "public_id": "p_8f3k2m", "display_name": "Raven", "tag": "4821", "handle": "Raven#4821" }
```

`username` is the private login name (null for guests) and is only ever returned to its owner.

**`POST /auth/upgrade`** (guest cookie required)

```json
// request
{ "username": "raven_main", "password": "a-long-passphrase" }
// 200: the same user, now registered (shape of GET /auth/me)
```

Errors: 403 `NOT_A_GUEST`, 401 `NOT_AUTHENTICATED`, 409 `USERNAME_TAKEN`, 422 `VALIDATION_ERROR` (same rules as register), 429.

**`PATCH /me/display-name`** (optional, owner only): `{ "display_name": "Night Raven" }` returns the user with a **new tag**. At most once per 24 h (429 `NAME_CHANGE_LIMIT`). ASSUMPTION B2 that renaming is wanted at all.

**`DELETE /auth/me`** (existing route; extend it to guests and require a confirmation)

```json
// request
{ "confirm": "DELETE" }
// 200 (the session cookie is cleared in the same response)
{ "success": true, "message": "Your account and all of its study data were deleted." }
```

Errors: 401 `NOT_AUTHENTICATED`, 422 `CONFIRMATION_REQUIRED` when `confirm` is missing or different.

### A.4 Acceptance criteria

1. A name of 2 or 17 characters, a name with `<`, `admin`, `Adm1n`, `ghost rival` and a profane word all fail with the right `reason`, and no user row is created.
2. Two guests named `Raven` get different tags; both handles are unique.
3. The guest cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` and `Secure` in production.
4. A guest who is active on day 29 is still valid on day 58; a guest inactive for 31 days is purged on the next lazy purge, and their leaderboard entries disappear at the next snapshot.
5. After `POST /auth/upgrade`, `GET /auth/me` returns the same `id`, `public_id`, `handle`, and `GET /progress`, `GET /leaderboard` (me block) show the same points as before.
6. No public endpoint returns `username`, `id` (internal UUID) or an IP address; a test scans the leaderboard and counter responses for these keys.
7. `is_test` and `is_system` users never appear in `GET /leaderboard` entries and are not counted by `GET /stats/players`.
8. After `DELETE /auth/me`, the old cookie gets 401, no row with that user id remains, and the next `GET /leaderboard` (any board) no longer lists the player even if the hour has not passed.
---

## B. Preloaded packs

### B.1 Requirements

| ID | Requirement |
| --- | --- |
| B-R1 | There are **at least 3 hand-reviewed packs**. Pack 1 is the current seeded demo shaped as a campaign: Floor 1 "The Entry Crypt" (2 topic rooms, the second holds the floor boss), Floor 2 "The Alchemy Wing" (2 rooms), then the final boss "The Exam Warden" (220 HP). Packs 2 and 3 have the same structure (2 or more floors plus a final boss) and **different questions**. |
| B-R2 | Every pack question has: prompt, 2 to 4 options (or True/False), the correct option, difficulty (`easy`, `medium`, `hard`), an explanation, an **evidence quote** taken verbatim from the pack's source text, and a source location (page or section). The pack source text is synthetic or public-domain study material written for the project. |
| B-R3 | Each topic has a pool of **15 to 20 questions**; a run serves 6 to 8 per topic, chosen by the server and seeded by the run id (B-to-A frontend-08 item 2). |
| B-R4 | Packs are stored as versioned JSON files in the backend (for example `backend/app/demo/packs/pack-1.json`) and loaded by an idempotent seed that runs at startup when the stored version is older. A validation script checks: ids unique, every correct option is one of the options, every evidence quote is non-empty, pool sizes, floor structure. |
| B-R5 | **Packs never call an AI provider at runtime** (not to seed, serve, play or score). A test runs the whole pack flow with the AI provider set to a stub that fails on any call. |
| B-R6 | Unlocking: pack 1 is available to everyone. Pack N+1 unlocks for a player when that player has cleared pack N's final boss at least once. The server enforces it: `POST /runs` on a locked pack returns 403 `PACK_LOCKED`. |
| B-R7 | Points from all packs **accumulate** on the Preloaded board (Section C). Replaying a completed pack is allowed and earns the reduced repeat points. |
| B-R8 | When every published pack is completed, `GET /packs` returns `all_completed: true`; the frontend shows an "All packs conquered" screen. Adding a new pack later simply makes `all_completed` false again for everyone. |
| B-R9 | Guests and registered players can play every pack they have unlocked. The old rule "guests may only play `is_public_demo`" becomes "guests may play published packs and their own dungeons". |
| B-R10 | Packs use the floors model already PROPOSED for every dungeon: `GET /dungeons/{id}` returns `floors[]`, `final_boss` and `rooms[].floor_id`; `POST /runs` accepts `floor_id` and `mode` (B-to-A frontend-08 items 1 and 3). |

### B.2 Endpoints

**`GET /packs`** (public; with a session the statuses are the player's)

```json
{
  "packs": [
    { "id": "pack-1", "order": 1, "title": "Computer Systems Crypt", "description": "CPU, memory and storage basics.",
      "dungeon_id": "d_pack1", "floors_total": 2, "floors_cleared": 2, "final_boss_cleared": true,
      "status": "completed", "points_earned": 2350 },
    { "id": "pack-2", "order": 2, "title": "Networking Catacombs", "description": "Packets, protocols and routing.",
      "dungeon_id": "d_pack2", "floors_total": 2, "floors_cleared": 1, "final_boss_cleared": false,
      "status": "in_progress", "points_earned": 640 },
    { "id": "pack-3", "order": 3, "title": "Database Ossuary", "description": "Tables, keys and queries.",
      "dungeon_id": "d_pack3", "floors_total": 3, "floors_cleared": 0, "final_boss_cleared": false,
      "status": "locked", "points_earned": 0 }
  ],
  "next_pack_id": "pack-2",
  "all_completed": false
}
```

`status` is `locked`, `available`, `in_progress` or `completed`. Without a session: pack 1 `available`, the rest `locked`, progress fields 0. Titles above are examples only.

**`POST /runs/{id}/finish`** additions for a pack run (all optional for the frontend):

```json
{ "...": "existing fields",
  "pack_progress": { "pack_id": "pack-2", "status": "completed", "unlocked_pack_id": "pack-3", "all_completed": false } }
```

### B.3 Acceptance criteria

1. A fresh database plus startup gives 3 published packs, each passing the validation script; a second startup changes nothing.
2. A new guest sees pack 1 available and packs 2 and 3 locked; `POST /runs` on pack 2 returns 403 `PACK_LOCKED`.
3. After clearing pack 1's final boss, `GET /packs` shows pack 1 `completed` and pack 2 `available`, and the finish response carries `pack_progress.unlocked_pack_id = "pack-2"`.
4. With the AI provider stubbed to fail, every pack can be seeded, loaded, played and finished.
5. No `GET /dungeons/{id}` or `POST /runs` response contains a correct option, explanation or evidence quote before an answer.

---

## C. Points and anti-farming

### C.1 Definitions

- **Points** are the leaderboard currency. They are separate from the run score shown on the scorecard (ASSUMPTION B3). Every point comes from a row in an append-only **points ledger**.
- **Labels**: the screens call the run value **"Dungeon score"** (the existing `score`, `current_score` fields, shown on the HUD and scorecard) and the leaderboard value **"Leaderboard points"** (the new `points_*` fields). The API keeps these names apart: `score` never means leaderboard points and `points` never means the run score. Use the same two terms in `api-contract.md` and `game-design.md`.
- **Board kind** of a point: `preloaded` (earned in a pack dungeon) or `own_notes` (earned in a dungeon generated from the player's notes that counts for ranking). Overall = preloaded + own_notes.
- **Scoring window**: the leaderboard week (Section D, default Monday 00:00 UTC to the next Monday 00:00 UTC). "First correct per question per window" means: the first time a player answers a question correctly within a week.

### C.2 Point values (defaults; server config, Person A decides)

| Event | Points | Rule |
| --- | --- | --- |
| First correct answer to a question in the window | 100 (`easy`/`medium`), 150 (`hard`) | Full points once per player, question and week. |
| Repeat correct answer to the same question in the same window | 10 | Reduced points; never full points twice in a week. |
| Second-chance retry (the question returned after a miss in this run) | half of the value above, rounded half to even | Matches the frontend's `retry_multiplier` 0.5 display. |
| Wrong answer | 0 | |
| Streak bonus | Default proposal: +25 when the streak reaches 3, 6, 9 ... and the answer earned full points | **Person A states the exact rule in `game-design.md`** (P7); this row follows it. |
| Room cleared (first time this week) | 50 | Once per player, room and week. |
| Floor boss or final boss defeated (first time this week) | 200 | Once per player, boss room and week. |
| Pack completed for the first time ever | 500 | Once per player and pack. |
| Answer faster than the minimum answer time | 25 percent of the value it would have earned, rounded half to even (`too_fast`) | Reduced, never zero, so a quick reader is not punished; damage and HP still apply. |
| Daily Haunt and practice modes (`weak_topics`, `exam`, `replay_floor`) | 50 percent of the answer values above (`PRACTICE_POINTS_MULTIPLIER`, default 0.5); no room, boss or pack bonuses | Reduced, so replaying reviews cannot outscore playing new content. |
| Own-notes dungeon below the ranking minimum | 0 (`not_ranked`) | Playable, but no points. |

### C.3 Requirements

| ID | Requirement |
| --- | --- |
| C-R1 | **All points are computed on the server** from validated attempts and clears. No request carries a points, score or damage value. |
| C-R2 | **Append-only**: attempts and point events are inserted, never updated or deleted (except the 30-day guest purge and account deletion, which delete everything of that user). |
| C-R3 | **Same transaction**: inserting the attempt, inserting its point events and updating `player_stats` and `player_week_stats` happen in one database transaction. Lock the run row (`SELECT ... FOR UPDATE`) so two attempts of the same run are serialized. |
| C-R4 | **Idempotent attempt ids**: `(user_id, attempt_id)` is unique. A repeated `attempt_id` returns the stored response (including the stored `points_awarded`) and creates nothing. |
| C-R5 | **First correct is enforced by the database**: a partial unique index on `(user_id, question_id, week_start) WHERE reason = 'first_correct'`. If the insert conflicts (a race or a repeat), the server records a `repeat_correct` event instead. The same pattern applies to `room_clear` and `boss_clear` (per room and week) and `pack_complete` (per pack, no week). |
| C-R6 | **Minimum answer time (generous)**: an attempt that arrives less than `MIN_ANSWER_MS` (default 800) after the previous attempt in the same run, or after the run start for the first attempt, earns **reduced points** (25 percent, reason `too_fast`), never zero. The threshold only targets answers no human can read and click that fast; tune it from real data. ASSUMPTION B5: the gap between attempts is a good enough proxy, because the server does not know when the question appeared on screen. |
| C-R7 | **Minimum notes size for ranking**: an own-notes dungeon counts for ranking only when its document has at least `RANKING_MIN_CHARS` (default 3000) extracted characters and at least 2 topics. Otherwise `counts_for_ranking=false`. The flag is returned on the document status and the dungeon. |
| C-R8 | **Own-notes caps**: at most `OWN_NOTES_DAILY_POINTS_CAP` (default 2000) own-notes points per player per UTC day; points above the cap are recorded with 0 and reason `daily_cap`. ASSUMPTION B6. |
| C-R9 | **Generation limits per player** (also Section G): registered 3 dungeons per day and 5 stored documents; guests 1 per day and 2 stored. Re-uploading identical notes reuses the cached dungeon (content hash), so its questions fall under the repeat rule. |
| C-R10 | **Rate limits**: at most 30 attempts per minute per user and 60 per minute per IP (429 `RATE_LIMIT_EXCEEDED`). |
| C-R11 | Daily Haunt (`daily_haunt`) and the practice modes (`weak_topics`, `exam`, `replay_floor`) give **reduced points**: answer values times `PRACTICE_POINTS_MULTIPLIER` (default 0.5), the weekly repeat rule still applies on top, and they award no room, boss or pack bonuses. ASSUMPTION B7 on the multiplier. |
| C-R12 | A maintenance script rebuilds `player_stats` and `player_week_stats` from the ledger and reports differences (for audits and after bug fixes). |

### C.4 Response additions

`POST /runs/{id}/attempts` (additive):

```json
{ "...": "existing fields",
  "points_awarded": 10, "points_reason": "repeat_correct",
  "player_points": { "preloaded": 1250, "own_notes": 0, "overall": 1250 } }
```

`points_reason` is one of `first_correct`, `repeat_correct`, `retry`, `wrong`, `too_fast`, `practice`, `not_ranked`, `daily_cap`. When several rules apply (for example a fast repeat in a practice mode), the reason names the last reduction and `points_awarded` is the final value. Streak bonuses are reported as `points_bonus: 25` next to it when present.

`POST /runs/{id}/rooms/{room_id}/clear` and `POST /runs/{id}/finish` (additive):

```json
{ "...": "existing fields", "points_awarded": 50, "points_reason": "room_clear" }
{ "...": "existing fields", "points_earned": 830,
  "player_points": { "preloaded": 2080, "own_notes": 0, "overall": 2080 } }
```

### C.5 Acceptance criteria

1. The first correct answer to question Q this week gives 100 (150 if hard); a second correct answer to Q this week gives 10; after the weekly reset Q gives full points again.
2. Two parallel requests that both try to award `first_correct` for Q give exactly one `first_correct` and one `repeat_correct` row.
3. Replaying the same `attempt_id` returns identical JSON and the ledger row count does not change.
4. An attempt 300 ms after the previous one earns 25 percent of its value with `too_fast` (25 for a first correct easy question), while damage and HP still apply. An attempt 900 ms after the previous one earns full points.
5. A run on a document with 1200 characters gives 0 points with `not_ranked`, and the dungeon carries `counts_for_ranking: false`.
6. After any sequence of attempts, `player_stats` equals the sum of the ledger (property test with random sequences; the rebuild script reports no difference).
7. A request body containing `points`, `score` or `damage` keys is rejected with 422 or ignored; no value from it reaches the ledger.
8. A first correct answer in a Daily Haunt or practice run earns 50 (75 if hard) with reason `practice`; clearing a room in such a run adds no room bonus.
---

## D. Leaderboard

### D.1 Boards and why there are three

| Board | Points counted | Why it exists (shown on screen in one line) |
| --- | --- | --- |
| **Preloaded** | Points earned in packs | Everyone answers the same hand-reviewed questions, so this is the fairest comparison. |
| **Own notes** | Points earned in own-notes dungeons that count for ranking | Rewards studying your own material. Notes differ in length and difficulty, so it is ranked separately and capped per day. |
| **Overall** | Preloaded + Own notes | Total effort across the whole game. Daily caps and the repeat rule stop one kind of farming from dominating. |

Each board has two periods: **All-time** and **Weekly**. The week starts **Monday 00:00 UTC** by default (`LEADERBOARD_TZ=UTC`, `LEADERBOARD_WEEK_START=monday`, ASSUMPTION B8) and the response states it, so the screen can say "Resets every Monday 00:00 UTC".

### D.2 Requirements

| ID | Requirement |
| --- | --- |
| D-R1 | `GET /leaderboard` is public: guests and visitors without a session can read it. |
| D-R2 | The public list is the **top 20** for the board and period, read from a **snapshot** recomputed at most once per hour. |
| D-R3 | **Lazy refresh**: on a request, if the snapshot for (board, period, period key) is older than 1 hour or missing, one request recomputes it under `pg_try_advisory_xact_lock(...)`; concurrent requests serve the previous snapshot (or wait briefly when none exists). There is no cron dependency. When the week rolls over, the weekly snapshot of the new week is computed on the first request. |
| D-R4 | The response carries `updated_at` (snapshot time) and `next_refresh_at` (`updated_at` + 1 hour). |
| D-R5 | With a session, the response adds a **live** `me` block computed from the live stats tables (not the snapshot): live rank, live points, the player directly above and the points needed to pass them, and when outside the top 20 the points needed to enter it (using the live 20th place). |
| D-R6 | **Tie-breaks** (give every player a unique rank): points descending, then `reached_at` ascending (the time the player reached their current total on that board and period; earlier wins), then `public_id` ascending. Because equal points rank the earlier player higher, "points to pass" is `above.points - me.points + 1`. |
| D-R7 | **Real players only**: exclude `is_test`, `is_system`, inactive and purged users, and players with 0 points on that board and period. Guests are included. No seeded rivals, ever. |
| D-R8 | Entries show `handle`, `display_name`, `tag`, `public_id`, `is_guest`, `level`, `points`, `rooms_cleared` and optionally `badge_ids`. Never the login username or the internal id. |
| D-R9 | The response with a `me` block is `Cache-Control: private, no-store`; without a session it may be `public, max-age=60`. |
| D-R10 | Performance: the live rank is one indexed `count(*)` (Section F); the snapshot query reads the top 20 through the same index. Target under 50 ms for 10 000 ranked players on the free database tier. ASSUMPTION B9. |

### D.3 Endpoint

**`GET /leaderboard?board=preloaded|own_notes|overall&period=all|week`** (defaults `overall`, `all`). The old `dungeon_id` and `limit` parameters are not used any more; `limit` is fixed at 20.

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
      "is_guest": true, "level": 4, "points": 2450, "rooms_cleared": 12, "badge_ids": ["boss_slayer"] },
    { "rank": 2, "public_id": "p_m2z7aa", "handle": "Mira#0193", "display_name": "Mira", "tag": "0193",
      "is_guest": false, "level": 3, "points": 2100, "rooms_cleared": 9, "badge_ids": [] }
  ],
  "me": {
    "live": true,
    "public_id": "p_8f3k2m", "handle": "Bat#2231",
    "rank": 37, "points": 610,
    "next_above": { "rank": 36, "handle": "Owl#7710", "points": 640, "points_needed": 31 },
    "top20": { "in_top20": false, "cutoff_points": 1120, "points_needed": 511 }
  }
}
```

- `week` is present for `period=week` (and may be present for `all` so the screen can always show the reset).
- `me` is `null` without a session. With a session but 0 points: `{"live": true, "rank": null, "points": 0, "next_above": null, "top20": {"in_top20": false, "cutoff_points": 1120, "points_needed": 1121}, "reason": "no_points_yet"}`.
- When `me.rank` is 1, `next_above` is `null`. When the player is in the top 20, `top20.points_needed` is 0.
- When fewer than 20 players are ranked, `cutoff_points` is 0 and `points_needed` is 1 for a player with 0 points.

Errors: 422 `VALIDATION_ERROR` for an unknown `board` or `period`.

### D.4 Acceptance criteria

1. A visitor without a cookie gets 200 with up to 20 entries and `me: null`.
2. Two requests within the same hour return the same `updated_at`; a request after `next_refresh_at` returns a newer `updated_at`. Fifty parallel requests on a stale snapshot recompute it once (a counter or log shows one recompute).
3. A player who earns points sees the new rank in `me` immediately, while `entries` change only after the next refresh.
4. Ties: two players with equal points are ordered by who reached the total first; `points_needed` to pass is the difference plus 1.
5. `is_test` and `is_system` users and players with 0 points never appear; no entry contains `username` or an internal UUID.
6. On Monday 00:00 UTC the weekly board starts empty for the new week; the all-time board is unchanged.
7. Preloaded + own-notes points of every player equal their overall points (property test).

---

## E. Player counter

### E.1 Requirements

| ID | Requirement |
| --- | --- |
| E-R1 | `GET /stats/players` is public and returns the number of players who **completed at least one room** (a successful room clear), excluding `is_test` and `is_system` users. Guests count. Purged guests no longer count. |
| E-R2 | Optional totals: rooms cleared, answers submitted, packs completed (same exclusions). |
| E-R3 | The result is cached in memory for `STATS_CACHE_SECONDS` (default 300) and sent with `Cache-Control: public, max-age=300`. A cold start recomputes it on the first request. |
| E-R4 | The count comes from `player_stats.rooms_cleared > 0` (maintained in the room-clear transaction), not from scanning attempts. |

### E.2 Endpoint

**`GET /stats/players`**

```json
{ "players": 143, "rooms_cleared_total": 982, "answers_total": 15230, "packs_completed_total": 61,
  "updated_at": "2026-11-20T12:00:00Z", "cache_seconds": 300 }
```

### E.3 Acceptance criteria

1. A new guest who only answers questions does not change `players`; after their first room clear (and once the cache expires) `players` grows by 1.
2. Test and system accounts never change the numbers.
3. 100 requests within 5 minutes cause at most one database query (log or counter).
---

## F. Database and operations

### F.1 Host choice (checked 2026-11-10; re-check before deploying)

Use **PostgreSQL through one connection string** (`DATABASE_URL`). The code today defaults to SQLite (`sqlite+aiosqlite:///./studydungeon.db`); production must use Postgres, and CI should run the migrations against Postgres too.

| Host | Free tier facts found | Consequence |
| --- | --- | --- |
| Supabase | 500 MB database, 2 active free projects, and free projects are paused after about a week of low activity; a paused project can be restored from the dashboard ([Supabase pricing](https://supabase.com/docs/pricing/), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [database-only FAQ](https://supabase.com/kb/faqs/platform/database-only-cost)). | The daily keep-alive in F.4 is **mandatory**. |
| Neon | Free plan with 1 GB storage per project and 100 CU-hours per project per month; compute scales to zero after 5 minutes idle and wakes in a few hundred milliseconds ([Neon free plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas), [Neon vs Supabase](https://neon.com/guides/neon-vs-supabase-free-plan)). | No weekly pause reported; the first query after idle is slightly slower. Keep-alive is still harmless. |

Content was rephrased for compliance with licensing restrictions.

Either host is fine. The rest of this section works for both. ASSUMPTION B10: the team picks Supabase (the brief mentions its pause); whichever host is picked, the keep-alive in F.4 runs from an **external uptime monitor**, with the GitHub workflow only as a backup.

Connection notes (ASSUMPTION B11, verify with the host docs):

- Driver: `postgresql+asyncpg://...`. TLS required (`ssl=require` for asyncpg).
- Supabase's transaction pooler does not support prepared statements; with asyncpg set `statement_cache_size=0` (and `prepared_statement_cache_size=0` in SQLAlchemy) or use the session pooler/direct connection.
- Neon: use the pooled host name for the app and the direct host for Alembic migrations.
- Keep the pool small (`pool_size=5`, `max_overflow=5`) for free tiers.

### F.2 Tables (new and changed)

| Table | Columns (main) | Notes |
| --- | --- | --- |
| `users` (change) | + `public_id` varchar(12) unique, + `display_name` varchar(16), + `display_name_norm` varchar(32), + `tag` varchar(5), + `is_test` bool default false, + `notice_accepted_at` timestamptz, + `notice_version` varchar(16), + `last_active_at` timestamptz, + `upgraded_at` timestamptz | Unique `(display_name_norm, tag)`. `username` stays unique (guests keep an internal random username or null; ASSUMPTION B12). |
| `packs` (new) | `id` (slug) PK, `order_index` unique, `title`, `description`, `dungeon_id` FK unique, `version` int, `is_published` bool | Seeded from JSON (B-R4). |
| `dungeons` (change) | + `source_kind` (`pack`, `own_notes`), + `pack_id` nullable FK, + `counts_for_ranking` bool, + `content_hash` char(64) | `is_public_demo` can be derived from `source_kind='pack'`. |
| `floors` (new) | `id`, `dungeon_id` FK, `index`, `title`, `status` (`locked`, `ready`, `generating`, `failed`), `error_code`, `generated_at` | `dungeon_rooms` gains `floor_id`. `cleared` is per player (from runs), not stored here. |
| `documents` (change) | + `content_hash` char(64), + `extracted_chars` int, + `counts_for_ranking` bool | Index `(user_id, content_hash)`. |
| `point_events` (new, append-only) | `id` bigserial, `user_id`, `run_id`, `attempt_id` null, `question_id` null, `room_id` null, `pack_id` null, `board_kind` (`preloaded`, `own_notes`), `reason`, `points` int, `week_start` date, `created_at` | Unique `(user_id, attempt_id, reason)` where `attempt_id` not null; partial unique indexes from C-R5. Index `(user_id, created_at)`. |
| `player_stats` (new) | `user_id` PK, `is_ranked` bool, `points_preloaded`, `points_own`, `points_overall`, `reached_at_preloaded`, `reached_at_own`, `reached_at_overall`, `rooms_cleared`, `answers_total`, `correct_total`, `packs_completed`, `updated_at` | `is_ranked` = not test, not system, active (kept in sync when flags change). |
| `player_week_stats` (new) | PK `(user_id, week_start)`, same point and `reached_at` columns, `is_ranked` | One row per player and week with points. |
| `leaderboard_snapshots` (new) | PK `(board, period, period_key)`, `computed_at`, `entries` jsonb, `total_ranked_players` | `period_key` is `all` or the week start date. |
| `ai_usage` (new) | `id`, `created_at`, `provider`, `model`, `purpose` (`classify`, `topics`, `questions`), `document_id`, `user_id`, `status`, `http_status`, `latency_ms`, `prompt_tokens`, `completion_tokens`, `cost_usd` numeric(10,6), `cached` bool | No document content is stored here. |
| `keepalive` (new) | `id` = 1, `last_ping_at` | Written by the keep-alive endpoint. |
| `rate_limit_records` (existing) | unchanged | Prune old rows during the lazy purge. |

### F.3 Rank query and indexes

Indexes (one per board column; the same pattern on `player_week_stats` with `week_start` first):

```sql
CREATE INDEX ix_ps_overall ON player_stats (points_overall DESC, reached_at_overall ASC, user_id)
  WHERE is_ranked AND points_overall > 0;
CREATE INDEX ix_pws_overall ON player_week_stats (week_start, points_overall DESC, reached_at_overall ASC, user_id)
  WHERE is_ranked AND points_overall > 0;
```

Live rank of a player with points `:p`, reached at `:r` and public id `:pid` (join `users` for `public_id`, or store `public_id` on `player_stats` to avoid the join):

```sql
SELECT count(*) + 1 AS rank
FROM player_stats s
WHERE s.is_ranked AND s.points_overall > 0
  AND (s.points_overall > :p
       OR (s.points_overall = :p AND s.reached_at_overall < :r)
       OR (s.points_overall = :p AND s.reached_at_overall = :r AND s.public_id < :pid));
```

The player directly above is the last row of that same "ahead of me" filter: `ORDER BY points_overall ASC, reached_at_overall DESC, public_id DESC LIMIT 1`. The live 20th place is `ORDER BY points_overall DESC, reached_at_overall ASC, public_id ASC OFFSET 19 LIMIT 1`. The snapshot is the first 20 rows of that order, stored as JSON.

Update in the attempt transaction (example for overall):

```sql
UPDATE player_stats
SET points_overall = points_overall + :delta,
    reached_at_overall = CASE WHEN :delta > 0 THEN now() ELSE reached_at_overall END,
    updated_at = now()
WHERE user_id = :uid;
```

### F.4 Keep-alive (the project must stay available until 2027-01-29)

| ID | Requirement |
| --- | --- |
| F-R1 | Add `GET /health/db`: runs `SELECT 1`, updates `keepalive.last_ping_at`, returns `{"status": "ok", "db": "ok", "checked_at": "..."}`. It requires the `KEEPALIVE_TOKEN` secret, sent as the `X-Keepalive-Token` header, or as a `?token=` query parameter over HTTPS for monitors that cannot send headers (otherwise 404), so strangers cannot use it to write. `GET /health` stays DB-free and fast (it is also the warm-up call, F.7). |
| F-R2 | **Primary: an external uptime monitor** (for example UptimeRobot or cron-job.org, free plans) calls `GET /health/db` at least once a day, ideally every few hours, with a timeout of at least 120 s (it must first wake the Render service, which can take about a minute) and an email alert on failure. **Backup only: a GitHub Actions workflow** with `schedule` (cron) plus `workflow_dispatch`, `curl --retry 5 --retry-delay 30 --max-time 120`, the token in a repository secret. ASSUMPTION B21 on the monitor's header support and free-plan interval. |
| F-R3 | GitHub may disable scheduled workflows in a repository with no activity for a long period (ASSUMPTION B13: about 60 days). Because the repository must not change after the submission deadline (F-R5a), the gap from 2026-12-04 to 2027-01-29 is close to that limit, so the GitHub workflow cannot be the primary keep-alive. Check the monitor's dashboard on 2026-12-20 and 2027-01-15. |
| F-R4 | The job must hit the **database**, not only the API, because the Supabase pause depends on database activity. |
| F-R5 | Keep it running until at least **2027-01-29**. After that it can be switched off. |
| F-R5a | **No code pushes after the submission deadline** (2026-12-04, 2:00 PM Pacific). The monitor, the backup workflow, the private backup job, env variables and secrets must all be in place and tested before it. After the deadline only actions outside the repository are allowed (monitor settings, host dashboards, restoring a paused project, reading backups). |

### F.5 Private backups

| ID | Requirement |
| --- | --- |
| F-R6 | A daily `pg_dump --format=custom` of the production database, kept 14 days. |
| F-R7 | Backups are **private**. The main repository is public, so its Actions artifacts and logs are visible to others: either run the backup workflow in a separate private repository, or encrypt the dump (for example with `age` and a public key; the private key never goes to CI) before uploading anything. Never commit a dump. |
| F-R8 | `DATABASE_URL` for the backup job is a secret of that private repository (or a read-only database role). |
| F-R9 | Do one restore drill into a scratch database before the submission and write the steps in `docs/DEPLOY_CHECKLIST.md`. ASSUMPTION B14: the free tier's own backups are not relied on. |

### F.6 Migrations

- Alembic stays. Write new migrations for every table above; check the existing ones (generated against SQLite) run cleanly on Postgres (`alembic upgrade head` on an empty Postgres in CI).
- Data migration: existing users get `public_id`, `display_name` (from `username`) and a tag; existing guests get `expires_at = last_login_at + 30 days`.
- Use `timestamptz` everywhere (the current models use naive `DateTime` with `datetime.utcnow`).

### F.7 Cold start, CORS and cookies in deployment

- Render free web services spin down after 15 minutes without traffic, take about a minute to spin up, get 750 free instance hours per month, and lose local files on restart ([Render free docs](https://render.com/docs/free), [Render free tier article](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)). Content was rephrased for compliance with licensing restrictions.
- Startup must be quick: the pack seed only checks a version row and seeds when needed; no AI calls; no long migrations in the request path.
- **Warm-up call**: the frontend calls `GET /health` once when the title screen loads (fire and forget, no cookie needed), so Render starts waking while the player reads or types a name. `GET /health` must not touch the database, must answer within milliseconds once the service is up, and must allow at least 120 requests per minute per IP. In local development it must be CORS-allowed like the other routes.
- The frontend shows "Waking up the dungeon..." and offers the offline demo after 8 s, so a slow first request is acceptable, but `POST /guests` must still succeed once the service is up (no state lost).
- Production goes through the Vercel rewrite `/api/:path*` to the Render URL **without** the `/api` prefix (routes have no prefix). The browser sees one origin, so: cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, no `Domain` attribute, `Max-Age` 30 days.
- CORS is only needed for local development: `CORS_ORIGINS` as a list (ports 5173 and 5174 on localhost and 127.0.0.1), `allow_credentials=True`, never `*` with credentials.
- Client IP for rate limits: read `X-Forwarded-For` with the right number of trusted hops (`TRUSTED_PROXY_COUNT`). ASSUMPTION B15, **test on the deployed stack first**: send requests through the Vercel rewrite from two networks and log the header and the computed client IP. If the client IP cannot be trusted (spoofable, or every request shows the same proxy IP), switch the per-IP limits to **cookie-based limits** (per session or guest id) and keep the global caps (guest creation, uploads) as the outer guard.
---

## G. AI provider routing

This replaces the earlier rule "OpenRouter is a manual opt-in only". Today the backend has `GeminiProvider` and `MockAIProvider` and picks one with `AI_PROVIDER`; there is no OpenRouter provider yet (`backend/app/ai/factory.py`).

### G.1 Routing order

1. **Primary: Google AI Studio (Gemini) free tier.** Model names and limits come from environment variables filled from the AI Studio rate-limit page ([Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)); nothing is hard-coded.
2. **Fallback 1: OpenRouter `:free` models**, 2 or 3 in priority order, sent in **one request using OpenRouter's `models` fallback array** ([model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)). The array must contain **only `:free` ids**: OpenRouter documents that a paid model in the same array is billed when it answers ([free variants](https://openrouter.ai/docs/guides/routing/model-variants/free)). Validate at startup that every id ends with `:free`.
3. **Fallback 2 (last resort): paid OpenRouter models** using the prepaid credits, as a **separate request**, only when `OPENROUTER_PAID_ENABLED=true`, under a hard daily spend cap and a per-key credit limit, with usage logging. **Never** used for the demo or preloaded packs (they never call AI at all).
4. **Everything failed**: a friendly error, and the frontend offers the preloaded packs.

Free-tier facts (checked 2026-11-10, re-check before relying on them):

- OpenRouter free models: 20 requests per minute; 50 requests per day without purchased credits, 1000 per day after buying at least 10 USD of credits ([OpenRouter limits](https://openrouter.ai/docs/api/reference/limits), [OpenRouter help article](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know)). A negative credit balance can make even free models return 402, so keep the balance positive and never let paid calls run it down.
- Gemini free tier: limits are per model and per project and change over time; read them from the AI Studio page and put them in env variables.

Content was rephrased for compliance with licensing restrictions.

### G.2 Environment variables

| Variable | Example | Meaning |
| --- | --- | --- |
| `AI_PROVIDER_CHAIN` | `gemini,openrouter_free,openrouter_paid` | Order of providers; `mock` for local dev and tests. |
| `GEMINI_API_KEY` | secret | Backend only. |
| `GEMINI_MODEL` | from AI Studio | Required when `gemini` is in the chain (the existing validator stays). |
| `GEMINI_RPM`, `GEMINI_RPD`, `GEMINI_TPM` | from AI Studio | Client-side limiter so the app stops before Google returns 429. |
| `OPENROUTER_API_KEY` | secret | One key for free and paid; set a **credit limit on the key** in the OpenRouter dashboard. |
| `OPENROUTER_FREE_MODELS` | `vendor/model-a:free,vendor/model-b:free` | 2 or 3 ids in priority order (pick current ones from the OpenRouter free list). |
| `OPENROUTER_FREE_RPM`, `OPENROUTER_FREE_RPD` | `20`, `50` | `RPD` becomes 1000 only if at least 10 USD of credits were bought. |
| `OPENROUTER_PAID_ENABLED` | `false` | Default off. |
| `OPENROUTER_PAID_MODELS` | `vendor/model-c` | Paid ids, tried one by one. |
| `AI_PAID_DAILY_CAP_USD` | `0.25` | Hard cap; checked against the sum of `ai_usage.cost_usd` for today (UTC) before every paid call. |
| `AI_CALL_TIMEOUT_SECONDS` | `30` | Per call (today `INGESTION_TIMEOUT_SECONDS`). |
| `GLOBAL_DAILY_GENERATIONS` | `40` | All dungeon generations per UTC day, all users. Derive it from the Gemini daily limit divided by the calls one dungeon needs. |
| `GEN_PER_USER_DAY_REGISTERED`, `GEN_PER_USER_DAY_GUEST` | `3`, `1` | Generations per player per UTC day. |
| `GEN_PER_IP_DAY` | `3` | Generations per IP per UTC day (guests and registered). |
| `DOCS_STORED_REGISTERED`, `DOCS_STORED_GUEST` | `5`, `2` | Stored documents per player (today 5 for everyone). |

### G.3 Requirements

| ID | Requirement |
| --- | --- |
| G-R1 | A `ProviderRouter` implements the existing `AIProvider` interface and walks the chain. Each provider call has a timeout; a 429 is retried once only if `Retry-After` is 10 s or less, otherwise the router moves on. A provider that returned 429 is skipped for a cool-down (in memory, for example 60 s). |
| G-R2 | Every call writes one `ai_usage` row (provider, model, purpose, status, latency, tokens, cost when known). No document text in the row. |
| G-R3 | Paid calls are refused (and the router reports failure) when `OPENROUTER_PAID_ENABLED` is false, when today's paid spend plus a conservative estimate would pass `AI_PAID_DAILY_CAP_USD`, or for any pack or demo content. |
| G-R4 | When every provider fails or every quota is used, generation returns 503 with `AI_BUSY` and the document or floor goes to `failed` with that code, so Retry works later. |
| G-R5 | **Quota checks happen before any AI call**, in this order: per-IP, per-player daily, stored documents, global daily. Each has its own error code (G.4). |
| G-R6 | **Cache by content hash**: `sha256` of the normalized extracted text. If the same player uploads the same content again, reuse the existing topics, questions and dungeon (no AI call, no new generation counted). ASSUMPTION B16: the cache is per player (sharing across players saves quota but needs a privacy decision). |
| G-R7 | **Lazy floor-by-floor generation**: `generate-dungeon` generates the topic map and floor 1 only; floor N+1 is generated when floor N is cleared (or by a background task after floor 1 is ready). Each floor has its own status (`generating`, `ready`, `failed`), shown by `GET /documents/{id}/status` and `GET /dungeons/{id}`; `POST /floors/{id}/retry` re-runs a failed floor (B-to-A frontend-08 item 8). |
| G-R8 | Guests may upload within the guest limits (this replaces 403 `GUEST_FORBIDDEN`). The same file checks apply: allowlist, signature, 15 MB, pages, minimum text, relevance gate. |
| G-R9 | **Upload notice with a confirm checkbox**: before the first upload the screen shows, and the player must tick: "Your notes are sent to third-party AI providers (Google Gemini, and models routed through OpenRouter as a fallback) to generate questions. Free tiers may let these providers keep or use the content under their own terms. Do not upload personal or confidential information." `POST /documents` requires the form field `accept_ai_notice=true` and stores `ai_notice_accepted_at` and the notice version on the document (422 `AI_NOTICE_NOT_ACCEPTED` otherwise). Background for the wording: the Gemini unpaid-tier terms say submitted content and responses may be used to improve Google products and may be read by human reviewers ([Gemini API terms](https://ai.google.dev/gemini-api/terms), [billing page](https://ai.google.dev/gemini-api/docs/billing)); for OpenRouter free models, check the account privacy settings and each free provider's data policy, because some free endpoints require allowing providers that may log or train on prompts (ASSUMPTION B17). The README privacy note says the same. Content was rephrased for compliance with licensing restrictions. |
| G-R10 | **Retention, without over-promising**: our side deletes the uploaded original right after extraction (also on failure, in a `finally`) and keeps chunks, topics and questions until the owner deletes the document or the account, or the guest is purged. What happens at the AI provider is governed by that provider's terms, so the notice and the README **must not promise minimal retention, deletion or "no training" beyond what each provider's terms support**. Never send usernames, cookies, IPs or other users' data to a provider. |
| G-R11 | **File size limits by type, checked after extraction and before any AI call**: PDF at most 30 pages (422 `TOO_MANY_PAGES`), PPTX at most 30 slides (422 `TOO_MANY_SLIDES`), DOCX at most `MAX_DOCX_CHARS` extracted characters (default 60 000, 422 `TOO_MUCH_TEXT`). Each error carries `detail.limit` and `detail.found` so the screen can say "This PDF has 42 pages; the limit is 30." ASSUMPTION B20 on the DOCX default and on applying the same character limit to TXT. |

### G.4 Endpoints and errors

**`GET /uploads/quota`** (session required; guests included)

```json
{
  "can_upload": true,
  "reason": null,
  "player": { "is_guest": true, "used_today": 0, "limit_today": 1, "stored": 0, "stored_limit": 2, "resets_at": "2026-11-21T00:00:00Z" },
  "global": { "available": true },
  "ranking": { "min_chars": 3000, "min_topics": 2 }
}
```

When `can_upload` is false, `reason` is one of `player_daily_limit`, `ip_daily_limit`, `stored_limit`, `global_daily_limit`, `ai_unavailable`.

Errors on `POST /documents` and `POST /documents/{id}/generate-dungeon`:

| Status | Code | When |
| --- | --- | --- |
| 429 | `UPLOAD_LIMIT_PLAYER` | Player daily generation limit (with `Retry-After` until the UTC day ends). |
| 429 | `UPLOAD_LIMIT_IP` | IP daily limit. |
| 400 | `QUOTA_EXCEEDED` | Stored documents limit (existing code). |
| 503 | `UPLOADS_PAUSED_TODAY` | Global daily cap reached. |
| 503 | `AI_BUSY` | Every provider failed. |
| 413 / 415 / 422 | existing | Size, type, content checks (unchanged). |
| 422 | `AI_NOTICE_NOT_ACCEPTED` | `accept_ai_notice` missing or false (G-R9). |
| 422 | `TOO_MANY_PAGES` / `TOO_MANY_SLIDES` / `TOO_MUCH_TEXT` | Type limits (G-R11), with `limit` and `found`. |

```json
{ "detail": { "code": "AI_BUSY",
  "message": "The summoning circle is busy. Try again later, or play a preloaded pack.",
  "retry_after_seconds": 600, "offer_packs": true } }
```

`GET /documents/{id}/status` additions: `"counts_for_ranking": false, "ranking_note": "Notes this short do not count toward the Own notes leaderboard.", "dungeon_id": "d_5", "floors": [{"id": "f_1", "status": "ready"}, {"id": "f_2", "status": "generating"}]`.

### G.5 Acceptance criteria

1. With Gemini forced to return 429, generation succeeds through the free OpenRouter array; `ai_usage` shows both calls.
2. With Gemini and free OpenRouter failing and `OPENROUTER_PAID_ENABLED=false`, the response is 503 `AI_BUSY` and no paid call is made.
3. With paid enabled and today's spend at the cap, no paid call is made.
4. Startup fails with a clear message if `OPENROUTER_FREE_MODELS` contains an id without `:free`.
5. Uploading the same file twice as the same player makes no second AI call and does not use a second daily generation.
6. Floor 2 of a new dungeon is `generating` while floor 1 is `ready` and playable.
7. A guest's second upload on the same day returns 429 `UPLOAD_LIMIT_PLAYER` before any AI call; `GET /uploads/quota` reports `player_daily_limit`.
8. The temp upload directory is empty after a successful and after a failed ingestion.
9. Pack and demo flows run with the AI chain empty.
10. A 31-page PDF, a 31-slide PPTX and a DOCX over the character limit each return their own 422 code with `limit` and `found`, and no AI call is made.
11. `POST /documents` without `accept_ai_notice=true` returns 422 `AI_NOTICE_NOT_ACCEPTED`.
---

## H. Security and abuse

| ID | Requirement |
| --- | --- |
| H-R1 | Rate limits (DB-backed, the existing `check_rate_limit`): guest creation 30 per hour per IP plus the global hourly guest cap (A-R11); name check 30 per minute per IP; login 10 per minute per IP (existing); upgrade 10 per hour per IP; attempts 30 per minute per user and 60 per minute per IP; uploads per Section G; leaderboard, stats and `GET /health` 120 per minute per IP. All return 429 `RATE_LIMIT_EXCEEDED` with `Retry-After` (the global caps return 503). Per-IP limits fall back to cookie-based limits when the client IP is not trustworthy (F.7). |
| H-R2 | Ownership checks on every private resource: documents, dungeons (except published packs), runs, attempts, reviews, progress, quota. A wrong owner gets 404 (or 403 where the code already does), never data. Two-user and guest-vs-user tests for each route. |
| H-R3 | Display-name moderation on the server only (A-R1 to A-R3); log refused names without the IP. A way to blank an abusive name without deleting the player (backend script that sets a neutral name and a new tag). |
| H-R4 | No secrets in the frontend: AI keys, `SECRET_KEY`, `KEEPALIVE_TOKEN` and database URLs live only in backend env. The frontend only knows `VITE_USE_MOCKS` and `VITE_API_BASE`. |
| H-R5 | CSRF: the API accepts state-changing requests only with `Content-Type: application/json` (or multipart for uploads) and checks `Origin` against the allowed origins when it is present. Combined with `SameSite=Lax`, this blocks cross-site form posts. |
| H-R6 | Session rotation on login, register, upgrade and logout (`session_version`, existing). |
| H-R7 | Never echo answer keys before an attempt; never return another player's private data in `me` blocks; the public leaderboard and counter responses contain only the fields in D-R8 and E. |
| H-R8 | Upload safety stays as today (allowlist, signature, size, temp dir, prompt-injection rules); guest uploads add no new file types. |
| H-R9 | Points cannot be influenced by request fields (C-R1, C.5 item 7); idempotency prevents replay farming (C-R4). |

---

## I. Acceptance criteria and tests the frontend contract suite can run

The frontend runs `npm.cmd run test:contract` with `VITE_API_BASE` and `VITE_USE_MOCKS=false` against a **disposable** backend (see the frontend doc, 8.4). Existing tests stay; these are added as the endpoints ship (each one is skipped while the backend does not declare the feature):

1. `POST /guests` creates a guest with a handle `Name#1234`, sets the cookie, and `GET /auth/me` returns the same handle.
2. `POST /guests` refuses `ab`, a 17-character name, `admin`, `Adm1n` and `ghost rival` with 422 `NAME_INVALID` and the right `reason`.
3. Two guests with the same name get different tags.
4. `POST /auth/upgrade` keeps `public_id`, handle and points; a second upgrade returns 403 `NOT_A_GUEST`.
5. `GET /packs` without a cookie shows pack 1 available and the rest locked; with a fresh guest the same; `POST /runs` on a locked pack is 403 `PACK_LOCKED`.
6. Clearing pack 1 (through the normal run calls) unlocks pack 2 in `GET /packs` and in `pack_progress`.
7. The first correct answer awards 100 or 150 points; answering the same question correctly again in the same week awards 10; replaying the same `attempt_id` returns identical JSON.
8. Two answers less than 0.8 s apart: the second has `points_reason: "too_fast"` and 25 percent of its normal points (never 0 for a correct answer).
9. `GET /leaderboard` without a cookie: at most 20 entries, `me: null`, `updated_at` and `next_refresh_at` one hour apart, no `username` key anywhere.
10. `GET /leaderboard` with a session: `me.live` is true and `me.points` equals the player's `player_points` from the last attempt.
11. Every `board` and `period` combination returns 200; an unknown value returns 422.
12. Ranks are 1..n without gaps and sorted by points, then by `reached_at` (checked on the entries).
13. `GET /stats/players` returns non-negative integers and `cache_seconds`.
14. `GET /uploads/quota` returns a guest limit; a second guest upload in a day returns 429 `UPLOAD_LIMIT_PLAYER`.
15. With the AI chain disabled on the test backend, generation returns 503 `AI_BUSY` with `offer_packs: true`.
16. `GET /dungeons/{pack dungeon}` returns `floors[]` and `final_boss`; `POST /runs` with `floor_id` scopes the run to that floor.
17. Regression tests for the prerequisites P1 to P5 (seeded demo, real `monster_hp_remaining`, progress persisted, no duplicate due reviews, no 500 on generated dungeons).
18. `DELETE /auth/me` with `{"confirm": "DELETE"}` works for a guest and a registered player; the cookie then gets 401 and the player is gone from `GET /leaderboard`.
19. `POST /documents` without `accept_ai_notice=true` is 422 `AI_NOTICE_NOT_ACCEPTED`; a 31-page PDF is 422 `TOO_MANY_PAGES`.
20. `GET /health` answers 200 without a cookie and without touching the database.
21. A Daily Haunt answer reports `points_reason: "practice"` and half points.

Backend-side tests that the frontend cannot run: concurrency of `first_correct` (C.5 item 2), the snapshot single-recompute (D.4 item 2), purge after 30 days (A.4 item 4), ledger-equals-stats property test (C.5 item 6), paid-cap and `:free` validation (G.5), temp directory cleanup (G.5 item 8).

---

## J. Open questions for Person A, and what the frontend needs

### J.1 Open questions

1. Supabase or Neon? (F.1) Which region?
2. Run score: which of the three rules (code, `game-design.md`, mock) is final? (P7)
3. Points values in C.2: keep the defaults or change them? Is the weekly window right for "repeats", or should repeats be reduced forever (all-time)?
4. Weekly reset: Monday 00:00 UTC, or a local timezone such as Asia/Karachi? (D.1)
5. Should registered players also get a tagged display name automatically (A-R10), and is renaming allowed (A.3, PATCH)?
6. Guest who logs into an existing account on the same browser: drop the guest progress, or offer a merge? (V2 assumes no merge.)
7. AI output cache across players with identical notes: allowed or per player only? (G-R6)
8. Own-notes daily points cap (C-R8): wanted, and at what value?
9. Will `POST /demo/session` be kept for the offline-demo label and old links, or retired after `POST /guests`?
10. Which pack topics for packs 2 and 3, and who writes and reviews the questions?
11. Practice modes and Daily Haunt give reduced points (C-R11): is 50 percent right?
12. Are badges computed on the server (B-to-A frontend-07 proposal), and should they appear on leaderboard entries?
13. Is a capabilities endpoint welcome (for example `GET /meta` returning `{floors, modes, daily_haunt, packs, leaderboard, guest_upload}`)? The frontend hides features until a backend declares them; today it infers them from responses.
14. The exact streak-bonus rule, written in `game-design.md` (P7).
15. The DOCX character limit (and whether TXT shares it), G-R11.
16. The global hourly guest cap value (A-R11).

### J.2 What the frontend needs from the backend (summary)

- The prerequisites P1 to P7.
- Response models for every route in `openapi.json`, and `api-contract.md` refreshed to match the code (doc drift list in the frontend doc, 6.3).
- The PROPOSED items still open in `B-to-A.md`: floors and final boss on dungeons, `floor_id` and `mode` on runs (including `daily_haunt`), attempt additions (`requeue_after`, `is_retry`, `retry_multiplier`, `combo`, `correct_answer` after wrong answers, `source.page`), finish additions (`floor_rank`, `mastery_by_topic`, `badges_earned`, `level_up`, `weapon_unlocked`, `chest_rewards`), progress additions (`xp_to_next` first), the `GET /reviews/due` summary shape, `POST /floors/{id}/retry`, `PUT /progress/equipped-weapon`.
- The new endpoints in this doc: `POST /guests/name-check`, `POST /guests`, `POST /auth/upgrade`, `DELETE /auth/me` for guests too (with confirmation), `GET /packs`, `GET /leaderboard` (new shape), `GET /stats/players`, `GET /uploads/quota`, a fast DB-free `GET /health` for the warm-up call, plus the points fields, the `accept_ai_notice` upload field and the new error codes.
- An A-to-B entry per shipped step, with the exact JSON.

---

## 11. Suggested build order

Each step is one backend spec, ends with tests green, `api-contract.md` and `openapi.json` updated, and an A-to-B entry. The frontend switches each feature on when its step is live.

| Step | Scope | Why this order |
| --- | --- | --- |
| 1 | **Prerequisites P1 to P7** (seed at startup, real `monster_hp_remaining`, progress persisted, review upsert, 500 fix, cookie `Secure` and CORS list, score rule) | Real-mode play is broken without them; points depend on correct progress. |
| 2 | **PostgreSQL and operations** (F): Postgres `DATABASE_URL`, `timestamptz`, migrations on Postgres, `/health/db`, keep-alive workflow plus backup pinger, private backups, restore drill | Every later table lives here; the keep-alive must run long before 2027-01-29. |
| 3 | **Guest identity** (A): display names, moderation, tags, 30-day cookie and lazy purge, `is_test`, `POST /guests`, name check, upgrade, public fields on `/auth/me`, guest limits with the global hourly cap, delete my account and data | Leaderboard entries need handles; deletion must exist before real players arrive. |
| 4 | **Floors and run scoping** (B-to-A items 1, 2, 3, 8) and **packs** (B): floors table, `floor_id`, `mode`, server-side question draw, pack JSON + validator + seed, `GET /packs`, unlock rule | Packs are campaigns made of floors. |
| 5 | **Points ledger** (C): `point_events`, `player_stats`, `player_week_stats`, attempt/clear/finish additions, anti-farming rules, rebuild script | The leaderboard reads these tables. |
| 6 | **Leaderboard and counter** (D, E): snapshots with lazy refresh, live `me`, tie-breaks, `GET /stats/players` | Needs steps 3 and 5. |
| 7 | **AI routing, quotas and guest upload** (G): router, OpenRouter free array, paid fallback behind flags, `ai_usage`, quota endpoint and errors, content-hash cache, lazy floors, upload notice field, page/slide/character limits | Independent of 5 and 6; can run in parallel with them if time is short. |
| 8 | **Hardening and contract tests** (H, I): rate limits on new routes, CSRF check, ownership tests, the contract cases in Section I, docs sync | Final pass before the submission freeze. |

---

## 12. Assumptions in this document

- **B1**: Registered users get a display name derived from their username (A-R10).
- **B2**: Changing the display name is optional; if built, it issues a new tag and is limited to once per day.
- **B3**: Leaderboard points are separate from the run score (also A4 in the frontend doc).
- **B4**: Person A states the exact streak-bonus rule in `game-design.md`; until then C.2 uses +25 at every third consecutive full-point correct answer as a placeholder.
- **B5**: The time between attempts is a good enough proxy for the minimum answer time; the threshold is generous (800 ms) and too-fast answers get 25 percent of their points, never zero.
- **B6**: Own notes get a daily points cap (default 2000).
- **B7**: Daily Haunt and practice modes give 50 percent of the answer points and no room, boss or pack bonuses.
- **B8**: The weekly reset is Monday 00:00 UTC.
- **B9**: The indexed count query meets 50 ms for 10 000 players on a free Postgres tier (not measured).
- **B10**: The team picks Supabase (Neon works with the same design); either way the keep-alive runs from an external uptime monitor.
- **B11**: The asyncpg and pooler settings in F.1 match the host docs (verify).
- **B12**: Guests keep an internal username (random or null) and only the display name is public.
- **B13**: GitHub may disable scheduled workflows after about 60 days without repository activity (verify in the GitHub Actions docs), so the GitHub workflow is only a backup and the repository stays unchanged after the 2026-12-04 deadline.
- **B14**: The free tier's own backups are not relied on.
- **B15**: Vercel and Render together add two proxy hops to `X-Forwarded-For`. **Test on the deployed stack first**; if the client IP cannot be trusted, per-IP limits fall back to cookie-based limits.
- **B16**: The AI output cache is per player by default.
- **B17**: Some OpenRouter free endpoints need a privacy setting that allows providers who may log or train on prompts (verify in the OpenRouter account settings). The upload notice and README promise no retention beyond what each provider supports.
- **B18**: The default limits suit a hackathon demo: 30 new guests per hour per IP plus a global cap of 300 per hour, 1 guest generation per day, 3 per registered player, 40 generations per day in total, 30 attempts per minute. Tune them after a test day.
- **B19**: All free-tier numbers quoted here (Supabase, Neon, Render, OpenRouter, Gemini) were true on 2026-11-10 according to the linked pages and may change.
- **B20**: The DOCX limit is 60 000 extracted characters and TXT uses the same limit (PDF 30 pages and PPTX 30 slides are firm).
- **B21**: The chosen uptime monitor can send a custom header or call a URL with a query token, and its free plan allows a daily (or more frequent) check with a 120 s timeout.
- **B22**: Marking all snapshots stale on account deletion is cheap enough (a few deletions a day).
