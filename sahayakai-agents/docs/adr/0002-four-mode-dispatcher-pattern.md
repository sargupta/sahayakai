# 2. Four-mode dispatcher (off / shadow / canary / full)

- Status: accepted
- Date: 2026-04-28
- Phase reference: A (parent-call seed), J.5 (consolidation), K (lift gates)
- Commit references:
  - Initial pattern: [`9535770ee`](../../../) — `feat(parent-call): Track A1 — sidecar dispatch flag (default off)`
  - Shadow-diff layer: [`3fc392513`](../../../) — `feat(parent-call): Track A4+A5 — dispatcher + shadow-diff (default off)`
  - Branching matrix tests: [`8d9645cbb`](../../../) — `test(sidecar): dispatcher branching matrix (off/shadow/canary/full)`
  - Decide timeout / abort hardening: [`dc61737b3`](../../../) — `fix(dispatch): AbortError rethrow + decide-dispatch timeout`

## Context

Migrating 15 agents from Genkit (TypeScript / Next.js process) to the
Python ADK sidecar without a planned outage requires:

- A graduated rollout that proves parity on real production traffic
  before any user-facing fallback to the new path.
- A rollback surface fast enough that an auto-abort Cloud Function
  can flip every agent off in under 60 seconds when an alert fires.
- Traffic isolation: the cost of running the new path in parallel
  must be bounded, not "double every Gemini bill".
- A shape that survives the cross-cutting risks: AbortError on
  cancelled HTTP requests, decide-flag-read hangs (Firestore stall),
  per-agent shadow-diff aggregation for parity scoring.

A simple boolean (`useSidecar=true|false`) handles none of these.
Boolean rollouts on AI flows have shipped two regressions in 2025
(parent-call hallucination on Hindi script, lesson-plan length
collapse) that would have been caught by parity scoring before any
user saw them.

## Decision

**Every agent dispatcher implements the same four-mode shape, read
from Firestore once per request via `getFeatureFlags()`.** The
modes (defined in `sahayakai-main/src/lib/feature-flags.ts:91`):

- `off` — Genkit only. Sidecar is not contacted. Default for
  every agent on every environment.
- `shadow` — Genkit serves the response. Sidecar runs in parallel,
  fire-and-forget, with both replies landing in
  `agent_shadow_diffs/{agent}/{bucket}` for offline parity scoring.
  Sidecar errors NEVER affect the response.
- `canary` — Sidecar serves the response. On
  `SidecarConfigError` / `SidecarTimeoutError` /
  `SidecarHttpError`, fall back to Genkit. On
  `SidecarBehaviouralError` (the sidecar's fail-closed 502 from
  the `_behavioural.py` guard) DO NOT fall back to Genkit (the
  same prompt would likely produce the same suspect output);
  rethrow so the route's outer catch returns the canned safe
  wrap-up. Bucketing on `uid` (or `callSid` for parent-call)
  determines what fraction of users see the sidecar.
- `full` — Sidecar serves; same fallbacks as `canary` but
  `<agent>SidecarPercent` is treated as 100 regardless of value.

The dispatcher contract is the same shape across all 15 agents
(see [`dispatch.ts`](../../../sahayakai-main/src/lib/sidecar/dispatch.ts)
for the canonical parent-call form; the other 14 dispatchers mirror
the structure with agent-specific request/response types).

**Three robustness invariants** that make the matrix safe to ship
graduated:

1. **Decide timeout.** `decideDispatchWithTimeout` races the
   Firestore flag read against a 1.5 s timeout (`DECIDE_DISPATCH_TIMEOUT_MS`).
   On timeout it falls back to `off` mode (the safe default per
   `FALLBACK_CONFIG`). Without this, a Firestore regional stall
   would block every dispatch indefinitely.
2. **AbortError rethrow.** Both `runGenkitSafe` and `runSidecarSafe`
   detect `AbortError` (Twilio request cancelled mid-flight, client
   disconnect, Next.js abort signal) and rethrow rather than
   producing a phantom reply on a dead connection. Audit P0
   ABORT-1.
