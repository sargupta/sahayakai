"""Riya's fixed lines rendered on the deployed bridge (line_tts.py). No network.

Founder-reported (staging Plivo call, 2026-11-24 22:03 IST): 3.2 s of silence, then Riya
ran from the opener into the event line and the privacy rail cut her off. Root cause: the
Cloud Run bridge had no fixed-line cache, so the model spoke the opener itself. The class
gates below fail whenever a deployed bridge would again run Riya without that cache.
"""

from __future__ import annotations

import asyncio
import base64
import io
import math
import re
import wave
from array import array
from pathlib import Path

import pytest

from sahayakai_agents.telephony import line_tts as L
from sahayakai_agents.telephony import riya as R
from sahayakai_agents.telephony import router as RT

pytestmark = pytest.mark.unit

REPO = Path(__file__).resolve().parents[2]


def _wav(seconds_silence: float = 0.5, seconds_tone: float = 0.6, rate: int = 8000) -> bytes:
    n_sil, n_tone = int(rate * seconds_silence), int(rate * seconds_tone)
    tone = [int(8000 * math.sin(2 * math.pi * 440 * i / rate)) for i in range(n_tone)]
    pcm = array("h", [0] * n_sil + tone + [0] * n_sil)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


class _Resp:
    def __init__(self, status: int, payload: dict | None = None) -> None:
        self.status_code, self._payload = status, payload or {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self, status: int = 200, delay: float = 0.0) -> None:
        self.calls: list[dict] = []
        self.status, self.delay = status, delay

    async def post(self, url, json, headers, timeout):  # noqa: A002
        self.calls.append({"url": url, "json": json, "headers": headers})
        if self.delay:
            await asyncio.sleep(self.delay)
        return _Resp(self.status, {"audioContent": base64.b64encode(_wav()).decode()})


@pytest.fixture(autouse=True)
def _no_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    async def tok() -> str:
        return "t"

    monkeypatch.setattr(L, "_access_token", tok)
    monkeypatch.setattr(L, "_sem", None)
    monkeypatch.setattr(L, "_down_until", 0.0)
    L._inflight.clear()


# ---- rendering ------------------------------------------------------------------------


def test_wav_becomes_trimmed_ulaw_8k() -> None:
    ulaw = L.wav_to_ulaw(_wav())
    # 0.6 s of tone plus at most 60 ms lead and 120 ms tail of the 1 s of silence.
    assert 0.6 * 8000 <= len(ulaw) <= (0.6 + 0.06 + 0.12) * 8000 + 160


def test_wrong_sample_rate_is_refused() -> None:
    with pytest.raises(ValueError):
        L.wav_to_ulaw(_wav(rate=16000))


def test_synthesize_asks_for_the_call_voice_at_8k() -> None:
    client = _FakeClient()
    audio = asyncio.run(L.synthesize("Hello", client=client))
    assert audio
    body = client.calls[0]["json"]
    assert body["voice"] == {"languageCode": "en-IN", "name": L.DEFAULT_VOICE}
    assert body["audioConfig"] == {"audioEncoding": "LINEAR16", "sampleRateHertz": 8000}
    assert "x-goog-user-project" not in client.calls[0]["headers"]


def test_synthesize_failure_is_none_never_raises() -> None:
    assert asyncio.run(L.synthesize("Hello", client=_FakeClient(status=500))) is None


def test_ensure_line_writes_once_and_dedupes(tmp_path: Path) -> None:
    client = _FakeClient(delay=0.05)
    path = tmp_path / "x.ulaw"

    async def go() -> list[bool]:
        return list(await asyncio.gather(*(L.ensure_line("Hi", path, client=client) for _ in range(3))))

    assert asyncio.run(go()) == [True, True, True]
    assert len(client.calls) == 1 and path.is_file() and path.stat().st_size > 0
    assert asyncio.run(L.ensure_line("Hi", path, client=client)) is True
    assert len(client.calls) == 1  # already cached: no second request


def test_failed_render_leaves_no_file(tmp_path: Path) -> None:
    path = tmp_path / "x.ulaw"
    assert asyncio.run(L.ensure_line("Hi", path, client=_FakeClient(status=500))) is False
    assert not path.exists() and not list(tmp_path.iterdir())


def test_off_unless_switched_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOBIZ_RIYA_LINE_TTS", raising=False)
    assert not L.enabled("/tmp/x")
    monkeypatch.setenv("VOBIZ_RIYA_LINE_TTS", "1")
    assert L.enabled("/tmp/x") and not L.enabled("")


