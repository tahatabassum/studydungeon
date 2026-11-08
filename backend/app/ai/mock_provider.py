from typing import List

from app.ai.provider import DocumentCheck, ExtractedChunk, GeneratedQuestionItem, GeneratedTopicItem


class MockAIProvider:
    def __init__(self, should_reject: bool = False, fail_questions: bool = False):
        self.should_reject = should_reject
        self.fail_questions = fail_questions

    async def classify_document(self, text_sample: str) -> DocumentCheck:
        if self.should_reject or "meme" in text_sample.lower() or "receipt" in text_sample.lower():
            return DocumentCheck(
                is_study_material=False,
                educational_content_score=0.20,
                readability_score=0.40,
                rejection_reason="The uploaded file does not appear to contain educational study material.",
            )
        return DocumentCheck(
            is_study_material=True,
            subject="Computer Science",
            document_type="Lecture Notes",
            educational_content_score=0.95,
            readability_score=0.90,
        )

    async def ocr_image(self, image_bytes: bytes, mime_type: str = "image/png") -> str:
        return "Simulated OCR text extracted from scanned page or image diagram."

    async def build_topics_and_questions(
        self, chunks: List[ExtractedChunk]
    ) -> List[GeneratedTopicItem]:
        if self.fail_questions:
            return []

        # Grounded questions using verbatim quotes from chunks
        topic_1_quote = chunks[0].text[:80] if chunks else "Default fallback quote."
        return [
            GeneratedTopicItem(
                name="Core Principles",
                description="Fundamental concepts introduced in the reading.",
                source_chunk_ids=[c.chunk_index for c in chunks[:1]],
                questions=[
                    GeneratedQuestionItem(
                        prompt="What is the primary topic covered in this section?",
                        options=["Core Principles", "Ancient History", "Culinary Arts", "Botany"],
                        correct_option=0,
                        difficulty="easy",
                        evidence_quote=topic_1_quote,
                        explanation="Directly referenced in the introduction.",
                    ),
                    GeneratedQuestionItem(
                        prompt="Which execution model is described in the text?",
                        options=["Context Switching", "Manual Reset", "Paper Punch", "None"],
                        correct_option=0,
                        difficulty="medium",
                        evidence_quote=topic_1_quote,
                        explanation="Processes use context switching across execution blocks.",
                    ),
                ],
            )
        ]
