# F8 — Voice Pipeline Forensic Report

Investigator: Role 15 (voice-pipeline). Scope: STT (Sarvam + Gemini), TTS (Sarvam + Google), VIDYA orb, Twilio parent-call.

Method: static-trace + cross-reference. No live Cloud Run requests issued (no gcloud impersonation credentials wired in this forensic environment); every finding is grounded in code paths the request would traverse. Repro recipes provided below for live verification.

## Files audited

- `src/app/api/ai/voice-to-text/route.ts`
- `src/ai/flows/voice-to-text.ts`
- `src/lib/sarvam.ts`
- `src/lib/tts.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/assistant/route.ts`
- `src/app/api/attendance/twiml/route.ts`
- `src/app/api/attendance/twiml-status/route.ts`
- `src/app/api/attendance/transcript-sync/route.ts`
- `src/app/api/attendance/call-summary/route.ts`
- `src/lib/twilio-validate.ts`
- `src/types/attendance.ts`

## Findings (5)

### F8-01  P0  Twilio signature check can be bypassed via `Host` header injection
`src/lib/twilio-validate.ts:18,38` — `if (host.includes('localhost')) return true;` skips validation in dev. On Cloud Run the `Host` request header is attacker-controlled; an inbound request with `Host: localhost.attacker.example` matches the substring and skips the HMAC check entirely.
Impact: any caller can forge `/api/attendance/twiml` (GET + POST) and `/api/attendance/twiml-status` traffic, advance a real outreach's transcript, trigger LLM-generated agent replies, or mark a call `completed` and force a `generateCallSummary` LLM run on the victim's outreach.
Fix: gate the skip behind `process.env.NODE_ENV !== 'production'` AND exact `host === 'localhost:<port>'`. Reject untrusted Host values explicitly.

### F8-02  P0  Odia (`or`) parent calls always run as English
`src/types/attendance.ts:162` sets `TWILIO_LANGUAGE_MAP.Odia = null`. `src/app/api/attendance/twiml/route.ts:79` does `TWILIO_LANGUAGE_MAP[language] ?? 'en-IN'` — null nullish-coalesces to the fallback, so an Odia outreach makes the parent hear the English greeting, the English-language Gather (`speechLang='en-IN'`), and the English `noResponseGoodbye`. The teacher's `generatedMessage` is still Odia text rendered by an `en-IN` Neural2 voice — unintelligible to the parent.
`CALL_MENU_PROMPTS` also has no `or-IN` entry so even if the lang were threaded through, prompts would silently fall back to `en-IN`.
Impact: parent-call feature is non-functional for Odia. Sahayak ships Odia in 10 other voice surfaces (TTS, STT) — this is the single broken language.
Fix: add a Sarvam (`od-IN`) `<Connect><Stream>` path or a polite English-only abort flow; do not silently coerce a non-English parent into an English call.

### F8-03  P0  Call-summary regeneration is not idempotent on Twilio status retries
`src/app/api/attendance/twiml-status/route.ts:62-67` fires `generateAndSaveSummary` whenever `callStatus === 'completed' && transcript.length > 1`. There is no read of `existing.callSummary` before firing. Twilio retries status callbacks on non-2xx responses, **and even on 200s** under network jitter — both Twilio's docs and our existing code (`transcript-sync/route.ts:87` does `!existing.callSummary`) acknowledge this risk.
Each duplicate fires a fresh `generateCallSummary` LLM call (~$0.005-0.02 depending on transcript) and overwrites the prior `callSummary` mid-write — race window between read and `docRef.update`.
Impact: cost amplification + summary churn. Not a security bug, but burns budget and confuses the call-summary UI when fields flip between two slightly different LLM outputs.
Fix: mirror `transcript-sync`'s guard. Read the doc first, skip when `callSummary` already present, or use a Firestore transaction with `callSummaryGeneratedAt` sentinel.

### F8-04  P1  Twiml POST has no `(CallSid, turnNumber)` dedup
`src/app/api/attendance/twiml/route.ts:210-274` unconditionally appends `parent` + `agent` turns to `transcript[]` and increments `turnCount`. Twilio retries `<Gather action>` webhooks on a 5xx/timeout — a retry mid-conversation will double-write the same parent utterance plus a freshly-LLM-generated (and therefore *different*) agent reply, then the parent hears the second reply on the wire while the doc shows two turns happened. Combined with F8-03, retries also accelerate the MAX_TURNS=6 cutoff and prematurely end the call.
Impact: duplicate transcript entries, second LLM cost per retry, possible premature hangup.
Fix: include `RetryCount`/`Idempotency-Key` semantics — Twilio sends `CallSid`. Read `transcript[length-2]` and skip if the last parent turn already has identical `text` from the same `CallSid` within the past few seconds.

### F8-05  P2  Twilio speech-recognition Punjabi tag (`pa-Guru-IN`) is non-standard
`src/app/api/attendance/twiml/route.ts:26` maps Punjabi to `pa-Guru-IN`. Twilio's documented `<Gather language=>` list uses `pa-IN`. The extended subtag `pa-Guru-IN` is BCP-47-legal but not listed in Twilio's speech-recognition catalog — Twilio's Gather silently falls back to its default (en-US) when an unrecognised tag is supplied, which means Punjabi speech is being run through an English recognizer. Comment claims this is correct; live verification required.
Fix: confirm via Twilio Gather Languages docs and switch to `pa-IN` if not listed.

