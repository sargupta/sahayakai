# Phase 4 — RAG over NCERT for the lesson-plan writer

## Headline

Ground the Phase 3 writer-evaluator-reviser loop in retrieved NCERT chapter
text. When a teacher asks for a Class-5 Science lesson on photosynthesis,
the writer's prompt now carries the actual chapter excerpt — not the
model's training-data approximation of it. One new evaluator axis
(`ncert_alignment`) holds the writer accountable to those retrieved
chunks.

## Why now

Phase 3 ships a critic in the loop, but the critic and the writer share
the same underlying weakness: both reason from training-data memory of
NCERT, not the textbook itself. The standing peer-review rule (Codex +
Gemini find prod bugs we miss) and the evidence map at
`outputs/investment_and_proposals/EVIDENCE_AND_SOURCES.md` repeatedly
surface the same three failure modes:

1. **Outcome drift** — generated objectives reference concepts not
   actually taught in the chapter the teacher named, or skip outcomes
   the chapter mandates. The model averages across editions and across
   competing CBSE/state-board syllabi.
2. **Vocabulary substitution** — the model paraphrases NCERT terminology
   into "general English science" and the teacher then has to translate
   back when she pulls the textbook. Wastes the prep time SahayakAI is
   meant to save.
3. **Stale phrasing** — NCERT revises chapters between editions; the
   model's pre-cutoff knowledge ages instantly when a state moves to a
   new edition. Retrieval tracks reality at re-ingest cadence.

This is Phase 4 (not 3) because the retrieval system needs the writer
loop to exist before it has anywhere to plug in. Phase 3 also gives us
the evaluator harness — adding `ncert_alignment` is a 1-axis extension
of an already-validated 7-axis rubric, not net-new evaluator work. The
prior `phase-4-rag-ncert-state-board.md` scoped state-board PDFs into v1;
this plan defers those to Phase 5 to keep the v1 corpus small and the
license-review surface to NCERT alone (clearly permissive — see §Corpus).

## Corpus

### Scope (v1)

- NCERT textbooks Classes 1-12, all subjects.
- English **and** Hindi editions (NCERT publishes both natively for most
  chapters; Hindi is `/textbook/hindi/` on the CBSE/NCERT site).
- Stretch: Marathi / Tamil / Bengali Class-5 Science chapters only — the
  three highest-volume non-Hindi-English request languages from current
  Genkit traffic.

State-board syllabi (KSEEB, TNBSE, MSBSHSE, GSEB, WBBSE) are **out of
scope** for v1 — moved to Phase 5 once NCERT-alone proves the pattern.

### Source pattern

NCERT publishes per-chapter PDFs at
`https://ncert.nic.in/textbook.php` — selectable by class → subject →
chapter. The convention is `https://ncert.nic.in/textbook/pdf/<book-code>.pdf`,
where `<book-code>` looks like `eesc104` (Class 5 Science Ch 4). The
mirror at `ncert.nic.in/textbook/hindi/` carries Hindi editions.

### License

NCERT textbooks are produced by the National Council of Educational
Research and Training, an autonomous body under the Ministry of
Education, Government of India. They are funded by public expenditure
and distributed under government copyright with permissive use for
educational, non-commercial purposes. The relevant clause is
**Section 52(1)(h) of the Indian Copyright Act, 1957** (research /
educational fair-use exception) read with NCERT's stated permission for
free reproduction by educational platforms in their published guidelines.

Phase 4 will commit a one-page legal note (`docs/ncert_corpus_license.md`)
written by the user's counsel before any ingest spend; the gate is that
counsel sign-off must precede §4.2 work.

### Manifest

`sahayakai-agents/data/ncert_manifest.json` lists every PDF to ingest:

```json
{
  "subject": "science",
  "class_number": 5,
  "chapter_number": 7,
  "chapter_title": "How Do Plants Make Food?",
  "language": "en",
  "source_url": "https://ncert.nic.in/textbook/pdf/eesc107.pdf",
  "edition": "2024",
  "sha256": "<computed at ingest>"
}
```

This makes ingest idempotent: the PDF SHA gates re-embedding when the
edition has actually changed.

## Ingestion pipeline

```
PDF  ──►  text extract  ──►  chunker  ──►  embedder  ──►  vector store
         (pdfplumber)        (~512 tok,    (text-multi-     (Vertex AI
                              64 overlap)  lingual-          Vector
                                           embedding-002)    Search)
                                                             + metadata
```

