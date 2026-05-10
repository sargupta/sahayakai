# Offline eval suite — `sahayakai-agents/evals/`

Phase R.3 deliverable. Closes the prompt-quality regression detection
gap that no integration test stack catches: **forensic audit C5
flagged "zero language-parametrized tests across 11 Indic
languages."** Phase O addresses raw test count (assertion volume);
this suite is the qualitative companion piece — input/output pairs
paired with axis-scoped scorer functions.

Adapted from the Genkit eval primitive (input → output → scorer),
ported to the ADK Python sidecar.

## What's in here

```
evals/
├── __init__.py
├── golden_set/
│   ├── lesson_plan.json         (20 entries: 10 English + 10 Indic)
│   ├── instant_answer.json      (20 entries)
│   ├── parent_call.json         (10 entries)
│   ├── parent_message.json      (10 entries)
│   ├── vidya.json               (30 intent-classification entries)
│   └── virtual_field_trip.json  (10 entries)
├── results/                      (git-ignored — runner output lands here)
├── scorer.py                     (4 axis scorers + trait parser)
├── run_evals.py                  (CLI runner)
└── README.md                     (this file)
```

100 total golden-set entries across the 6 narrative agents.

## Manual invocation

```bash
cd sahayakai-agents

# Sanity check — runs without hitting the sidecar.
uv run python -m evals.run_evals --agent vidya --dry-run

# Real run against a locally-served sidecar.
uv run uvicorn sahayakai_agents.main:app --port 8080 &
uv run python -m evals.run_evals --agent vidya \
    --base-url http://localhost:8080

# Real run against the staging Cloud Run service.
uv run python -m evals.run_evals --agent vidya \
    --base-url https://sahayakai-agents-staging-...run.app
```

Output lands in `evals/results/{agent}_{ts}.json` with the per-axis
mean, the overall aggregate, and per-case breakdown including the
output text the scorer saw.

## Axis scorers

Each scorer returns a `float in [0.0, 1.0]`. Aggregate is the mean.

| Axis | What it measures | Signal |
|------|------------------|--------|
| `passes_safety` | Forbidden-phrase scan (no AI/bot/Sahayak self-reference, no synonym variants, NFKC + confusable-fold + split-letter-glue hardening). | Binary. 0 = production guard would have 502'd. |
| `matches_language` | Unicode-range script check per language code (Devanagari for hi/mr, Bengali for bn, etc.). 85% alpha-in-range threshold for code-switching tolerance. | Binary. 0 = wrong script. |
| `min_word_count: N` / `max_word_count: N` | Word-count bound via `str.split()`. Same algorithm as production `assert_lesson_plan_length`. | Binary. 0 = out of bound. |
| `labse_similarity` | Cosine similarity on LaBSE embeddings between output and `reference`. Rescaled from `[-1, 1]` to `[0, 1]`. | Continuous. Falls back to Jaccard when `sentence-transformers` is not installed. |

### LaBSE optional dependency

The runner works without `sentence-transformers` — Jaccard token
overlap is used as the fallback. To enable real LaBSE embeddings:

```bash
uv sync --extra eval
```

(Adds `sentence-transformers~=3.2` and `torch~=2.5` from
`pyproject.toml`'s `eval` extra. ~500 MB of model weights download
on first run.)

## Golden-set entry shape

```jsonc
{
  "id": "vidya-014-hi-instant-answer",
  "input": { /* whatever the agent's request schema accepts */ },
  "expected_output_traits": [
    "passes_safety",
    "matches_language",
    "max_word_count: 250",
    "labse_similarity"
  ],
  "reference": "भारत की राजधानी नई दिल्ली है।"
}
```

- `input` — the request body the runner POSTs to the agent's
  endpoint. Structure mirrors the agent's Pydantic schema in
  `src/sahayakai_agents/agents/<name>/schemas.py`.
- `expected_output_traits` — list of axis names + parameters. Bare
  axes (`"passes_safety"`) run the scorer with default args; param
  axes (`"min_word_count: 200"`) carry an inline value.
- `reference` — gold-standard answer used by `score_labse_similarity`.
  Brief is fine — LaBSE is robust to length-only differences.

## Adding a new agent

1. Add the agent's wire shape to `_DISPATCH` in `evals/run_evals.py`:
   - `endpoint`: e.g. `/v1/quiz/generate`
   - `extract_output`: dotted path into the response JSON, or one of
     the prose-flatten sentinels (`__lesson_plan_prose__` /
     `__field_trip_prose__`)
   - `expected_lang_field`: dotted path into the input JSON for the
     language code
2. Create `evals/golden_set/<name>.json` with at least 10 entries
   covering English + 3 Indic languages.
3. (If the new agent uses language NAMES instead of codes — like
   `parent-message` — extend `_LANG_NAME_TO_CODE` in
   `run_evals.py`.)
4. Run `uv run python -m evals.run_evals --agent <name> --dry-run`
   to validate.

## When to run evals

**Mandatory before any flag flip ≥ shadow@10%.** Add to the runbook
flag-promotion checklist (see `docs/RUNBOOK.md`):

> Before bumping `<agent>SidecarPercent` ≥ 10:
>
> 1. `uv run python -m evals.run_evals --agent <name>
>    --base-url <staging-url>` against staging.
> 2. Compare `overall_score` and `per_axis` against the previous
>    baseline run committed in `evals/results/`.
> 3. If `passes_safety < 1.0` on any case → halt promotion. The
>    production guard will 502.
> 4. If `matches_language < 1.0` on any case → halt promotion.
>    Wrong-script output = unusable for the parent.
> 5. If `labse_similarity` mean drops > 10 percentage points vs.
>    baseline → investigate before promoting.

## CI integration (deferred)

Eval runs hit a live Gemini endpoint (cost + quota), so the first
wire is intentionally manual. After a baseline run is established
and committed, a follow-up PR will wire this into a nightly
GitHub Action that:

- Runs every agent's golden set against staging.
- Diffs against the baseline committed in `evals/results/`.
- Posts a markdown summary to a status channel.
- Fails the build only on `passes_safety` regressions; everything
  else is informational.

For now: the operator runs evals before promoting flag flips.
