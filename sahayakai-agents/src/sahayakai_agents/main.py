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

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .agent_card import build_agent_card
from .agents.avatar_generator.router import avatar_generator_router
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
from .agents.virtual_field_trip.router import virtual_field_trip_router
from .agents.visual_aid.router import visual_aid_router
from .agents.worksheet.router import worksheet_router
from .auth import auth_middleware
from .config import get_settings
from .logging_config import configure_logging
from .shared.errors import AgentError
from .telemetry import init_telemetry

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


app = FastAPI(
    title="sahayakai-agents",
    version="0.1.0",
    description="Python sidecar for SahayakAI stateful and voice AI agents.",
    lifespan=_lifespan,
    # Docs are on in non-prod; we never want them on a publicly reachable
    # prod URL because they leak schema surface.
    docs_url="/docs" if get_settings().env != "production" else None,
    redoc_url="/redoc" if get_settings().env != "production" else None,
)


# ---- Middleware ------------------------------------------------------------


@app.middleware("http")
async def _auth_mw(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Wraps auth_middleware so FastAPI can register it as HTTP middleware."""
    return await auth_middleware(request, call_next)


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
async def readyz() -> dict[str, object]:
    """Readiness: config is valid and Secret Manager is reachable.

    A full-fat readiness check would ping Firestore too. We avoid that in
    Phase 1 to keep readiness cheap — Firestore unavailability surfaces in
    the first real request as a 5xx, which the Next.js circuit breaker
    already handles.
    """
    settings = get_settings()
    return {
        "status": "ok",
        "env": settings.env,
        "allowedInvokerCount": len(settings.allowed_invokers),
        "liveKeyCount": len(settings.genai_keys),
        "shadowKeyCount": len(settings.genai_shadow_keys),
    }


# ---- A2A agent card (P1 #13) ----------------------------------------------


@app.get("/.well-known/agent.json")
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


# ---- Sub-routers -----------------------------------------------------------

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
