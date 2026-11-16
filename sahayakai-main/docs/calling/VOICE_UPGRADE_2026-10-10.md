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

---

# 2026-10-11 update: Neha voice and real-phone reliability

## The handset test that failed (14:12 IST, Vobiz `e6860f6b-…`)

The call connected and completed (100 s), but as a voice test it failed:

1. **Zero barge-in pauses.**
2. **Garbled transcriptions:** "connection matlab in English x ^ 6Y", "Villa".
3. **No identity confirmation,** so no lookups.
4. **A second introduction.**
5. **English kept** when the parent asked in Hindi.

## Root causes (measured)

| Failure | Cause | Evidence |
|---|---|---|
| No barge-in | (a) `_feed_barge_in` examined only whole 160-byte frames inside each payload; Vobiz documents no inbound chunk size. (b) A fixed 400 threshold with six consecutive loud frames rejected quiet handset speech and reset on every syllable dip. | Old code on handset-like signals: 0 pauses for normal speech in 80-byte chunks; 0 pauses for -38 dBov speech even at 160 bytes. New code: pause + cancel in every case (`test_telephony_handset_barge_in`, 37 cases). |
| Garbled replies | Gemini Live's own input transcription, not our audio conversion | Phone-path recognition eval (288 runs, `scripts/telephony_stt_eval.py`). Gemini Live returned English in Devanagari ("व्हाट मार्क्स डीड ही गेट इन साइंस?") and dropped utterances: 56–67% exact, 4 empty. Sarvam `saaras:v3-realtime`: 93–96% exact on English, 0 empty. |
| Swallowed reply (both engines) | A barge-in on a reply that had finished generating but was still playing set a discard that never lifted. | Staging: the attendance answer was generated and dropped. |

## Neha engine (staging only: `VOBIZ_ENGINE=cascade`)

- **Pipeline:** Sarvam `saaras:v3-realtime` (language `auto`) → `gemini-2.5-flash` (global first, asia-south1 fallback) with the bridge's own prompt and tools → Sarvam **`bulbul:v4-flash` / `neha_en_customer` / `en-IN`**.
- **Audio from Bulbul:** `audio/pcm`, headerless PCM16 at 24 kHz, the same as Gemini Live, so it goes through the bridge's resampler unchanged. The recorded opener was re-rendered in Neha's voice.
- **Hindi:** spoken only after the parent speaks Hindi or asks for it. The engine decides; the model does not. Hindi intelligibility was verified on the phone path by round trip. Naturalness was not verified.
- **Voice choice:**
  - `neha_en_customer`: judge scores 4.33 per-clip / 3.75 holistic.
  - `neha_en_latenight`: 3.80 / 2.90.
  - v3 `neha`: 4.22 / 3.00, with a p95 time to first audio of 4.4 s.
  - Current Gemini voice: 3.73 / 2.80.
  - These are LLM-judge scores, not human ratings. "Messy and relatable" is a human judgement; the judges call `neha_en_customer` clear and Indian-English with somewhat flat prosody.

## Final staging results (revision `00013-p2p`, image `…a80d0459…`, simulated carrier, 80-byte chunks)

| | sim-13 | sim-14 | sim-15 (Hindi) |
|---|---|---|---|
| Onset → stop p50 / p95 (server) | 77 / 84 ms | 59 / 87 ms | 88 / 88 ms |
| Inject → last speech frame (client, incl. network) | 140 ms | 125 ms | n/a |
| Identity | confirmed | confirmed | confirmed |
| Lookups | marks + attendance correct | marks + attendance correct | attendance correct (Hindi) |
| Message completed after interruption | yes | yes | n/a (not interrupted) |
| Repeated intro | 0 | 0 | 0 |
| Goodbye | one | one | one (Hindi) |
| First audio per reply | 0.88–2.06 s | 0.81–2.08 s | 0.95–2.23 s |

## Remaining limitations

- **Unproven on a real handset:** carrier-side clear latency, real echo levels and real inbound chunk sizes. The new per-call telemetry logs all of them without audio or words.
- **Reply latency:** 0.8–2.2 s after the recogniser's end-of-speech (≈0.5 s silence), so slower than ideal.
- **Short Hindi replies** are sometimes transcribed in Gujarati script by language auto-detect.
- **Model variance:** the model still occasionally asks a clarifying question, or answers a question again when it is repeated.
- **Vertex capacity:** asia-south1 returned 429s and timeouts for over an hour on 2026-10-11. The global fallback covers it but changes the processing location.
- **Ownership:** the cascade is a prototype for the Sampark owner (CONVERSATION_PLAN.md §4, C1), not a production engine.

# 2026-10-11 repair: privacy gate, state machine, true barge-in

After the 2026-10-11 handset call (Vobiz `41534a41-…`), the teacher's message was given to a caller who had only said "Hello" and "What". Each "Wait" got a new "Yes, please tell me." "Repeat" was refused. The call ended after six utterances. Commits `62c80b13`, `52cd2a86` and `a09e198d` (local, not pushed). Nothing deployed to production; no call placed.

## Root causes

