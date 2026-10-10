# Parent-call voice and intelligence upgrade — implementation report (2026-10-10)

Branch `feat/parent-call-voice-upgrade` (local only, not pushed), based on
`feat/parent-call-live-bridge` @ `8787c164` — the build behind the successful
2026-10-10 live call, which is unchanged. No production change; no real calls
in this phase.

## Commits

| Commit | What |
|---|---|
| `a7041f93` | Barge-in on speech onset; dialogue state; concise prompt; transcript order/joining; school-data tools |
| `e14b4fae` | Identity needs the parent's actual "yes"; end after a spoken goodbye; prompt fixes from the live-model eval |
| `3a77f87f` | `engine.py`: the engine surface the bridge uses (Protocol only; for the Sampark cascade) |
| `8466d36c` | Warm the school-data reader at call start |
| `8c398a6a` | Goodbye net no longer races the model; interrupted turns transcribed as heard |
| `0c44d45e` | Goodbye net waits for the model's reply; "wait… wait" is one interruption |
| `0b054813` | A sentence pause after a real word does not resume VIDYA |
| `ff9015af` | Look things up without asking; finish an interrupted message; voice-eval harness |

## Workstream 2 — barge-in

Path today: Vobiz `media` → `_note_parent_audio` (level per 20 ms frame) →
`BargeIn` state machine → pacer (the single writer) → Vobiz `clearAudio`/`playAudio`.
Gemini's `interrupted` still cancels at any time.

- **PAUSE** after 120 ms of speech while VIDYA is audible: the pacer stops
  sending her frames at the next 20 ms tick and sends `clearAudio`; frames are held.
- **CANCEL** at 400 ms of speech (or Gemini `interrupted`): generation bump; queue,
  carry-over and resampler tail emptied; chunks and transcription still streaming
  for the abandoned turn are discarded until the model's turn ends.
- **RESUME** on a backchannel: 300 ms of quiet after a blip, 500 ms after a real
  word (≥ 200 ms). Speech resuming within 1 s continues the same interruption.
- **Echo:** threshold rises with the level heard while only VIDYA talks (×3).
  Refractory window only after click-length triggers.
- Parent audio always reaches Gemini; state (identity, delivery) survives interruptions.

**Latency** (speech onset → last VIDYA frame sent; target p95 < 300 ms):

| Where | p50 | p95 | Decision → stop |
|---|---|---|---|
| Local pacer, 30 interruptions | 129 ms | 145 ms | 20 ms (one frame) |
| Staging bridge (`call_closed` metrics, run 3) | 113 ms | 115 ms | 19 ms p95 |
| Staging, client side incl. network, final run | — | 172 ms (inject → last speech frame received) | `clearAudio` at 188 ms |

**Carrier limit (unmeasured):** audio Vobiz has already buffered is dropped by
`clearAudio` per its documented contract. How promptly it does so on a real handset
is not visible to us and needs the live call.

## Workstream 3 — conversation flow

- `dialogue.py`: OPENING → IDENTITY → MESSAGE → CONVERSATION → CLOSING.
  - Repeated introductions are counted (`repeat_intros` in `call_closed`).
  - Every director cue carries a state line ("already introduced / message delivered / not the parent").
- Prompt rewritten at under half its length.
  - Every rule pinned by existing tests is kept.
  - Added: never assert whether an event is scheduled; offer a callback once; never answer a goodbye with a question.
  - Added: look up at once without asking; finish an interrupted message.
- Transcript:
  - Agent text is committed per turn, so a late parent transcription is filed before the reply it prompted.
  - Fragments are joined raw ("Sahayak", "Ms.").
  - A cut-off turn keeps only the share of words actually played.
- Goodbye:
  - The bridge's safety net waits for the model's reply to finish. A non-question reply *is* the closing; otherwise it sends one closing cue.
  - A spoken farewell without `end_call` ends the call after 2.5 s unless the parent speaks.

## Workstream 4 — school-data tools (`VOBIZ_SCHOOL_DATA_TOOLS`, default off)

`get_attendance_summary`, `get_recent_assessments`, `get_homework_status`, plus
`confirm_parent_identity`.

| Requirement | How |
|---|---|
| Bound to the call | Scope from the call's `parent_outreach` (`teacherUid`, `classId`, `studentId`); verified against `classes/{classId}.teacherUid` and the student doc before the first read. No tool takes an id; extra args are rejected. |
| Identity first | Lookups refused until confirmed. The bridge checks the model's claim: question asked, parent spoke, and their words contain an affirmative (per-script, whole-word). The live-model eval showed the model reporting "confirmed" for "what is his attendance?". |
| Minimal fields | Counts, dates, marks, percent. No remarks, no other students, no phone. |
| Timeouts / cancellation | 2.5 s per lookup; Gemini `tool_call_cancellation` and call end cancel; reader warmed at call start (first lookup 3.1 s cold → 162–172 ms warm). |
| Freshness | Attendance window 7–60 days, `stale` if last mark > 14 days. Marks only within 120 days. 60 s per-call cache. |
| Never invent | Unavailable → `say`: offer a teacher callback. Homework submissions are **not stored by the app**, so that tool always answers "not recorded". No follow-up-status tool (not reliably stored). |
| Logs | Tool, outcome, duration, outreach id. No values. |

## Workstream 1 — voice evaluation

