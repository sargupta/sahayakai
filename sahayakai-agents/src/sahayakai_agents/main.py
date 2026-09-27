"""FastAPI entry point for sahayakai-agents.

Responsibilities:
- Health + readiness probes (public).
- A2A agent card at `/.well-known/agent.json` (public).
- Auth + HMAC middleware for every other route.
- Telemetry init on startup.
- Per-agent sub-routers.

Review trace:
- P1 #13 A2A hedge: the agent card is published on first boot.
- P2 #26 financial kill switch: handled by Cloud Monitoring alert outside this
  process. The process just surfaces the `sidecar_cost_paise` metric via
  OpenTelemetry.
"""
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .agent_card import build_agent_card
from .agents.assessment_scanner.router import assessment_scanner_router
from .agents.assignment_assessor.router import assignment_assessor_router
from .agents.avatar_generator.router import avatar_generator_router
from .agents.community_persona_message.router import (
    community_persona_message_router,
)
from .agents.exam_paper.router import exam_paper_router
from .agents.instant_answer.router import instant_answer_router
from .agents.lesson_plan.router import router as lesson_plan_router
from .agents.parent_call.router import router as parent_call_router
from .agents.parent_message.router import parent_message_router
from .agents.quiz.router import quiz_router
from .agents.rubric.router import rubric_router
from .agents.teacher_training.router import teacher_training_router
from .agents.video_storyteller.router import video_storyteller_router
from .agents.vidya.router import vidya_router
from .agents.vidya_voice.router import vidya_voice_router
from .agents.virtual_field_trip.router import virtual_field_trip_router
from .agents.visual_aid.router import visual_aid_router
from .agents.voice_to_text.router import voice_to_text_router
from .agents.worksheet.router import worksheet_router
from .auth import auth_middleware
from .config import get_settings
from .logging_config import configure_logging
from .shared.errors import AgentError
from .shared.genai_patch import apply_genai_schema_patch
from .telemetry import init_telemetry
from .telephony.router import telephony_router

# Strip `additionalProperties` from every schema we hand to Gemini. Pydantic
# emits it from `extra="forbid"` configs but Gemini's structured-output API
# rejects it (HTTP 400 INVALID_ARGUMENT). Applying the patch at module import
# guarantees both direct google-genai calls AND ADK `LlmAgent.output_schema`
# go through the cleaned schema.
apply_genai_schema_patch()

log = structlog.get_logger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):  # type: ignore[no-untyped-def]
    """Lifespan context: init telemetry on startup; flush on shutdown.

    `get_settings()` is called here (not at import) so environment variables
    set by Cloud Run at container start are visible.
    """
    settings = get_settings()
    configure_logging()
    log.info(
        "app.startup",
        env=settings.env,
        region=settings.gcp_region,
        project=settings.gcp_project,
    )
    # Pass the app so FastAPIInstrumentor actually wraps it (Round-2 P1-8).
    init_telemetry(app)
    yield
    log.info("app.shutdown")


# `SAHAYAKAI_TELEPHONY_ONLY` selects the route surface (see "Route surface"
# below). Read from the environment rather than Settings because it decides
# which routes exist at import time, before any request is served, and before
# `app` is constructed.
TELEPHONY_ONLY = os.environ.get("SAHAYAKAI_TELEPHONY_ONLY", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

app = FastAPI(
    title="sahayakai-agents",
    version="0.1.0",
    description="Python sidecar for SahayakAI stateful and voice AI agents.",
    lifespan=_lifespan,
    # Docs are on in non-prod; we never want them on a publicly reachable
    # prod URL because they leak schema surface. The telephony service is
    # publicly INVOKABLE in every environment, so it publishes no docs and no
    # schema regardless of env: they would describe an API it does not serve,
    # and a public OpenAPI document is free reconnaissance.
    docs_url="/docs" if (get_settings().env != "production" and not TELEPHONY_ONLY) else None,
    redoc_url="/redoc" if (get_settings().env != "production" and not TELEPHONY_ONLY) else None,
    openapi_url=None if TELEPHONY_ONLY else "/openapi.json",
)


# ---- Middleware ------------------------------------------------------------
#
# FastAPI registers `@app.middleware("http")` in REVERSE order: the most
# recently decorated function wraps the earlier ones, so it runs FIRST on
# the way in. We want request_id to be bound BEFORE the auth middleware
# runs so every log line (including auth-failure logs and the auth
# middleware's own structlog calls) inherits the request_id via
# `merge_contextvars`. That means the request_id middleware must be
# decorated AFTER `_auth_mw` in source order — yes, it's counter-
# intuitive. The trade-off: an unauthenticated request still gets a
# request_id stamped on its failure-response header, which is the
# correct behaviour for client-side correlation. The contextvars are
# `clear_contextvars()`-reset at the start of every request so state
# from a previous request can never leak forward.


@app.middleware("http")
async def _auth_mw(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Wraps auth_middleware so FastAPI can register it as HTTP middleware."""
    return await auth_middleware(request, call_next)


@app.middleware("http")
async def _request_id_mw(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Bind a `request_id` contextvar for every request.

    Forensic finding P1 #18 — telemetry split-brain. Tokens lived in
    `ai_resilience.attempt_succeeded` events; latency lived in
    `*.generated` router events. There was no shared key joining them,
    so cost-per-user attribution was guesswork. This middleware mints
    (or honours, if the caller supplies `X-Request-ID`) a request id
    and binds it via structlog contextvars; every log line emitted
    during the request — auth, resilience, router, behavioural guard —
    inherits it via `merge_contextvars` (see `logging_config.py`).
    The id is also echoed back on the response so clients can quote it
    in bug reports.
    """
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ---- Error handling --------------------------------------------------------


@app.exception_handler(AgentError)
async def _agent_error_handler(_request: Request, exc: AgentError) -> JSONResponse:
    """Every typed error converges on the same wire envelope."""
    return JSONResponse(
        status_code=exc.http_status,
        headers=(
            {"Retry-After": str(exc.retry_after_seconds)}
            if exc.retry_after_seconds
            else {}
        ),
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "retryAfterSeconds": exc.retry_after_seconds,
            }
        },
    )


