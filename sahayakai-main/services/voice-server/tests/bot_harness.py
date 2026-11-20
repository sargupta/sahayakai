"""Drive the real bot.py / main.py wiring with pipecat and the SDKs stubbed out.

bot.py imports pipecat, loguru and the provider SDKs, none of which are
installed in CI (the job installs pytest only). Pure-module tests prove the
policy; these stand-ins let a test run the actual `create_bot` and see every
argument it hands to a pipecat object — the LLM settings, every message added
to the model context, every frame queued on the task — so a sentinel check
covers the wiring itself, not a copy of it.

Every stand-in records its constructor and method calls in RECORDER. Nothing
here talks to a network.

Also used by golden/make_positive_golden.py against the pre-change source tree,
which is why it tolerates both `create_bot` return shapes.
"""

from __future__ import annotations

import asyncio
import contextlib
import enum
import sys
import types
from dataclasses import dataclass, field
from importlib.abc import Loader, MetaPathFinder
from importlib.machinery import ModuleSpec
from typing import Any, Iterator


# The other side's files the contract tests read. One list: the GitHub
# workflow triggers, the Cloud Build upload allowlist and the tests all follow
# it (tests/test_contract_wiring.py).
CONTRACT_FILES = (
    "sahayakai-main/src/__tests__/lib/call-suppression.test.ts",
    "sahayakai-agents/tests/unit/test_telephony_opt_out_persistence.py",
    "sahayakai-main/src/locales/call-scripts/request-to-talk.json",
)
REQUIRE_MONOREPO_ENV = "VOICE_SERVER_REQUIRE_MONOREPO"
REQUIRE_CONTRACT_FILES_ENV = "VOICE_SERVER_REQUIRE_CONTRACT_FILES"


def contract_file_or_skip(relative: str):
    """The path of a contract file, or skip (or fail, when CI says it must be there).

    In GitHub Actions and the Cloud Build test step VOICE_SERVER_REQUIRE_MONOREPO=1,
    so a missing monorepo is a failure, not a silent skip. A file the other
    side has not merged yet still skips, unless VOICE_SERVER_REQUIRE_CONTRACT_FILES=1.
    """
    import os

    import pytest

    root = monorepo_root()
    if root is None:
        if os.environ.get(REQUIRE_MONOREPO_ENV) == "1":
            pytest.fail("the monorepo is required here but this service was copied out of it")
        pytest.skip("this service was copied out of the monorepo")
    path = root / relative
    if not path.exists():
        if os.environ.get(REQUIRE_CONTRACT_FILES_ENV) == "1":
            pytest.fail(f"{relative} is required but missing")
        pytest.skip(f"{relative} is not on this branch yet; the check runs once it is")
    return path


def monorepo_root():
    """The repository root when this service sits in its usual place in the monorepo.

    None when the service directory was copied out on its own (Cloud Build
    uploads only services/voice-server), so cross-repo checks can skip.
    """
    from pathlib import Path

    here = Path(__file__).resolve().parent  # .../sahayakai-main/services/voice-server/tests
    for candidate in here.parents:
        if (candidate / "sahayakai-main" / "services" / "voice-server").is_dir():
            return candidate
    return None


STUBBED_ROOTS = ("pipecat", "loguru", "httpx", "fastapi", "uvicorn")
# Not installed in CI, so they must not be importable locally either.
BLOCKED_ROOTS = ("google", "dotenv", "numpy")


class Recorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, tuple, dict]] = []
        self.instances: list[Any] = []

    def add(self, name: str, args: tuple, kwargs: dict) -> None:
        self.calls.append((name, args, kwargs))

    def named(self, name: str) -> list[tuple[str, tuple, dict]]:
        return [c for c in self.calls if c[0] == name]

    def instances_of(self, cls_name: str) -> list[Any]:
        return [i for i in self.instances if type(i).__name__ == cls_name]

    def clear(self) -> None:
        self.calls.clear()
        self.instances.clear()


