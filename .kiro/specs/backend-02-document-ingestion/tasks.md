# Tasks: Backend 02 — Document Ingestion & Multimodal Guardrails

- [ ] 1. Define `AIProvider` Protocol (`classify_document`, `build_topic_map`, `generate_questions`) <!-- owner: backend; files: backend/app/ai/provider.py; test: tests/test_ingestion.py -->
- [ ] 2. Implement concrete `GeminiProvider` using Google GenAI SDK with structured output validation <!-- owner: backend; files: backend/app/ai/gemini.py; test: tests/test_ingestion.py -->
- [ ] 3. Implement file validation: extension whitelist, magic bytes, 15MB size limit, and max 30 page check <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_ingestion.py -->
- [x] 4. Implement deterministic text cleaning, whitespace normalization, and printable ratio checks <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_ingestion.py -->
- [ ] 5. Implement multi-format extractors: PyMuPDF for PDF, python-docx for Word, python-pptx for slides <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_ingestion.py -->
- [ ] 6. Implement multimodal OCR via Gemini Vision with Tesseract local fallback for scanned pages/images <!-- owner: backend; files: backend/app/services/ingestion.py, backend/app/ai/gemini.py; test: tests/test_ingestion.py -->
- [ ] 7. Implement Gemini relevance guardrail classifying study material vs memes/invoices with anti-prompt-injection defense <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_ingestion.py -->
- [ ] 8. Implement background task ingestion pipeline with retryable `processing|accepted|rejected|failed` states <!-- owner: backend; files: backend/app/services/ingestion.py; test: tests/test_ingestion.py -->
- [ ] 9. Implement `POST /documents` (multipart upload) and `GET /documents` listing (guests blocked with 403) <!-- owner: backend; files: backend/app/api/documents.py; test: tests/test_ingestion.py -->
- [ ] 10. Implement `GET /documents/{id}/status` and `DELETE /documents/{id}` cascading removal <!-- owner: backend; files: backend/app/api/documents.py; test: tests/test_ingestion.py -->

