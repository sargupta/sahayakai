# Preview Environment

Cloud Run service `sahayakai-preview` is the UAT tier for SahayakAI. Every push to `main` auto-builds, deploys with `--no-traffic`, smoke-tests, and flips here (cloudbuild-uat.yaml). Real teachers do NOT see this — it's for Abhishek, QA, and demos.

## URL

Cloud Run-assigned URL (find with `gcloud run services describe sahayakai-preview --region=asia-southeast1 --format='value(status.url)'`). Looks like `https://sahayakai-preview-<hash>-as.a.run.app`.

A custom domain (`preview.sahayakai.com`) is not yet wired — Phase F task if QA usage grows.

## What's on preview right now

The latest smoke-passed commit on `main`. Look at the tagged-revision URL for a specific main SHA:

```
https://sha-<short-sha>---sahayakai-preview-<hash>-as.a.run.app
```

(Pre-2026-08 revisions were tagged `dev-<short-sha>`; those tags remain on old revisions.)

## How deploys work

1. **Push to `main`** (any merge to main — develop is retired 2026-08, see docs/BRANCHING.md)
2. Cloud Build trigger `sahayakai-uat-deploy` fires, runs `cloudbuild-uat.yaml`
3. Build takes 5–8 min: Docker build → push to Artifact Registry → `gcloud run deploy sahayakai-preview` with `--no-traffic --tag=sha-<sha>`
4. The pipeline smoke-tests the tagged zero-traffic URL, then flips traffic with `update-traffic --to-latest` — a failed smoke leaves the previous good revision serving
5. Existing revisions stay around tagged for direct access

This is **different from prod**, which deploys from `release/*` branches via `cloudbuild-release.yaml` (both regions, `--no-traffic`) and flips traffic only through `scripts/release/promote-release.sh`.

## Env vars

Preview deploys with these env vars baked at deploy time:

- `DEMO_MODE=true` — gates demo-only features (Community Personas seeding, etc.) ON in preview, OFF in prod
- `NODE_ENV=production` — same as prod so app behaves like prod

Plus all `--set-secrets` pulls that prod has (shared Secret Manager secrets — Firebase service account, Genkit API key, etc.). If/when we want preview to use isolated secrets, switch to `*_PREVIEW` aliases — see "Firebase project isolation" below.

## Firebase project isolation

Preview currently writes to the **same** Firebase project as prod (`sahayakai-b4248`). This means preview writes to community chat, notifications, etc. will appear in prod data.

Mitigation: features that write to Firestore in a way that pollutes prod should be wrapped with `DEMO_MODE` check + route to `*_preview` collection prefixes. This is a Phase C task once feature flags are in place.

If pollution becomes a real problem, switch preview to a separate Firebase project (`sahayakai-preview` or `sahayakai-b4248-preview`). Costs ~$0–25/mo extra for Firebase services but provides clean isolation.

## Costs

- Min instances: 0 (cold start ~3–5s on first request after idle)
- Max instances: 20
- Memory: 2Gi, CPU: 2

Estimated $5–10/mo at current usage. Bump min-instances to 1 (~$30–50/mo) if cold-start is annoying.

## Logs

```bash
# Tail recent preview logs
gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="sahayakai-preview"' \
  --limit=50 --format=json --project=sahayakai-b4248

# Specific revision
gcloud logging read 'resource.type="cloud_run_revision" resource.labels.revision_name="sahayakai-preview-<rev>"' \
  --limit=50 --format=json --project=sahayakai-b4248
```

## Smoke test against preview

```bash
URL=$(gcloud run services describe sahayakai-preview --region=asia-southeast1 \
  --project=sahayakai-b4248 --format='value(status.url)')
BASE="$URL" bash scripts/smoke-test.sh
```

## Audit preview

```bash
SERVICE=sahayakai-preview bash scripts/audit-deployments.sh
```

## Rollback

UAT rollback is essentially "point traffic at a different main SHA's revision." Two ways:

**A. Pin to a previous tagged revision:**

```bash
gcloud run services update-traffic sahayakai-preview \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --to-revisions sahayakai-preview-<rev>=100
```

**B. Revert a commit on main (via PR — main is protected):**

```bash
git checkout main
git pull --ff-only origin main
git revert <bad-commit-sha>
gh pr create --base main ...   # merge → auto-deploys to UAT
```

(safe-deploy.sh from a `main` checkout is the manual fallback; `develop`
checkouts hard-abort — the branch is retired.)

## What to test in preview before promoting to prod

For every SHA you intend to mark `uat/verified` (the release gate), run through UAT:

- [ ] `/api/health` returns 200 with all env vars present
- [ ] Home page loads
- [ ] Auth flow (login + redirect)
- [ ] One AI flow end-to-end (e.g., lesson plan generation)
- [ ] One voice-to-action flow (VIDYA)
- [ ] Smoke test `bash scripts/smoke-test.sh` against preview URL
- [ ] Any new feature in the PR — manually click through

If feature flags are wrapping a specific risky surface (post-Phase C), toggle the flag in Firebase Remote Config (preview project / template) to verify both ON and OFF behaviors.

## Provisioning (one-time)

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

The first deploy uses the prod image to bootstrap the service. Subsequent deploys come via `cloudbuild-uat.yaml` on push to main.

## Cloud Build trigger setup (one-time)

```bash
bash scripts/setup-build-trigger-uat.sh
```

After setup, every push to `main` fires the `sahayakai-uat-deploy` trigger automatically.
