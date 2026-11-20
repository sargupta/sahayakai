"""Barge-in on handset-like audio, through the bridge's real inbound path.

The 2026-10-11 handset call logged ZERO barge-in pauses while every synthetic
staging run passed. The synthetic runs had two things a phone line does not:
loud, steady test tones, and carrier chunks of exactly 160 bytes. Two
mechanisms followed, both gated here:

1. Chunk size. The detector stepped through each payload in whole 160-byte
   frames and looked at nothing in a shorter payload. Every scenario below runs
   at several chunk sizes, including irregular ones.
2. Signal. Handset speech is quieter and dips between syllables; a fixed
   400 threshold and six CONSECUTIVE loud frames rejected it. The signals here
   are voice-like (pitch harmonics under a syllabic envelope that drops to
   near silence between syllables) at measured dBov levels, over line noise,
   with VIDYA's echo on the line while she talks.

Pass criteria are the product requirements, not the implementation's numbers:
quiet and normal speech pause VIDYA within ~200 ms and cancel when sustained;
line noise, clicks and her own echo never pause her; "haan" resumes her;
"wait... wait, one minute" cancels.
"""

from __future__ import annotations

import math
import random
from array import array
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.audio import pcm16_to_ulaw
from sahayakai_agents.telephony.barge_in import Action

RATE = 8000
FULL_SCALE = 32768.0


def dbov(level: float) -> float:
    return FULL_SCALE * 10 ** (level / 20)


def voice(seconds: float, level_dbov: float, seed: int, *, pitch: float = 160.0) -> list[float]:
    """Voice-like: harmonics of a wandering pitch under a syllabic envelope."""
    rng = random.Random(seed)
    n = int(seconds * RATE)
    syll_hz = 4.0 + rng.random()  # ~4-5 syllables a second
    out, phase = [], 0.0
    for i in range(n):
        t = i / RATE
        f0 = pitch * (1 + 0.08 * math.sin(2 * math.pi * 0.7 * t))
        phase += 2 * math.pi * f0 / RATE
        tone = sum(math.sin(k * phase) / k for k in range(1, 8))
        # Syllables: raised cosine, dropping to ~5% between syllables.
        env = 0.05 + 0.95 * max(0.0, math.sin(math.pi * ((t * syll_hz) % 1.0))) ** 1.5
        out.append(tone * env + rng.gauss(0, 0.05))
    rms = math.sqrt(sum(v * v for v in out) / max(1, len(out))) or 1.0
    g = dbov(level_dbov) / rms
    return [v * g for v in out]


