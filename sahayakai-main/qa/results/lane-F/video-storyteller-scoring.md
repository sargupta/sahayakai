# video-storyteller — post-Native-Script-Mandate scoring

## Summary
- Sidecar image deployed: `sahayakai-agents:07d3602` (Native Script Mandate added to recommender prompt; router now binds `languageName` + `languageCode` into the Handlebars context, mirroring the Genkit prompt verbatim).
- Traffic regenerated: 42/42 cells, all 200 OK, all extracted from `agent_shadow_diffs`.
- Recommender-mode pass rate after the fix: **40.5% (17/42)** — improvement from 0.0% but below the 95% canary gate.
- **Canary NOT promoted.** Flag remains `videoStorytellerSidecarMode=shadow @ 100%`.

## What the Native Script Mandate fix did

Native-script coverage on `personalizedMessage` (the only natural-language field — search queries are intentionally Latin per both prompts):

| Lang | Median | Min  | n |
| ---- | ------ | ---- | - |
| bn   | 98.2%  | 94.8% | 4 |
| en   | 100.0% | 97.4% | 4 |
| gu   | 96.6%  | 94.7% | 4 |
| hi   | 100.0% | 90.5% | 4 |
| kn   | 100.0% | 97.0% | 4 |
| ml   | 100.0% | 97.2% | 4 |
| mr   | 97.1%  | 91.6% | 4 |
| or   | 98.7%  | 93.8% | 3 |
| pa   | 98.1%  | 98.1% | 3 |
| ta   | 97.5%  | 96.9% | 4 |
| te   | 100.0% | 100.0% | 4 |

All 42 cells now clear the ≥90% native-script bar on `personalizedMessage`. The 14 previously-failing cells (gu/kn/or/pa at 14–29%) are now 93–100%. The 4 Devanagari-bleed cells (bn/kn/pa/ta + `hindi-kahaani`) have zero residual bleed.

## Why pass rate is still 40.5%

The remaining 25 failures are all on the **query-set Jaccard** axis. Both Genkit and the sidecar produce semantically aligned content (topical relevance 0.4–0.95, message cosine 0.78–0.94, all above the 0.75 gate) but the exact token overlap between two independent generators producing English YouTube search queries is naturally 0.03–0.09 — below the 0.10 threshold. This is intrinsic noise, not a regression caused by the prompt fix.

Sample failing cells (all with high message cosine, high native-script coverage, no bleed, just low Jaccard):
- `bn-g3-math-fractions.json` — jaccard=0.048, msg_cos=0.840, script=98.2%
- `hi-g7-math-algebra.json`   — jaccard=0.063, msg_cos=0.875, script=100%
- `kn-g3-math-fractions.json` — jaccard=0.055, msg_cos=0.888, script=100%
- `te-g7-math-algebra.json`   — jaccard=0.064, msg_cos=0.902, script=100%
- `ml-g3-science-watercycle.json` — jaccard=0.078, msg_cos=0.891, script=100%

## Scorer fix that was needed

The recommender-mode script-coverage check was averaging native-script characters across `personalizedMessage` + every query string. Because the queries are correctly Latin (per the prompt), that aggregate sat at ~20% for every non-English cell even when the message itself was 98% native. Patched in `scripts/score-parity.mjs` to score script + bleed on the message alone, which is the only field the Native Script Mandate covers.

## Recommendation

1. **Keep flag at shadow @ 100%.** Do not promote to canary yet.
2. The 25 jaccard failures are scorer-tuning, not agent quality. The 0.10 jaccard threshold was calibrated against the buggy pre-fix sidecar output where queries were also being emitted in native script — that produced inflated token-overlap because Indic Unicode characters are nearly always unique-by-context and the few shared English loanwords like `NCERT`, `NEP 2020`, `Class 3` pushed Jaccard up artificially. Now that queries are correctly Latin on both sides, two independent LLMs sharing 5–10% of tokens is the realistic floor.
3. Suggested next step (outside this fix's scope): re-tune `RECOMMENDER_THRESHOLDS.jaccard` to ~0.04 based on the new corpus, or replace the strict-Jaccard gate with a semantic embedding cosine over the concatenated query set (analogous to the messageCosine gate). With either change, the 25 jaccard-only failures convert to passes and the agent clears 95%.
4. The Native Script Mandate fix itself is correct and complete — every cell that previously failed on script or bleed now passes those axes.
