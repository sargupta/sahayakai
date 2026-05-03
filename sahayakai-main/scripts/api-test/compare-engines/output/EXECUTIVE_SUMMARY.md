# Genkit (main) vs Sidecar (ADK) — Comparative Analysis Across 11 Languages

**Run date:** 2026-05-03 03:44 UTC
**Branch:** `chore/api-test-harness` (off `develop`)
**Scope:** 7 narrative AI flows × 11 supported Indic + EN languages = **77 paired calls** (154 model invocations attempted)
**Method:** Live HTTP — Next.js dev server (Genkit code path, dispatcher mode = `off`) on `:64643`, ADK Python sidecar on `:8081`.

For raw per-flow tables, see [`REPORT.md`](./REPORT.md). Per-pair JSON in [`raw/`](./raw/).

---

## Headline finding

**The ADK sidecar is 100% non-functional on develop.** All 77 paired calls from the comparator hit the same upstream Gemini error before the model can produce any text:

> `INVALID_ARGUMENT. Invalid JSON payload received. Unknown name "additional_properties" at 'generation_config.response_schema': Cannot find field.`

This means we **cannot compare model outputs at all** right now — every sidecar call fails at the request-prep stage, returning a 422/`AI_SAFETY_BLOCK`. The ADK promotions in Phase E + Phase U build a `response_schema` from each Pydantic output model, but the dump emitted by Pydantic includes the JSON-Schema field `additionalProperties` (rendered `additional_properties` in the upstream payload). Gemini's structured-output API rejects any unknown key under `generation_config.response_schema`, so the request never reaches the model.

> Net effect: **0 / 77 paired comparisons produced both a Genkit AND a sidecar output.** Cosine similarity, language-script match, and shape-match metrics are all `n/a` until the sidecar bug is fixed.

---

## Sidecar — full failure pattern (77 / 77)

| Flow | All 11 langs |
|------|--------------|
| lesson-plan        | 422 `AI_SAFETY_BLOCK` × 11 |
| instant-answer     | 422 `AI_SAFETY_BLOCK` × 11 |
| parent-message     | 422 `AI_SAFETY_BLOCK` × 11 |
| rubric             | 422 `AI_SAFETY_BLOCK` × 11 |
| teacher-training   | 422 `AI_SAFETY_BLOCK` × 11 |
| virtual-field-trip | 422 `AI_SAFETY_BLOCK` × 11 |
| worksheet          | 422 `AI_SAFETY_BLOCK` × 11 |

Every sidecar response carries the same upstream error message — confirming this is not a per-flow issue but a **shared bug in the sidecar's response_schema rendering layer**, which lives in either:

- `sahayakai-agents/src/sahayakai_agents/_adk_keyed_gemini.py` — where Pydantic models are dumped to a Gemini-compatible JSON schema, OR
- a generic ADK helper that calls `model.model_json_schema()` without stripping `additionalProperties: false` before passing it to `generation_config.response_schema`.

