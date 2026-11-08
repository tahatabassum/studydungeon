# Tasks: Backend 05 — Demo Dungeon Seed & "Try the Demo" Backend

- [x] 1. Define synthetic "How a Computer Works" 4-room dungeon dataset with verbatim citations <!-- owner: backend; files: backend/app/demo/seed.py; test: tests/test_demo.py -->
- [x] 2. Implement idempotent `seed_demo_dungeon` creating system user, demo document, and public dungeon <!-- owner: backend; files: backend/app/demo/seed.py; test: tests/test_demo.py -->
- [x] 3. Implement `backend/scripts/export_sample.py` exporting `docs/handoff/demo_dungeon.sample.json` <!-- owner: backend; files: backend/scripts/export_sample.py; test: tests/test_demo.py -->
- [x] 4. Implement `POST /demo/session` creating guest user with 24h TTL and session cookie <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_demo.py -->
- [x] 5. Implement lazy expired-guest purging triggered on `POST /demo/session` <!-- owner: backend; files: backend/app/api/auth.py; test: tests/test_demo.py -->
- [x] 6. Create standalone CLI cleanup script `scripts/purge_guests.py` <!-- owner: backend; files: backend/scripts/purge_guests.py; test: tests/test_demo.py -->
- [x] 7. Wire `seed_demo_dungeon` execution into application deployment lifecycle <!-- owner: backend; files: backend/app/main.py; test: tests/test_demo.py -->
- [x] 8. Add GitHub Actions scheduled cron workflow `.github/workflows/purge-guests.yml` <!-- owner: backend; files: .github/workflows/purge-guests.yml; test: tests/test_demo.py -->

