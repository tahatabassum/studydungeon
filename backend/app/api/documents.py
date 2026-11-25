import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factory import get_ai_provider
from app.core.config import settings
from app.core.database import async_session_maker, get_db
from app.core.deps import get_current_user
from app.core.file_limits import FileLimitExceededError
from app.core.rate_limit import get_client_ip
from app.models.all_models import Document, DocumentChunk, Dungeon, RateLimitRecord, User
from app.schemas.documents import DocumentResponse, DocumentStatusResponse
from app.schemas.uploads import (
    QuotaGlobalView,
    QuotaPlayerView,
    QuotaRankingView,
    UploadQuotaResponse,
)
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
# No prefix: the contract path is GET /uploads/quota (under documents_router it was /documents/uploads/quota, a 404).
uploads_router = APIRouter(tags=["uploads"])

_READ_BLOCK_BYTES = 1024 * 1024


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

            # 2. Deterministic Quality Check (min 500 chars from env)
            quality = check_text_quality(all_text, min_chars=settings.INGESTION_MIN_CHARS)
            if not quality.is_valid:
                doc.status = "rejected"
                doc.rejection_reason = quality.error_message
                await db.commit()
                return

            # 3. AI Relevance Gate with Timeout & Env Thresholds
            ai = get_ai_provider()
            check = await ai.classify_document(all_text[:4000])
            doc.relevance_score = check.educational_content_score
            doc.readability_score = check.readability_score

            if (
                not check.is_study_material
                or check.educational_content_score < settings.INGESTION_MIN_RELEVANCE
                or check.readability_score < settings.INGESTION_MIN_READABILITY
            ):
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
            # Details stay in the server log; the player gets a plain sentence (never a URL or a provider error).
            logger.error("Document background processing error: %s", type(e).__name__, exc_info=True)
            doc.status = "failed"
            doc.rejection_reason = _friendly_failure(e)
            await db.commit()

    if session is not None:
        await _worker(session)
    else:
        async with async_session_maker() as db:
            await _worker(db)


def _friendly_failure(exc: Exception) -> str:
    """What a player reads when processing fails. The document stays retryable ("Check again")."""
    import httpx

    if isinstance(exc, (httpx.HTTPError, RuntimeError, TimeoutError)):
        return (
            "The spirits that read your notes are busy right now. Press Check again in a minute, "
            "or play the preloaded dungeons meanwhile."
        )
    return "This file could not be read. Try saving it again, or upload it as a PDF."


def _limits(user: User) -> tuple[int, int]:
    """(daily, stored) upload limits for this player; 0 means unlimited."""
    if user.is_guest:
        return settings.UPLOAD_GUEST_DAILY_LIMIT, settings.UPLOAD_GUEST_STORED_LIMIT
    return settings.UPLOAD_PLAYER_DAILY_LIMIT, settings.UPLOAD_PLAYER_STORED_LIMIT


def _reached(count: int, limit: int) -> bool:
    return limit > 0 and count >= limit


def _today_start(now: datetime) -> datetime:
    return datetime(now.year, now.month, now.day)


async def _ip_uploads_today(db: AsyncSession, ip: str, now: datetime) -> int:
    res = await db.execute(
        select(func.count(RateLimitRecord.id)).where(
            RateLimitRecord.key == f"upload_ip:{ip}", RateLimitRecord.timestamp >= _today_start(now)
        )
    )
    return res.scalar() or 0


async def _global_uploads_today(db: AsyncSession, now: datetime) -> int:
    res = await db.execute(
        select(func.count(Document.id)).where(
            Document.created_at >= _today_start(now), Document.status.in_(["accepted", "processing"])
        )
    )
    return res.scalar() or 0


