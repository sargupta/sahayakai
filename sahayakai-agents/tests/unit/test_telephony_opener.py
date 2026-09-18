"""The recorded opener: coverage, fallback, and the reason it exists.

Measured on the deployed bridge, first audio from the Live model lands ~3.4s
after the socket opens, and that floor is ~2.5s even with everything
overlapped — the Vertex handshake and the first token dominate and neither is
ours to speed up. Two and a half seconds of silence after a parent says "hello"
is how a call gets hung up on.

So the property under test is not "there are some audio files". It is that NO
supported language can reach a parent with silence, and that the fallback is a
voice rather than nothing.
"""

from __future__ import annotations

import math
from pathlib import Path

import pytest

from sahayakai_agents.telephony.audio import ulaw_to_pcm16
from sahayakai_agents.telephony.router import _FRAME_BYTES, _OPENERS, opener_for

#: Every language the app will place a parent call in, mirroring
#: TWILIO_LANGUAGE_MAP in the web runtime.
SUPPORTED = [
    "English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam",
    "Bengali", "Marathi", "Gujarati", "Punjabi", "Odia",
]


class TestCoverage:
    def test_every_supported_language_has_a_recording(self) -> None:
        missing = [lang for lang in SUPPORTED if lang not in _OPENERS]
        assert not missing, (
            f"no recorded opener for {missing} — a parent in that language hears "
            "~3.4s of silence when they pick up. Run scripts/generate_openers.py."
        )

    def test_the_recordings_actually_shipped(self) -> None:
        # Guards the packaging mistake, not the code: if the .ulaw assets are
        # excluded from the wheel, every call silently reverts to dead air and
        # it looks like a slow model rather than a missing file.
        assert len(_OPENERS) >= len(SUPPORTED)

    @pytest.mark.parametrize("language", SUPPORTED)
    def test_each_recording_is_long_enough_to_cover_the_warm_up(self, language: str) -> None:
        seconds = len(opener_for(language)) / 8000
        # The gap being covered is ~3.4s. Shorter than that and the parent hears
        # the greeting, then the silence anyway.
        assert seconds >= 3.4, f"{language} opener is only {seconds:.2f}s"
        # And not so long that a parent is monologued at before they can speak.
        assert seconds <= 8.0, f"{language} opener is {seconds:.2f}s, too long to sit through"


class TestFallback:
    def test_an_unknown_language_still_gets_a_voice(self) -> None:
        # Falling back to silence would be the worst outcome: a parent who hears
        # nothing hangs up, and no model reply can recover a dropped call.
        assert opener_for("Sanskrit")
        assert opener_for("") == opener_for("English")

    def test_the_fallback_is_the_english_recording(self) -> None:
        assert opener_for("Klingon") == _OPENERS["English"]


class TestAudioQuality:
    @pytest.mark.parametrize("language", SUPPORTED)
    def test_no_clipping(self, language: str) -> None:
        # mu-law has no headroom to spare; a clipped greeting sounds like a bad
        # line, which is exactly the impression this call cannot afford.
        pcm = ulaw_to_pcm16(opener_for(language))
        assert not any(abs(s) >= 32700 for s in pcm)

    @pytest.mark.parametrize("language", SUPPORTED)
    def test_starts_speaking_almost_immediately(self, language: str) -> None:
        # Leading silence in the file is leading silence in the parent's ear,
        # and the whole point is that they hear a voice at once.
        pcm = ulaw_to_pcm16(opener_for(language))
        win = 80  # 10 ms
        env = [
            math.sqrt(sum(float(x) * x for x in pcm[i : i + win]) / win)
            for i in range(0, len(pcm) - win, win)
        ]
        threshold = max(env) * 0.05
        lead_s = next((i for i, e in enumerate(env) if e > threshold), 0) * 0.01
        assert lead_s <= 0.15, f"{language} opener has {lead_s:.2f}s of dead air at the front"

    @pytest.mark.parametrize("language", SUPPORTED)
    def test_levels_are_consistent_across_languages(self, language: str) -> None:
        # One language arriving noticeably quieter reads as a worse connection
        # for those parents.
        pcm = ulaw_to_pcm16(opener_for(language))
        assert 15000 <= max(abs(s) for s in pcm) <= 26000


class TestWireFormat:
    def test_recordings_are_stored_in_the_carrier_s_own_format(self) -> None:
        # Raw mu-law 8 kHz means the most latency-critical bytes on the route
        # need no conversion at all. A WAV header here would be played as noise.
        for language in SUPPORTED:
            data = opener_for(language)
            # A RIFF/WAV header would start with these magic bytes.
            assert not data.startswith(b"RIFF")
            assert len(data) > _FRAME_BYTES

    def test_files_live_where_the_loader_looks(self) -> None:
        here = Path(__file__).resolve().parents[2] / "src" / "sahayakai_agents" / "telephony" / "openers"
        assert here.is_dir()
        assert len(list(here.glob("*.ulaw"))) >= len(SUPPORTED)
