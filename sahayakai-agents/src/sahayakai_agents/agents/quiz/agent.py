"""ADK helpers + ParallelAgent builder for quiz generator.

Phase E.1 — prompt rendering, model selection, optional data-URI
parsing.

Phase L.4 — `build_quiz_agent()` returns a real
`google.adk.agents.ParallelAgent` of three difficulty-variant
`LlmAgent`s, each with a unique `output_key` so the runner's session
state has three disjoint slots after the parallel run completes
(no shared-state race).

What used to live in the router (`asyncio.gather` over three
hand-rolled `_call_gemini` invocations) now lives in ADK's canonical
multi-agent shape:

    ParallelAgent(quiz_variants_parallel)
      ├── _VariantWrapper(easy)   → LlmAgent(output_key="variant_easy")
      ├── _VariantWrapper(medium) → LlmAgent(output_key="variant_medium")
      └── _VariantWrapper(hard)   → LlmAgent(output_key="variant_hard")

The `_VariantWrapper` is a thin `BaseAgent` shim that swallows
sub-agent exceptions. Without it, ADK's `ParallelAgent` runs sub-agents
under `asyncio.TaskGroup` (Python 3.11+), and TaskGroup's semantics
cancel sibling tasks the moment any task raises — meaning a single
malformed-JSON variant would tear down the other two. The wrapper
catches the exception, logs at WARNING (matching the previous
`Promise.allSettled` / `asyncio.gather(return_exceptions=False)`
log shape), and yields no events. The runner then sees a clean exit
with no `output_key` written to session state — the router post-Runner
treats a missing slot as "that variant failed → None".

The router collects all three slots from `runner.session_service.
get_session(...).state` and applies the same post-processing
(behavioural guard + variant counting) it always did.
"""
from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator

    from google.adk.agents import LlmAgent, ParallelAgent
    from google.adk.agents.invocation_context import InvocationContext
    from google.adk.events.event import Event

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "quiz"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "quiz"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Quiz prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    return str(_compile_generator_template()(context))


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    return os.environ.get("SAHAYAKAI_QUIZ_MODEL", "gemini-2.5-flash")


# ---- Optional data URI parsing ------------------------------------------

_DATA_URI_RE = re.compile(
    r"^data:(?P<mime>[^;,]+)(?:;[^;,]+)*;base64,(?P<body>.+)$",
    re.DOTALL,
)


class InvalidDataURIError(ValueError):
    """Raised when an imageDataUri does not parse correctly."""


def parse_data_uri_optional(
    data_uri: str | None,
) -> tuple[str, bytes] | None:
    """Decode a data URI to (mime, bytes), or return None if not provided.

    Raises `InvalidDataURIError` only when the URI is non-empty but
    malformed.
    """
    if not data_uri:
        return None
    match = _DATA_URI_RE.match(data_uri)
    if not match:
        raise InvalidDataURIError(
            "imageDataUri does not match data:<mime>;base64,<body> format",
        )
    mime = match.group("mime").strip().lower()
    body = match.group("body").strip()
    if not mime.startswith("image/"):
        raise InvalidDataURIError(
            f"imageDataUri MIME type must be image/*; got {mime!r}",
        )
    try:
        decoded = base64.b64decode(body, validate=True)
    except Exception as exc:
        raise InvalidDataURIError(
            f"imageDataUri base64 decode failed: {exc}",
        ) from exc
    if not decoded:
        raise InvalidDataURIError("imageDataUri body decoded to empty bytes")
    return mime, decoded


# ---- ADK ParallelAgent builder (Phase L.4) ------------------------------


# Difficulty labels in deterministic order. The router iterates this
# tuple to pull each variant out of post-run session state — keep it
# in sync with `QuizDifficulty` literals.
_DIFFICULTIES: tuple[str, ...] = ("easy", "medium", "hard")


def variant_state_key(difficulty: str) -> str:
    """Session-state key under which a variant's parsed output lands.

    Stable contract between the agent (which sets `output_key=...`
    on each variant `LlmAgent`) and the router (which reads
    `session.state[variant_state_key(d)]` after Runner.run_async
    returns). Disjoint per difficulty to prevent the shared-state
    race ParallelAgent docs warn about.
    """
    return f"variant_{difficulty}"


