from typing import List, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, Field


class DocumentCheck(BaseModel):
    is_study_material: bool
    subject: str = "General"
    document_type: str = "Notes"
    educational_content_score: float = Field(..., ge=0.0, le=1.0)
    readability_score: float = Field(..., ge=0.0, le=1.0)
    rejection_reason: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class ExtractedChunk(BaseModel):
    chunk_index: int
    text: str
    page_number: int


class GeneratedQuestionItem(BaseModel):
    prompt: str
    options: List[str]
    correct_option: int
    difficulty: str  # easy, medium, hard
    evidence_quote: str
    explanation: str


class GeneratedTopicItem(BaseModel):
    name: str
    description: str
    source_chunk_ids: List[int]
    questions: List[GeneratedQuestionItem]


@runtime_checkable
class AIProvider(Protocol):
    async def classify_document(self, text_sample: str) -> DocumentCheck:
        """Classify document relevance, readability, and educational value."""
        ...

    async def ocr_image(self, image_bytes: bytes) -> str:
        """Extract text from an image or scanned page via multimodal vision."""
        ...

    async def build_topics_and_questions(
        self, chunks: List[ExtractedChunk]
    ) -> List[GeneratedTopicItem]:
        """Cluster chunks into 2-6 topics and generate grounded questions."""
        ...
