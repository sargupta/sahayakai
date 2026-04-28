"""FastAPI sub-router for exam paper generator.

Phase E.2 introduced the agent as a hand-rolled
`google.genai.Client.aio.models.generate_content` call. Phase U.γ
promotes the call surface to ADK's `Runner.run_async` against the
`LlmAgent` built by `build_exam_paper_agent()`. Wire shape, request +
response schemas, behavioural guard, retry semantics — all unchanged.
Only the INTERNAL call mechanism switches.

Why a single `LlmAgent` rather than a `SequentialAgent` of writer +
LLM validator (Option A from the Phase U.γ brief):

  - The validation we already do is a marks-balance arithmetic check
    plus a behavioural guard (forbidden-phrase scan + script match).
    Both are pure-Python — running them inside an LLM validator would
    waste tokens AND let the model lie about marks. The arithmetic
    check is also faster and cheaper as Python.
  - Cost cap stays at exactly 1 Gemini call per request, identical to
    the pre-U.γ flow. The router cost analysis stays valid.
  - The wire output is a single structured `ExamPaperCore` JSON which
    maps 1:1 to ADK's `output_schema=ExamPaperCore`.

Marks-balance + behavioural guard live in `_guard.py`. The router
applies them after the Runner returns; on failure we map AssertionError
→ 502 same as the pre-U.γ flow.
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
from ...shared.prompt_safety import sanitize, sanitize_list, sanitize_optional
from ._guard import assert_exam_paper_response_rules
from .agent import (
    build_exam_paper_agent,
    get_generator_model,
    render_generator_prompt,
)
from .schemas import ExamPaperCore, ExamPaperRequest, ExamPaperResponse

log = structlog.get_logger(__name__)

exam_paper_router = APIRouter(prefix="/v1/exam-paper", tags=["exam-paper"])

# Phase U.γ — bumped to mark the ADK promotion. The wire schema is
# unchanged so existing TS clients continue to work; the version bump
# only affects telemetry correlation in the dashboards.
SIDECAR_VERSION = "phase-u.gamma"

# Per-call timeout for run_resiliently. Exam papers are large structured
# outputs (multiple sections + marking scheme), so 30s gives room while
# preventing a hung Gemini call from blocking the route.
_PER_CALL_TIMEOUT_S = 30.0

# ADK Runner needs an app_name for the in-memory session service.
# This is opaque to the model — it's just a session-store key prefix.
_EXAM_PAPER_APP_NAME = "sahayakai-exam-paper"

_LANGUAGE_NAME_TO_ISO: dict[str, str] = {
    "english": "en", "hindi": "hi", "tamil": "ta", "telugu": "te",
    "kannada": "kn", "malayalam": "ml", "bengali": "bn", "marathi": "mr",
    "gujarati": "gu", "punjabi": "pa", "odia": "or",
}


def _iso_for_lang(language: str | None) -> str:
    if not language:
        return "en"
    key = language.strip().lower()
    return _LANGUAGE_NAME_TO_ISO.get(key, key[:2] if len(key) >= 2 else "en")


# ---- ADK Runner orchestration -------------------------------------------


def _build_pinned_agent(api_key: str) -> Any:
    """Build a per-call `LlmAgent` with `.model` swapped to a `Gemini`
    instance pinned to `api_key`.

    Uses ADK 1.31's canonical `clone(update={...})` API (per Phase U
    finding #4); does NOT mutate the cached template. The template's
    `.model` is a string (see `build_exam_paper_agent`), and we coerce
    to `str` here so a future change that swaps in a `BaseLlm` doesn't
    silently feed `BaseLlm` into `build_keyed_gemini`.
    """
    template = build_exam_paper_agent()
    template_model = template.model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return template.clone(
        update={
            "model": build_keyed_gemini(
                model_name=model_name, api_key=api_key,
            ),
        }
    )


async def _run_generator_via_runner(
    *, prompt: str, api_key: str,
) -> ExamPaperCore:
    """One ADK Runner invocation against the exam-paper LlmAgent.

    Drives the cached `LlmAgent` template with a per-call clone whose
    `.model` is a key-pinned `Gemini` instance. The rendered prompt is
    passed as `new_message` (user content) — NOT as the agent's
    `instruction` — because:
      - The agent's `instruction` would go through ADK's
        `inject_session_state()` which scans for `{name}` patterns;
        teacher-controlled inputs may legitimately contain `{...}`
        shapes (e.g. someone typing math like `{x: 1, y: 2}` in
        `teacherContext`) that would trigger a spurious KeyError.
      - Putting it in `new_message` is the canonical way to pass
        per-request user input through ADK; matches what the previous
        `_call_gemini_structured` did (prompt → `contents`).

    Returns a parsed `ExamPaperCore` from the final event's text.
    Raises `AgentError(502)` on empty / unparseable output.

    This function is also the surgical patch point for the integration
    tests — `tests/integration/test_exam_paper_router.py` monkey-
    patches it to a queue fake, bypassing the Runner machinery
    (which is itself covered by ADK's own test suite + the static
    shape tests in `tests/unit/test_exam_paper_adk.py`).
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    agent_for_call = _build_pinned_agent(api_key)
    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_EXAM_PAPER_APP_NAME,
    )

    # InMemoryRunner uses InMemorySessionService; we must create a
    # session before run_async (no auto_create_session by default).
    user_id = "exam-paper-generator"
    session_id = f"exam-paper-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_EXAM_PAPER_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=prompt)],
    )

    final_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        # Accumulate text from final-response events. A single
        # output_schema call typically yields one final event whose
        # content.parts[0].text is the full JSON.
        if event.content and event.content.parts:
            for part in event.content.parts:
                text = getattr(part, "text", None)
                if text and not getattr(part, "thought", False):
                    final_text += str(text)

    if not final_text.strip():
        raise AgentError(
            code="INTERNAL",
            message="Gemini returned empty response",
            http_status=502,
        )

    try:
        return ExamPaperCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "exam_paper.generator.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Generator returned text that does not match ExamPaperCore",
            http_status=502,
        ) from exc


