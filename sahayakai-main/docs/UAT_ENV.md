# UAT Environment

> Renamed from `PREVIEW_ENV.md` (2026-08). The Cloud Run service keeps its
> historical name `sahayakai-preview`, but its role in the v2 delivery
> model is the **UAT tier**: every push to `main` auto-builds and
> auto-deploys here via `cloudbuild-uat.yaml` (Pipeline 2 in
> [docs/BRANCHING.md](./BRANCHING.md)). After the deploy,
> `uat-verify.yml` runs e2e + visual + load verification and stamps the
> `main` SHA with the `uat/verified` commit status — the precondition for
> cutting a release. Real teachers do NOT see this tier — it's for
> Abhishek, QA, demos, and the automated verification suite.

> ⚠ **CURRENT STATE (2026-08-14): Pipeline 2 is NOT live yet.** Nothing
> auto-deploys this service today — `cloudbuild-uat.yaml` and
> `uat-verify.yml` land in Tranche 2 (tracked in
> [docs/IMPLEMENTATION_LEDGER_2026-08.md](./IMPLEMENTATION_LEDGER_2026-08.md)).
> Today a `main` push instead fires the LIVE `sahayakai-main-deploy`
> trigger → **prod** `--no-traffic` build via `cloudbuild.yaml`. Until T2
> lands, this service only updates via a manual `safe-deploy.sh`-style
> deploy; the "How deploys work" section below describes the target flow.

## URL

Cloud Run-assigned URL (find with `gcloud run services describe sahayakai-preview --region=asia-southeast1 --format='value(status.url)'`). Looks like `https://sahayakai-preview-<hash>-as.a.run.app`.

A custom domain (`uat.sahayakai.com`) is not yet wired — provision if QA usage grows.

## What's on UAT right now

The latest commit on `main` that finished its UAT build. Tagged-revision URL for a specific SHA:

```
https://sha-<short-sha>---sahayakai-preview-<hash>-as.a.run.app
```

## How deploys work (Pipeline 2)

1. **Push to `main`** (i.e. any PR merge)
2. Cloud Build trigger fires `cloudbuild-uat.yaml`
3. Build: Docker build → push to Artifact Registry → `gcloud run deploy` with `--no-traffic` and a `sha-<short-sha>` tag
4. Smoke probe against the tagged revision
5. Traffic flip to the new revision on smoke pass
6. GitHub Actions `uat-verify.yml` then runs Playwright e2e + visual regression + k6 load probe against the tier and posts the **`uat/verified`** commit status on the `main` SHA

This mirrors prod's no-traffic-then-flip discipline (unlike the v1 preview flow, which deployed traffic-first). Prod itself only moves via `release/*` branches — see Pipeline 3 in [docs/BRANCHING.md](./BRANCHING.md).

## Env vars

UAT deploys with these env vars baked at deploy time:

- `DEMO_MODE=true` — gates demo-only features (Community Personas seeding, etc.) ON in UAT, OFF in prod. **Scheduled for retirement** — see "Project split" below.
- `NODE_ENV=production` — same as prod so app behaves like prod

Plus all `--set-secrets` pulls that prod has (shared Secret Manager secrets — Firebase service account, Genkit API key, etc.).

## Project split (planned)

UAT currently writes to the **same** Firebase project as prod (`sahayakai-b4248`), so UAT writes to community chat, notifications, etc. land in prod data. The 2026-08 rebuild retires this shared-project setup:

- **Cloud Build substitutions** `_DEPLOY_PROJECT` and `_FB_*` parameterise the target GCP project and Firebase config per pipeline, so `cloudbuild-uat.yaml` and `cloudbuild-release.yaml` share build logic but deploy to different projects.
- **`DEMO_MODE` retirement**: the blunt boolean is replaced by explicit configuration — first `COMMUNITY_CHAT_COLLECTION` (UAT points at an isolated collection, prod at the real one), then a separate Firebase project entirely once the substitutions land.
- Until the split lands, the v1 mitigation stands: Firestore-writing demo features must check `DEMO_MODE` and route to `*_preview` collection prefixes.

