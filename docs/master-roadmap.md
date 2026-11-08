# STUDYDUNGEON Complete Product, Game, AI & Kiro Build Roadmap

A browser-based adaptive learning RPG that turns a student's own notes into a playable haunted dungeon.

**KIROWEEN 2026 • FRANKENSTEIN CATEGORY**

Prepared for a two-person team | Target: 14–18 days | Zero personal spending target

| Build principle | Decision |
|---|---|
| Ship a real game, not a quiz dashboard | Phaser 2D dungeon embedded in a React app |
| Protect the deadline | One polished playable dungeon loop first; optional features only after it works |
| AI is for learning content | AI parses, classifies and generates questions; deterministic code runs combat and scoring |
| Keep it free to demo | Free-tier services and quotas; never depend on paid OpenRouter calls |

Version: 1.0 | Date: 6 November 2026

This document is a practical implementation plan. It intentionally separates the must-build MVP from stretch features so the team can finish a stable, judge-ready project within the available time.

---

## 1. Executive Summary

StudyDungeon transforms a student's notes into a themed, interactive 2D dungeon. Each dungeon room represents a topic. Monsters represent concepts. The player answers questions to attack; correct answers damage the monster, while incorrect answers cost health and are recorded for later revision. At the end, the student receives a scorecard showing accuracy, topic mastery and concepts that need another attempt.

### The core player journey

**[UPDATED: demo]** A visitor can click *Try the Demo* on the landing page without registering; the backend creates a temporary guest session and opens the seeded demo dungeon immediately.

A visitor may instead create an account using a unique username and password.

**[UPDATED: demo]** For a guest, skip upload and AI generation: play the shared, reviewed seeded dungeon, answer questions, finish the run and view a scorecard. Guest progress is temporary and the guest account expires after about 24 hours.

1. Upload a study document (PDF, TXT, DOCX, PPTX, PNG or JPG/JPEG).
2. StudyDungeon validates the file, extracts text/visual content and checks whether it is relevant study material.
3. The AI identifies subjects, topics and concepts, then generates a small, source-grounded question bank.
4. The student sees a dungeon map with rooms for the topics found in the document.
5. The student enters a room, encounters a monster and answers questions to attack.
6. After the dungeon, the app saves progress and displays a scorecard, weak topics and spaced-repetition review dates.
7. On the next visit, the student can continue the dungeon or revisit concepts that were previously difficult.

### What makes it a Frankenstein project?

The integration is the story: document understanding turns notes into structured knowledge; retrieval grounds questions in those notes; game mechanics turn recall into combat; spaced repetition uses the player's history to decide what returns; analytics show what the student actually knows. The technologies form one learning loop rather than a collection of unrelated features.

### MVP success definition

- A new user can register, log in and see only their own data.
- At least PDF, TXT and DOCX work reliably; PPTX and image support are included if the extraction tests pass.
- Irrelevant or unreadable uploads are rejected with a useful explanation.
- A document can produce at least 2–5 topic rooms and a playable question-based dungeon.
- A correct answer visibly damages a monster; a wrong answer visibly damages the player.
- A finished run saves a scorecard and updates review scheduling.
- **[UPDATED: demo]** The app is deployed; a seeded demo dungeon is playable instantly without sign-up, without AI-provider calls, and with a clearly labeled offline fallback if the backend cannot wake promptly.

---

## 2. Recommended Technology Stack

| Layer | Recommended choice | Why this choice |
|---|---|---|
| Web shell / app UI | React + TypeScript + Vite | Fast iteration; use React for login, upload, dashboard, settings and results. |
| Game engine | Phaser 3 (2D) | Purpose-built HTML5 game framework; handles sprites, scenes, input, tweens, tilemaps, audio and collisions. |
| Styling | Tailwind CSS + CSS variables | Fast consistent UI styling; build reusable cards, dialogs, HUD and responsive layouts. |
| Game assets | Kenney / OpenGameArt / self-made SVG UI | Use properly licensed assets; do not spend days drawing every sprite. |
| API backend | Python + FastAPI | Good fit for file processing, AI orchestration and typed API contracts. |
| Database | PostgreSQL + SQLAlchemy 2.x + Alembic | Persistent user accounts, documents, questions, attempts, runs and review schedule. |
| AI provider | Gemini API via Google AI Studio | Primary model provider; free-tier quotas vary by model/project and can change. |
| Fallback provider | OpenRouter behind a manual provider switch | Use the $4 credit only for controlled testing or emergency demo fallback; do not auto-fallback on every error. |
| PDF processing | PyMuPDF | Extract text page-by-page; detect low-text scanned pages for OCR. |
| DOCX processing | python-docx | Extract paragraphs and tables from modern Word documents. |
| PPTX processing | python-pptx | Extract slide text and notes where available; optionally render slide images for vision processing. |
| Images / OCR | Pillow + Tesseract OCR; Gemini vision for difficult diagrams | OCR text in images; vision can interpret diagrams but must return source/image references. |
| Authentication | FastAPI custom username/password + Argon2 hash + signed session/JWT | Meets username-only login without storing plaintext passwords. |
| Deployment | Vercel static frontend + Render/Fly/Koyeb-style Python host + Neon Postgres | Choose the host whose current free plan is available to your accounts; test cold starts and storage limits. |

> **Important:** use Phaser inside a React page, not as a replacement for the entire application. React owns the surrounding product UI; Phaser owns the interactive play area. Keep the Phaser canvas mounted in one dedicated `GameCanvas` component and communicate through typed events.

### Why Phaser instead of Three.js, Unity or pure React?

Phaser is a 2D browser game framework; it already provides the scene lifecycle, sprites, animations, input, camera, audio, tweens and arcade physics you need. Three.js is mainly a 3D rendering library. A 3D game would add art, camera, lighting and performance work without improving the learning loop enough for this deadline. Unity/Godot web exports add a larger toolchain and deployment surface. Avoid them for this 2–3 week browser-first build. Pure React can draw a simple quiz UI, but it is not a game engine. Phaser gives you an actual playable scene.

**Version decision:** pin one tested Phaser 3.x version in `package.json` and do not upgrade mid-project. The official Phaser docs also publish React/Vite templates; verify the template's Phaser major version before copying code so your team does not mix Phaser 3 and Phaser 4 APIs.

