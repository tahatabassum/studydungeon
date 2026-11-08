# StudyDungeon — Devpost Submission Description

## Elevator Pitch
StudyDungeon turns your dry textbook chapters and lecture slides into a retro gothic dungeon crawler. Face off against monstrous manifestations of academic topics, deplete their health by answering grounded multiple-choice questions, and defeat the final exam boss — all powered by an authoritative spaced repetition combat engine.

## Problem
Studying dense academic notes with traditional flashcard apps feels tedious and repetitive. Students quickly burn out on passive review, leading to cramming and low long-term retention.

## Solution: The StudyDungeon Experience
1. **Upload Study Materials**: Drop in lecture notes (PDFs, DOCX, PPTX, TXT, or scanned diagrams).
2. **AI Clustering into Topic Rooms**: The model named in the `GEMINI_MODEL` environment variable analyzes and groups the content into 2 to 6 thematic dungeon chambers, each guarded by a monster.
3. **Deterministic RPG Combat**:
   - Answer correctly to deal weapon damage and build critical streak multipliers.
   - Answer incorrectly to suffer player damage and reset your streak.
   - **Spaced Repetition Integration**: Wrong answers are automatically scheduled for retry in 10 minutes; difficult correct answers review in 1 day; confident answers advance across 3, 7, 14, and 30 days.
4. **Authoritative Fairness**: The AI never decides combat damage, HP, XP, or review dates. The Python backend calculates everything authoritatively from verifiable rules.
5. **Instant Guest Demo**: Hackathon judges can jump straight into the gothic dungeon without creating an account or providing API keys.

## Tech Stack
- **Backend (Person A)**: FastAPI, Python 3.11, SQLAlchemy 2.0 (asyncio), PostgreSQL / SQLite, Alembic migrations, Argon2id security.
- **AI & Multimodal Ingestion (Person A)**: The model named in the `GEMINI_MODEL` environment variable (a Google AI Studio API key — free tier works), PyMuPDF, python-docx, python-pptx, Pillow, Tesseract OCR.
- **Frontend & Game Engine (Person B)**: React 18, TypeScript, Tailwind CSS, Phaser 3 for 2D retro pixel-art rendering.
- **Deployment**: Docker containerization on Render with Serverless Neon PostgreSQL and Vercel proxy.

## Seeded vs. AI-Generated
- **Public Demo Dungeon**: Completely seeded and pre-grounded with authentic computer architecture topics (ALU, Pipelining, Cache Memory, Branch Prediction Boss). Works 100% offline with zero external API calls.
- **Custom Dungeons**: Generated on-demand by the model named in the `GEMINI_MODEL` environment variable using multimodal processing from student uploads, citing verbatim evidence quotes from source notes.

## Honest Limitations
- Free-tier cloud hosts (Render) take 30–50 seconds to wake from cold sleep.
- OCR on low-contrast or illegible handwriting may require manual verification.

