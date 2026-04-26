"""One-time corpus ingestion pipeline for NCERT textbooks.

Driver script lives at ``sahayakai-agents/scripts/ingest_ncert.py``;
this module owns the per-PDF unit operations the script composes:

    PDF  ──►  ingest_pdf  ──►  chunk_text  ──►  embed_and_upload
              (pdfplumber)     (~512 tok,        (Vertex Vector
                                64 overlap)      Search upsert)

Each step is **idempotent** by design: ``ingest_pdf`` is keyed by
PDF SHA-256 so re-running on a stable corpus is a no-op; the
manifest at ``data/ncert_manifest.json`` carries the SHA gate.

Phase 4 §Ingestion pipeline. Plan:
``.claude/plans/phase-4-rag-ncert.md``.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Chunking constants — pinned per Phase 4 §Ingestion pipeline.
# 512 tokens fits the embedding model input window with margin; 64
# overlap preserves cross-chunk continuity for paragraph-spanning
# passages without inflating storage cost.
CHUNK_SIZE_TOKENS = 512
CHUNK_OVERLAP_TOKENS = 64


@dataclass(frozen=True)
class Chunk:
    """One ingestion-time chunk before embedding.

    Mirrors the fields stored alongside the vector in Vector Search;
    ``text`` is later replaced by the 768-dim embedding when the chunk
    is upserted, but the metadata travels with the vector.

    The runtime equivalent — what the retriever returns — is
    ``schemas.RetrievedChunk``; the two diverge only in that
    ``RetrievedChunk`` carries the post-rerank score fields.
    """

    text: str
    subject: str
    class_number: int
    chapter_number: int
    chapter_title: str
    language: str
    source_url: str
    page_start: int
    page_end: int
    edition: str
    sha256: str


def ingest_pdf(path: Path) -> list[Chunk]:
    """Extract text from one NCERT PDF and chunk it.

    Implementation outline (§Ingestion pipeline):

    1. Compute SHA-256 of the PDF bytes — used as the idempotency key.
    2. Run ``pdfplumber`` page-by-page to extract layout-aware text.
    3. For pages where ``pdfplumber`` returns < 100 chars, fall back
       to Document AI OCR (older scanned editions).
    4. Dehyphenate (NCERT PDFs hard-wrap with hyphens at column ends).
    5. Pass the joined text through ``chunk_text`` to get the chunk
       boundaries.
    6. Hydrate metadata from the manifest entry keyed by ``path.name``.

    Args:
        path: Local filesystem path to the downloaded NCERT chapter
            PDF.

    Returns:
        List of ``Chunk`` instances ready for ``embed_and_upload``.

    Raises:
        NotImplementedError: Phase 4.2 — pdfplumber + Document AI
            wiring not yet in place.
    """
    # TODO Phase 4.2: implement pdfplumber → dehyphenate → chunk_text
    # → metadata-hydrate pipeline. Document AI fallback gated on the
    # < 100 chars/page heuristic.
    raise NotImplementedError(
        "Phase 4.2: ingest_pdf not yet implemented. "
        f"Path: {path}"
    )


def chunk_text(text: str) -> list[str]:
    """Split a chapter's full text into ~512-token chunks with 64-token
    overlap, paragraph-respecting where possible.

    Phase 4 §Ingestion pipeline pins the chunk size + overlap. The
    paragraph-respecting split is the difference between "naive
    sliding window" (cuts mid-sentence, hurts retrieval) and
    "paragraph-aware sliding window" (snaps to nearest paragraph
    boundary within the overlap window).

    Args:
        text: The full dehyphenated chapter text.

    Returns:
        List of chunk strings. Token count is measured with the
        embedding model's tokenizer so the chunks fit the input
        window without truncation.

    Raises:
        NotImplementedError: Phase 4.2.
    """
    # TODO Phase 4.2: implement paragraph-aware sliding window using
    # the Vertex embedding tokenizer for token counts.
    raise NotImplementedError(
        f"Phase 4.2: chunk_text not yet implemented. "
        f"Will use {CHUNK_SIZE_TOKENS}-token chunks with "
        f"{CHUNK_OVERLAP_TOKENS}-token overlap."
    )


def embed_and_upload(chunks: list[Chunk]) -> int:
    """Embed a batch of chunks and upsert them to Vector Search.

    Idempotent at the chunk level: each chunk's vector is keyed by
    ``f"{sha256}:{chunk_index}"``, so re-running ingest after a partial
    failure resumes from the failed batch rather than re-embedding
    everything.

    Args:
        chunks: Output of ``ingest_pdf``.

    Returns:
        Count of chunks actually uploaded (excludes idempotent
        skips). Caller aggregates across PDFs to populate
        ``ncert_ingest_run.json``.

    Raises:
        NotImplementedError: Phase 4.2.
    """
    # TODO Phase 4.2: batch-embed via the Vertex client (max 250
    # chunks/batch per the embedding API) and upsert to the deployed
    # Vector Search index with the metadata payload from
    # ``schemas.RetrievedChunk`` minus the score fields.
    raise NotImplementedError(
        f"Phase 4.2: embed_and_upload not yet implemented. "
        f"Pending {len(chunks)} chunks."
    )


__all__ = [
    "CHUNK_OVERLAP_TOKENS",
    "CHUNK_SIZE_TOKENS",
    "Chunk",
    "chunk_text",
    "embed_and_upload",
    "ingest_pdf",
]
