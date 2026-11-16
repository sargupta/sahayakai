# Deployment readiness — SahayakAI (develop 9245a62a + hardening branch)

Date: 2026-11-15. Scope: what must be true before the hardening branch can run on staging
(`sahayakai-riya-staging`) and later production. **Nothing was deployed, no IAM was changed, no
cloud resource or provider credential was created or modified in this audit.** Every name below
was read from source (`src/**`, `cloudbuild*.yaml`, `Dockerfile`, `scripts/sampark/Deploy-Riya-Staging.ps1`);
no secret values appear in this document.

## 1. Services and how they are built

| Service | Built by | Deploy behaviour | Notes |
|---|---|---|---|
| Production web (`sahayakai-hotfix-resilience`, asia-southeast1) | `cloudbuild.yaml` trigger on push to `main` | Creates a revision with `--no-traffic`; traffic flip is a human step after `scripts/audit-deployments.sh` (see `AGENTS.md`) | Never `gcloud run deploy` by hand |
| Riya staging (`sahayakai-riya-staging`, asia-southeast1) | `cloudbuild-riya-staging.yaml` via `Deploy-Riya-Staging.ps1 -Step Deploy` | **`gcloud run deploy` routes 100 % traffic immediately** (no `--no-traffic`), `--allow-unauthenticated`, `--max-instances=1` | Acceptable for a single-tenant staging service, but it contradicts the AGENTS.md rule; keep it off the production service name |
| VIDYA voice sidecar (`sahayakai-agents`) | its own Dockerfile / `deploy/` | out of scope of this run | Required for hands-free VIDYA (`NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`) |
| Vobiz ↔ Gemini Live bridge | `sahayakai-agents` telephony | not deployed by any script in this repo | Required for Vobiz Riya calls (`VOBIZ_STREAM_BASE_URL`) |

Container: `node:20-alpine`, `USER nextjs`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `CMD node server.js`
(Next standalone). Cloud Run injects `PORT`; the image honours it.

## 2. Health checks

| Endpoint | Expectation |
|---|---|
| `GET /api/health` | 200 `{status:"healthy"}` in a correctly configured deployment. **503 locally by design** (no prod credentials). |
| `GET /api/health/ai` | model reachability (costs a model call — do not use as a liveness probe) |
| `GET /api/webhooks/elevenlabs-riya` | 200 only when Riya flags are on **and** `ELEVENLABS_WEBHOOK_SECRET` is set (used by the staging smoke step) |
| `POST /api/webhooks/elevenlabs-riya` unsigned | must be **401** (staging smoke asserts this) |
| `/api/ai/quiz/health` | admin-only diagnostic. It was on the middleware's public list, which made it always 401; removed from that list in this branch so the admin gate actually works with a token. |

## 3. Secrets (Secret Manager → env) — names only

Staging (`cloudbuild-riya-staging.yaml --set-secrets`):

| Env var read by the app | Secret Manager name | Used for |
|---|---|---|
| `ELEVENLABS_API_KEY` | `RIYA_ELEVENLABS_API_KEY` | outbound Riya calls |
| `ELEVENLABS_WEBHOOK_SECRET` | `RIYA_ELEVENLABS_WEBHOOK_SECRET` | HMAC of `/api/webhooks/elevenlabs-riya` (header `elevenlabs-signature`) — fails closed (503) when unset |
| `SAMPARK_PII_KEY` | `RIYA_SAMPARK_PII_KEY` | phone-number encryption. **Never rotate without a re-encryption plan** (stored numbers become unreadable) |
| `SAMPARK_PHONE_PEPPER` | `RIYA_SAMPARK_PHONE_PEPPER` | phone hashing (same warning) |
| `PROFILE_COMPLETE_COOKIE_SECRET` | `PROFILE_COMPLETE_COOKIE_SECRET` | onboarding cookie |

Additional secrets the code reads (needed per feature, production and/or staging):

