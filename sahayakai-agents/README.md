# sahayakai-agents

Multi-agent Python ADK sidecar hosting 15 specialist agents for SahayakAI's
teacher-facing AI features. Replaces the Genkit JS path on a flag-controlled
ramp. Runs on ADK-Python 1.0, served via FastAPI on Cloud Run as a separate
service from the main Next.js app.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for design rationale and the original
review findings that shaped the layout. See [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
for operations, flag flips, and rollback.

## What ships today

15 routers wired into [`main.py`](src/sahayakai_agents/main.py):
9 routable navigation flows, 2 inline tools, 1 image-generation flow, 1
parent-message generator, 1 telephony flow, and the VIDYA supervisor.

### Agent inventory

Source of truth: [`registry.py`](src/sahayakai_agents/agents/vidya/registry.py)
plus the 6 routers not in the registry (parent-call, parent-message,
avatar-generator are dispatched directly; vidya is the supervisor).

| Flow | Endpoint | Capability |
|---|---|---|
| `lesson-plan` | `POST /v1/lesson-plan/generate` | Full multi-activity lesson plan with engagement hook, explanation, practice, and assessment. Use for "teach me X" / "plan a lesson on Y". |
| `quiz-generator` | `POST /v1/quiz/generate` | Short quiz with 3 difficulty variants, MCQ + short-answer. In-class practice or exit tickets. |
| `visual-aid-designer` | `POST /v1/visual-aid/generate` | Labelled chalkboard-style diagram image. Diagrams, flashcards, illustrated handouts. |
| `worksheet-wizard` | `POST /v1/worksheet/generate` | Multi-activity worksheet (fill-in, MCQ, short-answer) with answer key. |
| `virtual-field-trip` | `POST /v1/virtual-field-trip/plan` | 4-6 stops on Google Earth with cultural analogies. |
| `teacher-training` | `POST /v1/teacher-training/advise` | Professional development micro-lesson on classroom management or pedagogy. |
| `rubric-generator` | `POST /v1/rubric/generate` | Multi-criterion grading rubric with 3-4 performance levels. |
| `exam-paper` | `POST /v1/exam-paper/generate` | Full board-pattern exam paper with sections + marks-balanced questions. CBSE / state-board / pre-board prep. |
| `video-storyteller` | `POST /v1/video-storyteller/recommend-queries` | 5 categories of YouTube search queries for teachers. |
| `instantAnswer` (inline tool) | `POST /v1/instant-answer/answer` | Direct factual answer with optional Google Search grounding. |
| `voice-to-text` (inline tool) | `POST /v1/voice-to-text/transcribe` | Multimodal speech-to-text for 11 Indian languages plus English. OmniOrb invokes this before the orchestrator on mic input. |
| `avatar-generator` | `POST /v1/avatar-generator/generate` | Single image-generation call returning a base64 data URI for teacher avatars. |
| `parent-message` | `POST /v1/parent-message/generate` | Multilingual parent-facing nudges. `reasonContext` and `languageCode` are server-rewritten as a defence-in-depth measure against prompt injection. |
| `parent-call` (telephony) | `POST /v1/parent-call/reply`, `POST /v1/parent-call/summary` | Multi-turn phone conversation with a parent in the parent's home language; structured English summary at end of call. |
| `vidya` (supervisor) | `POST /v1/vidya/orchestrate` | Classifies a teacher's natural-language request, extracts parameters, and either returns a `VidyaAction` for the OmniOrb client or delegates to one of the 9 specialist sub-agents. |

Behavioural guards are wired per flow in
[`_behavioural.py`](src/sahayakai_agents/_behavioural.py): forbidden-phrase
scan (Mathematical Bold, Cherokee, Armenian confusables folded), per-language
Unicode script match, sentence-count and length bounds. Every router
fail-closes on assertion violations, returning HTTP 502 rather than serving a
guard-violating response.

## Architecture

### Supervisor pattern

VIDYA is the OmniOrb mic surface on every screen. Today it runs as a
single-classifier flow: one structured Gemini call produces an
`IntentClassification`, then the router branches. For the 9 routable flows it
emits a `VidyaAction` of type `NAVIGATE_AND_FILL` and the OmniOrb client opens
the route and prefills the form. For `instantAnswer` it calls the inline
sub-agent directly. Compound requests ("plan a lesson on Mughals AND a
rubric") now emit a typed `plannedActions: list[VidyaAction]` (max 3 entries)
with optional `params.dependsOn: list[int]` indices for data flow between
actions. Phase N.1 replaced the older `followUpSuggestion: str | None` prose
chip; v0.4 of the agent card pins this wire shape.

### A2A protocol

Card published at `/.well-known/agent.json` from
[`agent_card.py`](src/sahayakai_agents/agent_card.py). `protocolVersion` is
pinned to `0.3`. `securitySchemes` documents two required signals on every
protected endpoint: a Google ID token verified by Cloud Run IAM (audience
equals `SAHAYAKAI_AGENTS_AUDIENCE`), plus an HMAC-SHA256 body digest with a
5-minute replay window. The skill list is rebuilt from the VIDYA registry on
every request, so adding a sub-agent automatically updates the card.

### Behavioural guard pattern

Every router runs the model output through assertions in
[`_behavioural.py`](src/sahayakai_agents/_behavioural.py) before serializing
the response. Inputs are NFKC-normalised and confusable-folded across
Cyrillic, Greek, fullwidth, Mathematical Alphanumeric, Cherokee, and
Armenian codepoints before the regex check. Routers fail closed on any
assertion violation. This makes guard bypass a deploy-time test failure
rather than a production incident.

### Resilience

[`resilience.py`](src/sahayakai_agents/resilience.py) wraps every Gemini call
with `run_resiliently`. Telephony-bounded backoff caps the total retry wait at
`SAHAYAKAI_MAX_TOTAL_BACKOFF_SECONDS` (default 7s, well inside Twilio's 15s
webhook budget). Each attempt is itself bounded by an `asyncio.wait_for`
timeout passed by the caller. Key-pool failover rotates across comma-separated
keys in `GOOGLE_GENAI_API_KEY` and a separate isolated pool in
`GOOGLE_GENAI_SHADOW_API_KEY` for shadow-mode traffic.

## Local dev setup

```bash
cd sahayakai-agents
uv sync                              # or: poetry install
cp .env.example .env.local           # fill in dev values
uv run pytest                        # 497+ tests
uv run uvicorn sahayakai_agents.main:app --reload --port 8080
```

Granular test scopes:

```bash
uv run pytest tests/unit             # unit only
uv run pytest tests/integration      # integration
uv run pytest tests/behavioral       # pedagogy / identity guarantees
```

## Configuration

Every setting is read in [`config.py`](src/sahayakai_agents/config.py) and
validated at import time so a misconfigured deploy fails fast.

| Env var | Default | Purpose |
|---|---|---|
| `SAHAYAKAI_AGENTS_ENV` | `development` | One of `development`, `staging`, `production`. Production requires `assert_prod_invariants` to pass. |
| `SAHAYAKAI_AGENTS_PORT` | `8080` | Uvicorn listen port. |
| `SAHAYAKAI_AGENTS_LOG_LEVEL` | `INFO` | structlog level. |
| `GOOGLE_CLOUD_PROJECT` | `sahayakai-b4248` | GCP project for Firestore + Secret Manager. |
| `GOOGLE_CLOUD_REGION` | `asia-southeast1` | Cloud Run region. |
| `SAHAYAKAI_AGENTS_ALLOWED_INVOKERS` | `""` | Comma- or space-separated SA emails permitted to invoke the sidecar. Next.js runtime SA must be present. |
| `SAHAYAKAI_AGENTS_AUDIENCE` | `""` | Cloud Run service URL the IAM ID-token's `aud` claim is checked against. |
| `SAHAYAKAI_REQUEST_SIGNING_KEY` | `dev-only-change-me` | HMAC key for `X-Content-Digest` body integrity. Production rejects the dev default and requires 32+ chars. |
| `GOOGLE_GENAI_API_KEY` | `""` | Live Gemini key pool, comma-separated for failover. |
| `GOOGLE_GENAI_SHADOW_API_KEY` | `""` | Shadow-mode key pool. Production fails boot if it overlaps the live pool. |
| `SAHAYAKAI_FIRESTORE_DATABASE` | `(default)` | Firestore database id for session store. |
| `SAHAYAKAI_SESSION_COLLECTION` | `agent_sessions` | Collection where `(callSid, turnNumber)` session docs live. |
| `SAHAYAKAI_SESSION_TTL_HOURS` | `24` | Session-doc TTL. |
| `SAHAYAKAI_MAX_TOTAL_BACKOFF_SECONDS` | `7.0` | Telephony-tuned cap on cumulative retry wait inside `run_resiliently`. |
| `OTEL_SERVICE_NAME` | `sahayakai-agents` | OpenTelemetry resource attribute. Used by Cloud Trace. |

## Deploy

Cloud Build pipeline at [`deploy/cloudbuild.yaml`](deploy/cloudbuild.yaml).
Knative service spec at [`deploy/service.yaml`](deploy/service.yaml). Note
`timeoutSeconds: 120` (Phase J fix to cover visual-aid + avatar 90s image
generation). The pipeline uses `gcloud run services replace` against the
rendered `service.yaml`, not raw `gcloud run deploy`, so every annotation,
secret mount, and IAM setting lands deterministically.

IAM bootstrap, secret provisioning, audience-secret hydration, and rollback
procedure are covered in [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

## Phase progress

- **Phase A.** Scaffold. Merged.
- **Phases B-I.** 15 flows migrated across PRs #10-#16. VIDYA supervisor
  shipped with compound-intent follow-up suggestion.
- **Phase J.** 10 P0 deploy blockers fixed (PR #17). Per-call
  `asyncio.wait_for` budgets, behavioural-guard fold-table extension, agent
  card `protocolVersion` + `securitySchemes`, Cloud Run timeout 120s.
- **Phase K.** Persistence + rate-limit gates lifted into the 9 dispatchers
  (PR #18). Removes per-router duplication of session and rate-limit logic.
- **Phase L (in progress).** ADK refactor. VIDYA migrates from a hand-rolled
  classifier router to a real `LlmAgent` with sub-agent `AgentTool`s.
- **Phases M-Q.** Cost / perf, schema sweep, test coverage, telemetry,
  docs.

## Pointers

- [`ARCHITECTURE.md`](ARCHITECTURE.md). Design rationale and the original
  review findings.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md). Operations, flag flips, rollback.
- [`../sahayakai-main/.claude/plans/sidecar-forensic-remediation-plan.md`](../sahayakai-main/.claude/plans/sidecar-forensic-remediation-plan.md).
  The active 4-week remediation plan that frames Phases J through Q.
- Forensic findings: linked from the remediation plan above.
