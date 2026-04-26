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

from .agents.lesson_plan.router import router as lesson_plan_router
from .agents.parent_call.router import router as parent_call_router
from .agents.vidya.router import vidya_router
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

    Keep this MINIMAL until we commit to A2A-full. The card is consumed by
    future router or orchestrator agents that might want to dispatch tasks
    to us. The shape follows A2A v0 agent-card convention.
    """
    settings = get_settings()
    return {
        "name": "sahayakai-parent-call-agent",
        "description": (
            "Multi-turn phone conversation with a parent about their child, "
            "delivered in the parent's home language with a warm, Bharat-first tone."
        ),
        "version": "0.1.0-scaffold",
        "url": settings.audience or "http://localhost:8080",
        "defaultInputModes": ["text/plain", "application/json"],
        "defaultOutputModes": ["application/json"],
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": True,
        },
        "skills": [
            {
                "id": "parent-call-reply",
                "name": "Reply to parent",
                "description": (
                    "Given call context and what the parent just said, "
                    "produce the next agent utterance and a shouldEndCall signal."
                ),
                "tags": ["telephony", "multi-turn", "multilingual"],
                "examples": [
                    "Parent said 'He has not been doing homework' — respond warmly in Hindi."
                ],
            },
            {
                "id": "parent-call-summary",
                "name": "Summarise completed call",
                "description": (
                    "Given a full transcript, produce structured summary in English."
                ),
                "tags": ["telephony", "summarisation"],
            },
            {
                "id": "lesson-plan-generate",
                "name": "Generate a lesson plan",
                "description": (
                    "Writer-evaluator-reviser loop that produces a "
                    "pedagogically robust lesson plan in any of 11 "
                    "supported languages. Hard-fails on safety violation."
                ),
                "tags": ["pedagogy", "structured-output", "multilingual", "multi-agent"],
                "examples": [
                    (
                        "Generate a Class 5 science lesson on photosynthesis "
                        "in Hindi for a low-resource classroom."
                    )
                ],
            },
            {
                "id": "vidya-orchestrate",
                "name": "VIDYA Multi-Agent Orchestrator",
                "description": (
                    "Classifies teacher intent, extracts params, "
                    "returns navigation action or in-line answer."
                ),
                "tags": ["orchestrator", "intent-classification", "multilingual"],
                "examples": [
                    (
                        "Make a quiz on photosynthesis for Class 5 in Hindi."
                    )
                ],
            },
        ],
    }


# ---- Sub-routers -----------------------------------------------------------

app.include_router(parent_call_router)
app.include_router(lesson_plan_router)
app.include_router(vidya_router)
