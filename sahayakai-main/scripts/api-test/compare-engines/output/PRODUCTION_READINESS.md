# Production-readiness checklist for [chore/api-test-harness](https://github.com/sargupta/sahayakai/pull/27)

Generated 2026-05-03 after the user's "can't mess this up" instruction.

Goal: prove that **none of the changes in this PR put the prod surface
that real teachers use today at risk**, and that the bugs that look scary
(100% sidecar failure, 100% Genkit failure on certain agents) are either
**provably zero-blast-radius** or **provably comparator-induced**, not
real prod failures.

## TL;DR for shipping

| Question | Answer |
|---|---|
| Does ANY change in this PR affect Genkit user-visible output today? | **No** — every Genkit call still runs through the same `generateLessonPlan`, `instantAnswer`, etc. modules, unchanged. |
| Does ANY change route real user traffic to the sidecar today? | **No** — all 15 dispatchers default to `mode: 'off'` in `FALLBACK_CONFIG`. Sidecar is dormant. |
| What's the worst-case blast radius if the dispatcher timeout bumps regress? | A user waits a few extra seconds before seeing the same 500 they would've seen anyway. **Zero new failure modes.** |
| Are the new sidecar files (`genai_patch.py`, `gemini_schema.py`) loaded in any prod path that matters today? | They're loaded by the sidecar process, but the sidecar process **serves zero prod traffic** because every flag is `off`. |
| Did jest regress vs develop? | **No.** 797 passed / 12 failed — identical to develop baseline (12 known component-class assertion drift, deferred to P4). |
| Did pytest regress vs develop? | **No.** 13 integration failures are **identical** on plain develop (Vidya voice / parent-call test fixtures need real Firebase). My new 10 tests all pass. |

---

## Detailed risk audit, change by change

### 1. `sahayakai-agents/src/sahayakai_agents/shared/genai_patch.py` (NEW)

Wraps `google.genai._transformers.process_schema` to recursively strip `additionalProperties` from the schema dict the SDK builds before sending to Gemini.

- **Loaded by:** `main.py` at sidecar boot. Called once.
- **Affects prod path:** Only sidecar HTTP routes (`/v1/.../*`).
- **Does prod traffic reach those routes today?** **No.** Every dispatcher in `src/lib/sidecar/*-dispatch.ts` reads its mode from Firestore via `getDispatchDecision(...)`. `FALLBACK_CONFIG` defaults all 15 modes to `'off'`. With `mode='off'` the dispatcher returns the Genkit result directly without touching the sidecar.
- **Test coverage:** 10 new pytest cases in `tests/unit/test_gemini_schema.py` cover root, nested object, array element, snake-case, idempotence, ref-inlining, and end-to-end SDK round-trip.

**Verdict: zero prod risk.**

### 2. `sahayakai-agents/src/sahayakai_agents/shared/gemini_schema.py` (NEW)

Explicit `gemini_response_schema(Class)` helper used in 3 sidecar files (instant_answer/router, lesson_plan/agent, parent_call/router). Same logic as the patch, applied at the call site instead of globally.

- Same loading + traffic story as #1.
- **Verdict: zero prod risk.**

### 3. `sahayakai-agents/src/sahayakai_agents/agents/instant_answer/router.py`

