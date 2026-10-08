"""Turns are utterances, not transcription fragments; every exit cleans up.

Two defects found in the 2026-10-08 parent-call audit:

1. Gemini Live delivers `input_transcription` in fragments ("theek hai",
   "thank", "you so much"). The bridge appended EACH fragment as a parent turn,
   so one long sentence could trip the 6-turn ceiling and end the call while
   the parent was still talking, a single "haan" could satisfy the 2-turn
   minimum, and the question veto saw only the last fragment of a question.

2. When the Live connection or setup failed, `bridge.stop` was never set and
   the pacer task looped at 50 Hz for the life of the process; the call record
   gave no sign that the parent heard only the opener.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony


class _FakeWs:
    def __init__(self) -> None:
        self.query_params = {"cuid": "call-uuid-1", "lang": "English"}
        self.sent: list[str] = []
        self.closed_with: int | None = None

    async def accept(self) -> None:
        return None

    async def send_text(self, text: str) -> None:
        self.sent.append(text)

    async def receive_text(self) -> str:
        await asyncio.sleep(3600)
        return ""

    async def close(self, code: int = 1000) -> None:
        self.closed_with = code


class _FakeSession:
    def __init__(self) -> None:
        self.cues: list[Any] = []

    async def send_client_content(self, **kw: Any) -> None:
        self.cues.append(kw)


def _parent(text: str) -> Any:
    return SimpleNamespace(input_transcription=SimpleNamespace(text=text))


@pytest.fixture(autouse=True)
def _no_firestore(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _noop(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(telephony, "_persist_transcript", _noop)


def _bridge() -> Any:
    return telephony._Bridge(_FakeWs(), "outreach-1", call_uuid="call-uuid-1")  # type: ignore[arg-type]


def _agent_speaks(bridge: Any) -> None:
    """What the Live->carrier pump records when VIDYA produces speech."""
    bridge.agent_spoke_since_parent = True


class TestTurnsAreUtterances:
    async def test_one_sentence_in_fragments_is_one_turn(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        for fragment in ("haan ji", "main", "Ravi ki", "mummy bol rahi hoon"):
            await telephony._handle_parent_speech(bridge, session, _parent(fragment))
        assert bridge.parent_said == ["haan ji main Ravi ki mummy bol rahi hoon"]

    async def test_a_new_turn_starts_only_after_vidya_speaks(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        await telephony._handle_parent_speech(bridge, session, _parent("haan"))
        await telephony._handle_parent_speech(bridge, session, _parent("boliye"))
        _agent_speaks(bridge)
        await telephony._handle_parent_speech(bridge, session, _parent("achha"))
        assert bridge.parent_said == ["haan boliye", "achha"]

    async def test_a_long_sentence_never_trips_the_turn_ceiling(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        for i in range(telephony._MAX_PARENT_TURNS * 3):
            await telephony._handle_parent_speech(bridge, session, _parent(f"word{i}"))
        assert len(bridge.parent_said) == 1
        assert not telephony._must_end_now(bridge)

    async def test_the_ceiling_still_counts_real_turns(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        for i in range(telephony._MAX_PARENT_TURNS):
            await telephony._handle_parent_speech(bridge, session, _parent(f"reply {i}"))
            _agent_speaks(bridge)
        assert telephony._must_end_now(bridge)

    async def test_one_word_does_not_satisfy_the_two_turn_minimum(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        await telephony._handle_parent_speech(bridge, session, _parent("haan"))
        await telephony._handle_parent_speech(bridge, session, _parent("theek hai"))
        assert not telephony._may_end_yet(bridge)

    async def test_the_question_veto_sees_the_whole_question(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        await telephony._handle_parent_speech(bridge, session, _parent("haan boliye"))
        _agent_speaks(bridge)
        await telephony._handle_parent_speech(bridge, session, _parent("ghar par"))
        await telephony._handle_parent_speech(bridge, session, _parent("kya karna chahiye?"))
        assert bridge.parent_said[-1] == "ghar par kya karna chahiye?"
        assert not telephony._may_end_yet(bridge)

    async def test_a_goodbye_split_across_fragments_closes_the_call(self) -> None:
        bridge = _bridge()
        session = _FakeSession()
        await telephony._handle_parent_speech(bridge, session, _parent("haan boliye"))
        _agent_speaks(bridge)
        await telephony._handle_parent_speech(bridge, session, _parent("achha theek hai"))
        _agent_speaks(bridge)
        for fragment in ("thank", "you so much", "namaskar"):
            await telephony._handle_parent_speech(bridge, session, _parent(fragment))
        assert bridge.closing
        for task in list(bridge.background):
            task.cancel()


class TestEveryExitCleansUp:
    async def test_live_connect_failure_stops_the_pacer_and_records_the_failure(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        pacer_started = asyncio.Event()
        pacer_cancelled = asyncio.Event()
        engine_failures: list[str] = []
        hangups: list[str] = []

        async def _admit(_ws: Any) -> str:
            return "outreach-1"

        async def _pacer(bridge: Any) -> None:
            pacer_started.set()
            try:
                while not bridge.stop:
                    await asyncio.sleep(0.02)
            except asyncio.CancelledError:
                pacer_cancelled.set()
                raise

        async def _greet(_bridge: Any, _language: str) -> None:
            await asyncio.sleep(3600)

        async def _prepare(*_a: Any, **_k: Any) -> Any:
            await pacer_started.wait()
            raise RuntimeError("model not found")

        async def _hangup(cuid: str) -> None:
            hangups.append(cuid)

        async def _engine_failure(_bridge: Any, error_type: str) -> None:
            engine_failures.append(error_type)

        monkeypatch.setattr(telephony, "_admit", _admit)
        monkeypatch.setattr(telephony, "_pace_outbound", _pacer)
        monkeypatch.setattr(telephony, "_greet_and_drain", _greet)
        monkeypatch.setattr(telephony, "_prepare_live_session", _prepare)
        monkeypatch.setattr(telephony, "_hangup", _hangup)
        monkeypatch.setattr(telephony, "_persist_engine_failure", _engine_failure)

        ws = _FakeWs()
        await asyncio.wait_for(telephony.vobiz_stream(ws), timeout=5)  # type: ignore[arg-type]

        # The pacer was stopped (either by `stop` or by cancellation) — not left
        # ticking — and the call was hung up and marked as an engine failure.
        await asyncio.sleep(0.05)
        assert pacer_started.is_set()
        assert all(
            t.get_coro().__name__ != "_pacer"
            for t in asyncio.all_tasks()  # type: ignore[union-attr]
        )
        assert hangups == ["call-uuid-1"]
        assert engine_failures == ["RuntimeError"]
