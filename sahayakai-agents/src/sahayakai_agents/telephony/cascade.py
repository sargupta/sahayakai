"""STAGING PROTOTYPE: a cascaded conversation engine with the Neha voice.

    parent audio -> Sarvam saaras realtime STT -> Gemini (text + tools)
                 -> Sarvam Bulbul TTS (neha_en_customer, en-IN) -> the bridge

WHY IT EXISTS

On the 2026-10-11 handset call the Gemini Live voice was heard as American and
the parent's Indian-English replies came back garbled from Live's own
transcription. The Indian-English voice asked for ("Neha") is a Sarvam Bulbul
speaker; Live cannot speak in it. A cascade can.

WHAT IT IS NOT

Not the Sampark engine. The Sampark plan (docs/sampark/CONVERSATION_PLAN.md
§4, phase C1) owns the production cascade and its Engine interface; nothing
of it is built yet on `feature/school-parent-calling`. This prototype exists
to put the requested voice on a real phone line behind `VOBIZ_ENGINE=cascade`,
on the isolated staging service only, and it speaks exactly the surface the
bridge already uses (`engine.ConversationSession`) so the bridge — barge-in,
identity gate, school-data tools, end-call veto, transcript and summary — is
unchanged. Whether it is adopted, rewritten or discarded is the Sampark
owner's call.

THE SURFACE (see engine.py)

- send_realtime_input(audio=Blob(pcm16@16k)) -> Sarvam STT, as-is.
- send_client_content(turns=...)            -> a user turn; a reply follows.
- send_tool_response(function_responses=...) -> resumes a paused reply.
- receive()                                  -> per-turn iterator of messages
  shaped like Gemini Live's: .data (PCM16 @ 24 kHz),
  .server_content.{input_transcription, output_transcription, interrupted,
  turn_complete}, .tool_call, .tool_call_cancellation.
- cancel_response()                          -> the bridge's barge-in confirmed;
  stop generating and speaking now.

AUDIO CONTRACT, VERIFIED AGAINST THE API (2026-10-11)

Bulbul's streaming endpoint with output_audio_codec=linear16,
speech_sample_rate=24000 returns `audio/pcm`: raw little-endian 16-bit mono,
NO header (first bytes 00 00 00 00 — not RIFF). That is exactly what Gemini
Live returns, so the bridge's resampler and pacer take it unchanged. Chunks
can split a sample; an odd trailing byte is carried to the next chunk.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import os
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Protocol

import structlog

log = structlog.get_logger(__name__)

__all__ = ["CascadeConfig", "CascadeSession", "cascade_enabled", "split_sentences"]

SARVAM_TTS_STREAM_URL = "https://api.sarvam.ai/text-to-speech/stream"
SARVAM_STT_WS_URL = "wss://api.sarvam.ai/speech-to-text-realtime/ws"
#: The bridge answers every tool (the identity check waits <= 1.2 s, lookups
#: <= 2.5 s). Past this the reply continues without the answer.
TOOL_TIMEOUT_SECONDS = 8.0
#: No first token from the model in this long: try the next region.
LLM_FIRST_TOKEN_SECONDS = 5.0


def cascade_enabled() -> bool:
    """`VOBIZ_ENGINE=cascade`. Anything else keeps Gemini Live."""
    return os.environ.get("VOBIZ_ENGINE", "").strip().lower() == "cascade"


@dataclass(frozen=True)
class CascadeConfig:
    tts_model: str = "bulbul:v4-flash"
    tts_speaker: str = "neha_en_customer"
    tts_language: str = "en-IN"
    #: Hindi is spoken only when this is on AND the reply is in Devanagari.
    #: Off until Hindi generation and recognition are verified on the phone path.
    hindi: bool = False
    stt_model: str = "saaras:v3-realtime"
    stt_language: str = "en-IN"
    stt_mode: str = "transcribe"
    #: End-of-utterance silence for Sarvam's VAD. Its default is 500 ms.
    stt_silence_ms: int = 500
    llm_model: str = "gemini-2.5-flash"
    #: `global` first: on 2026-10-11 asia-south1 timed out (no first token in
    #: 5 s) on half of all replies for over an hour while `global` answered in
    #: 0.4-0.9 s. Same residency position as the Gemini Live engine (global).
    llm_location: str = "global"
    llm_fallback_locations: tuple[str, ...] = ("asia-south1",)

    @classmethod
    def from_env(cls) -> CascadeConfig:
        hindi = os.environ.get("VOBIZ_CASCADE_HINDI", "").strip().lower() in ("1", "true", "yes")
        return cls(
            tts_model=os.environ.get("VOBIZ_CASCADE_TTS_MODEL", cls.tts_model),
            tts_speaker=os.environ.get("VOBIZ_CASCADE_TTS_SPEAKER", cls.tts_speaker),
            hindi=hindi,
            stt_language=os.environ.get(
                "VOBIZ_CASCADE_STT_LANGUAGE", "auto" if hindi else cls.stt_language
            ),
            stt_mode=os.environ.get("VOBIZ_CASCADE_STT_MODE", cls.stt_mode),
            llm_model=os.environ.get("VOBIZ_CASCADE_LLM_MODEL", cls.llm_model),
            llm_location=os.environ.get("VOBIZ_CASCADE_LLM_LOCATION", cls.llm_location),
        )


# ---- sentence splitting ----------------------------------------------------

_SENTENCE_END = re.compile(r"(?<=[.!?।])\s+")
#: Don't send a fragment this short to TTS on its own; it sounds clipped.
_MIN_SENTENCE_CHARS = 12
_MARKUP = re.compile(r"[*_#`>]+|<<<|>>>|\[[^\]]*\]")


def split_sentences(buffer: str) -> tuple[list[str], str]:
    """Complete sentences from a streaming text buffer, plus the remainder."""
    parts = _SENTENCE_END.split(buffer)
    if len(parts) <= 1:
        return [], buffer
    done, rest = parts[:-1], parts[-1]
    out: list[str] = []
    carry = ""
    for p in done:
        carry = f"{carry} {p}".strip()
        if len(carry) >= _MIN_SENTENCE_CHARS:
            out.append(carry)
            carry = ""
    if carry:
        rest = f"{carry} {rest}".strip()
    return out, rest


def clean_for_speech(text: str) -> str:
    return re.sub(r"\s+", " ", _MARKUP.sub("", text)).strip(" …")


def speech_language(text: str, cfg: CascadeConfig) -> str:
    if cfg.hindi and re.search(r"[ऀ-ॿ]", text):
        return "hi-IN"
    return cfg.tts_language


#: Short replies that are acknowledgements, not a new turn. Said while VIDYA
#: talks they must not cancel her (the bridge's barge-in already resumes her
#: after a "haan"; the engine must not undo that by starting a new reply).
_BACKCHANNEL = re.compile(
    r"^\W*(haan|han|haa|ji|haan ji|hmm+|hm|achha|acha|accha|ok|okay|yes|yeah|right|"
    r"theek hai|thik hai|हाँ|हां|जी|अच्छा|ठीक है)\W*$",
    re.IGNORECASE,
)


#: Spoken when the model could not be reached at all for a turn.
_SAY_AGAIN = {
    "English": "Sorry, I didn't catch that properly. Could you please say that again?",
    "Hindi": "माफ़ कीजिए, मैं ठीक से सुन नहीं पाई। क्या आप फिर से बता सकते हैं?",
}

#: Said to the model when a lookup came back and it produced no words.
_ANSWER_NOW = (
    "You have just received the lookup result above. Tell the parent the answer now, "
    "in one or two short sentences, using only what the result says. If it says the "
    "information is unavailable, say so and offer a teacher callback."
)


def closing_line(language: str) -> str:
    """The school's reviewed closing line (call_prompts.json `thanks`)."""
    from pathlib import Path

    prompts = json.loads((Path(__file__).parent / "call_prompts.json").read_text(encoding="utf-8"))
    code = "hi-IN" if language == "Hindi" else "en-IN"
    return str(prompts.get(code, prompts["en-IN"])["thanks"])


