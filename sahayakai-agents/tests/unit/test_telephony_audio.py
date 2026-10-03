"""The telephony codec, checked against an independent oracle.

`audioop` still exists in 3.12 (it is removed in 3.13, which is exactly why the
production path does not use it). That makes it the ideal test oracle: if the
hand-written tables disagree with the stdlib's C implementation on any of the
65,536 possible samples or all 256 possible bytes, these tests say so.

The aliasing test is the one that matters most in the field. A decimator without
a low-pass passes a 6 kHz tone straight through as a phantom 2 kHz tone, and on
a phone that is heard as a metallic warble sitting behind the speaker's voice.
"""

from __future__ import annotations

import math
from array import array

import pytest

from sahayakai_agents.telephony.audio import (
    ULAW_SILENCE,
    downsample_24k_to_8k,
    pcm16_to_ulaw,
    pcm24k_to_ulaw8k,
    ulaw8k_to_pcm16k,
    ulaw_to_pcm16,
    upsample_8k_to_16k,
)

audioop = pytest.importorskip("audioop", reason="oracle only; absent from 3.13+")


class TestAgainstStdlibOracle:
    def test_decode_matches_audioop_for_every_possible_byte(self) -> None:
        payload = bytes(range(256))
        ours = ulaw_to_pcm16(payload).tobytes()
        theirs = audioop.ulaw2lin(payload, 2)
        assert ours == theirs

    def test_encode_matches_audioop_across_the_full_sample_range(self) -> None:
        # Every representable PCM16 value, not a sample of them: the encoder is
        # a table, and a single wrong entry is a permanent click at one
        # amplitude that no spot check would find.
        samples = array("h", range(-32768, 32768))
        ours = pcm16_to_ulaw(samples)
        theirs = audioop.lin2ulaw(samples.tobytes(), 2)
        assert ours == theirs

    def test_round_trip_is_stable_a_second_time(self) -> None:
        # mu-law is lossy, so PCM -> mu-law -> PCM loses precision once. It must
        # not keep losing it: a codec that drifts on each pass degrades audio
        # over a long call.
        original = array("h", [int(20000 * math.sin(i / 7)) for i in range(1000)])
        once = ulaw_to_pcm16(pcm16_to_ulaw(original))
        twice = ulaw_to_pcm16(pcm16_to_ulaw(once))
        assert once.tobytes() == twice.tobytes()


class TestUpsample:
    def test_doubles_the_sample_count(self) -> None:
        assert len(upsample_8k_to_16k(array("h", [0] * 160))) == 320

    def test_interpolates_rather_than_repeating(self) -> None:
        out = upsample_8k_to_16k(array("h", [0, 1000]))
        # Sample-and-hold would give [0, 0, 1000, 1000]; the midpoint proves
        # interpolation, which is what keeps staircase harmonics out of the band
        # the recogniser listens to.
        assert list(out) == [0, 500, 1000, 1000]

    def test_handles_an_empty_chunk(self) -> None:
        assert len(upsample_8k_to_16k(array("h", []))) == 0


