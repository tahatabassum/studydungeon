from typing import List

from pydantic import BaseModel, Field


class GeneratedQuestionItem(BaseModel):
    prompt: str = Field(description="The MCQ question prompt")
    options: List[str] = Field(description="Exactly 4 options for MCQ, or 2 for True/False")
    correct_option: int = Field(description="0-indexed index of correct option")
    evidence_quote: str = Field(description="Exact verbatim quote from the notes supporting this answer")
    explanation: str = Field(description="Brief explanation of why the answer is correct")
    difficulty: str = Field(default="medium", description="easy, medium, or hard")
    question_type: str = Field(default="mcq", description="mcq or tf")


class TopicQuestionBatch(BaseModel):
    topic_name: str
    topic_description: str
    questions: List[GeneratedQuestionItem]


class AIProviderInterface:
    async def check_relevance(self, extracted_text: str) -> dict:
        raise NotImplementedError

    async def generate_dungeon_topics_and_questions(
        self, chunks_with_metadata: List[dict]
    ) -> List[TopicQuestionBatch]:
        raise NotImplementedError

