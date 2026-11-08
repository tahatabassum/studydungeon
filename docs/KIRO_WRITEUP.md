# Kiroween 2026 Devpost Hackathon Write-up

## 1. Inspiration
Studying textbook excerpts and dense lecture notes with traditional digital flashcards is uninspiring. We wanted to fuse classic retro dungeon crawlers (Pokemon/Zelda) with rigorous active recall spaced repetition, turning exam revision into an engaging gothic RPG quest.

## 2. What It Does
StudyDungeon ingests student lecture notes (PDFs, DOCX, PPTX, TXT, images) and uses Google Gemini to cluster the notes into 2 to 6 topic rooms. Each room manifests a monster whose HP is depleted by answering grounded multiple-choice questions. In-game combat is strictly authoritative on the FastAPI backend: correct answers unleash weapon damage and streak criticals, while wrong answers deal player damage and schedule the question into a deterministic spaced repetition ladder.

## 3. How We Built It
- **Backend (Person A):** FastAPI, SQLAlchemy 2.0 (async), Alembic migrations, Argon2 password hashing, and Google Gemini API (with deterministic fallback).
- **Frontend & Game Engine (Person B):** React 18, TypeScript, Tailwind CSS, and Phaser 3 rendering retro 2D pixel art dungeons, procedural rooms, and combat animations.
- **Security & Integrity:** Session cookies with SameSite/HttpOnly flags, DB-backed rate limiting, and zero-hallucination evidence quotes verified verbatim against source chunk text.

## 4. Challenges We Ran Into
- Balancing game damage formulas while strictly adhering to deterministic game design rules (never letting AI decide combat damage or review dates).
- Neutralizing prompt injection vectors embedded inside student notes through strict system instructions.
- Handling client IP spoofing across proxy layers (Vercel rewrite -> Render) solved via trusted proxy hop offsets.

## 5. Accomplishments That We're Proud Of
- 100% test pass rate across 67 unit, integration, and Hypothesis property-based tests.
- Zero-AI "Try the Demo" guest experience allowing hackathon judges to immediately play the game without sign-up or Gemini API quotas.
- Clean separation of team ownership between Person A and Person B.

## 6. What We Learned
- Designing authoritative game state architectures in FastAPI with append-only attempt logs.
- Crafting resilient document extraction pipelines with PyMuPDF, python-docx, and python-pptx.

## 7. What's Next for StudyDungeon
- Collaborative multiplayer study dungeons where classmates team up to fight a shared final exam boss.
- Anki and Quizlet deck bidirectional synchronization.
- Custom pixel-art sprite unlocks for mastery milestones.

## 8. Built With
- FastAPI
- Google Gemini API
- Phaser 3
- React
- SQLAlchemy & Alembic
- Python 3.11
- TypeScript
- Docker

