# StudyDungeon — Coding Standards

## 1. Python & FastAPI Standards
- Strict type hinting across all modules (`from typing import Optional, List, Dict`).
- Pydantic v2 schemas for all request, response, and AI extraction payloads.
- Asynchronous database operations using SQLAlchemy 2.0 async session.
- Centralized custom HTTP exceptions returning unified error structures.
- No print statements; use structured logging via Python standard `logging`.
- Zero secrets in codebase: read strictly from environment variables via `pydantic-settings`.

## 2. Directory Separation
- `app/api/`: REST route handlers grouped by domain (auth, documents, dungeons, runs, progress).
- `app/core/`: Configuration, database engines, security helpers, and error handlers.
- `app/models/`: SQLAlchemy database entities.
- `app/schemas/`: Pydantic validation models.
- `app/services/`: Pure business logic (document extraction, combat calculations, spaced repetition).
- `app/ai/`: Gemini API integration and prompt orchestration.
- `app/demo/`: Seed scripts and offline fallback data.

