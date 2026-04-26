"""Pydantic models — source of truth for the retrieval contract.

Mirrors the style of ``agents/lesson_plan/schemas.py``: every model is
``extra="forbid"``, every field is bounded where possible, and no
``Optional`` field carries a default per google-genai issue #699
(structured-output coercion eats defaulted-Optional fields).

Phase 4 §4.1 deliverable. Plan: ``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Same 11-language enum the lesson-plan writer accepts. Retrieval
# echoes whatever the writer requested so a Hindi lesson plan retrieves
# Hindi chunks (or falls back to English when ``lang_not_indexed``).
RetrievalLanguage = Literal[
    "en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "pa", "ml", "or"
]

# NCERT subjects we ingest in v1. Constrained so a typo at the call
# site is caught at the edge, not silently retrieved against the wrong
# corpus partition.
NcertSubject = Literal[
    "science",
    "mathematics",
    "english",
    "hindi",
    "social_science",
    "history",
    "geography",
    "civics",
    "environmental_studies",
]


# --- Query --------------------------------------------------------------


class RetrievalQuery(BaseModel):
    """Input to the retriever.

    The ``class_number`` and ``subject`` fields are HARD filters at
    query time — Vector Search applies them as required predicates,
    not as post-filters. A Class-5 Science request must never see a
    Class-9 Math chunk regardless of embedding similarity.

    Phase 4 §Retrieval pattern.
    """

    model_config = ConfigDict(extra="forbid")

    query_text: str = Field(min_length=1, max_length=2000)
    language: RetrievalLanguage
    class_number: int = Field(ge=1, le=12)
    subject: NcertSubject
    chapter_number: int | None = Field(ge=1, le=30)
    top_k: int = Field(ge=1, le=20)


# --- Retrieved chunk ----------------------------------------------------


class RetrievedChunk(BaseModel):
    """One chunk returned from the vector store + BM25 rerank pipeline.

    The ``score`` is the post-rerank composite (cosine fused with
    BM25); ``vector_score`` and ``bm25_score`` are exposed for
    observability + downstream calibration.

    Phase 4 §4.3.
    """

    model_config = ConfigDict(extra="forbid")

    chunk_text: str = Field(min_length=1, max_length=4000)
    subject: NcertSubject
    class_number: int = Field(ge=1, le=12)
    chapter_number: int = Field(ge=1, le=30)
    chapter_title: str = Field(min_length=1, max_length=300)
    language: RetrievalLanguage
    source_url: str = Field(min_length=1, max_length=500)
    page_start: int = Field(ge=1, le=1000)
    page_end: int = Field(ge=1, le=1000)
    edition: str = Field(min_length=1, max_length=20)
    score: float = Field(ge=0.0, le=1.0)
    vector_score: float = Field(ge=0.0, le=1.0)
    bm25_score: float = Field(ge=0.0)


# --- Retrieval result --------------------------------------------------


class RetrievalContext(BaseModel):
    """What the retriever hands back to the lesson-plan router.

    ``chunks`` is empty when the language is not indexed yet — the
    router treats an empty list as the ``lang_not_indexed`` graceful-
    degradation path (writer falls back to grade-level alignment, the
    evaluator scores ``ncert_alignment`` against the
    ``ncertChapter.title`` + ``learningOutcomes`` only).

    Phase 4 §Risks/Language coverage gaps.
    """

    model_config = ConfigDict(extra="forbid")

    chunks: list[RetrievedChunk] = Field(max_length=20)
    query_latency_ms: int = Field(ge=0, le=10_000)
    rerank_latency_ms: int = Field(ge=0, le=10_000)
    embedding_model: str = Field(min_length=1, max_length=100)
    fallback_reason: str | None = Field(max_length=200)


__all__ = [
    "NcertSubject",
    "RetrievalContext",
    "RetrievalLanguage",
    "RetrievalQuery",
    "RetrievedChunk",
]
