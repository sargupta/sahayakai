"""Run the conformance suite against THIS integration.

The suite itself lives in `telephony/conformance.py` so a future carrier, codec
path or audio pipeline can import and run it without copying anything. This file
is just the Vobiz integration declaring that it passes.

Every check here corresponds to a defect that already existed somewhere in the
organisation and was re-made here anyway. That is the problem these exist to
solve: the fixes lived as code in one repository and as nothing anywhere else,
so the next implementation re-made them.
"""

from __future__ import annotations

from array import array

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.audio import (
    downsample_24k_to_8k,
    pcm24k_to_ulaw8k,
    ulaw_to_pcm16,
)
from sahayakai_agents.telephony.conformance import (
    CHECKS,
    ConformanceFailure,
    check_never_faster_than_real_time,
    check_no_padding_mid_stream,
    check_pitch_survives_the_pipeline,
    check_resampler_is_phase_continuous,
)
from sahayakai_agents.telephony.router import _FRAME_BYTES, _queue_ulaw


class TestThisIntegrationConforms:
    def test_resampler_is_phase_continuous(self) -> None:
        check_resampler_is_phase_continuous(downsample_24k_to_8k)

    def test_pitch_survives_the_pipeline(self) -> None:
        check_pitch_survives_the_pipeline(
            to_wire=pcm24k_to_ulaw8k,
            from_wire=ulaw_to_pcm16,
        )

    def test_nothing_is_padded_mid_stream(self) -> None:
        class _B:
            def __init__(self) -> None:
                self.pending = b""
                self.generation = 0
                import asyncio

                self.out: asyncio.Queue = asyncio.Queue()

        def queue_chunk(size: int) -> int:
            bridge = _B()
            _queue_ulaw(bridge, b"\x01" * size)  # type: ignore[arg-type]
            return len(bridge.pending)

        check_no_padding_mid_stream(queue_chunk, _FRAME_BYTES)

    def test_never_sends_faster_than_real_time(self) -> None:
        check_never_faster_than_real_time(
            telephony._FRAME_BYTES,
            telephony._FRAME_SECONDS,
            telephony._PREBUFFER_SECONDS,
        )


class TestTheSuiteItselfActuallyCatchesThings:
    """A gate nobody has seen fail is a gate nobody trusts.

    Each of these reintroduces the real bug and asserts the suite notices — so
    the checks cannot quietly rot into assertions that always pass.
    """

    def test_catches_a_phase_blind_resampler(self) -> None:
        def phase_blind(samples: array[int], state: object | None = None) -> tuple[array[int], object]:
            # The bug as originally written: history carried, phase reset.
            from sahayakai_agents.telephony.audio import DecimatorState

            st = state if isinstance(state, DecimatorState) else DecimatorState()
            st.phase = 0  # <- the mistake
            return downsample_24k_to_8k(samples, st)

        with pytest.raises(ConformanceFailure, match="(?i)phase"):
            check_resampler_is_phase_continuous(phase_blind)

    def test_catches_a_pipeline_that_shifts_pitch(self) -> None:
        def wrong_rate(pcm: bytes, state: object | None = None) -> tuple[bytes, object]:
            # Treat 24 kHz source as if it were 16 kHz: decimate by 2, not 3.
            from sahayakai_agents.telephony.audio import pcm16_to_ulaw

            samples = array("h")
            samples.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
            return pcm16_to_ulaw(array("h", samples[::2])), None

        with pytest.raises(ConformanceFailure, match="pitch"):
            check_pitch_survives_the_pipeline(wrong_rate, ulaw_to_pcm16)

    def test_catches_mid_stream_padding(self) -> None:
        def pads_everything(size: int) -> int:
            return 0  # never carries a remainder — pads instead

        with pytest.raises(ConformanceFailure, match="carried"):
            check_no_padding_mid_stream(pads_everything, _FRAME_BYTES)

    def test_catches_a_deliberate_lead(self) -> None:
        with pytest.raises(ConformanceFailure, match="burst"):
            check_never_faster_than_real_time(160, 0.02, 0.4)

    def test_catches_a_wrong_frame_size(self) -> None:
        with pytest.raises(ConformanceFailure, match="wrong speed"):
            check_never_faster_than_real_time(240, 0.02, 0.0)


def test_every_check_names_the_complaint_it_prevents() -> None:
    # The reason a red gate gets fixed rather than deleted is that it says which
    # human complaint it corresponds to.
    assert len(CHECKS) >= 5
    for symptom in CHECKS.values():
        assert len(symptom) > 20
