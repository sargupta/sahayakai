# sahayakai-agents

Python sidecar for SahayakAI's stateful and voice AI agents. Runs on ADK-Python 1.0.
Served via FastAPI on Cloud Run, separate service from the main Next.js app.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full design rationale, including the
P0/P1 review fixes that shaped the current layout.

## Scope (Phase 1)

One flow: the parent-call agent. The Twilio-facing Next.js webhook routes to this
sidecar via an in-request circuit breaker that falls back to the existing Genkit
TypeScript implementation if the sidecar is slow or errors.

Not in Phase 1: VIDYA voice assistant (Phase 2), lesson-plan reviewer (Phase 3), RAG
(Phase 4), agent router (Phase 5).

## Quickstart

```bash
cd sahayakai-agents
uv sync                              # or: poetry install
cp .env.example .env.local           # fill in dev values
uv run uvicorn sahayakai_agents.main:app --reload --port 8080

# tests
uv run pytest                        # full suite
uv run pytest tests/unit             # unit only
uv run pytest tests/behavioral       # pedagogy / identity guarantees
```

## Layout

```
src/sahayakai_agents/
├── main.py                   FastAPI app · health · A2A agent card · middleware
├── config.py                 pydantic-settings, env + Secret Manager
├── auth.py                   IAM invoker ID-token verification + X-Content-Digest HMAC
├── resilience.py             telephony-tuned retry + key pool + cache-hit observability
├── telemetry.py              OpenTelemetry → Cloud Trace
├── session_store.py          Firestore sessions with (callSid, turnNumber) + OCC
├── shared/errors.py          typed errors (AIQuotaExhaustedError, etc.)
└── agents/parent_call/
    ├── schemas.py            Pydantic — source of truth; TS types generated from these
    ├── agent.py              ADK LlmAgent wiring (prompts rendered from shared handlebars)
    └── router.py             FastAPI sub-router
prompts/parent-call/          shared Handlebars; rendered on both sides
tests/                        unit · integration · behavioral · parity
deploy/                       Cloud Build YAML + Cloud Run service spec
```

## Decision provenance

- Python 3.12, ADK-Python `==1.0.0`, FastAPI, Pydantic v2.
- IAM invoker ID tokens for Next.js → sidecar auth. No shared secrets in prod.
- Firestore-backed session store, `(callSid, turnNumber)` composite key, transactions + OCC.
- Separate Gemini API key for shadow-mode traffic so it cannot 429 the live path.
- `min-instances=1` in staging and prod from day one.
- Telephony-profile resilience: max total retry wait 7 seconds, never 60.

## Parent plans

- [`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`](../sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md) (if restored)
- Phase-1 review findings embedded in [`ARCHITECTURE.md`](ARCHITECTURE.md) §Review-Informed Decisions.
