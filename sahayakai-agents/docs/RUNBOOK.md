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

As of Phase J.5 (forensic audit P0 #3), ALL 15 sidecar agents read
their dispatch mode + percent from `system_config/feature_flags`. The
single Firestore patch below rolls every agent back to `off` in one
write — no Cloud Run env-var redeploy required.

```bash
gcloud firestore documents patch system_config/feature_flags \
  --project=sahayakai-b4248 \
  --data='{
    "parentCallSidecarMode":"off","parentCallSidecarPercent":0,
    "lessonPlanSidecarMode":"off","lessonPlanSidecarPercent":0,
    "vidyaSidecarMode":"off","vidyaSidecarPercent":0,
    "quizSidecarMode":"off","quizSidecarPercent":0,
    "examPaperSidecarMode":"off","examPaperSidecarPercent":0,
    "visualAidSidecarMode":"off","visualAidSidecarPercent":0,
    "worksheetSidecarMode":"off","worksheetSidecarPercent":0,
    "rubricSidecarMode":"off","rubricSidecarPercent":0,
    "teacherTrainingSidecarMode":"off","teacherTrainingSidecarPercent":0,
    "virtualFieldTripSidecarMode":"off","virtualFieldTripSidecarPercent":0,
    "instantAnswerSidecarMode":"off","instantAnswerSidecarPercent":0,
    "parentMessageSidecarMode":"off","parentMessageSidecarPercent":0,
    "videoStorytellerSidecarMode":"off","videoStorytellerSidecarPercent":0,
    "avatarSidecarMode":"off","avatarSidecarPercent":0,
    "voiceToTextSidecarMode":"off","voiceToTextSidecarPercent":0,
    "updatedBy":"manual-abort-all"
  }'
```

To roll back a single agent only (preferred — never roll back more
than the alert demands), include only that agent's mode + percent
fields. Examples:

```bash
# Just parent-call:
gcloud firestore documents patch system_config/feature_flags \
  --project=sahayakai-b4248 \
  --data='{"parentCallSidecarMode":"off","parentCallSidecarPercent":0,"updatedBy":"manual-abort"}'

# Just instant-answer:
gcloud firestore documents patch system_config/feature_flags \
  --project=sahayakai-b4248 \
  --data='{"instantAnswerSidecarMode":"off","instantAnswerSidecarPercent":0,"updatedBy":"manual-abort"}'
```

Sidecar Cloud Run service stays running; Next.js simply stops routing
to it. The dispatcher cache TTL is 5 minutes, so the flip propagates
within that window — always try this first. MTTR < 60 seconds (plus
cache TTL).

**Phase J.5 deprecation note.** The previous `npx tsx
src/scripts/update-flags.ts --parent-call-sidecar-mode off` and
per-agent `gcloud run services update --update-env-vars
SAHAYAKAI_<AGENT>_MODE=off` recipes are deprecated and no longer have
any effect on the 12 newly-migrated agents. The Firestore plane is
the canonical source. If you flip an env var on Cloud Run thinking
you've rolled back, you have NOT — the dispatcher reads Firestore.

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

# 8b. Grant the Next.js runtime SA roles/run.invoker on the sidecar.
#     This binding requires the sidecar service to exist, so it can't
#     be done by bootstrap-track-d.sh. Without this, every TwiML hop
#     401s from the sidecar and falls back to Genkit silently.
bash scripts/grant-nextjs-invoker.sh \
    --project sahayakai-b4248 --region asia-southeast1 \
    --service sahayakai-agents-staging \
    --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com

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

## Track C — First Deploy Pre-Work

The IAM and Secret Manager foundation that Track C (first sidecar
deploy) depends on. Run this **once** before `gcloud builds submit`.
The full execution plan items 1–3 (service accounts + roles + secrets)
collapse to a single idempotent script.

### Run

```bash
gcloud auth login            # as a user with the roles below
gcloud config set project sahayakai-b4248
bash sahayakai-agents/scripts/track-c-prework.sh
```

The script asks the operator for one input — the `GOOGLE_GENAI_SHADOW_API_KEY`
value (a Gemini API key disjoint from the live pool, minted from
[Google AI Studio](https://aistudio.google.com/apikey)). Input is hidden
during paste. Re-running the script after a successful first run skips
the prompt because an enabled version already exists.

Required caller roles (your own user account, not the SAs being
created):

- `roles/iam.serviceAccountAdmin`
- `roles/iam.securityAdmin`
- `roles/secretmanager.admin`

### What it does — one line per step

1. **Service accounts** — creates `sahayakai-agents-runtime` (sidecar)
   and `sahayakai-hotfix-resilience-runtime` (Next.js).
2. **Secret containers** — creates `SAHAYAKAI_REQUEST_SIGNING_KEY`,
   `SAHAYAKAI_AGENTS_AUDIENCE`, `GOOGLE_GENAI_SHADOW_API_KEY`. Skips
   `GOOGLE_GENAI_API_KEY` (live key — owned by the Next.js app).
3. **Signing key** — generates `openssl rand -base64 32` (256-bit) and
   writes the first version, only if no enabled version exists.
4. **Audience placeholder** — writes the literal string `pending-deploy`
   as the first version of `SAHAYAKAI_AGENTS_AUDIENCE`. Operator
   overwrites it via `hydrate-audience-secret.sh` after the first
   Cloud Run deploy resolves the real URL.
5. **Shadow Gemini key** — operator pastes once; stored as version 1.
6. **Sidecar SA IAM** — per-secret `roles/secretmanager.secretAccessor`
   on all four secrets, plus project-level `roles/datastore.user`,
   `roles/cloudtrace.agent`, `roles/logging.logWriter`.
7. **Next.js SA IAM** — `roles/secretmanager.secretAccessor` on
   `SAHAYAKAI_REQUEST_SIGNING_KEY` only. The `roles/run.invoker`
   binding on the sidecar service is handled separately by
   `grant-nextjs-invoker.sh` *after* first deploy.
8. **Verification** — prints SAs, secrets, secret versions, per-secret
   IAM bindings, and the sidecar service IAM (empty until first deploy).
   Each block has a `===` header.

### Why each piece matters

- **Two service accounts, not one.** The sidecar's `roles/run.invoker`
  binding must enumerate the *exact* identity allowed to call it. If
  Next.js runs as the default Compute SA, every Cloud Function in the
  project (including unrelated workloads) would qualify. A dedicated
  `sahayakai-hotfix-resilience-runtime` SA tightens the policy to one
  caller.
- **Per-secret accessor (not project-wide).** A project-level
  `roles/secretmanager.secretAccessor` grant gives a single runtime
  read access to **every** secret in the project — including secrets
  belonging to unrelated services. Per-secret bindings limit the blast
  radius of a leaked token.
- **Disjoint shadow Gemini key.** Shadow-mode traffic doubles the
  request volume against Gemini for the duration of the ramp. If the
  shadow key is the same as the live key, you double-count quota and
  the auto-abort spend alert (`> 2× projected daily budget`) trips on
  the very first ramp step.
- **Separate HMAC signing key.** The body-digest header
  `X-Content-Digest: sha256=<base64>` is the wire-level integrity check
  between Next.js and the sidecar. A separate symmetric key (not
  reused as the Gemini key, not reused as a JWT secret) means a leak
  on either path is detectable independently — the sidecar logs an
  `auth.signature_mismatch` event the moment a forged request lands.
- **Audience placeholder.** Cloud Run assigns service URLs only after
  the first deploy. Writing `pending-deploy` lets us bind the sidecar
  SA as accessor right now (the Cloud Run deploy will fail to fetch
  the env var if the secret has zero versions). The operator
  overwrites it with the real URL via `hydrate-audience-secret.sh` in
  the next step.

### Manual verification if the script fails partway

Each `gcloud ... describe` is the inverse check for the corresponding
create. Run the relevant one to see whether the resource is in place,
then resume by re-running the script (idempotent — already-existing
resources are skipped).

```bash
# Service accounts
gcloud iam service-accounts describe sahayakai-agents-runtime@sahayakai-b4248.iam.gserviceaccount.com
gcloud iam service-accounts describe sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com

# Secret containers
gcloud secrets describe SAHAYAKAI_REQUEST_SIGNING_KEY      --project=sahayakai-b4248
gcloud secrets describe SAHAYAKAI_AGENTS_AUDIENCE          --project=sahayakai-b4248
gcloud secrets describe GOOGLE_GENAI_SHADOW_API_KEY        --project=sahayakai-b4248

# Secret versions (look for at least one ENABLED row)
gcloud secrets versions list SAHAYAKAI_REQUEST_SIGNING_KEY --project=sahayakai-b4248
gcloud secrets versions list SAHAYAKAI_AGENTS_AUDIENCE     --project=sahayakai-b4248
gcloud secrets versions list GOOGLE_GENAI_SHADOW_API_KEY   --project=sahayakai-b4248

# Per-secret IAM
gcloud secrets get-iam-policy SAHAYAKAI_REQUEST_SIGNING_KEY --project=sahayakai-b4248

# Project IAM (filter to the two new SAs)
gcloud projects get-iam-policy sahayakai-b4248 \
  --flatten="bindings[].members" \
  --filter="bindings.members~'(sahayakai-agents-runtime|sahayakai-hotfix-resilience-runtime)@'" \
  --format='table(bindings.role,bindings.members)'
```

### Verifying shadow key is disjoint from live key

After step 5, prove the shadow key does not collide with the live key:

```bash
diff <(gcloud secrets versions access latest --secret=GOOGLE_GENAI_API_KEY        --project=sahayakai-b4248) \
     <(gcloud secrets versions access latest --secret=GOOGLE_GENAI_SHADOW_API_KEY --project=sahayakai-b4248)
# Expected: a non-empty diff. An empty diff means shared keys → ABORT and re-mint.
```

### Rollback per step

If you need to undo individual steps (rare — most failures are transient
gcloud quota timeouts and a re-run resumes cleanly):

```bash
# Roll back service accounts (also drops their IAM bindings).
gcloud iam service-accounts delete sahayakai-agents-runtime@sahayakai-b4248.iam.gserviceaccount.com
gcloud iam service-accounts delete sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com

# Roll back a specific secret (destroys ALL versions; use only if the
# secret was created by this script and has no other consumers).
gcloud secrets delete SAHAYAKAI_REQUEST_SIGNING_KEY --project=sahayakai-b4248
gcloud secrets delete SAHAYAKAI_AGENTS_AUDIENCE     --project=sahayakai-b4248
gcloud secrets delete GOOGLE_GENAI_SHADOW_API_KEY   --project=sahayakai-b4248

# Roll back a single project-level role binding.
gcloud projects remove-iam-policy-binding sahayakai-b4248 \
  --member=serviceAccount:sahayakai-agents-runtime@sahayakai-b4248.iam.gserviceaccount.com \
  --role=roles/datastore.user

# Roll back a single per-secret accessor binding.
gcloud secrets remove-iam-policy-binding SAHAYAKAI_REQUEST_SIGNING_KEY \
  --member=serviceAccount:sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor \
  --project=sahayakai-b4248
```

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `PERMISSION_DENIED` on a `gcloud iam service-accounts create` call | Operator's user account lacks `roles/iam.serviceAccountAdmin` | Run `gcloud projects add-iam-policy-binding sahayakai-b4248 --member=user:<your-email> --role=roles/iam.serviceAccountAdmin` (requires Org admin) or escalate. |
| `PERMISSION_DENIED` on `gcloud secrets create` | Missing `roles/secretmanager.admin` | Same pattern as above with `roles/secretmanager.admin`. |
| `PERMISSION_DENIED` on `gcloud projects add-iam-policy-binding` | Missing `roles/iam.securityAdmin` | Same pattern. |
| `ALREADY_EXISTS` from one of the create calls | Idempotency check missed an edge case (race with another operator, or partial state from a prior run that crashed before the script's `describe` could see the resource) | This is a script bug. File it: capture the failing command, the existing resource's `gcloud ... describe` output, and the prior-run logs. The script should never surface an `ALREADY_EXISTS` to the operator. |
| `INVALID_ARGUMENT: ... secret data is empty` on `gcloud secrets versions add` | Operator pasted an empty string into the shadow-key prompt | Re-run the script. The explicit length check rejects pastes shorter than 30 chars before they reach `gcloud`. |
| Shadow key prompt never appears | `GOOGLE_GENAI_SHADOW_API_KEY` already has an enabled version | Expected on re-runs. To verify the stored key, run the disjoint-key diff command above. To rotate, run `gcloud secrets versions add GOOGLE_GENAI_SHADOW_API_KEY --data-file=-` directly. |
| `gcloud config get-value project` returns blank or wrong ID | Step 0 sanity check fires before any side effect | Run `gcloud config set project sahayakai-b4248` and re-run. |

## Related docs

- Execution plan: `/Users/sargupta/.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md`
- Architecture: `sahayakai-agents/ARCHITECTURE.md`
- Parent migration plan (Notion, canonical): <https://www.notion.so/34c7b61acae78105ad61e80319556b7b>
- Phase 2 (voice via Gemini Live): `.claude/plans/phase-2-vidya-voice-gemini-live.md`
- Phase 3 (writer-evaluator-reviser for lesson plans): `.claude/plans/phase-3-writer-evaluator-reviser.md`
- Phase 4 (RAG over NCERT + state boards): `.claude/plans/phase-4-rag-ncert-state-board.md`
