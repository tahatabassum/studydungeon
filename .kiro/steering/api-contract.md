# StudyDungeon — API Contract (Single Source of Truth)

## 1. Authentication & Sessions
All authenticated endpoints require an HttpOnly, Secure session cookie (`session_token`).
Errors follow standard structure:
```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human readable explanation"
  }
}
```

### `POST /auth/register`
- Request: `{"username": "string", "password": "string"}`
- Response (201): `{"id": "uuid", "username": "string", "is_guest": false, "created_at": "datetime"}`
- Errors: 409 (Username taken), 422 (Password too short/weak).

### `POST /auth/login`
- Request: `{"username": "string", "password": "string"}`
- Response (200): `{"id": "uuid", "username": "string", "is_guest": false}`
- Sets HttpOnly session cookie. Error: 401 (Invalid username or password).

### `POST /auth/logout`
- Response (200): `{"success": true}` (Clears session cookie).

### `GET /auth/me`
- Response (200): `{"id": "uuid", "username": "string", "is_guest": boolean, "expires_at": "datetime|null"}`

### `POST /demo/session` (Public, Rate-Limited: 60/hr/IP)
- No body required. Creates guest user. Sets session cookie.
- Response (201):
```json
{
  "user": {
    "id": "uuid",
    "username": "guest_ab12cd",
    "is_guest": true,
    "expires_at": "2026-11-08T22:00:00Z"
  },
  "dungeon_id": "uuid_of_seeded_demo",
  "expires_at": "2026-11-08T22:00:00Z"
}
```

---

## 2. Document & Dungeon Endpoints (Guests Blocked: 403 Forbidden)

### `POST /documents` (Multipart form-data)
- Form: `file: UploadFile` (PDF, TXT, DOCX, PPTX, PNG, JPG/JPEG).
- Response (202): `{"id": "uuid", "title": "string", "status": "processing"}`

### `GET /documents/{id}/status`
- Response (200):
```json
{
  "id": "uuid",
  "status": "accepted|rejected|processing",
  "relevance_score": 0.88,
  "readability_score": 0.92,
  "rejection_reason": null,
  "topic_count": 4
}
```

### `GET /documents/{id}/topics`
- Response (200): `[{"id": "uuid", "name": "Topic Name", "chunk_count": 3}]`

### `POST /documents/{id}/generate-dungeon`
- Response (201): `{"dungeon_id": "uuid", "title": "string", "room_count": 4, "status": "ready"}`

### `GET /dungeons`
- Returns user's dungeons + the public seeded demo dungeon.

### `GET /dungeons/{id}`
- Returns dungeon layout, topic rooms, monsters, and question pool metadata.

---

## 3. Game Combat & Authoritative State

### `POST /runs`
- Request: `{"dungeon_id": "uuid"}`
- Response (201): `{"run_id": "uuid", "player_hp": 100, "current_score": 0, "status": "active"}`

### `POST /runs/{id}/attempts` (Authoritative Combat Engine)
- Request:
```json
{
  "attempt_id": "uuid_from_frontend_for_idempotency",
  "question_id": "uuid",
  "selected_option": 2,
  "response_time_ms": 3200
}
```
- Response (200):
```json
{
  "correct": true,
  "damage_dealt": 25,
  "monster_hp_remaining": 45,
  "player_hp_remaining": 100,
  "score_delta": 100,
  "xp_delta": 25,
  "streak": 3,
  "is_critical": false,
  "source": {
    "page": 4,
    "slide": null,
    "chunk_id": "uuid",
    "evidence_quote": "Exact verbatim quote from user notes"
  },
  "review_status": "scheduled_in_3_days",
  "monster_defeated": false,
  "player_defeated": false
}
```

### `POST /runs/{id}/rooms/{room_id}/clear`
- Response (200): `{"room_cleared": true, "bonus_xp": 50, "bonus_score": 50}`

### `POST /runs/{id}/finish`
- Response (200): Full scorecard (Accuracy, per-topic mastery bands, weak concepts).

### `GET /progress`
- Response (200): `{"level": 2, "xp": 140, "coins": 100, "unlocked_weapons": ["Rusty Dagger", "Arcane Staff"]}`

### `GET /reviews/due`
- Response (200): `[{"question_id": "uuid", "prompt": "...", "due_at": "datetime"}]`

