# StudyDungeon — Product Specification

## 1. Product Vision
StudyDungeon is a browser-based, adaptive learning 2D RPG that transforms students' raw study notes into a playable haunted dungeon crawl.
- Topics become themed rooms.
- Key concepts become monsters.
- Player answers source-grounded questions to attack; correct answers damage monsters, while wrong answers cost player health.
- Post-run results provide an educational scorecard and update a spaced-repetition revision queue.

## 2. Core Player Journey
1. **Landing & Demo:** Visitor clicks "Try the Demo" to play an immediate hand-crafted seeded dungeon as a temporary guest with zero sign-up or AI quota usage.
2. **Registration / Login:** Visitor creates an account using a unique username and password.
3. **Upload Notes:** Student uploads study materials (PDF, TXT, DOCX, PPTX, PNG, JPG/JPEG).
4. **Validation & Extraction:** Backend parses content, runs deterministic quality checks, and executes a Gemini AI relevance check. Irrelevant files are rejected with feedback.
5. **Dungeon Generation:** AI extracts 2–6 topics and generates 5–8 source-grounded questions per topic.
6. **Combat & Gameplay:** Student enters topic rooms, combats monsters with deterministic weapon damage, and clears rooms.
7. **Scorecard & Mastery:** Student views accuracy, mastery levels (Weak / Learning / Strong), and next spaced-repetition review dates.

## 3. Scope Boundaries
- **MVP Scope:**
  - Username/password auth + guest demo sessions.
  - PDF, TXT, DOCX, PPTX, Image upload parsing & relevance gate.
  - Grounded question generation citing exact source chunks and page numbers.
  - Server-authoritative combat math, damage, HP, XP, score, and SM-2 scheduling.
  - Seeded demo dungeon available without AI calls.
- **Out of Scope (Stretch):**
  - Open-world RPG movement, inventory/cosmetics, multiplayer, speech/audio questions.