RECORDER = Recorder()


class _Result:
    """Return value of any stub method: awaitable, usable as a decorator, chainable."""

    def __init__(self, name: str) -> None:
        self._name = name

    def __await__(self):
        if False:  # pragma: no cover — makes this a generator
            yield
        return None

    def __call__(self, *args, **kwargs):
        if len(args) == 1 and callable(args[0]) and not kwargs:
            return args[0]
        RECORDER.add(f"{self._name}()", args, kwargs)
        return _Result(f"{self._name}()")

    def __getattr__(self, name: str):
        if name.startswith("__"):
            raise AttributeError(name)
        return _Result(f"{self._name}.{name}")


class _StubMeta(type):
    def __getattr__(cls, name: str):
        # Class attributes such as `SarvamSTTService.Settings` become stub classes.
        if name.startswith("__"):
            raise AttributeError(name)
        sub = _StubMeta(name, (Stub,), {"_qual": f"{cls._qual}.{name}"})
        setattr(cls, name, sub)
        return sub


class Stub(metaclass=_StubMeta):
    _qual = "Stub"

    def __init__(self, *args, **kwargs) -> None:
        self._args = args
        self._kwargs = kwargs
        RECORDER.add(type(self)._qual, args, kwargs)
        RECORDER.instances.append(self)

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        return _Result(f"{type(self)._qual}.{name}")


def _stub_class(qual: str) -> type:
    return _StubMeta(qual.rsplit(".", 1)[-1], (Stub,), {"_qual": qual})


# ── Frames and processors: real minimal classes, because our code subclasses
# and isinstance-checks them. ─────────────────────────────────────────────────


class Frame:
    def __init__(self, *args, **kwargs) -> None:
        self.args = args
        self.text = kwargs.pop("text", args[0] if args else None)
        for key, value in kwargs.items():
            setattr(self, key, value)
        RECORDER.add(type(self).__name__, args, {"text": self.text, **kwargs})

    def __repr__(self) -> str:
        return f"{type(self).__name__}(text={self.text!r})"


class TextFrame(Frame):
    pass


class TTSSpeakFrame(Frame):
    pass


class EndFrame(Frame):
    pass


class EndTaskFrame(Frame):
    pass


class CancelFrame(Frame):
    pass


class LLMTextFrame(TextFrame):
    pass


class TranscriptionFrame(TextFrame):
    pass


class InterimTranscriptionFrame(TextFrame):
    pass


class LLMFullResponseStartFrame(Frame):
    pass


class LLMFullResponseEndFrame(Frame):
    pass


class LLMContextFrame(Frame):
    pass


class FrameDirection(enum.Enum):
    DOWNSTREAM = 1
    UPSTREAM = 2


class FrameProcessor:
    def __init__(self, **kwargs) -> None:
        self.pushed: list[tuple[Any, FrameDirection]] = []

    async def process_frame(self, frame, direction) -> None:
        return None

    async def push_frame(self, frame, direction=FrameDirection.DOWNSTREAM) -> None:
        self.pushed.append((frame, direction))


class LLMContext:
    def __init__(self, messages=None, *args, **kwargs) -> None:
        self.messages = list(messages or [])
        RECORDER.add("LLMContext", args, kwargs)
        RECORDER.instances.append(self)

    def add_message(self, message) -> None:
        RECORDER.add("LLMContext.add_message", (message,), {})
        self.messages.append(message)

    def get_messages(self):
        return list(self.messages)


class FastAPIWebsocketTransport(Stub):
    _qual = "FastAPIWebsocketTransport"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.handlers: dict[str, Any] = {}

    def event_handler(self, name: str):
        def register(fn):
            self.handlers[name] = fn
            return fn

        return register


