"""FastAPI sub-router for video storyteller (Phase F.1 + Phase U.beta).

Single Gemini call returns 5 categories of YouTube search-query strings
plus a personalised teacher message. Downstream YouTube ranking +
playlist building stays in the Next.js Genkit flow — this sidecar only
replaces the LLM call that produces the search queries.

Phase U.beta — the structured call now goes through ADK's
`Runner.run_async` against the cached `LlmAgent` built by
`build_video_storyteller_agent()`. Wire shape, request + response
schemas, behavioural guard, retry semantics — all unchanged. Only the
INTERNAL call mechanism switches from a hand-rolled
`google.genai.Client.aio.models.generate_content` to ADK's canonical
single-agent Runner.

Per-call the cached agent's `.model` is `model_copy()`-ed to swap in a
`Gemini` instance pinned to the current api_key, leaving the cached
template untouched between concurrent requests.
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
from ...shared.prompt_safety import sanitize
from ._guard import assert_video_storyteller_response_rules
from .agent import (
    build_video_storyteller_agent,
    get_recommender_model,
    render_recommender_prompt,
)
from .schemas import (
    VideoStorytellerCore,
    VideoStorytellerRequest,
    VideoStorytellerResponse,
)

log = structlog.get_logger(__name__)

video_storyteller_router = APIRouter(
    prefix="/v1/video-storyteller", tags=["video-storyteller"],
)

SIDECAR_VERSION = "phase-u.beta"

# Per-call timeout for run_resiliently. Recommender returns categorised
# search-query JSON; 20s caps a hung Gemini call without truncating
# slow but legitimate generations.
_PER_CALL_TIMEOUT_S = 20.0

# ADK Runner needs an app_name for the in-memory session service.
_VIDEO_STORYTELLER_APP_NAME = "sahayakai-video-storyteller"

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


def _build_pinned_agent(api_key: str) -> Any:
    """Build a per-call `LlmAgent` clone with `.model` pinned to api_key.

    The cached agent template is never mutated — `model_copy()` returns
    a fresh Pydantic instance each call.
    """
    template = build_video_storyteller_agent()
    template_model = template.model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return template.model_copy(
        update={
            "model": build_keyed_gemini(
                model_name=model_name, api_key=api_key,
            ),
        },
    )


async def _run_pipeline_via_runner(
    *, prompt: str, api_key: str,
) -> VideoStorytellerCore:
    """One ADK Runner invocation against the recommender LlmAgent.

    Builds a per-call `LlmAgent` by `model_copy`-ing the cached template
    and swapping in a `Gemini` instance pinned to `api_key`. The rendered
    prompt is shipped as the user `new_message` (NOT `instruction`) so
    ADK's `inject_session_state()` can't trip on `{var}` shapes leaking
    through sanitised user input.

    Drains every event from the Runner; accumulates non-`thought` text
    parts from the final event(s) into the JSON payload that
    `output_schema=VideoStorytellerCore` produced.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    agent_for_call = _build_pinned_agent(api_key)
    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_VIDEO_STORYTELLER_APP_NAME,
    )

    user_id = "video-storyteller-recommender"
    session_id = f"video-storyteller-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_VIDEO_STORYTELLER_APP_NAME,
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
        return VideoStorytellerCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "video_storyteller.recommender.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Recommender returned text that does not match "
                "VideoStorytellerCore"
            ),
            http_status=502,
        ) from exc


async def _run_recommender(
    payload: VideoStorytellerRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VideoStorytellerCore:
    # Phase J §J.3 — sanitize user-controlled strings before render.
    context = {
        "subject": sanitize(payload.subject, max_length=100),
        "gradeLevel": sanitize(payload.gradeLevel, max_length=50),
        "topic": sanitize(payload.topic or "", max_length=300),
        "language": sanitize(payload.language or "English", max_length=20),
        "state": sanitize(payload.state or "", max_length=100),
        "educationBoard": sanitize(
            payload.educationBoard or "", max_length=100,
        ),
    }
    prompt = render_recommender_prompt(context)

    async def _do(api_key: str) -> VideoStorytellerCore:
        return await _run_pipeline_via_runner(
            prompt=prompt, api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="video_storyteller.recommender",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


@video_storyteller_router.post(
    "/recommend-queries", response_model=VideoStorytellerResponse,
)
async def video_storyteller_recommend(
    payload: VideoStorytellerRequest,
) -> VideoStorytellerResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_recommender(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("video_storyteller.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("video_storyteller.recommender.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Video storyteller agent failed",
            http_status=502,
        ) from exc

    try:
        assert_video_storyteller_response_rules(
            pedagogy=list(core.categories.pedagogy),
            storytelling=list(core.categories.storytelling),
            govtUpdates=list(core.categories.govtUpdates),
            courses=list(core.categories.courses),
            topRecommended=list(core.categories.topRecommended),
            personalized_message=core.personalizedMessage,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("video_storyteller.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    # Phase U.beta — tokens are NOT extracted here because the ADK Runner
    # doesn't surface a single Gemini result object; per-attempt token
    # counts already live in `ai_resilience.attempt_succeeded` events
    # keyed on the same `request_id` (set by the request_id middleware).
    log.info(
        "video_storyteller.generated",
        latency_ms=latency_ms,
        subject=payload.subject,
        grade_level=payload.gradeLevel,
        language=payload.language,
        state=payload.state,
        education_board=payload.educationBoard,
        query_counts={
            "pedagogy": len(core.categories.pedagogy),
            "storytelling": len(core.categories.storytelling),
            "govtUpdates": len(core.categories.govtUpdates),
            "courses": len(core.categories.courses),
            "topRecommended": len(core.categories.topRecommended),
        },
        model_used=get_recommender_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return VideoStorytellerResponse(
        categories=core.categories,
        personalizedMessage=core.personalizedMessage,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_recommender_model(),
    )
