# Handoff: Person B (game/frontend) to Person A (backend)

Date: 2026-11-07 (spec: frontend-00-playable-slice)

> These shapes are the frontend's working assumptions, built against mock fixtures. They are **replaced by `.kiro/steering/api-contract.md` once Person A publishes it**. The backend remains authoritative for correctness, damage, HP, XP, score and streak.

All requests use `credentials: "include"` against `VITE_API_BASE_URL`. Non-2xx responses are surfaced as a typed `ApiError` carrying the status code.

## Shared types

```ts
interface User { id: string; username: string; is_guest: boolean }
type QuestionType = 'mcq' | 'true_false'
interface Question { id: string; type: QuestionType; prompt: string; options: string[] } // no correct answer, no explanation
interface Monster { id: string; name: string; max_hp: number; question_ids: string[]; kind: string } // CHANGED 2026-11-07: added `kind`
interface Room { id: string; label: string; order: number; is_boss: boolean; monster: Monster } // CHANGED 2026-11-07: added `order`, `is_boss`
interface Dungeon { id: string; name: string; rooms: Room[]; questions: Question[] }
interface Run { id: string; dungeon_id: string; player_hp: number; monster_hp: number; current_room_id: string } // CHANGED 2026-11-07: added `current_room_id`
interface RunSummary { score: number; xp: number; correct: number; total: number; accuracy: number } // NEW 2026-11-07
```

> **Changed 2026-11-07:** `Room.order`, `Room.is_boss`, `Monster.kind`, `Run.current_room_id` and `RunSummary` are new. See the update section at the end of this file.

## Endpoints

### POST /demo/session
- Request: no body.
- Response: `{ user: User, dungeon_id: string, expires_at: string }` (ISO timestamp). `user.is_guest` is `true`.

### GET /dungeons/{id}
- Response: `Dungeon`. Questions never include the correct answer or explanation.

### POST /runs
- Request: `{ dungeon_id: string }`
- Response: `Run`

### POST /runs/{id}/attempts
- Request (only these fields, never a damage value):
  ```ts
  { question_id: string; selected_answer: string; attempt_id: string }
  ```
- `attempt_id` is a client-generated unique id. Resubmitting the same `attempt_id` must return the stored result without changing state (idempotent). The client reuses it when retrying after a failure.
- Response:
  ```ts
  interface AnswerResult {
    correct: boolean
    damage_dealt: number
    monster_hp_remaining: number
    player_hp_remaining: number
    score_delta: number
    xp_delta: number
    streak: number
    source: { page: number; chunk_id: string }
    review_status: 'due' | 'not_due'
    explanation?: string // OPTIONAL
  }
  ```
- `explanation` is optional. The UI shows "From your notes: page X" and appends the explanation only when present; absence is not an error.

