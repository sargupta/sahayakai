# video-storyteller — recommender-mode parity scoring

## Summary

| Mode | Pass rate | Canary-ready? |
| --- | --- | --- |
| Standard (cosine on narrative) | 4.8% | No |
| Recommender (Jaccard on query sets + topical relevance + message cosine) | **61.9%** | **No** |

Recommender-mode scoring 13× more cells correctly than the standard cosine
harness, confirming Track 6's diagnosis that the standard harness was the
wrong tool for this agent. The remaining failures are **real sidecar
regressions**, not metric mismatch.

## Method

The standard parity harness embeds full response documents and cosines them.
That works for narrative-output agents (lesson-plan, quiz, exam-paper) but
not for video-storyteller, which emits an array of short YouTube **search
keywords** plus an optional `personalizedMessage`. Two semantically aligned
search-keyword outputs cosine well below 0.85 because:

1. The strings are short (~5 words each) — embedding signal is thin.
2. Independently-generated YouTube-search idioms share concepts but rarely
   exact phrasing ("Class 3 fractions stories" vs "Animated fractions
   explainers primary school" — same intent, low cosine).

Recommender mode replaces the cosine with three targeted checks:

- **Query Jaccard** (≥ 0.10) — token-set overlap across every
  `categories.<bucket>[]` query string. Lowercased, punctuation-stripped,
  single-letter tokens dropped but single digits preserved (so "Class 3"
  contributes "3" to the topical signal). Threshold tuned against the
  42-cell corpus: English cells score 0.40+, Indic cells 0.05–0.55. 0.10
  catches "completely different topic" while tolerating Indic morphology
  / synonym variation.
- **Topical relevance** (≥ 0.40) — fraction of sidecar queries that contain
  at least one substring keyword mined from the fixture filename
  (`en-g3-math-fractions.json` → `[math, fractions]`). **Gated on baseline
  applicability**: only flagged as a failure when the genkit baseline also
  clears the threshold for that cell. ASCII keywords vs native-script
  queries (e.g. Hindi `गणित` vs filename `math`) produce 0 on both sides,
  so the metric mutes itself.
- **personalizedMessage cosine** (≥ 0.75) — standard Gemini-embedding
  cosine on the personalised teacher-greeting field. Skipped when either
  side omits it.

Structural validity, native-script coverage (≥ 0.90), and mixed-script
bleed checks are preserved from the standard scorer — those genuinely
flag sidecar regressions and are unaffected by output shape.

## Results — 26 / 42 PASS (61.9%)

### Cells passing (26)

All four English cells (en-g3, en-g7 × 4 topics) plus 22 native-script
cells (bn, gu, hi, mr, ta, te × most topics, plus selected kn/ml). Jaccard
ranges from 0.225 to 0.543; script coverage ≥ 90%; no script bleed; message
cosine ≥ 0.80.

### Cells failing (16) — root cause is the sidecar, not the metric

| Failure class | Cells | Diagnosis |
| --- | --- | --- |
| **Sidecar script coverage < 90%** | 14 cells | The Python ADK sidecar emits the wrong script in Gujarati / Kannada / Malayalam / Odia / Punjabi for several topics. Examples: `gu-g3-science-watercycle` 16.7% (sidecar Latin where Gujarati expected); `or-g3-science-watercycle` 14.4%; `pa-g3-math-fractions` 15.1%. This is a **real sidecar prompt-coverage bug**, exactly what a parity harness should catch. |
| **Hindi bleed into other Indic responses** | 4 cells | `bn-g3-hindi-kahaani`, `kn-g3-hindi-kahaani`, `pa-g3-hindi-kahaani`, `ta-g3-hindi-kahaani` — sidecar emits Hindi (Devanagari) characters when generating queries for the **subject** "hindi kahaani" inside a non-Hindi response language. Genuine cross-bleed, not a metric artifact. |
| **Low Jaccard (< 0.10) with low script coverage** | 6 cells | Concurrent with the script-coverage failures above. When the sidecar is emitting the wrong script entirely, the token set diverges from the baseline by construction. |
| **Topical relevance mismatch** | 2 cells | `ml-g3-hindi-kahaani` (baseline 0.000 topical → metric inapplicable; jaccard 0.064 dominates), `te-g3-hindi-kahaani` (jaccard 0.041). These cells expose a thin sidecar response for the "hindi kahaani" subject. |

## What this means for canary promotion

Recommender mode gives a clean, agent-appropriate verdict: the sidecar
**should not be promoted to canary** for video-storyteller. The gating
failures are not artefacts of the scoring harness — they're a Python sidecar
prompt/locale issue. The 16 failing cells cluster around four locales
(`gu`, `kn`, `or`, `pa`) and one subject (`hindi-kahaani`), giving the
sidecar team a tight repro set.

No Firestore flag flip in this run. Recommend:

1. Fix Python sidecar locale handling for `gu`, `kn`, `or`, `pa` (script
   coverage < 30% on multiple cells indicates the prompt is not selecting
   the correct script per locale).
2. Fix the "hindi kahaani" subject handling so non-Hindi responses don't
   bleed Devanagari into native-script outputs.
3. Re-run `node scripts/score-parity.mjs --agent video-storyteller
   --genkit-dir qa/baseline-runs-normalized/video-storyteller --sidecar-dir
   qa/sidecar-runs/video-storyteller --scoring=recommender`. Once pass rate
   ≥ 95%, flip `videoStorytellerSidecarMode=canary,
   videoStorytellerSidecarPercent=10` in Firestore.

## Files

- `scripts/score-parity.mjs` — `--scoring=recommender` flag + helpers
  (`tokenizeQuery`, `collectRecommenderQueries`, `jaccardQuerySets`,
  `topicKeywordsFromFilename`, `topicalRelevance`, `scoreCellRecommender`,
  `RECOMMENDER_THRESHOLDS`).
- `src/__tests__/scripts/score-parity.test.ts` — 19 new unit tests for the
  recommender path; 74/74 total tests pass.
- `qa/parity-scores/video-storyteller-recommender.md` — full per-cell
  table.
- `qa/parity-scores/video-storyteller-recommender.json` — machine-readable
  per-cell results.
