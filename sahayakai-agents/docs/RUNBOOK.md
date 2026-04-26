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

## First-time Track D bootstrap (one-shot)

For the very first shadow ramp, run these in order from a workstation
with the project-admin roles listed in each script's header. The
bootstrap script handles everything from SAs to alert policies; the
remaining four are the data-plane bits (TTL, signing key, fixtures,
flag seed) that need a real input from the operator.

```bash
# 1. Firestore rules (clients deny-by-default on agent_*).
cd sahayakai-main && firebase deploy --only firestore:rules
cd ..

# 2. One-shot Track D resource bootstrap (SAs + IAM + Pub/Sub +
#    Cloud Functions + alert policies + scheduler).
bash sahayakai-agents/scripts/bootstrap-track-d.sh \
    --project sahayakai-b4248 --region asia-southeast1

# 3. Firestore TTL on the new collections.
bash sahayakai-agents/scripts/apply-firestore-ttl.sh \
    --project sahayakai-b4248

# 4. Generate + store the HMAC signing key (idempotent rotation).
bash sahayakai-agents/scripts/generate-signing-key.sh \
    --project sahayakai-b4248

# 5. Manual: store a Gemini API key DISJOINT from the live pool as
#    GOOGLE_GENAI_SHADOW_API_KEY:latest. The shadow-key pool is what
#    the sidecar uses during shadow-mode traffic; sharing keys with
#    the live pool would double-count quota.
gcloud secrets versions add GOOGLE_GENAI_SHADOW_API_KEY \
    --data-file=/path/to/shadow-key.txt --project=sahayakai-b4248

# 6. Seed the feature_flags doc so auto-abort can update it.
bash sahayakai-agents/scripts/seed-feature-flags.sh \
    --project sahayakai-b4248

# 7. Record the parity fixtures (~$0.05 in Gemini API spend).
cd sahayakai-main
GOOGLE_GENAI_API_KEY=$(gcloud secrets versions access latest \
    --secret=GOOGLE_GENAI_API_KEY --project=sahayakai-b4248) \
    npm run record:parent-call-fixtures
git add ../sahayakai-agents/tests/fixtures/parent_call_turns.json
git commit -m "test(parent-call): record 22-turn fixture set"
git push
cd ..

# 8. Deploy the sidecar.
cd sahayakai-agents
gcloud builds submit --config=deploy/cloudbuild.yaml

# 9. Hydrate the audience secret + smoke test.
bash scripts/hydrate-audience-secret.sh \
    --service sahayakai-agents-staging \
    --region asia-southeast1 --project sahayakai-b4248
SERVICE_URL=$(gcloud run services describe sahayakai-agents-staging \
    --region=asia-southeast1 --project=sahayakai-b4248 \
    --format='value(status.url)')
bash scripts/post-deploy-smoke.sh \
    --url "$SERVICE_URL" \
    --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com \
    --with-impersonation

# 10. Final preflight — 15 gates.
bash scripts/preflight-shadow-ramp.sh \
    --project sahayakai-b4248 --region asia-southeast1 \
    --service sahayakai-agents-staging \
    --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com

# If preflight is all-green, flip the flag:
gcloud firestore documents patch system_config/feature_flags \
    --project=sahayakai-b4248 \
    --data='{"parentCallSidecarMode":"shadow","parentCallSidecarPercent":1}'
```

Each script is idempotent — re-running on a partially-applied state
resumes from where it left off.

## Related docs

- Execution plan: `/Users/sargupta/.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md`
- Architecture: `sahayakai-agents/ARCHITECTURE.md`
- Parent migration plan (Notion, canonical): <https://www.notion.so/34c7b61acae78105ad61e80319556b7b>
- Phase 2 (voice via Gemini Live): `.claude/plans/phase-2-vidya-voice-gemini-live.md`
- Phase 3 (writer-evaluator-reviser for lesson plans): `.claude/plans/phase-3-writer-evaluator-reviser.md`
- Phase 4 (RAG over NCERT + state boards): `.claude/plans/phase-4-rag-ncert-state-board.md`