def is_backchannel(text: str) -> bool:
    return bool(_BACKCHANNEL.match(text.strip()))


# ---- pluggable parts (real implementations below; fakes in tests) ---------


class SpeechToText(Protocol):
    async def start(self, on_event: Callable[[dict[str, Any]], Awaitable[None]]) -> None: ...
    async def send(self, pcm16k: bytes) -> None: ...
    async def close(self) -> None: ...


class TextToSpeech(Protocol):
    def stream(self, text: str, language: str) -> AsyncIterator[bytes]: ...
    async def close(self) -> None: ...


class Reasoner(Protocol):
    def stream(self, history: list[Any], note: str = "") -> AsyncIterator[Any]:
        """Yield chunks with `.text` (str|None) and `.function_calls` (list).

        `note` is appended to the system instruction for this generation only:
        the call's current state and reply language.
        """
        ...


_ASKS_FOR_HINDI = re.compile(r"\bhindi\b|हिंदी|हिन्दी", re.IGNORECASE)
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")


# ---- the session ------------------------------------------------------------


def _msg(**kw: Any) -> SimpleNamespace:
    fields = {
        "data": None,
        "server_content": None,
        "tool_call": None,
        "tool_call_cancellation": None,
    }
    fields.update(kw)
    return SimpleNamespace(**fields)