async def _run_generator(
    payload: ExamPaperRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> ExamPaperCore:
    """Render the prompt and dispatch one ADK Runner invocation through
    the resilience layer.

    Phase J §J.3 — sanitize user-controlled strings before they
    land in the rendered prompt. The Handlebars template wraps
    values in `⟦…⟧` markers, but those are advisory only.
    """
    context = {
        "board": sanitize(payload.board, max_length=100),
        "gradeLevel": sanitize(payload.gradeLevel, max_length=50),
        "subject": sanitize(payload.subject, max_length=100),
        "chapters": sanitize_list(payload.chapters, max_length=200),
        "duration": payload.duration,
        "maxMarks": payload.maxMarks,
        "language": sanitize(payload.language, max_length=20),
        "difficulty": payload.difficulty,
        "includeAnswerKey": payload.includeAnswerKey,
        "includeMarkingScheme": payload.includeMarkingScheme,
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=1000,
        ),
    }
    prompt = render_generator_prompt(context)

    async def _do(api_key: str) -> ExamPaperCore:
        return await _run_generator_via_runner(
            prompt=prompt, api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="exam_paper.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


# ---- Endpoint ------------------------------------------------------------


@exam_paper_router.post("/generate", response_model=ExamPaperResponse)
async def exam_paper_generate(payload: ExamPaperRequest) -> ExamPaperResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_generator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("exam_paper.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("exam_paper.generator.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Exam paper generator agent failed",
            http_status=502,
        ) from exc

    # Marks-balance + behavioural guard. Stays in pure-Python (Option B
    # from the Phase U.γ brief) — see `agent.py` module docstring.
    try:
        assert_exam_paper_response_rules(
            title=core.title,
            general_instructions=core.generalInstructions,
            sections=[s.model_dump() for s in core.sections],
            max_marks=core.maxMarks,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("exam_paper.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    # Phase U.γ: per-router success log so the dashboard can join
    # `exam_paper.generated` × `ai_resilience.attempt_succeeded` on
    # `request_id` (set by the request_id middleware) for cost
    # attribution. Tokens are NOT extracted here because ADK's Runner
    # doesn't surface a single `result` object; per-attempt token
    # counts already live in the ai_resilience event keyed on the
    # same `request_id`.
    log.info(
        "exam_paper.generated",
        latency_ms=latency_ms,
        board=payload.board,
        grade=payload.gradeLevel,
        subject=payload.subject,
        sections=len(core.sections),
        model_used=get_generator_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return ExamPaperResponse(
        title=core.title,
        board=core.board,
        subject=core.subject,
        gradeLevel=core.gradeLevel,
        duration=core.duration,
        maxMarks=core.maxMarks,
        generalInstructions=core.generalInstructions,
        sections=core.sections,
        blueprintSummary=core.blueprintSummary,
        pyqSources=core.pyqSources,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
