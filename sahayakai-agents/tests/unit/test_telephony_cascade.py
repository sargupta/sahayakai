"""The Neha cascade engine (staging prototype), with fake STT, LLM and TTS.

What is gated is the engine's contract with the bridge, which is what makes it
safe to put behind the unchanged call path:
- it speaks the Live message shapes the bridge consumes;
- a sentence is transcribed when its audio starts, and audio is whole samples;
- "haan" while VIDYA talks is recorded but does not cancel her;
- a real interruption, or the bridge's cancel_response(), abandons the reply:
  `interrupted` is emitted, no audio of the abandoned reply follows, and the
  model's memory holds only what was actually spoken;
- tools round-trip through the bridge (which owns them), survive an
  interruption mid-lookup, and cannot hang a turn;
- Hindi is synthesised only when enabled AND the text is Devanagari.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import cascade as cas
from sahayakai_agents.telephony.cascade import (
    CascadeConfig,
    CascadeSession,
    is_backchannel,
    speech_language,
    split_sentences,
)


class FakeStt:
    def __init__(self) -> None:
        self.cb: Any = None
        self.sent = 0
        self.closed = False

    async def start(self, on_event: Any) -> None:
        self.cb = on_event

    async def send(self, pcm16k: bytes) -> None:
        self.sent += len(pcm16k)

    async def close(self) -> None:
        self.closed = True

    async def final(self, text: str) -> None:
        await self.cb({"event": "transcript.final", "text": text})


class FakeTts:
    def __init__(self, *, chunk_delay: float = 0.0, chunks: int = 3) -> None:
        self.spoken: list[tuple[str, str]] = []
        self.chunk_delay, self.chunks = chunk_delay, chunks
        self.closed = False

    async def stream(self, text: str, language: str) -> Any:
        self.spoken.append((text, language))
        for _ in range(self.chunks):
            if self.chunk_delay:
                await asyncio.sleep(self.chunk_delay)
            yield b"\x01" * 481  # odd: a sample split across chunks

    async def close(self) -> None:
        self.closed = True


def call(name: str, **args: Any) -> SimpleNamespace:
    return SimpleNamespace(name=name, args=args, id=None)


class FakeLlm:
    """Each stream() call plays the next scripted reply: a list of (text|call)."""

    def __init__(self, replies: list[list[Any]], *, delay: float = 0.0) -> None:
        self.replies, self.delay = list(replies), delay
        self.histories: list[list[Any]] = []

    async def stream(self, history: list[Any]) -> Any:
        self.histories.append(list(history))
        reply = self.replies.pop(0) if self.replies else ["Okay."]
        for part in reply:
            if self.delay:
                await asyncio.sleep(self.delay)
            if isinstance(part, str):
                yield SimpleNamespace(text=part, function_calls=[])
            else:
                yield SimpleNamespace(text=None, function_calls=[part])


def session(llm: FakeLlm, tts: FakeTts | None = None, cfg: CascadeConfig | None = None) -> tuple[CascadeSession, FakeStt, FakeTts]:
    stt, tts = FakeStt(), tts or FakeTts()
    return CascadeSession(cfg or CascadeConfig(), stt, tts, llm), stt, tts


async def turn(s: CascadeSession, timeout: float = 3.0) -> list[Any]:
    out: list[Any] = []

    async def collect() -> None:
        async for m in s.receive():
            out.append(m)

    await asyncio.wait_for(collect(), timeout=timeout)
    return out


def kinds(msgs: list[Any]) -> list[str]:
    out = []
    for m in msgs:
        sc = m.server_content
        if m.data:
            out.append("audio")
        elif m.tool_call:
            out.append("tool_call")
        elif sc is not None and sc.output_transcription:
            out.append(f"said:{sc.output_transcription.text.strip()}")
        elif sc is not None and sc.input_transcription:
            out.append(f"heard:{sc.input_transcription.text}")
        elif sc is not None and sc.interrupted:
            out.append("interrupted")
        elif sc is not None and sc.turn_complete:
            out.append("turn_complete")
    return out


def cue(text: str) -> Any:
    from google.genai import types as t

    return t.Content(role="user", parts=[t.Part(text=text)])


class TestPieces:
    def test_sentences_stream_out_whole(self) -> None:
        done, rest = split_sentences("Hello there, Ravi's mother. How are you")
        assert done == ["Hello there, Ravi's mother."] and rest == "How are you"

    def test_a_tiny_fragment_waits_for_more(self) -> None:
        done, rest = split_sentences("Okay. Ravi missed two homeworks. And")
        assert done == ["Okay. Ravi missed two homeworks."] and rest == "And"

    def test_backchannels(self) -> None:
        for t in ("haan", "Haan ji.", "hmm", "achha", "okay", "हाँ", "ठीक है"):
            assert is_backchannel(t), t
        for t in ("haan, what about his marks?", "wait", "no", "how is his attendance"):
            assert not is_backchannel(t), t

    def test_hindi_only_when_enabled_and_devanagari(self) -> None:
        on, off = CascadeConfig(hindi=True), CascadeConfig()
        assert speech_language("रवि छह दिन आया।", on) == "hi-IN"
        assert speech_language("रवि छह दिन आया।", off) == "en-IN"
        assert speech_language("Ravi came six days.", on) == "en-IN"

    def test_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("VOBIZ_CASCADE_HINDI", "true")
        cfg = CascadeConfig.from_env()
        assert cfg.hindi and cfg.stt_language == "unknown"
        assert cfg.tts_speaker == "neha_en_customer" and cfg.tts_model == "bulbul:v4-flash"
        monkeypatch.delenv("VOBIZ_CASCADE_HINDI")
        assert CascadeConfig.from_env().stt_language == "en-IN"


@pytest.mark.asyncio
class TestTurns:
    async def test_a_cue_gets_a_spoken_reply_transcribed_as_it_plays(self) -> None:
        s, _, tts = session(FakeLlm([["I'm calling from Sahayak Test School. ", "Am I speaking with Ravi's parent?"]]))
        await s.start()
        await s.send_client_content(turns=cue("(kickoff)"))
        msgs = await turn(s)
        k = kinds(msgs)
        assert k[0] == "said:I'm calling from Sahayak Test School."
        assert k[1] == "audio"
        assert "said:Am I speaking with Ravi's parent?" in k
        assert k[-1] == "turn_complete"
        assert [t for t, _ in tts.spoken] == ["I'm calling from Sahayak Test School.", "Am I speaking with Ravi's parent?"]
        # Whole 16-bit samples only, even though TTS chunks were odd-sized.
        assert all(len(m.data) % 2 == 0 for m in msgs if m.data)
        assert s.first_audio_ms

    async def test_parent_speech_is_reported_then_answered(self) -> None:
        s, stt, _ = session(FakeLlm([["Yes, he did well."]]))
        await s.start()
        await stt.final("How was his test?")
        k = kinds(await turn(s))
        assert k[0] == "heard:How was his test?"
        assert "said:Yes, he did well." in k and k[-1] == "turn_complete"

    async def test_haan_while_speaking_does_not_cancel(self) -> None:
        s, stt, _ = session(FakeLlm([["Ravi missed two homework submissions this week."]]),
                            FakeTts(chunk_delay=0.05, chunks=6))
        await s.start()
        await s.send_client_content(turns=cue("(deliver)"))
        await asyncio.sleep(0.08)
        await stt.final("haan")
        k = kinds(await turn(s))
        assert "interrupted" not in k and k[-1] == "turn_complete"
        assert s.backchannels_ignored == 1

    async def test_a_real_interruption_abandons_the_reply(self) -> None:
        llm = FakeLlm([["Ravi missed two homework submissions this week. ", "His science marks dropped too."],
                       ["Sure, one minute."]])
        s, stt, tts = session(llm, FakeTts(chunk_delay=0.05, chunks=6))
        await s.start()
        await s.send_client_content(turns=cue("(deliver)"))
        await asyncio.sleep(0.12)
        await stt.final("Wait, wait, one minute.")
        first = kinds(await turn(s))
        assert first[-1] == "interrupted"
        assert "said:His science marks dropped too." not in first, "the abandoned sentence was spoken"
        second = kinds(await turn(s))
        assert "said:Sure, one minute." in second
        # The model remembers only what was said before the cut.
        history_text = " ".join(
            p.text for c in llm.histories[-1] for p in (c.parts or []) if getattr(p, "text", None)
        )
        assert "[the parent interrupted here]" in history_text
        assert "His science marks dropped too" not in history_text

    async def test_cancel_response_stops_audio_at_once(self) -> None:
        s, _, _ = session(FakeLlm([["One long sentence that keeps going and going for a while."]]),
                          FakeTts(chunk_delay=0.05, chunks=20))
        await s.start()
        await s.send_client_content(turns=cue("(deliver)"))
        collected: list[Any] = []

        async def collect() -> None:
            async for m in s.receive():
                collected.append(m)

        task = asyncio.create_task(collect())
        await asyncio.sleep(0.15)
        s.cancel_response()
        await asyncio.wait_for(task, timeout=2)
        k = kinds(collected)
        assert k[-1] == "interrupted"
        audio_after = k[k.index("interrupted"):].count("audio")
        assert audio_after == 0
        await asyncio.sleep(0.2)
        assert s._out.empty(), "stale audio arrived after the cancel"

    async def test_a_failing_model_ends_the_turn_not_the_call(self) -> None:
        class Boom(FakeLlm):
            async def stream(self, history: list[Any]) -> Any:
                raise RuntimeError("vertex 503")
                yield  # pragma: no cover

        s, _, _ = session(Boom([]))
        await s.start()
        await s.send_client_content(turns=cue("(kickoff)"))
        assert kinds(await turn(s)) == ["turn_complete"]

    async def test_close_ends_receive_without_yielding(self) -> None:
        s, stt, tts = session(FakeLlm([]))
        await s.start()
        await s.close()
        assert await turn(s) == []
        assert stt.closed and tts.closed


@pytest.mark.asyncio
class TestTools:
    async def test_a_lookup_round_trips_through_the_bridge(self) -> None:
        llm = FakeLlm([["Ek minute, let me check. ", call("get_attendance_summary")],
                       ["He was absent two days."]])
        s, _, _ = session(llm)
        await s.start()
        await s.send_client_content(turns=cue("How is his attendance?"))
        msgs: list[Any] = []

        async def collect() -> None:
            async for m in s.receive():
                msgs.append(m)
                if m.tool_call:
                    fc = m.tool_call.function_calls[0]
                    assert fc.name == "get_attendance_summary"
                    from google.genai import types as t

                    await s.send_tool_response(function_responses=[
                        t.FunctionResponse(id=fc.id, name=fc.name, response={"absent": 2})])

        await asyncio.wait_for(collect(), timeout=3)
        k = kinds(msgs)
        assert k.index("tool_call") < k.index("said:He was absent two days.")
        last = llm.histories[-1][-1]
        assert last.parts[0].function_response.response == {"absent": 2}

    async def test_interruption_during_a_lookup_does_not_hang(self) -> None:
        s, stt, _ = session(FakeLlm([[call("get_recent_assessments")], ["Okay."]]))
        await s.start()
        await s.send_client_content(turns=cue("marks?"))
        await asyncio.sleep(0.05)
        await stt.final("Actually, never mind, tell me about attendance.")
        msgs: list[Any] = []

        async def collect() -> None:
            async for m in s.receive():
                msgs.append(m)

        await asyncio.wait_for(collect(), timeout=2)
        assert "interrupted" in kinds(msgs) or "turn_complete" in kinds(msgs)
        assert not s._tool_waiters, "a cancelled lookup left a waiter behind"

    async def test_an_unanswered_tool_cannot_hang_the_turn(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(cas, "TOOL_TIMEOUT_SECONDS", 0.1)
        s, _, _ = session(FakeLlm([[call("get_homework_status")], ["I don't have that."]]))
        await s.start()
        await s.send_client_content(turns=cue("homework?"))
        msgs: list[Any] = []

        async def collect() -> None:
            async for m in s.receive():
                msgs.append(m)

        await asyncio.wait_for(collect(), timeout=2)
        assert kinds(msgs)[-1] == "turn_complete"


@pytest.mark.asyncio
class TestThroughTheBridge:
    async def test_the_bridge_pump_plays_and_transcribes_a_cascade_turn(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from sahayakai_agents.telephony import router as telephony

        async def _noop(*_a: Any, **_k: Any) -> None:
            return None

        monkeypatch.setattr(telephony, "_persist_transcript", _noop)
        s, _, _ = session(FakeLlm([["Namaste ji, this is Sahayak Test School. "]]))
        await s.start()

        class _Ws:
            async def send_text(self, _t: str) -> None:
                return None

        b = telephony._Bridge(_Ws(), "o-cascade", call_uuid="")  # type: ignore[arg-type]
        b.stream_id = "s"
        b.engine = s
        await s.send_client_content(turns=cue("(kickoff)"))
        pump = asyncio.create_task(telephony._pump_live_to_carrier(b, s))
        for _ in range(100):
            await asyncio.sleep(0.01)
            if b.transcript:
                break
        b.stop = True
        await s.close()
        await asyncio.wait_for(pump, timeout=2)
        assert b.out.qsize() > 0, "no audio reached the pacer"
        assert b.transcript and b.transcript[0]["text"].startswith("Namaste ji")

    async def test_the_bridges_barge_in_cancels_the_cascade(self) -> None:
        from sahayakai_agents.telephony import router as telephony

        cancelled = []

        class _Engine:
            def cancel_response(self) -> None:
                cancelled.append(True)

        b = telephony._Bridge(SimpleNamespace(), "o", call_uuid="")  # type: ignore[arg-type]
        b.engine = _Engine()
        telephony._cancel_response(b, by_model=False)
        assert cancelled == [True]
        telephony._cancel_response(b, by_model=True)  # the engine's own signal: no echo back
        assert cancelled == [True]


def test_the_prompt_offers_hindi_only_when_the_engine_supports_it() -> None:
    from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

    ctx = CallContext(student_name="Ravi", language="English", message="Hello.")
    assert "SWITCHING TO HINDI" not in build_parent_call_instruction(ctx)
    on = build_parent_call_instruction(ctx, switch_to_hindi=True)
    assert "SWITCHING TO HINDI" in on and "Devanagari" in on
    # Delivery-only calls and Hindi calls do not get it.
    assert "SWITCHING TO HINDI" not in build_parent_call_instruction(ctx, switch_to_hindi=True, two_way=False)
    hi = CallContext(student_name="Ravi", language="Hindi", message="नमस्ते")
    assert "SWITCHING TO HINDI" not in build_parent_call_instruction(hi, switch_to_hindi=True)


def test_engine_choice(monkeypatch: pytest.MonkeyPatch) -> None:
    from sahayakai_agents.telephony import router as telephony

    monkeypatch.delenv("VOBIZ_ENGINE", raising=False)
    assert not cas.cascade_enabled()
    monkeypatch.setenv("VOBIZ_ENGINE", "cascade")
    assert cas.cascade_enabled()
    # The Neha opener is used with the cascade, the Live one otherwise.
    assert telephony.opener_for("English") == telephony._NEHA_OPENERS["English"]
    monkeypatch.setenv("VOBIZ_ENGINE", "live")
    assert telephony.opener_for("English") == telephony._OPENERS["English"]
