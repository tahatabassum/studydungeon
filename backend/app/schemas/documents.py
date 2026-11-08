from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    title: str
    original_filename: str
    file_type: str
    status: str
    relevance_score: Optional[float] = None
    readability_score: Optional[float] = None
    rejection_reason: Optional[str] = None
    created_at: datetime


class DocumentStatusResponse(BaseModel):
    id: str
    status: str  # processing, accepted, rejected, failed
    relevance_score: Optional[float] = None
    readability_score: Optional[float] = None
    rejection_reason: Optional[str] = None
    chunks_count: int = 0
