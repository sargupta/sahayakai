"""Retrieval-Augmented Generation primitives for the lesson-plan writer.

Phase 4 grounds the Phase 3 writer-evaluator-reviser loop in retrieved
NCERT chapter text. This package owns the retrieval side of that
pipeline: query schemas, embeddings, vector search, and the one-time
corpus-ingestion driver. The agents/ package is responsible for
plumbing retrieval results into the writer prompt and the evaluator
rubric (`ncert_alignment` axis).

Plan: ``.claude/plans/phase-4-rag-ncert.md``.

Public re-exports:
    - ``RetrievalQuery``, ``RetrievedChunk``, ``RetrievalContext`` from
      ``schemas`` — Pydantic v2 contracts for the retrieval API.
    - ``Retriever``, ``VectorSearchRetriever`` from ``retriever`` — the
      runtime contract used by the lesson-plan router.
    - ``embed_query`` from ``embeddings`` — Vertex AI multilingual
      embedding wrapper pinned to ``text-multilingual-embedding-002@001``.
"""
from __future__ import annotations

from .embeddings import embed_query
from .retriever import Retriever, VectorSearchRetriever
from .schemas import RetrievalContext, RetrievalQuery, RetrievedChunk

__all__ = [
    "RetrievalContext",
    "RetrievalQuery",
    "RetrievedChunk",
    "Retriever",
    "VectorSearchRetriever",
    "embed_query",
]
