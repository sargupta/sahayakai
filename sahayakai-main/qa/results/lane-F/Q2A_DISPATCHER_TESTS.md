# Q2A — Sidecar Dispatcher + Client + Harness Unit-Test Coverage

**Branch:** `feature/sidecar-test-coverage` (off `develop`)
**Worktree:** `/tmp/sahayakai-q2a-dispatcher-tests/sahayakai-main`
**Scope:** 17 dispatchers, 18 clients (17 + parent-call), `signing.ts`, `lang.ts`, `shadow-diff-writer.ts`.

## Summary

| Metric | Before | After |
| --- | --- | --- |
| Test suites in sidecar scope | 17 | **22** (+5) |
| Tests in sidecar scope | 225 | **476** (+251) |
| Dispatchers with unit tests | 14 / 17 | **17 / 17** |
| Clients with unit tests | 0 / 18 | **18 / 18** (parameterised) |
| `signing.ts` line coverage | 0% | **100%** |
| `shadow-diff-writer.ts` line coverage | 100% | **100%** (added explicit `undefined → null` regression test for Phase 1a fix) |
| `lang.ts` line coverage | 98.85% | **98.85%** (unchanged — already covered) |

All new tests pass. `npm run typecheck` is clean.

## Test files added

1. `src/lib/sidecar/__tests__/signing.test.ts` — 11 tests covering HMAC digest determinism, timestamp binding, 5-minute key cache TTL, short-secret rejection, whitespace stripping, `_resetSigningKeyCacheForTest`, `newRequestId`, back-compat `computeBodyDigest`.
2. `src/lib/sidecar/__tests__/clients-http-contract.test.ts` — parameterised across all 18 clients; 218 tests total (16 skipped for clients lacking a `_reset...TokenCacheForTest` export). Verifies: 200 happy path, URL path, signed headers (Authorization / X-Content-Digest / X-Request-Timestamp / X-Request-ID / Content-Type), digest matches `HMAC(secret, ts:body)`, App Check header forwarding + omission, IdTokenClient cache, config errors for missing env, typed 4xx / 5xx HTTP errors with status preserved, typed AbortError timeout, behavioural-guard 502 for quiz + parent-call.
3. `src/__tests__/lib/assessment-scanner-dispatch.test.ts` — 12 tests. off / shadow (success + sidecar-error) / canary in-bucket / canary out-of-bucket / canary 5xx fallback / canary timeout fallback / **canary 422 propagation without Genkit retry** / full / full-fallback / bucket determinism + 1000-uid uniformity (>50 distinct buckets).
4. `src/__tests__/lib/assignment-assessor-dispatch.test.ts` — 13 tests. off / shadow (success + sidecar-error) / **rate-limit gate ordered before sidecar** / rate-limit error skips sidecar / canary in-bucket / canary out-of-bucket / canary 5xx fallback / canary timeout fallback / canary behavioural-guard fallback / full / bucket determinism + uniformity.
5. `src/__tests__/lib/community-persona-message-dispatch.test.ts` — 11 tests. off / shadow (success + sidecar-error) / canary in-bucket / canary out-of-bucket / canary 5xx fallback / canary timeout fallback / canary behavioural-guard fallback / full / bucket determinism + uniformity.

## Test files modified

1. `src/__tests__/lib/shadow-diff-writer.test.ts` — added two tests pinning the Phase 1a / Parallel-D fix:
   - Explicitly-`undefined` field (e.g. `sidecarError: undefined` on a successful sidecar call) is coerced to `null` before the Firestore write, so the SDK no longer silently drops successful rows.
   - Explicit `null` values for `genkit` / `sidecar` are preserved (not coerced to anything else).

## Coverage delta (sidecar files only)

