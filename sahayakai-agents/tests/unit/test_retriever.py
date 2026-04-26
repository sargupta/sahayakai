"""Placeholder tests for the retriever Protocol + VectorSearchRetriever.

The whole file is skip-marked until Phase 4.3 lands the retrieval
implementation. The file still imports cleanly today so CI's collect
step does not break, and the skip reason makes the gate explicit.

Phase 4 §4.6. Plan: ``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.rag.retriever import Retriever, VectorSearchRetriever

pytestmark = pytest.mark.unit


@pytest.mark.skip(reason="Phase 4.3 not implemented yet")
def test_vector_search_retriever_honours_hard_filter() -> None:
    """When Phase 4.3 lands, this asserts the retriever NEVER returns
    a chunk whose ``class_number`` or ``subject`` differs from the
    query — even if a higher-similarity chunk exists in another
    partition.
    """
    retriever: Retriever = VectorSearchRetriever(
        index_endpoint="projects/test/locations/asia-south1/indexEndpoints/x",
        deployed_index_id="ncert-v1",
    )
    # TODO Phase 4.3: drive `retriever.retrieve(...)` with a fake
    # Vector Search backend and assert the hard-filter contract.
    assert retriever is not None