**Text extraction.** Recommend `pdfplumber` over `pypdf2`:

| Aspect | `pypdf2` | `pdfplumber` |
| --- | --- | --- |
| Layout fidelity | poor on multi-column NCERT pages | preserves columns + tables |
| Hindi Devanagari rendering | drops ligatures intermittently | round-trips cleanly |
| Maintenance | bus-factor 1, slow releases | active fork, used in production by Atlas/Mathpix |
| Speed | fastest | ~30% slower (acceptable for one-time ingest) |

NCERT chapters are heavy on figures + sidebars + boxed examples;
column-aware extraction matters. The 30% speed cost is irrelevant for
a one-time pipeline. Fall back to **Document AI OCR** for any page where
`pdfplumber` returns < 100 chars (the older scanned editions).

**Chunking.** ~512 tokens with 64-token overlap, paragraph-respecting
splits (never break mid-sentence). 512 is the sweet spot for the
chosen embedding model's input window without truncation, and large
enough that a typical NCERT chapter (3-6 pages) yields 8-15 chunks
rather than hundreds.

**Metadata per chunk:**

```python
{
  "subject": "science",
  "class_number": 5,
  "chapter_number": 7,
  "chapter_title": "How Do Plants Make Food?",
  "language": "en",
  "source_url": "https://ncert.nic.in/textbook/pdf/eesc107.pdf",
  "page_start": 42,
  "page_end": 43,
  "ingested_at": "2026-04-26T12:00:00Z",
  "edition": "2024",
}
```

`class_number` and `subject` are the two filters the retriever **must**
apply at query time (see §Retrieval).

## Embeddings

**Recommended: Vertex AI `text-multilingual-embedding-002` (768-dim).**

| Aspect | Vertex `text-multilingual-embedding-002` | Sarvam embeddings | OpenAI `text-embedding-3-large` |
| --- | --- | --- | --- |
| Indic-language coverage | 11 we need (hi/bn/te/mr/ta/gu/kn/pa/ml/or + en) | hi/ta/te/bn (4 of 11) | weak on Indic; English-tuned |
| Region | `asia-south1` and global | India-only (good for DPDP) | US-only — DPDP **violation** for production data |
| Cost | $0.025 / 1M tokens | comparable / unpublished | $0.13 / 1M tokens (5×) |
| Model age | refreshed quarterly; pinned `@001` | 2025 release, less battle-tested | 2024 release |
| Eval coverage | published MTEB scores | India-private | published MTEB scores |

OpenAI is **ruled out** under DPDP — compliance plan
(`.claude/plans/dpdp-compliance.md`) requires data residency in India for
production traffic. Sarvam is interesting but covers only 4 of our 11
languages; the multilingual-002 model wins on coverage. We pin
`text-multilingual-embedding-002@001` and never auto-upgrade — embedding
drift on a stable corpus would invalidate stored vectors silently.

**Open question for human review.** Sarvam ships with stronger Indic
optimisation on the four languages it supports. For the Hindi-only
subset of the corpus, would a hybrid setup (Sarvam for `language=="hi"`,
Vertex for everything else) raise retrieval quality enough to justify
the operational cost of a second embedding pipeline? Phase 4.6 should
A/B this on the Class-5 Hindi Science chapters.

## Vector store

**Recommended: Vertex AI Vector Search v1, region `asia-south1`.**

| Aspect | Vertex AI Vector Search | pgvector on Cloud SQL |
| --- | --- | --- |
| Region affinity | `asia-south1` (~80ms RTT to `asia-southeast1` Cloud Run) | same region available |
| Latency at our scale (~100k chunks) | ~50ms p95 query | ~100-200ms p95 |
| Latency at >1M chunks | ~80ms p95 | degrades to ~500ms+ without aggressive partitioning |
| Ops burden | managed index | DBA-style: VACUUM, index tuning, replicas |
| Cost (100k chunks) | ~$0.50/day index storage | ~$30/month Cloud SQL min instance |
| Hybrid search | not native — need application-layer BM25 rerank | pgvector + tsvector native |
| Up-time SLA | 99.9% (Vertex managed) | 99.95% (Cloud SQL HA) but you build your own retry |

Vertex wins because we are explicitly **not at >1M chunks today** and
the Phase 4 cost model prefers managed ops over DBA work. The hybrid
search gap is real but a 30-line application-layer BM25 rerank over
`top_20` from vector search closes it (see §Retrieval).

