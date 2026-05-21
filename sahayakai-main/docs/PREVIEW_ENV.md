# Preview Environment

Cloud Run service `sahayakai-preview` is the staging tier for SahayakAI. Every push to `develop` auto-builds and auto-deploys here. Real teachers do NOT see this — it's for Abhishek, QA, and demos.

## URL

Cloud Run-assigned URL (find with `gcloud run services describe sahayakai-preview --region=asia-southeast1 --format='value(status.url)'`). Looks like `https://sahayakai-preview-<hash>-as.a.run.app`.

A custom domain (`preview.sahayakai.com`) is not yet wired — Phase F task if QA usage grows.

## What's on preview right now

The latest commit on `develop`. Look at the tagged-revision URL for a specific develop SHA:

```
https://dev-<short-sha>---sahayakai-preview-<hash>-as.a.run.app
```

## How deploys work

1. **Push to `develop`** (any merge to develop, or a direct push)
2. Cloud Build trigger `sahayakai-preview-deploy` fires, runs `cloudbuild-preview.yaml`
3. Build takes 5–8 min: Docker build → push to Artifact Registry → `gcloud run deploy sahayakai-preview` with `--tag=dev-<sha>`
4. The new revision serves 100% traffic immediately (preview is low-stakes; no `--no-traffic` ceremony)
5. Existing revisions stay around tagged for direct access

This is **different from prod**, which is manual via `scripts/safe-deploy.sh` with `--no-traffic` and a manual traffic flip.

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

Preview rollback is essentially "redeploy from a different develop SHA." Three ways:

**A. Pin to a previous tagged revision:**

```bash
gcloud run services update-traffic sahayakai-preview \
  --region=asia-southeast1 --project=sahayakai-b4248 \
  --to-revisions sahayakai-preview-<rev>=100
```

**B. Revert a commit on develop:**

```bash
git checkout develop
git revert <bad-commit-sha>
git push origin develop   # auto-deploys to preview
```

**C. Manual deploy from a known-good local commit:**

```bash
git checkout develop
git reset --hard <good-sha>   # CAREFUL — destructive if not coordinated
bash scripts/safe-deploy.sh   # safe-deploy detects develop → deploys to preview
```

## What to test in preview before promoting to prod

For every develop → main PR, run through preview:

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

The first deploy uses the prod image to bootstrap the service. Subsequent deploys come via `cloudbuild-preview.yaml` on push to develop.

## Cloud Build trigger setup (one-time)

```bash
gcloud beta builds triggers create github \
  --name=sahayakai-preview-deploy \
  --project=sahayakai-b4248 \
  --repo-name=sahayakai --repo-owner=sargupta \
  --branch-pattern='^develop$' \
  --build-config=sahayakai-main/cloudbuild-preview.yaml \
  --description='Auto-deploy develop tip to sahayakai-preview Cloud Run'
```

After setup, every push to `develop` fires this trigger automatically.
