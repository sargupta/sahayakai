# Exotel Technical Findings & Remediation Guide

**Updated:** 2026-11-28  
**Scope:** `sahayakai-main/src/lib/exotel/client.ts`, `sahayakai-main/src/lib/sampark/conversation/exotel-provider.ts`, `sahayakai-agents/src/sahayakai_agents/telephony/{exotel_frames.py,carriers.py,audio.py,router.py}`

---

## 1. Repository State vs. PR #230

- **`main` (via PR #221, merged 2026-11-24)** already implements Exotel AgentStream (`POST /v1/Accounts/{sid}/Calls/connect.json` with `StreamUrl` + `StreamType=bidirectional`, `exotelOutcome(status)` keyed off `Call.Status`, and `ExotelCodec` in `exotel_frames.py`).
- **PR #230 (`feat/sampark-exotel-calls-fixed`)** is built on an outdated approach (`Url` / ExoML) which is silently ignored on AgentStream accounts (zero fetches to the ExoML URL while `StatusCallback` still fires) and carries failing CI (`sahayakai-ci-gate`) plus unintended deletions. **Action:** close PR #230 without merging.

## 2. Root Causes of Poor Exotel Audio & Latency

### 2.1 Double Lossy Quantization (`exotel_frames.py` ↔ `audio.py`)
- **Inbound path:** Exotel delivers 8 kHz 16-bit PCM (`media.payload`) → `parse_exotel_inbound()` compresses to 8-bit μ-law (`pcm16_to_ulaw`) → `router.py` expands back to 16-bit PCM16 at 16 kHz (`ulaw8k_to_pcm16k`) for STT / Gemini Live.
- **Outbound path:** Sarvam Bulbul / Gemini Live produces 24 kHz PCM16 → `pcm24k_to_ulaw8k()` downsamples to 8 kHz and compresses to 8-bit μ-law → `ExotelCodec.play()` decodes μ-law back to 16-bit PCM16 (`ulaw_to_pcm16`) for Exotel.
- **Effect:** Unnecessary 8-bit μ-law quantization noise on both legs even though Exotel's wire format is already 16-bit linear PCM.

### 2.2 200 ms Chunking & Mid-Utterance Silence Padding (`exotel_frames.py` + `router.py`)
- Exotel requires outbound `media` payloads ≥ `3,200` bytes (200 ms of 8 kHz PCM16) in multiples of `320` bytes (20 ms).
- In `router.py` (`_pace_outbound`, lines 4026–4034), whenever the pacer queue runs dry for one tick after `_COMFORT_TICKS` expire, `bridge.codec.flush(bridge.stream_id)` is called immediately.
- `ExotelCodec.flush()` pads any `< 3,200`-byte buffer tail with `_SILENCE_PCM_SAMPLE` (`\x00\x00`) up to 3,200 bytes. Every brief pause in TTS chunk arrival therefore injects up to 180 ms of hard zero-silence into the live stream, causing audible stutters and clipped syllables.

### 2.3 Hardcoded Language Fallback & Region Routing
- `router.py` (`exotel_stream`, line 4938) passes `params={"cuid": start_frame.call_id or "", "lang": "English", "agent": "riya"}` because Exotel strips query parameters from `StreamUrl` and only echoes `t` via custom parameters.
- `EXOTEL_SUBDOMAIN=api.exotel.com` routes through Singapore, while `sahayakai-riya-bridge` (`-el`) runs in `asia-south1` (Mumbai), adding cross-region RTT compared to `api.in.exotel.com` or `asia-southeast1`.

### 2.4 Exotel API Quirks to Preserve
- `From` = callee number; `CallerId` = ExoPhone (`08047284463`). Swapping them dials the ExoPhone itself.
- `Duration` is `null` on AgentStream calls; `exotelOutcome` must read `Call.Status` (`completed` vs `busy` / `no-answer` / `failed` / `canceled`).
- Exotel returns `To: false` and `AnsweredBy: null` in some payloads and does not HMAC-sign webhooks—callback auth relies on per-call HMAC tokens (`mintVobizToken`).

## 3. Recommended Experiments (Ranked)

1. **Direct PCM16 pass-through in `ExotelCodec`** (bypass μ-law encode/decode on inbound and outbound Exotel frames).
2. **Turn-boundary flush only** in `_pace_outbound` for batching codecs (only zero-pad to `3200` bytes on `turn_complete` / `stop`, not on mid-utterance pacer empty ticks).
3. **Measure 5 answered calls per carrier** (`Exotel` vs `Vobiz` vs `Plivo`) with `scripts/sampark/carrier-benchmark.mjs` and `audio-quality.mjs`.
