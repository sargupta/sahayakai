# Parent-call Odia native voice — proposal

Status: Proposed (founder decision needed)
Last updated: 2026-07-05

## The gap

Odia parents on the interactive attendance call and the demo call hear **a Hindi
voice reading Odia text**, not a native Odia voice. This is deliberate, not a
bug: Twilio's `<Say>` uses Google Cloud TTS voices, and Google has **no Odia
voice**. The current substitution (`Odia → Google.hi-IN-Neural2-A`, see
`src/types/attendance.ts:176,192`, comment "F8-02") was a P0 fix for the worse
prior state where Odia rendered through an *English* voice.

So the Odia-script text is phonetically approximated by Hindi phonology —
intelligible to many Odia speakers, but not native, and noticeably off on
Odia-specific sounds.

Note: this affects **only the telephony path** (Twilio `<Say>`). In-app Odia TTS
(`/api/tts`) already uses **native Sarvam `od-IN`** and is unaffected — that path
is correct today.

## Why it can't be a one-line fix

Twilio `<Say>` can only speak from its built-in voice catalog; you cannot hand it
a custom voice. Native Odia audio must be **pre-synthesized** (we already have
Sarvam `od-IN`) and delivered via `<Play>https://…/clip.mp3</Play>`, which means
Twilio fetches an audio URL we host.

- **Demo call** (`src/lib/demo-call/scripts.ts`): scripts are fixed strings.
  Native Odia is cleanly feasible — synthesize the handful of Odia lines once
  with Sarvam, store the MP3s as static/CDN assets, and `<Play>` them. Low risk;
  the whole route is behind `DEMO_CALL_ENABLED` (off by default).
- **Attendance call** (`src/app/api/attendance/twiml/route.ts`): replies are
  **dynamic** — `parent-call-agent` generates Odia text per turn. Native Odia
  means: synthesize with Sarvam `od-IN` on each turn → upload to a
  Twilio-reachable URL (signed GCS) → `<Play>` it. That adds
  synth+upload+fetch latency inside Twilio's ~15s webhook budget and introduces
  a live-call dependency on the audio host. Feasible, but it touches production
  telephony and needs its own soak.

## Recommendation

Two-phase, both flag-gated:

1. **Phase 1 — demo call (low risk, do first).** Pre-generate native Odia MP3s
   for the fixed demo scripts, host as static assets, `<Play>` for `Odia`. Drop
   the "Odia voice is being prepared, so this message is in Hindi" apology line.
   Ship behind the existing `DEMO_CALL_ENABLED` flag.
2. **Phase 2 — attendance call (needs founder sign-off).** Add a per-turn Sarvam
   `od-IN` synth → signed-GCS-URL → `<Play>` path, behind a new
   `PARENT_CALL_NATIVE_ODIA` flag, measured against the 15s Twilio budget on a
   staging number before any live traffic. Keep the Hindi-voice fallback if
   synth or upload exceeds budget.

Until Phase 2 ships, the Hindi-over-Odia substitution stays — it is a conscious,
documented tradeoff, not a defect. This is the only audio/voice item that cannot
be fixed without changing the telephony delivery mechanism, so it is correctly a
founder call rather than an autonomous change.

## Effort estimate

- Phase 1: ~0.5 day (synth clips, host, wire `<Play>` for one language, test).
- Phase 2: ~2–3 days incl. signed-URL plumbing, latency soak, fallback path,
  and a staging-number call test.