`scripts/telephony_voice_eval.py`:
- **Setup:** 31 candidates read the same 10 lines (Indian names, school terms, numbers and dates, code-mixed).
- **Phone path:** each clip goes through synthesis → 8 kHz μ-law → decode.
- **Measures:** time to first audio; WER/CER from an independent recogniser; pitch drift; LLM-judge scores (not human ratings, and noisy).

| Candidate | TTFA mean (p95) | WER | Judge overall (per-clip / holistic) |
|---|---|---|---|
| Sarvam `bulbul:v4-flash` ishita_en_customer | 886 ms (7.1 s outlier; else ~200) | 0.033 | 4.10 / 3.80 |
| Sarvam `bulbul:v4-flash` simran_enhi_customer | 208 (251) ms | 0.047 | 4.08 / 3.65 |
| `gemini-live-2.5-flash-native-audio` @ us-central1, Aoede + accent instruction | 844 (884) ms | 0.060 | 4.53 / 3.05 |
| `gemini-3.8-live` @ us-central1, Kore + accent instruction | 965 (2737) ms | 0.000 | 4.12 / 3.40 |
| **Current:** `gemini-live-2.5-flash` @ global, Aoede (rank 23/31) | 1503 (3435) ms | 0.080 (0.18 code-mixed) | 3.73 / 2.80 |

Verified availability in this project:
- **`gemini-live-2.5-flash`:** global only.
- **`gemini-live-2.5-flash-native-audio` and `gemini-3.8-live`:** us-central1 only. No Live model is available at asia-south1.
- **Sarvam:** `bulbul:v3`, `v3-beta` and `v4-flash` work; v4-flash streams raw 8 kHz μ-law.
- **Accent instruction:** an "Indian English accent" instruction on the current model breaks it (refusals, invented content); do not use it.
- **Pitch drift:** the 1.28× vs 1.07× drift gap recorded in `conformance.py` was **not** reproduced (spreads 1.06–1.32×).

Cost:
- **Gemini Live:** about $0.018 per minute of agent speech output, plus input and context tokens.
- **Sarvam Bulbul v3 TTS:** about ₹2.6–2.8 per minute of speech. v4-flash pricing is unpublished (unverified). Sarvam STT is ₹30/hour.

Residency:
- **Vertex global:** gives no location guarantee.
- **us-central1:** moves processing to the US.
- **Sarvam:** its processing location is unverified.

## Workstream 5 — engine

The Sampark plan (`docs/sampark/CONVERSATION_PLAN.md` §4, phase C1, on
`feature/school-parent-calling`) owns the cascaded Sarvam engine and its `Engine`
interface. So no competing cascade or interface was built here. `engine.py` only
names the surface `router.py` already uses, with a gate that Gemini Live still
provides it. Nothing is wired to it. **Needs the Sampark owner and Varun.** No
voice-reference clip was available; nothing was cloned.

## Verification

- **Python:** 1413 passed, 1 skipped. The 4 failures are the known local FastAPI-version baseline in `test_telephony_only_surface.py`. ruff and mypy are clean on `telephony/`.
- **Call tests:** 401 pass, 116 of them new. They cover:
  - barge-in at start, middle and end; repeated interruptions; echo; refractory and carry; stale frames and chunks; a late model interrupt;
  - cleanup while busy; p95 latency;
  - dialogue and identity; tools (scope, identity, minimal fields, staleness, timeout, cancellation, warm-up);
  - 8 scripted conversations; transcript order and heard-share; goodbye races; the engine contract.
- **Live-model eval** (`scripts/telephony_conversation_eval.py`, text input, real Gemini Live, real tools on an in-memory school): 8/8 scenarios pass. The checks are a single introduction, no numbers outside the message and tool results, the expected tools, the identity gate, and the end reason.
- **Isolated staging** (`sahayakai-telephony-calltest`, database `parent-call-test`, test signing key): 5 simulated-carrier runs, no phone and no Vobiz. Each found and drove a fix above. The final revision is `00006-mrv` (image `…@sha256:14bb296a…`). Production `sahayakai-telephony-00037-f5b` was untouched throughout.
- **Web app:** no TypeScript changes since `8787c164`.
- **Supported languages:** English verified end to end on staging. Hindi and code-mixed English–Hindi verified for affirmations, goodbye detection and recognition hints only. Other languages are not claimed.

## Remaining limitations

1. **The model's judgement is uneven:**
   - it sometimes answers "I have a question about his marks" with a question instead of a lookup;
   - it does not always finish a message the parent cut into;
   - it occasionally re-summarises after "haan ji, boliye".

   The bridge enforces safety (identity, endings, transcript) but not conversational skill.
2. **The voice** remains the current voice on the reviewed model. Changing it is a product, residency and cost decision (see Workstream 1).
3. **Carrier-side barge-in** (Vobiz buffer drop on a real handset) and real handset echo are verified only by the live call.
4. **The affirmative lexicon is deliberately narrow.** A miss makes VIDYA ask once more.

## Recommended next steps

1. One approved live call on staging `00006-mrv` (lookups on) to verify barge-in on a handset, a lookup, and the single goodbye.
2. A blind listening test on a real Vobiz line of the shortlist: native-audio Aoede/Kore (us-central1) vs Sarvam `bulbul:v4-flash`. Decide residency first.
3. A Sampark sync before any engine work.