---

## 3. Game Design: What the Player Actually Does

### Recommended game format: room-based top-down dungeon

Do not attempt a large open-world RPG. Build a compact top-down dungeon with 4–6 connected rooms, a visible player character, monsters, doors, treasure chests and a final boss. Movement can be keyboard-first, with a click/tap interaction fallback. The game should be easy to understand in the first 20 seconds.

| Element | MVP behaviour |
|---|---|
| Dungeon map | One generated dungeon per uploaded document; each room is a topic. |
| Player | Move with WASD or arrow keys; interact with a nearby monster/door using E or Space. |
| Monster encounter | Monster appears, intro animation plays, then a question panel opens. Answering MCQ first; True/False as a second question type. Free-text grading is stretch. |
| Correct answer | Play attack animation; weapon projectile/effect hits monster; monster HP decreases. |
| Wrong answer | Monster attacks; player HP decreases; concept is marked for review. |
| Room clear | Monster defeated; room gate opens; XP/coins are awarded. |
| Boss room | Final monster uses mixed questions from multiple topics. |
| End screen | Show results, mastery by topic, wrong concepts and next review dates. |

### Game loop

```
LOBBY -> UPLOAD / SELECT NOTES -> DUNGEON MAP -> ENTER TOPIC ROOM
-> MONSTER ENCOUNTER -> QUESTION -> ANSWER
    correct: weapon attack -> monster HP down -> XP
    wrong:   monster attack -> player HP down -> review queue
-> monster defeated? -> room cleared -> next room
-> boss defeated / player defeated -> RESULTS
-> save run + attempts + review schedule -> DASHBOARD
```

### Weapons and damage system

Weapons should make combat feel satisfying, but avoid complex action combat. The answer determines whether the attack lands; weapon type changes the animation and damage value. This keeps the learning outcome central and makes balancing straightforward.

| Weapon | Unlock | Base damage | Visual effect / use |
|---|---|---|---|
| Rusty Dagger | Starting weapon | 20 | Quick slash; starter weapon. |
| Arcane Staff | Reach 100 XP | 25 | Purple magic bolt; default ranged attack. |
| Hunter Crossbow | Clear 2 rooms | 30 | Fast arrow projectile; crisp hit effect. |
| Spectral Hammer | Reach level 3 | 35 | Heavy impact; slower animation. |
| Flame Sigil | Defeat first boss | 40 | Short fire burst; rare reward. |

Keep damage deterministic. Suggested rule: normal correct answer = weapon base damage; correct answer on a hard question = base damage × 1.25; 3 correct answers in a row = one critical hit × 1.5. Cap damage and round to an integer. A wrong answer does not damage the monster; the monster deals a fixed 10–15 damage to the player.

### Question difficulty and monster health

| Encounter | Monster HP | Question pool | Reward |
|---|---|---|---|
| Room monster | 60–100 | 3–5 questions from one topic | 25 XP + coins |
| Elite monster | 120–160 | 5–7 medium/hard questions | 50 XP + weapon progress |
| Dungeon boss | 220–300 | 6–8 mixed-topic questions | 100 XP + boss badge |

Tune these numbers after a playtest. A room should take roughly 1–3 minutes. A full 4-room dungeon should be finishable in 8–12 minutes.

### Player health and fail state

Start each dungeon with 100 HP. A wrong answer costs 10 HP; boss/elite encounters may cost 12 HP. At 0 HP, show a defeat screen with a retry option. Do not delete progress or punish the learner outside that run. Optionally offer one potion per dungeon that restores 25 HP. Keep consumables cosmetic/simple in MVP.

### Scoring and progression

| Metric | Suggested rule |
|---|---|
| Answer points | +100 correct; +150 hard correct; 0 incorrect. |
| Streak bonus | +25 after 3 consecutive correct answers; reset streak after a wrong answer. |
| Room clear | +50 points and XP bonus. |
| Boss clear | +200 points. |
| Accuracy | correct answers / total answered × 100. |
| Topic mastery | weighted from recent attempts: 0–100; display as weak / learning / strong. |
| XP / level | Level 1 starts at 0 XP; next level threshold can be 100 × current level. |
| Coins | Earn for rooms and boss; cosmetic weapon skins can be stretch features. |

Do not make score depend mainly on speed. Students should not be encouraged to rush through learning. You can record time as a statistic, but correctness and retention should matter more.

---

## 4. Levels, Rooms and Progression

### Document-to-dungeon mapping

- One uploaded document becomes one StudyDungeon source.
- AI identifies 2–6 main topics.
- Merge tiny or duplicate topics; do not create a room for every paragraph.
- Each topic becomes a room.
- A topic's key concepts become monsters or question groups.
- The final boss draws questions from multiple topics to test whether the student can connect ideas.
- If a document has only one usable topic, create one room plus a mini-boss rather than inventing unrelated topics.

### Suggested first dungeon

| Room | Theme | Learning purpose | Monster example |
|---|---|---|---|
| 01 – The Entry Hall | Abandoned library | Core definitions | Paper Wraith |
| 02 – The Alchemist's Lab | Potion room | Processes / steps | Toxic Slime |
| 03 – The Clockwork Crypt | Mechanical room | Comparisons / relationships | Gear Golem |
| 04 – The Forgotten Wing | Dark archive | Difficult / weak concepts | Memory Eater |
| Boss – The Exam Warden | Throne room | Mixed-topic recall | The Exam Warden |

### Long-term progression

- Dungeon completion unlocks the next dungeon or a harder difficulty setting.
- XP levels are account-wide; each dungeon run has its own health and score.
- Review queue brings back questions the student missed or found difficult.
- A concept becomes 'mastered' only after repeated correct attempts across separate sessions, not after one lucky answer.
- Use simple mastery bands initially: 0–49 Weak, 50–79 Learning, 80–100 Strong. Keep the exact numeric score visible in the results detail.
- Stretch: daily quest, cosmetics, inventory, character selection, multiple biomes, story dialogue, multiplayer leaderboard. None of these should delay the first complete playable loop.

---

## 5. AI Document Ingestion and Relevance Guardrails

### Supported upload formats for the hackathon