def noise(seconds: float, level_dbov: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    sd = dbov(level_dbov)
    return [rng.gauss(0, sd) for _ in range(int(seconds * RATE))]


def silence(seconds: float) -> list[float]:
    return [0.0] * int(seconds * RATE)


def mix(*tracks: list[float]) -> list[float]:
    n = max(len(t) for t in tracks)
    return [sum(t[i] if i < len(t) else 0.0 for t in tracks) for i in range(n)]


def ulaw(samples: list[float]) -> bytes:
    return pcm16_to_ulaw(array("h", (int(max(-32767, min(32767, v))) for v in samples)))


def chunks(data: bytes, size: int | str) -> list[bytes]:
    if size == "irregular":
        rng, out, i = random.Random(7), [], 0
        while i < len(data):
            step = rng.choice([40, 80, 120, 160, 200, 320, 480])
            out.append(data[i : i + step])
            i += step
        return out
    assert isinstance(size, int)
    return [data[i : i + size] for i in range(0, len(data), size)]


class _Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def monotonic(self) -> float:
        return self.now


def run(monkeypatch: pytest.MonkeyPatch, parent: list[float], *, chunk: int | str,
        vidya_talking: bool = True, echo_dbov: float | None = -45.0,
        line_dbov: float = -60.0, lead_s: float = 1.0) -> tuple[Any, list[tuple[float, str]]]:
    """Feed [lead of VIDYA-only line] + [parent speech] through _note_parent_audio.

    Returns the bridge and the list of (seconds since parent onset, action).
    """
    clock = _Clock()
    monkeypatch.setattr(telephony, "time", SimpleNamespace(monotonic=clock.monotonic))
    audible = {"on": vidya_talking}
    monkeypatch.setattr(telephony, "_ai_audible", lambda _b, _n: audible["on"])
    actions: list[tuple[float, str]] = []
    onset_at = clock.now + lead_s

    def record(bridge: Any, action: Action, *, by_model: bool) -> None:  # noqa: ARG001
        if action is not Action.NONE:
            actions.append((round(clock.now - onset_at, 3), action.value))
            if action is Action.PAUSE:
                audible["on"] = False  # the pacer stops sending her frames
            if action in (Action.RESUME,):
                audible["on"] = vidya_talking

    monkeypatch.setattr(telephony, "_apply_barge_action", record)
    bridge = telephony._Bridge(SimpleNamespace(), "o-handset", call_uuid="")  # type: ignore[arg-type]
    bridge.local_barge_in = True

    total = lead_s + len(parent) / RATE + 1.0
    line = noise(total, line_dbov, seed=11)
    echo = voice(total, echo_dbov, seed=99, pitch=210) if (vidya_talking and echo_dbov is not None) else []
    lead = silence(lead_s)
    signal = mix(line, echo, lead + parent)
    for part in chunks(ulaw(signal), chunk):
        clock.now += len(part) / RATE
        telephony._note_parent_audio(bridge, part)
    return bridge, actions


CHUNKS = [80, 160, 240, 320, "irregular"]


@pytest.mark.parametrize("chunk", CHUNKS)
class TestHandsetBargeIn:
    def test_normal_handset_speech_pauses_fast_and_cancels(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        bridge, acts = run(monkeypatch, voice(1.2, -24, seed=1), chunk=chunk)
        pauses = [t for t, a in acts if a == "pause"]
        assert pauses, f"normal speech never paused VIDYA (chunk={chunk}); {bridge.barge.diagnostics()}"
        assert pauses[0] <= 0.2, f"first pause {pauses[0]*1000:.0f} ms after onset"
        assert any(a == "cancel" for _, a in acts)

    def test_quiet_handset_speech_still_pauses(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        bridge, acts = run(monkeypatch, voice(1.2, -38, seed=2), chunk=chunk, line_dbov=-58)
        pauses = [t for t, a in acts if a == "pause"]
        assert pauses, f"quiet speech never paused VIDYA; {bridge.barge.diagnostics()}"
        assert pauses[0] <= 0.25

    def test_line_noise_and_echo_alone_never_pause(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        _, acts = run(monkeypatch, silence(3.0), chunk=chunk, echo_dbov=-40, line_dbov=-50)
        assert not acts, acts

    def test_clicks_do_not_pause(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        click = [dbov(-12)] * 40 + [-dbov(-12)] * 40  # 10 ms crack
        parent = silence(0.3) + click + silence(0.5) + click + silence(0.5)
        _, acts = run(monkeypatch, parent, chunk=chunk)
        assert not any(a == "pause" for _, a in acts), acts

    def test_haan_pauses_then_resumes_without_cancelling(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        _, acts = run(monkeypatch, voice(0.25, -24, seed=3) + silence(1.0), chunk=chunk)
        kinds = [a for _, a in acts]
        assert "cancel" not in kinds, acts
        if "pause" in kinds:
            assert kinds[-1] == "resume", acts

    def test_wait_wait_one_minute_cancels(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        parent = voice(0.35, -26, seed=4) + silence(0.4) + voice(0.9, -26, seed=5)
        _, acts = run(monkeypatch, parent, chunk=chunk)
        assert any(a == "cancel" for _, a in acts), acts

    def test_repeated_speech_after_a_short_pause_cancels(self, monkeypatch: pytest.MonkeyPatch, chunk: Any) -> None:
        parent = voice(0.3, -30, seed=6) + silence(0.6) + voice(0.3, -30, seed=7) + silence(0.3) + voice(0.5, -30, seed=8)
        _, acts = run(monkeypatch, parent, chunk=chunk)
        assert any(a == "cancel" for _, a in acts), acts


def test_inbound_stats_record_chunk_sizes_and_levels(monkeypatch: pytest.MonkeyPatch) -> None:
    bridge, _ = run(monkeypatch, voice(0.5, -24, seed=9), chunk=80)
    summary = bridge.inbound.summary()
    assert summary["inbound_chunk_sizes"].get("80", 0) > 10
    assert summary["level_audible_p90"] is not None
    # Never audio, never words: only numbers.
    assert all(isinstance(v, (int, float, dict, type(None))) for v in summary.values())


def test_frames_split_across_chunks_are_not_lost(monkeypatch: pytest.MonkeyPatch) -> None:
    bridge, _ = run(monkeypatch, voice(0.4, -24, seed=10), chunk=70)
    # 70-byte chunks: every byte must reach the detector as whole frames.
    total = sum(int(k) * v for k, v in bridge.inbound.chunk_sizes.items())
    frames_seen = len(bridge.inbound.levels_audible) + len(bridge.inbound.levels_quiet)
    assert frames_seen == total // 160
