"""Unit tests for `spikes/gemini_live/audio.py`.

These pin the math + framing semantics so a future replacement
(stdlib `audioop` is deprecated in 3.13) can be verified against
the same suite.
"""
from __future__ import annotations

import os

import pytest

os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test")

from spikes.gemini_live import audio  # noqa: E402

pytestmark = pytest.mark.unit


class TestMulawPcmRoundTrip:
    def test_silence_roundtrips(self) -> None:
        # μ-law silence encodes as 0xFF; decoded PCM should be 0
        # (with negligible quantization error).
        mulaw_silence = b"\xff" * 160  # 20 ms at 8 kHz
        pcm = audio.mulaw_to_pcm16(mulaw_silence)
        assert len(pcm) == 320  # 2 bytes per sample
        # All samples should be small magnitude (≤ |8| due to quantization).
        for i in range(0, len(pcm), 2):
            sample = audio.decode_pcm16_sample(pcm[i : i + 2])
            assert abs(sample) <= 8

    def test_lossy_but_bounded_roundtrip(self) -> None:
        # μ-law is lossy — but the loss is bounded. A sine-like PCM
        # signal that gets mulaw-encoded and back should retain its
        # amplitude within ~1 dB.
        # Synthesize a 440 Hz sine wave at PCM 16-bit 8 kHz.
        import math

        n_samples = 320  # 40 ms at 8 kHz
        amplitude = 16000  # well below 32767 to avoid clipping
        pcm_in = bytearray()
        for i in range(n_samples):
            sample = int(amplitude * math.sin(2 * math.pi * 440 * i / 8000))
            pcm_in.extend(audio.encode_pcm16_sample(sample))

        mulaw = audio.pcm16_to_mulaw(bytes(pcm_in))
        assert len(mulaw) == n_samples  # 1 byte per sample

        pcm_out = audio.mulaw_to_pcm16(mulaw)
        assert len(pcm_out) == len(pcm_in)

        loss_db = audio.relative_loss_db(bytes(pcm_in), pcm_out)
        # μ-law typical SNR is 33+ dB; RMS amplitude loss should be < 1 dB.
        assert loss_db < 1.0


class TestResample:
    def test_8k_to_16k_doubles_bytes(self) -> None:
        # 160 bytes (320 samples? No — 1 byte per sample = 160 samples
        # at 8 kHz = 20 ms). After upsample to 16 kHz: 320 samples.
        # In PCM 16-bit, that's 640 bytes.
        mulaw_in = b"\xff" * 160
        pcm_16k, state = audio.upsample_8k_to_16k(mulaw_in)
        # Allow ±2 bytes for resampler interpolation edge effects.
        assert abs(len(pcm_16k) - 640) <= 2

    def test_state_is_returned_and_threadable(self) -> None:
        # Threading state across two calls should produce no clicks
        # at the boundary (RMS of concatenated output ≈ silence on a
        # silent input). The state itself for a constant-silence input
        # may legitimately not advance — the resampler's internal
        # interpolation buffer is also silence — so we don't assert
        # state inequality, just that it round-trips correctly.
        mulaw_chunk = b"\xff" * 160
        out1, state1 = audio.upsample_8k_to_16k(mulaw_chunk, state=None)
        out2, _state2 = audio.upsample_8k_to_16k(mulaw_chunk, state=state1)
        # State must be non-None after the first call (so callers can
        # thread it).
        assert state1 is not None
        # Both outputs should be near-silence (RMS small).
        rms_combined = audio._rms(out1 + out2)
        assert rms_combined < 50  # arbitrary tight bound for silence


class TestFraming:
    def test_split_into_frames_drops_partial(self) -> None:
        buf = b"\x01" * 165  # 1 frame + 5 leftover bytes
        frames = audio.split_into_frames(buf)
        assert len(frames) == 1
        assert all(len(f) == 160 for f in frames)

    def test_split_into_multiple_frames(self) -> None:
        buf = b"\x01" * 320  # exactly 2 frames
        frames = audio.split_into_frames(buf)
        assert len(frames) == 2

    def test_silence_frame_default_duration(self) -> None:
        frame = audio.silence_frame_mulaw()
        assert len(frame) == 160  # 20 ms at 8 kHz
        assert frame == b"\xff" * 160

    def test_silence_frame_custom_duration(self) -> None:
        frame = audio.silence_frame_mulaw(duration_ms=100)
        assert len(frame) == 800  # 100 ms at 8 kHz


class TestSampleHelpers:
    def test_pcm16_encode_decode_roundtrip(self) -> None:
        for sample in [0, 1, -1, 32767, -32768, 1000, -1000]:
            encoded = audio.encode_pcm16_sample(sample)
            assert len(encoded) == 2
            decoded = audio.decode_pcm16_sample(encoded)
            assert decoded == sample

    def test_pcm16_out_of_range_raises(self) -> None:
        with pytest.raises(ValueError):
            audio.encode_pcm16_sample(40000)
        with pytest.raises(ValueError):
            audio.encode_pcm16_sample(-40000)

    def test_decode_wrong_length_raises(self) -> None:
        with pytest.raises(ValueError):
            audio.decode_pcm16_sample(b"\x00")

    def test_rms_of_silence_is_zero(self) -> None:
        assert audio._rms(b"\x00\x00" * 160) == 0.0

    def test_rms_of_non_zero_is_positive(self) -> None:
        # 100 samples of amplitude 1000 → RMS = 1000.
        pcm = b"".join(audio.encode_pcm16_sample(1000) for _ in range(100))
        assert audio._rms(pcm) == pytest.approx(1000.0, rel=0.01)
