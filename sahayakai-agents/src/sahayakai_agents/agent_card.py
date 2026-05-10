"""A2A agent-card builder (Phase H — audit P0 #66 + #67).

Returns the A2A-compatible JSON the sidecar serves at
`/.well-known/agent.json`. The card is consumed by orchestrator
agents that might want to dispatch tasks to us, and by tooling that
auto-discovers our capabilities.

Audit feedback addressed:

- **P0 #66 — `protocolVersion`** — A2A spec requires this top-level
  field. We pin to `0.2` (the version we built against).
- **P0 #67 — `securitySchemes` + `security`** — A2A spec requires
  callers to know HOW to authenticate. We document the
  Google ID token + HMAC-body-digest scheme.
- **VIDYA supervisor coverage** — the previous card listed 4 skills
  but the sidecar now hosts 12 (10 sub-agents + 2 supervisor skills).
  Build the skill list from the VIDYA registry so adding a new
  sub-agent automatically updates the card.
"""
from __future__ import annotations

from typing import Any

from .agents.vidya.registry import INLINE_AGENTS, SUB_AGENTS

A2A_PROTOCOL_VERSION = "0.3"

# Pinned semver tagged per release cut. Bumped when wire schemas
# change. The sidecar version (router-level) is independent — it
# tracks per-agent revisions; agent-card version tracks the FLEET.
AGENT_CARD_VERSION = "0.4.0"


def _supervisor_skills() -> list[dict[str, Any]]:
    """Skills the supervisor exposes directly (not delegated)."""
    return [
        {
            "id": "vidya-orchestrate",
            "name": "VIDYA Multi-Agent Orchestrator",
            "description": (
                "Supervisor agent: classifies a teacher's natural-language "
                "request, extracts parameters, and either returns a "
                "navigation action for the OmniOrb client or delegates "
                "to one of 9 specialist sub-agents. Recognises compound "
                "requests and emits up to 3 typed `plannedActions` with "
                "optional `dependsOn` indices for data flow (Phase N.1)."
            ),
            "tags": [
                "supervisor", "orchestrator", "intent-classification",
                "multilingual", "compound-intent",
            ],
            "examples": [
                "Make a quiz on photosynthesis for Class 5 in Hindi.",
                (
                    "Plan a lesson on the Mughal Empire AND a rubric to "
                    "grade student presentations."
                ),
            ],
        },
        {
            "id": "parent-call-reply",
            "name": "Multi-turn parent-call reply",
            "description": (
                "Multi-turn phone conversation with a parent about their "
                "child, delivered in the parent's home language with a "
                "warm, Bharat-first tone."
            ),
            "tags": ["telephony", "multi-turn", "multilingual"],
            "examples": [
                (
                    "Parent said 'He has not been doing homework' — "
                    "respond warmly in Hindi."
                ),
            ],
        },
        {
            "id": "parent-call-summary",
            "name": "Summarise a completed parent call",
            "description": (
                "Given a full call transcript, produce a structured "
                "summary in English (key points, sentiment, follow-up)."
            ),
            "tags": ["telephony", "summarisation"],
        },
    ]


def _sub_agent_skills() -> list[dict[str, Any]]:
    """One skill row per registry entry. The capability becomes the
    A2A `description`; the endpoint feeds the future AgentTool URL."""
    skills: list[dict[str, Any]] = []
    for agent in SUB_AGENTS:
        skills.append({
            "id": agent.flow,
            "name": agent.flow.replace("-", " ").title(),
            "description": agent.capability,
            "tags": ["sub-agent", "navigate-and-fill"],
            "endpoint": agent.endpoint,
        })
    for agent in INLINE_AGENTS:
        skills.append({
            "id": agent.flow,
            "name": agent.flow.replace("-", " ").title(),
            "description": agent.capability,
            "tags": ["sub-agent", "inline"],
            "endpoint": agent.endpoint,
        })
    return skills