`asia-south1` (Mumbai) is the closest region — `asia-southeast1`
(Singapore) for Cloud Run, ~80ms cross-region. Acceptable for our
sub-300ms retrieval budget.

## Retrieval pattern

```
RetrievalQuery {
  query_text: "photosynthesis class 5 light food",  # writer-derived
  language: "en",
  class_number: 5,                                  # HARD filter
  subject: "science",                               # HARD filter
  top_k: 5,
}
        │
        ▼
1. Embed query_text → 768-dim vector
2. Vector Search:
     - filter: class_number == 5 AND subject == "science" AND language == "en"
     - return top-20 by cosine
3. BM25 rerank over those 20 by query_text overlap
4. Return top-5 as RetrievalContext.chunks
```

The **hard filter contract** is non-negotiable: a Class-5 Science
request must never see a chunk from Class 9 Math, even if the embedding
similarity is high. Vector Search supports namespace-style metadata
filters — we wire `class_number` + `subject` as required filter
predicates at query construction time, not as post-filters.

BM25 rerank closes the "cross-cutting topic" gap (e.g. "photosynthesis
in agriculture" — the embedding may surface Class-5 Science ch 7 *and*
Class-7 Geography ch 3; rerank by exact-token overlap with the query).

## Writer integration

The writer already accepts an `ncertChapter` hint
(`{number, title, learningOutcomes[]}`). Phase 4 adds a
`retrieved_passages` block to the writer context — a Handlebars
`{{#if retrieved_passages}}…{{/if}}` block immediately after the
existing `**NCERT ALIGNMENT:**` section in
`prompts/lesson-plan/writer.handlebars`.

Each retrieved chunk renders as:

```
⟦retrieved class={{class_number}} ch={{chapter_number}} pp={{page_start}}-{{page_end}}⟧
{{chunk_text}}
⟦/retrieved⟧
```

The `⟦…⟧` brackets follow the **Wave 4 fix 3 untrusted-input
convention**: the writer template treats text inside the markers as
data to ground in, not instructions to follow. The same convention
already protects parent-input fields against prompt-injection (see the
Untrusted-input wrap note in `writer.handlebars`).

The instruction line added to the prompt:

> When you state a fact or use a key term in your lesson plan, prefer
> wording that matches the retrieved passages above. Do **not** quote
> them verbatim into the student-facing copy — paraphrase for the grade
> level. The passages are reference material, not pre-formed lesson
> content.

## Evaluator extension

`RubricScores` grows from 7 axes to 8 — adds `ncert_alignment: float`
in [0,1].

```python
class RubricScores(BaseModel):
    model_config = ConfigDict(extra="forbid")
    grade_level_alignment: float = Field(ge=0.0, le=1.0)
    objective_assessment_match: float = Field(ge=0.0, le=1.0)
    resource_level_realism: float = Field(ge=0.0, le=1.0)
    language_naturalness: float = Field(ge=0.0, le=1.0)
    scaffolding_present: float = Field(ge=0.0, le=1.0)
    inclusion_signals: float = Field(ge=0.0, le=1.0)
    cultural_appropriateness: float = Field(ge=0.0, le=1.0)
    ncert_alignment: float = Field(ge=0.0, le=1.0)   # new
```

**Gate logic update** in `agent.classify_verdict`:

| Constant | Phase 3 | Phase 4 |
| --- | --- | --- |
| `QUALITY_PASS_AXIS_COUNT` | 6 of 7 | 7 of 8 |
| `QUALITY_HARD_FAIL_AXIS_COUNT` | < 4 of 7 | < 4 of 8 |

Threshold (`0.80`) stays. The pass bar tightens slightly (87.5% of axes
vs 85.7%); the hard-fail bar stays at "fewer than half the axes
passing." The evaluator prompt expands with a new rubric block
describing what `ncert_alignment` means: "1.0 if all key terms and
learning outcomes from the retrieved chapter are reflected in the plan;
0.0 if the plan contradicts or ignores the retrieved chapter."

When retrieval was skipped (language not indexed, hard filter returned
empty), the evaluator receives `retrieved_passages: []` and is
instructed to score `ncert_alignment` against `ncertChapter.title` +
`learningOutcomes` only — graceful degradation.

## Sub-phases

### 4.1 Schemas (1 day)

- `RetrievalQuery`, `RetrievedChunk`, `RetrievalContext` Pydantic v2
  models in `src/sahayakai_agents/rag/schemas.py`.
- Extend `RubricScores` with `ncert_alignment` (in
  `agents/lesson_plan/schemas.py`).