def build_variant_agent(difficulty: str) -> LlmAgent:
    """Build one `LlmAgent` for a single difficulty variant.

    Each variant carries its own `output_key` so the parallel run
    populates three disjoint session-state slots
    (`variant_easy` / `variant_medium` / `variant_hard`). ADK's
    `__maybe_save_output_to_state` runs the model output through
    `output_schema=QuizGeneratorCore`'s `model_validate_json`, so
    by the time the slot is written, the value is a validated dict
    matching the schema — not raw text.

    The `instruction` field is empty at build time. The router
    replaces it per call by `model_copy()`-ing this template with a
    per-difficulty rendered prompt wrapped in an `InstructionProvider`
    callable. Wrapping in a callable bypasses ADK's
    `inject_session_state()` (which scans for `{name}` placeholders
    that could collide with our rendered prompt content — a real
    risk because Handlebars output may contain `{x}` patterns from
    sanitized user input).

    `new_message` carries only the optional textbook-page image
    (shared across all three variants because `ParallelAgent` shares
    one `new_message` from the parent invocation context).

    `disallow_transfer_to_parent=True` and `disallow_transfer_to_peers=True`
    so a variant can't escape into ADK's auto-flow transfer machinery —
    these are leaf nodes; the only escape hatch is yielding the
    structured-output Content event.

    `name` is unique per variant so ADK's branch-context naming
    (`<parent>.<sub>`) and event tracing stay clean.
    """
    # Local import keeps test files that don't exercise ADK fast.
    from google.adk.agents import LlmAgent  # noqa: PLC0415

    from .schemas import QuizGeneratorCore  # noqa: PLC0415

    return LlmAgent(
        name=f"quiz_variant_{difficulty}",
        model=get_generator_model(),
        instruction="",
        sub_agents=[],
        output_schema=QuizGeneratorCore,
        output_key=variant_state_key(difficulty),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


def build_variant_wrapper(difficulty: str, *, inner_override: Any = None):  # type: ignore[no-untyped-def]
    """Build the error-isolating wrapper around one variant `LlmAgent`.

    ADK 1.31's `ParallelAgent._run_async_impl` runs sub-agents under
    `asyncio.TaskGroup`. TaskGroup cancels sibling tasks the moment
    any task raises — which means a single variant raising
    `pydantic.ValidationError` (malformed JSON) or hitting Gemini's
    safety filter would kill the other two variants mid-flight,
    regressing the previous Genkit `Promise.allSettled` semantics.

    The wrapper's `_run_async_impl` does:

      1. Run the wrapped variant.
      2. Yield every event the variant emits — so ADK's normal
         `__maybe_save_output_to_state` populates session state for
         the success path.
      3. If any exception bubbles up, swallow it, log at WARNING
         (matching the existing router's `quiz.variant.failed` shape),
         and exit cleanly. The runner sees no exception; sibling
         variants keep running.

    `output_key` lives on the inner `LlmAgent` (where ADK's
    `__maybe_save_output_to_state` runs); the wrapper has no
    `output_key` of its own.

    Args:
        difficulty: One of "easy" / "medium" / "hard".
        inner_override: Optional pre-built inner `LlmAgent`. When the
            router clones a per-call variant (e.g. with a pinned-key
            Gemini wrapper or a per-call rendered instruction), it
            calls this builder with `inner_override=cloned_inner` so
            the closure captures the right inner. Defaults to a
            freshly built variant agent — used by the cached
            `build_quiz_agent()` template.
    """
    from google.adk.agents.base_agent import BaseAgent  # noqa: PLC0415

    inner = inner_override if inner_override is not None else build_variant_agent(difficulty)

    class _VariantWrapper(BaseAgent):
        """Error-isolating shim for one quiz difficulty variant.

        Closes over `inner` from the enclosing function — that's why
        per-call variant cloning rebuilds the wrapper via this
        function instead of `model_copy`-ing the cached template.
        """

        async def _run_async_impl(
            self, ctx: InvocationContext,
        ) -> AsyncGenerator[Event, None]:
            try:
                async for event in inner.run_async(ctx):
                    yield event
            except Exception as exc:
                # Match the existing `quiz.variant.failed` log shape so
                # dashboards / log filters keep working through the
                # ADK migration.
                log.warning(
                    "quiz.variant.failed",
                    difficulty=difficulty,
                    error=str(exc),
                    error_type=type(exc).__name__,
                )
                # Eat the exception — yield nothing. The runner sees
                # a clean exit, sibling variants are not cancelled,
                # and the variant's `output_key` stays absent from
                # session state (router treats absence as None).
                return

    wrapper = _VariantWrapper(name=f"quiz_variant_{difficulty}_wrapped")
    # Attach the inner agent as a sub-agent so ADK's tree-walker
    # (used for tracing + auto-discovery) can find it. Not strictly
    # required for `run_async` — we explicitly call `inner.run_async`
    # above — but keeps the agent tree honest. Pydantic complains
    # if we set this in __init__ before the field is declared, so
    # use the dunder setter to bypass validation; ParallelAgent
    # walks `sub_agents` directly off the field, this works.
    wrapper.sub_agents = [inner]
    return wrapper


@lru_cache(maxsize=1)
def build_quiz_agent() -> ParallelAgent:
    """Build the quiz `ParallelAgent` — three difficulty variants in
    parallel, isolated by per-variant `output_key` slots.

    Cached via `lru_cache(1)` because the same `ParallelAgent` is safe
    to re-use across requests; ADK threads per-call state through the
    `Runner` + session, not the agent itself. The router's per-call
    pinned-key Gemini wrapper is applied via `model_copy()` on each
    variant before invocation.

    Returns:
        A `ParallelAgent` whose `sub_agents` are three `_VariantWrapper`
        shims, each wrapping an `LlmAgent` whose `output_key` matches
        `variant_state_key(difficulty)`. After
        `Runner.run_async` completes, session state has up to three
        validated `QuizGeneratorCore`-as-dict slots — one per variant
        that succeeded.
    """
    from google.adk.agents import ParallelAgent  # noqa: PLC0415

    return ParallelAgent(
        name="quiz_variants_parallel",
        sub_agents=[build_variant_wrapper(d) for d in _DIFFICULTIES],
    )


__all__ = [
    "InvalidDataURIError",
    "build_quiz_agent",
    "build_variant_agent",
    "build_variant_wrapper",
    "get_generator_model",
    "load_generator_prompt",
    "parse_data_uri_optional",
    "render_generator_prompt",
    "variant_state_key",
]
