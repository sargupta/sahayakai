"""FastAPI sub-router for visual aid designer (Phase E.3 + Phase L.5).

Two-stage flow:
  1. Image generation → base64 PNG/JPEG bytes wrapped as data URI
  2. Metadata text generation → JSON {pedagogicalContext, discussionSpark, subject}

Phase L.5: both stages now run as a single ADK `SequentialAgent` driven
by `Runner.run_async`. The `LlmAgent` template is built once at module
load (cached); per-call we `model_copy()` each sub-agent to swap in a
key-pinned `Gemini` instance. The router consumes the runner events,
splits them by sub-agent name, and pulls image bytes from the image
agent's events + JSON text from the metadata agent's events.

Image generation has its own ~90s budget — too long for parallel
execution against a typical Twilio / API budget. The router-level
`asyncio.wait_for` budget is preserved.
"""
from __future__ import annotations

import asyncio
import base64
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
from ._guard import assert_visual_aid_response_rules
from .agent import (
    STATE_IMAGE_PROMPT,
    STATE_METADATA_PROMPT,
    build_visual_aid_agent,
    get_image_model,
    get_metadata_model,
    render_image_prompt,
    render_metadata_prompt,
)
from .schemas import (
    VisualAidMetadata,
    VisualAidRequest,
    VisualAidResponse,
)

log = structlog.get_logger(__name__)

visual_aid_router = APIRouter(prefix="/v1/visual-aid", tags=["visual-aid"])

SIDECAR_VERSION = "phase-l.5"

# Per the existing Genkit flow, image generation can stall on complex
# prompts. Cap with a hard 120s timeout independent of run_resiliently's
# budget (which is tuned for telephony-bound replies).
#
# Phase M.3: bumped from 90s → 120s. Forensic finding — at 90s, two
# 30s failed attempts left only 30s for the third attempt under the
# old 7s `max_total_backoff_seconds`. The per-call wait_for would
# evaporate the budget. 120s gives every attempt its full ceiling.
_IMAGE_TIMEOUT_S = 120.0

# Whole-pipeline (image + metadata) budget. Mirrors the pre-L.5
# image-stage cap; metadata is fast (~5s) so the combined ceiling is
# still ~120s with margin.
_PIPELINE_TIMEOUT_S = 120.0

# Phase M.3: image-specific backoff budget. Default `run_resiliently`
# uses telephony-bound 7s; for image agents we override to 4s so a
# single transient retry can occur but liberal retries are off the
# table — image cost is $0.04/call so we'd rather fail fast than
# stack 3+ image attempts at $0.12.
_IMAGE_MAX_TOTAL_BACKOFF_S = 4.0

# ADK Runner needs an app_name for the in-memory session service.
_VISUAL_AID_APP_NAME = "sahayakai-visual-aid"

# Sub-agent names — must match `agent.py`'s factories.
_IMAGE_AGENT_NAME = "visual_aid_image"
_METADATA_AGENT_NAME = "visual_aid_metadata"

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


async def _consume_pipeline_events(
    events: Any,
) -> tuple[bytes | None, str | None, str]:
    """Walk a Runner event-stream; pull image bytes from the image
    sub-agent's events + metadata text from the metadata sub-agent's
    events. Returns `(image_bytes, image_mime, metadata_text)`.

    Extracted from `_run_pipeline_via_runner` to keep that function
    under the cyclomatic-complexity budget. The split is purely
    structural — no behavioural change.
    """
    image_bytes: bytes | None = None
    image_mime: str | None = None
    metadata_text = ""

    async for event in events:
        author = getattr(event, "author", None) or ""
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            new_image, new_mime = _maybe_extract_image_part(part, author)
            if new_image is not None:
                image_bytes = new_image
                image_mime = new_mime
            metadata_text += _maybe_extract_metadata_text(part, author)

    return image_bytes, image_mime, metadata_text


def _maybe_extract_image_part(
    part: Any, author: str,
) -> tuple[bytes | None, str | None]:
    """Pull `(bytes, mime)` if the part is an inline-data image emitted
    by the image sub-agent. Returns `(None, None)` otherwise."""
    if author != _IMAGE_AGENT_NAME:
        return None, None
    inline = getattr(part, "inline_data", None)
    if inline is None:
        return None, None
    data = getattr(inline, "data", None)
    if not data:
        return None, None
    mime = getattr(inline, "mime_type", None) or "image/png"
    if isinstance(data, str):
        # google-genai returns either base64-encoded bytes OR raw bytes
        # depending on SDK version. Normalise to raw bytes.
        try:
            return base64.b64decode(data, validate=True), mime
        except Exception:
            return data.encode("utf-8"), mime
    return data, mime


def _maybe_extract_metadata_text(part: Any, author: str) -> str:
    """Pull text emitted by the metadata sub-agent (skipping ADK
    `thought` parts that do not belong in the structured-JSON output)."""
    if author != _METADATA_AGENT_NAME:
        return ""
    text = getattr(part, "text", None)
    if not text:
        return ""
    if getattr(part, "thought", False):
        return ""
    return str(text)