# ---- the call: the opener is cached before the Live config is built -------------------


def _call() -> R.RiyaCall:
    return R.RiyaCall(
        {
            "school_name": "Sargvision",
            "student_name": "Abhishek",
            "call_purpose": "event_invitation",
            "event_name": "Annual Day",
            "event_date": "Saturday, 28 November",
            "event_time": "10:00 AM",
        },
        product_context="sampark",
    )


def _instruction(riya: R.RiyaCall) -> str:
    cfg = RT._riya_live_config(riya, "Aoede")
    return cfg.system_instruction.parts[0].text


def _fake_synth(delay: float = 0.0):
    async def synth(text: str, voice: str | None = None, *, client=None) -> bytes:
        if delay:
            await asyncio.sleep(delay)
        return b"\x7f" * 800

    return synth


def test_class_gate_opener_is_spoken_by_the_bridge_not_the_model(tmp_path, monkeypatch) -> None:
    """With the line cache on, the model is told the opener was already spoken, so it waits
    for the parent instead of saying the opener and running on into the details."""
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    monkeypatch.setenv("VOBIZ_RIYA_LINE_TTS", "1")
    monkeypatch.setattr(L, "synthesize", _fake_synth())
    riya = _call()

    async def go() -> None:
        await RT._render_riya_opener(riya)
        await asyncio.gather(*list(L._background))

    asyncio.run(go())
    text = _instruction(riya)
    assert "has ALREADY been spoken" in text
    assert "Begin the call by saying exactly" not in text
    assert riya.opener_from_cache is True
    # Every fixed line of the call is now cached under the key the bridge looks up.
    for line in riya.fixed_lines():
        assert RT._riya_cached(line) is not None, line


def test_without_the_cache_the_model_says_the_opener(tmp_path, monkeypatch) -> None:
    """The fallback is unchanged: no cache, the model is told to say the opener."""
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    monkeypatch.delenv("VOBIZ_RIYA_LINE_TTS", raising=False)
    riya = _call()
    asyncio.run(RT._render_riya_opener(riya))
    assert "Begin the call by saying exactly" in _instruction(riya)
    assert riya.opener_from_cache is False


def test_class_gate_a_late_opener_is_never_played_as_well(tmp_path, monkeypatch) -> None:
    """An opener that lands after the model was told to say it must not ALSO be played:
    the decision is made once (a parent greeted twice)."""
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    monkeypatch.setenv("VOBIZ_RIYA_LINE_TTS", "1")
    monkeypatch.setattr(RT, "_OPENER_RENDER_WAIT_S", 0.05)
    monkeypatch.setattr(L, "synthesize", _fake_synth(delay=0.3))
    riya = _call()

    async def go() -> str:
        await RT._render_riya_opener(riya)
        text = _instruction(riya)  # decided now: not cached yet
        await asyncio.sleep(0.5)  # the opener lands late
        assert RT._riya_cached(riya.first_message()) is not None
        return text

    text = asyncio.run(go())
    assert "Begin the call by saying exactly" in text
    assert riya.opener_from_cache is False
    assert "Begin the call by saying exactly" in _instruction(riya)  # a resume keeps it


def test_class_gate_deployed_bridge_has_the_line_cache() -> None:
    """Every deploy of the Riya bridge must switch the line cache on: without it the
    deployed bridge runs Riya unlike every tested call (2026-11-24)."""
    cfg = (REPO / "deploy" / "cloudbuild-riya-bridge.yaml").read_text(encoding="utf-8")
    env = re.search(r"--set-env-vars=(\S+)", cfg)
    assert env, "bridge deploy sets no env vars"
    pairs = dict(kv.split("=", 1) for kv in env.group(1).split(","))
    assert pairs.get("VOBIZ_RIYA_LINE_TTS") == "1"
    assert pairs.get("VOBIZ_RIYA_OPENER_DIR", "").startswith("/tmp/")


# ---- review follow-ups (PR #228) -------------------------------------------------------


def _bridge(riya: R.RiyaCall, outreach_id: str = "sampark~school-x~call1"):
    from types import SimpleNamespace

    ready = asyncio.Event()
    ready.set()
    return SimpleNamespace(outreach_id=outreach_id, riya_ready=ready, riya=riya, opener_queued_at=0.0,
                           protect_until=0.0, timeline=[], call_started=0.0)