## Costs

- Min instances: 0 (cold start ~3–5s on first request after idle)
- Max instances: 20
- Memory: 2Gi, CPU: 2

Estimated $5–10/mo at current usage. Bump min-instances to 1 (~$30–50/mo) if cold-start is annoying.

## Logs

```bash
# Tail recent UAT logs
gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="sahayakai-preview"' \
  --limit=50 --format=json --project=sahayakai-b4248

# Specific revision
gcloud logging read 'resource.type="cloud_run_revision" resource.labels.revision_name="sahayakai-preview-<rev>"' \
  --limit=50 --format=json --project=sahayakai-b4248
```

## Smoke test against UAT

```bash
URL=$(gcloud run services describe sahayakai-preview --region=asia-southeast1 \
  --project=sahayakai-b4248 --format='value(status.url)')
BASE="$URL" bash scripts/smoke-test.sh
```

## Audit UAT

```bash
SERVICE=sahayakai-preview bash scripts/audit-deployments.sh
```

## Rollback

UAT rollback is essentially "point traffic at a previous revision" (or land a revert PR on `main`, which redeploys):

**A. Pin to a previous tagged revision:**

```bash
gcloud run services update-traffic sahayakai-preview \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --to-revisions sahayakai-preview-<rev>=100
```

**B. Revert the offending commit on `main`:**

```bash
git checkout main && git pull --ff-only
git revert <bad-commit-sha>
# open a PR — the merge redeploys UAT via Pipeline 2
```

## What UAT verification covers before a release

A `main` SHA is release-eligible when `uat/verified` is green, which means:

- [ ] `/api/health` returns 200 with all env vars present
- [ ] Public-route e2e suite passes against the live tier
- [ ] Visual regression suite passes
- [ ] k6 load probe within thresholds
- [ ] Smoke test (`scripts/smoke-test.sh`) passed during the deploy flip

Manual spot checks (auth flow, one AI flow end-to-end, one VIDYA voice flow, anything new in the release) remain good practice before cutting a release — see the release procedure in [docs/BRANCHING.md](./BRANCHING.md).

## Provisioning history (2026-05-21, one-time — kept for reference)

The service was provisioned as `sahayakai-preview`, the v1 staging tier fed by `develop`:

```bash
gcloud run deploy sahayakai-preview \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --image=asia-southeast1-docker.pkg.dev/sahayakai-b4248/cloud-run-source-deploy/sahayakai-hotfix-resilience:latest \
  --memory=2Gi --cpu=2 --min-instances=0 --max-instances=20 \
  --allow-unauthenticated \
  --service-account=sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com \
  --set-env-vars=NODE_ENV=production,DEMO_MODE=true \
  --set-secrets=GOOGLE_GENAI_API_KEY=GOOGLE_GENAI_API_KEY:latest,FIREBASE_SERVICE_ACCOUNT_KEY=FIREBASE_SERVICE_ACCOUNT_KEY:latest,YOUTUBE_API_KEY=YOUTUBE_API_KEY:latest,SAHAYAKAI_REQUEST_SIGNING_KEY=SAHAYAKAI_REQUEST_SIGNING_KEY:latest
```

The first deploy bootstrapped from the prod image. The original v1 trigger (`sahayakai-preview-deploy`, branch pattern `^develop$`, build config `cloudbuild-preview.yaml`) is superseded by the `main`-triggered `cloudbuild-uat.yaml` trigger:

```bash
# v1 (historical):
gcloud beta builds triggers create github \
  --name=sahayakai-preview-deploy \
  --project=sahayakai-b4248 \
  --repo-name=sahayakai --repo-owner=sargupta \
  --branch-pattern='^develop$' \
  --build-config=sahayakai-main/cloudbuild-preview.yaml \
  --description='Auto-deploy develop tip to sahayakai-preview Cloud Run'

# v2: same shape, --branch-pattern='^main$' and
# --build-config=sahayakai-main/cloudbuild-uat.yaml
```
