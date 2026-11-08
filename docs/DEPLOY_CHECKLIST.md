# StudyDungeon Deployment & Operational Checklist

This guide specifies operational guidelines and deployment runbooks for hosting the StudyDungeon backend.

## 1. Hosting Architecture Overview
- **Backend API**: Hosted on Render / Railway / Fly.io container services running Docker.
- **Database**: Managed Serverless PostgreSQL (e.g. Neon, Supabase, or AWS RDS Aurora).
- **Reverse Proxy**: Cloudflare / Vercel Edge proxy forwarding requests to the container.

---

## 2. Reverse Proxy & Security Configuration
- **`TRUSTED_PROXY_COUNT`**:
  - StudyDungeon resolves the genuine client IP address by counting hops from the *right* of the `X-Forwarded-For` header.
  - Set `TRUSTED_PROXY_COUNT=1` if running directly behind Vercel or Cloudflare.
  - Set `TRUSTED_PROXY_COUNT=2` if requests pass through both Vercel and Render's internal load balancer before reaching the container.
- **CORS & Credentials**:
  - Ensure `FRONTEND_ORIGIN` matches the exact frontend domain (e.g., `https://studydungeon.vercel.app`).
  - Keep `allow_credentials=True` enabled on FastAPI CORS middleware to allow httpOnly session cookies to persist across cross-origin calls.
- **Cookie SameSite / Secure Flags**:
  - In production (`https://`), session cookies are marked `secure=True`, `httponly=True`, `samesite="lax"`.

---

## 3. Cold Start & Health Monitoring
- **Health Check Endpoint**: `GET /health` returns `{"status": "ok", "timestamp": "...", "version": "1.0.0"}`.
- **Cold-Start Mitigation**:
  - Configure uptime monitoring (e.g. BetterStack, UptimeRobot, or Cloudflare Health Checks) to ping `GET /health` every 5–10 minutes to keep serverless container instances warm.

---

## 4. Docker Build & Execution Runbook

### Build the Image
```bash
docker build -t studydungeon-backend:latest ./backend
```

### Run Locally / Staging
```bash
docker run -d \
  --name studydungeon-api \
  -p 8000:8000 \
  -e PORT=8000 \
  -e DATABASE_URL="postgresql+asyncpg://postgres:password@db.example.internal:5432/studydungeon" \
  -e AI_PROVIDER="gemini" \
  -e GEMINI_MODEL="gemini-2.0-flash" \
  -e GEMINI_API_KEY="AIzaSy..." \
  -e SECRET_KEY="very-long-production-secret-key-min-32-chars" \
  -e FRONTEND_ORIGIN="https://studydungeon.vercel.app" \
  -e TRUSTED_PROXY_COUNT=1 \
  studydungeon-backend:latest
```

### Container Startup Lifecycle
The container's entrypoint executes:
1. `alembic upgrade head`: Runs all pending schema migrations.
2. `python -m app.demo.seed`: Seeds the public demo dungeon and demo admin accounts if they do not exist.
3. `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`: Launches the production ASGI server.
