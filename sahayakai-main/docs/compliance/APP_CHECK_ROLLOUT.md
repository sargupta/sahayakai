# Firebase App Check — Safe Enforcement Rollout

**Status:** PLAN — every step marked **FOUNDER-EXECUTE**. Nothing in this document has been flipped; enforcement blind-flips have locked users out before (see the ONBOARDING_GATE incident, PR #68). Do not skip the monitoring windows.

## Current state (verified 2026-07-03)

Two independent enforcement points exist, controlled by two different env vars:

| Layer | Env var | Where consumed | Current behaviour |
|---|---|---|---|
| Next.js middleware | `APP_CHECK_REQUIRED` | `src/middleware.ts` (~line 223) | **Unset (permissive).** When `'true'`: any present `X-Firebase-AppCheck` header is verified (invalid → 401), and `/api/ai/*` requests **without** the header are rejected 401. Verified app id is forwarded as `x-app-check-app`. |
| Voice/AI sidecars (separate Cloud Run services) | `SAHAYAKAI_REQUIRE_APP_CHECK` | Sidecar services (referenced from `src/lib/sidecar/*-client.ts`, `src/lib/sidecar/app-check-mint.ts`) | **`false` (permissive)** during rollout. When `true`: sidecar rejects requests missing/failing the App Check token — its third auth layer alongside Cloud Run OIDC + HMAC. |

Token supply chain (already shipped — this is why enforcement is now *possible*):

- **Browser:** `src/lib/firebase-app-check.ts` — reCAPTCHA v3 provider, auto-refresh, idempotent init. Returns `null` (never throws) when `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` is unset, so a missing key degrades to "no token", not a crash.
- **Server→sidecar:** `src/lib/sidecar/app-check-mint.ts` — mints tokens via firebase-admin `appCheck().createToken(appId)` (1h TTL, in-process cache, 10-min refresh buffer). Requires the service account to hold `firebaseappcheck.tokens.create` (`roles/firebase.sdkAdminServiceAgent`). On mint failure callers send no header and the sidecar rejects — fail-safe, not fail-open.

## Preconditions (verify before anything else)

1. Firebase console → App Check: web app `1:640589855975:web:624436f873a78069aa3642` registered with the **reCAPTCHA v3** provider; the site key matches `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` on the prod Cloud Run service.
2. Service-account IAM: `gcloud projects get-iam-policy sahayakai-b4248 --flatten="bindings[].members" --filter="bindings.role:roles/firebase.sdkAdminServiceAgent"` — the Cloud Run runtime SA must appear (or hold an equivalent role), else server-side minting fails and every sidecar call dies at step 4.
3. **Debug tokens for dev/CI:** in Firebase console → App Check → Apps → ⋮ → *Manage debug tokens*, create one token per developer machine + one for CI. Locally set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = '<token>'` before Firebase init (or use the `FIREBASE_APPCHECK_DEBUG_TOKEN` env in Playwright). Without this, local dev against enforced backends breaks silently.
4. Confirm rollout of the client code: `initFirebaseAppCheck()` must be reached on every page that calls `/api/ai/*` (it is called from client components on mount; spot-check with devtools → network → request headers contain `X-Firebase-AppCheck`).

## Rollout steps (in order, with soak time between)

### Step 1 — Measure, don't block (1 week soak)
Firebase console → App Check → **Metrics** shows verified vs unverified request ratios per product (Firestore, Storage, custom). Target: >99% verified traffic from real clients before any flip. If the ratio is low, old cached clients or blocked reCAPTCHA are in play — flipping now locks those teachers out.

### Step 2 — Sidecar enforcement first (smaller blast radius)
The sidecars already receive server-minted tokens (not browser-dependent), so this flip does not depend on teacher devices:

```bash
# FOUNDER-EXECUTE — per sidecar service, via the safe-deploy process
# (memory rule: never raw `gcloud run deploy`; env-only update is acceptable
#  via `gcloud run services update`, then audit):
gcloud run services update <sidecar-service> \
  --region=asia-southeast1 \
  --update-env-vars=SAHAYAKAI_REQUIRE_APP_CHECK=true
bash scripts/audit-deployments.sh
```

Monitor for 48h: sidecar 401/403 rates, `[app-check-mint] server mint failed` warnings in Cloud Logging, Genkit-fallback rates (a spike means sidecar rejections are being masked by fallback).

**Rollback:** same command with `SAHAYAKAI_REQUIRE_APP_CHECK=false`. Config-only, no redeploy.

### Step 3 — Middleware enforcement (browser-dependent — highest risk)

```bash
# FOUNDER-EXECUTE — main app service:
gcloud run services update sahayakai-hotfix-resilience \
  --region=asia-southeast1 \
  --update-env-vars=APP_CHECK_REQUIRED=true
bash scripts/audit-deployments.sh
```

This 401s every `/api/ai/*` call that lacks a token — i.e. every teacher on a stale tab, a blocked-reCAPTCHA network, or an extension-heavy browser. Monitor for 72h:
- Cloud Run 401 rate on `/api/ai/*` (Cloud Logging: `httpRequest.status=401 AND resource.labels.service_name="sahayakai-hotfix-resilience"`)
- Sentry: spike in client-side "Missing App Check token" API errors
- Support channel: teachers reporting "generation stopped working"

**Rollback:** `--update-env-vars=APP_CHECK_REQUIRED=false` (or remove the var). Config-only.

### Step 4 — Firebase-product enforcement (optional, later)
Console-side enforcement for Firestore/Storage/RTDB (App Check → APIs → Enforce) blocks unverified direct SDK access. Do this only after Steps 1–3 have soaked clean for 2+ weeks; it has no env-var rollback — un-enforcing is also a console click, but propagation is slower.

## Explicit non-goals of this doc
- No code changes are required for the flip — both gates are pure env toggles already wired.
- `src/lib/firebase-app-check.ts` needs no modification; its `null`-degrading behaviour is exactly what the rollout window requires (do NOT make it throw).