class Pipeline(Stub):
    _qual = "Pipeline"

    def __init__(self, processors, *args, **kwargs) -> None:
        super().__init__(processors, *args, **kwargs)
        self.processors = list(processors)
        self.task = None

    async def queue_frame(self, frame, direction=None) -> None:
        """A frame injected straight into the pipeline (pipecat: skips the task's push queue)."""
        RECORDER.add("Pipeline.queue_frame", (frame,), {})
        if isinstance(frame, CancelFrame) and self.task is not None:
            self.task.end_reason = self.task.end_reason or "CancelFrame injected into the pipeline"


class PipelineTask(Stub):
    _qual = "PipelineTask"

    def __init__(self, pipeline, *args, **kwargs) -> None:
        super().__init__(pipeline, *args, **kwargs)
        self.pipeline = pipeline
        if isinstance(pipeline, Pipeline):
            pipeline.task = self
        self.queued: list[Any] = []

    # How the task ends, modelled on pipecat (see ModelRunner):
    #   an EndFrame queued at the source, or an EndTaskFrame pushed UPSTREAM to
    #   the task, ends it; an EndFrame pushed downstream from mid-pipeline does
    #   not. With `stall_end` set, the graceful end never completes (a
    #   processor hangs on the EndFrame), and task.cancel() then queues behind
    #   it and does nothing; only a CancelFrame injected into the pipeline ends it.
    end_reason: str | None = None
    stall_end = False
    end_in_flight = False

    def request_end(self, reason: str) -> None:
        if self.stall_end:
            self.end_in_flight = True
            return
        self.end_reason = self.end_reason or reason

    async def queue_frames(self, frames) -> None:
        frames = list(frames)
        RECORDER.add("PipelineTask.queue_frames", (frames,), {})
        self.queued.extend(frames)
        if any(isinstance(f, EndFrame) for f in frames):
            self.request_end("EndFrame queued at the source")

    # The pipeline never really runs here, so it never finishes on its own.
    finished = False
    cancelled_at: float | None = None

    def has_finished(self) -> bool:
        return self.finished

    async def cancel(self, *, reason=None) -> None:
        RECORDER.add("PipelineTask.cancel", (), {"reason": reason})
        if self.cancelled_at is None:
            self.cancelled_at = asyncio.get_running_loop().time()
        if not self.end_in_flight:  # pipecat: a CancelFrame queued behind a stuck EndFrame never runs
            self.end_reason = self.end_reason or "cancel"


class _Logger:
    """loguru stand-in. Keeps every record, so a test can read what would be logged."""

    LEVELS = ("trace", "debug", "info", "success", "warning", "error", "critical", "exception")

    def __init__(self) -> None:
        self.records: list[tuple[str, str]] = []
        self.config_calls: list[tuple[str, tuple, dict]] = []

    def clear(self) -> None:
        self.records.clear()
        self.config_calls.clear()

    def remove(self, *args, **kwargs) -> None:
        self.config_calls.append(("remove", args, kwargs))

    def add(self, *args, **kwargs) -> int:
        self.config_calls.append(("add", args, kwargs))
        return 1

    def __getattr__(self, name: str):
        level = name.upper() if name in self.LEVELS else None

        def log(message="", *args, **kwargs):
            if level:
                self.records.append((level, message if isinstance(message, str) else str(message)))

        return log


LOGGER = _Logger()


_SPECIFIC: dict[str, dict[str, Any]] = {
    "pipecat.frames.frames": {
        c.__name__: c
        for c in (
            Frame, TextFrame, TTSSpeakFrame, EndFrame, EndTaskFrame, CancelFrame, LLMTextFrame, TranscriptionFrame,
            InterimTranscriptionFrame, LLMFullResponseStartFrame, LLMFullResponseEndFrame,
            LLMContextFrame,
        )
    },
    "pipecat.processors.frame_processor": {
        "FrameProcessor": FrameProcessor,
        "FrameDirection": FrameDirection,
    },
    "pipecat.processors.aggregators.llm_context": {"LLMContext": LLMContext},
    "pipecat.transports.websocket.fastapi": {
        "FastAPIWebsocketTransport": FastAPIWebsocketTransport,
    },
    "pipecat.pipeline.pipeline": {"Pipeline": Pipeline},
    "pipecat.pipeline.task": {"PipelineTask": PipelineTask},
    "loguru": {"logger": LOGGER},
    # main.py catches it, so it must be a real exception class.
    "fastapi": {"WebSocketDisconnect": type("WebSocketDisconnect", (Exception,), {})},
    "httpx": {},  # AsyncClient filled in below
    "uvicorn.config": {"LOGGING_CONFIG": None},  # filled in below
}