- `extra="forbid"` everywhere. Bounded `Field(ge=, le=, max_length=)`
  per the parent-call schema convention.

### 4.2 Corpus ingest (5-7 days)

- `corpus_ingest.py` skeleton becomes real: `ingest_pdf`, `chunk_text`,
  `embed_and_upload`.
- One-time `scripts/ingest_ncert.py` driver reads
  `data/ncert_manifest.json`, fans out per-PDF.
- Idempotent: re-running on a stable corpus is a no-op (SHA gate).
- Cost-tracked: emits `ncert_ingest_run.json` with token counts +
  spend.

### 4.3 Retriever (3 days)

- `Retriever` Protocol + `VectorSearchRetriever` impl in
  `rag/retriever.py`.
- Application-layer BM25 rerank over top-20 (use `rank_bm25` or a
  ~40-line custom implementation; the dependency is small enough that
  pinning `rank-bm25~=0.2` is fine).
- `embeddings.py` wraps Vertex AI client with the `@001` pin.

### 4.4 Writer prompt + render extension (1 day)

- Extend `render_writer_prompt` to accept `retrieved_passages` in the
  context dict (no signature change — context is already
  `dict[str, Any]`).
- Add `{{#if retrieved_passages}}…{{/if}}` block to
  `writer.handlebars`.
- Router calls retriever before writer; passes
  `retrieved_passages=context.chunks` into `_request_to_dict`.

### 4.5 Evaluator prompt + schema extension (1 day)

- Add `ncert_alignment` rubric block to `evaluator.handlebars`.
- Update `RubricScores` (Phase 4.1 already did the schema; this is
  the prompt-side counterpart).
- Update `QUALITY_PASS_AXIS_COUNT` / `QUALITY_HARD_FAIL_AXIS_COUNT`
  in `agents/lesson_plan/agent.py`.

### 4.6 Tests (3-4 days)

- Unit: `test_rag_schemas.py` (this scaffold) — extra-fields-forbid for
  every new model.
- Unit: `test_retriever.py` (this scaffold) — placeholder for the
  Protocol + filter-contract assertions once §4.3 lands.
- Integration: a fake `Retriever` impl yielding canned chunks; assert
  the writer prompt actually contains the chunks; assert evaluator
  scores `ncert_alignment` higher when chunks are well-aligned vs.
  when chunks are mis-classified noise.
- Calibration set: 30 NCERT chapter requests (from current Genkit
  traffic) hand-graded for `ncert_alignment`; eval target ≤ ±0.10 MAE
  vs human, same calibration target as the original 7 axes.

### 4.7 Dispatcher flag (1 day)

- New env / dispatcher flag `lessonPlanRagMode: "off" | "shadow" | "on"`:
  - `off` — no retrieval; writer runs exactly as Phase 3.
    `ncert_alignment` defaults to `1.0` so the pass gate is unaffected.
  - `shadow` — retrieval runs (latency + cost paid), passages logged,
    NOT passed to writer. Used to measure retrieval cost and quality
    in production without changing teacher-visible output.
  - `on` — retrieval runs, passages flow into writer prompt,
    `ncert_alignment` axis evaluated normally.
- Same fail-closed semantics as Phase 1 dispatcher.

## Cost model

### One-time ingest

- ~150 NCERT books × ~10 chapters × ~10 chunks × ~512 tokens ≈
  7.7M tokens (English + Hindi together).
- Stretch languages add ~10% (Class-5 Science in 3 more languages).
- Embedding spend: ~8M tokens × $0.025/1M = **~$0.20**.
- PDF text extraction: free (`pdfplumber` local) + Document AI fallback
  on ~5% of pages × $1.50/1k pages ≈ **~$2-5**.
- Vector Search index build: one-time provisioning ~$5.
- **Total one-time: ~$10-15.** (The earlier plan's $80-150 estimate was
  based on running Document AI on the whole corpus — `pdfplumber`-first
  collapses that.)

### Per-request

- 1 query embedding (~50 tokens) ≈ $0.0000013
- 1 vector search (~$0.0001 / call)
- 1 BM25 rerank in-process (free)
- **Total per request: ~$0.0001.**

### Net Phase 4 cost increase

Current Phase 3 lesson-plan path is 4 Gemini calls × $0.001-0.003 each ≈
$0.004-0.012 per generated plan. Phase 4 adds ~$0.0001. Plus the new
`ncert_alignment` rubric line in the evaluator prompt — ~50 extra
output tokens per evaluator call, two evaluator calls in the worst
case, ~$0.0001 added.

