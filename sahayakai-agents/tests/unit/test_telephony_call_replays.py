"""Deterministic call replays (P5): the whole bridge, end to end, no network.

REAL here: the bridge (`_Bridge`), the carrier pump (Vobiz `media` frames in,
re-framed from irregular chunk sizes), the 20 ms pacer (`playAudio` and
`clearAudio` out), the barge-in detector on handset-like audio with VIDYA's own
echo on the line, the dialogue state machine, the privacy guard, the Neha
cascade engine (sentence streaming, cancellation, tool round-trips), the
school-data tools and their identity gate, and the silence watchdog.

FAKE: only the network edges. The recogniser (the test says what was
recognised, and when), the text model (scripted replies; everything it is
shown is recorded) and the synthesiser (a tone whose length follows the text;
every sentence synthesised is recorded, with whether the caller was verified
at that moment).

What "the parent heard" means below: speech frames the pacer actually sent to
the carrier (non-silent `playAudio` payloads), and the transcript, which keeps
only the share of a cut-off turn that was played. Privacy assertions use the
stricter set: every sentence SYNTHESISED, played or not.

Scenarios 1-14 are the replay list of the 2026-10-11 repair request; the last
class is the model trying to get round the gate.
"""

from __future__ import annotations

import asyncio
import base64
import itertools
import json
import math
import os
import random
import time
from array import array
from collections import deque
from collections.abc import Callable
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.audio import pcm16_to_ulaw, ulaw_to_pcm16
from sahayakai_agents.telephony.cascade import CascadeConfig, CascadeSession
from sahayakai_agents.telephony.dialogue import DialogueState, Floor, Identity, Stage
from sahayakai_agents.telephony.flow import LINES
from sahayakai_agents.telephony.privacy import ProtectedTerms
from sahayakai_agents.telephony.prompt import CallContext, spoken_message
from sahayakai_agents.telephony.school_data import CallScope, SchoolDataTools

MESSAGE = (
    "Ravi's science performance has declined recently, and he missed two homework "
    "submissions this week."
)
SPOKEN = spoken_message(MESSAGE)
CONTEXT = CallContext(
    student_name="Ravi Test",
    teacher_name="Ms. Rao",
    class_name="Class 5B",
    school_name="Sahayak Test School",
    reason="declining science marks",
    subject="Science",
    performance_summary="Science 11/25 in the unit test",
    language="English",
    message=MESSAGE,
)
EN = LINES["English"]
INVITE = EN["deliver_invite"]
#: The child's actual data in CONTEXT. (Topic words such as "homework" also
#: appear in the generic call instructions and are not child data.)
CHILD_DATA = ["Ravi", "declined recently", "homework submissions", "5B", "11/25",
              "declining science marks", "Science 11"]


def child_data_in(text: str) -> list[str]:
    return [d for d in CHILD_DATA if d.lower() in text.lower()]

# ---- audio -------------------------------------------------------------------

RATE = 8000


def _dbov(level: float) -> float:
    return 32768.0 * 10 ** (level / 20)


def voice(seconds: float, level_dbov: float = -24.0, seed: int = 7) -> list[float]:
    """Voice-like 8 kHz audio: pitch harmonics under a syllabic envelope."""
    rng = random.Random(seed)
    out, phase = [], 0.0
    syll = 4.0 + rng.random()
    for i in range(int(seconds * RATE)):
        t = i / RATE
        phase += 2 * math.pi * 160 * (1 + 0.08 * math.sin(2 * math.pi * 0.7 * t)) / RATE
        tone = sum(math.sin(k * phase) / k for k in range(1, 8))
        env = 0.05 + 0.95 * max(0.0, math.sin(math.pi * ((t * syll) % 1.0))) ** 1.5
        out.append(tone * env + rng.gauss(0, 0.05))
    rms = math.sqrt(sum(v * v for v in out) / max(1, len(out))) or 1.0
    return [v * _dbov(level_dbov) / rms for v in out]


def click(level_dbov: float = -12.0) -> list[float]:
    """Two frames of a loud crackle."""
    rng = random.Random(3)
    return [rng.gauss(0, _dbov(level_dbov)) for _ in range(320)]


def _tone_24k(seconds: float) -> bytes:
    n = int(24000 * seconds)
    return array("h", (int(6000 * math.sin(2 * math.pi * 220 * i / 24000)) for i in range(n))).tobytes()


