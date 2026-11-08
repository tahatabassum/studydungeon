# StudyDungeon Deployment & Operational Checklist

This guide specifies operational guidelines, dashboard steps, and deployment runbooks for hosting the StudyDungeon backend.

## 1. Hosting Architecture Overview
- **Backend API**: Hosted on Render as a Docker Web Service.
- **Database**: Managed Serverless PostgreSQL on Neon (`neon.tech`).
- **Frontend & Proxy**: Vercel hosting the React/Phaser static app, rewriting `/api/*` to Render.

---

## 2. Manual Dashboard Steps

### A. Neon Database Setup
1. Log into [Neon Console](https://console.neon.tech).
2. Create a new project: `studydungeon-prod` (PostgreSQL 16, Region: us-east-2 or closest to Render).
3. Copy the connection string. Neon provides connection strings in format:
   `postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. StudyDungeon automatically normalizes this connection string to `postgresql+asyncpg://` and strips unsupported parameters.

### B. Render Web Service Deployment
1. Log into [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service** -> Connect GitHub repository `tahatabassum/studydungeon`.
3. Choose **Docker** environment:
   - **Docker Command / Context**: `backend`
   - **Dockerfile Path**: `backend/Dockerfile`
   - **Branch**: `main` (after merging PR)
4. In **Environment Variables**, configure:
   - `DATABASE_URL`: *(Neon connection string)*
   - `SECRET_KEY`: *(Generate a 32+ character random secret string)*
   - `AI_PROVIDER`: `gemini`
   - `GEMINI_MODEL`: `gemini-2.0-flash`
   - `GEMINI_API_KEY`: *(Your Google AI Studio Gemini API Key)*
   - `FRONTEND_ORIGIN`: `https://studydungeon.vercel.app`
   - `TRUSTED_PROXY_COUNT`: `1`
   - `DEMO_RATE_LIMIT_PER_HOUR`: `60`
   - `DEMO_GUEST_TTL_HOURS`: `24`
   - `MAX_UPLOAD_MB`: `15`
   - `DEBUG`: `false`
5. Click **Deploy Web Service**.

### C. Vercel Frontend Deployment
1. Import repository into [Vercel](https://vercel.com).
2. Set root directory to `frontend`.
3. Configure `vercel.json` rewrites:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://<your-render-app>.onrender.com/:path*" }
     ]
   }
   ```
4. Set environment variables:
   - `VITE_API_BASE`: `/api`
   - `VITE_USE_MOCKS`: `false`
5. Deploy.

---

## 3. Reverse Proxy & Security Configuration
- **`TRUSTED_PROXY_COUNT` & Debugging**:
  - StudyDungeon extracts the client IP address by counting hops from the *right* of the `X-Forwarded-For` header.
  - Set `TRUSTED_PROXY_COUNT=1` if running directly behind Vercel or Cloudflare.
  - Set `TRUSTED_PROXY_COUNT=2` if requests pass through both Vercel and Render's internal load balancer before reaching the container.
  - *Measuring the right count:* Set `DEBUG=true` in Render temporarily. The backend will log:
    `"Proxy hop check: total_hops=2, configured_trusted_hops=1"`. Turn `DEBUG=false` off afterwards.
- **Cookies & CORS**:
  - Session cookies use `HttpOnly=True`, `SameSite="lax"`, and `Secure=True` in production.
  - `FRONTEND_ORIGIN` must match the Vercel domain; CORS allows credentials.

---

## 4. Cold Start & Health Monitoring
- **Health Endpoints**:
  - `GET /health`: Instant, DB-free status check used by Docker and proxy healthchecks.
  - `GET /health/ready`: Checks DB connectivity via `SELECT 1`.
- **Mitigating Free Tier Sleep**:
  - Render free tier spins down after 15 minutes of inactivity.
  - Ping `GET /health` every 10 minutes via BetterStack, UptimeRobot, or Cloudflare Health Checks.

---

## 5. Docker Local Build Verification (Note on Local Agent Environment)
*Note:* The agent environment does not have a local Docker daemon installed. To build and test the container locally on your host:
```bash
# From repository root
docker build -t studydungeon-backend:latest -f backend/Dockerfile backend

# Run container locally with SQLite or Neon Postgres
docker run -d \
  --name studydungeon-api \
  -p 8000:8000 \
  -e PORT=8000 \
  -e DATABASE_URL="sqlite+aiosqlite:///./studydungeon.db" \
  -e AI_PROVIDER="mock" \
  -e SECRET_KEY="local-test-secret-key-32-characters-min" \
  studydungeon-backend:latest
```

---

## 6. Post-Deploy Verification Checklist
- [ ] `curl -i https://<your-render-app>.onrender.com/health` returns HTTP 200 `{"status": "healthy"}`
- [ ] `curl -i https://<your-render-app>.onrender.com/health/ready` returns HTTP 200 `{"status": "ready", "database": "connected"}`
- [ ] `curl -i -X POST https://<your-render-app>.onrender.com/demo/session` sets `Set-Cookie: studydungeon_session=...; HttpOnly; SameSite=lax`
- [ ] Visit frontend on Vercel, click "Try Demo", verify retro game loads without CORS errors.
