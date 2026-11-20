"""CLASS GATE — the build's real-pipecat smoke step runs a pipeline the way a call does.

Re-review rereview-0b #11: src/smoke_check.py only imported names and built
pipelines. It never called the runner API that broke revision 00036
(`WorkerRunner(handle_sigint=, loop=)`, `add_workers`, `run`), so a lock bump
that renamed the `loop` kwarg or `add_workers` would pass every gate, the
revision would go Ready, and every Vobiz call would raise TypeError at
WorkerRunner(...), leaving the parent on a silent line.

The class is "a runtime API every call uses that the build never exercises".
The gate:
  * structurally: every handler runs its pipeline through main.run_pipeline,
    WorkerRunner is constructed nowhere else (and with exactly the production
    arguments), and smoke_check.main() runs run_pipeline on a pipeline that
    ends at once, under a time bound;
  * behaviourally (pipecat stubbed): the smoke step constructs the runner with
    handle_sigint=False and the running loop, adds the task, runs it to its
    end; a runner that rejects `loop` (the 00036 break), has no add_workers,
    or never returns makes the smoke step fail.
"""

from __future__ import annotations

import ast
import asyncio
from pathlib import Path

import pytest

from bot_harness import RECORDER, EndFrame, Frame, FrameDirection, import_main, stubbed_runtime
from main_ast import SOURCE as MAIN_SOURCE, call_name, handlers

SMOKE = (Path(__file__).resolve().parents[1] / "src" / "smoke_check.py").read_text(encoding="utf-8")


def _functions(source: str) -> dict[str, ast.AST]:
    return {n.name: n for n in ast.walk(ast.parse(source)) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}


def runner_problems(main_source: str, smoke_source: str) -> list[str]:
    problems: list[str] = []
    main_tree = ast.parse(main_source)
    fns = _functions(main_source)

    # The production runner: built in run_pipeline only, with these arguments.
    builds = [(fn_name, n) for fn_name, fn in fns.items() for n in ast.walk(fn)
              if isinstance(n, ast.Call) and call_name(n) == "WorkerRunner"]
    if [name for name, _ in builds] != ["run_pipeline"]:
        problems.append(f"WorkerRunner is built in {[name for name, _ in builds]}, not only in run_pipeline")
    for _name, node in builds:
        kwargs = {kw.arg: ast.unparse(kw.value) for kw in node.keywords}
        if kwargs != {"handle_sigint": "False", "loop": "asyncio.get_running_loop()"}:
            problems.append(f"WorkerRunner({kwargs}) is not the production construction")
    if "run_pipeline" in fns:
        calls = [call_name(n) for n in ast.walk(fns["run_pipeline"]) if isinstance(n, ast.Call)]
        for needed in ("add_workers", "run"):
            if needed not in calls:
                problems.append(f"run_pipeline does not call {needed}")
    for fn in handlers(main_tree):
        calls = {call_name(n) for n in ast.walk(fn) if isinstance(n, ast.Call)}
        if "create_bot" in calls and "run_pipeline" not in calls:
            problems.append(f"{fn.name} does not run its pipeline through run_pipeline")

    # The smoke step runs run_pipeline, bounded, on a pipeline that ends.
    smoke_fns = _functions(smoke_source)
    main_calls = [ast.unparse(n) for n in ast.walk(smoke_fns.get("main", ast.Module(body=[], type_ignores=[])))
                  if isinstance(n, ast.Call) and call_name(n) == "run"]
    if not any("_run_one_that_ends_at_once()" in c for c in main_calls):
        problems.append("smoke_check.main() does not run _run_one_that_ends_at_once()")
    body = smoke_fns.get("_run_one_that_ends_at_once")
    if body is None:
        problems.append("smoke_check has no _run_one_that_ends_at_once")
    else:
        calls = [call_name(n) for n in ast.walk(body) if isinstance(n, ast.Call)]
        imported = {a.name for n in ast.walk(body) if isinstance(n, ast.ImportFrom) and n.module == "src.main"
                    for a in n.names}
        for needed in ("run_pipeline", "wait_for", "queue_frames", "EndFrame", "has_finished"):
            if needed not in calls:
                problems.append(f"_run_one_that_ends_at_once does not call {needed}")
        literals = {n.value for n in ast.walk(body) if isinstance(n, ast.Constant)}
        if not {"StartFrame", "EndFrame"} <= literals:
            problems.append("_run_one_that_ends_at_once does not check the frames the pipeline carried")
        if "run_pipeline" not in imported:
            problems.append("_run_one_that_ends_at_once does not use src.main.run_pipeline")
    return problems


def test_the_smoke_step_runs_the_production_runner_path():
    assert runner_problems(MAIN_SOURCE, SMOKE) == []


