# Phase 4 — RAG over NCERT + state-board curriculum

## Headline

Ground SahayakAI's content generators (lesson plans, worksheets, quizzes, instant answers) in retrieved curriculum text. Replace "the model writes from training data" with "the model writes citing specific textbook passages." Multilingual embeddings, vector index in Vertex AI / Pinecone, retrieval-augmented prompts.

## Why

The current generators (Genkit `lesson-plan-generator`, `worksheet-wizard`, `quiz-generator`, `instant-answer`) operate on the model's training data. Two failure modes the user has flagged repeatedly:

1. **Curriculum drift** — generated content references concepts not on the student's syllabus, or skips concepts the syllabus mandates. NCERT class 5 science topics evolve year-to-year; the model's training cutoff is months behind.
2. **State-board fragmentation** — Karnataka (KSEEB), Tamil Nadu (TNBSE), Maharashtra (MSBSHSE) each have their own syllabus that diverges from NCERT in non-trivial ways. The model averages across these and produces curriculum-mush.

RAG fixes both: every generated lesson plan / worksheet / quiz is grounded in passages retrieved from the actual textbook for the actual board for the actual class. Citation-style references in the output let the teacher verify against the source.

## Scope

### In

- Ingest pipeline for NCERT textbooks (PDF → cleaned text → chunked → embedded → indexed). Class 1-12, all subjects, English + Hindi versions where available.
- Ingest pipeline for top 5 state boards: Karnataka (KSEEB), Tamil Nadu (TNBSE), Maharashtra (MSBSHSE), Gujarat (GSEB), West Bengal (WBBSE). Same chunking/embedding pipeline.
- Multilingual embedding via `text-multilingual-embedding-002` (Vertex AI) or `multilingual-e5-large` (open-source fallback).
- Vector store: Vertex AI Vector Search (preferred for in-region GCP deployment).
- Retriever sub-agent integrated into the Phase 3 lesson-plan loop (writer takes top-k retrieved passages as additional context).
- Citation post-processor that injects `[Source: NCERT Class 5 Science, Ch. 3, p. 42]` markers into the output where retrieved passages were used.
- Behavioural guard extension: hard-fail if a citation exists in the output but the cited passage is NOT in the retrieved set (model fabrication detection).

### Out (Phase 5+)

- Curriculum-content QA loop (separate evaluator that verifies generated content matches the cited passages — Phase 5).
- User-uploaded textbook ingest (parents/teachers add their own books — Phase 5).
- Image-based diagram retrieval — text-only for now.
- Real-time corpus updates (annual NCERT refresh is enough; live updates come in Phase 5).

## Architecture

```
Once per board+class refresh (annual / on syllabus change):

  PDFs ───► OCR + dehyphenation ───► chunker (256 tokens, 32 overlap)
                                          │
                                          ▼
                              text-multilingual-embedding-002
                                          │
                                          ▼
                              Vertex AI Vector Search index
                              (per-board namespace; per-language facet)


Per request:

  user input (lesson plan request)
        │
        ▼
  Retriever sub-agent
    ├── extract subject + class + topic + language
    ├── query vector search namespace = "{board}_{class}_{lang}"
    │   filter: subject == requested.subject
    ├── return top-8 passages (semantic + BM25 hybrid)
    └─► retrieved_passages: list[{passage, source_meta, score}]
        │
        ▼
  Writer / Evaluator / Reviser (Phase 3 loop)
    └── prompt sees: {retrieved_passages} as additional context block
        instruct: "cite [Source: ...] for every factual claim"
        │
        ▼
  Citation post-processor
    ├── extract every [Source: ...] in the output
    ├── for each, verify the cited passage was in retrieved_passages
    └── strip / replace any fabricated citations
        │
        ▼
  Behavioural guard
    └── hard-fail if fabricated citations remain after stripping
        │
        ▼
  Final output to teacher
```

## Sub-phases

### 4.0 Corpus selection + design (1 week)

