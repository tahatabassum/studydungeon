# Backend Spec 07: Prerequisites & Identity (P1-P7 & Section A)

## Requirements
- Fix P1: Seed demo content on app startup (lifespan) idempotently.
- Fix P2: Return real `monster_hp_remaining` on attempts & replays.
- Fix P3: Persist `GameRun.xp_earned`, update `UserProgress` (XP, level, unlocks) on run finish.
- Fix P4: Upsert `ReviewItem` per user and question (unique `(user_id, question_id)`), avoiding duplicate entries.
- Fix P5: Fix any regression on 2-question generated dungeons.
- Fix P6: Configurable `COOKIE_SECURE` and `CORS_ORIGINS` list.
- Fix P7: Authoritative Run Score calculation: 100 normal, 150 hard, 50 room clear, 200 boss clear, 25 streak (every 3).
- Section A: Guest display names, moderation, 4-digit tags (`Raven#4821`), 30-day sliding session cookie, account upgrade (`POST /auth/upgrade`), `is_test` flag, and account deletion (`DELETE /auth/me`).
