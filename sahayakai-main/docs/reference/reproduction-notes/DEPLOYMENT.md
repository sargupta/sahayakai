# SahayakAI - Deployment

**Verified:** 2026-06-10

## Deploy Target

Google Cloud Run, region **`asia-southeast1`**, project `sahayakai-b4248` (project number `640589855975`).
Service: `sahayakai-hotfix-resilience`. Preview service: `sahayakai-preview`.

Image: `asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/sahayakai-hotfix-resilience:{$SHORT_SHA,latest}`.

---

## Deploy Trigger + Routing

A Cloud Build GitHub trigger (`sahayakai-main-deploy`) builds on `git push origin main` (build context `dir: sahayakai-main`, `cloudbuild.yaml`).

**Crucial: new revisions deploy with `--no-traffic`.** The revision is built and warm but does NOT auto-route. An operator flips traffic explicitly:

```bash
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region asia-southeast1 --project sahayakai-b4248 --to-latest
```

Why: two parallel pushes race on traffic routing; `--no-traffic` lets both produce ready revisions without one silently clobbering the other.

---

## CRITICAL: Use safe-deploy, never raw `gcloud run deploy`

Always deploy via `bash scripts/safe-deploy.sh` from `sahayakai-main/`. It guards against parallel-deploy races:

1. Aborts if any Cloud Build job is in flight (`gcloud builds list --ongoing`).
2. Aborts if the most recent revision is younger than `MIN_REVISION_AGE_SECONDS` (default 90s) - another session likely just deployed.
3. Aborts on a dirty git tree.
4. Defaults to `--no-traffic`; branch-aware (main → prod service, develop → preview).

Pass `--route-immediately` to opt back into the racy direct-route behavior (avoid unless certain no one else is deploying). Run `bash scripts/audit-deployments.sh` before and after every deploy.

Raw `gcloud run deploy` is forbidden - it races with parallel sessions and silently clobbers earlier deploys.

---

## Build Process

```bash
npm run build    # produces .next/standalone (output: 'standalone')
```

Wrapped in the Dockerfile image. `NEXT_PUBLIC_*` Firebase config + `SENTRY_AUTH_TOKEN` + `GIT_SHA`/`GIT_SHA_FULL`/`BUILD_ID` are baked at build time via Dockerfile `ARG`→`ENV` (VAPID key has a hardcoded default). Model IDs are NOT baked - `GENKIT_DEFAULT_MODEL` defaults in code to `googleai/gemini-2.5-flash`. AI API keys come from Secret Manager at runtime.

---

## Runtime Env

See CONFIG.md. Runtime-only (not in repo, not confirmable from code): `VOICE_PROVIDER`, `APP_CHECK_REQUIRED`, `ONBOARDING_GATE_ENABLED`, `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`, the Twilio/Razorpay/Sarvam secrets, and `GOOGLE_GENAI_API_KEY` (pool). Code defaults: `VOICE_PROVIDER=twilio`, onboarding gate OFF.

---

## Git Branching Rules

- Never commit directly to `main`; never force-push to `main`.
- `develop` is the integration branch; branch `fix/<name>` or `feature/<name>` FROM `develop`, merge back with `--no-ff`.
- `main` receives merges from `develop` only on a user-initiated release.
- Stage specific files; never `git add -A`.

---

## Firebase Project Setup Checklist

1. Create project `sahayakai-b4248`; enable Firestore (Native), Auth (Google Sign-In), Storage.
2. Create service account; store key in Secret Manager (or env).
3. Deploy `firestore.rules` and `storage.rules`.
4. Create the composite indexes in `firestore.indexes.json` (see CONFIG.md).

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill required vars
npm run dev
```

Dev bypass: in development, middleware accepts `'dev-token'` as the Bearer token, mapping to `dev-user-123`/`pro`. PWA disabled in dev.