| Env var | Feature | Missing ⇒ |
|---|---|---|
| `SAHAYAKAI_REQUEST_SIGNING_KEY` (≥ 32 chars) | Vobiz answer/status/context tokens, Sampark-voice tokens, bridge→app `x-riya-bridge-signature`, VIDYA sidecar stream tokens | fail closed (throws / 503) |
| `CRON_SECRET` | all `/api/jobs/*` (Cloud Scheduler bearer) | 503 (fail closed) |
| `PUBSUB_PUSH_SERVICE_ACCOUNTS` | **now REQUIRED** for Pub/Sub OIDC on `/api/jobs/storage-cleanup` (comma-separated service-account emails) | OIDC path refused (401); `CRON_SECRET` path still works. **Set this before relying on Pub/Sub-pushed cleanup.** |
| `AI_INTERNAL_SECRET` | `/api/jobs/ai-reactive-reply` | 503 |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_*` | billing | webhook 401 (fail closed) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | attendance calls / demo call | 503 |
| `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER` | Vobiz dialling | provider "Not set up" |
| `VOICE_PIPELINE_INTERNAL_KEY` | `X-Internal-Key` for `/api/attendance/call-context`, `/transcript-sync` | 401 |
| `TURNSTILE_SECRET_KEY`, `DEMO_CALL_PEPPER`, `DEMO_CALL_ENC_KEY` | public "Hear the call" demo | demo off |
| `SAMPARK_GCAL_TOKEN_KEY`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Google Calendar sync | mock / off |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | only outside GCP (Cloud Run uses ADC) | — |

## 4. Non-secret configuration (flags)

| Flag | Production expectation |
|---|---|
| `NODE_ENV=production` | **Required.** The dev login (`auth-token=dev-token`) and the no-token mock user are compiled out only by this check (`src/middleware.ts`). |
| `SAMPARK_ENABLED`, `SAMPARK_ELEVENLABS_ENABLED`, `SAMPARK_VOBIZ_RIYA_ENABLED` | per environment |
| `SAMPARK_LIVE_DIAL_ENABLED` | **off** unless real calls are explicitly authorised |
| `SAMPARK_BATCH_REAL_CALLS` | **off** (real class-wide batches). Batch also requires school mode `test`, non-demo school, allow-list, `confirmRealCalls`. |
| `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod` | staging; production data needs `SAMPARK_RIYA_PRODUCTION_DATA_APPROVED` |
| `SAMPARK_RIYA_TEST_ALLOWED_NUMBERS`, `SAMPARK_RIYA_TEST_DAILY_CAP`, `SAMPARK_RIYA_PURPOSES`, `SAMPARK_RIYA_STORE_TRANSCRIPTS`, `SAMPARK_RIYA_TRANSCRIPT_DAYS` | test-mode guard rails |
| `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_BRANCH_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `ELEVENLABS_SOURCE_AGENT_ID` | the existing unified agent (cloudbuild refuses agent == source agent). Do not create another agent. |
| `SAMPARK_PUBLIC_BASE_URL`, `VOBIZ_STREAM_BASE_URL` | public https URLs Vobiz can reach |
| `CALL_ALLOWED_DESTINATIONS` | **recommended in every non-production environment** (attendance-call allow-list; no-op when unset — see audit finding on teacher-entered numbers) |
| `VIDYA_VOICE_LIVE_ENABLED`, `VIDYA_VOICE_LIVE_ALLOWED_UIDS`, `VIDYA_VOICE_PUBLIC_ENABLED`, `NEXT_PUBLIC_VIDYA_LIVE_VOICE`, `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` | VIDYA live voice |
| `CSP_ENFORCED=true` | **not set in any deploy config today** — the CSP ships report-only. Recommended for production. |
| `TWILIO_DISABLE_VALIDATION` | must never be set in production (honoured only on localhost outside production) |

## 5. IAM (runtime service account)

Read from `Deploy-Riya-Staging.ps1`: the runtime account is the default compute SA
`<projectNumber>-compute@developer.gserviceaccount.com`.

- Secret Manager: `roles/secretmanager.secretAccessor` (the script found it project-wide on 2026-10-21; verify it still is).
- Firestore: `roles/datastore.user` on the project (default + `sampark-nonprod` databases).
- Storage: object read/write on `sahayakai-b4248-mumbai` (Library files, exports, Sampark audio).
- Vertex AI: `roles/aiplatform.user` (Genkit / Gemini). Memory notes say only `gemini-3-flash-preview@global` worked on the separate `riya-outbound-staging` project — re-verify the model id per project before go-live.
- Deployer (human): Cloud Build Editor, Cloud Run Admin, Service Account User on the runtime SA, Secret Manager Admin only for `-Step Infra`.
- Cloud Scheduler → `/api/jobs/*`: sends `Authorization: Bearer $CRON_SECRET`. (The middleware comment says "OIDC validated by Cloud Run"; that is inaccurate — the service is public and the jobs are authenticated only by the shared secret.)
- Pub/Sub push → storage-cleanup: push SA must be listed in `PUBSUB_PUSH_SERVICE_ACCOUNTS`, with `--push-auth-token-audience` equal to the endpoint URL.