# The shape of uvicorn.config.LOGGING_CONFIG (uvicorn 0.46), with stdlib
# formatters so it can be applied without uvicorn installed.
UVICORN_LOGGING_CONFIG: dict = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(levelname)s: %(message)s"},
        "access": {"format": "%(levelname)s: %(message)s"},
    },
    "handlers": {
        "default": {"formatter": "default", "class": "logging.StreamHandler", "stream": "ext://sys.stderr"},
        "access": {"formatter": "access", "class": "logging.StreamHandler", "stream": "ext://sys.stdout"},
    },
    "loggers": {
        "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
    },
}
_SPECIFIC["uvicorn.config"]["LOGGING_CONFIG"] = UVICORN_LOGGING_CONFIG


class FakeHttpxClient:
    """httpx.AsyncClient stand-in: records every request; nothing leaves the process."""

    def __init__(self, *args, **kwargs) -> None:
        RECORDER.add("httpx.AsyncClient", args, kwargs)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc) -> None:
        return None

    async def _request(self, method: str, url: str, **kwargs):
        RECORDER.add(f"httpx.{method}", (url,), {k: v for k, v in kwargs.items() if k != "auth"})
        return types.SimpleNamespace(status_code=200, text="", json=lambda: {})

    async def delete(self, url, **kwargs):
        return await self._request("DELETE", url, **kwargs)

    async def get(self, url, **kwargs):
        return await self._request("GET", url, **kwargs)

    async def post(self, url, **kwargs):
        return await self._request("POST", url, **kwargs)


_SPECIFIC["httpx"]["AsyncClient"] = FakeHttpxClient


def _root(name: str) -> str:
    return name.split(".", 1)[0]


class _StubFinder(MetaPathFinder, Loader):
    def find_spec(self, fullname, path=None, target=None):
        root = _root(fullname)
        if root in BLOCKED_ROOTS:
            raise ModuleNotFoundError(f"{fullname} is not available to the unit tests")
        if root in STUBBED_ROOTS:
            return ModuleSpec(fullname, self, is_package=True)
        return None

    def create_module(self, spec):
        module = types.ModuleType(spec.name)
        module.__path__ = []
        module.__dict__.update(_SPECIFIC.get(spec.name, {}))

        def __getattr__(name: str, _module=module, _prefix=spec.name):
            if name.startswith("__"):
                raise AttributeError(name)
            cls = _stub_class(f"{_prefix}.{name}")
            setattr(_module, name, cls)
            return cls

        module.__getattr__ = __getattr__
        return module

    def exec_module(self, module) -> None:
        return None


def _owned(name: str) -> bool:
    return _root(name) in STUBBED_ROOTS + BLOCKED_ROOTS or name == "src" or name.startswith("src.")


@contextlib.contextmanager
def stubbed_runtime() -> Iterator[None]:
    """Import src.* against the stand-ins; restore sys.modules afterwards."""
    saved = {k: v for k, v in sys.modules.items() if _owned(k)}
    for key in saved:
        del sys.modules[key]
    finder = _StubFinder()
    sys.meta_path.insert(0, finder)
    RECORDER.clear()
    LOGGER.clear()
    try:
        yield
    finally:
        sys.meta_path.remove(finder)
        for key in [k for k in sys.modules if _owned(k)]:
            del sys.modules[key]
        sys.modules.update(saved)


# ── Fakes for our own collaborators ──────────────────────────────────────────


