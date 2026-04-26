# Phase 2 spike — Gemini Live + Twilio Media Streams

## What this spike answers

Per `.claude/plans/phase-2-vidya-voice-gemini-live.md` §2.0, the spike
must verify three claims before the voice service is built:

1. **Gemini Live region availability** — does `asia-southeast1` (or
   `asia-south1` post-DPDP migration) have GA Live? If not, what's the
   cross-region p95 RTT?
2. **End-to-end first-byte latency** — μ-law decode → PCM resample →
   Gemini Live session open → first audio frame back. Target p95 <
   800ms (per plan §2.0); honest expectation ~1500ms (per 30-agent
   review group F1).
3. **μ-law ↔ PCM conversion overhead** — Twilio sends 8kHz μ-law,
   Gemini Live wants 16kHz PCM. Resample + format-convert per 20ms
   audio frame must run < 5ms or the pipeline falls behind real time.

## What's in this directory

| File | Purpose |
|---|---|
| `audio.py` | μ-law ↔ PCM 16kHz conversion + audio framing helpers |
| `latency_benchmark.py` | Standalone script that measures (1)-(3) above against a configurable Gemini Live endpoint |
| `notebook.ipynb` | Interactive walkthrough — open a Gemini Live session, send a recorded prompt, listen to the response. **Not committed in this PR** — would carry recorded audio fixtures with PII concerns until DPDP review clears |

## What's NOT in this spike

- WebSocket termination (Cloud Run / FastAPI) — that's §2.1
- Gemini Live broker class (`live_client.py`) — that's §2.2
- Real-time behavioural guard on partials — §2.4
- Disconnect / resume — §2.3

The spike is the SMALLEST set of code that lets us measure the three
claims without committing to an architecture.

## How to run the benchmark

```bash
# From sahayakai-agents/
export GOOGLE_GENAI_API_KEY=$(gcloud secrets versions access latest \
    --secret=GOOGLE_GENAI_API_KEY --project=sahayakai-b4248)

# Tier-1 latency: just measure μ-law decode + PCM resample on a
# pre-recorded mulaw clip.
.venv/bin/python spikes/gemini_live/latency_benchmark.py audio-only

# Tier-2 latency: open a real Gemini Live session and measure
# first-byte from Twilio-sent μ-law to first agent-audio response.
# Costs ~$0.05 per run (3-5 minutes of Live audio).
.venv/bin/python spikes/gemini_live/latency_benchmark.py end-to-end \
    --model gemini-2.5-live-preview \
    --audio-clip ./samples/parent_speech_en.mulaw

# Tier-3 latency: same as tier-2 but adds a behavioural-guard check
# on partial transcripts. Verifies the 250ms cut-fire target.
.venv/bin/python spikes/gemini_live/latency_benchmark.py with-guard
```

## Latest spike results

(populated after first run — placeholder)

```
audio-only:        p95 = TBD ms (target < 5 ms)
end-to-end:        p95 = TBD ms (target < 800 ms; honest 1500 ms)
with-guard:        p95 cut latency = TBD ms (target < 250 ms)
```

## Decision gates

Per the plan §2.0:

- [ ] Audio conversion p95 < 5 ms — if NOT, drop to a C-based
      resampler or accept the latency hit.
- [ ] End-to-end first-byte p95 < 1500 ms — if NOT, defer Phase 2
      until Gemini Live regional GA in `asia-south1`.
- [ ] Cost projection within 2× of Phase 1 batch path per call —
      if NOT, defer Phase 2 until Live pricing improves.
- [ ] Partial-transcript guard cut p95 < 250 ms — if NOT, drop to
      post-utterance guard with mid-utterance audio gating (mute the
      output frame stream until the partial passes).

## Status

This is the SCAFFOLD only. The benchmark script imports modules that
exist; the modules themselves return synthetic values until the user
runs the spike with a real Gemini Live key. The audio conversion
helpers are tested independently against fixed-input fixtures.