@pytest.mark.parametrize("bad", [
    ("main", "        await run_pipeline(task)\n",
     "        runner = WorkerRunner(handle_sigint=False, loop=asyncio.get_running_loop())\n"
     "        await runner.add_workers(task)\n        await runner.run()\n"),
    ("main", "WorkerRunner(handle_sigint=False, loop=asyncio.get_running_loop())", "WorkerRunner(handle_sigint=False)"),
    ("main", "    await runner.add_workers(task)\n", ""),
    ("smoke", "    asyncio.run(_run_one_that_ends_at_once())\n", ""),
    ("smoke", "    await asyncio.wait_for(running, RUN_BOUND_SECONDS)\n", "    await running\n"),
    ("smoke", "    if not task.has_finished():\n", "    if False:\n"),
    ("smoke", 'for name in ("StartFrame", "EndFrame")', 'for name in ()'),
], ids=["a handler bypasses run_pipeline", "different runner arguments", "no add_workers",
        "smoke never runs it", "unbounded run", "no finished check", "no frame check"])
def test_the_checker_rejects_each_gap(bad):
    which, old, new = bad
    main_src, smoke_src = MAIN_SOURCE, SMOKE
    if which == "main":
        assert old in main_src
        main_src = main_src.replace(old, new, 1)
    else:
        assert old in smoke_src
        smoke_src = smoke_src.replace(old, new, 1)
    assert runner_problems(main_src, smoke_src)


# ── behaviour (pipecat stubbed) ──────────────────────────────────────────────


def _smoke_run(tmp_path, monkeypatch, runner=None, bound=None):
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        if runner is not None:
            main.WorkerRunner = runner
        from src import smoke_check

        if bound is not None:
            monkeypatch.setattr(smoke_check, "RUN_BOUND_SECONDS", bound)

        seen = {}

        async def go():
            seen["loop"] = asyncio.get_running_loop()
            await smoke_check._run_one_that_ends_at_once()

        asyncio.run(go())
        return seen, list(RECORDER.calls), RECORDER.instances_of("PipelineTask")


class _FaithfulRunner:
    """Runs the task the way pipecat does as far as the smoke step can see:
    a StartFrame through every processor, then the queued EndFrame, then finished."""

    built: list = []

    def __init__(self, **kwargs):
        self.kwargs, self.tasks = kwargs, []
        _FaithfulRunner.built.append(self)

    async def add_workers(self, task):
        self.tasks.append(task)

    async def _feed(self, frame):
        for processor in self.tasks[0].pipeline.processors:
            await processor.process_frame(frame, FrameDirection.DOWNSTREAM)

    async def run(self):
        task = self.tasks[0]
        await self._feed(StartFrame())
        while not any(isinstance(f, EndFrame) for f in task.queued):
            await asyncio.sleep(0.005)
        await self._feed(EndFrame())
        task.finished = True


class StartFrame(Frame):
    pass


def test_the_smoke_step_builds_adds_and_runs_the_runner_as_a_call_does(tmp_path, monkeypatch):
    _FaithfulRunner.built = []
    seen, _calls, [task] = _smoke_run(tmp_path, monkeypatch, runner=_FaithfulRunner)
    [runner] = _FaithfulRunner.built
    assert runner.kwargs == {"handle_sigint": False, "loop": seen["loop"]}
    assert runner.tasks == [task]
    assert task.finished and task.end_reason == "EndFrame queued at the source"


class _ReturnsAtOnce(_FaithfulRunner):  # final-0b #4: run() no longer blocks on its workers
    async def run(self):
        return None


class _NeverStartsThePipeline(_FaithfulRunner):
    async def run(self):
        while not self.tasks[0].queued:
            await asyncio.sleep(0.005)
        self.tasks[0].finished = True


class _NeverFinishes(_FaithfulRunner):
    async def run(self):
        task = self.tasks[0]
        await self._feed(StartFrame())
        while not task.queued:
            await asyncio.sleep(0.005)
        await self._feed(EndFrame())


class _NoLoopRunner:  # the 00036 break: the kwarg is gone
    def __init__(self, *, handle_sigint):
        pass


class _NoAddWorkers:
    def __init__(self, **kwargs):
        pass

    async def run(self):
        return None


class _NeverReturns:
    def __init__(self, **kwargs):
        pass

    async def add_workers(self, task):
        return None

    async def run(self):
        await asyncio.sleep(3600)


@pytest.mark.parametrize("runner,error,match", [
    (_NoLoopRunner, TypeError, "loop"),
    (_NoAddWorkers, AttributeError, "add_workers"),
    (_NeverReturns, asyncio.TimeoutError, None),
    (_ReturnsAtOnce, RuntimeError, "returned before the pipeline was ended"),
    (_NeverStartsThePipeline, RuntimeError, "never carried"),
    (_NeverFinishes, RuntimeError, "has not finished"),
], ids=["loop kwarg removed", "add_workers removed", "run never returns", "run returns at once",
        "pipeline never started", "task never finishes"])
def test_a_runner_api_change_fails_the_smoke_step(runner, error, match, tmp_path, monkeypatch):
    with pytest.raises(error, match=match):
        _smoke_run(tmp_path, monkeypatch, runner=runner, bound=0.3)