class FakeCallStore:
    """Stands in for the SQLite CallStore. Its parent history is a sentinel."""

    def __init__(self, history: str | None = None) -> None:
        self.history = history
        self.history_requests: list[str] = []
        self.created: list[tuple[str, dict]] = []
        self.completed: list[str] = []

    def create_call(self, outreach_id, call_context):
        self.created.append((outreach_id, dict(call_context)))

    def build_parent_context(self, parent_phone):
        self.history_requests.append(parent_phone)
        return self.history

    def update_transcript(self, *args, **kwargs):
        return None

    def complete_call(self, outreach_id, *args, **kwargs):
        self.completed.append(outreach_id)

    def save_insights(self, *args, **kwargs):
        return None

    def record_concerns(self, *args, **kwargs):
        return None

    def create_follow_ups(self, *args, **kwargs):
        return None


def make_config():
    from src.config import Config

    return Config(
        sarvam_api_key="test-sarvam-key",
        google_api_key="",
        sahayakai_api_url="",
        sahayakai_internal_key="",
        host="127.0.0.1",
        port=0,
        twilio_account_sid="",
        twilio_auth_token="",
        google_cloud_project="",
        request_signing_key="",
        vobiz_auth_id="",
        vobiz_auth_token="",
    )


@dataclass
class BotRun:
    task: Any
    finalize: Any
    transport: Any
    processors: list[Any]
    context: Any
    system_instruction: str
    llm_settings: dict
    stt_settings: dict
    tts_settings: dict
    seed_messages: list[Any] = field(default_factory=list)

    def processor(self, cls_name: str):
        for p in self.processors:
            if type(p).__name__ == cls_name:
                return p
        raise LookupError(cls_name)


def _kwargs_of(qual: str) -> dict:
    calls = RECORDER.named(qual)
    assert len(calls) == 1, f"expected one {qual}, got {len(calls)}"
    return dict(calls[0][2])


async def build_bot(call_context: dict, *, call_store=None, config_overrides: dict | None = None, **extra) -> BotRun:
    """Run the real create_bot against the stand-ins (inside stubbed_runtime)."""
    from dataclasses import replace

    from src import bot

    config = make_config()
    if config_overrides:
        config = replace(config, **config_overrides)
    result = await bot.create_bot(
        config,
        dict(call_context),
        object(),
        stream_sid="stream-test",
        call_sid="",
        call_store=call_store,
        **extra,
    )
    task, finalize = result if isinstance(result, tuple) else (result, None)
    return run_from_recorder(task, finalize)


def run_from_recorder(task=None, finalize=None) -> BotRun:
    """Collect the bot create_bot just built (directly, or from inside main.py)."""
    if task is None:
        tasks = RECORDER.instances_of("PipelineTask")
        assert len(tasks) == 1, f"expected one PipelineTask, got {len(tasks)}"
        task = tasks[0]
    llm_calls = RECORDER.named("pipecat.services.google.llm.GoogleLLMService.Settings") + RECORDER.named(
        "pipecat.services.google.vertex.llm.GoogleVertexLLMService.Settings"
    )
    assert len(llm_calls) == 1, f"expected one LLM settings object, got {len(llm_calls)}"
    llm = dict(llm_calls[0][2])
    contexts = [i for i in RECORDER.instances if isinstance(i, LLMContext)]
    assert len(contexts) == 1
    transports = RECORDER.instances_of("FastAPIWebsocketTransport")
    assert len(transports) == 1
    return BotRun(
        task=task,
        finalize=finalize,
        transport=transports[0],
        processors=task.pipeline.processors,
        context=contexts[0],
        system_instruction=llm["system_instruction"],
        llm_settings={k: v for k, v in llm.items() if k != "system_instruction"},
        stt_settings=_kwargs_of("pipecat.services.sarvam.stt.SarvamSTTService.Settings"),
        tts_settings=_kwargs_of("pipecat.services.sarvam.tts.SarvamTTSService.Settings"),
        seed_messages=list(contexts[0].messages),
    )


