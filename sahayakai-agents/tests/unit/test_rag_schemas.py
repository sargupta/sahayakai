"""Schema validation tests for the RAG retrieval contract.

One test per schema asserts ``extra="forbid"`` rejects unknown fields —
the same invariant the Genkit-side TypeScript codegen relies on so a
field added in TS but not Python (or vice-versa) fails CI loudly.

Phase 4 §4.6. Plan: ``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.rag.schemas import (
    RetrievalContext,
    RetrievalQuery,
    RetrievedChunk,
)

pytestmark = pytest.mark.unit


# ── Test helpers: minimal valid payloads ────────────────────────────────


def _valid_query_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = dict(
        query_text="photosynthesis class 5 light food",
        language="en",
        class_number=5,
        subject="science",
        chapter_number=7,
        top_k=5,
    )
    base.update(overrides)
    return base


def _valid_chunk_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = dict(
        chunk_text="Plants make food using sunlight, water, and carbon dioxide.",
        subject="science",
        class_number=5,
        chapter_number=7,
        chapter_title="How Do Plants Make Food?",
        language="en",
        source_url="https://ncert.nic.in/textbook/pdf/eesc107.pdf",
        page_start=42,
        page_end=43,
        edition="2024",
        score=0.87,
        vector_score=0.91,
        bm25_score=2.4,
    )
    base.update(overrides)
    return base


# ── RetrievalQuery ──────────────────────────────────────────────────────


class TestRetrievalQuery:
    def test_valid_minimum_payload(self) -> None:
        q = RetrievalQuery(**_valid_query_kwargs())  # type: ignore[arg-type]
        assert q.class_number == 5
        assert q.subject == "science"

    def test_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(**_valid_query_kwargs(unknown_field="oops"))  # type: ignore[arg-type]

    def test_rejects_class_zero(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(**_valid_query_kwargs(class_number=0))  # type: ignore[arg-type]

    def test_rejects_class_thirteen(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(**_valid_query_kwargs(class_number=13))  # type: ignore[arg-type]

    def test_rejects_unknown_subject(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(**_valid_query_kwargs(subject="philosophy"))  # type: ignore[arg-type]

    def test_top_k_upper_bound(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalQuery(**_valid_query_kwargs(top_k=21))  # type: ignore[arg-type]


# ── RetrievedChunk ──────────────────────────────────────────────────────


class TestRetrievedChunk:
    def test_valid_payload(self) -> None:
        c = RetrievedChunk(**_valid_chunk_kwargs())  # type: ignore[arg-type]
        assert c.score == 0.87
        assert c.page_start == 42

    def test_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            RetrievedChunk(**_valid_chunk_kwargs(extra_meta="oops"))  # type: ignore[arg-type]

    def test_rejects_score_above_one(self) -> None:
        with pytest.raises(ValidationError):
            RetrievedChunk(**_valid_chunk_kwargs(score=1.5))  # type: ignore[arg-type]

    def test_rejects_negative_bm25(self) -> None:
        with pytest.raises(ValidationError):
            RetrievedChunk(**_valid_chunk_kwargs(bm25_score=-0.1))  # type: ignore[arg-type]


# ── RetrievalContext ────────────────────────────────────────────────────


class TestRetrievalContext:
    def test_valid_empty_chunks(self) -> None:
        # Empty chunks is the lang_not_indexed graceful-degradation
        # path; the schema must accept it.
        ctx = RetrievalContext(
            chunks=[],
            query_latency_ms=42,
            rerank_latency_ms=0,
            embedding_model="text-multilingual-embedding-002@001",
            fallback_reason="lang_not_indexed",
        )
        assert ctx.chunks == []
        assert ctx.fallback_reason == "lang_not_indexed"

    def test_valid_with_chunks(self) -> None:
        ctx = RetrievalContext(
            chunks=[RetrievedChunk(**_valid_chunk_kwargs())],  # type: ignore[arg-type]
            query_latency_ms=120,
            rerank_latency_ms=8,
            embedding_model="text-multilingual-embedding-002@001",
            fallback_reason=None,
        )
        assert len(ctx.chunks) == 1

    def test_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            RetrievalContext(
                chunks=[],
                query_latency_ms=0,
                rerank_latency_ms=0,
                embedding_model="x",
                fallback_reason=None,
                undocumented_telemetry=True,  # type: ignore[call-arg]
            )

    def test_rejects_chunks_overflow(self) -> None:
        too_many = [RetrievedChunk(**_valid_chunk_kwargs()) for _ in range(21)]  # type: ignore[arg-type]
        with pytest.raises(ValidationError):
            RetrievalContext(
                chunks=too_many,
                query_latency_ms=0,
                rerank_latency_ms=0,
                embedding_model="x",
                fallback_reason=None,
            )