def _content(**kw: Any) -> SimpleNamespace:
    fields = {
        "interrupted": False,
        "turn_complete": False,
        "input_transcription": None,
        "output_transcription": None,
    }
    fields.update(kw)
    return SimpleNamespace(**fields)


@dataclass
class _Turn:
    task: asyncio.Task[None] | None = None
    spoken: list[str] = field(default_factory=list)


class CascadeSession:
    """One call's cascaded conversation. See the module docstring."""

    def __init__(
        self, cfg: CascadeConfig, stt: SpeechToText, tts: TextToSpeech, llm: Reasoner
    ) -> None:
        self.cfg = cfg
        self._stt, self._tts, self._llm = stt, tts, llm
        self._out: asyncio.Queue[SimpleNamespace | None] = asyncio.Queue()
        self._history: list[Any] = []
        self._turn: _Turn | None = None
        self._tool_waiters: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._closed = False
        self._call_seq = 0
        # metrics
        #: Reply language. English until the PARENT speaks Hindi or asks for it;
        #: never the model's own choice. On the first staging run the model
        #: opened an English call in Hindi because a prompt section allowed it.
        self.language = "English"
        #: The bridge's view of the call (introduced? identity? message
        #: delivered?), refreshed before each reply via set_context_note().
        self._context_note = ""
        #: What the parent actually heard of a reply cut off by the bridge's
        #: barge-in (from the bridge's played-audio share), if known.
        self._pending_heard: str | None = None
        #: History index of the last "[the parent interrupted here]" entry.
        self._interrupt_entry: int | None = None
        self.turns = 0
        self.first_audio_ms: list[float] = []
        #: Per reply: model first token, and TTS first byte per sentence (ms).
        self.llm_first_token_ms: list[float] = []
        self.empty_after_tool = 0
        self.failed_turns = 0
        self.tts_first_byte_ms: list[float] = []
        self.stt_finals = 0
        self.backchannels_ignored = 0

    # -- lifecycle --

    async def start(self) -> None:
        await self._stt.start(self._on_stt)

    async def close(self) -> None:
        self._closed = True
        await self._cancel_turn(emit=False)
        with contextlib.suppress(Exception):
            await self._stt.close()
        with contextlib.suppress(Exception):
            await self._tts.close()
        self._out.put_nowait(None)

    # -- the ConversationSession surface --

    def receive(self) -> AsyncIterator[Any]:
        async def gen() -> AsyncIterator[Any]:
            while True:
                m = await self._out.get()
                if m is None:
                    self._out.put_nowait(None)  # stay closed for the next call
                    return
                yield m
                sc = m.server_content
                if sc is not None and (sc.turn_complete or sc.interrupted):
                    return

        return gen()

    async def send_realtime_input(self, *, audio: Any) -> None:
        data = getattr(audio, "data", None)
        if data and not self._closed:
            await self._stt.send(data)

    async def send_client_content(self, *, turns: Any, turn_complete: bool = True) -> None:  # noqa: ARG002
        text = " ".join(
            p.text for p in (getattr(turns, "parts", None) or []) if getattr(p, "text", None)
        )
        if not text:
            return
        await self._user_turn(text)

    async def send_tool_response(self, *, function_responses: Any) -> None:
        responses = (
            function_responses if isinstance(function_responses, list) else [function_responses]
        )
        for fr in responses:
            fut = self._tool_waiters.pop(getattr(fr, "id", "") or "", None)
            if fut is not None and not fut.done():
                fut.set_result(dict(getattr(fr, "response", None) or {}))

    def set_context_note(self, note: str) -> None:
        """The bridge's call state, carried into the next generation."""
        self._context_note = note.strip()

    def _note(self) -> str:
        if self.language == "Hindi":
            lang = (
                "REPLY LANGUAGE NOW: Hindi. The parent switched to Hindi; reply in "
                "simple spoken Hindi in Devanagari script."
            )
        else:
            lang = (
                "REPLY LANGUAGE NOW: English. Reply ONLY in English (Latin script) "
                "unless the parent has spoken Hindi or asked for Hindi."
            )
        return f"{lang}\n{self._context_note}".strip()

    def _maybe_switch_language(self, text: str, detected: str | None) -> None:
        if not self.cfg.hindi or self.language == "Hindi":
            return
        if (
            (detected or "").startswith("hi")
            or _DEVANAGARI.search(text)
            or _ASKS_FOR_HINDI.search(text)
        ):
            self.language = "Hindi"
            log.info("telephony.cascade_language", language="Hindi")

    @property
    def busy(self) -> bool:
        """A reply is being generated, looked up or spoken."""
        return self._speaking()

    def cancel_response(self, heard: str | None = None) -> None:
        """The bridge confirmed a barge-in. Stop now; the reply is abandoned.

        `heard` is what the parent actually heard of it (the bridge knows how
        much audio was played; this engine only knows what it synthesised).
        """
        self._pending_heard = heard
        if self._turn is not None and self._turn.task is not None and not self._turn.task.done():
            asyncio.get_running_loop().create_task(self._cancel_turn(emit=True))

    def note_heard(self, heard: str) -> None:
        """Correct the model's memory of a cut-off reply to what was heard.

        On staging the parent heard "Certainly. Ms. Test Teacher..." but the
        engine had started synthesising the whole first sentence of the message,
        remembered it as said, and resumed AFTER it: the concern itself was
        never spoken.
        """
        if self._speaking():
            self._pending_heard = heard
            return
        if self._interrupt_entry is not None and self._interrupt_entry < len(self._history):
            self._history[self._interrupt_entry] = _interrupted_model(heard)

    # -- speech recognition events --

    async def _on_stt(self, event: dict[str, Any]) -> None:
        kind = event.get("event")
        if kind != "transcript.final":
            return
        text = (event.get("text") or "").strip()
        if not text:
            return
        self.stt_finals += 1
        self._maybe_switch_language(text, event.get("language"))
        # The bridge records the parent's words from this, exactly as from Live.
        self._out.put_nowait(
            _msg(server_content=_content(input_transcription=SimpleNamespace(text=text)))
        )
        if self._speaking() and is_backchannel(text):
            # "haan" while VIDYA talks: heard, recorded, not a new turn.
            self.backchannels_ignored += 1
            self._history.append(_user(text))
            return
        await self._user_turn(text)

    def _speaking(self) -> bool:
        return self._turn is not None and self._turn.task is not None and not self._turn.task.done()

    # -- turns --

    async def _user_turn(self, text: str) -> None:
        if self._speaking():
            await self._cancel_turn(emit=True)
        self._history.append(_user(text))
        turn = _Turn()
        self._turn = turn
        turn.task = asyncio.get_running_loop().create_task(self._respond(turn))

    async def _cancel_turn(self, *, emit: bool) -> None:
        turn, self._turn = self._turn, None
        if turn is None or turn.task is None:
            return
        if not turn.task.done():
            turn.task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await turn.task
            for call_id, fut in list(self._tool_waiters.items()):
                if not fut.done():
                    fut.cancel()
                self._tool_waiters.pop(call_id, None)
            # The model's memory holds what was actually HEARD, then the cut.
            heard = self._pending_heard
            self._pending_heard = None
            said = heard if heard is not None else " ".join(turn.spoken)
            self._interrupt_entry = len(self._history)
            self._history.append(_interrupted_model(said))
            if emit:
                self._out.put_nowait(_msg(server_content=_content(interrupted=True)))

    async def _respond(self, turn: _Turn) -> None:
        self.turns += 1
        started = time.monotonic()
        first_audio = True
        after_tool = False
        try:
            while True:
                text_parts, calls, first_audio = await self._generate(turn, started, first_audio)
                if after_tool and not calls and not "".join(text_parts).strip():
                    # Staging run 3: the attendance lookup returned data and the
                    # model said nothing at all; the silence nudge then asked
                    # "any other questions?" and the answer was never given.
                    self.empty_after_tool += 1
                    log.warning("telephony.cascade_empty_reply_after_tool")
                    text_parts, calls, first_audio = await self._generate(
                        turn, started, first_audio, extra=_ANSWER_NOW
                    )
                after_tool = False
                if any(c.name == "end_call" for c in calls) and not turn.spoken:
                    # The text model often calls end_call without saying
                    # anything (staging run 2: no goodbye at all). The parent
                    # must hear one complete goodbye: the school's own line.
                    line = closing_line(self.language)
                    first_audio = await self._speak(turn, line, started, first_audio)
                    text_parts.append(line)
                self._history.append(_model("".join(text_parts), calls))
                if not calls:
                    break
                responses = await self._run_tools(calls)
                self._history.append(_function_responses(responses))
                after_tool = True
                if any(c.name == "end_call" for c in calls):
                    # The goodbye has been said; asking the model to continue
                    # after end_call produced a second goodbye in testing.
                    break
            self._out.put_nowait(_msg(server_content=_content(turn_complete=True)))
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — a failed turn must not kill the call
            log.error(
                "telephony.cascade_turn_failed", error_type=type(exc).__name__, error=str(exc)[:200]
            )
            self.failed_turns += 1
            # Never leave the parent in silence: ask them to say it again. The
            # model was unreachable, so this is a fixed line, not generated.
            with contextlib.suppress(Exception):
                await self._speak(turn, _SAY_AGAIN[self.language], started, first_audio)
            self._out.put_nowait(_msg(server_content=_content(turn_complete=True)))
        finally:
            if self._turn is turn:
                self._turn = None

    async def _generate(
        self, turn: _Turn, started: float, first_audio: bool, *, extra: str = ""
    ) -> tuple[list[str], list[Any], bool]:
        """One model generation: speak sentences as they complete, collect calls."""
        text_parts: list[str] = []
        calls: list[Any] = []
        buffer = ""
        asked = time.monotonic()
        got_first = False
        note = f"{self._note()}\n{extra}".strip()
        async for chunk in self._llm.stream(self._history, note):
            if not got_first:
                got_first = True
                self.llm_first_token_ms.append((time.monotonic() - asked) * 1000)
            if getattr(chunk, "text", None):
                buffer += chunk.text
                text_parts.append(chunk.text)
                sentences, buffer = split_sentences(buffer)
                for s in sentences:
                    first_audio = await self._speak(turn, s, started, first_audio)
            calls.extend(getattr(chunk, "function_calls", None) or [])
        if buffer.strip():
            first_audio = await self._speak(turn, buffer, started, first_audio)
        return text_parts, calls, first_audio

    async def _speak(self, turn: _Turn, sentence: str, started: float, first: bool) -> bool:
        text = clean_for_speech(sentence)
        if not text:
            return first
        language = speech_language(text, self.cfg)
        announced = False
        carry = b""
        requested = time.monotonic()
        async for audio in self._tts.stream(text, language):
            if not announced:
                self.tts_first_byte_ms.append((time.monotonic() - requested) * 1000)
                # Transcribe a sentence when its audio starts, not before: the
                # transcript must follow what the parent can hear.
                announced = True
                turn.spoken.append(text)
                self._out.put_nowait(
                    _msg(
                        server_content=_content(
                            output_transcription=SimpleNamespace(text=f" {text}")
                        )
                    )
                )
                if first:
                    self.first_audio_ms.append((time.monotonic() - started) * 1000)
                    first = False
            data = carry + audio
            even = len(data) - (len(data) % 2)
            carry = data[even:]
            if even:
                self._out.put_nowait(_msg(data=data[:even]))
        return first

    async def _run_tools(self, calls: list[Any]) -> list[tuple[Any, dict[str, Any]]]:
        """Hand the calls to the bridge (which owns every tool) and wait."""
        loop = asyncio.get_running_loop()
        waiting: list[tuple[Any, asyncio.Future[dict[str, Any]]]] = []
        fcs = []
        for c in calls:
            self._call_seq += 1
            call_id = getattr(c, "id", None) or f"cascade-{self._call_seq}"
            fut: asyncio.Future[dict[str, Any]] = loop.create_future()
            self._tool_waiters[call_id] = fut
            waiting.append((c, fut))
            fcs.append(SimpleNamespace(id=call_id, name=c.name, args=dict(c.args or {})))
        self._out.put_nowait(_msg(tool_call=SimpleNamespace(function_calls=fcs)))
        results = []
        for c, fut in waiting:
            try:
                results.append((c, await asyncio.wait_for(fut, timeout=TOOL_TIMEOUT_SECONDS)))
            except TimeoutError:
                results.append((c, {"status": "no_response"}))
        return results