async def spoken_greeting(run: BotRun) -> str:
    """Fire on_client_connected and return the text queued for TTS."""
    original_sleep = asyncio.sleep

    async def no_wait(delay, *args, **kwargs):
        await original_sleep(0)

    asyncio.sleep = no_wait
    try:
        before = len(run.task.queued)
        await run.transport.handlers["on_client_connected"](run.transport, object())
    finally:
        asyncio.sleep = original_sleep
    frames = run.task.queued[before:]
    assert len(frames) == 1 and type(frames[0]).__name__ == "TTSSpeakFrame", frames
    return frames[0].text


async def phase_guidance(run: BotRun) -> dict[str, str]:
    """Walk the PhaseInstructor through every phase and capture what it injects.

    Leaves the instructor where it found it, so a turn driven afterwards is
    still a mid-call turn (on the last turn CallManager says the goodbye).
    """
    instructor = run.processor("PhaseInstructor")
    saved = (instructor._phase, instructor._turns_in_phase)
    captured: dict[str, str] = {}
    # opening lasts 1 turn, explore 2, advise 2, then close.
    for phase, advances_after in (("opening", 1), ("explore", 2), ("advise", 2), ("close", 0)):
        assert instructor.phase.value == phase
        ctx = LLMContext()
        await instructor.process_frame(LLMContextFrame(context=ctx), FrameDirection.DOWNSTREAM)
        assert len(ctx.messages) == 1, (phase, ctx.messages)
        captured[phase] = ctx.messages[0]["content"]
        for _ in range(advances_after):
            instructor.advance_phase()
    instructor._phase, instructor._turns_in_phase = saved
    return captured


async def ai_reveal_replacement(run: BotRun) -> tuple[str, list]:
    """Make the model 'say' an identity-revealing sentence; return the replacement and the context it added."""
    manager = run.processor("CallManager")
    before_ctx = len(run.context.messages)
    before_push = len(manager.pushed)
    await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMTextFrame(text="I am an AI model built by Google."), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)  # let the turn-sync task run
    spoken = [f for f, _ in manager.pushed[before_push:] if type(f).__name__ == "TTSSpeakFrame"]
    assert len(spoken) == 1, manager.pushed[before_push:]
    return spoken[0].text, run.context.messages[before_ctx:]


def strings_in(value: Any, _seen: set[int] | None = None) -> Iterator[str]:
    """Every string reachable from a recorded argument (dicts, lists, frames, stubs)."""
    seen = _seen if _seen is not None else set()
    if id(value) in seen:
        return
    seen.add(id(value))
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            yield from strings_in(k, seen)
            yield from strings_in(v, seen)
    elif isinstance(value, (list, tuple, set, frozenset)):
        for v in value:
            yield from strings_in(v, seen)
    elif isinstance(value, Frame):
        yield from strings_in(value.text, seen)
        yield from strings_in(value.__dict__, seen)
    elif isinstance(value, Stub):
        yield from strings_in(value._args, seen)
        yield from strings_in(value._kwargs, seen)
    elif isinstance(value, LLMContext):
        yield from strings_in(value.messages, seen)


def recorded_strings() -> list[str]:
    """Every string passed to any pipecat stand-in so far."""
    out: list[str] = []
    for _name, args, kwargs in RECORDER.calls:
        out.extend(strings_in(args))
        out.extend(strings_in(kwargs))
    return out


# ── main.py: both context paths ──────────────────────────────────────────────


class FakeWebSocket:
    """What main.py's handlers read from: query params and the provider's handshake."""

    def __init__(self, messages: list[dict], query_params: dict | None = None) -> None:
        import json as _json

        self._incoming = [_json.dumps(m) for m in messages]
        self.query_params = dict(query_params or {})
        self.closed: tuple | None = None

    async def accept(self) -> None:
        return None

    async def receive_text(self) -> str:
        if not self._incoming:
            raise RuntimeError("no more messages")
        return self._incoming.pop(0)

    async def close(self, code=None, reason=None) -> None:
        self.closed = (code, reason)


