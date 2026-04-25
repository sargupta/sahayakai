# Deploy runbook — SahayakAI

This file documents the production deploy pipeline for
`sahayakai-hotfix-resilience` on Cloud Run, project `sahayakai-b4248`,
region `asia-southeast1`.

For the *rules* every agent / contributor must follow when shipping
code, see [`AGENTS.md`](./AGENTS.md). This file is for the operator
who actually flips traffic.

---

## One-time setup (already done — keep for reference)

### 1. Install the Cloud Build GitHub App on `sargupta/sahayakai`

This is a manual OAuth step that cannot be scripted from `gcloud`.

1. Open https://github.com/marketplace/google-cloud-build
2. Click **Set up plan** → **Configure**
3. Pick the `sargupta` account
4. Choose **Only select repositories** → `sahayakai`
5. Confirm

### 2. Create the trigger

```bash
./scripts/setup-build-trigger.sh
```

Idempotent — re-run any time you want to update branch pattern,
build-config path, or included files.

### 3. Grant the Cloud Build SA permission to deploy Cloud Run + read Artifact Registry

Already done; documented for completeness.

```bash
PROJECT_ID=sahayakai-b4248
PROJECT_NUMBER=640589855975
SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Allow Cloud Build SA to deploy Cloud Run revisions
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/run.admin"

# Allow Cloud Build SA to act-as the Cloud Run runtime SA
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"
```

---

## Day-to-day: shipping a change

```text
┌────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│ git push       │ ──▶ │ Cloud Build      │ ──▶ │ Cloud Run revision   │
│ origin main    │     │ runs             │     │ created with         │
│                │     │ cloudbuild.yaml  │     │ --no-traffic + tag   │
└────────────────┘     └──────────────────┘     └──────────────────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────────┐
                                                │ Audit + flip traffic │
                                                │ (manual, by you)     │
                                                └──────────────────────┘
```

### 1. Push your change

```bash
# from a fix branch
git checkout develop
git pull --ff-only origin develop
git merge fix/your-change --no-ff
git push origin develop

# When ready to release
git checkout main
git pull --ff-only origin main
git merge develop --no-ff
git push origin main          # ← trigger fires here
```

The push triggers the `sahayakai-main-deploy` Cloud Build job. Watch
it at:

https://console.cloud.google.com/cloud-build/builds?project=sahayakai-b4248

It typically takes 6–10 min. When green, a new revision exists in
Cloud Run with **0 % traffic** and a tag `sha-<short-sha>`.

### 2. Audit the new revision

```bash
./scripts/audit-deployments.sh
```

Look for ✗ in the feature probes. The probes are unauthenticated, so
some features that only render for logged-in users will always show
as missing — these are noted in the script. Real failures are:

- `/api/jobs/*` returning anything other than the expected status
- An action-tile string that should always SSR (e.g. `Open chat with
  every teacher`) showing as missing.

If the audit is clean, proceed. If anything looks wrong, **do not flip
traffic** — open the build log to investigate.

### 3. Flip traffic to the new revision

```bash
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --to-latest
```

This is the only step that affects production users. Re-run the audit
script afterwards to confirm.

### 4. (Optional) Smoke test from a real account

Open https://sahayakai-hotfix-resilience-640589855975.asia-southeast1.run.app/community
in your logged-in browser and confirm the change is visible.

---

## Rollback

If a deploy goes wrong:

```bash
# List recent revisions
gcloud run revisions list \
  --service=sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --limit=10

# Pick the last known-good revision (e.g. sahayakai-hotfix-resilience-00280-lin)
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --to-revisions=sahayakai-hotfix-resilience-00280-lin=100
```

Traffic flip is instant. Rollback in under a minute.

---

## Cron jobs (live in production)

| Job                              | Schedule (IST)        | What                                                         |
| -------------------------------- | --------------------- | ------------------------------------------------------------ |
| `sahayakai-daily-briefing`       | 08:00 daily           | 3 national + state-level news posts in 10 Indic languages.   |
| `sahayakai-community-agent`      | every 3 h             | 1–2 Staff Room chats + 1 group post + likes from AI personas |
| `sahayakai-grow-persona-pool`    | Mon 04:00 weekly      | +5 new AI persona profiles via Gemini                        |

Manage with `gcloud scheduler jobs ...`. Setup scripts live in
`scripts/setup-*-cron.sh`.

---

## Emergency: trigger is broken / Cloud Build outage

Use `scripts/safe-deploy.sh` as a fallback. Same `--no-traffic` +
audit + flip workflow, but builds via local `gcloud run deploy
--source .` instead of the trigger.

```bash
./scripts/safe-deploy.sh
./scripts/audit-deployments.sh
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
```
