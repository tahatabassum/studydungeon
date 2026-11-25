# StudyDungeon: Devpost Description

**Tagline:** Turn your study notes into a haunted dungeon. Answer to fight, miss and the monster bites back.

- Live demo: [FILL IN: Vercel URL]
- Demo video: [FILL IN: public YouTube URL]
- Repository: [FILL IN: public GitHub URL] (MIT license)
- Kiro write-up: [docs/KIRO_WRITEUP.md](KIRO_WRITEUP.md)

## Inspiration

Students reread notes and feel prepared, then freeze on the exam. Flashcard apps need you to write the cards first, and generic quiz generators make up questions that are not in your material. We wanted a game where your own notes are the level, and every question can be traced back to a quote in them.

## What it does

StudyDungeon is a browser-based learning RPG with a haunted dungeon theme.

- **Upload notes.** PDF, TXT, DOCX, PPTX, PNG and JPG/JPEG files are accepted. A relevance gate rejects files that are not study material and tells the user why.
- **Grounded questions.** The AI extracts 2 to 6 topics and writes 5 to 8 questions per topic. Each question carries an `evidence_quote` that the backend verifies as a verbatim substring of your notes, so fabricated quotes are dropped.
- **Rooms and monsters.** Topics become rooms and key concepts become monsters, with elites and a boss.
- **Server-authoritative combat.** The browser sends only the chosen option. The backend computes damage, HP, streaks, critical hits, score and XP. Weapons unlock as you progress (Rusty Dagger, Arcane Staff, Hunter Crossbow, Spectral Hammer, Flame Sigil).
- **Memories.** A wrong answer costs HP and is saved to Memories, a spaced-repetition queue due in 10 minutes. We do not re-ask it inside the same fight, so you cannot brute-force your way through.
- **Daily Haunt.** A daily review session built from the questions that are due.
- **Scorecard.** After a run you see accuracy, mastery bands (Weak, Learning, Strong) per topic, and your weakest concepts.
- **Leaderboard.** Players, including guests who pick a display name, appear on a shared leaderboard.
- **Guest demo.** "Try the Demo" plays a hand-crafted dungeon with no sign-up and zero AI calls. If the backend is asleep or unreachable, an offline fallback dungeon still plays.
- **Polished Halloween UI.** Phaser 3 scenes, sound effects, and a reduced-motion mode.

## How we built it

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, and Phaser 3 embedded in a dedicated `GameCanvas` component. Deployed on Vercel, which proxies `/api/*` so session cookies stay first-party.
- **Backend:** Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2.0 async, Alembic. Deployed on Render in a Docker image with Tesseract for OCR.
- **Database:** PostgreSQL on Supabase.
- **Auth and security:** Argon2 password hashing, signed HttpOnly SameSite cookies, rate-limited login, upload size limits, magic-byte checks and immediate temp-file cleanup. Uploaded text is treated as untrusted data in every prompt.
- **AI:** Google Gemini does relevance checks, topic extraction and question generation, with an OpenRouter fallback adapter. AI runs only during ingestion. Combat reads questions from our own database, so there is no AI latency in a fight.
- **Document parsing:** PyMuPDF, python-docx, python-pptx, Pillow and Tesseract.
- **Built with Kiro.** Work was organized as specs (requirements, design, tasks), with steering files as the contract between the backend and frontend owners, and hooks that run tests on save. Sub-agents ran tasks in parallel. Details are in [docs/KIRO_WRITEUP.md](KIRO_WRITEUP.md).

## Challenges we ran into

- **Hallucinated questions.** Early generations cited quotes that were not in the notes. Requiring a verbatim `evidence_quote` check against stored chunks fixed this.
- **Cold starts.** Render's free tier sleeps. We added a "Waking up the dungeon..." state and an offline demo fallback so judges never see a blank screen.
- **Cheating and trust.** Moving all combat math to the server meant the client is only an animation and input layer.
- **Learning loop design.** Re-asking wrong answers immediately turned fights into guessing. Sending them to Memories made the spaced-repetition loop meaningful.
- **Two people, one contract.** Backend and frontend were built in parallel, so API and game rules lived in steering files that neither side changed alone.
- **Free-tier AI quotas.** We kept the demo free of AI calls and added a provider fallback for generation.

## Accomplishments that we're proud of

- Every question in a generated dungeon can show the exact line of your notes it came from.
- A full guest demo that costs zero AI quota and still works offline.
- Server-authoritative combat with property-based tests for damage, evidence verification and several frontend invariants.
- A complete learning loop: upload, play, scorecard, Memories, Daily Haunt, leaderboard.
- A UI that respects reduced-motion preferences.

## What we learned

- Grounding beats cleverness: a strict check on quotes did more for quality than prompt tweaking.
- Putting authority on the server simplifies the client and removes a class of cheats.
- Property-based tests found real bugs in places we thought were trivial, such as input clamping and a lookup keyed on user-controlled codes.
- Specs and steering files keep two builders and several AI agents aligned.

## What's next

- Open-world movement between rooms and an inventory with cosmetics.
- Multiplayer and shared dungeons for study groups.
- Speech and audio questions.
- Better OCR for handwritten notes.
- Teacher-curated packs and class leaderboards.

## Built with

Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Supabase, React, TypeScript, Vite, Tailwind CSS, Phaser 3, Google Gemini, OpenRouter, PyMuPDF, Tesseract, Render, Vercel, Kiro.

## Try it

[FILL IN: live URL]. Click "Try the Demo". No account needed.
