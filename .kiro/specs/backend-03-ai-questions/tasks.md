# Tasks: Backend 03 — AI Topic Clustering & Grounded Question Generation

- [ ] 1. Implement Gemini topic clustering extracting 2–6 coherent topics from document chunks <!-- owner: backend; files: backend/app/ai/gemini.py; test: tests/test_questions.py -->
- [ ] 2. Implement structured question bank generation with Pydantic JSON validation <!-- owner: backend; files: backend/app/ai/gemini.py, backend/app/ai/schemas.py; test: tests/test_questions.py -->
- [ ] 3. Implement deterministic evidence quote verification asserting verbatim substring in source chunk <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_questions.py -->
- [ ] 4. Add Property-Based Test (PBT) asserting evidence quote invariant on generated questions <!-- owner: backend; files: backend/tests/test_questions.py; test: tests/test_questions.py -->
- [ ] 5. Implement `GET /documents/{id}/topics` endpoint <!-- owner: backend; files: backend/app/api/dungeons.py; test: tests/test_dungeons.py -->
- [ ] 6. Implement `POST /documents/{id}/generate-dungeon` creating `Dungeon`, `DungeonRoom`, and `Question` records (guests blocked with 403) <!-- owner: backend; files: backend/app/api/dungeons.py; test: tests/test_dungeons.py -->
- [ ] 7. Implement `GET /dungeons` returning user-owned dungeons plus the public seeded demo dungeon <!-- owner: backend; files: backend/app/api/dungeons.py; test: tests/test_dungeons.py -->
- [ ] 8. Implement `GET /dungeons/{id}` returning room layouts and monsters with strict tenant access check <!-- owner: backend; files: backend/app/api/dungeons.py; test: tests/test_dungeons.py -->