3. **Behavioural-error path doesn't fall back.** Falling back from
   sidecar 502 to Genkit hides safety-guard violations (which
   exist precisely because the model emitted output a guard
   refused). The route's outer catch returns the canned safe
   wrap-up instead.

## Consequences

**Positive:**

- One mental model across 15 agents. New engineers learn the
  matrix once.
- Cost-bounded shadow traffic: shadow mode is fire-and-forget,
  so the response latency is unchanged; sidecar errors are
  observed but never serve to users. Cost is one extra Gemini
  call per shadowed request — capped by `<agent>SidecarPercent`.
- Per-agent rollout independence: parent-call can be at canary/25
  while VIDYA is at off/0, both controlled via Firestore.
- Fast rollback: the auto-abort Cloud Function (Phase J) flips
  one Firestore field and every dispatcher honours `off` on the
  next request. No deploy needed.
- Parity scoring infrastructure (Track D) consumes
  `agent_shadow_diffs` and emits a single Cloud Monitoring metric
  per agent — alerts fire before any user sees regression.

**Negative / costs:**

- `decide*` is async and reads Firestore on every dispatch. The
  1.5 s timeout caps the worst case. The Firestore client SDK
  caches the document via `getFeatureFlags()`'s in-memory TTL, so
  steady-state cost is near zero.
- The pattern is verbose (~330 lines for the parent-call
  dispatcher) but every line is doing real work: Promise.race
  for Firestore stalls, Abort handling, four-way branching,
  shadow-diff write, structured log emission. Refactoring is
  tempting but each branch needs distinct error policy.
- Behavioural error class hierarchy must be replicated TS-side
  (the 4 sidecar exception types live in
  `sahayakai-main/src/lib/sidecar/parent-call-client.ts` and
  siblings). Keeping these in sync with Python's `AgentError`
  codes is part of the parity test suite.

**Operational:**

- Single Firestore document at `system_config/feature_flags`
  controls all 15 agents (Phase J.5 consolidated 12 env vars
  into Firestore — see ADR 3).
- Shadow-diff records are TTL'd at 7 days
  (`apply-firestore-ttl.sh`); the Cloud Monitoring metric reads
  off the rolled-up doc, not the raw entries.
- Each dispatcher emits one structured log line per decision,
  keyed off `event="<agent>.dispatch"`, `mode`, `reason`,
  `bucket`, `source`, `latency_ms`. The Cloud Logging filter
  in the Track D dashboard pivots on these.

## Alternatives considered

**(a) Boolean `useSidecar` flag.** Rejected. No parity proof
before user-facing rollout; no traffic graduation; no rollback
surface beyond redeploying. This is the shape the audit P0
findings explicitly called out as inadequate for AI migrations.

**(b) Three modes (off / shadow / full).** Rejected because the
canary↔full distinction matters operationally: at canary the
percent gate is honoured (e.g. 5% of users), at full it is
forced to 100. Folding them together loses the percent
graduation signal that the auto-abort ladder consumes.

**(c) Header-based override per request.** Rejected. Useful
for QA but cannot drive a percent-gated rollout, and exposes a
flag-flip surface that's not visible in the Firestore audit log.
Header overrides survive as a debug-only tool gated on
`x-sahayakai-debug` for explicit canary-busting tests; not a
rollout primitive.

**(d) Static traffic split at the load balancer.** Rejected. Cloud
Run revisions can split traffic, but the split is on the
Genkit/sidecar HTTP service boundary, which doesn't exist on
the Genkit side (Genkit runs in-process to Next.js). And it
gives no way to surface a shadow-diff for parity scoring.

**(e) Two flags per agent (`<agent>SidecarMode` + custom shadow
percent override).** Rejected as overkill for the current 15
agents. The canonical pattern uses one mode + one percent. Per-agent
overrides go in the dispatcher's `decide*` function if ever
needed.
