# StudyDungeon Submission Checklist

## Repository Requirements
- [x] Person A Backend Domain completely implemented and tested (Owner: Person A)
- [x] Person B Frontend Domain completely implemented (Owner: Person B)
- [x] MIT License present in root with copyright holder preserved (Owner: Both)
- [x] `.kiro/` directory fully tracked in git without exclusions (Owner: Both)
- [x] Zero real secrets or database files committed in git tree (Owner: Both)
- [x] `.env.example` templates provided with placeholders only (Owner: Person A)

## Working Application & Deployment
- [x] FastAPI production container entrypoint runs migrations before uvicorn startup (Owner: Person A)
- [x] External PostgreSQL (Neon) compatibility with async SQLAlchemy (Owner: Person A)
- [x] End-to-end smoke verification script passing 100% of scenarios (Owner: Person A)
- [x] "Try the Demo" zero-AI guest session playable without sign-up or LLM keys (Owner: Both)
- [x] Offline fallback demo JSON provided for frontend development (Owner: Person A)

## Devpost & Documentation
- [x] Kiro activity log documenting all specs, break-it rounds, and bug fixes (Owner: Person A)
- [x] `docs/openapi.json` exported and up-to-date (Owner: Person A)
- [ ] Devpost writeup filled with authentic project journey (Owner: Both)
- [ ] Demo video recorded showcasing 2D dungeon combat and note generation (Owner: Person B)