- This document.
- Catalog NCERT PDFs (open license under Right-to-Education Act, freely redistributable).
- Catalog state-board PDFs — license review per board (most are CC-BY-NC or sui generis under state IP law). User signs off on legal scope before ingest.
- Choose embedding model + vector store (decision: Vertex AI for both — keeps the data in `asia-southeast1`, matches Phase 1 deployment region).
- Define chunking strategy: 256 tokens, 32-token overlap, paragraph-respecting splits.

**Gate:** legal sign-off + corpus inventory committed at `sahayakai-agents/data/corpus_manifest.json`.

### 4.1 Ingest pipeline (1-2 weeks)

- `sahayakai-agents/scripts/ingest_corpus.py`:
  - Reads `corpus_manifest.json`.
  - Per book: download PDF, run OCR (Document AI), dehyphenate, chunk, embed, upsert to Vector Search.
  - Idempotent: re-running on a stable corpus is a no-op.
  - Cost-tracked: emits `corpus_ingest_run.json` with token counts + spend.
- Required IAM bindings: Document AI user, Vertex AI user, Cloud Storage object viewer + creator.
- Cost projection: ~$80-150 per full NCERT 1-12 ingest depending on PDF page count; one-time spend per refresh cycle.

**Gate:** all NCERT class 1-12 books indexed; sample retrieval queries return semantically relevant passages.

### 4.2 Retriever sub-agent (3-5 days)

- `sahayakai-agents/src/sahayakai_agents/retrieval/`:
  - `retriever.py` — async wrapper around Vertex AI Vector Search query.
  - `query_builder.py` — constructs the namespace + filter from the request fields (subject, class, board).
  - `hybrid.py` — combines vector cosine with BM25 (Vertex AI supports both natively).
- Returns top-8 passages by default; configurable per-call via `top_k` field.
- Latency budget: p95 < 300ms (Vector Search inside `asia-southeast1` typically returns < 100ms).

### 4.3 Writer prompt + citation post-processor (3 days)

- Update `prompts/lesson-plan/writer.handlebars` to include `{{retrieved_passages}}` block:
  - Each passage formatted as `[Source: {source_meta}]\n{passage_text}`.
  - Instruction: "When you state a fact from these passages, cite the source inline as [Source: ...]. Use only the sources provided here."
- New `sahayakai-agents/src/sahayakai_agents/retrieval/citation_processor.py`:
  - Extract all `[Source: ...]` markers from the output.
  - For each, verify the cited source is in `retrieved_passages`.
  - Strip or flag fabricated citations.
  - Emit a `citation_audit_report` alongside the response.

### 4.4 Behavioural guard extension (1 day)

- Extend `assert_lesson_plan_rules` from Phase 3:
  - New axis `citation_grounding`: 1.0 if all citations match retrieved passages, < 1.0 with severity scaling on fabrications, 0.0 if any fabricated citation makes a factual claim about the syllabus.
  - Hard-fail when `citation_grounding < 0.5` regardless of other axes — the entire purpose of RAG is grounding; a fabrication-heavy output is worse than no RAG at all.

### 4.5 Parity + tests (3-5 days)

- 50 fixtures (10 per top-5 board × class 5 only for v1) hand-graded by the user with focus on curriculum alignment.
- Three-tier scoring (extends `evaluation/scorers.py`):
  - Tier 1: TF cosine on output text vs human-graded reference.
  - Tier 2: IndicSBERT cosine.
  - Tier 3: LLM-judge with the rubric extended by `curriculum_alignment` and `citation_validity` axes.
- New behavioural test: 20 hand-crafted requests that DELIBERATELY ask for off-syllabus content; assert the writer either refuses or grounds in the closest on-syllabus passage.

### 4.6 Track H ramp (10-14 days)

- Two new auto-abort policies:
  - `retrieval_p95 > 500ms` (15m) — Vector Search latency regression.
  - `citation_fabrication_rate > 5%` (15m) — model is hallucinating citations despite the post-processor.
