import io
import os
from typing import List

import docx
import pptx
import pymupdf
from PIL import Image

from app.ai.provider import ExtractedChunk
from app.services.ingestion import clean_and_normalize_text

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".pptx", ".png", ".jpg", ".jpeg"}


def validate_file_header(filename: str, file_bytes: bytes) -> str:
    """
    Validates file extension, magic signature, and size.
    Returns normalized file_type (pdf, txt, docx, pptx, image).
    Raises ValueError on invalid files.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file format '{ext}'. Allowed formats are PDF (.pdf), Word (.docx), PowerPoint (.pptx), Text (.txt), and Images (.png, .jpg)."
        )

    # Magic signature verification
    if ext == ".pdf":
        if not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Corrupted or invalid PDF file header.")
        return "pdf"
    elif ext in (".docx", ".pptx"):
        # ZIP-based XML format
        if not file_bytes.startswith(b"PK\x03\x04"):
            raise ValueError("Corrupted or invalid Office XML file header.")
        return "docx" if ext == ".docx" else "pptx"
    elif ext in (".png", ".jpg", ".jpeg"):
        try:
            img = Image.open(io.BytesIO(file_bytes))
            img.verify()
            return "image"
        except Exception:
            raise ValueError("Corrupted or unreadable image file.")
    elif ext == ".txt":
        try:
            file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                file_bytes.decode("latin-1")
            except Exception:
                raise ValueError("Corrupted plain text encoding.")
        return "txt"

    return "txt"


def extract_text_from_pdf(file_bytes: bytes, max_pages: int = 30) -> List[ExtractedChunk]:
    chunks: List[ExtractedChunk] = []
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    if page_count > max_pages:
        raise ValueError(f"Document exceeds maximum limit of {max_pages} pages (has {page_count} pages).")

    for idx, page in enumerate(doc):
        text = page.get_text()
        clean = clean_and_normalize_text(text)
        if clean:
            chunks.append(ExtractedChunk(chunk_index=idx, text=clean, page_number=idx + 1))
    return chunks


def extract_text_from_docx(file_bytes: bytes) -> List[ExtractedChunk]:
    chunks: List[ExtractedChunk] = []
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs_text = []

    for p in doc.paragraphs:
        t = p.text.strip()
        if t:
            paragraphs_text.append(t)

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
            if row_text:
                paragraphs_text.append(row_text)

    full_text = "\n\n".join(paragraphs_text)
    clean = clean_and_normalize_text(full_text)
    if clean:
        # Split into logical ~1000-char chunks
        paragraphs = clean.split("\n\n")
        current_chunk = []
        current_len = 0
        chunk_idx = 0

        for p in paragraphs:
            current_chunk.append(p)
            current_len += len(p)
            if current_len >= 800:
                chunks.append(
                    ExtractedChunk(
                        chunk_index=chunk_idx,
                        text="\n\n".join(current_chunk),
                        page_number=chunk_idx + 1,
                    )
                )
                chunk_idx += 1
                current_chunk = []
                current_len = 0

        if current_chunk:
            chunks.append(
                ExtractedChunk(
                    chunk_index=chunk_idx,
                    text="\n\n".join(current_chunk),
                    page_number=chunk_idx + 1,
                )
            )

    return chunks


def extract_text_from_pptx(file_bytes: bytes, max_slides: int = 30) -> List[ExtractedChunk]:
    chunks: List[ExtractedChunk] = []
    prs = pptx.Presentation(io.BytesIO(file_bytes))
    slide_count = len(prs.slides)
    if slide_count > max_slides:
        raise ValueError(f"Presentation exceeds maximum limit of {max_slides} slides (has {slide_count} slides).")

    for idx, slide in enumerate(prs.slides):
        slide_texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_texts.append(shape.text.strip())
        combined = "\n".join(slide_texts)
        clean = clean_and_normalize_text(combined)
        if clean:
            chunks.append(ExtractedChunk(chunk_index=idx, text=clean, page_number=idx + 1))
    return chunks


def extract_text_from_txt(file_bytes: bytes) -> List[ExtractedChunk]:
    try:
        decoded = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        decoded = file_bytes.decode("latin-1")

    clean = clean_and_normalize_text(decoded)
    chunks: List[ExtractedChunk] = []
    # Segment into ~1000 char chunks
    paras = clean.split("\n\n")
    cur = []
    cur_len = 0
    idx = 0
    for p in paras:
        cur.append(p)
        cur_len += len(p)
        if cur_len >= 800:
            chunks.append(ExtractedChunk(chunk_index=idx, text="\n\n".join(cur), page_number=idx + 1))
            idx += 1
            cur = []
            cur_len = 0
    if cur:
        chunks.append(ExtractedChunk(chunk_index=idx, text="\n\n".join(cur), page_number=idx + 1))
    return chunks