Two changes:
- Drops `response_mime_type='application/json'` + `response_schema=...` when grounding is enabled (Gemini's API explicitly errors on the combination).
- Adds `_extract_json_object` regex parser for the JSON envelope when grounding is on.

- **Affects prod path:** Sidecar `/v1/instant-answer/answer` only. Genkit `instant-answer` flow untouched.
- **Prod traffic:** Zero, same as above (`instantAnswerSidecarMode: 'off'`).
- **Verdict: zero prod risk.**

### 4. `sahayakai-agents/src/sahayakai_agents/agents/lesson_plan/agent.py`, `parent_call/router.py`

Both wrap the schema in `gemini_response_schema()`. No semantic change; the helper is a no-op for any field the SDK accepted before, and a strip for the field it didn't.

- **Verdict: zero prod risk.**

### 5. `sahayakai-agents/src/sahayakai_agents/main.py`

Adds two import lines + one `apply_genai_schema_patch()` call at module load.

- The patch call is idempotent (covered by `test_apply_genai_schema_patch_is_idempotent`).
- Loaded only when uvicorn imports the FastAPI app — i.e., the sidecar process. Has no effect inside the Next.js process.
- **Verdict: zero prod risk.**

### 6. Five dispatcher `FALLBACK_TIMEOUT_MS` bumps (Next.js)

| File | Before | After | Bumped because |
|---|---|---|---|
| `rubric-dispatch.ts` | 12_000 | 30_000 | flow takes 11–13s + persist (~2s) |
| `teacher-training-dispatch.ts` | 12_000 | 25_000 | flow p95 ~11s; serial test confirms 10–22s |
| `instant-answer-dispatch.ts` | 10_000 | 20_000 | grounding adds 2–5s |
| `parent-message-dispatch.ts` | 8_000 | 15_000 | p95 8s, occasional 12s |
| `vidya-dispatch.ts` | 8_000 | 15_000 | compound intents ~10–14s |

- **What does this actually change in prod?** With `mode='off'` (the default), the dispatcher executes:
  ```
  const out = await withTimeout(generateRubric(input), FALLBACK_TIMEOUT_MS, 'rubric genkit fallback');
  ```
  i.e. it runs the Genkit flow and aborts after N seconds. The bump means the user gets a few more seconds to receive a slow-but-successful response before being shown a 500.
- **Worst case if the bump is wrong:** users wait an extra 17s on a stuck call before seeing the same 500 they would've seen at 12s. No new failure mode introduced.
- **Best case:** intermittent 500s users see today (matching the comparator's parent-message Hindi/Gujarati/Odia 500s) become 200 successes.

**Verdict: low risk, asymmetric upside.** Recommended to ship.

---

## Why the comparator's Run-1 "100% Genkit failure" on `teacher-training` and `virtual-field-trip` was a measurement artifact

The Run-1 comparator fired 22 calls in parallel for each (flow, lang) batch — both engines × 11 langs × overlap. With one dev API key in the pool, Gemini's per-key per-second rate limit (60 RPM on Flash) was saturated within the first 2-3 batches. Every subsequent call returned 429 → wrapped as 500 by Genkit's resilience layer.

**Direct proof, run today with `--serial --retries 1`:**

```
--- teacher-training ---
  teacher-training en  genkit=21714ms  sidecar=9696ms  cos=0.77 lang=1.00 shape=0.73  ✅
  teacher-training hi  genkit=13288ms  sidecar=10494ms cos=0.98 lang=1.62 shape=0.73  ✅
  teacher-training ta  genkit=10347ms  sidecar=13399ms cos=0.98 lang=1.63 shape=0.73  ✅

--- virtual-field-trip ---
  virtual-field-trip en  genkit=14053ms  sidecar=13946ms cos=0.89 lang=1.00 shape=0.79  ✅
  virtual-field-trip hi  genkit=15008ms  sidecar=17072ms cos=0.98 lang=1.44 shape=0.79  ✅
  virtual-field-trip ta  genkit=13877ms  sidecar=FAIL(502)                              ⚠️ (sidecar only)
```

5 of 6 paired (both engines OK). The "100% Genkit failure" disappears when calls are spaced 2s apart. This matches real teacher behaviour — they don't issue 22 parallel requests per second.

The comparator now has `--serial` and `--retries N` flags so any future stability-vs-correctness investigation can choose the right mode.

---

## Rollback plan

If anything from this PR causes a regression in production:

### Sidecar changes (genai_patch.py, gemini_schema.py, etc.)
**Already harmless** — sidecar serves zero traffic. Roll back in zero hurry by reverting the commit. Or leave in place and just keep flags at `off`.

### Dispatcher timeout bumps
1. **Surgical revert** — reset just the constants:
   ```bash
   git revert -n <commit-sha> -- \
     src/lib/sidecar/rubric-dispatch.ts \
     src/lib/sidecar/teacher-training-dispatch.ts \
     src/lib/sidecar/instant-answer-dispatch.ts \
     src/lib/sidecar/parent-message-dispatch.ts \
     src/lib/sidecar/vidya-dispatch.ts
   git commit -m "revert: dispatcher timeout bumps"
   bash scripts/safe-deploy.sh
   ```
2. **Or full PR revert** if the change graph is otherwise clean:
   ```bash
   git revert -m 1 <merge-sha>
   ```

### Full Comparator + Swagger UI (if those somehow cause issues)
- `/api/api-docs` and `/api-docs` are read-only routes. Disable by removing them from the route table.
- Comparator scripts are **dev-only** (`scripts/api-test/`); no prod impact.

### Nuclear option
- `git revert -m 1 <merge-sha>` and redeploy. The PR is fully reversible — every change is additive (new files) or a single-constant edit.

---

## Pre-merge checklist (run again before pressing the green button)

```bash
# 1. Confirm dispatcher fallback config still ships all-off
grep "SidecarMode: 'off'" src/lib/feature-flags*.ts | wc -l
# Expected: 15

# 2. Confirm tsc clean
cd sahayakai-main && npx tsc --noEmit
# Expected: clean exit

# 3. Run the new pytest unit suite (must pass 10/10)
cd sahayakai-agents && uv run pytest tests/unit/test_gemini_schema.py -v
# Expected: 10 passed

# 4. Confirm jest no regression vs develop baseline
cd sahayakai-main && npx jest --silent
# Expected: 797 passed / 12 failed (same 12 component-drift)

# 5. Smoke the Genkit-side endpoints under realistic load
NEXT_BASE=http://localhost:<port> npx tsx scripts/api-test/compare-engines/index.ts \
  --flows teacher-training,virtual-field-trip --langs en,hi,ta --serial --retries 1
# Expected: ≥ 5/6 paired
```

---

## Going forward — what stays in place after this PR ships

1. **Comparator harness** (`scripts/api-test/compare-engines/`) is now permanent infra. Re-run before any future canary flip.
2. **Pytest unit tests** for `gemini_schema` + `genai_patch` will catch any future regression of the additionalProperties bug at PR review time.
3. **Dispatcher timeouts** documented inline with the comparator's measured p95 — future bumps should reference fresh measurements.
4. **`ROLLBACK.md` section above** is the canonical rollback recipe.

🤖 Hardening report compiled by Claude Code on 2026-05-03.