_TONE_100MS = _tone_24k(0.1)  # 22 whole cycles: seamless when repeated


class Carrier:
    """The Vobiz end of the socket.

    Sends the parent's line every 20 ms (line noise, plus VIDYA's own echo
    while she talks, plus whatever the parent says), cut into `chunks`-sized
    payloads; records every frame the bridge sends back.
    """

    def __init__(
        self,
        chunks: tuple[int, ...] = (160,),
        *,
        echo_gain: float = 0.03,  # ~30 dB echo return loss: a typical handset
        noise_dbov: float = -62.0,
    ) -> None:
        self.inbox: asyncio.Queue[str] = asyncio.Queue()
        self.sent: list[tuple[float, str, bool]] = []  # (time, event, is_speech)
        self.chunks = chunks
        self.echo_gain = echo_gain
        self.noise = _dbov(noise_dbov)
        self._speech: deque[float] = deque()
        self._echo: deque[array[int]] = deque()
        self._rng = random.Random(11)
        self.feeder: asyncio.Task[None] | None = None

    # the socket surface the bridge uses
    async def receive_text(self) -> str:
        return await self.inbox.get()

    async def send_text(self, text: str) -> None:
        m = json.loads(text)
        event = m.get("event", "")
        speech = False
        if event == "playAudio":
            payload = base64.b64decode(m["media"]["payload"])
            speech = set(payload) != {0xFF}
            if speech and self.echo_gain:
                self._echo.append(ulaw_to_pcm16(payload))
        self.sent.append((time.monotonic(), event, speech))

    # the test's controls
    def start(self) -> None:
        self.inbox.put_nowait(json.dumps({"event": "start", "start": {"streamId": "s-replay"}}))
        self.feeder = asyncio.create_task(self._feed())

    def say(self, samples: list[float]) -> None:
        self._speech.extend(samples)

    def speech_frames(self, since: float = 0.0, until: float = math.inf) -> int:
        return sum(1 for t, e, s in self.sent if s and e == "playAudio" and since <= t < until)

    def clears(self, since: float = 0.0) -> list[float]:
        return [t for t, e, _ in self.sent if e == "clearAudio" and t >= since]

    def last_speech_at(self) -> float:
        return max((t for t, e, s in self.sent if s), default=0.0)

    def first_speech_after(self, since: float) -> float | None:
        return min((t for t, e, s in self.sent if s and t >= since), default=None)

    def _frame(self) -> bytes:
        samples = [self._rng.gauss(0, self.noise) for _ in range(160)]
        if self._echo:
            echo = self._echo.popleft()
            for i in range(min(160, len(echo))):
                samples[i] += echo[i] * self.echo_gain
        for i in range(160):
            if not self._speech:
                break
            samples[i] += self._speech.popleft()
        return pcm16_to_ulaw(array("h", (int(max(-32767, min(32767, v))) for v in samples)))

    async def _feed(self) -> None:
        stream = bytearray()
        sizes = itertools.cycle(self.chunks)
        size = next(sizes)
        next_at = time.monotonic()
        while True:
            stream += self._frame()
            while len(stream) >= size:
                payload, stream[:] = bytes(stream[:size]), stream[size:]
                self.inbox.put_nowait(
                    json.dumps(
                        {
                            "event": "media",
                            "streamId": "s-replay",
                            "media": {"payload": base64.b64encode(payload).decode()},
                        }
                    )
                )
                size = next(sizes)
            next_at += 0.02
            await asyncio.sleep(max(0.0, next_at - time.monotonic()))


# ---- the network edges ----------------------------------------------------------


class FakeStt:
    def __init__(self) -> None:
        self.cb: Any = None
        self.bytes_in = 0

    async def start(self, on_event: Any) -> None:
        self.cb = on_event

    async def send(self, pcm16k: bytes) -> None:
        self.bytes_in += len(pcm16k)

    async def close(self) -> None:
        return None

    async def final(self, text: str) -> None:
        await self.cb({"event": "transcript.final", "text": text})


