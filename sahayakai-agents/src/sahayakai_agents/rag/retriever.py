"""Retriever protocol + Vertex AI Vector Search implementation.

The lesson-plan router depends on the ``Retriever`` Protocol — never on
the concrete ``VectorSearchRetriever`` class — so tests can substitute
a fake retriever without touching Vertex AI. The Protocol contract is
narrow on purpose: one async method that takes a query and returns a
context, no configuration mutation through the public surface.

**Hard-filter contract.** Both implementations MUST apply
``class_number`` and ``subject`` as required Vector Search predicates,
not as post-filters. A Class-5 Science request that retrieves a
Class-9 Math chunk because the embedding similarity was high is a
correctness bug, not a quality issue. The fake retriever in tests
must enforce the same invariant.

Phase 4 §4.3. Plan: ``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from .schemas import RetrievalContext, RetrievalQuery


@runtime_checkable
class Retriever(Protocol):
    """The runtime contract used by the lesson-plan router.

    Any implementation MUST honour the hard-filter contract: chunks
    returned MUST match the query's ``class_number`` and ``subject``
    exactly. The Protocol cannot enforce that statically — integration
    tests in §4.6 assert it explicitly.
    """

    async def retrieve(self, query: RetrievalQuery) -> RetrievalContext:
        """Run retrieval against the corpus.

        Returns a ``RetrievalContext`` whose ``chunks`` list is at most
        ``query.top_k`` long. Empty chunks indicate the
        ``lang_not_indexed`` fallback path; the router treats this as
        graceful degradation, not an error.
        """
        ...


class VectorSearchRetriever:
    """Vertex AI Vector Search retriever pinned to ``asia-south1``.

    Two-stage pipeline per Phase 4 §Retrieval pattern:

    1. Embed the query via ``embeddings.embed_query``.
    2. Vector Search with hard filters on ``class_number`` and
       ``subject`` (and on ``language`` when the index has the
       requested language; falls back to English with
       ``fallback_reason="lang_not_indexed"`` otherwise). Returns
       top-20 by cosine.
    3. BM25 rerank in-process over those 20 chunks against
       ``query.query_text`` to surface exact-token matches that the
       embedding may have missed.
    4. Return top-``query.top_k`` from the reranked list.
    """

    def __init__(self, *, index_endpoint: str, deployed_index_id: str) -> None:
        """Construct the retriever.

        Args:
            index_endpoint: Resource name of the Vector Search index
                endpoint, e.g.
                ``projects/.../locations/asia-south1/indexEndpoints/...``.
            deployed_index_id: ID of the deployed index inside the
                endpoint. One endpoint can host multiple deployed
                indexes (e.g. one per corpus version).
        """
        # TODO Phase 4.3: store config, lazy-init the Vertex client on
        # first call.
        self._index_endpoint = index_endpoint
        self._deployed_index_id = deployed_index_id

    async def retrieve(self, query: RetrievalQuery) -> RetrievalContext:
        """Implements the ``Retriever`` Protocol.

        Raises:
            NotImplementedError: Phase 4.3 — implementation lands
                with the corpus-ingest gate (§4.2) cleared.
        """
        # TODO Phase 4.3: embed → vector search (with hard filters) →
        # BM25 rerank → return RetrievalContext. Reference impl:
        # google-cloud-aiplatform's
        # `MatchingEngineIndexEndpoint.find_neighbors`.
        raise NotImplementedError(
            "Phase 4.3: VectorSearchRetriever not yet wired. "
            "Use a fake Retriever in tests until the corpus ingest "
            "(Phase 4.2) lands."
        )


__all__ = ["Retriever", "VectorSearchRetriever"]
