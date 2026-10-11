"""The Neha cascade engine (staging prototype), with fake STT, LLM and TTS.

What is gated is the engine's contract with the bridge, which is what makes it
safe to put behind the unchanged call path:
- it speaks the Live message shapes the bridge consumes;
- a sentence is transcribed when its audio starts; audio arrives as carrier
  mu-law in slices of at most 40 ms, so the pacer is never starved;
- a final transcript is REPORTED, never answered by the engine: the bridge's
  state machine decides (2026-10-11 handset call: each "Wait" got a fresh
  "Yes, please tell me.");
- the bridge's cancel_response() abandons the reply: `interrupted` is emitted,
  no audio of the abandoned reply follows, and the model's memory holds only
  what was actually spoken;
- say() speaks fixed lines verbatim without the model; the privacy guard
  blocks a sentence before synthesis; unlock() swaps the model's instruction;
- tools round-trip through the bridge (which owns them), survive an
  interruption mid-lookup, and cannot hang a turn;
- goodbyes are the bridge's: the engine never adds one on an end_call;
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
    speech_language,
    split_first_clause,
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
        self.notes: list[str] = []

    async def stream(self, history: list[Any], note: str = "") -> Any:
        self.histories.append(list(history))
        self.notes.append(note)
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
        if m.data or m.ulaw:
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

    def test_a_title_is_not_a_sentence_end(self) -> None:
        # The kickoff line was synthesised as "...on behalf of Ms." + "Rao. Before...".
        done, rest = split_sentences("I'm calling on behalf of Ms. Rao. Before I share it, please")
        assert done == ["I'm calling on behalf of Ms. Rao."] and rest == "Before I share it, please"
        done, _ = split_sentences("Dr. Mehta and Mrs. Iyer agreed. Thank you all. ")
        assert done == ["Dr. Mehta and Mrs. Iyer agreed.", "Thank you all."]

    def test_a_tiny_fragment_waits_for_more(self) -> None:
        done, rest = split_sentences("Okay. Ravi missed two homeworks. And")
        assert done == ["Okay. Ravi missed two homeworks."] and rest == "And"

    def test_a_long_first_clause_is_released_at_a_comma(self) -> None:
        done, rest = split_first_clause("Thank you for confirming, I have a message from the teacher")
        assert done == ["Thank you for confirming,"] and rest == "I have a message from the teacher"
        assert split_first_clause("Okay, sure") == ([], "Okay, sure")

    def test_hindi_only_when_enabled_and_devanagari(self) -> None:
        on, off = CascadeConfig(hindi=True), CascadeConfig()
        assert speech_language("रवि छह दिन आया।", on) == "hi-IN"
        assert speech_language("रवि छह दिन आया।", off) == "en-IN"
        assert speech_language("Ravi came six days.", on) == "en-IN"

    def test_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("VOBIZ_CASCADE_HINDI", "true")
        cfg = CascadeConfig.from_env()
        assert cfg.hindi and cfg.stt_language == "auto"  # the API value for detection
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
        # Carrier mu-law, sliced to <= 40 ms (320 bytes at 8 kHz) so the pacer
        # gets the event loop back between slices.
        ulaw = [m.ulaw for m in msgs if m.ulaw]
        assert ulaw and all(len(u) <= 320 for u in ulaw)
        assert not any(m.data for m in msgs)
        assert s.first_audio_ms

    async def test_parent_speech_is_reported_but_never_answered_by_the_engine(self) -> None:
        llm = FakeLlm([["Yes, he did well."]])
        s, stt, _ = session(llm)
        await s.start()
        await stt.final("How was his test?")
        await asyncio.sleep(0.05)
        assert llm.histories == [], "the engine replied on its own; the bridge decides"
        await s.respond("How was his test?")
        k = kinds(await turn(s))
        assert k[0] == "heard:How was his test?"
        assert "said:Yes, he did well." in k and k[-1] == "turn_complete"

    async def test_wait_while_speaking_is_reported_and_starts_no_reply(self) -> None:
        # The 2026-10-11 loop: "Wait" -> "Yes, please tell me." -> "Wait" -> ...
        llm = FakeLlm([["Ravi missed two homework submissions this week."], ["Yes, please tell me."]])
        s, stt, _ = session(llm, FakeTts(chunk_delay=0.05, chunks=6))
        await s.start()
        await s.send_client_content(turns=cue("(deliver)"))
        await asyncio.sleep(0.08)
        await stt.final("Wait")
        k = kinds(await turn(s))
        assert "heard:Wait" in k and "interrupted" not in k  # the bridge, not the engine, cuts
        await asyncio.sleep(0.1)
        assert len(llm.histories) == 1, "a reply was generated for 'Wait'"

    async def test_the_bridges_cancel_abandons_the_reply(self) -> None:
        llm = FakeLlm([["Ravi missed two homework submissions this week. ", "His science marks dropped too."],
                       ["Sure, one minute."]])
        s, stt, tts = session(llm, FakeTts(chunk_delay=0.05, chunks=6))
        await s.start()
        await s.send_client_content(turns=cue("(deliver)"))
        await asyncio.sleep(0.12)
        s.cancel_response()
        first = kinds(await turn(s))
        assert first[-1] == "interrupted"
        assert "said:His science marks dropped too." not in first, "the abandoned sentence was spoken"
        await s.respond("Wait, wait, what about his marks?")
        second = kinds(await turn(s))
        assert "said:Sure, one minute." in second
        # The model remembers only what was said before the cut.
        history_text = " ".join(
            p.text for c in llm.histories[-1] for p in (c.parts or []) if getattr(p, "text", None)
        )
        assert "[the parent interrupted here" in history_text
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
            async def stream(self, history: list[Any], note: str = "") -> Any:
                raise RuntimeError("vertex 503")
                yield  # pragma: no cover

        s, _, _ = session(Boom([]))
        await s.start()
        await s.send_client_content(turns=cue("(kickoff)"))
        k = kinds(await turn(s))
        assert k[-1] == "turn_complete" and k[0].startswith("said:Sorry")

    async def test_close_ends_receive_without_yielding(self) -> None:
        s, stt, tts = session(FakeLlm([]))
        await s.start()
        await s.close()
        assert await turn(s) == []
        assert stt.closed and tts.closed


@pytest.mark.asyncio
class TestFixedLinesAndThePrivacyGuard:
    async def test_say_speaks_verbatim_without_the_model(self) -> None:
        llm = FakeLlm([])
        s, _, tts = session(llm)
        await s.start()
        line = "Hello, I'm calling from Sahayak Test School. May I know your child's name, please?"
        await s.say(line)
        k = kinds(await turn(s))
        assert k[-1] == "turn_complete" and llm.histories == []
        assert " ".join(t for t, _ in tts.spoken) == line
        # Remembered as said, so a later reply knows what the parent heard.
        assert s._history[-1].parts[0].text == line

    async def test_say_cuts_off_a_reply_in_progress(self) -> None:
        s, _, _ = session(FakeLlm([["A long answer that is still being spoken to the parent."]]),
                          FakeTts(chunk_delay=0.05, chunks=10))
        await s.start()
        await s.respond("question")
        await asyncio.sleep(0.1)
        await s.say("Thank you for your time. Goodbye.")
        first = kinds(await turn(s))
        assert first[-1] == "interrupted"
        assert "said:Thank you for your time." in kinds(await turn(s))

    async def test_the_guard_blocks_a_sentence_before_synthesis(self) -> None:
        llm = FakeLlm([["Hello, I'm from the school. ", "Ravi missed two homework submissions."]])
        s, _, tts = session(llm)
        s.set_guard(lambda text: "Ravi" not in text)
        await s.start()
        await s.respond("hello")
        k = kinds(await turn(s))
        assert all("Ravi" not in t for t, _ in tts.spoken)
        assert not any("Ravi" in x for x in k)
        assert s.privacy_blocks == 1

    async def test_the_guard_also_covers_fixed_lines(self) -> None:
        s, _, tts = session(FakeLlm([]))
        s.set_guard(lambda text: "Ravi" not in text)
        await s.start()
        await s.say("This is about Ravi.")
        await turn(s)
        assert tts.spoken == [] and s.privacy_blocks == 1

    def test_unlock_swaps_the_models_instruction(self) -> None:
        swapped: list[str] = []
        llm = FakeLlm([])
        llm.set_system = swapped.append  # type: ignore[attr-defined]
        s, _, _ = session(llm)
        assert not s.unlocked
        s.unlock("verified instruction")
        assert s.unlocked and swapped == ["verified instruction"]


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
        s.cancel_response()  # the bridge's decision on that utterance
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
            def cancel_response(self, heard: str | None = None) -> None:  # noqa: ARG002
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


@pytest.mark.asyncio
class TestLanguageIsTheParentsChoice:
    """Staging run 1 (2026-10-11): an English call opened in Hindi, because a
    prompt section allowed the model to choose. The engine now decides."""

    async def test_replies_start_in_english_with_an_explicit_note(self) -> None:
        llm = FakeLlm([["Hello."]])
        s, _, _ = session(llm, cfg=CascadeConfig(hindi=True))
        await s.start()
        await s.send_client_content(turns=cue("(kickoff)"))
        await turn(s)
        assert "REPLY LANGUAGE NOW: English" in llm.notes[0]

    async def test_asking_for_hindi_switches(self) -> None:
        llm = FakeLlm([["Ji, bilkul."], ["अच्छा।"]])
        s, stt, tts = session(llm, cfg=CascadeConfig(hindi=True))
        await s.start()
        await stt.final("Can you please speak in Hindi?")
        await s.respond("Can you please speak in Hindi?")
        await turn(s)
        assert s.language == "Hindi" and "REPLY LANGUAGE NOW: Hindi" in llm.notes[0]

    async def test_hindi_speech_switches(self) -> None:
        s, stt, _ = session(FakeLlm([["ठीक है।"]]), cfg=CascadeConfig(hindi=True))
        await s.start()
        await stt.cb({"event": "transcript.final", "text": "उसकी अटेंडेंस कैसी है?", "language": "hi-IN"})
        assert s.language == "Hindi"

    async def test_no_switch_when_hindi_is_not_enabled(self) -> None:
        s, stt, _ = session(FakeLlm([["Sorry."]]), cfg=CascadeConfig(hindi=False))
        await s.start()
        await stt.final("Can you speak Hindi?")
        await s.respond("Can you speak Hindi?")
        await turn(s)
        assert s.language == "English"

    async def test_the_call_state_reaches_the_next_reply(self) -> None:
        llm = FakeLlm([["Okay."]])
        s, _, _ = session(llm)
        await s.start()
        s.set_context_note("You have ALREADY introduced yourself; never do it again.")
        await s.send_client_content(turns=cue("yes"))
        await turn(s)
        assert "ALREADY introduced" in llm.notes[0]


class TestStateNotes:
    def test_the_note_follows_the_gate_and_never_carries_child_data(self) -> None:
        from sahayakai_agents.telephony.dialogue import DialogueState

        d = DialogueState(student_name="Ravi Test", school_name="Sahayak Test School",
                          message="Ravi missed two homework submissions.")
        d.on_agent_turn("I'm calling from Sahayak Test School. May I know your child's name?")
        d.on_identity_question_asked()
        assert "ALREADY introduced" in d.cue_context() and "NOT verified" in d.cue_context()
        d.on_parent("Ravi")
        d.on_message_delivered()
        note = d.cue_context()
        assert "delivered" in note and "NOT verified" not in note
        assert "Ravi" not in note and "homework submissions" not in note

    def test_the_bridge_tells_the_engine(self) -> None:
        from sahayakai_agents.telephony import router as telephony

        notes: list[str] = []
        b = telephony._Bridge(SimpleNamespace(), "o", call_uuid="")  # type: ignore[arg-type]
        b.engine = SimpleNamespace(set_context_note=notes.append)
        b.agent_turn_text = " I'm calling from Sahayak Test School on behalf of Ms. Rao."
        telephony._commit_agent_turn(b)
        assert notes and "introduced" in notes[-1]


class TestAudibleAcrossSentenceGaps:
    """Staging run 1: a parent who began between two of VIDYA's sentences was
    not treated as interrupting until her next sentence (537 ms p95)."""

    def test_open_turn_keeps_her_audible_through_a_short_gap(self) -> None:
        from sahayakai_agents.telephony import router as telephony

        b = telephony._Bridge(SimpleNamespace(), "o", call_uuid="")  # type: ignore[arg-type]
        b.last_speech_frame_at = 100.0
        b.model_turn_open = True
        assert telephony._ai_audible(b, 100.9)
        assert not telephony._ai_audible(b, 102.0)
        b.model_turn_open = False
        assert not telephony._ai_audible(b, 100.9)


@pytest.mark.asyncio
class TestStagingRun2Fixes:
    async def test_the_engine_never_says_goodbye_on_its_own(self) -> None:
        # The model's end_call is a REQUEST the bridge may decline (a question
        # may still be open); the engine must not have said goodbye already.
        # The bridge speaks its own fixed closing line when it ends the call.
        s, _, tts = session(FakeLlm([[call("end_call", reason="parent_finished")]]))
        await s.start()
        await s.send_client_content(turns=cue("Okay thank you, bye."))
        msgs: list[Any] = []

        async def collect() -> None:
            async for m in s.receive():
                msgs.append(m)
                if m.tool_call:
                    from google.genai import types as t

                    fc = m.tool_call.function_calls[0]
                    await s.send_tool_response(function_responses=[
                        t.FunctionResponse(id=fc.id, name=fc.name, response={"status": "ok"})])

        await asyncio.wait_for(collect(), timeout=3)
        k = kinds(msgs)
        assert "tool_call" in k and k[-1] == "turn_complete"
        assert tts.spoken == []

    async def test_a_goodbye_that_was_spoken_is_not_doubled(self) -> None:
        s, _, tts = session(FakeLlm([["Thank you, take care. ", call("end_call", reason="parent_finished")]]))
        await s.start()
        await s.send_client_content(turns=cue("bye"))

        async def collect() -> None:
            async for m in s.receive():
                if m.tool_call:
                    from google.genai import types as t

                    fc = m.tool_call.function_calls[0]
                    await s.send_tool_response(function_responses=[
                        t.FunctionResponse(id=fc.id, name=fc.name, response={"status": "ok"})])

        await asyncio.wait_for(collect(), timeout=3)
        assert [t for t, _ in tts.spoken] == ["Thank you, take care."]

    async def test_memory_holds_what_was_heard_not_what_was_synthesised(self) -> None:
        llm = FakeLlm([["Certainly. ", "Ravi's science marks have dropped and he missed two homeworks. ",
                        "She would like to help."], ["Sure."]])
        s, stt, _ = session(llm, FakeTts(chunk_delay=0.05, chunks=8))
        await s.start()
        await s.send_client_content(turns=cue("yes"))
        await asyncio.sleep(0.6)  # into the second sentence
        s.cancel_response(heard="Certainly. Ravi's science")
        await turn(s)
        await s.respond("What marks did he get?")
        await turn(s)
        memory = " ".join(p.text for c in llm.histories[-1] for p in (c.parts or []) if getattr(p, "text", None))
        assert "Certainly. Ravi's science … [the parent interrupted here" in memory
        assert "missed two homeworks" not in memory, "unheard words were remembered as said"

    async def test_the_engine_is_busy_while_composing(self) -> None:
        s, _, _ = session(FakeLlm([["Done."]], delay=0.2))
        await s.start()
        assert not s.busy
        await s.send_client_content(turns=cue("hello"))
        assert s.busy
        await turn(s)
        assert not s.busy


@pytest.mark.asyncio
async def test_the_watchdog_does_not_nudge_a_busy_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    from sahayakai_agents.telephony import router as telephony
    from sahayakai_agents.telephony.dialogue import DialogueState

    monkeypatch.setattr(telephony, "_CONVERSATION_SILENCE", 0.2)
    monkeypatch.setattr(telephony, "_MODEL_SETTLE_SECONDS", 0.0)
    b = telephony._Bridge(SimpleNamespace(), "o", call_uuid="")  # type: ignore[arg-type]
    b.dialogue = DialogueState()
    b.engaged, b.model_has_spoken, b.parent_said = True, True, ["haan"]
    b.engine = SimpleNamespace(busy=True)
    cues: list[Any] = []

    class _S:
        async def send_client_content(self, **kw: Any) -> None:
            cues.append(kw)

    task = asyncio.create_task(telephony._conversation_watchdog(b, _S()))
    await asyncio.sleep(0.8)
    assert not cues, "nudged an engine that was still composing a reply"
    b.engine = SimpleNamespace(busy=False)
    await asyncio.sleep(0.8)
    b.stop = True
    await asyncio.wait_for(task, timeout=2)
    assert cues


@pytest.mark.asyncio
async def test_a_silent_reply_after_a_lookup_is_asked_again() -> None:
    # Staging run 3: the attendance lookup returned and the model said nothing.
    llm = FakeLlm([[call("get_attendance_summary")], [], ["He was absent two days."]])
    s, _, tts = session(llm)
    await s.start()
    await s.send_client_content(turns=cue("How is his attendance?"))
    msgs: list[Any] = []

    async def collect() -> None:
        async for m in s.receive():
            msgs.append(m)
            if m.tool_call:
                from google.genai import types as gt

                fc = m.tool_call.function_calls[0]
                await s.send_tool_response(function_responses=[
                    gt.FunctionResponse(id=fc.id, name=fc.name, response={"absent": 2})])

    await asyncio.wait_for(collect(), timeout=3)
    assert "said:He was absent two days." in kinds(msgs)
    assert s.empty_after_tool == 1
    assert "Tell the parent the answer now" in llm.notes[-1]


class _Resp:
    def __init__(self, chunks: list[Any]) -> None:
        self._chunks = chunks

    def __aiter__(self) -> Any:
        async def gen() -> Any:
            for c in self._chunks:
                yield c

        return gen()


class _Models:
    def __init__(self, behaviour: Any) -> None:
        self.behaviour = behaviour
        self.calls = 0

    async def generate_content_stream(self, **_kw: Any) -> Any:
        self.calls += 1
        return await self.behaviour()


def _client(behaviour: Any) -> Any:
    models = _Models(behaviour)
    return SimpleNamespace(aio=SimpleNamespace(models=models)), models


@pytest.mark.asyncio
class TestModelRegionFallback:
    """Staging run 5: asia-south1 answered 429 RESOURCE_EXHAUSTED for minutes."""

    def _reasoner(self, *behaviours: Any) -> tuple[Any, list[Any]]:
        from google.genai import types as gt

        r = cas.GeminiReasoner.__new__(cas.GeminiReasoner)
        r._model = "m"
        r._system_text = "sys"
        r._config = gt.GenerateContentConfig()
        r.fallbacks = 0
        pairs = [_client(b) for b in behaviours]
        r._clients = [(f"loc{i}", c) for i, (c, _) in enumerate(pairs)]
        return r, [m for _, m in pairs]

    async def test_a_429_falls_back_to_the_next_region(self) -> None:
        async def exhausted() -> Any:
            raise RuntimeError("429 RESOURCE_EXHAUSTED")

        async def ok() -> Any:
            return _Resp([SimpleNamespace(text="Hello.", function_calls=None)])

        r, models = self._reasoner(exhausted, ok)
        out = [c async for c in r.stream([], "note")]
        assert [c.text for c in out] == ["Hello."]
        assert r.fallbacks == 1 and models[1].calls == 1

    async def test_a_slow_first_token_falls_back(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(cas, "LLM_FIRST_TOKEN_SECONDS", 0.05)

        async def slow() -> Any:
            await asyncio.sleep(1)
            return _Resp([])

        async def ok() -> Any:
            return _Resp([SimpleNamespace(text="Hi.", function_calls=None)])

        r, _ = self._reasoner(slow, ok)
        out = [c async for c in r.stream([])]
        assert [c.text for c in out] == ["Hi."]

    async def test_every_region_failing_raises(self) -> None:
        async def exhausted() -> Any:
            raise RuntimeError("429")

        r, _ = self._reasoner(exhausted, exhausted)
        with pytest.raises(RuntimeError):
            _ = [c async for c in r.stream([])]


@pytest.mark.asyncio
async def test_an_unreachable_model_is_never_silence() -> None:
    class Down(FakeLlm):
        async def stream(self, history: list[Any], note: str = "") -> Any:
            raise RuntimeError("429 in every region")
            yield  # pragma: no cover

    s, _, tts = session(Down([]))
    await s.start()
    await s.send_client_content(turns=cue("What marks did he get?"))
    k = kinds(await turn(s))
    assert k[0].startswith("said:Sorry, I didn't catch that properly")
    assert k[-1] == "turn_complete" and s.failed_turns == 1
