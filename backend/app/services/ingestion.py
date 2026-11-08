import re
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class IngestionQualityCheck(BaseModel):
    is_valid: bool
    char_count: int
    readable_ratio: float
    error_message: Optional[str] = None


class GeminiRelevanceResult(BaseModel):
    is_study_material: bool
    document_type: str = Field(description="e.g. lecture_notes, textbook_excerpt, cheat_sheet, unrelated")
    subject: str = Field(description="Detected subject or field of study")
    topics: List[str] = Field(description="2 to 6 coherent topics identified in notes")
    educational_content_score: float = Field(description="Score between 0.0 and 1.0")
    readability_score: float = Field(description="Score between 0.0 and 1.0")
    reason: str = Field(description="Justification for acceptance or rejection")
    can_generate_questions: bool


class ExtractedSegment(BaseModel):
    text: str
    page_number: Optional[int] = None
    slide_number: Optional[int] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


def clean_and_normalize_text(text: str) -> str:
    # Normalize whitespaces and clean noisy characters
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def check_text_quality(text: str, min_chars: int = 200) -> IngestionQualityCheck:
    char_count = len(text)
    if char_count < min_chars:
        return IngestionQualityCheck(
            is_valid=False,
            char_count=char_count,
            readable_ratio=0.0,
            error_message=f"Document contains insufficient readable text ({char_count} chars). Minimum {min_chars} required.",
        )

    # Calculate printable ASCII/Unicode character ratio
    printable_chars = sum(1 for c in text if c.isprintable() or c in "\n\t")
    readable_ratio = printable_chars / max(1, char_count)

    if readable_ratio < 0.70:
        return IngestionQualityCheck(
            is_valid=False,
            char_count=char_count,
            readable_ratio=readable_ratio,
            error_message="Document contains too many unreadable or corrupted characters.",
        )

    return IngestionQualityCheck(
        is_valid=True,
        char_count=char_count,
        readable_ratio=readable_ratio,
    )

