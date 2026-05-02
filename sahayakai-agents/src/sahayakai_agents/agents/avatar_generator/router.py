"""FastAPI sub-router for avatar generator (Phase F.2 + Phase L.5).

Single image-generation call returning a base64 PNG/JPEG wrapped as a
data URI. No metadata. Storage write happens in Next.js after this
sidecar returns.

Phase L.5: the single stage now runs through ADK's `Runner.run_async`
against a degenerate `SequentialAgent` of 1 sub-agent. Wire shape,
request + response schemas, behavioural guard, retry semantics —
all unchanged.

Image generation can stall on complex prompts. We cap the call with a
hard 90s timeout, independent of `run_resiliently`'s telephony-bound
budget, mirroring the visual-aid router.
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
from ...shared.prompt_safety import sanitize
from ._guard import assert_avatar_response_rules
from .agent import (
    STATE_PORTRAIT_PROMPT,
    build_avatar_agent,
    get_image_model,
    render_portrait_prompt,
)
from .schemas import (
    AvatarGeneratorRequest,
    AvatarGeneratorResponse,
)

log = structlog.get_logger(__name__)

avatar_generator_router = APIRouter(
    prefix="/v1/avatar-generator", tags=["avatar-generator"],
)

SIDECAR_VERSION = "phase-l.5"

_IMAGE_TIMEOUT_S = 90.0

# ADK Runner needs an app_name for the in-memory session service.
_AVATAR_APP_NAME = "sahayakai-avatar"

# Sub-agent name — must match `agent.py`.
_PORTRAIT_AGENT_NAME = "avatar_portrait"


def _build_pinned_pipeline(api_key: str) -> Any:
    """Build a per-call SequentialAgent with the sub-agent's `.model`
    swapped to a `Gemini` instance pinned to `api_key`."""
    from google.adk.agents import LlmAgent  # noqa: PLC0415

    template = build_avatar_agent()
    pinned_subs = []
    for sub in template.sub_agents:
        assert isinstance(sub, LlmAgent), (
            f"avatar sub-agents must be LlmAgents; got {type(sub).__name__}"
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
    portrait_prompt: str,
    api_key: str,
) -> tuple[bytes, str]:
    """One ADK Runner invocation against the avatar SequentialAgent.

    Returns `(image_bytes, image_mime)` extracted from the runner
    events. Raises `AgentError` if the image data is missing.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    pipeline = _build_pinned_pipeline(api_key)
    runner = InMemoryRunner(agent=pipeline, app_name=_AVATAR_APP_NAME)

    user_id = "avatar-pipeline"
    session_id = f"avatar-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_AVATAR_APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={STATE_PORTRAIT_PROMPT: portrait_prompt},
    )

    trigger_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text="proceed")],
    )

    image_bytes: bytes | None = None
    image_mime: str | None = None

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=trigger_message,
    ):
        author = getattr(event, "author", None) or ""
        if author != _PORTRAIT_AGENT_NAME:
            continue
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            inline = getattr(part, "inline_data", None)
            if inline is not None:
                data = getattr(inline, "data", None)
                mime = getattr(inline, "mime_type", None) or "image/png"
                if data:
                    if isinstance(data, str):
                        try:
                            image_bytes = base64.b64decode(data, validate=True)
                        except Exception:
                            image_bytes = data.encode("utf-8")
                    else:
                        image_bytes = data
                    image_mime = mime

    if image_bytes is None or image_mime is None:
        raise AgentError(
            code="INTERNAL",
            message="Avatar generation returned no inline image data",
            http_status=502,
        )

    return image_bytes, image_mime


async def _run_image(
    payload: AvatarGeneratorRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[bytes, str]:
    # Phase J §J.3 — sanitize the user-supplied display name. The
    # `name` field is small (100 chars) but still flows VERBATIM into
    # an image-generation prompt; an attacker could push the model
    # toward inappropriate content via injected instructions.
    context = {"name": sanitize(payload.name, max_length=100)}
    portrait_prompt = render_portrait_prompt(context)

    async def _do(api_key: str) -> tuple[bytes, str]:
        return await _run_pipeline_via_runner(
            portrait_prompt=portrait_prompt, api_key=api_key,
        )

    try:
        result: tuple[bytes, str] = await asyncio.wait_for(
            run_resiliently(
                _do,
                api_keys,
                span_name="avatar.generate",
                max_total_backoff_seconds=settings.max_total_backoff_seconds,
                per_call_timeout_seconds=_IMAGE_TIMEOUT_S,
            ),
            timeout=_IMAGE_TIMEOUT_S,
        )
    except TimeoutError as exc:
        raise AgentError(
            code="INTERNAL",
            message=f"Avatar generation timed out after {_IMAGE_TIMEOUT_S}s",
            http_status=502,
        ) from exc
    return result


@avatar_generator_router.post(
    "/generate", response_model=AvatarGeneratorResponse,
)
async def avatar_generate(
    payload: AvatarGeneratorRequest,
) -> AvatarGeneratorResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        image_bytes, image_mime = await _run_image(
            payload, api_keys, settings,
        )
    except AISafetyBlockError as exc:
        log.warning("avatar.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("avatar.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Avatar image generation failed",
            http_status=502,
        ) from exc

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    image_data_uri = f"data:{image_mime};base64,{image_b64}"

    try:
        assert_avatar_response_rules(image_data_uri=image_data_uri)
    except AssertionError as exc:
        log.error("avatar.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "avatar.generated",
        latency_ms=latency_ms,
        image_bytes_len=len(image_bytes),
        image_mime=image_mime,
    )
    return AvatarGeneratorResponse(
        imageDataUri=image_data_uri,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_image_model(),
    )