- Same demotion ladder as Phase 1.
- Ramp: `shadow@5% → 25% → 50% → canary@5% → 25% → full`.

## Risks

### High

- **Corpus license** — state-board syllabi vary in license terms. **Mitigation:** legal sign-off in 4.0 BEFORE any ingest spend; user signs the corpus manifest. NCERT alone (open license) is the safe baseline if state boards block.
- **Retrieval drift** — embedding-based retrieval is not deterministic; the same query can return different top-k under embedding model updates. **Mitigation:** pin `text-multilingual-embedding-002@001`; never auto-upgrade.
- **Citation fabrication** — even with the post-processor, the model can produce *plausible-sounding* citations to passages we never retrieved. **Mitigation:** the post-processor strips them; the behavioural guard hard-fails if fabrications remain after stripping.

### Medium

- **Indic-language quality** — multilingual embeddings score Indic content lower than English on average. **Mitigation:** use `text-multilingual-embedding-002` (Indic-trained) and BM25 hybrid (script match) to compensate.
- **Cost ramp** — Vector Search query cost per call is small (~$0.0001) but at 10+ generators × thousands of calls/day adds up. Phase 4 budget alert at 2× baseline.
- **PDF quality** — older NCERT editions are scanned, not digitally born. OCR errors compound. **Mitigation:** prefer the most recent PDF edition; reject pages with > 5% character-confidence drop.

### Low

- **Region affinity** — Vertex AI Vector Search in `asia-southeast1` matches our deployment; no cross-region cost.
- **Update cadence** — annual NCERT refresh, ad-hoc state-board refresh; the ingest pipeline is idempotent so a re-run is cheap.

## Estimated effort

- 4.0 design + corpus catalog: **1 week**
- 4.1 ingest pipeline: **1-2 weeks**
- 4.2 retriever: **3-5 days**
- 4.3 writer prompt + citation processor: **3 days**
- 4.4 behavioural guard: **1 day**
- 4.5 parity + tests: **3-5 days**
- 4.6 ramp: **10-14 days**

**Total: ~5-7 weeks engineering + 2-week ramp = 7-9 weeks calendar.**

## Dependencies

- Phase 3 must be ramped to 100% on the lesson-plan path so the writer/evaluator/reviser triplet is the integration point we extend with retrieved context.
- Document AI API quota — needs an enable + quota bump from default 50 RPM to ~200 RPM for the corpus ingest spike.
- Vertex AI Vector Search — needs index provisioning (~30min one-time).
- Pedagogy SME availability for 50-fixture grading (4.5).

## Files this plan implies (forward inventory)

```
sahayakai-agents/
  data/
    corpus_manifest.json
  scripts/
    ingest_corpus.py
  src/sahayakai_agents/
    retrieval/
      __init__.py
      retriever.py
      query_builder.py
      hybrid.py
      citation_processor.py
    _behavioural.py                          (extend)
  prompts/lesson-plan/
    writer.handlebars                        (extend)
  cloud_functions/auto_abort/
    policy_templates/
      09_retrieval_p95.yaml
      10_citation_fabrication.yaml
  tests/
    fixtures/curriculum_grading.json         (50 hand-graded)
    integration/test_retriever.py
    behavioral/test_citation_grounding.py

sahayakai-main/
  src/lib/sidecar/
    lesson-plan-client.ts                    (extend with retrieval-result passthrough)
  src/__tests__/lib/
    citation-display.test.ts                 (UI integration)
  src/components/lesson-plan/
    citation-list.tsx                        (renders [Source: ...] inline)
```

## Pre-kickoff gates

1. Phase 3 lesson-plan path at 100% in production for at least 14 days with no auto-abort fires.
2. Legal sign-off on the corpus manifest (NCERT is automatic; state boards explicit).
3. Document AI + Vertex AI Vector Search quota provisioned.
4. Cost projection within 3× of current Phase 3 lesson-plan spend.
5. 50-fixture grading session scheduled with a pedagogy SME (user).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