def test_class_gate_playback_never_greets_twice(tmp_path, monkeypatch) -> None:
    """Drives the real `_play_riya_opener`: the model was told to say the opener and the
    rendered file landed late; the bridge must queue NOTHING."""
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    riya = _call()
    riya.opener_from_cache = False
    path = RT._riya_line_path(riya.first_message())
    path.write_bytes(b"\x7f" * 800)  # landed late
    queued: list[bytes] = []
    monkeypatch.setattr(RT, "_queue_ulaw", lambda b, a: queued.append(a))
    monkeypatch.setattr(RT, "_flush_ulaw", lambda b: None)
    asyncio.run(RT._play_riya_opener(_bridge(riya)))
    assert queued == []


def test_playback_plays_the_cached_opener_when_decided(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    riya = _call()
    riya.opener_from_cache = True
    RT._riya_line_path(riya.first_message()).write_bytes(b"\x7f" * 800)
    queued: list[bytes] = []
    monkeypatch.setattr(RT, "_queue_ulaw", lambda b, a: queued.append(a))
    monkeypatch.setattr(RT, "_flush_ulaw", lambda b: None)
    monkeypatch.setattr(RT, "_record_turn", lambda *a, **k: None)
    monkeypatch.setattr(RT, "_tl", lambda *a, **k: None)
    b = _bridge(riya)
    b.dialogue = type("D", (), {"on_agent_turn": lambda self, *a, **k: None})()
    asyncio.run(RT._play_riya_opener(b))
    assert queued == [b"\x7f" * 800]


def test_an_early_org_opener_counts_as_spoken(tmp_path, monkeypatch) -> None:
    """The school's remembered opener plays at pick-up: the model must never be told to
    greet again, even if this call's own render fails."""
    monkeypatch.setattr(RT, "_RIYA_OPENER_DIR", str(tmp_path))
    monkeypatch.setenv("VOBIZ_RIYA_LINE_TTS", "1")

    async def fail(text, voice=None, *, client=None):
        return None

    monkeypatch.setattr(L, "synthesize", fail)
    old = "Hello, this is Riya calling from Sargvision Old Name with an important update."
    RT._riya_line_path(old).write_bytes(b"\x7f" * 800)
    RT._remember_org_opener("school-x", old)
    riya = _call()
    asyncio.run(RT._render_riya_opener(riya, "sampark~school-x~call1"))
    assert riya.opener_from_cache is True
    assert "has ALREADY been spoken" in _instruction(riya)


def test_the_opener_never_waits_behind_background_renders(tmp_path) -> None:
    client = _FakeClient(delay=0.5)

    async def go() -> float:
        bg = [(f"line {i}", tmp_path / f"{i}.ulaw") for i in range(9)]
        L.ensure_lines_later(bg)
        await asyncio.sleep(0.05)  # the background queue is full
        t0 = asyncio.get_running_loop().time()
        ok = await L.ensure_line("opener", tmp_path / "o.ulaw", client=client, priority=True)
        assert ok
        took = asyncio.get_running_loop().time() - t0
        await asyncio.gather(*list(L._background))
        return took

    import sahayakai_agents.telephony.line_tts as mod

    orig = mod.synthesize

    async def synth(text, voice=None, *, client=None):  # background uses the slow client too
        return await orig(text, voice, client=client or _FakeClient(delay=0.5))

    mod.synthesize = synth
    try:
        assert asyncio.run(go()) < 0.9  # not 3 x 0.5 s behind the queue
    finally:
        mod.synthesize = orig


def test_a_failure_pauses_tts_for_following_calls(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(L, "_down_until", 0.0)
    bad = _FakeClient(status=500)
    assert asyncio.run(L.ensure_line("a", tmp_path / "a.ulaw", client=bad)) is False
    good = _FakeClient()
    assert asyncio.run(L.ensure_line("b", tmp_path / "b.ulaw", client=good)) is False
    assert good.calls == []  # not even tried during the pause
    monkeypatch.setattr(L, "_down_until", 0.0)
    assert asyncio.run(L.ensure_line("b", tmp_path / "b.ulaw", client=good)) is True


def test_the_cache_is_bounded(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(L, "_MAX_FILES", 5)
    for i in range(8):
        (tmp_path / f"{i}.ulaw").write_bytes(b"x")
    L._prune(tmp_path)
    assert len(list(tmp_path.glob("*.ulaw"))) == 5
