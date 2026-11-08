# Tasks: Backend 06 — Deployment Hardening & Integration Support

- [x] 1. Create production `backend/Dockerfile` with Debian-slim, system Tesseract OCR, and dynamic `$PORT` binding <!-- owner: backend; files: backend/Dockerfile; test: backend/Dockerfile -->
- [x] 2. Configure `alembic.ini` and `migrations/env.py` wired to `settings.DATABASE_URL` and `Base.metadata` <!-- owner: backend; files: backend/alembic.ini, backend/migrations/env.py; test: tests/test_auth.py -->
- [x] 3. Generate initial migration and verify upgrade head execution <!-- owner: backend; files: backend/migrations/versions/6355c67fe08b_initial_migration.py; test: tests/test_auth.py -->
- [x] 4. Configure `pyproject.toml` with strict Ruff rules and pass `ruff check .` with zero errors <!-- owner: backend; files: backend/pyproject.toml; test: tests/test_health.py -->
- [x] 5. Set up `.dockerignore` and root `.gitignore` protecting `.kiro/` and ignoring `.env`/`*.db` <!-- owner: backend; files: .gitignore, backend/.dockerignore; test: .gitignore -->
- [ ] 6. Implement script `backend/scripts/export_openapi.py` exporting static `docs/openapi.json` for frontend TypeScript types <!-- owner: backend; files: backend/scripts/export_openapi.py, docs/openapi.json; test: docs/openapi.json -->
- [ ] 7. Implement end-to-end backend smoke script covering the full player lifecycle <!-- owner: backend; files: backend/scripts/smoke_test.py; test: backend/scripts/smoke_test.py -->
- [ ] 8. Verify CORS and SameSite=Lax cookie headers when deployed behind Vercel edge proxy <!-- owner: backend; files: backend/app/main.py; test: tests/test_auth.py -->