### POST /runs/{id}/rooms/{room_id}/clear
- Request: no body.
- Response: `{ xp_delta: number }` (added to HUD XP).
- **Changed 2026-11-07:** multi-room semantics apply (409 while the room's monster is alive, idempotent on repeat). See the update section below.

### POST /runs/{id}/finish (NEW 2026-11-07)
- See the update section below.

## Agreed demo balance values

| Value | Amount |
| --- | --- |
| Player HP | 100 |
| Monster HP | 60 |
| Correct-answer damage (Rusty Dagger) | 20 (limited to remaining monster HP) |
| Wrong-answer player damage | 10 (limited to remaining player HP) |
| score_delta per correct answer | 100 |
| xp_delta per correct answer | 10 |

Wrong answers: `damage_dealt` 0, `score_delta` 0, `xp_delta` 0, streak reset to 0, `review_status` `due`. Correct answers: streak +1, `review_status` `not_due`.

**Person A: please confirm these match `game-design.md` and the backend.** The frontend only uses them inside the mock path (`src/demo/rules.ts`); the real backend decides.

## Demo dungeon JSON shape (bundled placeholder)

`src/demo/demoDungeon.json` follows the public `Dungeon` type: one room ("Chamber of Basics"), one monster ("Skeleton Scribe", `max_hp` 60) and 4 to 5 multiple-choice questions with placeholder content. The answer key (correct answer, explanation, source page) is held separately in the mock (`src/api/mock/answerKey.ts`) and is not part of the `Dungeon` shape.

```json
{
  "id": "demo-dungeon",
  "name": "Demo Dungeon",
  "rooms": [{ "id": "room-1", "label": "Chamber of Basics",
    "monster": { "id": "monster-1", "name": "Skeleton Scribe", "max_hp": 60, "question_ids": ["q1", "q2", "q3"] } }],
  "questions": [{ "id": "q1", "type": "mcq", "prompt": "...", "options": ["...", "...", "...", "..."] }]
}
```

## Open questions for Person A

1. Is `explanation` returned in `AnswerResult`? Always, only on wrong answers, or never?
2. Does the clear-room response carry only `xp_delta`, or also totals (score, level)?
3. What fields does the `Run` response include (HP values, room progress, score)? Are HP values server-tracked per run?
4. Error response format (e.g. `{ "detail": "..." }`, error codes) and which statuses to expect (401, 404, 429, 5xx).
5. For `selected_answer`: is it the option text or an option id? Currently assumed to be the option text; `Question.options` is `string[]`.
6. True/False questions: are the options `["True", "False"]` and is `selected_answer` one of those strings?
7. Cookie and CORS: session cookie name, `SameSite`/`Secure` settings across frontend and API origins, and `Access-Control-Allow-Credentials` with an explicit origin.
8. Guest session lifetime: is `expires_at` fixed (mock uses 24h)? What happens on expiry mid-run?
9. Retry behavior: does starting a new run via `POST /runs` reset room and monster HP for the same dungeon?
10. Is `source.chunk_id` stable, and is `source.page` 1-based?

---

## Update 2026-11-07: frontend-03-phaser-core (multi-room dungeon)

> **Status: Person A has NOT implemented any of these changes yet.** The frontend runs against the mock (`VITE_USE_MOCKS=true`) until Person A confirms the shapes and values below. The backend stays authoritative for correctness, damage, HP, XP, score, streak and the run summary. The frontend never computes them.

### New and changed fields

| Type | Field | Change | Notes |
| --- | --- | --- | --- |
| `Room` | `order: number` | new | Ascending order of rooms in the dungeon. Boss room has the highest `order`. |
| `Room` | `is_boss: boolean` | new | Exactly one boss room, last in order. |
| `Monster` | `kind: string` | new | Visual type id, e.g. `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`. Plain string; unknown kinds get a default look on the frontend. |
| `Run` | `current_room_id: string` | new | Room the run is currently in. |
| `RunSummary` | `{ score, xp, correct, total, accuracy }` | new | Returned by finish. |

```ts
interface Monster { id: string; name: string; max_hp: number; question_ids: string[]; kind: string }
interface Room { id: string; label: string; order: number; is_boss: boolean; monster: Monster }
interface Run { id: string; dungeon_id: string; player_hp: number; monster_hp: number; current_room_id: string }
interface RunSummary { score: number; xp: number; correct: number; total: number; accuracy: number }
// AnswerResult and AttemptRequest are unchanged.
```

`Run.monster_hp` is assumed to be the HP of the monster in `current_room_id`.

### POST /runs/{id}/finish

- Request: no body. The run id is in the path. Sent with `credentials: "include"` (session cookie).
- Response (200): `RunSummary`
  ```ts
  { score: number; xp: number; correct: number; total: number; accuracy: number }
  ```
  `accuracy` is a ratio from 0 to 1 (`correct / total`, 0 when `total` is 0). The frontend formats it as a percentage.
- Error: `409` if the boss room has not been cleared yet.
- The frontend calls it right after the boss `clearRoom` succeeds and shows the returned values as received.

### POST /runs/{id}/rooms/{room_id}/clear (multi-room semantics)

- `404` for an unknown room.
- `409` while the room's monster HP is above 0.
- Idempotent: repeating the call for a cleared room returns the same `xp_delta` and changes nothing.
- Success returns `{ xp_delta: number }`.
- Clearing the boss room is followed by `finishRun`.

### Balance values (mock only, Person A please confirm)

| Value | Topic rooms | Boss room |
| --- | --- | --- |
| Monster HP | 60 | 120 |
| Correct-answer damage | 20 | 20 |
| Wrong-answer player damage | 10 | 12 |
| Clear XP (`xp_delta` on clear) | 25 | 100 |

The boss needs exactly 6 correct answers (120 HP at 20 damage). Player HP stays 100. The demo boss has an 8-question pool (two per topic); the frontend cycles through the pool after wrong answers. Existing per-answer values (score 100, XP 10 per correct answer) are unchanged. The mock does not enforce room order on attempts; the frontend guards order with closed Gates.

### Event bridge changes

The Phaser/React Event_Bridge events changed (`load-room` replaced by `load-dungeon`, `room-cleared` replaced by `gate-open`, new `set-muted`, `room-entered`, `gate-opened`, phase `victory`). These are internal to the frontend and have **no backend impact**.

### Open questions for Person A

1. Does `Run.monster_hp` refer to the monster of `current_room_id`?
2. How are per-room monster HP and cleared state returned when a run is resumed?
3. Does the backend reject attempts made out of room order (for example, a question from room 3 while room 2 is uncleared)?
4. Is `RunSummary.accuracy` a ratio (0 to 1) or a percentage?
5. Which `Monster.kind` values will exist? The frontend currently knows `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`.
6. Do the boss values (120 HP, wrong-answer damage 12, clear XP 100) and room clear XP (25) match `game-design.md`?
7. Is `finishRun` idempotent, and what happens if it is called twice?