## 6. Firestore / Storage

- `firestore.rules` changed on this branch (conversations, messages, community chat, group chat now server-write-only; typing status participant-only). **Deploy the rules together with the code** — older clients never wrote these collections directly, so no client breaks (verified: no client-side writes in `src/`). Behavioural check: `node scripts/qa/verify-firestore-rules.mjs --host 127.0.0.1:<port> --project demo-<x>` against an emulator (18/18 pass; 9/18 against the old rules).
- Indexes: `firestore.indexes.json` (no change on this branch).
- Named database `sampark-nonprod` must exist in staging (`-Step Infra` creates it).

## 7. Webhooks (provider-side configuration)

| Provider | URL | Auth |
|---|---|---|
| ElevenLabs post-call | `https://<service>/api/webhooks/elevenlabs-riya` | HMAC `elevenlabs-signature` = `t=<ts>,v0=<hmac(ts.rawBody)>`, window −30 min/+5 min; body ≤ 512 KB (now stream-capped) |
| Vobiz answer/status | `https://<service>/api/webhooks/vobiz-riya/{answer,status}?…token` | per-call signed tokens (`SAHAYAKAI_REQUEST_SIGNING_KEY`) |
| Bridge → app events | `https://<service>/api/webhooks/vobiz-riya/event` | `x-riya-bridge-signature` HMAC over raw body, ±15 min; body stream-capped |
| Razorpay | `https://<service>/api/webhooks/razorpay` | `x-razorpay-signature`; dedupe now on `x-razorpay-event-id`; body ≤ 256 KB |
| Twilio | `/api/attendance/twiml*`, `/api/demo-call/*` | Twilio signature over URL + params |

**Not verified:** no public endpoint exists for this branch; none of the above has been exercised
by the real provider. A local signed POST is not proof of a working public webhook.

## 8. Staging procedure (when authorised — not done here)

1. `-Step Verify` (reads the agent/number, refuses the source agent).
2. `-Step Infra` (sampark-nonprod DB, RIYA_* secrets via hidden prompts).
3. Set `PUBSUB_PUSH_SERVICE_ACCOUNTS` if Pub/Sub cleanup is used; set `CALL_ALLOWED_DESTINATIONS`.
4. `-Step Deploy` (Cloud Build → staging; smoke asserts GET 200 / unsigned POST 401).
5. Add the post-call webhook in ElevenLabs, then `-Step Webhook` (stores the secret, rolls a revision, sends one signed test event).
6. `-Step WindowOn` only for an authorised, time-boxed test call; `-Step WindowOff` after.

## 9. Rollback

- Production: `gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-southeast1 --project=sahayakai-b4248 --to-revisions=<previous>=100` (human action per AGENTS.md).
- Staging: `gcloud run services update-traffic sahayakai-riya-staging --region=asia-southeast1 --to-revisions=<previous>=100`; or set `SAMPARK_ELEVENLABS_ENABLED=false` to stop all Riya traffic without a redeploy.
- Rules: redeploy the previous `firestore.rules` from git (`git show 9245a62a:sahayakai-main/firestore.rules`). Note this re-opens the client-write paths fixed on this branch.
- Emergency stop for calls: school `pause` (`POST /api/sampark/{org}/pause`) or unset `SAMPARK_LIVE_DIAL_ENABLED`.

## 10. External blockers (exact)

1. **GCP:** no deployment of this branch exists; staging needs a Cloud Build run with real `_AGENT_ID` / `_PHONE_NUMBER_ID` / `_SOURCE_AGENT_ID` substitutions and an authorised operator.
2. **GCP:** `PUBSUB_PUSH_SERVICE_ACCOUNTS` must be set wherever Pub/Sub pushes to storage-cleanup (behaviour change on this branch).
3. **GCP:** verify the runtime SA still has project-level Secret Accessor and Vertex AI User; verify the Gemini model id is available in the target project/region.
4. **ElevenLabs:** post-call webhook must be added on the existing unified agent pointing at the deployed URL, and its secret stored as `RIYA_ELEVENLABS_WEBHOOK_SECRET`. Not done.
5. **Vobiz:** account concurrency limit (3 verified 11-10), real origination number, and a publicly reachable bridge (`VOBIZ_STREAM_BASE_URL`) — no deployed bridge exists; local runs used temporary tunnels.
6. **Real microphone:** VIDYA live voice was not verified with a real microphone in this audit (the built-in browser blocks the mic). Must be tested by a person in Chrome.
7. **CSP:** `CSP_ENFORCED` not set anywhere.
