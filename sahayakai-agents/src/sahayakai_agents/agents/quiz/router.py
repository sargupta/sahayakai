"""FastAPI sub-router for quiz generator.

Phase E.1 — 3-variant parallel pattern: spawn one Gemini call per
difficulty (easy/medium/hard) and gather results. Optional multimodal —
a textbook page image can be supplied as `imageDataUri`.

Phase L.4 — replaced the hand-rolled `asyncio.gather(*_run_one_variant)`
loop with ADK's canonical `ParallelAgent` driven by `Runner.run_async`.
The 3 variants are still parallel (ADK runs them under
`asyncio.TaskGroup`); the difference is per-variant tracing, isolated
branch contexts, and per-variant `output_key` slots in session state
that prevent shared-state races. See `agent.py` for the agent shape +
the `_VariantWrapper` error-isolation rationale.

Wire shape unchanged:
  - 0 variants succeed → 502.
  - 1-2 variants succeed → 200 with `null` for the failed slots.
  - 3 variants succeed → 200 with all populated.
  - Behavioural guard runs on whatever variants succeeded.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_quiz_response_rules
from .agent import (
    InvalidDataURIError,
    build_quiz_agent,
    build_variant_wrapper,
    get_generator_model,
    parse_data_uri_optional,
    render_generator_prompt,
    variant_state_key,
)
from .schemas import (
    QuizDifficulty,
    QuizGeneratorCore,
    QuizGeneratorRequest,
    QuizGeneratorResponse,
    QuizVariantsResponse,
)

log = structlog.get_logger(__name__)

quiz_router = APIRouter(prefix="/v1/quiz", tags=["quiz"])

SIDECAR_VERSION = "phase-l.4"

# Per-call timeout for run_resiliently. Quiz variants generate
# multimodal-aware structured JSON; 30s gives a slow attempt enough
# room while preventing a hung Gemini call from blocking the route.
# Phase L.4 keeps the same 30s budget — ParallelAgent still runs all
# three variants concurrently, so the route's wall-clock latency is
# bounded by the slowest single variant, not by 3× this number.
_PER_CALL_TIMEOUT_S = 30.0

# ADK Runner needs an app_name for the in-memory session service.
# Opaque to the model — just a session-store key prefix.
_QUIZ_APP_NAME = "sahayakai-quiz"

_LANGUAGE_NAME_TO_ISO: dict[str, str] = {
    "english": "en", "hindi": "hi", "tamil": "ta", "telugu": "te",
    "kannada": "kn", "malayalam": "ml", "bengali": "bn", "marathi": "mr",
    "gujarati": "gu", "punjabi": "pa", "odia": "or",
}

_DIFFICULTIES: tuple[QuizDifficulty, ...] = ("easy", "medium", "hard")


def _iso_for_lang(language: str | None) -> str:
    if not language:
        return "en"
    key = language.strip().lower()
    return _LANGUAGE_NAME_TO_ISO.get(key, key[:2] if len(key) >= 2 else "en")


# ---- Per-call agent assembly --------------------------------------------


def _make_instruction_provider(prompt: str) -> Any:
    """Wrap a pre-rendered prompt string in a 1-arg callable.

    ADK's `LlmAgent.canonical_instruction` returns
    `(text, bypass_state_injection)`. When `instruction` is a CALLABLE
    (an `InstructionProvider`), `bypass_state_injection=True` and ADK
    SKIPS `inject_session_state()` entirely — meaning rendered prompts
    that happen to contain `{var}` shapes (from sanitized user input)
    won't trigger ADK's state-variable lookup + KeyError.

    When `instruction` is a plain `str`, ADK treats `{name}` patterns
    as state-variable refs. Our Handlebars-rendered prompts can leak
    `{x}`-shaped fragments through user-controlled fields (topic,
    teacherContext, etc.). Wrapping in a lambda is the canonical ADK
    escape hatch — same pattern the upstream multi-agent guide
    recommends for InstructionProvider use cases.

    The callable takes a `ReadonlyContext` arg (we ignore it; our
    prompt is pre-rendered against the request, not session state).
    """
    def _provider(_ctx: Any) -> str:
        return prompt
    return _provider


def _attach_per_call_state(
    *,
    api_key: str,
    image_bytes: bytes | None,
    image_mime: str | None,
    base_context: dict[str, Any],
) -> tuple[Any, Any]:
    """Build a per-call `ParallelAgent` clone with each variant's
    rendered prompt + pinned-key Gemini wired in.

    The cached `build_quiz_agent()` template stays untouched. Per call
    we:
      1. Render one prompt per difficulty against `base_context`.
      2. For each variant: pull out the cached inner `LlmAgent`,
         `model_copy()` it with the rendered prompt as a callable
         `instruction` + a pinned-key `Gemini` wrapper as `model`.
      3. Build a fresh `_VariantWrapper` whose closure captures the
         CLONED inner (re-using `build_variant_wrapper` from agent.py
         with `inner_override`). Cleaner than monkey-patching a
         Pydantic-validated wrapper instance.
      4. Build a fresh `ParallelAgent` with the new wrappers.

    Returns:
        `(parallel_agent, new_message)` — the per-call ParallelAgent
        ready for `Runner.run_async` and the shared user Content
        (image if supplied + a sentinel text part).
    """
    # Local import keeps modules that don't exercise ADK fast.
    from google.adk.agents import LlmAgent, ParallelAgent  # noqa: PLC0415

    template = build_quiz_agent()

    cloned_wrappers: list[Any] = []
    for wrapper, difficulty in zip(
        template.sub_agents, _DIFFICULTIES, strict=True,
    ):
        # Each wrapper.sub_agents[0] is the cached inner LlmAgent.
        # Pull the model name off it; assert isinstance for mypy
        # (BaseAgent doesn't declare `.model`; LlmAgent does).
        inner = wrapper.sub_agents[0]
        assert isinstance(inner, LlmAgent), (
            "build_variant_wrapper places an LlmAgent at sub_agents[0]"
        )

        # Per-difficulty rendered prompt.
        variant_context = {**base_context, "targetDifficulty": difficulty}
        prompt = render_generator_prompt(variant_context)

        # Clone the inner LlmAgent with per-call instruction + model.
        # Wrapping the prompt in a callable bypasses ADK's
        # `inject_session_state()` (which would otherwise scan for
        # `{var}` placeholders that could leak through sanitized user
        # input — see `_make_instruction_provider` docstring).
        model_name = (
            inner.model
            if isinstance(inner.model, str)
            else inner.model.model
        )
        cloned_inner = inner.model_copy(update={
            "instruction": _make_instruction_provider(prompt),
            "model": build_keyed_gemini(
                model_name=model_name,
                api_key=api_key,
            ),
        })

        # Build a fresh wrapper whose closure captures the cloned
        # inner (NOT the cached template's). Doing this via the
        # public `build_variant_wrapper(difficulty, inner_override=...)`
        # builder means we don't have to monkey-patch a Pydantic
        # instance to redirect dispatch — the closure does it cleanly.
        cloned_wrappers.append(build_variant_wrapper(
            difficulty, inner_override=cloned_inner,
        ))

    # Re-instantiate the ParallelAgent with the per-call wrappers.
    # `model_copy` would also work here, but constructing fresh
    # makes the per-call agent's identity unambiguous in traces.
    parallel_agent_for_call = ParallelAgent(
        name=template.name,
        sub_agents=cloned_wrappers,
    )

    new_message = _build_new_message(image_bytes, image_mime)
    return parallel_agent_for_call, new_message


def _build_new_message(
    image_bytes: bytes | None,
    image_mime: str | None,
) -> Any:
    """Build the `new_message` Content shared by all 3 variants.

    The variants' instructions carry the pre-rendered prompt text;
    the user message carries only the optional textbook-page image
    (when supplied). When there's no image, we still need a
    user-role Content with at least one part (Runner.run_async
    requires `new_message.parts` to be non-empty), so we send a
    minimal sentinel text part.

    All three variants see the same `new_message` because
    `ParallelAgent` shares the parent invocation context across
    sub-agents (each gets a branch, but `new_message` is parent-level).
    """
    from google.genai import types as genai_types  # noqa: PLC0415

    parts: list[Any] = []
    if image_bytes is not None and image_mime is not None:
        parts.append(
            genai_types.Part.from_bytes(
                data=image_bytes, mime_type=image_mime,
            ),
        )
    # Always include at least one text part — Runner requires it
    # AND it gives the model a clear cue to attend to the image.
    if image_bytes is not None:
        parts.append(genai_types.Part(
            text="Generate the quiz from the textbook page above.",
        ))
    else:
        parts.append(genai_types.Part(text="Generate the quiz."))

    return genai_types.Content(role="user", parts=parts)


# ---- ADK Runner invocation ----------------------------------------------


async def _run_quiz_via_runner(
    *,
    api_key: str,
    image_bytes: bytes | None,
    image_mime: str | None,
    base_context: dict[str, Any],
) -> dict[QuizDifficulty, QuizGeneratorCore | None]:
    """One ADK Runner invocation against the quiz `ParallelAgent`.

    Runs all 3 difficulty variants in parallel under a single Runner
    + InMemorySession. After the run, reads each variant's slot
    from `session.state[variant_state_key(d)]`. Missing slots
    (variant raised, `_VariantWrapper` swallowed the exception)
    map to `None`.

    Returns:
        Dict of `{difficulty: QuizGeneratorCore | None}` for every
        difficulty in `_DIFFICULTIES`.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415

    parallel_agent, new_message = _attach_per_call_state(
        api_key=api_key,
        image_bytes=image_bytes,
        image_mime=image_mime,
        base_context=base_context,
    )

    runner = InMemoryRunner(agent=parallel_agent, app_name=_QUIZ_APP_NAME)

    user_id = "quiz-generator"
    session_id = f"quiz-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_QUIZ_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    # Drain all events. We don't need the events themselves (variants
    # write to session state via `output_key`); we just need to fully
    # exhaust the async iterator so ADK's `__maybe_save_output_to_state`
    # has a chance to fire on every variant's final event.
    async for _event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        # Drain — ADK accumulates state via append_event side-effects.
        pass

    # Read post-run session state.
    session = await runner.session_service.get_session(
        app_name=_QUIZ_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:  # pragma: no cover — InMemorySession never returns None
        raise AgentError(
            code="INTERNAL",
            message="ADK session disappeared mid-quiz",
            http_status=502,
        )

    results: dict[QuizDifficulty, QuizGeneratorCore | None] = {}
    for difficulty in _DIFFICULTIES:
        slot = session.state.get(variant_state_key(difficulty))
        if slot is None:
            results[difficulty] = None
            continue
        # ADK's `validate_schema` already validated the JSON against
        # QuizGeneratorCore and stored a dict (model_dump). Reconstruct
        # the BaseModel for the router's downstream consumers.
        try:
            results[difficulty] = QuizGeneratorCore.model_validate(slot)
        except Exception as exc:  # pragma: no cover — defensive
            log.warning(
                "quiz.variant.state_revalidation_failed",
                difficulty=difficulty,
                error=str(exc),
            )
            results[difficulty] = None
    return results


# ---- Endpoint -----------------------------------------------------------


@quiz_router.post("/generate", response_model=QuizVariantsResponse)
async def quiz_generate(payload: QuizGeneratorRequest) -> QuizVariantsResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    # Decode the optional image once (avoid re-parsing per variant).
    try:
        parsed = parse_data_uri_optional(payload.imageDataUri)
    except InvalidDataURIError as exc:
        raise AgentError(
            code="INVALID_INPUT",
            message=f"Invalid imageDataUri: {exc}",
            http_status=400,
        ) from exc

    image_mime, image_bytes = (None, None)
    if parsed is not None:
        image_mime, image_bytes = parsed

    # Phase J §J.3 — sanitize user-controlled string fields before
    # they land in the rendered prompt. The Handlebars template wraps
    # values in `⟦…⟧` markers, but those are advisory only.
    base_context: dict[str, Any] = {
        "topic": sanitize(payload.topic, max_length=500),
        "numQuestions": payload.numQuestions,
        "questionTypes": payload.questionTypes,
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "language": sanitize(payload.language or "English", max_length=20),
        "bloomsTaxonomyLevels": payload.bloomsTaxonomyLevels,
        "subject": sanitize_optional(payload.subject, max_length=100),
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=1000,
        ),
        "hasImage": image_bytes is not None,
        # `targetDifficulty` is filled in per-variant inside
        # `_attach_per_call_state` — one prompt rendered per difficulty.
    }

    async def _do(api_key: str) -> dict[QuizDifficulty, QuizGeneratorCore | None]:
        return await _run_quiz_via_runner(
            api_key=api_key,
            image_bytes=image_bytes,
            image_mime=image_mime,
            base_context=base_context,
        )

    try:
        # ParallelAgent runs all 3 variants concurrently inside one
        # Runner invocation. The retry / key-rotation budget applies
        # to the WHOLE 3-variant run as a unit — if 0 variants succeed
        # AND a retryable error surfaces (rare with the wrapper's
        # exception-swallowing), run_resiliently rotates to the next
        # key and re-runs all 3. In practice, the `_VariantWrapper`
        # eats per-variant errors so the parent run almost always
        # exits cleanly with partial results, and retries only fire
        # on infrastructure-level failures (network drop, etc.).
        results = await run_resiliently(
            _do,
            api_keys,
            span_name="quiz.parallel_agent",
            max_total_backoff_seconds=settings.max_total_backoff_seconds,
            per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
        )
    except AISafetyBlockError as exc:
        log.warning("quiz.safety_block", reason=str(exc))
        raise

    easy_core = results["easy"]
    medium_core = results["medium"]
    hard_core = results["hard"]
    variants_generated = sum(
        1 for v in (easy_core, medium_core, hard_core) if v is not None
    )

    if variants_generated == 0:
        raise AgentError(
            code="INTERNAL",
            message="All three quiz variants failed to generate",
            http_status=502,
        )

    # Behavioural guard runs across whichever variants succeeded.
    try:
        assert_quiz_response_rules(
            easy=easy_core.model_dump() if easy_core else None,
            medium=medium_core.model_dump() if medium_core else None,
            hard=hard_core.model_dump() if hard_core else None,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("quiz.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    def _to_response(
        core: QuizGeneratorCore | None,
    ) -> QuizGeneratorResponse | None:
        if core is None:
            return None
        return QuizGeneratorResponse(
            title=core.title,
            questions=core.questions,
            teacherInstructions=core.teacherInstructions,
            gradeLevel=core.gradeLevel,
            subject=core.subject,
        )

    # Pull metadata from any successful variant (prefer medium → easy → hard).
    metadata_source = medium_core or easy_core or hard_core
    grade_level = metadata_source.gradeLevel if metadata_source else None
    subject = metadata_source.subject if metadata_source else None

    latency_ms = int((time.perf_counter() - started) * 1000)
    # Forensic fix P1 #18: stamp `model_used` on the per-router event so
    # cost-per-user attribution joins via `request_id` (set in the
    # request_id middleware) without needing to re-parse the upstream
    # `ai_resilience.attempt_succeeded` lines. Token counts are NOT
    # extracted here because the ADK ParallelAgent doesn't surface a
    # single `result` object; per-variant tokens live in 3 separate
    # `ai_resilience.attempt_succeeded` events that share the
    # `request_id`. A downstream BigQuery / Looker join across
    # router events + resilience events on `request_id` reconstructs
    # the full picture.
    log.info(
        "quiz.generated",
        latency_ms=latency_ms,
        variants_generated=variants_generated,
        easy_ok=easy_core is not None,
        medium_ok=medium_core is not None,
        hard_ok=hard_core is not None,
        model_used=get_generator_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return QuizVariantsResponse(
        easy=_to_response(easy_core),
        medium=_to_response(medium_core),
        hard=_to_response(hard_core),
        gradeLevel=grade_level,
        subject=subject,
        topic=payload.topic,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
        variantsGenerated=variants_generated,
    )