**Total marginal Phase 4 cost: ~$0.0002 per lesson plan, < 2% of
current Gemini spend.** Well inside the budget.

## Latency budget

- Vector search: ~50-100ms p95 (`asia-south1` → `asia-southeast1`)
- BM25 rerank in-process over 20 chunks: ~5ms
- Embedding call: ~50ms
- **Retrieval p95: ~150-200ms** — comfortably under the 300ms goal.

The 4-call Phase 3 loop (writer + 2× evaluator + reviser) sits at
~5-12s p95 today. Adding ~200ms keeps the loop under the 60s lesson-plan
client timeout with margin to spare.

## Risks

### High

- **Corpus license sign-off** — NCERT is permissive but the legal note
  must be cut by counsel before §4.2. **Mitigation:** the gate is in
  the §4.2 entry criteria; ingest spend cannot start until the note is
  committed.
- **Retrieval irrelevance for cross-cutting topics** — "photosynthesis
  in art" or "Diwali in geography" returns top-k by embedding that may
  miss the actual point. **Mitigation:** hybrid search (vector top-20
  → BM25 rerank top-5) catches the exact-token cases; the `off` flag
  + `shadow` mode let us measure failure rate before flipping `on`.
- **Citation fabrication** — even with retrieval, the writer can
  invent passages that "feel" like NCERT. The Phase 5
  citation-post-processor will catch these; for Phase 4 we mitigate
  via the evaluator (`ncert_alignment` low if invented terms).

### Medium

- **Stale corpus on syllabus revision** — NCERT periodically refreshes
  chapters between editions. **Mitigation:** quarterly re-ingest;
  manifest's `edition` + `sha256` fields gate re-embed cost to only
  the chapters that changed.
- **Indic embedding bias** — `text-multilingual-embedding-002` performs
  better on English than on regional languages by published MTEB
  numbers; bias is real but bounded. **Mitigation:** §4.6 calibration
  set covers all 11 languages so bias is measurable, not hidden.
  Hybrid BM25 rerank partially compensates (script-match doesn't
  depend on the embedding model).
- **Sarvam-vs-Vertex hybrid setup** (open question above) — running
  two embedding pipelines doubles the ops surface. **Mitigation:** A/B
  in §4.6 first; only commit to hybrid if Sarvam wins by ≥ 0.05 MAE on
  Hindi Science chapters.

### Low

- **Language coverage gaps** — v1 covers hi/en cleanly; mr/ta/bn for
  Class-5 Science only; rest fall back to "no retrieval, log
  `lang_not_indexed`, writer falls back to grade-level alignment
  without retrieval." **Mitigation:** the `off` fallback is the
  graceful-degradation path; teacher doesn't see degraded output, just
  unchanged Phase 3 output.
- **Vector Search regional outage** — `asia-south1` going down kills
  retrieval. **Mitigation:** fallback flag forces `lessonPlanRagMode =
  "off"` if retrieval p95 > 500ms over a 5m window. Same auto-abort
  pattern as Phase 1.

## Files this plan implies

```
sahayakai-agents/
  data/
    ncert_manifest.json
  docs/
    ncert_corpus_license.md           (counsel-signed)
  scripts/
    ingest_ncert.py                   (driver)
  src/sahayakai_agents/
    rag/
      __init__.py
      schemas.py                      (this scaffold)
      embeddings.py                   (this scaffold)
      retriever.py                    (this scaffold)
      corpus_ingest.py                (this scaffold)
    agents/lesson_plan/
      schemas.py                      (extend RubricScores)
      agent.py                        (extend gate logic + writer ctx)
      router.py                       (call retriever before writer)
  prompts/lesson-plan/
    writer.handlebars                 (add retrieved_passages block)
    evaluator.handlebars              (add ncert_alignment rubric)
  tests/
    unit/
      test_rag_schemas.py             (this scaffold)
      test_retriever.py               (this scaffold)
    integration/
      test_lesson_plan_with_rag.py    (Phase 4.6)
    fixtures/
      ncert_calibration.json          (30 hand-graded, Phase 4.6)
```

## Pre-kickoff gates

1. Phase 3 lesson-plan path at 100% in production for at least 14 days
   with no auto-abort fires.
2. NCERT legal note committed at `docs/ncert_corpus_license.md`.
3. Vertex AI Vector Search quota provisioned in `asia-south1`.
4. 30-fixture calibration session scheduled with a pedagogy SME (user).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