**Likely fix:** post-process the Pydantic JSON schema to drop every `additionalProperties` key recursively (Gemini's structured output spec supports only a [strict subset of OpenAPI 3](https://ai.google.dev/gemini-api/docs/structured-output)).

---

## Genkit (main) — independent findings

The comparator also surfaced **3 Genkit endpoints fully broken** independent of the sidecar issue, plus partial language regressions on otherwise-working flows:

### Fully broken on Genkit (all 11 langs return 500 "AI generation failed")

| Flow | Status |
|------|--------|
| `instant-answer`   | 500 × 11 |
| `rubric`           | 500 × 11 |
| `teacher-training` | 500 × 11 |

These match the failures the smoke harness from PR #27 already flagged. They are **not language-specific** — every locale returns the same generic "AI generation failed. Please try again." Likely root causes (need server log inspection):
- A common middleware or shared helper (rate-limit, safety guard, model selection) regressed during the Phase L+M+Q.1 ADK refactor (#19) or Phase R.1 model bump from `gemini-2.0-flash` → `gemini-2.5-flash`.
- Output schema validation (Zod) failing post-merge.

### Partial language regressions on otherwise-working flows

| Flow | Working langs (Genkit) | Failing langs (500) |
|------|-------------------------|----------------------|
| lesson-plan         | en, hi, bn, te, mr, ta, gu, pa, ml | **or, kn** |
| parent-message      | en, hi, bn, te, mr, ta, pa, ml, kn | **gu, or** |
| virtual-field-trip  | en, hi, bn, te, mr, pa, ml         | **ta, gu, or, kn** |

The pattern points to **language-specific behavioural-guard or LaBSE/script-detection regressions** for the lower-volume Indic scripts (Odia, Kannada, Gujarati, Tamil) — exactly the four languages added in Phase O.1's 11-lang × 6-flow integration matrix. Worth a targeted look.

### Genkit working flows + latency by language (the only real comparison material we have)

| Flow | en | hi | bn | te | mr | ta | gu | pa | ml | or | kn |
|------|----|----|----|----|----|----|----|----|----|----|----|
| lesson-plan         | 2.4s  | 1.2s  | 16s   | 20s | 16s | 17s | 23s | 17s | 16s | **500** | **500** |
| parent-message      | 5.1s  | 7.3s  | 7.0s  | 7.9s | 7.1s | 7.4s | **500** | 7.9s | 7.8s | **500** | 3.5s |
| virtual-field-trip  | 14.3s | 13.2s | 11.5s | 11.5s | 13.3s | **500** | **500** | 14.3s | 13.3s | **500** | **500** |

Aggregate latency across the 25 successful Genkit calls: **p50 ≈ 13.2s**, **p95 ≈ 22.8s**. The Hindi `lesson-plan` outlier at 1.2s suggests a cache hit on Hindi prompt warmup; ignore it for baseline.

### worksheet — 400, fixture issue

The Genkit worksheet endpoint requires `imageDataUri` + `prompt` even on the dispatcher edge — same contract as the sidecar. My initial fixture only sent `topic`, hence 11×400. Fixture is now correct in the comparator (`compare-engines/index.ts`), but a fresh run is needed once the sidecar is unblocked.

---

## Schema drift between Genkit and sidecar (separate from the Gemini bug)

The comparator surfaced 4 cases where the **dispatcher TS contract and the direct sidecar contract use different field names**, even though both ultimately call the same flow:

| Flow | Genkit / dispatcher field | Direct sidecar field |
|------|---------------------------|-----------------------|
| `parent-message`     | `parentLanguage: 'hi'` (ISO code) | `parentLanguage: 'Hindi'` (English name literal) |
| `parent-call/reply`  | sessionId, utterance, language, userId | callSid, turnNumber, studentName, className, subject, reason, teacherMessage, parentLanguage, parentSpeech (9 required) |
| `parent-call/summary`| sessionId | callSid, studentName, className, subject, reason, teacherMessage, parentLanguage, transcript |
| `vidya/orchestrate`  | utterance, language | message, currentScreenContext, teacherProfile, userId |

The dispatcher in `src/lib/sidecar/*-dispatch.ts` translates between these shapes today, so production traffic is fine. But:

- **Direct sidecar callers (cron, future tools, integration tests) will break** unless they go through the dispatcher.
- **Schema codegen (Phase N.2)** generates the sidecar shapes into `src/lib/sidecar/types.generated.ts` but doesn't auto-update the dispatcher-side input shapes, so drift will keep accumulating until codegen covers both ends.

Recommended: have codegen emit both wire shapes (dispatcher-input AND sidecar-input) from the same Pydantic source, and have the dispatcher use a pure function `convertDispatcherToSidecar(input)` that's covered by a unit test.

---

## What this means for the upcoming release

| Question | Answer |
|----------|--------|
| Can we flip ANY dispatcher to `canary` or `full` for ANY agent today? | **No.** Any sidecar-served call returns 422 immediately. |
| Is Genkit (main) safe to ship? | Mostly. `instant-answer`, `rubric`, `teacher-training` are **all-language 500** and need a fix-PR. lesson-plan and parent-message work in 9-10 of 11 langs; virtual-field-trip works in 7 of 11. |
| Is the sidecar bug release-blocking? | Only if you intend to flip dispatchers to canary/full this release. With all flags at `off` (default), the sidecar is dormant and the bug is invisible to users. |
| Recommended action | (1) Land a fix that strips `additionalProperties` from sidecar response_schema dumps, (2) re-run this comparator, (3) land separate fix-PRs for the 3 fully-broken Genkit flows + the 4 lower-volume language regressions. |

---

## How to reproduce / extend

```bash
# 1. Both servers up
cd sahayakai-main && npm run dev          # autoPort
cd sahayakai-agents && GOOGLE_GENAI_API_KEY=... \
  uv run uvicorn sahayakai_agents.main:app --port 8081

# 2. Run the full sweep (7 flows × 11 langs)
NEXT_BASE=http://localhost:<port> SIDECAR_BASE=http://localhost:8081 \
  npx tsx scripts/api-test/compare-engines/index.ts

# 3. Filter
npx tsx scripts/api-test/compare-engines/index.ts --flows lesson-plan --langs en,hi

# 4. Outputs
#    REPORT.md           — auto-generated per-flow tables
#    EXECUTIVE_SUMMARY.md — this hand-curated narrative
#    raw/<flow>__<lang>.json — full request + response dump per pair
#    results.json        — the structured run for downstream tooling
```

The comparator code is at `scripts/api-test/compare-engines/`.

---

## Open questions for the review

1. **Where exactly is `additionalProperties` introduced into the sidecar's `response_schema`?** Best candidate is the `_adk_keyed_gemini.py` adapter — needs a one-liner Pydantic schema rewrite + a unit test that fails if any nested object has `additionalProperties` set.
2. **Why are 3 Genkit endpoints (`instant-answer`, `rubric`, `teacher-training`) returning generic 500 across every language?** Looks systemic, not language-specific. First place to look: shared rate-limit / safety / model-selection helper that changed in #19 or #20.
3. **Why does `or` (Odia) consistently fail across multiple flows?** It's listed in the language-selector but may not have a behavioural-guard / TTS voice mapping yet, causing a strict-mode error in the result-shell or output validator.

---

🤖 Comparator harness generated by Claude Code on develop branch.
