# Exotel Call Quality — One-Page Findings Note (SP-18)

**To:** Abhishek Gupta  
**From:** Sampark Engineering  
**Date:** 2026-11-28  
**Status:** Code audit complete on `sargupta/sahayakai` (`main` after PR #221). Live 3+3 Exotel vs Plivo handset comparison pending test-phone pickup on `$RIYA_REAL_TEST_NUMBER`.

---

## Why Exotel Calls Sound Worse & Lag Compared to Vobiz / Plivo

| Priority | Root Cause | Where in Code | Impact on Call | Fix to Try |
|---|---|---|---|---|
| **P0** | **PR #230 uses `Url` (ExoML), which AgentStream ignores** (already superseded on `main` by PR #221 using `StreamUrl` + `StreamType=bidirectional`) | PR #230 vs `sahayakai-main/src/lib/exotel/client.ts` | Zero WS fetches on PR #230; `Duration` is `null` on AgentStream calls (`exotelOutcome` on `main` already keys off `Status`) | Close PR #230; keep all Exotel work on `main`'s `StreamUrl` client |
| **P1** | **Double lossy μ-law ↔ PCM16 quantization round-trip** | `exotel_frames.py` (`parse_exotel_inbound`, `ExotelCodec.play`) & `audio.py` | Exotel sends/expects **PCM16 8 kHz**, but the bridge converts `PCM16 → μ-law → PCM16 16k` inbound and `PCM16 24k → μ-law → PCM16 8k` outbound—introducing unnecessary 8-bit μ-law quantization noise on top of PSTN narrowband | Add a direct `pcm24k_to_pcm8k_le` / `pcm8k_to_pcm16k_le` path for `ExotelCodec` so Exotel bypasses μ-law completely |
| **P1** | **200 ms batching + forced silence padding mid-turn** | `exotel_frames.py` (`EXOTEL_MIN_CHUNK_BYTES = 3200`) & `router.py` (`_pace_outbound`) | Every TTS burst gap beyond comfort ticks calls `codec.flush()`, padding short remainders with up to **180 ms of zero-silence** (`_SILENCE_PCM_SAMPLE`) and emitting choppy 200 ms jumps (vs 20 ms on Vobiz, 100 ms on Plivo) | Buffer outbound PCM16 in `ExotelCodec` across short burst gaps (`flush()` only at explicit turn-end / `turn_complete`), instead of zero-padding mid-utterance |
| **P2** | **Cross-region cluster hop (Mumbai bridge ↔ SG Exotel)** | `EXOTEL_SUBDOMAIN=api.exotel.com` vs `sahayakai-riya-bridge` (`-el`, `asia-south1`) | Extra cross-region WebSocket RTT and jitter between Mumbai Cloud Run and Exotel Singapore (`api.exotel.com`) | Test Mumbai cluster (`api.in.exotel.com`) if account supports it, or co-locate bridge traffic in `asia-southeast1` for SG Exotel |
| **P3** | **Query string stripped + API quirks** | `router.py` (`exotel_stream`), `exotel/client.ts` | Exotel strips `?t=…` from `StreamUrl` (bridge recovers token from `start` custom params, adding up to `_EXOTEL_AUTH_SECONDS` wait); `To: false` / `null` `AnsweredBy` / `Duration` quirks | Keep `exotel_token_from_frame` + `exotelOutcome(status)`; pass call language via `/context` rather than `params={"lang": "English"}` |

---

## Immediate Recommendation

1. **Close PR #230** (`feat/sampark-exotel-calls-fixed`) — `main` already has the working `StreamUrl` client and `exotel_frames.py` from PR #221.
2. **Test the two P1 audio fixes** on a clean branch off `main` (skipping μ-law round-trip for Exotel + flushing only at turn-end rather than every empty pacer tick).
3. **Run the SP-18 / SP-17 live comparison** (3–5 answered calls each on Exotel, Vobiz, and Plivo to `$RIYA_REAL_TEST_NUMBER`) to measure `first_audio_ms`, connect rate, and MOS/WER before choosing the default carrier for AtithiVani (SP-10) and Placement World (SP-11).
