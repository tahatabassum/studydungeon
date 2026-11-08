# Design: Backend 01 — Foundation, Authentication & Guest Sessions

## 1. Modules & Structure
- `app/core/security.py`: Argon2 password hashing (`PasswordHasher`), HMAC-SHA256 session token generation and verification.
- `app/core/deps.py`: Dependency injection for `get_current_user`, `get_current_user_optional`, and `require_registered_user`.
- `app/api/auth.py`: Route handlers for authentication and guest demo sessions.
- `app/models/all_models.py`: `User`, `UserProgress`, and session-related fields.
- `app/schemas/auth.py`: Pydantic validation schemas.

## 2. Data Models & Schemas
- `User`:
  - `id`: UUID (String 36, Primary Key)
  - `username`: String(64), unique, indexed, case-insensitive normalized.
  - `password_hash`: String(256), nullable ONLY for guest users (`is_guest=true`).
  - `is_guest`: Boolean, default `False`.
  - `expires_at`: DateTime, nullable (set to `now() + 24 hours` for guests).
  - `is_active`: Boolean, default `True`.
  - `created_at`, `last_login_at`: DateTime timestamps.
- `UserProgress`:
  - `id`: UUID, `user_id` (One-to-one with cascade delete), `total_xp` (default 0), `level` (default 1), `coins` (default 0), `unlocked_weapons` (JSON list).

## 3. Endpoints & Protocol
- `POST /auth/register`: Takes `{username, password}`. Hashes password via Argon2. Creates user and initial `UserProgress`. Returns `201 Created`.
- `POST /auth/login`: Verifies Argon2 hash. Issues HttpOnly SameSite=Lax cookie. Returns user profile.
- `POST /auth/logout`: Clears cookie by setting max_age=0.
- `GET /auth/me`: Validates session cookie, returns active user.
- `DELETE /auth/me` [PROPOSED FOR IMPLEMENTATION]: Deletes user with cascading deletion of all owned documents, dungeons, runs, attempts, and progress.
- `POST /demo/session`: Public, IP rate-limited endpoint. Creates temporary guest user with random name (`guest_xxxx`), sets session cookie with 24-hour TTL, returns guest user and seeded demo dungeon ID. Triggers lazy cleanup of expired guests.

## 4. Error Handling & Status Codes
- `401 Unauthorized`: Missing or expired session cookie, invalid login credentials.
- `403 Forbidden`: Guest attempting access to registered-only operations (document upload/generation).
- `409 Conflict`: Username already registered.
- `422 Unprocessable Entity`: Password shorter than 6 characters or invalid input types.
- `429 Too Many Requests`: IP exceeding rate limits on login (10/min) or demo session (60/hr).

## 5. Implementation Status
- **Implemented:**
  - SQLAlchemy `User` and `UserProgress` models.
  - Argon2 hashing and HMAC cookie tokens in `app/core/security.py`.
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
  - `POST /demo/session` guest creation and cookie setting.
  - Tests in `tests/test_auth.py`, `tests/test_demo.py`, `tests/test_isolation.py`.
- **Missing / Pending:**
  - `DELETE /auth/me` account self-deletion endpoint with cascade.
  - Persistent database-backed rate limiting using `X-Forwarded-For`.
  - Lazy purge of expired guest accounts during `POST /demo/session`.

## 6. Test Strategy
- Unit & integration tests via pytest using async SQLite in-memory fixtures.
- Test coverage for registration, duplicate username rejection, invalid credentials, guest session creation, and unauthenticated route rejection.