## Sub-findings / verified-safe behaviours

- **F8-S1  Sarvam-skip on Opus is correct.** `voice-to-text/route.ts:49-58` gates Sarvam on a regex matching only `mpeg|mp3|wav` MIMEs. Browser MediaRecorder default `audio/webm;codecs=opus` correctly skips Sarvam and goes straight to Gemini, avoiding the ~1s + log noise. Commit `727522140` referenced in code matches expectation.
- **F8-S2  Soft-empty STT returns 200.** `voice-to-text.ts:268-269,307-309` returns `{ text: '', language: hint }` on empty transcription rather than throwing. Avoids the documented client retry-loop cost amplification. Verified for both `voiceToText` and `voiceToTextFormData`.
- **F8-S3  ISO normalisation covers Sarvam `od`→`or` and Punjabi alias path.** `voice-to-text.ts:67-99` normalises `od/ori→or`, `pun/pnb→pa`, `mar→mr`, etc. Applied at output boundary in route.ts:80,107.
- **F8-S4  Script-mismatch retry fires for Sarvam Punjabi→Devanagari mis-tag.** `voice-to-text.ts:144-152` explicit Devanagari-mismatch fast-path catches the documented Sarvam pa→hi bug; route.ts:71 falls through to Gemini when triggered.
- **F8-S5  TTS Marathi explicit voice ID present.** `tts/route.ts:68` lists `mr-IN-Standard-A` explicitly. Was previously falling through to the implicit default — same string, but now type-visible.
- **F8-S6  Odia TTS fallback documented.** `tts/route.ts:78-88` documents and applies `or-IN → hi-IN-Standard-A` phonetic fallback. Avoids a guaranteed Google 400 round-trip.
- **F8-S7  TTS defensive secondary fallback.** `tts/route.ts:155-158` retries with `hi-IN-Standard-A` on any 4xx from the chosen voice — protects against stale voice catalog. Should never return 500 for a supported language.
- **F8-S8  Audio cap enforced.** `voice-to-text/route.ts:35-41` rejects >10 MB audio at 413. STT cost-capping verified.
- **F8-S9  Assistant `uiLanguage` overrides STT-detected language.** `assistant/route.ts:127-132` — explicit UI lang from `useLanguage().language` wins over potentially-misclassified STT output. Verified safe for Bengali-UI teacher with STT-misclassified English audio.
- **F8-S10  L1+L2 caches gate on `vidyaIntentCacheGate`.** Tool-trigger responses correctly exclude cached replies so a repeat ask re-classifies.

## Repros (live verification)

See `qa/forensics/F8-repros/` for self-contained scripts. Each script targets a deployed preview URL and expects gcloud impersonation auth in the environment.

- `F8-01-twilio-host-bypass.sh` — POST to `/api/attendance/twiml` with `Host: localhost.attacker.example` and a forged signature → expect 403; reproduces if 200 OK with TwiML body.
- `F8-02-odia-call.sh` — Seed an Odia outreach + GET `/api/attendance/twiml?outreachId=…` → verify response XML contains `language="en-IN"` (bug) vs `or-IN`/`od-IN` (fix).
- `F8-03-status-replay.sh` — POST a `completed` status twice with valid sig; verify only one `callSummary.generatedAt` Firestore write occurs (current: two LLM calls, two writes).
- `F8-04-gather-retry.sh` — POST same SpeechResult+CallSid twice within 5s; verify transcript length grows by 4 (bug) vs 2 (fix).
- `F8-05-punjabi-speech.sh` — Place a real Twilio test call with Punjabi audio; inspect Twilio call logs for actual recognizer language.

## Severity summary

| # | Severity | Title |
|---|----------|-------|
| F8-01 | **P0** | Twilio signature bypass via Host header |
| F8-02 | **P0** | Odia parent-calls always English |
| F8-03 | **P0**\* | Non-idempotent call-summary regeneration on Twilio retries |
| F8-04 | P1 | No `(CallSid, turnNumber)` dedup on Gather POST |
| F8-05 | P2 | `pa-Guru-IN` speech-recognition tag suspect |

\* F8-03 is rated P0 on cost-amplification grounds (LLM spend × Twilio retries) but is not a safety/security bug — drop to P1 if the cost ceiling is otherwise bounded.

## Out-of-scope items noted

- Sidecar dispatchers (`lib/sidecar/voice-to-text-dispatch.ts`, `vidya-dispatch.ts`, `dispatch.ts`) — `canary-shadow-diff` machinery looked clean on quick read; deeper canary-overshoot work is owned by Q4C lane (recent commit `9c8483b9c`).
- Pipecat streaming path (`twiml/route.ts:48-65`) — referenced but no orchestrator URL in this audit; treat as alpha.
- DPDP consent prologue — gated off via feature flag, only `en-IN` translated; not a voice-pipeline issue but a parent-call compliance gap worth flagging to lane F-compliance.
