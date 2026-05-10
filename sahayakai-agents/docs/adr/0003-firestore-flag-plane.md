# 3. Single Firestore flag plane for all 15 agent dispatchers

- Status: accepted
- Date: 2026-04-28
- Phase reference: J.5
- Commit reference: [`dec628b3b`](../../../) — `fix(phase-j.5): consolidate flag plane to Firestore for all 12 agents`

## Context

The four-mode dispatcher pattern (ADR 2) needs a flag plane the
auto-abort Cloud Function can flip during a brownout. That
function (`cloud_functions/auto_abort/main.py`) wakes when a
Cloud Monitoring alert (parity drift, latency spike, error rate)
fires — its job is to roll every agent back to `off` mode in
seconds, no deploy, no human in the loop.

State of the world before J.5:

- 3 agents (parent-call, lesson-plan, vidya) read flags from
  Firestore via `getFeatureFlags()`. These were the original
  Track A pattern.
- 12 agents (quiz, exam-paper, visual-aid, worksheet, rubric,
  teacher-training, virtual-field-trip, instant-answer,
  parent-message, video-storyteller, avatar-generator,
  voice-to-text) read from `process.env.SAHAYAKAI_*_MODE`. This
  was the cheap shortcut during Phase F-I when each agent's
  dispatcher was scaffolded in a hurry.

**The auto-abort Cloud Function only writes Firestore.** It
cannot SSH into Cloud Run revisions to overwrite environment
variables. So a brownout flip rolled back 3 of 15 agents — the
12 env-var agents kept serving suspect output until a human ran
`gcloud run services update --update-env-vars` for each one.

Forensic audit P0 #3 called this out as unacceptable: a single
flag flip MUST roll back every agent. Mixed-plane rollback is
no rollback.

## Decision

**Migrate all 12 env-var dispatchers to Firestore.** The
post-migration flag plane:

- Single document: `system_config/feature_flags` (the same
  document that already holds plan limits, kill switches,
  maintenance mode).
- Schema: `FeatureFlagsConfig` in
  [`sahayakai-main/src/lib/feature-flags.ts`](../../../sahayakai-main/src/lib/feature-flags.ts:94)
  extended with 12 typed `<agent>SidecarMode: SidecarMode` +
  `<agent>SidecarPercent: number` field pairs. Type-safe at
  read time across all 15 dispatchers.
- `FALLBACK_CONFIG`: every new field defaults to `off` / `0`.
  If Firestore is unreachable on cold start, dispatchers serve
  Genkit only — never accidentally serve sidecar.
- Read pattern: each dispatcher's `decide*` function calls
  `await getFeatureFlags()` (cached in-memory with TTL) and
  reads the typed field. The TS shape was already async on
  3 dispatchers; the 12 newly-migrated ones became async too.
  Call sites updated.
- Migration script: `scripts/migrate-flag-plane.ts` —
  idempotent one-off that reads any existing
  `SAHAYAKAI_*_MODE` env values from a snapshot file and
  upserts them into Firestore. Safe to re-run.
- Auto-abort Cloud Function: `_FLAG_FIELDS` extended to cover
  all 12 new pairs. One Firestore document update now flips
  every agent.
- RUNBOOK: per-agent `gcloud run services update --update-env-vars`
  recipes replaced with a single Firestore update command.
- Tests: 6 new feature-flag test cases in
  `__tests__/lib/feature-flags-extended.test.ts` verifying each
  new field round-trips, plus updated dispatch tests for the
  three agents whose dispatcher was already on Firestore.

## Consequences

**Positive:**

- Single rollback surface. The auto-abort Cloud Function flips
  every agent in one Firestore write, completing in <1 s.
- No deploy needed for a rollback. RUNBOOK reduced from a
  per-agent gcloud incantation table to one `firebase firestore:write`
  command.
- Type safety: `FeatureFlagsConfig` exhaustively types every
  flag the system reads. Drift from the typed shape is a
  TypeScript compile error.
- Operational consistency: every agent's flag follows the
  same field-naming convention (`<agent>SidecarMode`,
  `<agent>SidecarPercent`), so playbook examples generalise.
- Audit log: Firestore writes are auditable in Cloud Logging
  with the calling principal. Env-var changes via
  `gcloud run services update` are auditable too but require
  a separate log query — the Firestore plane gives a single
  pane.

**Negative / costs:**

- Every dispatcher incurs one Firestore document read per
  request decision. The in-memory TTL cache in
  `getFeatureFlags()` keeps steady-state cost near zero
  (one read per cache TTL across the entire process), but
  cold starts pay the Firestore round-trip. The 1.5 s
  decide-timeout (ADR 2) caps the worst case at 1.5 s, falling
  back to `off`.
- Firestore is now in the critical path of every dispatch
  decision. A regional Firestore outage degrades all 15
  agents to `off` mode (Genkit only). This is the right
  default — it's safer than serving from a stale env var
  during an incident — but it means Firestore availability
  is part of the SLO chain.
- `decide*` had to become `async` everywhere. Call sites in
  TwiML routes and API handlers were updated; this was the
  bulk of the diff.
- The migration script is idempotent but the Phase J.5
  cutover required coordination: Cloud Run revisions still
  carrying the `SAHAYAKAI_*_MODE` env vars were drained
  before the env vars were dropped from the deploy template,
  so the post-migration revision reads only Firestore.

**Operational:**

- A single jq incantation reads every flag:
  `firebase firestore:get system_config/feature_flags --format json | jq '.[]SidecarMode'`.
- Feature-flag changes are also picked up by the
  `auto_abort` ladder during normal operation — promoting
  shadow→canary, canary→full, or rolling back canary→shadow
  on parity drift. ADR 2 invariants (decide-timeout, abort
  rethrow, behavioural-fail-no-fallback) all rest on this
  flag plane being singular.

## Alternatives considered

**(a) Stay on env vars and teach the auto-abort function to
update Cloud Run revisions.** Rejected. Cloud Run env-var
updates trigger a new revision, which takes ~30-60 seconds to
become healthy, which is too slow for a brownout flip. Also
forces the Cloud Function to hold IAM permissions for
`run.services.update` — a much wider blast radius than
`firestore.documents.write` on one document.

**(b) GCP Runtime Config / Cloud Config.** Rejected. Adds a
service dependency we don't have elsewhere. Firestore is
already in the critical path for plan limits, kill switches,
and maintenance mode; reusing it costs nothing.

**(c) GitHub-pulled YAML flag file.** Rejected. Pull cadence
is too slow for an incident. Auto-abort writes Firestore in
seconds; pulling a YAML on a sidecar pod requires a redeploy
or a custom poll loop, neither acceptable.

**(d) Per-agent flag documents (`system_config/feature_flags_<agent>`).**
Rejected as premature decomposition. The current single
document is well under Firestore's 1MB per-doc cap and gets
read together by `getFeatureFlags()` in one round-trip. If
the document ever approaches the limit, the field naming
convention makes a clean per-agent split trivial.