class Conflict(Exception):
    """Same names and code as google.api_core.exceptions (AlreadyExists is a Conflict, 409)."""

    code = 409


class AlreadyExists(Conflict):
    pass


class _Snapshot:
    def __init__(self, data):
        self.exists = data is not None
        self._data = data

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class _AsyncDoc:
    def __init__(self, db, collection: str, doc_id: str) -> None:
        self._db, self._key = db, (collection, doc_id)

    async def get(self):
        self._db.reads.append(self._key)
        return _Snapshot(self._db.docs.get(self._key))

    async def set(self, data, merge=False):
        if self._key[0] == "call_suppressions" and self._db.fail_suppression_sets > 0:
            self._db.fail_suppression_sets -= 1
            raise RuntimeError("simulated Firestore outage")
        self._db.writes.append(("set", *self._key, dict(data), merge))
        base = dict(self._db.docs.get(self._key) or {}) if merge else {}
        self._db.docs[self._key] = {**base, **data}

    async def create(self, data):
        """Firestore create(): atomic, refuses an existing document."""
        if self._key in self._db.docs:
            raise AlreadyExists(f"{self._key} already exists")
        self._db.writes.append(("create", *self._key, dict(data), None))
        self._db.docs[self._key] = dict(data)

    async def update(self, data):
        if "optOutRequested" in data and self._db.fail_opt_out_requests > 0:
            self._db.fail_opt_out_requests -= 1
            raise RuntimeError("simulated Firestore outage")
        if self._key not in self._db.docs:
            raise LookupError(f"{self._key} not found")
        self._db.writes.append(("update", *self._key, dict(data), None))
        self._db.docs[self._key].update(data)


class _AsyncCollection:
    def __init__(self, db, name: str) -> None:
        self._db, self._name = db, name

    def document(self, doc_id: str) -> _AsyncDoc:
        return _AsyncDoc(self._db, self._name, doc_id)


class FakeAsyncFirestore:
    """The slice of google.cloud.firestore.AsyncClient the engine uses."""

    def __init__(
        self,
        docs: dict[tuple[str, str], dict] | None = None,
        fail: Exception | None = None,
        fail_suppression_sets: int = 0,
        fail_opt_out_requests: int = 0,
    ) -> None:
        self.docs = {k: dict(v) for k, v in (docs or {}).items()}
        self.fail_suppression_sets = fail_suppression_sets
        self.fail_opt_out_requests = fail_opt_out_requests
        self.reads: list[tuple[str, str]] = []
        self.writes: list[tuple] = []
        self._fail = fail

    def collection(self, name: str) -> _AsyncCollection:
        if self._fail:
            raise self._fail
        return _AsyncCollection(self, name)


SIGNING_KEY = "unit-test-signing-key-not-a-secret"


