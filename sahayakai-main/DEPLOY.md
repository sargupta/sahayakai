# Deploy runbook — SahayakAI

This file documents the deploy pipelines for SahayakAI on Cloud Run,
project `sahayakai-b4248`. Prod service: `sahayakai-hotfix-resilience`
(Singapore `asia-southeast1` + Mumbai `asia-south1` under the 2026-08
dual-region model). UAT service: `sahayakai-preview`.

For the *rules* every agent / contributor must follow when shipping
code, see [`AGENTS.md`](./AGENTS.md). For the branching / release
policy, see [`docs/BRANCHING.md`](./docs/BRANCHING.md). This file is
for the operator.

---

## The three pipelines (2026-08 delivery model)

| # | Flow | Automation |
|---|---|---|
| P1 | PR → `main` | GitHub Actions gates (`test (20)`, `smoke`, quality gates) — merge blocked until green |
| P2 | `main` push → UAT | Cloud Build `cloudbuild-uat.yaml`: build → `--no-traffic` deploy → smoke → flip; then `uat-verify.yml` (e2e + visual + k6) posts `uat/verified` on the SHA |
| P3 | `release/*` push → prod | Cloud Build `cloudbuild-release.yaml`: both regions, `--no-traffic`; `release-promote.yml` auto-flips with LB-smoke auto-rollback |

There is no `develop` branch and no manual routine deploy. The old
`develop → preview` and push-to-main prod-deploy flows are retired.

## Shipping a change

```bash
# 1. Branch from main, do the work, open a PR
git checkout main && git pull --ff-only origin main
git checkout -b fix/your-change
# ... commit ...
gh pr create --base main

# 2. Merge when P1 gates are green. The merge push fires P2:
#    UAT builds, deploys no-traffic, smokes, flips, then uat-verify.yml
#    runs. Wait for the `uat/verified` commit status on the main SHA.

# 3. Cut a release from a uat/verified SHA (fires P3 in both regions):
bash scripts/release/cut-release.sh

# 4. Promote:
#    - Auto: release-promote.yml flips traffic after the regional builds
#      go green, runs the LB smoke, and AUTO-ROLLS-BACK on failure.
#    - Manual (same logic, human-invoked):
bash scripts/release/promote-release.sh

# 5. Tag the release and delete the release branch:
git tag release-$(date +%F) && git push origin release-$(date +%F)
```

Watch builds at:
https://console.cloud.google.com/cloud-build/builds?project=sahayakai-b4248

## Audit a deployed revision

```bash
./scripts/audit-deployments.sh            # prod
SERVICE=sahayakai-preview ./scripts/audit-deployments.sh   # UAT
```

Look for ✗ in the feature probes. The probes are unauthenticated, so
some logged-in-only features always show as missing — noted in the
script. Real failures are `/api/jobs/*` anomalies and always-SSR
action-tile strings missing.

## Rollback (prod)

```bash
# List recent revisions
gcloud run revisions list \
  --service=sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --limit=10

# Pin traffic to the last known-good revision
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --to-revisions=<known-good-revision>=100
```

Repeat for the Mumbai region (`--region=asia-south1`) — both regions
must be rolled together. Traffic flip is instant. See
[`docs/ROLLBACK.md`](./docs/ROLLBACK.md) for the full procedure.
`release-promote.yml` performs this automatically when its LB smoke
fails during a promote.

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

## Emergency: Cloud Build outage (break-glass)

`scripts/safe-deploy.sh` is the fallback ONLY when Cloud Build itself
is down. Same `--no-traffic` + audit + flip discipline, built via local
`gcloud run deploy --source .`:

```bash
./scripts/safe-deploy.sh
./scripts/audit-deployments.sh
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
```

Reconcile with a real release (P3) as soon as Cloud Build is back.
Never use `safe-deploy.sh` as the routine path.

---

## Triggers: state and retirement plan

| Trigger | Config | Status |
|---|---|---|
| UAT (`^main$`) | `cloudbuild-uat.yaml` | v2 pipeline (P2) — Tranche 2 of the 2026-08 rebuild |
| Release (`^release/.*$`) | `cloudbuild-release.yaml` | v2 pipeline (P3) |
| `sahayakai-main-deploy` (`^main$` → prod) | `cloudbuild.yaml` | **Being retired in Tranche 2.** In the v2 model a `main` push must reach UAT only — a prod build on `main` pushes is a footgun. Delete after the UAT trigger is verified live: `gcloud beta builds triggers delete sahayakai-main-deploy --project=sahayakai-b4248` |
| `sahayakai-preview-deploy` (`^develop$`) | `cloudbuild-preview.yaml` | Retired with the `develop` branch (2026-08-12) |

## One-time setup history (kept for reference)

### Cloud Build GitHub App on `sargupta/sahayakai`

Manual OAuth step, cannot be scripted:

1. Open https://github.com/marketplace/google-cloud-build
2. **Set up plan** → **Configure** → account `sargupta`
3. **Only select repositories** → `sahayakai` → confirm

### Cloud Build SA permissions (already granted)

```bash
PROJECT_ID=sahayakai-b4248
PROJECT_NUMBER=640589855975
SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT_ID"
```

## UAT environment

`sahayakai-preview` is the UAT tier fed by `main` pushes (P2). Full
docs: [`docs/UAT_ENV.md`](./docs/UAT_ENV.md) (renamed from
`PREVIEW_ENV.md`).

URL: `https://sahayakai-preview-640589855975.asia-southeast1.run.app`
