# Spec 02: Document Ingestion & Multimodal Guardrails

## Requirements
1. Support PDF, TXT, DOCX, PPTX, and Image uploads (PNG, JPG, JPEG).
2. PyMuPDF page-by-page extraction with Tesseract OCR fallback for scanned pages.
3. Magic byte and file size validation (max 15MB).
4. Gemini AI relevance check: reject memes, invoices, receipts, and low-quality notes.
5. Store extracted text as indexed chunks with page/slide references.