def _user(text: str) -> Any:
    from google.genai import types as t

    return t.Content(role="user", parts=[t.Part(text=text)])


def _interrupted_model(heard: str) -> Any:
    heard = heard.strip(" …")
    return _model(
        f"{heard} … [the parent interrupted here; only the words before this were heard]"
        if heard
        else "[the parent interrupted before hearing anything of my reply]"
    )


def _model(text: str, calls: list[Any] | None = None) -> Any:
    from google.genai import types as t

    parts = [t.Part(text=text)] if text else []
    for c in calls or []:
        parts.append(t.Part(function_call=t.FunctionCall(name=c.name, args=dict(c.args or {}))))
    return t.Content(role="model", parts=parts or [t.Part(text="")])


def _function_responses(results: list[tuple[Any, dict[str, Any]]]) -> Any:
    from google.genai import types as t

    return t.Content(
        role="user",
        parts=[
            t.Part(function_response=t.FunctionResponse(name=c.name, response=r))
            for c, r in results
        ],
    )


# ---- real implementations ---------------------------------------------------


class SarvamStt:
    """Sarvam `saaras` realtime WebSocket. Audio in, VAD + transcripts out."""

    def __init__(self, key: str, cfg: CascadeConfig) -> None:
        self._key, self._cfg = key, cfg
        self._ws: Any = None
        self._reader: asyncio.Task[None] | None = None

    async def start(self, on_event: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        import websockets

        c = self._cfg
        url = (
            f"{SARVAM_STT_WS_URL}?model={c.stt_model}&language_code={c.stt_language}"
            f"&mode={c.stt_mode}&encoding=linear16&sample_rate=16000&stream_type=balanced"
            f"&silence_duration_ms={c.stt_silence_ms}"
        )
        self._ws = await websockets.connect(
            url,
            additional_headers={"Api-Subscription-Key": self._key},
            open_timeout=10,
            max_size=None,
        )

        async def read() -> None:
            async for raw in self._ws:
                try:
                    event = json.loads(raw)
                except (ValueError, TypeError):
                    continue
                if event.get("event") == "error":
                    log.error(
                        "telephony.cascade_stt_error",
                        code=event.get("code"),
                        fatal=event.get("is_fatal"),
                    )
                await on_event(event)

        self._reader = asyncio.get_running_loop().create_task(read())

    async def send(self, pcm16k: bytes) -> None:
        if self._ws is not None:
            await self._ws.send(
                json.dumps({"event": "audio_input", "audio": base64.b64encode(pcm16k).decode()})
            )

    async def close(self) -> None:
        if self._reader is not None:
            self._reader.cancel()
        if self._ws is not None:
            with contextlib.suppress(Exception):
                await self._ws.close()


class SarvamTts:
    """Bulbul over the HTTP streaming endpoint: raw PCM16 @ 24 kHz chunks."""

    def __init__(self, key: str, cfg: CascadeConfig) -> None:
        import httpx

        self._cfg = cfg
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0), headers={"api-subscription-key": key}
        )

    async def stream(self, text: str, language: str) -> AsyncIterator[bytes]:
        body = {
            "text": text,
            "target_language_code": language,
            "speaker": self._cfg.tts_speaker,
            "model": self._cfg.tts_model,
            "speech_sample_rate": 24000,
            "output_audio_codec": "linear16",
        }
        async with self._client.stream("POST", SARVAM_TTS_STREAM_URL, json=body) as r:
            if r.status_code != 200:
                detail = (await r.aread())[:200]
                raise RuntimeError(f"tts {r.status_code}: {detail!r}")
            async for chunk in r.aiter_bytes():
                if chunk:
                    yield chunk

    async def close(self) -> None:
        await self._client.aclose()


