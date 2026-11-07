# Handoff: Person B (game/frontend) to Person A (backend)

Date: 2026-11-07 (spec: frontend-00-playable-slice)

> These shapes are the frontend's working assumptions, built against mock fixtures. They are **replaced by `.kiro/steering/api-contract.md` once Person A publishes it**. The backend remains authoritative for correctness, damage, HP, XP, score and streak.

All requests use `credentials: "include"` against `VITE_API_BASE_URL`. Non-2xx responses are surfaced as a typed `ApiError` carrying the status code.

## Shared types

```ts
interface User { id: string; username: string; is_guest: boolean }
type QuestionType = 'mcq' | 'true_false'
interface Question { id: string; type: QuestionType; prompt: string; options: string[] } // no correct answer, no explanation
interface Monster { id: string; name: string; max_hp: number; question_ids: string[] }
interface Room { id: string; label: string; monster: Monster }
interface Dungeon { id: string; name: string; rooms: Room[]; questions: Question[] }
interface Run { id: string; dungeon_id: string; player_hp: number; monster_hp: number }
```

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
