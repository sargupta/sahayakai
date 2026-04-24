# Runbook — sahayakai-agents

On-call operations playbook for the Python ADK sidecar deployed as Cloud
Run service `sahayakai-agents` in `asia-southeast1`, project
`sahayakai-b4248`.

## What this service does

Serves two endpoints consumed by the Next.js Twilio webhook at
`sahayakai-main/src/app/api/attendance/twiml/route.ts`:

- `POST /v1/parent-call/reply` — per-turn reply during a live parent
  phone call.
- `POST /v1/parent-call/summary` — structured English summary after the
  call ends.

All replies pass through a **fail-closed post-response behavioural
guard** (forbidden-phrase scan, sentence-count bound, script-correctness
per parent language). A guard failure returns HTTP 502; the Next.js
circuit breaker falls back to the existing Genkit path within the same
Twilio webhook lifetime. Wrong output to a real parent is worse than no
output.

## Where to look when things break

Cloud Run console:
<https://console.cloud.google.com/run/detail/asia-southeast1/sahayakai-agents/metrics?project=sahayakai-b4248>

Cloud Logging filter snippets (enter at
<https://console.cloud.google.com/logs/query?project=sahayakai-b4248>):

- **All sidecar logs:** `resource.type="cloud_run_revision" AND resource.labels.service_name="sahayakai-agents"`
- **Reply path:** `jsonPayload.span_name="parent_call.reply"`
- **Summary path:** `jsonPayload.span_name="parent_call.summary"`
- **Behavioural guard trips:** `jsonPayload.event="parent_call.reply.behavioural_guard_failed"`
- **AI retry failures:** `jsonPayload.event="ai_resilience.attempt_failed"`
- **Session OCC collisions (usually benign Twilio retries):** `severity="ERROR" AND jsonPayload.message=~"SessionConflictError"`

Cloud Trace (request waterfall):
<https://console.cloud.google.com/traces/list?project=sahayakai-b4248>.
Filter by `service.name="sahayakai-agents"`.

## Rollback path 1 — flag flip, under 60 seconds

No redeploy. No Cloud Run change. Flips the Firestore feature flag that
Next.js reads before dispatching to the sidecar.

```
cd sahayakai-main
npx tsx src/scripts/update-flags.ts --parent-call-sidecar-mode off
```

This leaves the sidecar Cloud Run service running; Next.js simply stops
routing to it and all parent calls go through the Genkit path. Always
try this first. MTTR < 60 seconds.

## Rollback path 2 — revision traffic revert

Only if the flag flip is insufficient (e.g. the sidecar is emitting
structured-log spam that's hitting a cost alert). Reverts to the
previous Cloud Run revision:

```
gcloud run services update-traffic sahayakai-agents \
  --to-revisions=<previous-revision>=100 \
  --region=asia-southeast1 --project=sahayakai-b4248
```

List revisions with `gcloud run revisions list --service=sahayakai-agents --region=asia-southeast1`.

## Known failure modes

- **HTTP 422 `AI_SAFETY_BLOCK`** — Gemini's safety filter refused to
  generate. Do not retry. Next.js drops to a canned fallback.
- **HTTP 503 `AI_QUOTA_EXHAUSTED` with `Retry-After`** — all keys in the
  pool are 429'd. Usually a per-minute quota window; resolves in < 60s.
  If it persists > 5 min, rotate in a fresh key via Secret Manager.
- **HTTP 409 `CONFLICT` on session writes** — Twilio webhook retry
  arrived for a turn already recorded. Benign; Next.js treats as
  idempotent. Rate > 0.1% of calls is a concurrency bug — page.
- **HTTP 502 on behavioural guard** — reply failed the forbidden-phrase,
  sentence-count, or script-match check. Next.js falls back to Genkit.
  **Must page** because either the model drifted or our guard is wrong.
  Inspect `jsonPayload.event="parent_call.reply.behavioural_guard_failed"`
  logs; include the reply text excerpt (logged with PII redacted).

## Abort criteria (auto-revert via Cloud Monitoring → Cloud Function)

Any one of these trips → flag flipped back one step automatically:

- Sidecar error rate > 2% over any rolling 15-minute window.
- Sidecar p95 latency > 3.5 s over 15 minutes (would trip Next.js
  client timeout).
- Behavioural-guard 502 rate > 0.5% of calls.
- Shadow-diff mean LaBSE similarity < 0.75 over any 500-call window.
- Firestore `SessionConflictError` 409 rate > 0.1%.
- Sidecar Gemini spend > 2× projected daily budget over 2 consecutive
  hours.

## On-call rotation

**TBD — set up PagerDuty service and link here before Track D (shadow
mode) begins.** Until then, alerts route to the #sahayakai-oncall Slack
channel as the primary notification surface.

## Related docs

- Execution plan: `/Users/sargupta/.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md`
- Architecture: `sahayakai-agents/ARCHITECTURE.md`
- Parent migration plan (Notion, canonical): <https://www.notion.so/34c7b61acae78105ad61e80319556b7b>
