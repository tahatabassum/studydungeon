# StudyDungeon Submission Checklist

## Repository Requirements
- [x] Person A Backend Domain completely implemented and tested (Owner: Person A)
- [x] Person B Frontend Domain completely implemented (Owner: Person B)
- [x] MIT License present in root with copyright holder preserved: "M Taha Tabassum" (Owner: Both)
- [x] `.kiro/` directory fully tracked in git without exclusions (Owner: Both)
- [x] Zero real secrets or database files committed in git tree (Owner: Both)
- [x] `.env.example` templates provided with placeholders only (Owner: Person A)

## Working Application & Deployment
- [x] FastAPI production container entrypoint runs migrations before uvicorn startup (Owner: Person A)
- [x] External PostgreSQL (Neon) compatibility with async SQLAlchemy (Owner: Person A)
- [x] End-to-end smoke verification script passing 100% of scenarios (Owner: Person A)
- [x] Frontend contract parity script and automated test passing (Owner: Person A)
- [x] "Try the Demo" zero-AI guest session playable without sign-up or LLM keys (Owner: Both)
- [x] Offline fallback demo JSON provided for frontend development (Owner: Person A)

## Human Action Items (Only the Humans Can Do)
- [x] Merge PR `feature/backend-02-ingestion` into `main` on GitHub (Owner: Human) — PR #8 & PR #9 merged
- [ ] Set up Neon PostgreSQL database and copy connection string (Owner: Human)
- [ ] Deploy Render web service with Docker runtime and configured env vars (Owner: Human)
- [ ] Deploy Vercel frontend with proxy rewrite rule and `VITE_USE_MOCKS=false` (Owner: Human)
- [ ] Run `python backend/scripts/live_gemini_check.py` with real API key to verify live Gemini (Owner: Human)
- [ ] Record 2-3 minute gameplay video showcasing retro dungeon combat and review (Owner: Human)
- [ ] Submit on Devpost before deadline: Dec 4, 2026, 2:00 PM PT (Dec 5 3:00 AM PKT), target Dec 3 (Owner: Human)