| Format | Processing route | MVP status |
|---|---|---|
| .pdf | PyMuPDF text extraction per page; OCR scanned pages; retain page number. | Must-have |
| .txt | UTF-8 decode; normalize whitespace; detect empty/garbled text. | Must-have |
| .docx | python-docx paragraphs and tables; retain heading structure. | Must-have |
| .pptx | python-pptx slide text; retain slide number; optional slide-image vision. | Should-have |
| .png / .jpg / .jpeg | Pillow validation; OCR with Tesseract; Gemini vision for charts/diagrams. | Should-have |
| .doc / .ppt | Legacy binary formats; ask user to convert to DOCX/PPTX for MVP. | Out of scope |
| .zip / executable / audio / video | Reject in MVP; do not unpack archives or accept executable content. | Reject |

> Be honest in the upload UI: 'Supported: PDF, TXT, DOCX, PPTX, PNG, JPG/JPEG. Legacy DOC/PPT files must be converted first.' Do not advertise every format until it has tests.

### Ingestion pipeline

1. Authenticate user and enforce upload quota.
2. Validate extension allowlist, file signature, MIME hint and size.
3. Generate a random server-side file ID; never trust the uploaded filename.
4. Scan/parse file in a controlled temporary directory.
5. Extract text with page/slide/image source references.
6. If text is too short, use OCR or return 'Could not read this file'.
7. Normalize text; remove repeated headers/footers and obvious noise.
8. Run document relevance classifier / structured AI check.
9. If irrelevant, empty, unsafe or too low-quality: reject with reason.
10. Split accepted text into topic-aware chunks.
11. Generate topic map and candidate questions grounded in chunks.
12. Validate every question, answer and evidence reference.
13. Save document, topics, chunks and question bank for this user.
14. Delete temporary raw upload unless the user explicitly chooses to retain it.

### Relevance guardrails: do not let the model decide alone

Use a two-stage check. First run deterministic checks; then ask Gemini for a constrained classification. A document is accepted only if both stages pass.

| Gate | Checks | Reject / ask user when |
|---|---|---|
| File safety | Allowed extension, size cap, file signature, parse succeeds. | Wrong type, too large, corrupted, archive, executable. |
| Text quality | Minimum extracted characters, readable ratio, duplicate/noise ratio. | Empty, mostly symbols, extraction failed. |
| Study relevance | AI returns subject, educational purpose, topic list, evidence snippets and confidence. | Meme, unrelated photo, invoice, random chat, unrelated marketing copy. |
| Question readiness | At least 2 distinct topics or a single coherent topic; enough factual content to form questions. | Too little information, unsupported claims, repeated filler. |
| Source grounding | Every question includes source chunk ID and page/slide or image reference. | No supporting passage; ambiguous answer; source mismatch. |

### Suggested relevance response schema

```json
{
  "is_study_material": true,
  "document_type": "lecture_notes",
  "subject": "Computer Organization",
  "topics": ["CPU registers", "ALU", "Memory hierarchy"],
  "educational_content_score": 0.91,
  "readability_score": 0.94,
  "reason": "Contains structured explanations and definitions.",
  "warnings": [],
  "can_generate_questions": true
}
```

Set conservative thresholds and make them configurable, e.g. relevance score >= 0.70, readability >= 0.65, minimum extracted text 500 characters for text documents. These are starting values, not universal truths. Test with real lecture notes, a meme, a bank statement, a blank PDF, a scanned page and a photo of handwritten notes.

### AI prompt-injection and privacy protections

- Treat all uploaded text as untrusted data, never as system instructions. Explicitly tell the model to ignore commands inside the notes.
- Do not let document content choose tools, URLs, SQL, file paths or system prompts.
- Ask the model for JSON matching a schema; validate with Pydantic. Reject malformed or unsupported output.
- Do not ask Gemini to make final game damage, XP, health or account decisions. The backend owns those rules.
- Keep API keys on the backend in environment variables. Never put them in React code, public config or Git.
- Do not send usernames, password hashes, account tokens or unrelated user records to the AI provider.
- Provide delete-document and delete-account controls; disclose that AI processing sends document content to the configured provider.
- Set upload size, page count, image dimensions, processing time and per-user rate limits.

> Security reference: OWASP recommends allowlisted extensions, file-signature checks, generated filenames, size limits and authorization checks for uploads.

---

## 6. AI Question Generation and Source Grounding

### Use a simple retrieval strategy first

For a 2–3 week MVP, do not spend time building a large vector database unless tests show that you need it. Store normalized chunks in PostgreSQL with topic labels and source metadata. Generate questions from each topic's chunks and retain the evidence chunk ID. This is sufficient for small-to-medium lecture notes and makes citations easy to verify. Add embeddings/vector search only if the demo needs retrieval across very long documents.

### Question object

```json
{
  "id": "question_uuid",
  "topic_id": "topic_uuid",
  "source_chunk_id": "chunk_uuid",
  "source_location": {"page": 4, "slide": null},
  "question_type": "mcq",
  "difficulty": "medium",
  "question": "Which component performs arithmetic operations?",
  "options": ["Control Unit", "ALU", "Register", "Cache"],
  "correct_option": 1,
  "explanation": "The ALU performs arithmetic and logical operations.",
  "evidence_quote": "The ALU performs arithmetic and logical operations."
}
```

### Question quality checks

- The correct answer must be explicitly supported by the cited source chunk.
- MCQ distractors must be plausible but clearly wrong according to the source.
- Avoid trick questions, vague wording, duplicate questions and questions requiring facts absent from the notes.
- Generate 5–8 usable questions per topic to start; do not generate hundreds.
- Run a deterministic schema/consistency validator; optionally ask a second AI pass to critique ambiguity, but do not let it silently change the answer.
- Show a small 'From your notes: page 4' source panel after answering so the student can verify the answer.

### AI provider architecture

Implement a provider interface so the rest of the app does not depend directly on Gemini or OpenRouter.

```python
class AIProvider(Protocol):
    async def classify_document(self, extracted_text: str) -> DocumentCheck: ...
    async def build_topic_map(self, chunks: list[Chunk]) -> TopicMap: ...
    async def generate_questions(self, topic: Topic, chunks: list[Chunk]) -> list[Question]: ...

# GeminiProvider is default.
# OpenRouterProvider is an explicit, manual fallback.
# Game combat and scoring never call an LLM.
```