| File | Before | After |
| --- | --- | --- |
| `signing.ts` | 0% | **100%** |
| `lang.ts` | 98.85% | 98.85% |
| `shadow-diff-writer.ts` | 100% | 100% |
| `dispatch.ts` (parent-call) | 100% | 100% |
| `assessment-scanner-client.ts` | 0% | **98.71%** |
| `assessment-scanner-dispatch.ts` | 0% | **94.25%** |
| `assignment-assessor-client.ts` | 0% | **93.95%** |
| `assignment-assessor-dispatch.ts` | 0% | **93.75%** |
| `avatar-generator-client.ts` | 0% | **92.77%** |
| `avatar-generator-dispatch.ts` | 93.18% | 93.18% |
| `community-persona-message-client.ts` | 0% | **92.82%** |
| `community-persona-message-dispatch.ts` | 0% | **96.76%** |
| `exam-paper-client.ts` | 0% | **95.34%** |
| `exam-paper-dispatch.ts` | 79.46% | 79.46% |
| `instant-answer-client.ts` | 0% | **93.72%** |
| `instant-answer-dispatch.ts` | 97.68% | 97.68% |
| `lesson-plan-client.ts` | 0% | **94.53%** |
| `lesson-plan-dispatch.ts` | 98.71% | 98.71% |
| `parent-call-client.ts` | 0% | **99.60%** |
| `parent-message-client.ts` | 0% | **92.61%** |
| `parent-message-dispatch.ts` | 97.77% | 97.77% |
| `quiz-client.ts` | 0% | **99.41%** |
| `quiz-dispatch.ts` | 93.61% | 93.61% |
| `rubric-client.ts` | 0% | **94.28%** |
| `rubric-dispatch.ts` | 82.85% | 82.85% |
| `teacher-training-client.ts` | 0% | **91.93%** |
| `teacher-training-dispatch.ts` | 81.14% | 81.14% |
| `video-storyteller-client.ts` | 0% | **91.89%** |
| `video-storyteller-dispatch.ts` | 79.83% | 79.83% |
| `vidya-client.ts` | 0% | **94.37%** |
| `vidya-dispatch.ts` | 92.50% | 92.50% |
| `virtual-field-trip-client.ts` | 0% | **91.71%** |
| `virtual-field-trip-dispatch.ts` | 95.84% | 95.84% |
| `visual-aid-client.ts` | 0% | **94.77%** |
| `visual-aid-dispatch.ts` | 97.10% | 97.10% |
| `voice-to-text-client.ts` | 0% | **91.80%** |
| `voice-to-text-dispatch.ts` | 95.18% | 95.18% |
| `worksheet-client.ts` | 0% | **94.96%** |
| `worksheet-dispatch.ts` | 84.45% | 84.45% |
| `shadow-diff.ts` (parent-call-specific) | 0% | 0% (out of scope — parent-call writer; parent-call dispatcher already drives the public surface end-to-end via `dispatch.ts` tests) |

All sidecar source files in scope now exceed the **≥85% line-coverage** target except a handful of dispatchers already established at 79–85% by prior PRs (`exam-paper-dispatch.ts` 79.46%, `rubric-dispatch.ts` 82.85%, `teacher-training-dispatch.ts` 81.14%, `video-storyteller-dispatch.ts` 79.83%, `worksheet-dispatch.ts` 84.45%) — these are pre-existing gaps with the long-tail of fallback branches (e.g. multimodal-specific persistence paths) that the existing dispatcher tests do not yet exercise. Not in this PR's scope.

## How the parameterised client harness works

`clients-http-contract.test.ts` is `describe.each(CLIENTS)`-driven. The `CLIENTS` array is the source of truth — each entry pins:
- Module path + exported call function + URL path (the `/v1/...` segment).
- Typed error class names (`config` / `timeout` / `http` / optional `behavioural`).
- A minimal request fixture and a minimal 200-OK response.

Adding a new client = adding one row to the array. Shared mocks (signing, App Check, GoogleAuth ID-token client) live at the top of the file. Token-cache assertions are gated behind the optional `resetFn` (skipped for clients without a test-only reset export — those tests would be racy against module-scoped Map state).

## Run instructions

```
cd /tmp/sahayakai-q2a-dispatcher-tests/sahayakai-main
npx jest --testPathPatterns='lib/sidecar/__tests__|__tests__/lib/.*(dispatch|shadow-diff)' --no-coverage
npm run typecheck
```

## Notes for caller

- This work was done in a dedicated git worktree (`/tmp/sahayakai-q2a-dispatcher-tests/sahayakai-main`) because the main checkout under `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main` is concurrently used by other Conductor sessions that hop branches; edits there are wiped seconds after they land.
- Branch: `feature/sidecar-test-coverage` off `develop`.
- No `Co-Authored-By` trailer.
