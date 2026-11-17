"""
Build-time smoke check: does the engine's code still fit the pipecat it ships with?

The unit tests stub pipecat and the SDKs, so on their own they cannot see an
API change in a dependency (pipecat already broke this service twice: the
removed `loop` kwarg, the WorkerRunner move). This runs INSIDE the built image
(cloudbuild.yaml step `smoke-real-pipecat`), against the exact packages the
image will deploy with, and fails the build if:
  * any module the engine imports, or any pipecat name it relies on, is gone;
  * create_bot cannot build a full pipeline with either Gemini backend;
  * main.run_pipeline (the WorkerRunner construction with handle_sigint and
    loop, add_workers and run, exactly as every call runs it) cannot run a
    pipeline that ends at once to its end within RUN_BOUND_SECONDS, with
    proof that it ran: the StartFrame and the EndFrame went through it and
    the task finished. That is the API that broke revision 00036
    (rereview-0b #11, final-0b #4).

The call pipelines are built and discarded, never started. The one pipeline it
runs holds a single pass-through processor: no transport, no socket, no call,
no API (dummy keys). The Vertex backend resolves Application Default
Credentials, which Cloud Build's metadata server provides.

    python -m src.smoke_check
"""

from __future__ import annotations

import asyncio
import os
import sys
import types

# Every pipecat name the engine uses at runtime, beyond what importing it checks.
REQUIRED_PIPECAT = {
    "pipecat.frames.frames": ("EndFrame", "EndTaskFrame", "CancelFrame", "TTSSpeakFrame",
                              "TranscriptionFrame", "LLMContextFrame", "LLMTextFrame"),
    "pipecat.pipeline.task": ("PipelineTask", "PipelineParams"),
    "pipecat.workers.runner": ("WorkerRunner",),
    "pipecat.serializers.plivo": ("PlivoFrameSerializer",),
    "pipecat.services.google.llm": ("GoogleLLMService",),
    "pipecat.services.google.vertex.llm": ("GoogleVertexLLMService",),
    "pipecat.processors.frame_processor": ("FrameProcessor", "FrameDirection"),
}
REQUIRED_TASK_API = ("cancel", "queue_frames", "has_finished", "pipeline")
# How long the pipeline that ends at once may take to run to its end.
RUN_BOUND_SECONDS = 30.0

SMOKE_CONTEXT = {
    "id": "SmokeOutreach0000001",
    "studentName": "Smoke",
    "className": "Class 1",
    "reason": "consecutive_absences",
    "parentLanguage": "Hindi",
    "teacherName": "Smoke Teacher",
    "schoolName": "Smoke School",
}


def _dummy_env() -> None:
    for key, value in {
        "SARVAM_AI_API_KEY": "smoke-not-a-key",
        "GOOGLE_GENAI_API_KEY": "smoke-not-a-key",
        "GOOGLE_CLOUD_PROJECT": "smoke-project",
        "SAHAYAKAI_REQUEST_SIGNING_KEY": "smoke-signing-key-not-a-secret-0000",
        "CALL_STORE_DB": "/tmp/voice-server-smoke-calls.db",
    }.items():
        os.environ.setdefault(key, value)


class _FakeWebSocket(types.SimpleNamespace):
    """Enough of a Starlette WebSocket for the transport's constructor."""


async def _build(backend: str) -> None:
    from dataclasses import replace

    from pipecat.pipeline.task import PipelineTask
    from pipecat.serializers.plivo import PlivoFrameSerializer

    from src.bot import create_bot
    from src.config import load_config

    config = replace(load_config(), gemini_backend=backend)
    serializer = PlivoFrameSerializer(
        stream_id="smoke",
        params=PlivoFrameSerializer.InputParams(plivo_sample_rate=8000, sample_rate=16000, auto_hang_up=False),
    )

    async def no_write(*_args) -> bool:
        return True

    task, finalize = await create_bot(
        config, dict(SMOKE_CONTEXT), _FakeWebSocket(), stream_sid="smoke", call_sid="",
        call_store=None, serializer=serializer, on_opt_out_request=no_write,
    )
    if not isinstance(task, PipelineTask) or not callable(finalize):
        raise TypeError(f"create_bot({backend}) returned {type(task).__name__}, {type(finalize).__name__}")


async def _run_one_that_ends_at_once() -> None:
    """main.run_pipeline, exactly as a call runs it, on a pipeline that ends at once.

    The EndFrame is queued once the run has started, the way the engine
    queues its own frames during a call. It fails unless the runner really
    ran the pipeline: still running when the EndFrame is queued, the
    processor saw both the StartFrame and the EndFrame, and the task reports
    it has finished (final-0b #4: a run() that returns at once passed).
    """
    from pipecat.frames.frames import EndFrame
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.task import PipelineTask
    from pipecat.processors.frame_processor import FrameProcessor

    from src.main import run_pipeline

    seen: list[str] = []

    class _PassThrough(FrameProcessor):
        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)
            seen.append(type(frame).__name__)
            await self.push_frame(frame, direction)

    task = PipelineTask(Pipeline([_PassThrough()]))
    running = asyncio.ensure_future(run_pipeline(task))
    await asyncio.sleep(0.2)
    if running.done():
        running.result()  # a runner error (TypeError, AttributeError…) surfaces as itself
        raise RuntimeError("run_pipeline returned before the pipeline was ended: "
                           "WorkerRunner.run() no longer runs its workers to their end")
    await task.queue_frames([EndFrame()])
    await asyncio.wait_for(running, RUN_BOUND_SECONDS)
    missing = [name for name in ("StartFrame", "EndFrame") if name not in seen]
    if missing:
        raise RuntimeError(f"the pipeline never carried {missing} (saw {seen}): the runner did not run it")
    if not task.has_finished():
        raise RuntimeError("run_pipeline returned but the task has not finished")


def main() -> int:
    _dummy_env()
    import importlib

    import src.main  # noqa: F401 — the server module itself, with every import it makes

    for module_name, names in REQUIRED_PIPECAT.items():
        module = importlib.import_module(module_name)
        missing = [n for n in names if not hasattr(module, n)]
        if missing:
            raise ImportError(f"{module_name} no longer provides {missing}")
    from pipecat.pipeline.task import PipelineTask

    missing = [n for n in REQUIRED_TASK_API if not hasattr(PipelineTask, n)]
    if missing:
        raise AttributeError(f"PipelineTask no longer provides {missing}")
    for backend in ("ai_studio", "vertex"):
        asyncio.run(_build(backend))
    asyncio.run(_run_one_that_ends_at_once())
    print("voice-server smoke check: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
