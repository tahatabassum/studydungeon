# Kiroween 2026 Devpost Hackathon Write-up

## 1. Inspiration
Studying dense academic notes and textbook chapters with traditional flashcard apps often feels repetitive. We wanted to fuse classic retro dungeon crawlers (Pokemon/Zelda) with rigorous active recall spaced repetition, turning revision into an engaging gothic RPG adventure.

## 2. What It Does
StudyDungeon ingests student study notes (PDFs, DOCX, PPTX, TXT, images) and clusters them into 2 to 6 topic rooms. Each room features an academic monster whose HP is depleted by answering grounded multiple-choice questions. In-game combat is strictly authoritative on the FastAPI backend: correct answers unleash weapon damage and streak criticals, while wrong answers deal player damage and schedule the question into a deterministic spaced repetition ladder.

## 3. How We Built It
- **Backend & AI Architecture (Person A):** FastAPI, SQLAlchemy 2.0 (asyncio), Alembic migrations, Argon2id password hashing, and Google Gemini 2.0 multimodal vision API (with deterministic offline mock provider for automated testing).
- **Frontend & Game Engine (Person B):** React 18, TypeScript, Tailwind CSS, and Phaser 3 rendering retro 2D pixel art dungeons, procedural rooms, and combat animations.
- **Deterministic RPG Authority:** The AI strictly extracts study chunks and proposes candidate questions with verbatim evidence citations. The backend Python engine authoritatively computes all combat damage, streak multipliers, weapon unlocks, XP progression, and SRS review intervals. The AI never decides HP, XP, damage, or review intervals.
- **Security & Integrity:** Session cookies with SameSite/HttpOnly flags, database-backed rate limiting, reverse-proxy spoofing protections via right-hand IP hop offsets, and zero-hallucination evidence quotes verified verbatim against source chunk text.

## 4. Kiro Features Used
- **Kiro Specs (`.kiro/specs/`):** Guided development across all backend and frontend milestones with formal `requirements.md`, `design.md`, and `tasks.md` documents.
- **Kiro Steering (`.kiro/steering/`):** Established immutable team architectural contracts (`api-contract.md`, `game-design.md`, `tech.md`, `security-and-uploads.md`, `team-ownership.md`).
- **Kiro Automated Hooks (`.kiro/hooks/`):** Automated test runs on save (`backend-test-on-save.json`).
- *Other Kiro Features:* Not used.

## 5. Challenges We Ran Into
- Enforcing deterministic combat math and spaced repetition schedules so that game balance and review dates remain strictly authoritative and never subject to LLM non-determinism.
- Sanitizing and handling diverse student note formats (multi-page scanned PDFs, DOCX, PPTX) while strictly blocking prompt injection attempts embedded in uploaded files.
- Preventing IP-spoofing attacks behind reverse proxies through right-offset hop resolution.

## 6. Accomplishments That We're Proud Of
- 100% test pass rate across 82 unit, integration, and Hypothesis property-based tests.
- Zero-AI "Try the Demo" guest experience allowing hackathon judges to immediately play the game without sign-up or Gemini API quotas.
- Clean separation of team ownership between Person A and Person B.

## 7. What We Learned
- Designing authoritative game state architectures in FastAPI with append-only attempt logs.
- Crafting resilient document extraction pipelines with PyMuPDF, python-docx, and python-pptx.

## 8. What's Next for StudyDungeon
- Collaborative multiplayer study dungeons where classmates team up to fight a shared final exam boss.
- Anki and Quizlet deck bidirectional synchronization.
- Custom pixel-art sprite unlocks for mastery milestones.

## 9. Built With
- FastAPI
- Google Gemini API
- Phaser 3
- React
- SQLAlchemy & Alembic
- Python 3.11
- TypeScript
- Docker
