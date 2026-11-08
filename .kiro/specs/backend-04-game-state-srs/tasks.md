# Tasks: Backend 04 — Authoritative Game State & Spaced Repetition (SRS)

- [x] 1. Implement deterministic combat damage calculations with weapon baselines, hard multipliers, and streak criticals <!-- owner: backend; files: backend/app/services/combat.py; test: tests/test_combat.py -->
- [x] 2. Implement SM-2 interval calculator (10 min wrong reset, 1d hard, 3d/7d/14d/30d progression) <!-- owner: backend; files: backend/app/services/combat.py; test: tests/test_combat.py -->
- [ ] 3. Add Property-Based Test (PBT) asserting damage bounds and SRS interval monotonicity <!-- owner: backend; files: backend/tests/test_combat.py; test: tests/test_combat.py -->
- [ ] 4. Implement `POST /runs` enforcing the guest rule (guests may play ONLY dungeons where `is_public_demo=true`) <!-- owner: backend; files: backend/app/api/runs.py; test: tests/test_runs.py -->
- [ ] 5. Implement `GET /runs/{id}` allowing students/guests to resume active run state after browser reload <!-- owner: backend; files: backend/app/api/runs.py; test: tests/test_runs.py -->
- [ ] 6. Implement `POST /runs/{id}/attempts` with client UUID `attempt_id` idempotency deduplication <!-- owner: backend; files: backend/app/api/runs.py; test: tests/test_runs.py -->
- [ ] 7. Add Property-Based Test (PBT) asserting attempt idempotency under duplicate submissions <!-- owner: backend; files: backend/tests/test_runs.py; test: tests/test_runs.py -->
- [ ] 8. Implement `POST /runs/{id}/rooms/{room_id}/clear` awarding room bonus XP and score <!-- owner: backend; files: backend/app/api/runs.py; test: tests/test_runs.py -->
- [ ] 9. Implement `POST /runs/{id}/finish` calculating end-of-run scorecard with Weak/Learning/Strong mastery bands <!-- owner: backend; files: backend/app/api/runs.py; test: tests/test_runs.py -->
- [ ] 10. Implement `GET /progress` and `GET /reviews/due` endpoints <!-- owner: backend; files: backend/app/api/progress.py, backend/app/api/reviews.py; test: tests/test_reviews.py -->

