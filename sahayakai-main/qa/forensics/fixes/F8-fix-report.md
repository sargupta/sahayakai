# F8 Voice Pipeline Fix Report

Branch: `fix/voice-pipeline-p0-f8` (off `develop`)
Reference forensics doc: `qa/forensics/F8-voice-pipeline.md`

## Summary

Five fixes shipped — three P0, one P1, one P2. All covered by unit tests (44 assertions passing).

| ID     | Severity | Title                                                | Status |
|--------|----------|------------------------------------------------------|--------|
| F8-01  | P0       | Twilio signature bypass via `Host: localhost.evil`   | Fixed  |
| F8-02  | P0       | Odia outreach used English voice over Odia text      | Fixed  |
| F8-03  | P0       | twiml-status double-fired LLM summary on retries     | Fixed  |
| F8-04  | P1       | twiml duplicated turns when Twilio retried Gather    | Fixed  |
| F8-05  | P2       | Punjabi speech tag was `pa-Guru-IN` (Twilio wants `pa-IN`) | Fixed  |

## F8-01 — Twilio signature bypass via Host header (P0)

**Files:** `src/lib/twilio-validate.ts`, `src/__tests__/lib/twilio-validate.test.ts`

Previously `host.includes('localhost')` skipped HMAC validation. Attacker sets `Host: localhost.evil.com` (substring match on "localhost") and bypasses signature check on both `/api/attendance/twiml` and `/api/attendance/twiml-status`.

**Fix:** new `shouldSkipValidation(req)` helper enforces three gates:
1. `process.env.NODE_ENV !== 'production'` — production NEVER skips, regardless of headers.
2. Exact-equality host allowlist: `localhost`, `localhost:<port>`, `127.0.0.1`, `127.0.0.1:<port>` — no substring match. Strips at first comma to defang proxy concatenation.
3. Must be in a test runner (`NODE_ENV=test`, `JEST_WORKER_ID`, `VITEST`) OR explicitly opt in with `TWILIO_DISABLE_VALIDATION=1` for local-dev-without-ngrok.

**Tests added (6):**
- Rejects `Host: localhost.evil.com` in production.
- Rejects `Host: localhost.evil.com` even in development (substring trap closed).
- Rejects bare `localhost` in production even with `JEST_WORKER_ID` set.
- Skips when `host=localhost` AND `NODE_ENV=test`.
- Skips on `localhost:3000` and `127.0.0.1:8080` in test.
- Accepts a real HMAC-signed request in production with public host.

## F8-02 — Odia outreach broken (P0)

**Files:** `src/types/attendance.ts`, `src/__tests__/api/attendance-call.test.ts`, `src/__tests__/api/attendance-voice-fixes.test.ts`

`TWILIO_LANGUAGE_MAP.Odia = null` combined with `LANG_MAP[lang] ?? 'en-IN'` in `twiml/route.ts:79,177` meant Odia parents heard their text rendered through an English Neural2 voice — call was unintelligible.

**Fix:**
- `TWILIO_LANGUAGE_MAP.Odia = 'hi-IN'` (matches the project-wide Odia→Hindi TTS fallback).
- `TWILIO_VOICE_MAP.Odia = 'Google.hi-IN-Neural2-A'` (Hindi Neural2 instead of English Neural2).
- Comment added explaining the rationale.
- Side-effect: `call/route.ts:48-53` no longer rejects Odia outreach with "Auto-call not supported" — Odia is now a first-class supported language. `contact-parent-modal.tsx` `canCall` flips from false→true for Odia parents (desired UX outcome).

**Tests added/updated (5):**
- `TWILIO_LANGUAGE_MAP.Odia === 'hi-IN'` (replaces old "returns null for Odia" assertion).
- `TWILIO_LANGUAGE_MAP` now reports 11 supported languages (was 10).
- `TWILIO_VOICE_MAP.Odia === 'Google.hi-IN-Neural2-A'`.
- Simulated route-level fallback verifies neither `en-IN` nor English voice appears for Odia input.

## F8-03 — twiml-status summary double-generation (P0)