class TestDownsampleAntiAliasing:
    @staticmethod
    def _tone(freq: float, rate: int, n: int, amp: int = 12000) -> array:
        return array("h", [int(amp * math.sin(2 * math.pi * freq * i / rate)) for i in range(n)])

    @staticmethod
    def _rms(samples: array) -> float:
        if not samples:
            return 0.0
        return math.sqrt(sum(float(s) * s for s in samples) / len(samples))

    def test_passes_speech_band_audio_largely_intact(self) -> None:
        # 500 Hz is squarely inside the band a voice occupies; the filter must
        # not eat it.
        out, _ = downsample_24k_to_8k(self._tone(500, 24000, 2400))
        assert self._rms(out) > 0.7 * self._rms(self._tone(500, 24000, 2400))

    def test_suppresses_a_tone_that_would_otherwise_alias(self) -> None:
        # 6 kHz at 24 kHz decimated by 3 folds to |6000 - 8000| = 2000 Hz: a
        # phantom tone right in the middle of speech. This is the metallic
        # warble the Suraksha build heard.
        out, _ = downsample_24k_to_8k(self._tone(6000, 24000, 2400))
        clean = self._rms(self._tone(500, 24000, 2400))
        assert self._rms(out) < 0.1 * clean

    def test_produces_one_sample_per_three(self) -> None:
        out, _ = downsample_24k_to_8k(array("h", [0] * 2400))
        assert 780 <= len(out) <= 800  # 2400/3, minus the filter warm-up

    def test_streaming_is_bit_identical_to_processing_it_whole(self) -> None:
        """The property that was missing, and it cost a bad call to find.

        Two things must survive a chunk boundary: the filter history, and the
        DECIMATION PHASE — which of every three samples is kept. The first
        version carried only the history and restarted the phase on every chunk,
        so any chunk whose length was not a multiple of three resumed on the
        wrong foot, dropping or repeating a sample and stepping the waveform.

        Measured at 2 ms of drift per second plus a discontinuity at every
        boundary: speech that is subtly fast and warbly. It also looked like two
        separate faults, because the recorded greeting is generated as ONE chunk
        and came out clean while the live conversation arrives as many chunks
        and came out wrong — which is heard as the voice changing mid-call.

        Chunk sizes here are deliberately NOT multiples of three.
        """
        tone = self._tone(500, 24000, 24000)
        whole, _ = downsample_24k_to_8k(tone)

        streamed = array("h")
        state = None
        for start in range(0, len(tone), 500):
            part, state = downsample_24k_to_8k(tone[start : start + 500], state)
            streamed.extend(part)

        assert len(streamed) == len(whole), (
            f"streaming produced {len(streamed)} samples against {len(whole)} — "
            "the output drifts against real time"
        )
        assert streamed.tobytes() == whole.tobytes(), "streaming differs from whole-file output"

    @pytest.mark.parametrize("chunk", [160, 250, 500, 961, 1000, 1441])
    def test_no_drift_at_any_chunk_size(self, chunk: int) -> None:
        # The Live model does not pick tidy chunk sizes, so none may drift.
        tone = self._tone(440, 24000, 24000)
        whole, _ = downsample_24k_to_8k(tone)
        streamed, state = array("h"), None
        for start in range(0, len(tone), chunk):
            part, state = downsample_24k_to_8k(tone[start : start + chunk], state)
            streamed.extend(part)
        assert len(streamed) == len(whole), f"chunk={chunk} drifted"

    def test_never_wraps_a_sample_on_overshoot(self) -> None:
        # A filter overshoot that wraps int16 turns into a full-scale click.
        out, _ = downsample_24k_to_8k(array("h", [32767] * 600))
        assert all(-32768 <= s <= 32767 for s in out)


class TestWireHelpers:
    def test_inbound_frame_reaches_the_expected_length(self) -> None:
        # A 20 ms Vobiz frame is 160 mu-law bytes; at 16 kHz PCM16 that is
        # 320 samples = 640 bytes. A mismatch here means the model is being fed
        # audio at the wrong rate, which sounds like a chipmunk or a drawl.
        assert len(ulaw8k_to_pcm16k(bytes([ULAW_SILENCE] * 160))) == 640

    def test_outbound_discards_a_dangling_byte_rather_than_raising(self) -> None:
        # A short read must cost a fraction of a sample, not a dropped frame of
        # the model's speech.
        out, _ = pcm24k_to_ulaw8k(b"\x00" * 481)
        assert isinstance(out, bytes)

    def test_outbound_threads_its_state_for_the_next_call(self) -> None:
        _, state = pcm24k_to_ulaw8k(b"\x00\x01" * 480)
        assert len(state.tail) == 30  # taps - 1
        assert state.phase in (0, 1, 2)