def _build_pinned_pipeline(api_key: str) -> Any:
    """Build a per-call SequentialAgent with each sub-agent's `.model`
    swapped to a `Gemini` instance pinned to `api_key`.

    The cached agent itself is never mutated — `clone()` returns a
    fresh agent instance with the requested updates.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415

    template = build_visual_aid_agent()
    pinned_subs = []
    for sub in template.sub_agents:
        # Both visual-aid sub-agents are LlmAgents (pinned by the
        # unit tests). The mypy narrow keeps `.model` accessible.
        assert isinstance(sub, LlmAgent), (
            f"visual-aid sub-agents must be LlmAgents; got {type(sub).__name__}"
        )
        sub_model = sub.model
        model_name = (
            sub_model if isinstance(sub_model, str) else sub_model.model
        )
        pinned_subs.append(
            sub.clone(
                update={
                    "model": build_keyed_gemini(
                        model_name=model_name, api_key=api_key,
                    ),
                }
            )
        )
    return template.clone(update={"sub_agents": pinned_subs})


async def _run_pipeline_via_runner(
    *,
    image_prompt: str,
    metadata_prompt: str,
    api_key: str,
) -> tuple[bytes, str, VisualAidMetadata]:
    """One ADK Runner invocation against the visual-aid SequentialAgent.

    Populates session state with both rendered prompts via
    `state_delta`; the sub-agents read their respective prompts via
    `instruction` callables (see `agent.py`).

    Returns `(image_bytes, image_mime, metadata)` extracted from the
    runner events. Raises `AgentError` if either stage is missing or
    malformed.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    pipeline = _build_pinned_pipeline(api_key)
    runner = InMemoryRunner(agent=pipeline, app_name=_VISUAL_AID_APP_NAME)

    user_id = "visual-aid-pipeline"
    session_id = f"visual-aid-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_VISUAL_AID_APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={
            STATE_IMAGE_PROMPT: image_prompt,
            STATE_METADATA_PROMPT: metadata_prompt,
        },
    )

    # `new_message` is required — pass a no-op user content; each
    # sub-agent sources its actual prompt from session state.
    trigger_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text="proceed")],
    )

    image_bytes, image_mime, metadata_text = await _consume_pipeline_events(
        runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=trigger_message,
        ),
    )

    if image_bytes is None or image_mime is None:
        raise AgentError(
            code="INTERNAL",
            message="Image generation returned no inline image data",
            http_status=502,
        )

    if not metadata_text.strip():
        raise AgentError(
            code="INTERNAL",
            message="Metadata stage returned empty response",
            http_status=502,
        )

    try:
        metadata = VisualAidMetadata.model_validate_json(metadata_text)
    except Exception as exc:
        log.error(
            "visual_aid.metadata.json_parse_failed",
            raw_excerpt=metadata_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Metadata returned text that does not match VisualAidMetadata"
            ),
            http_status=502,
        ) from exc

    return image_bytes, image_mime, metadata


async def _run_pipeline(
    payload: VisualAidRequest,
    api_keys: tuple[str, ...],
) -> tuple[bytes, str, VisualAidMetadata]:
    """Run the SequentialAgent through `run_resiliently`.

    Phase J §J.3 — sanitize the user-controlled inputs before rendering
    EITHER prompt. Image-gen prompts are particularly vulnerable: an
    attacker could try to push the model toward generating
    inappropriate content via injected instructions.
    """
    context = {
        "prompt": sanitize(payload.prompt, max_length=2000),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "language": sanitize_optional(payload.language, max_length=20),
    }
    image_prompt = render_image_prompt(context)
    metadata_prompt = render_metadata_prompt(context)

    async def _do(api_key: str) -> tuple[bytes, str, VisualAidMetadata]:
        return await _run_pipeline_via_runner(
            image_prompt=image_prompt,
            metadata_prompt=metadata_prompt,
            api_key=api_key,
        )

    try:
        result: tuple[bytes, str, VisualAidMetadata] = await asyncio.wait_for(
            run_resiliently(
                _do,
                api_keys,
                span_name="visual_aid.pipeline",
                # Phase M.3: image agents override the global telephony
                # backoff. See `_IMAGE_MAX_TOTAL_BACKOFF_S`.
                max_total_backoff_seconds=_IMAGE_MAX_TOTAL_BACKOFF_S,
                per_call_timeout_seconds=_IMAGE_TIMEOUT_S,
            ),
            timeout=_PIPELINE_TIMEOUT_S,
        )
    except TimeoutError as exc:
        raise AgentError(
            code="INTERNAL",
            message=(
                f"Visual-aid pipeline timed out after {_PIPELINE_TIMEOUT_S}s"
            ),
            http_status=502,
        ) from exc
    return result


@visual_aid_router.post("/generate", response_model=VisualAidResponse)
async def visual_aid_generate(
    payload: VisualAidRequest,
) -> VisualAidResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        image_bytes, image_mime, metadata = await _run_pipeline(
            payload, api_keys,
        )
    except AISafetyBlockError as exc:
        log.warning("visual_aid.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("visual_aid.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Visual aid pipeline failed",
            http_status=502,
        ) from exc

    # Build the data URI from raw image bytes.
    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    image_data_uri = f"data:{image_mime};base64,{image_b64}"

    # Behavioural guard.
    try:
        assert_visual_aid_response_rules(
            image_data_uri=image_data_uri,
            pedagogical_context=metadata.pedagogicalContext,
            discussion_spark=metadata.discussionSpark,
            subject=metadata.subject,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("visual_aid.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    # Forensic fix P1 #18: stamp `model_used` on the per-router event.
    # Token counts are NOT extracted here because the ADK SequentialAgent
    # doesn't surface a single `result` object; per-stage tokens live in
    # 2 separate `ai_resilience.attempt_succeeded` events that share the
    # `request_id` set by the request_id middleware. Image generation
    # also bills per image, not per token.
    log.info(
        "visual_aid.generated",
        latency_ms=latency_ms,
        image_bytes_len=len(image_bytes),
        image_mime=image_mime,
        language=payload.language,
        grade_level=payload.gradeLevel,
        model_used=get_image_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return VisualAidResponse(
        imageDataUri=image_data_uri,
        pedagogicalContext=metadata.pedagogicalContext,
        discussionSpark=metadata.discussionSpark,
        subject=metadata.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        imageModelUsed=get_image_model(),
        metadataModelUsed=get_metadata_model(),
    )