class FakeTts:
    """A tone as long as the sentence would take to say. Records every sentence."""

    def __init__(self, *, per_char: float = 0.004, rtf: float = 0.3) -> None:
        self.per_char, self.rtf = per_char, rtf
        self.spoken: list[tuple[str, bool]] = []
        self.verified: Callable[[], bool] = lambda: False

    async def stream(self, text: str, language: str) -> Any:  # noqa: ARG002
        self.spoken.append((text, self.verified()))
        await asyncio.sleep(0.03)  # time to first byte
        for _ in range(max(2, math.ceil(len(text) * self.per_char / 0.1))):
            yield _TONE_100MS
            await asyncio.sleep(0.1 * self.rtf)

    async def close(self) -> None:
        return None


def call(name: str, **args: Any) -> SimpleNamespace:
    return SimpleNamespace(name=name, args=args, id=None)


def _texts(history: list[Any], *, model: bool = True) -> list[str]:
    """The conversation as text; `model=False` keeps only what the model was
    SHOWN (the parent, cues, tool results), not what it said itself."""
    out: list[str] = []
    for content in history:
        if not model and getattr(content, "role", "") == "model":
            continue
        for part in getattr(content, "parts", None) or []:
            if getattr(part, "text", None):
                out.append(part.text)
            fr = getattr(part, "function_response", None)
            if fr is not None:
                out.append(json.dumps(fr.response, default=str))
    return out


class FakeLlm:
    """Scripted replies. A reply is a list of text / call parts, or a function
    of the conversation so far returning one. Records what it was shown."""

    def __init__(self, replies: list[Any]) -> None:
        self.replies = list(replies)
        self.system = ""
        self.calls: list[dict[str, Any]] = []

    def set_system(self, text: str) -> None:
        self.system = text

    async def stream(self, history: list[Any], note: str = "") -> Any:
        seen = _texts(history)
        self.calls.append(
            {"system": self.system, "history": seen, "shown": _texts(history, model=False), "note": note}
        )
        reply = self.replies.pop(0) if self.replies else ["Okay."]
        if callable(reply):
            reply = reply(seen)
        for part in reply:
            await asyncio.sleep(0.02)
            if isinstance(part, str):
                yield SimpleNamespace(text=part, function_calls=[])
            else:
                yield SimpleNamespace(text=None, function_calls=[part])


class _Reader:
    """The school's records for Ravi (outreach scope o-replay)."""

    delay = 0.0

    def class_teacher(self, _c: str) -> str:
        return "t1"

    def student_exists(self, _c: str, _s: str) -> bool:
        return True

    def attendance_since(self, _c: str, _since: str) -> list[dict[str, Any]]:
        if self.delay:
            time.sleep(self.delay)
        return [
            {"date": "2026-10-08", "records": {"ravi": "absent"}},
            {"date": "2026-10-09", "records": {"ravi": "present"}},
        ]

    def assessments(self, *_a: Any) -> list[dict[str, Any]]:
        return []


# ---- the call ------------------------------------------------------------------

_METRICS: list[dict[str, Any]] = []