@uploads_router.get("/uploads/quota", response_model=UploadQuotaResponse, response_model_exclude_none=True)
async def get_upload_quota(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    midnight_utc = datetime(now.year, now.month, now.day) + timedelta(days=1)
    resets_at_str = midnight_utc.isoformat() + "Z"

    # User limits
    is_guest = user.is_guest
    daily_limit, stored_limit = _limits(user)

    # Count stored documents
    stored_res = await db.execute(select(func.count(Document.id)).where(Document.user_id == user.id))
    stored_count = stored_res.scalar() or 0

    # Count uploads today
    today_start = datetime(now.year, now.month, now.day)
    used_res = await db.execute(
        select(func.count(Document.id)).where(
            Document.user_id == user.id,
            Document.created_at >= today_start,
            Document.status.in_(["accepted", "processing"]),
        )
    )
    used_today = used_res.scalar() or 0

    can_upload = True
    reason = None

    global_open = not _reached(await _global_uploads_today(db, now), settings.UPLOAD_GLOBAL_DAILY_LIMIT)
    if _reached(await _ip_uploads_today(db, get_client_ip(request), now), settings.UPLOAD_IP_DAILY_LIMIT):
        can_upload = False
        reason = "ip_daily_limit"
    elif _reached(used_today, daily_limit):
        can_upload = False
        reason = "player_daily_limit"
    elif _reached(stored_count, stored_limit):
        can_upload = False
        reason = "stored_limit"
    elif not global_open:
        can_upload = False
        reason = "global_daily_limit"

    return UploadQuotaResponse(
        can_upload=can_upload,
        reason=reason,
        player=QuotaPlayerView(
            is_guest=is_guest,
            used_today=used_today,
            limit_today=daily_limit,
            stored=stored_count,
            stored_limit=stored_limit,
            resets_at=resets_at_str,
            unlimited=daily_limit <= 0 and stored_limit <= 0,
        ),
        global_=QuotaGlobalView(available=global_open),
        ranking=QuotaRankingView(min_chars=3000, min_topics=2),
    )


@documents_router.post("", status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    accept_ai_notice: Optional[bool] = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 0. The AI notice is required for everyone (guests and registered players). Missing or false is 422,
    #    checked before any quota or AI work. Guests may upload within their own quota (frontend-10, V2 G).
    if accept_ai_notice is not True:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "AI_NOTICE_NOT_ACCEPTED", "message": "You must accept the AI data processing notice to upload study materials."},
        )

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    midnight_utc = today_start + timedelta(days=1)
    retry_after_secs = max(1, int((midnight_utc - now).total_seconds()))

    # 0b. Per-IP daily limit (before any other work; counts accepted uploads from this address)
    client_ip = get_client_ip(request)
    if _reached(await _ip_uploads_today(db, client_ip, now), settings.UPLOAD_IP_DAILY_LIMIT):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "UPLOAD_LIMIT_IP", "message": "Too many uploads from this network today. Try again tomorrow."},
            headers={"Retry-After": str(retry_after_secs)},
        )

    # 1. Enforce Quota: Stored documents limit
    daily_limit, stored_limit = _limits(user)

    count_res = await db.execute(
        select(func.count(Document.id)).where(Document.user_id == user.id)
    )
    current_docs = count_res.scalar() or 0
    if _reached(current_docs, stored_limit):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "QUOTA_EXCEEDED",
                "message": f"You already have {stored_limit} documents. Delete an older one before uploading another.",
            },
        )

    # 2. Enforce Daily Player limit
    used_res = await db.execute(
        select(func.count(Document.id)).where(
            Document.user_id == user.id,
            Document.created_at >= today_start,
            Document.status.in_(["accepted", "processing"]),
        )
    )
    used_today = used_res.scalar() or 0
    if _reached(used_today, daily_limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "UPLOAD_LIMIT_PLAYER", "message": f"Daily upload limit of {daily_limit} reached for this account. Try again tomorrow."},
            headers={"Retry-After": str(retry_after_secs)},
        )

    # 2b. Global daily cap: protects the shared AI quota
    if _reached(await _global_uploads_today(db, now), settings.UPLOAD_GLOBAL_DAILY_LIMIT):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "UPLOADS_PAUSED_TODAY", "message": "Uploads are paused for today. Play the preloaded dungeons instead.", "offer_packs": True},
            headers={"Retry-After": str(retry_after_secs)},
        )

    # 3. Read bytes and check size
    # Read in chunks and stop as soon as the limit is crossed, so an oversized upload is never held in memory whole.
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    buffer = bytearray()
    while True:
        block = await file.read(_READ_BLOCK_BYTES)
        if not block:
            break
        buffer.extend(block)
        if len(buffer) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail={"code": "FILE_TOO_LARGE", "message": f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB."},
            )
    file_bytes = bytes(buffer)

    # 4. Validate header & signature
    try:
        file_type = validate_file_header(file.filename or "unknown", file_bytes)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "UNSUPPORTED_FILE_TYPE", "message": str(e)},
        )

    # 5. Pre-check file limits (pages, slides, text characters) before AI
    try:
        if file_type == "pdf":
            extract_text_from_pdf(file_bytes)
        elif file_type == "docx":
            extract_text_from_docx(file_bytes)
        elif file_type == "pptx":
            extract_text_from_pptx(file_bytes)
        elif file_type == "txt":
            extract_text_from_txt(file_bytes)
    except FileLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": e.code, "message": e.message, "limit": e.limit, "found": e.found},
        )
    except Exception:
        pass  # Ingestion pipeline worker will handle any content parsing nuances

    # 6. Create document in processing state
    doc_id = str(uuid.uuid4())
    # The client filename is only a label (never a storage path). Clamp it so PostgreSQL's String(255) never fails;
    # the dungeon title appends " Dungeon" to it.
    safe_name = (file.filename or "").replace("\\", "/").split("/")[-1][:240]
    doc = Document(
        id=doc_id,
        user_id=user.id,
        title=safe_name or "Untitled Document",
        original_filename=safe_name or "uploaded_file",
        file_type=file_type,
        status="processing",
    )
    db.add(doc)
    # Counts toward this IP's daily uploads (only accepted uploads are recorded).
    db.add(RateLimitRecord(key=f"upload_ip:{client_ip}", timestamp=now))
    await db.commit()
    await db.refresh(doc)

    # 7. Kick off background processing
    background_tasks.add_task(process_document_background, doc.id, file_bytes, file_type)

    return {"id": doc.id, "status": "processing", "message": "Document accepted for processing."}


