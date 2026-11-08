# Design: Backend 02 — Document Ingestion & Multimodal Guardrails

## 1. Modules & Structure
- `app/ai/provider.py`: `AIProvider` Protocol definition (`classify_document`, `build_topic_map`, `generate_questions`).
- `app/ai/gemini.py`: Concrete Gemini 1.5 Flash implementation of `AIProvider`.
- `app/services/ingestion.py`: Text extraction engine, MIME/signature validation, OCR fallback, quality checks.
- `app/api/documents.py`: Endpoints for document upload, status polling, listing, and deletion.
- `app/models/all_models.py`: `Document` and `DocumentChunk` entities.
- `app/schemas/documents.py`: Pydantic upload and response schemas.

## 2. Ingestion Pipeline & Multimodal Strategy
1. **Validation & Quota:**
   - Enforce max 5 stored documents per registered user.
   - Restrict extensions to: `.pdf`, `.txt`, `.docx`, `.pptx`, `.png`, `.jpg`, `.jpeg`.
   - Max file size: 15 MB (`MAX_UPLOAD_MB`).
   - Max page/slide count: 30 pages.
   - Reject guests with `403 Forbidden`.
2. **Extraction:**
   - **PDF:** PyMuPDF page-by-page. If a page has <100 characters, send page image to Gemini Vision OCR (with Tesseract as local fallback).
   - **DOCX / PPTX:** Structured extraction with heading/slide metadata.
   - **Images:** Process via Gemini Vision OCR (fallback to Tesseract).
3. **Deterministic Quality Gate:**
   - Minimum extracted character count: 500 characters.
   - Printable character ratio: ≥ 70%.
4. **AI Relevance Guardrail (Gemini Flash):**
   - Prompt instructions treat document text as untrusted data (anti-prompt injection).
   - Returns structured score: `educational_content_score` (must be ≥ 0.70), `readability_score` (must be ≥ 0.65).
   - If scores fail or document is non-study material (meme, invoice), mark status as `rejected` with actionable user reason.
5. **Background Task & Retryability:**
   - Ingestion runs as FastAPI `BackgroundTask`.
   - Interrupted or failed documents remain in `failed` state with user-friendly error and can be retried.

## 3. Endpoints
- `POST /documents`: Upload multipart file. Rejects guests (`403`). Returns `202 Accepted` with `{id, status: "processing"}`.
- `GET /documents`: List current user's uploaded documents.
- `GET /documents/{id}/status`: Poll ingestion progress and AI relevance decision.
- `DELETE /documents/{id}`: Cascade delete document, chunks, and associated dungeons.

## 4. Implementation Status
- **Implemented:**
  - `Document` and `DocumentChunk` SQLAlchemy models.
  - Deterministic text normalization and character check functions in `app/services/ingestion.py`.
  - Unit tests for quality check and text normalization in `tests/test_ingestion.py`.
- **Missing / Pending:**
  - `AIProvider` Protocol and Gemini Flash client adapter in `app/ai/`.
  - File parsers (PyMuPDF, python-docx, python-pptx, Gemini Vision OCR).
  - Background task worker for async ingestion.
  - `POST /documents`, `GET /documents`, `GET /documents/{id}/status`, `DELETE /documents/{id}` routes.

## 5. Test Strategy
- Mocked AI unit tests verifying prompt-injection immunity and schema enforcement.
- Integration tests uploading valid PDF, corrupt file, oversized file, blank page, and non-educational meme.