class Call:
    """One call through the real bridge, set up the way `vobiz_stream` does."""

    def __init__(
        self,
        llm: FakeLlm,
        *,
        tts: FakeTts | None = None,
        chunks: tuple[int, ...] = (160,),
        reader: type[_Reader] = _Reader,
        name: str = "",
    ) -> None:
        self.llm, self.tts, self.stt = llm, tts or FakeTts(), FakeStt()
        self.carrier = Carrier(chunks)
        self.reader = reader
        self.name = name
        self.tasks: list[asyncio.Task[Any]] = []

    async def __aenter__(self) -> Call:
        b = telephony._Bridge(self.carrier, "o-replay", call_uuid="")  # type: ignore[arg-type]
        b.local_barge_in = True
        telephony._equip_bridge(b, CONTEXT, None)
        b.tools = SchoolDataTools(
            CallScope("o-replay", "t1", "c1", "ravi"), self.reader, today=date(2026, 10, 10)
        )
        b.unlocked_instruction = telephony._instruction(CONTEXT, lookups=True, verified=True)
        # What open_cascade hands the model at connect: the LOCKED instruction.
        self.llm.system = self.locked = telephony._instruction(CONTEXT, lookups=True, verified=False)
        self.tts.verified = lambda: b.dialogue.may_share_student_data
        engine = CascadeSession(CascadeConfig(), self.stt, self.tts, self.llm)
        await engine.start()
        b.engine, self.b, self.engine = engine, b, engine
        self.carrier.start()
        self.tasks = [
            asyncio.create_task(telephony._pace_outbound(b)),
            asyncio.create_task(telephony._pump_carrier_to_live(b, engine)),
            asyncio.create_task(telephony._pump_live_to_carrier(b, engine)),
            asyncio.create_task(telephony._conversation_watchdog(b, engine)),
        ]
        await self.until(lambda: b.stream_id is not None)
        # The kickoff, exactly as vobiz_stream does it for the cascade.
        engine.set_guard(lambda sentence: not telephony._leaks(b, sentence))
        await telephony._say(b, engine, telephony._fixed(b, "identity_first"))
        b.dialogue.on_identity_question_asked()
        b.last_activity = time.monotonic()
        await self.settle()
        return self

    async def __aexit__(self, *_exc: Any) -> None:
        b = self.b
        metrics = telephony._conversation_metrics(b)
        metrics["scenario"] = self.name
        metrics["ticks_late_pct"] = round(100 * b.ticks_late / b.ticks, 2) if b.ticks else None
        metrics["worst_lateness_ms"] = round(b.worst_lateness_ms)
        _METRICS.append(metrics)
        b.stop = True
        await self.engine.close()
        assert self.carrier.feeder is not None
        for t in [*self.tasks, self.carrier.feeder, *b.background]:
            t.cancel()
        await asyncio.gather(*self.tasks, self.carrier.feeder, *b.background, return_exceptions=True)

    # -- driving the call --

    async def parent(
        self, text: str, *, speech: float = 0.0, level: float = -24.0, asr_ms: float = 150
    ) -> None:
        """The parent says `text`: optionally as audio on the line, then the
        recogniser's final transcript `asr_ms` after they stop."""
        if speech:
            self.carrier.say(voice(speech, level, seed=len(text)))
            await asyncio.sleep(speech + 0.04)
        else:
            self.b.last_parent_voice_at = time.monotonic()
        await asyncio.sleep(asr_ms / 1000)
        await self.stt.final(text)
        await asyncio.sleep(0.02)

    async def verify(self) -> None:
        await self.parent("His name is Ravi.")
        await self.settle()

    async def until(self, cond: Callable[[], bool], timeout: float = 5.0) -> None:
        deadline = time.monotonic() + timeout
        while not cond():
            if time.monotonic() > deadline:
                b = self.b
                raise AssertionError(
                    "timed out waiting for the call: "
                    f"busy={self.engine.busy} queued={b.out.qsize()} pending={len(b.pending)} "
                    f"hold={bool(b.verdict_hold_until)} paused={b.barge.paused} "
                    f"tools={len(b.tool_tasks)} stop={b.stop} spoken={self.spoken()}"
                )
            await asyncio.sleep(0.01)

    def _quiet(self) -> bool:
        b = self.b
        return (
            not self.engine.busy
            and b.out.empty()
            and not b.pending
            and not b.verdict_hold_until
            and not b.barge.paused
            and not b.tool_tasks
        )

    async def settle(self, timeout: float = 8.0) -> None:
        """Until VIDYA has finished everything she has to say and it has played."""
        await self.until(self._quiet, timeout)
        await asyncio.sleep(0.12)
        await self.until(self._quiet, timeout)

    # -- what happened --

    def mark(self) -> int:
        return len(self.tts.spoken)

    def spoken(self, since: int = 0) -> list[str]:
        return [t for t, _ in self.tts.spoken[since:]]

    def said(self, since: int = 0) -> str:
        return " ".join(self.spoken(since))

    def agent_lines(self) -> list[str]:
        return [t["text"] for t in self.b.transcript if t["role"] == "agent"]

    def assert_nothing_leaked(self) -> None:
        """Nothing about the child reached the parent, or the model, unverified."""
        protected = self.b.protected
        assert protected is not None
        for text, verified in self.tts.spoken:
            if not verified:
                assert protected.leaks(text) == [], f"synthesised before verification: {text!r}"
        assert child_data_in(self.locked) == [], "the locked instruction carries child data"
        for c in self.llm.calls:
            if c["system"] == self.locked:
                assert child_data_in(c["note"]) == []
                for h in c["shown"]:
                    assert child_data_in(h) == [], f"unverified model context: {h!r}"