# ---- Health / readiness ----------------------------------------------------


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness: container process is up."""
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    """Readiness: config loaded and validated.

    A full-fat readiness check would ping Firestore too. We avoid that in
    Phase 1 to keep readiness cheap — Firestore unavailability surfaces in
    the first real request as a 5xx, which the Next.js circuit breaker
    already handles.

    The body is deliberately opaque. `/readyz` is in `auth._PUBLIC_PATHS`, so
    anything returned here is readable by any unauthenticated caller; it used
    to leak `env`, `allowedInvokerCount`, `liveKeyCount` and `shadowKeyCount`
    — a free reconnaissance read of our auth posture and key-pool depth.
    Probes only need the status code; operators read config from the
    `app.startup` log line and the Cloud Run revision spec instead.
    """
    get_settings()
    return {"status": "ok"}


# ---- A2A agent card (P1 #13) ----------------------------------------------


async def agent_card() -> dict[str, object]:
    """Publish an A2A-compatible agent card.

    Phase H — addresses audit P0 #66 (`protocolVersion`) and P0 #67
    (`securitySchemes` + `security`). Skill list is now driven by the
    VIDYA sub-agent registry so adding a sub-agent automatically
    updates the card. Builder lives in `agent_card.py` for
    testability — see `tests/unit/test_agent_card.py`.
    """
    settings = get_settings()
    return build_agent_card(audience=settings.audience)


if not TELEPHONY_ONLY:
    # The public telephony service serves no agent card.
    app.get("/.well-known/agent.json")(agent_card)


# ---- Sub-routers -----------------------------------------------------------

# ---------------------------------------------------------------------------
# Route surface.
#
# Cloud Run IAM is the outer gate for this service: `roles/run.invoker` is
# granted to the Next.js runtime SA and to nobody else, so every agent route
# below is unreachable without a Google-signed identity token.
#
# The telephony media socket cannot live behind that gate. Vobiz dials it
# directly from the public internet and has no way to mint a Google token, so
# reaching it requires `allUsers` — which on THIS service would also expose
# every agent endpoint above and undo that P1 fix.
#
# `SAHAYAKAI_TELEPHONY_ONLY` resolves it. The same image deployed with the flag
# set registers ONLY the telephony router and the health probes, so a second,
# publicly-invokable Cloud Run service can carry phone calls while exposing
# nothing else. The agent service keeps its IAM gate untouched.
#
if TELEPHONY_ONLY:
    # Public service: the token-gated media socket and nothing else.
    app.include_router(telephony_router)
else:
    app.include_router(parent_call_router)
    app.include_router(lesson_plan_router)
    app.include_router(vidya_router)
    app.include_router(instant_answer_router)
    app.include_router(parent_message_router)
    app.include_router(rubric_router)
    app.include_router(teacher_training_router)
    app.include_router(virtual_field_trip_router)
    app.include_router(worksheet_router)
    app.include_router(quiz_router)
    app.include_router(exam_paper_router)
    app.include_router(visual_aid_router)
    app.include_router(video_storyteller_router)
    app.include_router(avatar_generator_router)
    app.include_router(voice_to_text_router)
    # Phase S spike — Gemini Live API for VIDYA voice mode. Parallel to
    # `vidya_router`, NOT a replacement. See spikes/gemini_live_voice/SPIKE.md.
    app.include_router(vidya_voice_router)
    # Carrier media streams. A WebSocket route: Starlette's BaseHTTPMiddleware
    # does not wrap websocket scopes, so `auth_middleware` never runs here and
    # the route gates itself on a signed, single-use, domain-scoped token
    # before `accept()` (see telephony/tokens.py).
    app.include_router(telephony_router)
    # Assessment scanner — multimodal OCR + grading (phase-w.alpha).
    app.include_router(assessment_scanner_router)
    app.include_router(assignment_assessor_router)
    app.include_router(community_persona_message_router)
