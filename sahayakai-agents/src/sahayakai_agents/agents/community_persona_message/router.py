"""FastAPI sub-router for the community-persona-message agent.

Single-stage flow: render prompt → ADK Runner against `LlmAgent`
(plain-text output) → string cleanup → length checks → wire response.

Defence-in-depth:
  - `mode` from the wire request is a `Literal` so only the three
    known values reach the prompt; `modeInstruction` is rewritten
    server-side from the canonical `MODE_INSTRUCTION` map.
  - `recentMessages` rendered into a single bounded string before
    template injection (no leakage into instruction tokens).
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini_from_template
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize
from .agent import (
    MODE_INSTRUCTION,
    build_community_persona_message_agent,
    get_generator_model,
    render_generator_prompt,
)
from .schemas import (
    CommunityPersonaMessageRequest,
    CommunityPersonaMessageResponse,
)

log = structlog.get_logger(__name__)

community_persona_message_router = APIRouter(
    prefix="/v1/community-persona-message",
    tags=["community-persona-message"],
)

SIDECAR_VERSION = "phase-w.alpha"

# Per-call timeout. A persona message is short, single-field; 8s is
# plenty even for the largest Gemini tail.
_PER_CALL_TIMEOUT_S = 8.0

_PERSONA_APP_NAME = "sahayakai-community-persona-message"

# Hard caps mirror the TS flow's post-cleanup behaviour.
_HARD_TRIM_AT = 240
_MIN_CLEANED_LEN = 5


# ---- ADK Runner helpers -------------------------------------------------


def _build_keyed_gemini(api_key: str) -> Any:
    return build_keyed_gemini_from_template(
        build_community_persona_message_agent, api_key,
    )


def _render_recent_block(
    recent: list[dict[str, str]],
) -> str:
    """Pre-render the recent-messages block as a single sanitized string.

    Each entry is sanitized + length-bounded BEFORE concatenation so a
    hostile `text` field cannot inject prompt instructions through the
    Handlebars triple-stash. Matches the TS flow's quote-escaping.
    """
    if not recent:
        return "(The chat is empty — start something new.)"
    lines: list[str] = []
    for m in recent:
        author = sanitize(m["authorName"], max_length=200)
        text = sanitize(m["text"], max_length=2000).replace('"', "'")
        lines.append(f'- {author}: "{text}"')
    return "\n".join(lines)


async def _run_pipeline_via_runner(
    *, prompt: str, api_key: str,
) -> str:
    """One ADK Runner invocation; returns the raw model text.

    No `output_schema` on this agent (plain-text by design — see
    `agent.build_community_persona_message_agent` docstring), so the
    router collects the model's text and returns it raw. Cleanup +
    length checks happen one layer up.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    template = build_community_persona_message_agent()
    agent_for_call = template.model_copy(
        update={"model": _build_keyed_gemini(api_key)}
    )

    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_PERSONA_APP_NAME,
    )

    user_id = "community-persona-message-generator"
    session_id = f"community-persona-message-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_PERSONA_APP_NAME,
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
    return final_text


# ---- Cleanup pipeline (mirrors the TS flow) -----------------------------


_CODE_FENCE_LEAD = re.compile(r"^```[a-zA-Z]*\n?")
_CODE_FENCE_TAIL = re.compile(r"\n?```$")
_LEAD_QUOTE = re.compile(r'^["“”]+')
_TRAIL_QUOTE = re.compile(r'["“”]+$')


def _clean_persona_message(raw: str, persona_name: str) -> str:
    """Apply the same cleanup the TS flow does.

    1. strip code-fences
    2. strip surrounding straight + curly quotes
    3. strip leading "Name:" prefix if model added it
    4. hard cap at 240 chars on a word boundary, append ellipsis
    5. reject if cleaned length < 5
    """
    cleaned = raw.strip()
    cleaned = _CODE_FENCE_LEAD.sub("", cleaned)
    cleaned = _CODE_FENCE_TAIL.sub("", cleaned)
    cleaned = cleaned.strip()
    cleaned = _LEAD_QUOTE.sub("", cleaned)
    cleaned = _TRAIL_QUOTE.sub("", cleaned)
    # Strip a leading "<personaName>:" prefix the model sometimes adds.
    name_prefix = re.compile(
        rf"^{re.escape(persona_name)}\s*:\s*", re.IGNORECASE,
    )
    cleaned = name_prefix.sub("", cleaned).strip()

    if len(cleaned) > _HARD_TRIM_AT:
        cut = cleaned[:_HARD_TRIM_AT]
        last_space = cut.rfind(" ")
        if last_space > 100:
            cleaned = cut[:last_space].rstrip() + "…"
        else:
            cleaned = cut.rstrip() + "…"

    if len(cleaned) < _MIN_CLEANED_LEN:
        raise AgentError(
            code="INTERNAL",
            message=f"Persona message too short after cleanup: {cleaned!r}",
            http_status=502,
        )
    return cleaned


# ---- Single-stage runner ------------------------------------------------


async def _run_generator(
    payload: CommunityPersonaMessageRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> str:
    """Run the generator agent. Returns the cleaned persona message."""
    persona_name_clean = sanitize(payload.personaName, max_length=200)
    mode_instruction = MODE_INSTRUCTION[payload.mode]
    recent_block = _render_recent_block(
        [
            {"authorName": m.authorName, "text": m.text}
            for m in payload.recentMessages
        ]
    )

    context = {
        "personaName": persona_name_clean,
        "personaState": sanitize(payload.personaState, max_length=100),
        "personaSubject": sanitize(payload.personaSubject, max_length=100),
        "personaGradeLevel": sanitize(
            payload.personaGradeLevel, max_length=50,
        ),
        "personaVoiceTone": sanitize(payload.personaVoiceTone, max_length=500),
        "preferredLanguage": sanitize(
            payload.preferredLanguage, max_length=50,
        ),
        "yearsExperience": payload.yearsExperience,
        "recentBlock": recent_block,
        "mode": payload.mode,
        "modeInstruction": mode_instruction,
    }
    prompt = render_generator_prompt(context)

    async def _do(api_key: str) -> str:
        raw = await _run_pipeline_via_runner(
            prompt=prompt, api_key=api_key,
        )
        # Cleanup runs inside the retry loop so a "too short" failure
        # can re-roll on a fresh key.
        return _clean_persona_message(raw, persona_name_clean)

    return await run_resiliently(
        _do,
        api_keys,
        span_name="community_persona_message.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


# ---- Endpoint -----------------------------------------------------------


@community_persona_message_router.post(
    "/generate", response_model=CommunityPersonaMessageResponse,
)
async def community_persona_message_generate(
    payload: CommunityPersonaMessageRequest,
) -> CommunityPersonaMessageResponse:
    """Generate ONE short in-character persona message.

    Flow:
      1. Sanitize + render prompt (recent messages collapsed into a
         single bounded string; mode rewritten from the canonical map).
      2. One Gemini plain-text call.
      3. Cleanup pipeline (code-fences, quotes, name-prefix, hard cap).
      4. Wrap timing telemetry.
    """
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        message = await _run_generator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning(
            "community_persona_message.generator.safety_block",
            reason=str(exc),
        )
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error(
            "community_persona_message.generator.failed", error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Community-persona-message generator agent failed",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "community_persona_message.generated",
        latency_ms=latency_ms,
        preferred_language=payload.preferredLanguage,
        mode=payload.mode,
        char_count=len(message),
        model_used=get_generator_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return CommunityPersonaMessageResponse(
        message=message,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