| # | Defect | Where |
|---|---|---|
| 1 | Child data (name, reason, marks, message) was in the model's context from the first word; only the two lookup tools were gated; the kickoff told the model to name the child | `prompt.build_parent_call_instruction`, `router._prepare_live_session`, `flow.KICKOFF_*` |
| 2 | Identity was the model's claim, checked against a yes-word; the question named the child | `router._run_identity_check`, `dialogue.confirm_identity` |
| 3 | The cascade answered every final transcript itself ("Wait" → "Yes, please tell me.") | `cascade._on_stt` |
| 4 | The acoustic release resumed VIDYA before the transcript said what was spoken | `barge_in` release → `router._apply_barge_action` |
| 5 | "Never re-deliver the message" made VIDYA refuse a repeat | `prompt._BASE` |
| 6 | The 6-utterance ceiling counted wait/what/repeat/yeah; the close cue could follow a question | `router._must_end_now`, `_begin_close` |
| 7 | The model's `end_call` was honoured on its own say-so | `router._handle_tool_call` |
| 8 | Resampling whole TTS chunks on the event loop starved the 20 ms pacer (2.9% late, worst 285 ms) | `router._on_model_audio` |
| 9 | Found on staging: the privacy allowlist was unfolded ("message") while tokens were folded ("mesage"), so the guard blocked VIDYA's own identity question | `privacy.ProtectedTerms.build` |
| 10 | Found on staging: silence was counted from synthesis, not playback, so the follow-up question landed on the end of VIDYA's own question | `router._pace_outbound` |
| 11 | Found in replay: a child's surname that is a word in the school's or teacher's name blocked the introduction; "Ms." split the teacher's name across two TTS requests; consecutive VIDYA turns were filed as one transcript entry | `privacy`, `cascade.split_sentences`, `router._record_turn` |

## What changed

- **One non-LLM gate** (`privacy.py`, `dialogue.check_identity`). The caller must say the child's name, fuzzy-matched strictly. The model starts LOCKED and is unlocked only by the bridge. Every pre-verification sentence passes an output guard before synthesis (cascade) or is cut the moment its transcript shows it (Live). A denial fails closed; three neutral questions, then a polite close.
- **Explicit state machine** (`dialogue.py`): stages GREETING → IDENTITY_CHECK → MESSAGE_DELIVERY → PARENT_RESPONSE → TOOL_LOOKUP → FOLLOW_UP → GOODBYE, plus floor sub-states. Verified stages are unreachable before verification. One decision per final transcript: respond, repeat the message verbatim, repeat the last line, yield the floor, resume, ask again, or close.
- **Barge-in**: stop on onset; after a release, hold until the transcript decides ("haan" resumes, anything else cancels); "wait" never auto-resumes.
- **Turns**: only substantive utterances count, up to 12. The limit closes only when no question is open. Goodbyes are fixed lines, said separately. `end_call` is a request the state machine may decline.
- **Pacing**: μ-law is produced in 40 ms slices off the pacer's path; per-call lifecycle metrics are logged.

## Verification

- Python: 1579 passed, 1 skipped; the 4 failures are the pre-existing `test_telephony_only_surface` baseline (local FastAPI). Telephony: 569 passed. ruff, ruff format (changed files) and mypy are clean. The web app is unchanged.
- Deterministic replays (`test_telephony_call_replays.py`, 28 tests) run through the real bridge, pacer, carrier pump, barge-in detector, state machine, guard, cascade and tools, with fake STT/LLM/TTS only. They cover scenarios 1–14 plus a model trying to disclose before verification.
- Isolated staging `sahayakai-telephony-calltest-00016-npd` (image `…f3476d33…`) with real Sarvam STT/TTS and Gemini, and a simulated carrier (no phone, no `cuid`, synthetic record in `parent-call-test`):

| Scenario | Result |
|---|---|
| "Hello?" / "What?" / "Can you repeat the message?" unverified | Neutral question each time (0.46–0.73 s), polite close after the third; no child data |
| Name → message; talk over it | Clear sent 141 ms after onset, last VIDYA audio 110 ms; parent's question answered from the record |
| "Repeat the message", then "Wait." | Verbatim repeat; 0 VIDYA frames in the following 3 s |
| "Sorry?" / "Okay." / "What?" | Repeat / carry on / repeat; no "Yes, please tell me" |
| Goodbye | One fixed closing line, then hang-up |

| Metric (p50 / p95) | Mock replays | Staging (real STT/LLM/TTS) |
|---|---|---|
| End of speech → final transcript | 141 / 172 ms (simulated) | 905–986 / 1032–1151 ms |
| End of speech → first reply audio | 188 / 281 ms | 1309–1512 / 1596–3597 ms (p95 includes lookups) |
| Speech onset → VIDYA silent | 83 / 99 ms | 77–91 ms |
| Pacer frames late | 0.26% | <0.05%; worst single tick 301–548 ms |

## Remaining limitations

- **Recogniser floor:** end-of-speech → final takes about 0.95 s (Sarvam VAD, 500 ms silence), most of the reply latency.
- **Loud echo:** at about −37 dBov the detector can pause on VIDYA's own echo during its warm-up. Typical handset echo (−40 to −45 dBov) is fine. Unproven on a real line.
- **Interrupted delivery:** the message counts as delivered once started. After an interruption the model may finish it in its own words rather than verbatim.
- **Bare "Hmm" after a question** goes to the model, which answered off-target ("I don't have information about his homework"), honestly but unhelpfully.
- **"What?" after the message** repeats the whole delivery turn, including "Thank you."
- **Worst pacer tick:** about 0.3–0.5 s once per call on staging (cause not yet isolated).
- **No real-handset validation** of this build. Ownership remains the Sampark owner's (the cascade is a staging prototype).