def _security_schemes() -> dict[str, Any]:
    """A2A SecuritySchemes object describing how callers authenticate.

    The sidecar requires TWO independent signals on every protected
    endpoint (everything except `/healthz`, `/readyz`, and the agent
    card itself):

    1. **Google ID token** — Cloud Run IAM-validated, scoped to
       `SAHAYAKAI_AGENTS_AUDIENCE`.
    2. **HMAC-body-digest** — `X-Content-Digest: sha256=<base64>` over
       the raw request body, plus `X-Request-Timestamp` for replay
       defence (request rejected if skew > 5 min).

    Both are required (`security` is `[{...both...}]`). Callers without
    Cloud Run IAM access cannot mint the ID token; callers without the
    HMAC key cannot forge the body digest.
    """
    return {
        "googleIdToken": {
            "type": "openIdConnect",
            "openIdConnectUrl": (
                "https://accounts.google.com/.well-known/openid-configuration"
            ),
            "description": (
                "Google-signed ID token whose `aud` claim equals this "
                "service's Cloud Run URL. Validated by Cloud Run IAM "
                "before the request reaches the sidecar."
            ),
        },
        "hmacContentDigest": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Content-Digest",
            "x-hmac-body-digest": True,
            "description": (
                "Per-request HMAC-SHA256 body digest binding the request body "
                "to a timestamp. Computed by the caller as "
                "`sha256=<base64(hmac(secret, timestamp + ':' + body))>` and "
                "sent in `X-Content-Digest` alongside `X-Request-Timestamp` "
                "(unix milliseconds). Both headers are required.\n\n"
                "**Validity window:** `X-Request-Timestamp` must be within a "
                "5-minute skew of the server clock (forward or back).\n\n"
                "**Replay protection:** the server caches every accepted "
                "`(timestamp, digest)` tuple in a TTL set sized for 10 000 "
                "entries with a 6-minute TTL (one full skew window past the "
                "freshest accepted timestamp). Replays return 409 with "
                "`auth.hmac.replay_detected` in the structured log.\n\n"
                "**Secret rotation:** the signing secret lives at "
                "Secret Manager `SAHAYAKAI_REQUEST_SIGNING_KEY`. Callers and "
                "the sidecar load it once at startup; rotation requires both "
                "sides to redeploy. NOT a static API key — the digest is "
                "recomputed per request, so capturing one request never "
                "yields a long-lived credential."
            ),
        },
        # P3 polish — Phase R.2 added Firebase App Check as a third
        # auth layer. Document it on the agent card so external tooling
        # (Postman, Insomnia, gh-agents) can discover the requirement
        # rather than guessing from a 401 response.
        "firebaseAppCheck": {
            "type": "apiKey",
            "in": "header",
            "name": "X-Firebase-AppCheck",
            "description": (
                "Firebase App Check token attesting that the calling client "
                "is the legitimate Sahayakai Next.js front-end (not curl, "
                "not a stolen ID token replayed from a hostile script). "
                "Verified server-side against the project's App Check JWKS "
                "before the request reaches the sub-router. Optional in "
                "dev (controlled by the `SAHAYAKAI_REQUIRE_APP_CHECK` env "
                "flag); required once flipped on in prod. Server-side "
                "callers (Cloud Scheduler, cron jobs) skip this header — "
                "their Google ID token is sufficient."
            ),
        },
    }


def build_agent_card(*, audience: str | None) -> dict[str, Any]:
    """Build the agent-card payload.

    `audience` is the Cloud Run URL exposed via the
    `SAHAYAKAI_AGENTS_AUDIENCE` setting. When unset (local dev), we
    fall back to localhost so the card stays well-shaped for tests
    without leaking production URLs.
    """
    return {
        # P0 #66 — A2A spec mandates this. Pin to the version we built
        # against; bump deliberately on a wire-schema change.
        "protocolVersion": A2A_PROTOCOL_VERSION,
        "name": "sahayakai-supervisor-agent",
        "description": (
            "SahayakAI multi-agent supervisor: hosts 10 specialist "
            "sub-agents (lesson plan, quiz, worksheet, exam paper, "
            "rubric, virtual field trip, teacher training, video "
            "recommendations, visual aid, avatar) plus a parent-call "
            "telephony agent and the VIDYA orchestrator. The "
            "supervisor classifies teacher intent, delegates to the "
            "right sub-agent, and emits compound follow-up suggestions."
        ),
        "version": AGENT_CARD_VERSION,
        "url": audience or "http://localhost:8080",
        "defaultInputModes": ["text/plain", "application/json"],
        "defaultOutputModes": ["application/json"],
        "capabilities": {
            "streaming": False,
            "pushNotifications": False,
            "stateTransitionHistory": True,
        },
        # P0 #67 — securitySchemes describes HOW callers authenticate;
        # `security` says which combinations are required. Both must
        # be satisfied (single AND-block).
        # P3 polish — `firebaseAppCheck` listed as optional (empty
        # scope array, no AND-required entry) since the requirement is
        # gated by `SAHAYAKAI_REQUIRE_APP_CHECK` and not enforced by
        # default in dev.
        "securitySchemes": _security_schemes(),
        "security": [
            {
                "googleIdToken": [],
                "hmacContentDigest": [],
            },
        ],
        "skills": _supervisor_skills() + _sub_agent_skills(),
    }


__all__ = [
    "A2A_PROTOCOL_VERSION",
    "AGENT_CARD_VERSION",
    "build_agent_card",
]
