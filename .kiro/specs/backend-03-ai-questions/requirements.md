# Spec 03: AI Topic & Question Generation

## Requirements
1. Cluster document chunks into 2–6 coherent topics.
2. Generate 5–8 high quality MCQs and True/False questions per topic.
3. Every question must include an exact verbatim `evidence_quote` verified against the cited chunk.
4. Structured Pydantic validation for zero-hallucination question banks.
5. Ingest-time generation only; 0 AI calls during active combat.

