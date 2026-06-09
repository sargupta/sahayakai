
# SahayakAI — Deployment

## Deploy Target

Google Cloud Run, region `asia-south1` (Mumbai).
Service name: `sahayakai-hotfix-resilience`

## Deploy Trigger

Push to `main` branch → automatic Cloud Run deployment (CI/CD configured in GCP).

No manual deploy command needed.

---

## Build Process

```bash
npm run build    # produces .next/standalone
```

Next.js `output: 'standalone'` generates a self-contained Node.js server in `.next/standalone/`. This is wrapped in a Docker image for Cloud Run.

---

## Required Secrets / Env at Runtime

Set these in Cloud Run environment variables or Secret Manager:

```
GOOGLE_GENAI_API_KEY
FIREBASE_SERVICE_ACCOUNT_KEY   (JSON string of service account, or use Secret Manager)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
```

`NEXT_PUBLIC_*` vars must be available at **build time** (baked into client bundle). All others are runtime-only.

---

## Git Branching Rules

- `main` is production — every push deploys
- Bug fixes: branch `fix/<name>` from main, merge back with `--no-ff`
- New features: branch `feature/<name>` from main, merge back with `--no-ff`
- **Never commit directly to main**
- **Never force-push to main**

```bash
# Standard workflow
git checkout -b fix/my-bug
# ... make changes ...
git checkout main
git merge fix/my-bug --no-ff
git push origin main          # triggers deployment
```

---

## Firebase Project Setup Checklist

1. Create Firebase project
2. Enable Firestore (Native mode)
3. Enable Firebase Auth → Google Sign-In provider
4. Enable Firebase Storage
5. Create service account → download JSON key
6. Deploy `firestore.rules` and `storage.rules`
7. Create required Firestore composite indexes (see CONFIG.md)

---

## Cloud Run Recommended Settings

- Memory: 512MB–1GB (AI inference is memory-intensive)
- CPU: 1 vCPU minimum
- Min instances: 1 (avoid cold starts for teachers)
- Concurrency: 80 (default)
- Timeout: 300s (long AI generation requests)

---

## Local Development

```bash
npm install
cp .env.example .env.local    # fill in all required vars
npm run dev
```

Dev bypass: middleware accepts `'dev-token'` as Bearer token, maps to `'dev-user-123'`.
PWA is disabled in development.