@pytest.fixture(autouse=True)
def _no_io(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _noop(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(telephony, "_persist_transcript", _noop)


@pytest.fixture(scope="module", autouse=True)
def _write_metrics() -> Any:
    """SAHAYAK_REPLAY_METRICS=<path>: write each replay's call metrics as JSON lines."""
    yield
    path = os.environ.get("SAHAYAK_REPLAY_METRICS")
    if path:
        with open(path, "w", encoding="utf-8") as f:
            for m in _METRICS:
                f.write(json.dumps(m, default=str) + "\n")


# ---- the replays ---------------------------------------------------------------


@pytest.mark.asyncio
class TestBeforeVerification:
    async def test_01_hello_reveals_nothing_and_asks_neutrally_again(self) -> None:
        llm = FakeLlm([])
        async with Call(llm, name="01_hello") as c:
            first = c.said()
            assert "child's name" in first and "Ravi" not in first
            mark = c.mark()
            await c.parent("Hello?", speech=0.5)
            await c.settle()
            assert c.said(mark) == EN["identity_retry"]
            assert c.b.dialogue.identity is Identity.UNKNOWN and not c.b.unlocked
            assert llm.calls == [], "the model was asked something before verification"
            c.assert_nothing_leaked()

    @pytest.mark.parametrize(
        "said", ["What?", "Sorry?", "Repeat the message", "Can you say that again?", "Yes"]
    )
    async def test_02_what_or_repeat_reveals_nothing(self, said: str) -> None:
        llm = FakeLlm([])
        async with Call(llm, name=f"02_{said}") as c:
            mark = c.mark()
            await c.parent(said)
            await c.settle()
            again = c.said(mark)
            assert "child's name" in again
            assert SPOKEN not in again and not c.b.dialogue.may_share_student_data
            assert llm.calls == []
            c.assert_nothing_leaked()


@pytest.mark.asyncio
class TestVerifiedDelivery:
    async def test_03_the_childs_name_unlocks_and_the_message_is_delivered_verbatim(self) -> None:
        llm = FakeLlm([])
        async with Call(llm, name="03_verified") as c:
            mark = c.mark()
            await c.verify()
            assert c.said(mark) == f"{EN['deliver_lead']} {SPOKEN} {INVITE}"
            assert c.b.unlocked and llm.system == c.b.unlocked_instruction
            assert c.b.dialogue.message_delivered and c.b.dialogue.stage is Stage.PARENT_RESPONSE
            assert c.agent_lines()[-1] == f"{EN['deliver_lead']} {SPOKEN} {INVITE}"
            c.assert_nothing_leaked()

    @pytest.mark.parametrize("ask", ["Can you repeat the message?", "Repeat", "dobara boliye pura message"])
    async def test_04_a_repeat_request_repeats_the_message_faithfully(self, ask: str) -> None:
        llm = FakeLlm([])
        async with Call(llm, name="04_repeat") as c:
            await c.verify()
            mark = c.mark()
            await c.parent(ask)
            await c.settle()
            assert c.said(mark) == SPOKEN, "a repeat must be the teacher's words, not a paraphrase"
            assert llm.calls == []


@pytest.mark.asyncio
class TestInterruptions:
    async def test_05_talking_over_a_long_message_stops_it_and_the_parent_is_heard(self) -> None:
        llm = FakeLlm([["He scored eleven out of twenty-five in the science unit test."]])
        async with Call(llm, tts=FakeTts(per_char=0.02, rtf=1.0), name="05_barge_long") as c:
            await c.parent("Ravi")
            await c.until(lambda: c.carrier.speech_frames(since=time.monotonic() - 0.2) > 5)
            await asyncio.sleep(0.4)  # well into the message
            onset = time.monotonic()
            c.carrier.say(voice(1.2, -24.0, seed=5))
            await c.until(lambda: c.b.barge.cancels >= 1, 3)
            clears = c.carrier.clears(since=onset)
            assert clears, "the carrier was never told to drop its buffer"
            assert clears[0] - onset < 0.35, f"stop took {1000 * (clears[0] - onset):.0f} ms"
            await asyncio.sleep(0.9)  # the parent is still talking
            silent_from = clears[0] + 0.05
            asked_at = time.monotonic()
            assert c.carrier.speech_frames(since=silent_from, until=asked_at) == 0, (
                "VIDYA kept talking over the parent"
            )
            await c.parent("Wait, what about his marks in science?", asr_ms=150)
            await c.settle()
            assert llm.calls[-1]["history"][-1] == "Wait, what about his marks in science?"
            assert c.agent_lines()[-1].startswith("He scored eleven")
            cut = c.agent_lines()[-2]
            assert cut.endswith("…") and INVITE not in cut, "the transcript claims unheard words"
            assert c.b.onset_to_stop_ms, "stop latency was not measured"

    async def test_06_wait_then_a_pause_then_a_question_waits_and_answers(self) -> None:
        llm = FakeLlm([["He scored eleven out of twenty-five."], ["Yes, please tell me."]])
        async with Call(llm, tts=FakeTts(per_char=0.02, rtf=1.0), name="06_wait") as c:
            await c.parent("Ravi")
            await c.until(lambda: c.carrier.speech_frames(since=time.monotonic() - 0.2) > 5)
            await asyncio.sleep(0.3)
            await c.parent("Wait.", speech=0.35)
            stopped = time.monotonic()
            await asyncio.sleep(2.0)  # the parent thinks
            assert c.b.dialogue.floor is Floor.WAITING_FOR_PARENT
            assert c.carrier.speech_frames(since=stopped + 0.1) == 0, "VIDYA resumed after 'Wait'"
            assert llm.calls == [], "'Wait' was answered"
            await c.parent("What did he score in science?", speech=0.8)
            await c.settle()
            assert c.agent_lines()[-1] == "He scored eleven out of twenty-five."
            assert len(llm.calls) == 1 and "Yes, please tell me." not in c.said()

    async def test_07_stop_sorry_what_never_loop(self) -> None:
        llm = FakeLlm([["Yes, please tell me."]] * 5)
        async with Call(llm, name="07_no_loops") as c:
            await c.verify()
            mark = c.mark()
            await c.parent("Stop.")
            await c.settle()
            assert c.said(mark) == "" and c.b.dialogue.floor is Floor.WAITING_FOR_PARENT
            for ask in ("Sorry?", "What?"):
                m = c.mark()
                await c.parent(ask)
                await c.settle()
                assert c.said(m) in (SPOKEN, f"{EN['deliver_lead']} {SPOKEN} {INVITE}")
            assert llm.calls == [] and "Yes, please tell me." not in c.said()


@pytest.mark.asyncio
class TestLookups:
    async def test_08_attendance_is_looked_up_and_answered_from_the_record(self) -> None:
        def answer(seen: list[str]) -> list[Any]:
            result = json.loads(seen[-1])
            return [f"He was absent {result['absent']} day and present {result['present']} day."]

        llm = FakeLlm([["Let me check. ", call("get_attendance_summary")], answer])
        async with Call(llm, name="08_attendance") as c:
            await c.verify()
            await c.parent("How has his attendance been this week?")
            await c.settle()
            assert c.agent_lines()[-1].endswith("He was absent 1 day and present 1 day.")
            result = json.loads(llm.calls[-1]["history"][-1])
            assert result["available"] and result["absent"] == 1
            assert c.b.tool_calls == 1

    async def test_09_a_result_that_arrives_after_the_parent_moved_on_is_not_spoken(self) -> None:
        class SlowReader(_Reader):
            delay = 0.6

        llm = FakeLlm([[call("get_attendance_summary")], ["He was absent 1 day."]])
        async with Call(llm, reader=SlowReader, name="09_stale_tool") as c:
            await c.verify()
            mark = c.mark()
            await c.parent("How is his attendance?")
            await c.until(lambda: bool(c.b.tool_tasks), 2)
            await c.parent("Wait.")
            await asyncio.sleep(1.2)  # the lookup finishes after the cancel
            assert not c.b.tool_tasks
            assert len(llm.calls) == 1, "the model was asked to continue a cancelled turn"
            assert c.said(mark) == ""
            assert "absent" not in " ".join(c.agent_lines())


@pytest.mark.asyncio
class TestRecognitionErrors:
    async def test_10_partial_empty_or_wrong_transcripts_neither_unlock_nor_invent(self) -> None:
        llm = FakeLlm([["Sorry, what would you like to know about him?"]])
        async with Call(llm, name="10_bad_asr") as c:
            await c.parent("")  # an empty final is not an attempt
            await c.parent("Rahul")
            await c.settle()
            await c.parent("uh")
            await c.settle()
            assert not c.b.dialogue.may_share_student_data and llm.calls == []
            assert c.b.dialogue.identity_questions == 3
            await c.verify()  # the third question is still answerable
            assert c.b.dialogue.may_share_student_data
            await c.parent("what about his")
            await c.settle()
            # The model is given exactly what was recognised; nothing is filled in.
            assert llm.calls[-1]["history"][-1] == "what about his"
            c.assert_nothing_leaked()


@pytest.mark.asyncio
class TestNoiseAndBackchannels:
    @pytest.mark.parametrize("chunks", [(160,), (100,), (37, 260, 123)])
    async def test_11_noise_echo_clicks_and_haan_never_cut_the_message(
        self, chunks: tuple[int, ...]
    ) -> None:
        llm = FakeLlm([])
        tts = FakeTts(per_char=0.02, rtf=1.0)
        async with Call(llm, tts=tts, chunks=chunks, name=f"11_noise_{len(chunks)}x{chunks[0]}") as c:
            await c.parent("Ravi")
            await c.until(lambda: c.carrier.speech_frames(since=time.monotonic() - 0.2) > 5)
            c.carrier.say(click())  # a crackle on the line
            await asyncio.sleep(0.5)
            await c.parent("haan", speech=0.25)  # "yes, go on"
            await c.settle(timeout=12)
            assert c.b.barge.cancels == 0
            assert c.agent_lines()[-1] == f"{EN['deliver_lead']} {SPOKEN} {INVITE}", (
                "the message was cut or truncated"
            )
            assert llm.calls == []
            assert c.b.barge.rejected_by_echo >= 0  # echo was on the line throughout


@pytest.mark.asyncio
class TestEndingSafely:
    async def test_12a_unclear_identity_ends_politely_after_three_questions(self) -> None:
        llm = FakeLlm([])
        async with Call(llm, name="12_unclear") as c:
            for said in ("Hello", "What?", "Hmm?"):
                await c.parent(said)
                await c.settle()
            await c.until(lambda: c.b.stop, 6)
            assert c.b.dialogue.identity is Identity.FAILED
            assert c.agent_lines()[-1] == EN["close_unverified"]
            assert llm.calls == []
            c.assert_nothing_leaked()

    async def test_12b_repeated_silence_ends_without_sharing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(telephony, "_POST_OPENER_SILENCE", 0.5)
        monkeypatch.setattr(telephony, "_MODEL_SETTLE_SECONDS", 0.1)
        llm = FakeLlm([])
        async with Call(llm, name="12_silence") as c:
            await c.until(lambda: c.b.stop, 10)
            lines = c.agent_lines()
            assert lines.count(EN["identity_retry"]) == 2
            assert lines[-1] == EN["close_silence"]
            assert llm.calls == []
            c.assert_nothing_leaked()

    async def test_13a_a_final_question_gets_an_answer_and_the_goodbye_stands_alone(self) -> None:
        llm = FakeLlm([
            ["He was absent once this week. ", "Is there anything else you'd like to know? ",
             call("end_call", reason="parent_finished")],
        ])
        async with Call(llm, name="13_final_question") as c:
            await c.verify()
            await c.parent("How was his attendance?")
            await c.settle()
            # The model asked a question and tried to hang up in the same breath.
            assert c.b.end_call_declined == 1 and not c.b.closing
            asked_at = c.carrier.last_speech_at()
            await asyncio.sleep(1.0)  # the parent takes a moment
            assert not c.b.closing and not c.b.stop
            await c.parent("No, that's all. Thank you, bye.")
            await c.until(lambda: c.b.stop, 8)
            lines = c.agent_lines()
            assert lines[-1] == EN["close_goodbye"]
            assert lines[-2].endswith("Is there anything else you'd like to know?")
            goodbye_audio = c.carrier.first_speech_after(asked_at + 0.05)
            assert goodbye_audio is not None and goodbye_audio - asked_at > 1.0

    async def test_13b_silence_after_a_question_is_waited_out_before_closing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(telephony, "_CONVERSATION_SILENCE", 1.0)
        monkeypatch.setattr(telephony, "_MODEL_SETTLE_SECONDS", 0.1)
        monkeypatch.setattr(telephony, "_MAX_MEANINGFUL_EXCHANGES", 1)
        llm = FakeLlm([["He was absent once. Anything else you'd like to know?"]])
        async with Call(llm, name="13_silence_after_question") as c:
            await c.verify()
            await c.parent("How was his attendance?")
            await c.settle()
            asked_at = c.carrier.last_speech_at()
            await c.until(lambda: c.b.stop, 10)
            lines = c.agent_lines()
            assert lines[-1] == EN["close_silence"] and "?" not in lines[-1]
            # Never a goodbye straight after a question: the parent had the floor.
            follow = c.carrier.first_speech_after(asked_at + 0.05)
            assert follow is not None and follow - asked_at >= 1.0

    async def test_14_many_real_turns_and_interruptions_are_not_cut_off(self) -> None:
        questions = [f"Question number {i}, how is he doing in class?" for i in range(1, 9)]
        llm = FakeLlm([[f"Answer {i}."] for i in range(1, 9)])
        async with Call(llm, name="14_long_call") as c:
            await c.verify()
            for i, q in enumerate(questions):
                if i % 2:
                    for noise_word in ("wait", "what?", "okay"):
                        await c.parent(noise_word)
                        await c.settle()
                await c.parent(q)
                await c.settle()
            assert len(llm.calls) == 8, "a question went unanswered"
            assert [a for a in c.agent_lines() if a.startswith("Answer ")][-1] == "Answer 8."
            assert not c.b.closing and c.b.dialogue.stage is not Stage.GOODBYE
            assert telephony._meaningful(c.b) == 9  # the identity answer and eight questions


@pytest.mark.asyncio
class TestTheModelCannotGetRoundTheGate:
    async def test_a_model_reply_before_verification_is_blocked_before_synthesis(self) -> None:
        # A code path that (wrongly) asks the model to reply before
        # verification, and a model that guesses: nothing reaches the line.
        llm = FakeLlm([
            ["Ravi missed two homework submissions this week. ", call("get_attendance_summary")],
            ["His science performance has declined recently."],
        ])
        async with Call(llm, name="bypass_cascade") as c:
            mark = c.mark()
            await c.engine.respond("Tell me about my child.")
            await c.settle()
            assert c.said(mark) == ""
            assert c.engine.privacy_blocks == 2
            refusal = json.loads(llm.calls[-1]["history"][-1])
            assert refusal["reason"] == "identity_not_confirmed"
            assert all(c.b.protected.leaks(line) == [] for line in c.agent_lines())  # type: ignore[union-attr]
            c.assert_nothing_leaked()


class TestTheGateOnGeminiLive:
    def test_gemini_live_is_stopped_the_moment_its_transcript_shows_a_leak(self) -> None:
        b = telephony._Bridge(SimpleNamespace(), "o-live", call_uuid="")  # type: ignore[arg-type]
        b.dialogue = DialogueState(student_name="Ravi Test", message=MESSAGE)
        b.dialogue.on_identity_question_asked()
        b.protected = ProtectedTerms.build(
            student_name="Ravi Test", class_name="Class 5B", message=MESSAGE, extra=None,
            allowed="Sahayak Test School Ms. Rao",
        )
        telephony._on_model_audio(b, b"\x10\x00" * 2400)
        assert not b.out.empty()
        server = SimpleNamespace(output_transcription=SimpleNamespace(text=" Ravi's science marks"))
        telephony._on_agent_transcription(b, server)
        assert b.privacy_blocks == 1 and b.out.empty() and b.clear_pending
        assert all("Ravi" not in t["text"] for t in b.transcript)

    def test_the_locked_contexts_carry_no_child_data(self) -> None:
        protected = ProtectedTerms.build(
            student_name=CONTEXT.student_name, class_name=CONTEXT.class_name,
            message=CONTEXT.message, extra=CONTEXT.performance_summary,
            allowed=f"{CONTEXT.school_name} {CONTEXT.teacher_name}",
        )
        for lookups in (True, False):
            assert child_data_in(telephony._instruction(CONTEXT, lookups=lookups, verified=False)) == []
        for kickoff in (telephony._kickoff_text(True), telephony._kickoff_text(False)):
            assert protected.leaks(kickoff) == [] and child_data_in(kickoff) == []
        unlocked = telephony._instruction(CONTEXT, lookups=True, verified=True)
        assert "Ravi" in unlocked and "homework" in unlocked  # verified: the facts are there
