# 1. In-process supervisor delegation, then AgentTool wrapping

- Status: accepted
- Date: 2026-04-28
- Phase reference: B.4 (initial in-process delegation), L.2 (AgentTool wrap)
- Commit references:
  - Phase B.4: [`5e5e19dd0`](../../../) — `feat(phase-b.4): VIDYA delegates instantAnswer to the dedicated agent`
  - Phase L.2: [`49752b07f`](../../../) — `fix(phase-l.2): instant-answer wrapped as ADK AgentTool; VIDYA delegates via public run_answerer`

## Context

VIDYA is the OmniOrb supervisor: one structured Gemini call returns an
`IntentClassification`, the router branches by intent type, and for the
`instantAnswer` intent it must produce a real factual answer inline
(not a `NAVIGATE_AND_FILL` action). Two delivery paths were on the
table:

1. **Inline composition.** VIDYA composes its own one-off prompt and
   calls Gemini un-grounded. This is what shipped before B.4. It is
   layering-clean (no cross-package import) but reproduces the
   instant-answer agent's prompt + behavioural guard inside VIDYA, and
   gets no Google Search grounding.
2. **AutoFlow with `AgentTool`.** Wrap the instant-answer `LlmAgent` as
   an `AgentTool`, register it on VIDYA via `tools=[…]`, and let ADK's
   basic LLM-flow autonomously decide to call the tool. This is the
   canonical ADK supervisor pattern.

ADK 1.31's basic LLM-flow gates `response_schema` behind
`can_use_output_schema_with_tools(model)`. On the public Gemini API
path this returns `False`; on Vertex AI + Gemini 2.x it returns `True`.
Since SahayakAI runs on the public Gemini API (per agent.py model
strings, key-pool resilience, and pricing constraints documented in
`COST_ANALYSIS.md`), registering tools on an LlmAgent that pins
`output_schema` forces a `SetModelResponseTool` prompt-based
workaround that **changes the wire contract** — the structured
`IntentClassification` JSON VIDYA's classifier emits today would no
longer arrive at the router as parsed Pydantic. Every downstream
intent-branch test breaks.

The compound-agent migration plan
(`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`,
Phase L) needs both (a) a shared inline answerer that reuses the
instant-answer agent's prompt + grounding + guard, and (b) a
forward-compatible path to AutoFlow once supervisors stop pinning
`output_schema`.

## Decision

**Two-step migration, not a single jump.**

**Step 1 (Phase B.4, shipped):** VIDYA's `_run_instant_answer` does a
lazy in-process import of the instant-answer agent's `_run_answerer`
helper, builds an `InstantAnswerRequest` from the VIDYA payload, and
awaits the sub-agent. Wire shape stays identical. Grounding is now
real (the instant-answer agent already passes
`Tool(google_search=GoogleSearch())` on every call). The
behavioural guard (`assert_instant_answer_response_rules`) runs on
the answer text before VIDYA wraps it.

**Step 2 (Phase L.2, shipped):** Three changes:

- `agents/instant_answer/router.py` renames `_run_answerer` to
  public `run_answerer`. The leading underscore was a layering
  smell — VIDYA was reaching into a private symbol. The private
  alias is kept for one release cycle so any in-flight branches
  still build, then drops.
- `agents/instant_answer/agent.py` adds `build_instant_answer_agent()`
  returning an `LlmAgent` (terminal,
  `disallow_transfer_to_parent=True`, `output_schema=InstantAnswerCore`)
  and `build_answerer_tool()` wrapping it as an `AgentTool`. Both
  are `lru_cache(1)`. The factory is built but **not yet registered
  on VIDYA's `tools=[]`** — VIDYA still pins `output_schema` for
  its classifier. The factory is ready for L.3+ supervisors that
  drop `output_schema`.
- `agents/vidya/router.py:_run_instant_answer` imports the public
  `run_answerer` symbol and forwards `payload.userId` into the
  sub-request. The Phase B.4 `userId="vidya-supervisor"` placeholder
  is gone — per-user observability and rate-limiting now work
  through VIDYA-routed inline answers.

**Explicit router-level dispatch is the choice, not AutoFlow.**
Picking AutoFlow today would require dropping VIDYA's
`output_schema`, a much larger refactor that breaks the typed
`IntentClassification` contract every router branch keys off. The
explicit-dispatch path preserves L.1's wire shape AND fixes the
B.4 layering violation.

## Consequences

**Positive:**

- Real Google Search grounding on every VIDYA-routed instant answer.
  The pre-B.4 inline path was un-grounded.
- Same hardened behavioural guard runs whether the user reaches the
  agent through `/v1/instant-answer/answer` or through VIDYA — no
  guard drift between entry points.
- Public `run_answerer` is the supported delegation hook. New
  supervisors can call it directly without copying instant-answer's
  prompt rendering, key-pool resilience, or guard composition.
- The `AgentTool` factory is built and tested even though it is not
  registered on VIDYA today; future supervisors that don't pin
  `output_schema` (Phase L.3+ roadmap) can import it and register
  with one line.
- `userId` flows end-to-end. Per-user rate limits, audit log
  attribution, and structlog `user_id` correlation now work for
  VIDYA-routed instant answers.

**Negative / costs:**

- Two delegation conventions exist in the codebase simultaneously:
  the explicit `run_answerer` import (used by VIDYA today) and the
  AgentTool wrap (built but unregistered). Phase L.3+ collapses
  this back to one once VIDYA drops `output_schema`.
- The deprecated `_run_answerer` private alias is in the surface
  area for one release cycle. Any new caller MUST import the
  public `run_answerer`. CI guard-rail: ruff catches imports of
  the underscore-prefixed name in any module that isn't the
  router itself (existing private-import lint rule).
- An extra in-process function call adds ~negligible overhead but
  does mean a VIDYA crash midway through the delegated call leaves
  no half-written state in Firestore — both router invocations
  share the same FastAPI request lifecycle.

**Forward-compatibility:**

- The L.2 commit's `build_answerer_tool()` factory is the canonical
  ADK shape. When Phase N or later moves VIDYA to a
  no-`output_schema` orchestrator, `tools=[build_answerer_tool()]`
  on the `LlmAgent` is the one-line migration. No other code
  changes — the existing `run_answerer` keeps working for explicit
  callers (e.g. tests, batch jobs).

## Alternatives considered

**(a) Single-step jump straight to AutoFlow at B.4.** Rejected.
Forces dropping `output_schema` from the VIDYA classifier, which
breaks the typed `IntentClassification` contract every router
branch consumes. Schema-first was an explicit Phase G design
decision and has flushed out two prompt-injection attempts during
behavioural-guard QA — not worth re-litigating to save one
indirection.

**(b) Keep VIDYA composing its own un-grounded prompt.** Rejected.
Two prompts to maintain in sync; behavioural guard reproduced in
two places; no Google Search grounding on the inline path. The
duplication risk is the same one that drove `_behavioural.py` to be
shared in the first place (audit P0 #15).

**(c) HTTP roundtrip from VIDYA → `/v1/instant-answer/answer`.**
Rejected. Doubles latency on the most teacher-facing surface
(OmniOrb mic). Adds an auth + HMAC roundtrip per VIDYA call.
Indirection for no gain when both routers run in the same
FastAPI process.

**(d) Move both agents under one `LoopAgent` / `SequentialAgent`
parent.** Rejected as premature. The supervisor pattern is
intent-classify → branch, not pipeline-by-default. A `LoopAgent`
wrap would force every VIDYA intent through the same control flow
even when 9 of 10 intents emit a `NAVIGATE_AND_FILL` action that
needs zero further model calls.