Make AI calls during document ingestion, not on every attack. Save the generated question bank and reuse it during the game. This controls latency, quota use and costs.

Gemini free-tier rate limits vary by model and project; check the active limits in AI Studio before the event. OpenRouter should not be triggered automatically on every Gemini error because the $4 credit could disappear unexpectedly.

---

## 7. Accounts, Database and Saving User Progress

### Username + password only

The login form should contain exactly two fields: username and password. Do not require email, Google login or phone number. Registration can also contain username and password only. Usernames must be unique and normalized consistently (for example, lowercase for uniqueness while preserving display casing). Store Argon2 password hashes, never plaintext passwords. Use a strong password policy and rate-limit login attempts. Use a signed, short-lived access token or secure server-side session. Prefer HttpOnly, Secure, SameSite cookies for browser sessions. Do not store passwords or long-lived access tokens in localStorage. Provide logout and account deletion.

For a password reset without email, explain that the user must use a recovery code or administrator-assisted recovery; do not pretend an email reset exists.

Every database query for a private resource must include the authenticated `user_id`. Never trust a `user_id` sent by the browser.

**[UPDATED: demo]** Guest sessions: `POST /demo/session` is public and rate-limited per IP. It creates a temporary user with `is_guest=true`, a random username, `created_at` and `expires_at` (about 24 hours), sets the same secure HttpOnly/SameSite session cookie used by normal accounts, and returns the seeded demo dungeon ID. No password is created for guests.

**[UPDATED: demo]** Guest permissions: guests may play only the seeded demo dungeon, submit answers, finish a run and view their own scorecard. They may not upload documents or generate dungeons. Every run and attempt remains owned by its guest `user_id`; a guest cannot read another guest/user run, attempt or progress. The seeded demo dungeon is the only shared resource readable by all visitors; its content is read-only.

**[UPDATED: demo]** Expiry and cleanup: expire guest sessions after approximately 24 hours and run a scheduled purge that deletes expired guest users and their dependent runs, attempts and progress. Use cascading foreign keys or an explicit transactional cleanup job; never purge registered accounts. Reject expired guest cookies and issue a fresh guest session only after another rate-limited demo-session request.

### Database tables

| Table | Key fields / purpose |
|---|---|
| **[UPDATED: demo]** users | id, username, password_hash (nullable only for guests), is_guest, created_at, last_login_at, expires_at, is_active |
| documents | id, user_id, title, original_filename, file_type, status, subject, created_at, deleted_at |
| document_chunks | id, document_id, user_id, chunk_index, text, page_number, slide_number, source_meta |
| topics | id, document_id, user_id, name, description, order_index |
| questions | id, topic_id, source_chunk_id, type, difficulty, prompt, options_json, answer_json, explanation |
| dungeons | id, user_id, document_id, title, seed, status, created_at |
| dungeon_rooms | id, dungeon_id, topic_id, room_order, monster_type, monster_hp |
| game_runs | id, user_id, dungeon_id, started_at, finished_at, score, xp_earned, result |
| attempts | id, user_id, run_id, question_id, is_correct, response_json, duration_ms, created_at |
| review_items | id, user_id, question_id, repetition, interval_days, ease_factor, due_at, last_result |
| user_progress | user_id, total_xp, level, coins, unlocked_weapons_json, updated_at |

### Data ownership rule

Every user-owned row must be scoped by `user_id`, either directly or through a parent whose ownership is checked. Example: `GET /documents/{document_id}` must query `document_id AND current_user.id`. Never fetch a document by ID alone.

### Saving game state

- Save a run when it starts, after each answered question, after each room clear and when the run ends.
- Store attempts as append-only events; calculate the scorecard from saved attempts.
- Save account-wide XP/level separately from run-specific HP/score.
- Persist review due dates so they survive logout and another device.
- If the network drops, queue a small pending answer locally and sync when reconnected; server validates and applies the final state.

> Recommended database for a fast free prototype: Neon Postgres free tier or Supabase Postgres. Neon currently documents a free allowance with 1 GB storage per project and compute limits; check its live plan before launch. Keep uploaded file bytes in object storage or process and delete them; do not store large files as database blobs.

---

## 8. Spaced Repetition and the Scorecard

### Simple SM-2-inspired schedule

Use a simplified, transparent spaced-repetition algorithm. Do not over-engineer a full research-grade memory model during the hackathon.

| Result | Suggested next review |
|---|---|
| Wrong | 10 minutes (or later in the same session) |
| Correct but marked difficult | 1 day |
| Correct, normal | 3 days |
| Correct twice on separate reviews | 7 days |
| Correct repeatedly | 14 days, then 30 days |

Store repetition count, interval, ease factor (optional), `due_at` and `last_result` for each question or concept. A wrong answer resets the repetition streak. The actual schedule should be applied by backend code, not by the AI.

### End-of-dungeon scorecard

| Panel | What to show |
|---|---|
| Run summary | Dungeon title, completion state, date, duration, score, XP, rooms cleared. |
| Combat | Correct / incorrect answers, accuracy %, damage dealt, damage received, best streak. |
| Topic mastery | Per-topic accuracy and mastery band; identify weak topics clearly. |
| Forgotten Crypt | Questions/concepts answered incorrectly or marked difficult; next review date. |
| Source evidence | Link each weak concept to its page/slide/chunk in the original notes. |
| Next action | Review weak concepts, replay one room or start another dungeon. |

### Example scoring formula

```python
accuracy = correct_count / max(total_answered, 1) * 100
score = (correct_count * 100) + (hard_correct * 50) + (room_clears * 50) + (boss_clear * 200) + (best_streak_bonus)
mastery(topic) = weighted_correctness_over_recent_attempts(topic)
# Display mastery as Weak < 50, Learning 50–79, Strong >= 80.
```

Do not claim the score is a scientifically validated measure of knowledge. Label it as a gameplay mastery estimate based on the student's recent answers.

---

## 9. UI and Visual Direction

### Visual identity

Direction: premium dark fantasy / Halloween library. Avoid a childish cartoon look or a generic admin dashboard. Use rich near-black/plum backgrounds, warm parchment surfaces for readable text, muted teal/green health indicators and amber/orange attack accents.

