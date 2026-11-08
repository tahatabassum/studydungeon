# Tasks: Backend 01 — Foundation, Authentication & Guest Sessions

- [x] 1. Define `User` and `UserProgress` SQLAlchemy models with `is_guest` and `expires_at` fields <!-- owner: backend; files: backend/app/models/all_models.py; test: tests/test_auth.py -->
- [x] 2. Implement Argon2 password hashing and secure verification <!-- owner: backend; files: backend/app/core/security.py; test: tests/test_auth.py -->
- [x] 3. Implement HMAC signed session tokens with HttpOnly SameSite cookie handling <!-- owner: backend; files: backend/app/core/security.py; test: tests/test_auth.py -->
- [x] 4. Build `POST /auth/register` with unique username constraint and input validation <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_auth.py -->
- [x] 5. Build `POST /auth/login` and `POST /auth/logout` endpoints <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_auth.py -->
- [x] 6. Implement `GET /auth/me` with session extraction dependency <!-- owner: backend; files: backend/app/api/auth.py, backend/app/core/deps.py; test: tests/test_auth.py -->
- [x] 7. Build `POST /demo/session` creating temporary guest user with 24h TTL <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_demo.py -->
- [x] 8. Implement `DELETE /auth/me` cascading account deletion <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_auth_remaining.py -->
- [x] 9. Implement database-backed IP rate limiting reading `X-Forwarded-For` behind proxy <!-- owner: backend; files: backend/app/core/rate_limit.py, backend/app/api/auth.py; test: tests/test_auth_remaining.py -->
- [x] 10. Implement lazy expired-guest purging on `POST /demo/session` and CLI command <!-- owner: backend; files: backend/app/api/auth.py, backend/app/demo/purge.py; test: tests/test_auth_remaining.py -->
