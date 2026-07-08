# Lib: Auth Middleware

**File:** `src/middleware.ts`
**Verified:** 2026-06-10

---

## What It Does

1. Canonical-host redirect (bare apex to `www`).
2. Strips client-supplied identity headers (P0 security).
3. Verifies Firebase ID token, injects identity headers for server actions / API routes.
4. Optional Firebase App Check enforcement on `/api/ai/*`.
5. Optional onboarding gate (currently default-off).
6. Applies security headers + per-request CSP nonce.

There is NO IP rate limiting in middleware (rate limiting lives in `src/lib/server-safety.ts`, called from actions/routes).

---

## Canonical Host Redirect

Bare `sahayakai.com` redirects to `https://www.sahayakai.com` (the Firebase `authDomain`). Skips `/api/*` and `/__/*`. Strips the Cloud Run internal `:8080` port from the redirect target so it never leaks into the `Location` header.

---

## Identity Header Stripping (P0)

Before any branch, middleware deletes any client-supplied `x-user-id`, `x-user-plan`, `x-user-email`, `x-user-name`. Only post-verification code is allowed to set them. This blocks header-spoofing of identity.

---

## Token Resolution Priority

```
1. Authorization: Bearer {token}   (API calls from client code)
2. auth-token cookie               (page navigations, server actions)
3. Neither → identity headers not set (unauthenticated request)
```

---

## Token Verification

- Verified with the `jose` library against Google's cached x509 certs.
- Cert cache TTL ~5h (`_certsCache`), avoiding a live Google fetch per request.
- Checks `issuer = https://securetoken.google.com/sahayakai-b4248` and `audience = sahayakai-b4248`.
- On success injects: `x-user-id` (token `sub`), `x-user-email`, `x-user-name`, and `x-user-plan` (normalized: legacy `institution` → `premium`; otherwise a valid `free`/`pro`/`gold`/`premium`, else `free`). Sets `x-onboarding-completed=1` if the `onboardingCompleted` custom claim is `true`.

Project ID `sahayakai-b4248`, project number `640589855975`.

---

## App Check (Phase R.2)

When `process.env.APP_CHECK_REQUIRED === 'true'`:
- Verifies the `X-Firebase-AppCheck` JWT against `https://firebaseappcheck.googleapis.com/v1/jwks` (JWKS resolver cached across requests).
- Checks issuer `firebaseappcheck.googleapis.com/sahayakai-b4248` and an `aud` containing `projects/sahayakai-b4248` or `projects/640589855975`.
- Strict mode: a missing token on `/api/ai/*` is rejected.
- On success sets `x-app-check-app`. When the env is unset, App Check is tolerant (no enforcement).
- `verifyAppCheckToken` never throws - a transient JWKS failure must not lock out every caller.

---

## Dev Bypass

```ts
if (process.env.NODE_ENV === 'development' && rawToken === 'dev-token') {
  // injects x-user-id=dev-user-123, x-user-plan=pro, dev email/name
}
```

Verification failure in dev also falls back to the `dev-user-123` identity.

---

## Public Routes (skip auth)

These prefixes/paths bypass token verification:
- `/api/health`
- `/api/ai/quiz/health`
- `/api/metrics` (anon web-vitals; logs only a client-supplied id label)
- `/api/auth/*` (e.g. `profile-check` runs pre-login)
- `/api/attendance/twiml*` (Twilio callbacks - no auth header)
- `/api/jobs/*` (Cloud Scheduler cron - OIDC validated by Cloud Run)
- `/api/webhooks/*` (payment webhooks - HMAC verified)
- `/api/billing/callback` (Razorpay redirect - signature verified)
- `/api/billing/create-public-subscription` (exact path, anon checkout)
- `/api/seo/*` (llms.txt, google-verify)

NOTE (P0 fix, 2026-06-05): `/api/analytics/*` and `/api/teacher-activity` were REMOVED from the public list - their handlers trust `x-user-id`, so they must be authenticated.

---

## 401 vs Pass-Through

- Invalid/missing token on an API or `/admin/*` route, OR on a non-API page POST (server action), returns 401.
- Page GETs without a token pass through (identity headers simply not set).

---

## Onboarding Gate (DEFAULT-OFF)

Gated behind `process.env.ONBOARDING_GATE_ENABLED === 'true'`. **Currently default-off** - an incident on 2026-06-08 locked out the entire user base. Do NOT re-enable until the `scripts/backfill-onboarding-claim.ts` backfill stamps the `onboardingCompleted` claim on all pre-existing complete users.

When enabled: an authenticated page GET whose request has neither a valid `PROFILE_COMPLETE_COOKIE` (verified via `verifyProfileCompleteCookie` from `src/lib/profile-complete-cookie.ts`) nor `x-onboarding-completed=1` is redirected to `/onboarding`, subject to an allowlist (`/onboarding`, etc.). The completion cookie is issued by `POST /api/profile/mark-complete` once the server confirms the profile is sufficiently complete.

---

## Security Headers

Every response gets:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: (set)
Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload  (prod only)
```
Plus a per-request CSP nonce exposed via the `x-nonce` request header.

---

## Reading Identity in Server Actions

```ts
const { headers } = await import('next/headers');
const h = await headers();
const userId = h.get('x-user-id');
if (!userId) throw new Error('Unauthorized');
```

**Never** trust a client-supplied userId. Always read the middleware-injected header. (Most actions wrap this in a `getAuthUserId()` helper.)
