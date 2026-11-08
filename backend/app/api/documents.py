import logging
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import get_ai_provider
from app.core.config import settings
from app.core.database import async_session_maker, get_db
from app.core.deps import get_current_user, require_registered_user
from app.models.all_models import Document, DocumentChunk, User
from app.schemas.documents import DocumentResponse, DocumentStatusResponse
from app.services.extractors import (
    extract_text_from_docx,
    extract_text_from_pdf,
    extract_text_from_pptx,
    extract_text_from_txt,
    validate_file_header,
)
from app.services.ingestion import check_text_quality

logger = logging.getLogger("studydungeon.documents")
documents_router = APIRouter(prefix="/documents", tags=["documents"])


async def process_document_background(
    doc_id: str,
    file_bytes: bytes,
    file_type: str,
    session: Optional[AsyncSession] = None,
):
    """Async background ingestion worker."""
    async def _worker(db: AsyncSession):
        res = await db.execute(select(Document).where(Document.id == doc_id))
        doc = res.scalar_one_or_none()
        if not doc:
            return

        try:
            # 1. Extraction
            chunks = []
            if file_type == "pdf":
                chunks = extract_text_from_pdf(file_bytes)
            elif file_type == "docx":
                chunks = extract_text_from_docx(file_bytes)
            elif file_type == "pptx":
                chunks = extract_text_from_pptx(file_bytes)
            elif file_type == "txt":
                chunks = extract_text_from_txt(file_bytes)
            elif file_type == "image":
                ai = get_ai_provider()
                ocr_text = await ai.ocr_image(file_bytes)
                from app.ai.provider import ExtractedChunk
                chunks = [ExtractedChunk(chunk_index=0, text=ocr_text, page_number=1)]

            all_text = "\n\n".join([c.text for c in chunks])

            # 2. Deterministic Quality Check
            quality = check_text_quality(all_text, min_chars=300)
            if not quality.is_valid:
                doc.status = "rejected"
                doc.rejection_reason = quality.error_message
                await db.commit()
                return

            # 3. AI Relevance Gate
            ai = get_ai_provider()
            check = await ai.classify_document(all_text[:4000])
            doc.relevance_score = check.educational_content_score
            doc.readability_score = check.readability_score

            if not check.is_study_material or check.educational_content_score < 0.70 or check.readability_score < 0.65:
                doc.status = "rejected"
                doc.rejection_reason = check.rejection_reason or "The document does not meet the educational quality threshold for study dungeon generation."
                await db.commit()
                return

            # 4. Save Chunks
            for c in chunks:
                chunk_record = DocumentChunk(
                    document_id=doc.id,
                    user_id=doc.user_id,
                    chunk_index=c.chunk_index,
                    text=c.text,
                    page_number=c.page_number,
                )
                db.add(chunk_record)

            doc.status = "accepted"
            await db.commit()

        except Exception as e:
            logger.error("Document background processing error: %s", str(e), exc_info=True)
            doc.status = "failed"
            doc.rejection_reason = f"Extraction error: {str(e)}"
            await db.commit()

    if session is not None:
        await _worker(session)
    else:
        async with async_session_maker() as db:
            await _worker(db)


@documents_router.post("", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    # 1. Enforce quota: max 5 active documents per user
    count_res = await db.execute(
        select(func.count(Document.id)).where(Document.user_id == user.id)
    )
    current_docs = count_res.scalar() or 0
    if current_docs >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "QUOTA_EXCEEDED", "message": "Maximum active document quota of 5 reached. Please delete an older document first."},
        )

    # 2. Read bytes and check size
    file_bytes = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB."},
        )

    # 3. Validate header & signature
    try:
        file_type = validate_file_header(file.filename or "unknown", file_bytes)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "UNSUPPORTED_FILE_TYPE", "message": str(e)},
        )

    # 4. Create document in processing state
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        user_id=user.id,
        title=file.filename or "Untitled Document",
        original_filename=file.filename or "uploaded_file",
        file_type=file_type,
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # 5. Kick off background processing
    background_tasks.add_task(process_document_background, doc.id, file_bytes, file_type)

    return {"id": doc.id, "status": "processing", "message": "Document accepted for processing."}


@documents_router.get("", response_model=List[DocumentResponse])
async def list_documents(
    user: User = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    return res.scalars().all()


@documents_router.get("/{id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Document).where(Document.id == id, Document.user_id == user.id))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found or does not belong to user."},
        )

    chunks_count = 0
    if doc.status == "accepted":
        cnt_res = await db.execute(
            select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == doc.id)
        )
        chunks_count = cnt_res.scalar() or 0

    return DocumentStatusResponse(
        id=doc.id,
        status=doc.status,
        relevance_score=doc.relevance_score,
        readability_score=doc.readability_score,
        rejection_reason=doc.rejection_reason,
        chunks_count=chunks_count,
    )


@documents_router.get("/{id}/source-preview")
async def get_source_preview(
    id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Source preview citations: scoped to owner or public demo document.
    Returns 1-based page numbers and stable chunk IDs.
    """
    from app.models.all_models import Dungeon
    # Check if this document belongs to user OR belongs to the public demo dungeon
    doc_res = await db.execute(select(Document).where(Document.id == id))
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found."})

    is_demo_doc = False
    dungeon_res = await db.execute(select(Dungeon).where(Dungeon.document_id == doc.id, Dungeon.is_public_demo == True))
    if dungeon_res.scalar_one_or_none():
        is_demo_doc = True

    if not is_demo_doc and doc.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found or does not belong to user."})

    chunks_res = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index.asc())
    )
    chunks = chunks_res.scalars().all()

    return {
        "document_id": doc.id,
        "title": doc.title,
        "chunks": [
            {
                "chunk_id": c.id,
                "chunk_index": c.chunk_index,
                "page_number": c.page_number if c.page_number else c.chunk_index + 1,
                "text": c.text,
            }
            for c in chunks
        ],
    }


@documents_router.delete("/{id}")
async def delete_document(
    id: str,
    user: User = Depends(require_registered_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Document).where(Document.id == id, Document.user_id == user.id))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found or does not belong to user."},
        )

    await db.delete(doc)
    await db.commit()
    return {"success": True, "message": "Document and all associated chunks deleted."}