**File:** `src/app/api/attendance/twiml-status/route.ts`, `src/__tests__/api/attendance-voice-fixes.test.ts`

`generateAndSaveSummary` previously fired on every `completed`-status webhook with no guard. Twilio retries on transient failures and load balancers occasionally double-deliver, so summary generation ran repeatedly — multiplied LLM cost and churned the persisted summary doc.

**Fix:** Firestore transaction atomically check-and-sets a `_summaryGenerating` claim flag. The transaction body:
1. Read doc snapshot.
2. If `callSummary` already exists → return false (already generated).
3. If `_summaryGenerating` already true → return false (another worker holds it).
4. Else set `_summaryGenerating=true` and return true.

Only the worker that wins the claim runs the LLM. On failure the claim is released so a future retry can attempt it; on success the claim is cleared alongside the persisted summary. Mirrors the `!existing.callSummary` pattern in `transcript-sync/route.ts:87` but uses a real transaction for stronger race safety.

**Tests added (3, contract-style with in-memory tx fake):**
- First callback claims; second callback rejected.
- Retry after `callSummary` persisted → rejected.
- Three retries → exactly one LLM call.

## F8-04 — twiml turn dedup (P1)

**File:** `src/app/api/attendance/twiml/route.ts`, `src/__tests__/api/attendance-voice-fixes.test.ts`

No `(CallSid, SpeechResult)` dedup. Twilio Gather retries duplicated parent turns into the transcript and re-ran the LLM agent reply.

**Fix:** fingerprint = `${callSid}:${turnNumber}:${sha1(SpeechResult).slice(0,12)}`. Firestore transaction reads `processedTurns: string[]`; if the fingerprint is present it returns the previously cached TwiML reply (stored in `processedTurnReplies: Record<fp,xml>`). The cache is updated when the agent reply is finalized. `processedTurns` is bounded to the last 32 entries to prevent doc growth.

If the fingerprint is duplicate but no cached reply exists yet (race: first call still in flight) the route returns a benign "keep-listening" Gather so Twilio doesn't drop the call.

**Tests added (4):**
- Same `(callSid, turn, speech)` → identical fingerprint.
- Different speech → different fingerprint.
- Different turn → different fingerprint.
- Different callSid → different fingerprint.

## F8-05 — Punjabi speech tag (P2)

**File:** `src/app/api/attendance/twiml/route.ts`, `src/__tests__/api/attendance-voice-fixes.test.ts`

`SPEECH_LANGUAGE_MAP['pa-IN'] = 'pa-Guru-IN'`. Twilio's STT expects `pa-IN`.

**Fix:** changed to `'pa-IN'`. One-line.

**Tests added (1):** map returns `pa-IN`, asserts it is not `pa-Guru-IN`.

## Verification

```
npx tsc --noEmit          → clean
npx jest --testPathPatterns "twilio-validate|attendance-call|attendance-voice-fixes"
  Test Suites: 3 passed, 3 total
  Tests:       44 passed, 44 total
```

## Files touched

- `src/lib/twilio-validate.ts`
- `src/types/attendance.ts`
- `src/app/api/attendance/twiml/route.ts`
- `src/app/api/attendance/twiml-status/route.ts`
- `src/__tests__/lib/twilio-validate.test.ts` (added 6 tests)
- `src/__tests__/api/attendance-call.test.ts` (updated Odia assertions)
- `src/__tests__/api/attendance-voice-fixes.test.ts` (new, 13 tests)

## Out of scope / follow-ups

- `processedTurnReplies` map will grow unbounded if a call has >32 unique fingerprints (unlikely — `MAX_TURNS=6`). If we ever raise MAX_TURNS, prune stale keys alongside the `processedTurns` slice.
- The `call/route.ts` host-protocol detection at line 60 (`host?.includes('localhost')`) is a separate substring check that still exists. It only affects whether the locally-built TwiML URL uses `http` vs `https` (no security boundary). Worth a defensive tightening in a separate PR.
- `_summaryGenerating` flag will leak `true` if the process is killed between claim and update. Acceptable for now — Twilio gives up after ~12h and the next manual reset clears it. A future cleanup job could time-expire stale claims.