class GeminiReasoner:
    """Gemini text generation with the bridge's own system prompt and tools."""

    def __init__(
        self, cfg: CascadeConfig, project: str, system_instruction: Any, tools: Any
    ) -> None:
        from google import genai
        from google.genai import types as t

        # Primary region, then `global`. Staging run 5: asia-south1 answered
        # 429 RESOURCE_EXHAUSTED for minutes, with 16-23 s to a first token.
        locations = list(dict.fromkeys([cfg.llm_location, *cfg.llm_fallback_locations]))
        self._clients = [
            (loc, genai.Client(vertexai=True, project=project, location=loc)) for loc in locations
        ]
        self.fallbacks = 0
        parts = getattr(system_instruction, "parts", None) or []
        self._system_text = "\n".join(p.text for p in parts if getattr(p, "text", None))
        self._model = cfg.llm_model
        self._config = t.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.6,
            thinking_config=t.ThinkingConfig(thinking_budget=0),
            automatic_function_calling=t.AutomaticFunctionCallingConfig(disable=True),
        )

    async def stream(self, history: list[Any], note: str = "") -> AsyncIterator[Any]:
        config = self._config
        if note:
            from google.genai import types as t

            base = self._system_text
            config = self._config.model_copy(
                update={"system_instruction": t.Content(parts=[t.Part(text=f"{base}\n\n{note}")])}
            )
        last: Exception | None = None
        for location, client in self._clients:
            try:
                resp = await asyncio.wait_for(
                    client.aio.models.generate_content_stream(
                        model=self._model, contents=list(history), config=config
                    ),
                    timeout=LLM_FIRST_TOKEN_SECONDS,
                )
                chunks = resp.__aiter__()
                first = await asyncio.wait_for(chunks.__anext__(), timeout=LLM_FIRST_TOKEN_SECONDS)
            except StopAsyncIteration:
                return
            except Exception as exc:  # noqa: BLE001 — 429/5xx/timeout: try the next region
                last = exc
                self.fallbacks += 1
                log.warning(
                    "telephony.cascade_llm_fallback",
                    location=location,
                    error_type=type(exc).__name__,
                    error=str(exc)[:120],
                )
                continue
            yield _chunk(first)
            async for chunk in chunks:
                yield _chunk(chunk)
            return
        raise last if last is not None else RuntimeError("no model location answered")


