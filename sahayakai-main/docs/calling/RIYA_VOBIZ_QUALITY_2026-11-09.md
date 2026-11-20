# Riya on Vobiz — conversation quality, 2026-11-09

Uncommitted, `feat/parent-call-voice-upgrade` (call-bridge-wt). Synthetic data only. Two real calls today
(before most fixes): Alyssa `bb3f2916-40d4-47a3-b341-8a13555e4c63` (61 s, $0.38) and Sir
`304e7580-97a2-4202-a557-9cb6f0588470` (62 s, $0.76). **No real call has been placed with the final code.**

## How it was tested

- `riya2/harness.py` (session scratchpad): a fake Vobiz carrier streams recorded parent speech, in real time,
  into the real bridge → real Gemini Live (native audio) → Riya's state machine. 15 scenarios, run one at a time.
  Parent voices: Gemini Puck/Kore (verified verbatim), Kore Hindi/Kannada (11-07 clips).
- `bench/stt_bench.py`: 32 clips through a simulated phone channel (300 Hz HP, 15 dB SNR, μ-law) into Live
  with Riya's exact input config, scoring word error rate.
- Sampark e2e: the real Sampark service (scripts/sampark/vobiz-riya-e2e-server.ts) + the real bridge.

## Problems, root causes, changes

| # | Observed | Root cause (evidence) | Change |
|---|---|---|---|
| 1 | Sir's answer to "Will you attend?" lost; 5 s silence | Live sent no transcript/reply; bridge waited 3.5 s then a generic "say again" | Unheard re-ask names the last question; threshold 3.2 s (2.0 s proved too eager: transcripts land up to 2.7 s late) |
| 2 | Sir call closed with attendance unknown | "Could you say that again?" counted toward the 2-question budget | Clarifications never count; end_call refused once while attendance is unanswered |
| 3 | Hang-up as Sir began speaking | soft-end window 2.5 s, no edge check | 3.0 s + final VAD check |
| 4 | "You are?" → Riya started PTM details, muted → "I'm calling…" | model answered a who-question with details pre-verification | Bridge answers who-questions itself (cached "I'm Riya… could you confirm…") |
| 5 | "Yes sir" after a muted fragment verified the parent | yes accepted without a heard guardian question | yes counts only after a fully heard guardian question (or explicit "I'm his mother") |
| 6 | Garbled verification reply → model improvised; "No, I won't come" then closed as wrong number | unclear identity left to the model; any "no" = denial | unclear → cached re-ask once; long non-explicit "no" is not a denial |
| 7 | No preferred time asked after "cannot attend" | prompt-only rule ignored when the parent also raised a complaint | state machine tracks cannot-attend; one cue after playback if Riya did not ask |
| 8 | Busy / "call me later" hung up immediately | workflow export predates callbacks; Sampark expects `callback_requested_time` | CALLBACK stage: ask when (cached) → ask time if only a day → repeat back → confirm → close honestly ("noted your request"); never overrides do-not-call |
| 9 | Callback repeat-back muted | pre-verification guard treated "tomorrow at 6" as a call detail | in the callback stage only the call's locked values are blocked |
| 10 | Cached line cut or doubled by the model's own reply | discard flag reset by the model's earlier turn_complete | line guard: no model audio/text while a cached line plays, and the competing turn is dropped |
| 11 | Angry parent: goodbye at the end of every reply | model closes after answering | end refused unless the parent's last words are a wrap-up; empathy/de-escalation rules; "can the teacher call me?" → callback |
| 12 | Uncached school: no AI disclosure / no "good time to talk?" | instruction said the opener was "ALREADY spoken" | model told to say the opener verbatim when it is not cached |
| — | Input resampling | bench: current linear 16 kHz WER 0.067 (24/32 exact) ≈ FIR 0.068 (27/32); native 8 kHz 0.78 | unchanged (not the cause) |

Also: data collection now reports `callback_requested_time`, `stop_requested`, `recipient_confirmed` (Sampark keys);
state-machine facts override the extractor.

## Results (final code unless noted)

| Scenario | Result |
|---|---|
| Normal PTM | ✅ verified, details, can_attend, natural close |
| Behaviour concern | ✅ respectful update, next-steps answer, close after "bye" |
| Angry / disagreeing parent | ⚠️ acknowledges, no argument, call stays open, teacher callback offered on request; model still appends "Have a good day" to replies (refused by the bridge, but audible) |
| Unrelated question (weather) | ✅ "I don't have that information", returns to attendance |
| PTM cannot attend | ✅ asks preferred time, "Saturday morning" captured |
| Callback "call me tomorrow" → time → confirm | ✅ `callback_requested_time = tomorrow at 6 PM` (s07, s08); Sampark creates a PROPOSED callback (e2e) |
| Repeat request | ✅ repeats the date, then attendance |
| Interruption "wait, which date?" | ✅ answers the date, continues |
| Wrong number | ✅ apology, no details |
| Do not call | ✅ closes, `stop_requested=yes` |
| Silence | ✅ one reprompt, polite close |
| "You are?" before verification | ✅ cached who-line + guardian question, no leak |
| Hindi short replies | ✅ verified and delivered |
| Kannada | ❌ misheard (STT en-IN only); fails safe (unverified close, nothing disclosed) |

Replies: typically 1.1–1.8 s after the parent stops; verification → details 2.2–2.9 s.

## Remaining limitations

1. Not yet confirmed on a real handset with the final code (next step: one test call to the allow-listed number).
2. Live ASR: ~93% of phrases exact on degraded phone audio; it can drop a trailing sentence.
3. Kannada is not understood; Sampark's catalogue has no Kannada either (refused before dialling).
4. The native-audio model ignores text-only "say exactly" requests and no longer returns its own transcript;
   fixed lines are pre-rendered and checked with a separate transcription (scratchpad render2.py).
5. Behaviour calls: the model's habit of a trailing goodbye is prompt-controlled only.
6. The 4 `test_telephony_only_surface` failures are environmental (settings validation on import), unchanged.

## Real call through Sampark with Vobiz selected (19:22 IST)

`bc2c8ae0-6324-4616-8114-c995d75fcb01`, to the authorised test number …9732 from the company account (…3645).
It was placed by the real Sampark start path (`startRiyaCall`, provider `vobiz`) via the local Sampark server, with the real
Vobiz answer/status/context/event legs. Answered 19:22:47; ended 19:24:15; billed 88 s; $0.76; normal hangup.
Sampark record: `completed`, 91 s, `recipient_confirmed=yes`, `ptm_attendance=cannot_attend`,
`ptm_preferred_time="17 5:00 p.m."`, final synopsis, 13-turn transcript.

Defects seen:
- The parent's alternative ("17th, 5 PM") was "corrected" back to 10 AM by the hallucination check, which only allowed
  record values. **Fixed after the call** (the parent's own words are allowed); unit-tested, not re-verified on a phone.
- The first reply was misheard ("No, you're not allowed 10 to 12"); Riya continued to the guardian question,
  and `good_time_to_talk` was stored as "no" by the extractor.
- One missed guardian reply → "Sorry, I didn't catch that" re-ask (worked as designed).
