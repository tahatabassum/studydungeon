# Design: Backend 06 — Deployment Hardening & Integration Support

## 1. Modules & Configuration
- `backend/Dockerfile`: Minimal Debian-slim container with system Tesseract OCR and uvicorn server.
- `backend/alembic.ini` & `backend/migrations/env.py`: Production-safe migrations reading `DATABASE_URL`.
- `backend/pyproject.toml`: Strict Ruff and Pytest settings.
- `docs/openapi.json`: Static OpenAPI contract export for Person B's TypeScript generator.
- `scripts/export_openapi.py`: Script to generate updated `docs/openapi.json`.

## 2. Hardening, Security & Infrastructure
1. **Free-Tier Deployment Topology:**
   - **Render Web Service:** Runs Docker container with `PORT` binding.
   - **Neon Serverless PostgreSQL:** Async connections with connection pooling.
   - **Vercel Frontend Proxy:** Rewrites `/api/*` to Render, maintaining Same-Origin session cookies.
2. **Cold-Start Management:**
   - Free instances spin down after 15 min of inactivity.
   - Frontend displays 8-second waking state, then enables offline demo mode if server does not respond.
   - Lightweight `GET /health` endpoint for uptime monitoring (e.g., via Cron-Job.org / UptimeRobot).
3. **Database Security:**
   - Connection string read securely from environment variables.
   - Zero local SQLite reliance in production.
   - All migrations tracked via Alembic version table.

## 3. Implementation Status
- **Implemented:**
  - Production `Dockerfile` with system dependencies.
  - `alembic.ini` and `migrations/env.py` configured for both SQLite (test) and PostgreSQL (prod).
  - Initial migration `6355c67fe08b_initial_migration.py`.
  - `.dockerignore` and `.gitignore` properly excluding caches and secrets.
  - Ruff linter setup passing with 0 warnings.
- **Missing / Pending:**
  - Script to export static `docs/openapi.json`.
  - Full end-to-end integration smoke script verifying: Register -> Ingestion -> Dungeon -> Combat -> Scorecard.
  - Deployment configuration documentation and live health checks.

## 4. Test Strategy
- Multi-user isolation verification tests.
- Docker build test.
- OpenAPI schema validation.