| Token | Suggested value | Usage |
|---|---|---|
| Background | #100D18 | Main app background |
| Panel | #1D1728 | Dashboard panels / modal surfaces |
| Parchment | #F2E8D5 | Question and source panels |
| Purple | #7546A8 | Magic / primary accent |
| Blood red | #B83D4A | Monster HP / damage |
| Amber | #E9A23B | XP / coins / rewards |
| Mint | #68C9A5 | Player health / correct feedback |
| Muted text | #A79CB5 | Secondary labels |

### Screens to design

**[UPDATED: demo]** Landing page: atmospheric hero art, short explanation, a prominent *Try the Demo* button beside Login, and a separate Register action. *Try the Demo* makes one click with no form or sign-up; show "Waking up the dungeon..." while requesting a guest session. If the backend is still unreachable after about 8 seconds, launch a clearly labeled Offline demo using bundled seeded JSON and deterministic game rules.

**[UPDATED: demo]** Guest game banner: display "Playing as guest. Progress is temporary. Create an account to save." Keep the create-account action available without interrupting the current demo run.

- Login/register: compact username + password form, clear error states.
- Dashboard: Continue Dungeon, Upload Notes, recent dungeons, level/XP and review due count.
- Upload wizard: drag/drop, supported formats, progress steps, document relevance result and detected topics.
- Dungeon map: connected rooms, room status, topic names and boss room.
- Game HUD: player portrait/HP, monster portrait/HP, weapon, XP, question panel and answer buttons.
- Pause/settings: sound toggle, resume, exit with confirmation.
- Scorecard: overall result, topic bars, weak concepts, source references and replay button.

### Animation polish checklist

- Player idle/breathing loop and 4-direction walk if using top-down movement.
- Monster idle loop, hit flash, knockback, defeat dissolve/fade.
- Weapon projectile or slash arc with a short hit-stop effect.
- HP bars animate smoothly instead of instantly jumping.
- Correct answer: satisfying impact sound, damage number and brief green feedback.
- Wrong answer: monster attack animation, screen shake kept subtle, health reduction.
- Room clear: door opens, chest/reward animation, XP counter ticks upward.
- Use reduced-motion and mute controls; do not make sound essential to gameplay.

### Asset sourcing

