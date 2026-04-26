"""Vertex AI multilingual embedding wrapper.

Pinned to ``text-multilingual-embedding-002@001`` per Phase 4 §Embeddings —
auto-upgrades would silently invalidate stored chunk vectors. The Vertex
client is imported lazily inside ``embed_query`` so import paths that do
not exercise embedding (unit tests, pure schema validation) do not pay
the SDK init cost or fail when ``google-cloud-aiplatform`` is absent
from the dev environment.

Phase 4 §4.3. Plan: ``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

EMBEDDING_MODEL = "text-multilingual-embedding-002@001"
EMBEDDING_DIM = 768
EMBEDDING_REGION = "asia-south1"


def embed_query(text: str, language: str) -> list[float]:
    """Embed a single retrieval query.

    Args:
        text: The natural-language query, typically derived from the
            lesson-plan request's ``topic`` plus ``ncertChapter.title``
            plus key learning outcomes. Length-bounded by the
            ``RetrievalQuery.query_text`` schema (max 2000 chars).
        language: ISO-639-1 two-letter code from
            ``RetrievalLanguage``. Passed to Vertex so the embedding is
            taken in the same script as the indexed chunks; mismatched
            scripts collapse cosine similarity.

    Returns:
        A 768-dim float vector. Caller hands this to Vector Search as
        the query embedding.

    Raises:
        NotImplementedError: Phase 4.2 — implementation lands when the
            Vertex client wiring is in place.
    """
    # TODO Phase 4.2: implement via google-cloud-aiplatform's
    # `TextEmbeddingModel.from_pretrained(EMBEDDING_MODEL)` with
    # `location=EMBEDDING_REGION`. Lazy-import the SDK here so test
    # paths that mock the retriever do not require the dependency.
    raise NotImplementedError(
        "Phase 4.2: Vertex AI embedding wiring not yet implemented. "
        f"Will use {EMBEDDING_MODEL} in {EMBEDDING_REGION}."
    )


__all__ = ["EMBEDDING_DIM", "EMBEDDING_MODEL", "EMBEDDING_REGION", "embed_query"]