def mint_stream_token(outreach_id: str, key: str = SIGNING_KEY, ttl: int = 300) -> str:
    """Same wire shape as the web app's mintVobizToken (see vobiz.verify_stream_token)."""
    import base64
    import hashlib
    import hmac
    import time

    exp = int(time.time()) + ttl
    digest = hmac.new(key.encode(), f"vobiz-call.{outreach_id}.{exp}".encode(), hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return f"{outreach_id}.{exp}.{sig}"


def count_context_loads(main) -> list:
    """Wrap main.fetch_context_firestore; returns the list each load appends to."""
    loads: list = []
    original = main.fetch_context_firestore

    async def counting(outreach_id, project):
        loads.append(outreach_id)
        return await original(outreach_id, project)

    main.fetch_context_firestore = counting
    return loads


def import_main(tmp_dir, monkeypatch):
    """Import src.main (inside stubbed_runtime) with its module-level state made safe."""
    from dataclasses import replace

    monkeypatch.setenv("CALL_STORE_DB", str(tmp_dir / "calls.db"))
    from src import main

    monkeypatch.setattr(
        main,
        "config",
        replace(make_config(), request_signing_key=SIGNING_KEY, google_cloud_project="demo-project"),
    )
    if hasattr(main, "_HANGUP_GRACE_SECONDS"):
        monkeypatch.setattr(main, "_HANGUP_GRACE_SECONDS", 0)
    return main


async def run_twilio_path(main, call_context: dict, outreach_id: str = "out-ctx-1"):
    """/ws/call: the context comes from the web app's /api/attendance/call-context."""

    async def fake_fetch_call_context(api_url, internal_key, outreach_id):
        return dict(call_context)

    main.fetch_call_context = fake_fetch_call_context
    ws = FakeWebSocket([
        {"event": "connected", "protocol": "Call"},
        {"event": "start", "streamSid": "stream-test",
         "start": {"callSid": "call-test", "customParameters": {"outreachId": outreach_id}}},
    ])
    await main.handle_call(ws)
    return ws


# A made-up call UUID in the shape Vobiz (Plivo-compatible) sends.
CALL_UUID = "123e4567-e89b-42d3-a456-426614174000"


async def run_vobiz_path(
    main, db: FakeAsyncFirestore, outreach_id: str = "OutreachFs0000000001",
    token: str | None = None, cuid: str = CALL_UUID,
):
    """/telephony/vobiz/stream: the context is read straight from parent_outreach in Firestore."""
    from src import vobiz

    vobiz._db = lambda project: db
    ws = FakeWebSocket(
        [{"event": "start", "start": {"streamId": "stream-test"}}],
        query_params={
            "t": mint_stream_token(outreach_id) if token is None else token,
            "cuid": cuid,
            "lang": "Hindi",
        },
    )
    await main.handle_vobiz_call(ws)
    return ws


class ScriptedRunner:
    """Stands in for pipecat's WorkerRunner: `run()` plays a script mid-call.

    The script is an async callable run while the "call" is live; whatever it
    raises (WebSocketDisconnect, RuntimeError…) escapes run() the way a real
    pipeline failure would.
    """

    script = None

    def __init__(self, *args, **kwargs) -> None:
        self.tasks: list = []

    async def add_workers(self, task) -> None:
        self.tasks.append(task)

    async def run(self) -> None:
        if ScriptedRunner.script is not None:
            await ScriptedRunner.script()


class ModelRunner:
    """pipecat's WorkerRunner as far as ending is concerned.

    run() returns only when the task ends the way pipecat ends it (see
    PipelineTask.request_end): an EndFrame queued at the source, an
    EndTaskFrame pushed UPSTREAM by a processor, a cancel, or a CancelFrame
    injected into the pipeline. An EndFrame pushed downstream from the middle
    of the pipeline does not end it. `script` runs while the call is live and
    may raise. If nothing ends the task within `max_wait`, run() gives up and
    records `timed_out` (the real runner would wait for the idle timeout).
    """

    script = None
    max_wait = 1.0
    last = None

    def __init__(self, *args, **kwargs) -> None:
        self.tasks: list = []
        self.timed_out = False
        self.ended = False
        self.returned_after: float | None = None
        ModelRunner.last = self

    async def add_workers(self, task) -> None:
        self.tasks.append(task)

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        started = loop.time()
        task = self.tasks[0]
        if ModelRunner.script is not None:
            await ModelRunner.script()
        while task.end_reason is None:
            for processor in task.pipeline.processors:
                if not isinstance(processor, FrameProcessor):
                    continue  # transport ends, services: stand-ins with no frames of their own
                for frame, direction in processor.pushed:
                    if type(frame).__name__ == "EndTaskFrame" and direction is FrameDirection.UPSTREAM:
                        task.request_end("EndTaskFrame reached the task")
            if task.end_reason is not None:
                break
            if loop.time() - started > ModelRunner.max_wait:
                self.timed_out = True
                break
            await asyncio.sleep(0.005)
        self.ended = task.end_reason is not None
        self.returned_after = loop.time() - started