Use a consistent sprite pack instead of mixing unrelated art styles. Check each asset's license and attribution requirements before using it. Suitable places to inspect include [Kenney's free game assets](https://kenney.nl/assets) and [OpenGameArt](https://opengameart.org/). Prefer transparent PNG sprite sheets or small tile sets. Keep the initial art scope to one player, 3–4 monsters, one boss, 5 weapon effects, one dungeon tileset and a few UI icons.

---

## 10. Architecture and API Contract

### High-level architecture

```
Browser
  React app (auth, dashboard, upload, scorecard)
  |
  +-- Phaser canvas (game scenes, movement, combat visuals)
  |
  v
FastAPI backend
  Auth + ownership checks
  Upload validation + extraction pipeline
  Relevance guardrail + topic/question generation
  Dungeon/run/attempt/review services
  |
  +-- Gemini API (ingestion-time AI only)
  +-- Optional OpenRouter adapter (manual fallback)
  |
  v
PostgreSQL
  users, documents, chunks, topics, questions,
  dungeons, rooms, runs, attempts, review_items, progress
```

### Suggested API endpoints

| Method + route | Purpose |
|---|---|
| `POST /auth/register` | Create username/password account. |
| `POST /auth/login` | Authenticate and set secure session/token. |
| `POST /auth/logout` | Invalidate session. |
| `GET /auth/me` | Return current user profile and progress summary. |
| `POST /documents` | Upload and start ingestion. |
| `GET /documents/{id}/status` | Poll processing state and guardrail result. |
| `GET /documents/{id}/topics` | Return detected topics and source counts. |
| `POST /documents/{id}/generate-dungeon` | Create dungeon from accepted document. |
| `GET /dungeons` | List current user's dungeons. |
| `GET /dungeons/{id}` | Return room/topic/question metadata needed to start. |
| `POST /runs` | Start a run. |
| `POST /runs/{id}/attempts` | Submit answer; backend validates and applies damage/score. |
| `POST /runs/{id}/rooms/{room_id}/clear` | Persist room clear/reward. |
| `POST /runs/{id}/finish` | Finalize run and return scorecard. |
| `GET /progress` | Return XP, level, mastery and review count. |
| `GET /reviews/due` | Return due concepts/questions. |
| `DELETE /documents/{id}` | Delete document and associated generated data. |
| **[UPDATED: demo]** `POST /demo/session` | Public, no-auth, per-IP rate-limited. Create a 24-hour guest user, set normal secure session cookie, return seeded demo dungeon ID. |

### Important combat authority rule

The browser may animate the attack, but the backend is authoritative for correctness, HP, score, XP and attempt history. The frontend sends `question_id` and `selected_answer`; the backend checks the saved answer and returns a result such as `correct`, `damage`, `monster_hp`, `player_hp`, `score_delta` and `review_due_at`. Never accept a client-submitted 'I dealt 100 damage' value.

**[UPDATED: demo]** Demo access rule: the seeded demo dungeon is the only shared readable resource. It is hand-written and reviewed, contains about four topic rooms plus one boss and 5–6 source-grounded questions per topic, and is built from synthetic public study notes. Seed/cache it as static database content; never call Gemini or OpenRouter to serve or play it. A guest may read this dungeon but all run/attempt/progress records remain private to that guest user.

**[UPDATED: demo]** Offline fallback: after showing "Waking up the dungeon...", if the backend is unreachable or cold-starting for more than about 8 seconds, switch to a clearly labeled Offline demo powered by bundled seeded JSON and a small deterministic rules module matching game-design.md. Clearly indicate that offline progress is local/temporary and cannot be saved to an account until online.

### Example answer response

```json
{
  "correct": true,
  "damage_dealt": 25,
  "monster_hp_remaining": 45,
  "player_hp_remaining": 100,
  "score_delta": 100,
  "xp_delta": 10,
  "streak": 2,
  "source": {"page": 4, "chunk_id": "chunk_uuid"},
  "review_status": "not_due"
}
```

---

## 11. Two-Person Work Split

Use one shared repository and one agreed API contract. Do not let both developers independently invent the same data structures. Agree on the JSON payloads and endpoint names on Day 1, then work in parallel.

| Person A – AI/backend owner | Person B – game/frontend owner |
|---|---|
| FastAPI project setup, config, DB and migrations | React/Vite/TypeScript project setup and design system |
| Username/password auth and ownership checks | Landing, login/register and dashboard screens |
| Upload validation and document extraction | Phaser integration and scene lifecycle |
| OCR, document relevance guardrails and AI provider adapter | Dungeon map, player movement, camera and room transitions |
| Topic/chunk/question generation and source mapping | Monster sprites, animations, weapons, hit effects and sound |
| Dungeon/run/attempt/score/review APIs | Question HUD, answer feedback, HP bars and scorecard UI |
| Backend tests, deployment, env variables and API docs | Responsive polish, accessibility, game playtesting and demo capture |

**[UPDATED: demo]** Person A: implement `POST /demo/session`, guest user lifecycle/expiry/purge, IP rate limit, seeded demo read access, ownership enforcement and demo API tests.

**[UPDATED: demo]** Person B: add *Try the Demo* beside Login, guest banner, waking state, 8-second offline fallback, bundled demo JSON/rules adapter and judge-friendly demo route.

### Integration contract

- Person A publishes OpenAPI docs and a shared `api-contract.md` by the end of Day 1.
- Person B builds against mocked JSON fixtures before the backend is ready.
- Use a shared types file generated from OpenAPI or manually maintained in `frontend/src/types/api.ts`.
- Person B owns the visual result; Person A owns all authoritative game-state calculations.
- Daily 10–15 minute integration sync: what merged, what is blocked, what endpoint/prop changed.
- Never commit `.env`, Gemini keys, OpenRouter keys, database passwords or user-uploaded notes.

### Git workflow

```
main                          # always deployable
feature/backend-auth
feature/document-ingestion
feature/ai-question-generation
feature/phaser-dungeon
feature/game-hud-scorecard
feature/integration-polish
```

Rules:
- Pull main before starting work.
- Keep PRs small and focused.
- Merge only after build/tests pass.
- Avoid editing the same files simultaneously.
- Use `.env.example` with placeholder values only.

Suggested ownership: the developer most comfortable with Python/FastAPI owns AI/backend; the teammate who wants to focus on visuals owns Phaser/React game UI. If one person is stronger at design, keep that person accountable for final visual consistency, even if Kiro generates the first draft.

---

## 12. Two-to-Three-Week Execution Schedule

| Day | Person A: AI/backend | Person B: game/frontend | Definition of done |
|---|---|---|---|
| **[UPDATED: demo]** 1 | Agree architecture, data model, API contract, Kiro specs and guest/demo ownership rules; define seeded content schema. | Agree game reference, UI map, assets and scene flow; design Try the Demo entry, guest banner and offline fallback states. | Repo, .kiro, shared contract, demo content outline and task board exist. |
| **[UPDATED: demo]** 2 | FastAPI, DB, migrations, auth skeleton and guest-session model/expiry fields. | React/Vite, routes, theme, login/dashboard skeleton and landing Try the Demo button. | Both apps run locally. |
| **[UPDATED: demo]** 3 | Username/password auth, ownership tests, `POST /demo/session`, IP rate limit and seeded demo access. | Login/register UI connected; one-click guest flow, waking state and guest banner connected to API/mock. | Registered login works and Try the Demo opens the seeded dungeon without a form. |
| 4 | Upload endpoint, file validation, PDF/TXT/DOCX extraction. | Upload wizard, progress states and dashboard shell. | A user can upload and see processing state. |
| 5 | PPTX/image extraction, OCR fallback, relevance gate. | Dungeon map visual and Phaser canvas boot. | Relevant docs pass; irrelevant docs rejected. |
| 6 | Topic map, chunks and source references. | Player movement, camera, rooms and collisions. | Player can move around a basic dungeon. |
| 7 | Gemini question generation, schema validation. | Monster scene, idle/hit/death animations. | A topic creates a valid question set and monster. |
| 8 | Persist dungeon, rooms and question bank. | Question HUD and correct/wrong feedback. | One end-to-end room is playable. |
| 9 | Answer endpoint, damage, score and XP logic. | Weapon animations, damage numbers, HP bars. | Correct/wrong answers update combat correctly. |
| 10 | Run persistence, attempts and review scheduling. | Room transitions, boss encounter and victory/defeat. | Complete one dungeon loop. |
| 11 | Scorecard and progress APIs; deletion. | Scorecard UI, dashboard progress and replay. | Progress persists after logout/login. |
| **[UPDATED: demo]** 12 | Tests, rate limits, guest expiry/purge job, API error handling and demo access isolation. | Responsive polish, sound, animation, accessibility, offline demo fallback and guest banner. | Feature freeze candidate. |
| 13 | Deploy backend + DB, env and CORS. | Deploy frontend, connect production API. | Public URL works from a clean browser. |
| **[UPDATED: demo]** 14 | Fix deployment/data bugs; verify guest rate limit, expiry/purge and no-AI seeded demo. | Playtest signed-in and guest journeys, test offline fallback, tune game balance and capture judge demo. | Judge-ready MVP. |
| **[UPDATED: demo]** 15–18 buffer | Only critical fixes; test multiple documents and accounts. | Polish one-click demo path, offline fallback and video; no new major features. | No new major features; stable submission. |

### Scope protection

If the schedule slips, cut features in this order: inventory/cosmetics, free-text answers, daily quests, complex procedural maps, advanced vector search, multi-dungeon campaign. Never cut authentication isolation, document relevance checks, source grounding, answer persistence or the complete playable loop.

---

## 13. Kiro IDE Workflow and Credit Strategy

Use Kiro Specs for features that need requirements, design and task breakdown; use Steering files to keep project-wide conventions consistent; use Hooks for repeatable checks such as linting and tests. Kiro's official documentation describes Specs, Steering and event-driven Hooks. Keep the `.kiro` directory committed to Git and visible in the repository.

### How to use the 4,000 Kiro credits wisely

- Do not ask Kiro to generate the entire product in one enormous prompt.
- Start with a spec and review requirements/design/tasks before asking it to implement.
- Ask for one vertical slice at a time: register → upload → parse → generate → play → save → scorecard.
- Ask Kiro to inspect existing code before editing; require it to preserve working features.
- Request tests and run them after each milestone.
- A feature is not complete because code was generated.
- Use the same shared steering docs and API contract in both developers' workspaces.
- Use Kiro for implementation, refactoring and test generation; use the team's own judgment for game feel, educational quality and scope.

### Recommended .kiro directory

```
.kiro/
  steering/
    product.md
    tech.md
    architecture.md
    api-contract.md
    game-design.md
    security-and-uploads.md
    coding-standards.md
  specs/
    01-foundation-auth/
      requirements.md
      design.md
      tasks.md
    02-document-ingestion/
    03-ai-question-generation/
    04-phaser-game-loop/
    05-progress-scorecard/
    06-deployment-hardening/
  hooks/
    test-on-backend-save.json
    lint-on-frontend-save.json
```

### Create these Kiro steering files first

| File | What it tells Kiro |
|---|---|
| product.md | StudyDungeon purpose, target learner, core journey, MVP vs stretch. |
| tech.md | React/TS/Vite, Phaser 3, FastAPI, PostgreSQL, Gemini, parser libraries. |
| architecture.md | React shell vs Phaser canvas, backend ownership, AI ingestion pipeline. |
| api-contract.md | Endpoints, request/response shapes, error format, IDs and ownership rules. |
| game-design.md | Controls, room flow, weapon damage, monster HP, scoring and level rules. |
| security-and-uploads.md | Auth, Argon2, file allowlist, size limits, relevance gate, prompt injection rules. |
| coding-standards.md | Type hints, Pydantic schemas, TypeScript strict mode, tests, no secrets, small modules. |

---

## 14. Testing Plan and Acceptance Criteria

### Must-pass test cases

| Area | Test | Expected result |
|---|---|---|
| Auth | Register two users with unique usernames. | Both accounts created; duplicate username rejected. |
| Auth | Login with wrong password. | Generic invalid credentials response; no account leakage. |
| Isolation | User B requests User A's document/dungeon. | 403/404; no data returned. |
| Upload | Upload PDF lecture notes. | Text/pages extracted and status becomes accepted. |
| Upload | Upload meme or invoice. | Rejected with clear relevance explanation. |
| Upload | Upload blank/corrupt/oversized/unsupported file. | Rejected safely; backend remains healthy. |
| AI | Generate a question with evidence. | Valid question references a real source chunk/page. |
| AI | AI returns invalid JSON or unsupported answer. | Question rejected; no dungeon built from invalid item. |
| Game | Answer correctly. | Backend confirms correct; monster HP decreases and score/XP increase. |
| Game | Answer incorrectly. | Player HP decreases; attempt enters review queue. |
| Game | Refresh browser mid-run. | Run can resume or a clear recovery path is shown. |
| Persistence | Logout and log back in. | XP, dungeons, attempts and review dates remain. |
| Demo | AI provider unavailable. | Seeded demo dungeon remains playable. |
| **[UPDATED: demo]** Demo | Click Try the Demo without logging in. | A guest session is created and seeded dungeon opens with no form. |
| **[UPDATED: demo]** Demo | Guest completes a demo run. | Guest can answer, finish and see only their own scorecard. |
| **[UPDATED: demo]** Authorization | Guest attempts upload and dungeon generation. | Both are rejected; no AI quota is consumed. |
| **[UPDATED: demo]** Isolation | Guest requests another user's run, attempt or progress. | 403/404; no other user/guest data is returned. |
| **[UPDATED: demo]** Demo/AI | Disable AI provider and play seeded demo. | Demo loads and plays; no provider call is made. |
| **[UPDATED: demo]** Rate limit | Exceed `POST /demo/session` per-IP threshold. | Further requests receive 429 with retry guidance. |
| **[UPDATED: demo]** Cleanup | Expire a guest and run purge. | Guest, runs, attempts and progress are deleted; registered accounts remain. |
| **[UPDATED: demo]** Fallback | Backend unavailable beyond about 8 seconds. | "Waking up the dungeon..." appears, then labeled Offline demo starts from bundled JSON. |

### Submission-ready definition

- Public app URL works in a clean incognito browser.
- Public GitHub repo includes an open-source license and the `.kiro` directory.
- README has setup, architecture, environment variables, supported formats and limitations.
- At least one sample dungeon is playable without uploading a document.
- One end-to-end personalized upload-to-scorecard journey is demonstrated.
- No secrets, real passwords or private student notes are committed.
- YouTube demo is under 3 minutes and shows the actual app, not only slides.

---

## 15. Deployment and Zero-Cost Operating Plan

### Suggested free-tier topology

| Component | Option | Caution |
|---|---|---|
| Frontend | Vercel Hobby or Render Static Site | Check current terms; Vercel Hobby is for personal/non-commercial use. |
| FastAPI backend | Render free web service or another currently free Python host | Render free services spin down after inactivity; first request can be slow. |
| Database | Neon Postgres free or Supabase Postgres free | Check current quotas, region, connection limits and sleep/scale-to-zero behaviour. |
| AI | Gemini AI Studio free tier | Model access and request quotas vary; check active limits in AI Studio. |
| File bytes | Temporary processing + delete, or free object storage if available | Do not depend on ephemeral backend filesystem for permanent files. |
| Assets | Kenney/OpenGameArt/free licensed assets | Check license and attribution for every asset. |

A Render free web service loses local filesystem changes on restarts/spin-down and may take around a minute to wake. Therefore do not store permanent uploads or the production database on its local disk. Keep PostgreSQL external and process uploads temporarily or use object storage. Free plans can change; verify before selecting a provider.

### Environment variables

```bash
# Backend
DATABASE_URL=postgresql+psycopg://...
GEMINI_API_KEY=...
AI_PROVIDER=gemini
OPENROUTER_API_KEY=
OPENROUTER_ENABLED=false
SECRET_KEY=replace-with-long-random-secret
FRONTEND_ORIGIN=https://your-frontend.example
MAX_UPLOAD_MB=15
TEMP_UPLOAD_DIR=/tmp/studydungeon

# Frontend
VITE_API_BASE_URL=https://your-api.example
```

> Never prefix a secret with `VITE_`. Vite exposes `VITE_` variables to the browser bundle.

### Demo reliability

- Seed a demo account and sample dungeon with synthetic public study notes.
- Cache the generated sample question bank; do not call Gemini every time a judge opens the demo.
- **[UPDATED: demo]** The judge demo is a static, hand-written and reviewed shared resource built from synthetic public study notes: about four topic rooms plus one boss, with 5–6 source-grounded questions per topic. Serve it from cached/seeded data; never invoke Gemini or OpenRouter for this demo.
- Public `POST /demo/session` is rate-limited per IP, creates a temporary guest user, sets the normal secure session cookie and returns the seeded dungeon ID. Guest runs, attempts and scorecards remain private to that guest.
- **[UPDATED: demo]** Landing page *Try the Demo* is a one-click, no-sign-up action beside Login. Show "Waking up the dungeon..." while the backend starts. If it is unreachable or still cold-starting after about 8 seconds, switch to a clearly labeled Offline demo using bundled seeded JSON and a small deterministic rules module matching game-design.md. Do not imply offline progress is server-saved.
- **[UPDATED: demo]** Display "Playing as guest. Progress is temporary. Create an account to save." Guests can play, answer, finish and view their scorecard, but cannot upload or generate dungeons. Expire guest users after about 24 hours and automatically purge their runs, attempts and progress. Apply normal ownership checks; the seeded read-only demo dungeon is the only resource shared across users.
- Have a backup screen recording in case a free backend host is cold-starting.
- Test from mobile hotspot/incognito and from a second device.
- Display a clear processing status while AI builds a personalized dungeon; do not leave a blank spinner.

---

## 16. Biggest Risks and Mitigation

| Risk | Why it matters | Mitigation |
|---|---|---|
| Scope explosion | A complete RPG is too large for 2–3 weeks. | Room-based game, one biome, one boss, limited weapons. |
| AI hallucinations | Wrong questions destroy trust. | Evidence chunk, source quote, schema validation and manual test set. |
| Irrelevant uploads | Random files create nonsense dungeons. | Deterministic file checks + AI relevance gate + reject state. |
| API quota / outage | Personalized dungeon generation may fail. | Generate once, cache questions, bounded retries, seeded demo mode. |
| Phaser/React integration | State and lifecycle bugs can waste days. | Use one GameCanvas, typed event bridge, keep API calls in React. |
| Free hosting cold starts | Judges may wait for backend. | Warm-up before demo, clear loading screen, backup video. |
| Ephemeral file storage | Uploaded data may disappear. | External DB/object storage; temporary file processing and cleanup. |
| Cross-user data leak | Private notes and progress must be isolated. | Ownership checks on every endpoint and automated two-user tests. |
| Game feels like a quiz | Weak Frankenstein/game impression. | Visible dungeon navigation, animated monsters, weapon hit effects, room rewards. |
| Poor mobile controls | Browser game may be awkward on phones. | Desktop-first for hackathon, add simple touch controls if time remains. |

---

## 17. What Not to Build in the First 2–3 Weeks

- 3D world, multiplayer combat, chat, guilds or live leaderboards.
- A fully procedural open world or complex physics platformer.
- Unlimited file formats or legacy .doc/.ppt support.
- AI grading of long essays or unrestricted free-text responses.
- AI-generated artwork for every monster during gameplay.
- A large vector database before testing whether topic chunking is sufficient.
- A complex economy, crafting system or dozens of weapons.
- A custom password reset email flow when the product intentionally has no email field.

The goal is a polished vertical slice: one user, one document, one dungeon, a few rooms, satisfying combat, a useful scorecard and saved review progress.

---

## 18. Day-One Startup Checklist

- Create one shared GitHub repository and protect main.
- Create `frontend/` and `backend/` folders.
- Install Node LTS and Python version supported by the selected dependencies.
- Create the React + TypeScript + Vite frontend.
- Create FastAPI backend with `/health` endpoint.
- Create PostgreSQL project and local `.env` files.
- Create `.kiro/steering` files from the prompts above.
- Create shared API contract before parallel feature work.
- Start from one seeded sample dungeon and make it playable before AI ingestion is complete.

At the end of Day 1, both developers should be able to run their app locally and know exactly which files/features they own.

---

## 19. Official Documentation and References

Use these official references while implementing. Re-check pricing, quotas and plan terms at the time of deployment because free tiers change.

- [Kiro documentation](https://kiro.dev/docs/) — Kiro IDE, Specs, Steering and Hooks.
- [Kiro Steering](https://kiro.dev/docs/steering/) — Persistent project instructions and team conventions.
- [Kiro Hooks](https://kiro.dev/docs/hooks/) — Event-driven automation for tests and checks.
- [Phaser documentation](https://docs.phaser.io/) — Phaser 2D browser game framework.
- [Phaser project templates](https://docs.phaser.io/phaser/getting-started/project-templates) — React and bundler templates.
- [Phaser React TypeScript template](https://github.com/phaserjs/template-react-ts) — Example React/Vite/TypeScript integration; check Phaser major version.
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — Current model-specific request/token limits.
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) — Free and paid API access details.
- [PyMuPDF basics](https://pymupdf.readthedocs.io/en/latest/the-basics.html) — PDF text extraction and OCR fallback.
- [python-pptx](https://python-pptx.readthedocs.io/) — PowerPoint slide content extraction.
- [FastAPI security tutorial](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — Password hashing and token patterns.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — Upload validation, allowlists, size limits and authorization.
- [Neon free plan quotas](https://neon.com/docs/introduction/plans) — Postgres free-tier quotas and limits.
- [Render free services](https://render.com/docs/free) — Free service spin-down and ephemeral filesystem limitations.
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) — Hobby plan use and included limits.
- [Kenney assets](https://kenney.nl/assets) — Free game asset packs; verify individual license terms.
- [OpenGameArt](https://opengameart.org/) — Community game art; verify attribution/license per asset.

---

## Final Recommendation

Build StudyDungeon as a compact, polished 2D learning RPG. Your strongest demo is not the number of features; it is the complete loop: upload real lecture notes → reject irrelevant material → extract topics → generate grounded questions → explore a dungeon → attack monsters by answering → save progress → show exactly what the learner should revise next. If you and your teammate protect that loop and split ownership cleanly, a strong hackathon-ready version is realistic in 2–3 weeks. Keep the AI responsible for understanding the notes, and keep the game rules deterministic, testable and satisfying.