def _chunk(chunk: Any) -> SimpleNamespace:
    text = None
    with contextlib.suppress(Exception):
        text = chunk.text
    return SimpleNamespace(text=text, function_calls=chunk.function_calls or [])


@contextlib.asynccontextmanager
async def open_cascade(
    cfg: CascadeConfig, *, project: str, system_instruction: Any, tools: Any
) -> AsyncIterator[CascadeSession]:
    """The cascade as an async context manager, like `client.aio.live.connect`."""
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    if not key:
        raise RuntimeError("SARVAM_API_KEY is not configured")
    session = CascadeSession(
        cfg,
        SarvamStt(key, cfg),
        SarvamTts(key, cfg),
        GeminiReasoner(cfg, project, system_instruction, tools),
    )
    await session.start()
    try:
        yield session
    finally:
        await session.close()
        log.info(
            "telephony.cascade_closed",
            turns=session.turns,
            stt_finals=session.stt_finals,
            backchannels_ignored=session.backchannels_ignored,
            first_audio_ms=[round(x) for x in session.first_audio_ms][:12],
            llm_first_token_ms=[round(x) for x in session.llm_first_token_ms][:12],
            tts_first_byte_ms=[round(x) for x in session.tts_first_byte_ms][:16],
            language=session.language,
            empty_after_tool=session.empty_after_tool,
            failed_turns=session.failed_turns,
            llm_fallbacks=getattr(session._llm, "fallbacks", 0),
            tts_model=cfg.tts_model,
            tts_speaker=cfg.tts_speaker,
        )
