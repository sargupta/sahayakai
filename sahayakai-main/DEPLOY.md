# Deploy runbook — SahayakAI

This file documents the deploy pipelines for SahayakAI on Cloud Run,
project `sahayakai-b4248`. Prod service: `sahayakai-hotfix-resilience`
(Singapore `asia-southeast1` + Mumbai `asia-south1` under the 2026-08
dual-region model). UAT service: `sahayakai-preview`.

For the *rules* every agent / contributor must follow when shipping
code, see [`AGENTS.md`](./AGENTS.md). For the branching / release
policy, see [`docs/BRANCHING.md`](./docs/BRANCHING.md). This file is
for the operator.

> ⚠ **CURRENT STATE (2026-08-14): the three-pipeline model below is the
> TARGET — P2 and P3 are NOT live yet.** Today, a push to `main` fires
> the **LIVE `sahayakai-main-deploy` trigger** → prod `--no-traffic`
> build via `cloudbuild.yaml` (flip is manual); nothing auto-deploys the
> UAT tier. The P2/P3 configs (`cloudbuild-uat.yaml`,
> `cloudbuild-release.yaml`, `uat-verify.yml`, `release-promote.yml`,
> `scripts/release/*`) land in Tranches 2–3 — activation tracked in
> [`docs/IMPLEMENTATION_LEDGER_2026-08.md`](./docs/IMPLEMENTATION_LEDGER_2026-08.md).
> Until then, "Shipping a change" below is the target procedure, not
> today's; the operative pieces today are the trigger table, rollback,
> audit, and break-glass sections.

---

## The three pipelines (2026-08 delivery model)

| # | Flow | Automation |
|---|---|---|
| P1 | PR → `main` | GitHub Actions gates (`test (20)`, `smoke`, quality gates) — merge blocked until green |
| P2 | `main` push → UAT | Cloud Build `cloudbuild-uat.yaml`: build → `--no-traffic` deploy → smoke → flip; then `uat-verify.yml` (e2e + visual + k6) posts `uat/verified` on the SHA |
| P3 | `release/*` push → prod | Cloud Build `cloudbuild-release.yaml`: both regions, `--no-traffic`; `release-promote.yml` auto-flips with LB-smoke auto-rollback |

There is no `develop` branch (retired 2026-08-12, along with its
`sahayakai-preview-deploy` trigger). The push-to-main prod-deploy flow
(`sahayakai-main-deploy` → `cloudbuild.yaml`) is **being retired in
Tranche 2 — its trigger is still LIVE today**; see the trigger table
below.

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
# from a fix branch: PR into main (trunk — develop is retired 2026-08)
gh pr create --base main ...
# merge → sahayakai-uat-deploy trigger fires (UAT deploy + smoke + flip)

# When ready to release (requires uat/verified commit status on the SHA)
bash sahayakai-main/scripts/release/cut-release.sh
# push of release/* fires sahayakai-release-deploy (both regions, no traffic)
bash sahayakai-main/scripts/release/promote-release.sh --sha <short-sha>
```

The push triggers the `sahayakai-main-deploy` Cloud Build job. Watch
it at:

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
| UAT (`^main$`) | `cloudbuild-uat.yaml` | **Does not exist yet** — created in Tranche 2 of the 2026-08 rebuild (P2) |
| Release (`^release/.*$`) | `cloudbuild-release.yaml` | **Does not exist yet** — created in Tranche 3 (P3) |
| `sahayakai-main-deploy` (`^main$` → prod) | `cloudbuild.yaml` | **LIVE today; being retired in Tranche 2.** Every `main` push builds a prod revision at `--no-traffic` (flip manual). In the v2 model a `main` push must reach UAT only — a prod build on `main` pushes is a footgun. Delete only after the UAT trigger is verified live: `gcloud beta builds triggers delete sahayakai-main-deploy --project=sahayakai-b4248` |
| `sahayakai-preview-deploy` (`^develop$`) | `cloudbuild-preview.yaml` | Retired with the `develop` branch (2026-08-12) |

## One-time setup history (kept for reference)

| Branch       | Deploys to                              |
|--------------|-----------------------------------------|
| `main`       | `sahayakai-preview` (UAT)               |
| `release/*`  | `sahayakai-hotfix-resilience` (PROD)    |
| `hotfix/*`   | `sahayakai-hotfix-resilience` (PROD)    |
| `develop`    | ABORT (retired 2026-08 — trunk is main) |
| anything else| ABORT (open PR to main)                 |

Manual OAuth step, cannot be scripted:

To wire the auto-deploy Cloud Build triggers (T2 of the pipeline
rebuild):

1. Install the Cloud Build GitHub App (manual OAuth):
   open https://github.com/marketplace/google-cloud-build → Set up plan →
   Configure → account `sargupta` → Only select repositories → `sahayakai`.
2. Run `bash scripts/setup-build-trigger-uat.sh` (UAT, main →
   cloudbuild-uat.yaml) and `bash scripts/setup-build-trigger.sh` (prod,
   release/* → cloudbuild-release.yaml).
3. **Delete the retired legacy triggers** or every push to main
   double-fires (legacy `sahayakai-main-deploy` deploys toward prod in
   parallel with the UAT pipeline):
   `bash scripts/teardown-legacy-triggers.sh`
4. Wire the `GCP_DEPLOYER_KEY` repo secret so
   `.github/workflows/release-promote.yml` can auto-promote (until then it
   is a safe no-op stub).
5. Verify with `gcloud beta builds triggers list --project=sahayakai-b4248`.

```bash
PROJECT_ID=sahayakai-b4248
PROJECT_NUMBER=640589855975
SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

`sahayakai-preview` is a separate Cloud Run service — the UAT tier.
Auto-deploys from main tip once the GitHub App is reinstalled and the
`sahayakai-uat-deploy` trigger exists; until then, manual via
`safe-deploy.sh` after `git checkout main`. It is where features get
validated (and marked `uat/verified`) before a release branch is cut. Full docs: [`docs/UAT_ENV.md`](./docs/UAT_ENV.md) (renamed from `PREVIEW_ENV.md`).

URL: `https://sahayakai-preview-640589855975.asia-southeast1.run.app`
