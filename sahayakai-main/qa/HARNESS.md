# QA Test-User Provisioning Harness

Firebase password sign-in is disabled on `sahayakai-b4248`. This harness mints fully-onboarded test users via the Admin SDK + Identity Toolkit REST so the browser-E2E lanes (A7, C5–C8, C13, C14–C17, E5–E8) can run live.

## Prereqs

- `FIREBASE_SERVICE_ACCOUNT_KEY` set in `.env.local` (already present) **or** `secrets/firebase-admin.json` on disk.
- `node` 20+. Playwright browser: `npx playwright install chromium`.

## 1. Provision a user

```bash
node scripts/qa/provision-test-user.mjs \
  --plan=premium --role=teacher \
  --state=Karnataka --district=Bengaluru \
  --subjects=math,science --gradeLevels=6,7,8
```

Flags (all optional): `--uid` `--email` `--plan free|basic|premium|pro|gold` `--role teacher|principal|vice_principal|admin` `--state` `--district` `--subjects=a,b` `--gradeLevels=6,7` `--schoolName` `--displayName` `--language` `--board`.

Auto-generates `qa-{timestamp}-{rand}@sahayakai.test` when no email/uid given.

Stdout: `{uid, email, customToken, idToken, refreshToken, expiresIn}`.

Verify the idToken hits the API:

```bash
curl -s -H "Authorization: Bearer $ID_TOKEN" https://sahayakai-preview-zwydpvyuca-as.a.run.app/api/health
```

## 2. Provision + Playwright storage state

```bash
node scripts/qa/playwright-storage-state.mjs \
  --plan=premium --role=teacher \
  --baseUrl=https://sahayakai-preview-zwydpvyuca-as.a.run.app
```

Writes `qa/fixtures/storage-state-<uid>.json`. Synthesizes the `firebase:authUser:<apiKey>:[DEFAULT]` localStorage entry the Firebase Web SDK rehydrates on init.

## 3. Run Playwright tests

```bash
QA_STORAGE_STATE=qa/fixtures/storage-state-<uid>.json npm run qa:e2e
# or against a different host:
QA_BASE_URL=https://... QA_STORAGE_STATE=... npm run qa:e2e
```

## 4. Cleanup

```bash
node scripts/qa/cleanup-test-users.mjs            # delete all qa-*@sahayakai.test
node scripts/qa/cleanup-test-users.mjs --dryRun   # preview only
```

Idempotent. Drops both Auth users and `users/{uid}` Firestore docs.

## Files

- `scripts/qa/provision-test-user.mjs` — Admin SDK provisioner + idToken minter
- `scripts/qa/cleanup-test-users.mjs` — bulk teardown
- `scripts/qa/playwright-storage-state.mjs` — wraps #1 + writes storageState.json
- `scripts/qa/lib/admin.mjs` — shared Firebase Admin bootstrap
- `qa/playwright.config.ts` — Playwright config (chromium, baseURL, storageState)
- `qa/tests/harness.smoke.spec.ts` — auth-state smoke test
