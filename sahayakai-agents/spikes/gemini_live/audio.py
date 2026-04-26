"""μ-law ↔ PCM 16-bit conversion + audio framing helpers.

Twilio Media Streams send audio frames as base64-encoded μ-law 8 kHz
mono. Gemini Live's BidiGenerateContent expects PCM 16-bit 16 kHz mono.
Two conversions are needed each direction:

  1. μ-law ↔ PCM 16-bit (lossless via standard G.711 lookup)
  2. 8 kHz ↔ 16 kHz resample (linear interpolation; cheap)

Total per-frame cost target: < 5 ms on a Cloud Run gen2 instance.

This module is the smallest set of helpers needed by the latency
benchmark. The production voice service in Phase 2.1 will reuse these
or a faster (C-based) replacement if the spike measures > 5 ms.

References:
- G.711 μ-law spec: https://en.wikipedia.org/wiki/G.711
- Python `audioop`: deprecated since 3.13, will need replacement.
  For Phase 1.5 (pre-Phase-2-deploy) we will switch to
  `pydub` + `numpy` or pure-numpy. This module's audioop calls are
  tagged with a TODO marker.
"""
from __future__ import annotations

import audioop  # noqa: PLC0415 — top-level is fine here; module-scoped helpers
import math

# ---- μ-law ↔ PCM ----------------------------------------------------------


def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    """Decode μ-law-encoded audio bytes to PCM 16-bit signed.

    1 byte of μ-law → 2 bytes of PCM (16-bit). Uses the stdlib `audioop`
    G.711 lookup table for correctness; ~1 µs per byte on modern CPUs.
    """
    return audioop.ulaw2lin(mulaw_bytes, 2)


def pcm16_to_mulaw(pcm16_bytes: bytes) -> bytes:
    """Encode PCM 16-bit signed bytes to μ-law (G.711)."""
    return audioop.lin2ulaw(pcm16_bytes, 2)


# ---- Resample 8 kHz ↔ 16 kHz ----------------------------------------------


def resample_pcm16(
    pcm_bytes: bytes,
    *,
    src_rate: int,
    dst_rate: int,
    state: tuple[int, tuple[tuple[int, int], ...]] | None = None,
) -> tuple[bytes, tuple[int, tuple[tuple[int, int], ...]]]:
    """Linear resample PCM 16-bit between sample rates.

    Returns (resampled_bytes, new_state). The state must be threaded
    through successive calls on the same audio stream so the
    resampler's internal interpolation buffer is preserved across
    frame boundaries — without this, every 20 ms frame produces a
    click at the boundary.
    """
    out, new_state = audioop.ratecv(
        pcm_bytes,
        2,  # 16-bit samples (2 bytes each)
        1,  # mono
        src_rate,
        dst_rate,
        state,
    )
    return out, new_state


def upsample_8k_to_16k(
    mulaw_bytes: bytes, state: tuple[int, tuple[tuple[int, int], ...]] | None = None
) -> tuple[bytes, tuple[int, tuple[tuple[int, int], ...]]]:
    """Twilio inbound: μ-law 8 kHz → PCM 16-bit 16 kHz."""
    pcm = mulaw_to_pcm16(mulaw_bytes)
    return resample_pcm16(pcm, src_rate=8000, dst_rate=16000, state=state)


def downsample_16k_to_8k(
    pcm_bytes: bytes, state: tuple[int, tuple[tuple[int, int], ...]] | None = None
) -> tuple[bytes, tuple[int, tuple[tuple[int, int], ...]]]:
    """Twilio outbound: PCM 16-bit 16 kHz → μ-law 8 kHz."""
    downsampled, new_state = resample_pcm16(
        pcm_bytes, src_rate=16000, dst_rate=8000, state=state
    )
    return pcm16_to_mulaw(downsampled), new_state


# ---- Framing --------------------------------------------------------------


# Twilio sends audio in 20 ms frames at 8 kHz μ-law mono = 160 bytes per frame.
TWILIO_FRAME_BYTES = 160
TWILIO_FRAME_DURATION_MS = 20


def split_into_frames(buf: bytes, frame_size: int = TWILIO_FRAME_BYTES) -> list[bytes]:
    """Slice a continuous μ-law stream into Twilio-sized frames.

    Trailing bytes that don't fill a frame are dropped — caller should
    re-buffer them. (At a steady 50 frames/sec there's always a clean
    boundary at the end of a normal utterance.)
    """
    n_frames = len(buf) // frame_size
    return [buf[i * frame_size : (i + 1) * frame_size] for i in range(n_frames)]


def silence_frame_mulaw(duration_ms: int = TWILIO_FRAME_DURATION_MS) -> bytes:
    """Generate a μ-law silence frame of the given duration.

    Used as a "thinking" placeholder when the agent hasn't produced
    audio yet (avoids Twilio inactivity-timeout disconnects).
    μ-law silence = 0xFF (the encoded value for amplitude 0).
    """
    n_bytes = int(8 * duration_ms)  # 8 samples/ms at 8 kHz
    return b"\xff" * n_bytes


# ---- Sample-level helpers (for tests) -------------------------------------


def encode_pcm16_sample(sample: int) -> bytes:
    """Encode a single PCM 16-bit sample (-32768..32767) as 2 bytes,
    little-endian (network byte order for PCM streams)."""
    if not -32768 <= sample <= 32767:
        raise ValueError(f"PCM 16-bit sample out of range: {sample}")
    return sample.to_bytes(2, byteorder="little", signed=True)


def decode_pcm16_sample(b: bytes) -> int:
    """Decode 2 bytes (LE signed) → int sample."""
    if len(b) != 2:
        raise ValueError(f"expected 2 bytes, got {len(b)}")
    return int.from_bytes(b, byteorder="little", signed=True)


# ---- Quality measure ------------------------------------------------------


def _rms(pcm_bytes: bytes) -> float:
    """Root-mean-square amplitude of a PCM 16-bit buffer. Useful for
    asserting silence vs voice in tests without external deps."""
    if not pcm_bytes:
        return 0.0
    n_samples = len(pcm_bytes) // 2
    sum_sq = 0.0
    for i in range(0, len(pcm_bytes), 2):
        sample = decode_pcm16_sample(pcm_bytes[i : i + 2])
        sum_sq += sample * sample
    return math.sqrt(sum_sq / n_samples)


def relative_loss_db(reference_pcm: bytes, candidate_pcm: bytes) -> float:
    """Approximate dB loss between a reference PCM signal and a
    round-tripped candidate (mulaw → PCM → mulaw → PCM, e.g.).

    Returns positive numbers (more loss = larger). 0.0 means identical
    RMS amplitude. Intended for sanity-check tests, NOT for production
    audio quality; subjective MOS testing comes later.
    """
    ref = _rms(reference_pcm)
    cand = _rms(candidate_pcm)
    if ref == 0.0:
        return 0.0
    if cand == 0.0:
        return float("inf")
    return abs(20.0 * math.log10(ref / cand))
