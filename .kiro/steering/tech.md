# StudyDungeon — Technical Specification

## 1. Stack Choices
- **Frontend App Shell:** React 18+ + TypeScript + Vite + Tailwind CSS.
- **Game Engine:** Phaser 3 (pinned version), embedded strictly inside a dedicated `GameCanvas` React component.
- **Backend Framework:** Python 3.11+ + FastAPI + Pydantic v2.
- **Database & ORM:** PostgreSQL (Neon / Supabase free tier) + SQLAlchemy 2.0 (asyncpg) + Alembic.
- **Authentication:** Argon2 password hashing (`argon2-cffi`), secure HttpOnly, SameSite cookie sessions.
- **Document Processing:** PyMuPDF (PDF), python-docx (DOCX), python-pptx (PPTX), Pillow + Tesseract OCR (Images).
- **AI Integration:** Google Gemini API (AI Studio free tier). OpenRouter adapter available behind a manual toggle; never auto-invoked.
- **Testing:** pytest, pytest-asyncio, httpx.

## 2. Hard Architectural Rules
1. **Server Authority:** The client browser sends only `question_id` and `selected_answer` (with `attempt_id`). Backend calculates and returns `damage_dealt`, `monster_hp`, `player_hp`, `score_delta`, and `xp_delta`.
2. **Zero In-Combat AI:** AI calls occur exclusively during document ingestion. Game combat queries local PostgreSQL questions.
3. **Data Scoping:** Every private resource query MUST include `user_id == current_user.id`.
4. **Environment Secrets:** Secrets (`GEMINI_API_KEY`, `SECRET_KEY`, `DATABASE_URL`) live in backend environment variables only. Frontend must NEVER have AI keys.