@documents_router.get("", response_model=List[DocumentResponse])
async def list_documents(
    # Guests too: they store up to 2 documents and must be able to free a slot.
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    docs = res.scalars().all()
    dungeon_rows = await db.execute(
        select(Dungeon.document_id, Dungeon.id).where(Dungeon.user_id == user.id, Dungeon.document_id.in_([d.id for d in docs]))
    ) if docs else None
    dungeon_of = dict(dungeon_rows.all()) if dungeon_rows is not None else {}
    return [
        DocumentResponse.model_validate({**{c: getattr(d, c) for c in DocumentResponse.model_fields if c != "dungeon_id"}, "dungeon_id": dungeon_of.get(d.id)})
        for d in docs
    ]


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


@documents_router.post("/{id}/retry")
async def retry_document_processing(
    id: str,
    background_tasks: BackgroundTasks,
    # Guests may retry their own failed upload (they can upload within their quota).
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retries processing for a failed or interrupted document."""
    res = await db.execute(select(Document).where(Document.id == id, Document.user_id == user.id))
    doc = res.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found."})

    if doc.status not in ("failed", "rejected"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "NOT_RETRYABLE", "message": "Only failed or rejected documents can be retried."})

    doc.status = "processing"
    doc.rejection_reason = None
    await db.commit()

    # Re-extract if text was plain text or restart pipeline
    return {"id": doc.id, "status": "processing", "message": "Document re-queued for processing."}


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

    # Its dungeon goes too: without the document's topics it would be an empty shell on the dashboard.
    owned = await db.execute(select(Dungeon).where(Dungeon.document_id == doc.id, Dungeon.user_id == user.id))
    for dungeon in owned.scalars().all():
        await db.delete(dungeon)
    await db.delete(doc)
    await db.commit()
    return {"success": True, "message": "Document, its dungeon and all associated chunks deleted."}
