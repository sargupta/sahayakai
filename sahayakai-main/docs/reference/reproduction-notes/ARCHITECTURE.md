# SahayakAI - Global Architecture

> Refreshed 2026-06-10 against current source (`src/`, `cloudbuild.yaml`,
> `Dockerfile`, `package.json`, `scripts/safe-deploy.sh`).

## Overview

SahayakAI is a Next.js 15 (App Router) application for teachers across India. It is a voice-first, multilingual (11 Indic languages) AI toolkit deployed on Google Cloud Run.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js `^15.5.11` (App Router) |
| UI runtime | React `^18.3.1` / react-dom `^18.3.1` |
| Language | TypeScript |
| Styling | Tailwind CSS, Shadcn/ui (Radix primitives) |
| Auth | Firebase Authentication (token verified in middleware via `jose`) |
| Database | Firestore (client SDK + Admin SDK server-side) |
| File Storage | Firebase Storage (client) + Google Cloud Storage (server) |
| AI | Google Gemini via Genkit `^1.28.0` (`@genkit-ai/googleai`, `@genkit-ai/firebase`, `@genkit-ai/next`) |
| TTS / STT | Google Cloud TTS + Sarvam AI |
| Payments | Razorpay `^2.9.6` (HMAC-verified webhooks). No Stripe. |
| Telephony | Twilio (REST, default) + Exotel (opt-in, external service) |
| PWA | `next-pwa ^5.6.0` |
| Deployment | Cloud Run (standalone output), region `asia-southeast1` |
| Monitoring | Sentry + Google Cloud Logging / Trace |

---

## Request Lifecycle

```
Browser
  -> Firebase getIdToken() (refresh cadence ~55 min)
  -> token in `auth-token` cookie (pages) or Authorization: Bearer (API)
  -> HTTP request

src/middleware.ts (every route)
  -> strips client-supplied x-user-id / x-user-plan / x-user-email / x-user-name (P0)
  -> resolves token from Bearer header (API) or auth-token cookie (pages)
  -> verifies with jose against Google x509 certs (5h cache),
     issuer securetoken.google.com/sahayakai-b4248, audience sahayakai-b4248
  -> injects x-user-id (sub), x-user-email, x-user-name, x-user-plan (normalized)
  -> optional App Check verification when APP_CHECK_REQUIRED==='true'
  -> applies security headers + per-request CSP nonce (x-nonce)

API Route / Server Action
  -> reads x-user-id from headers() (NEVER trusts client identity)
  -> checkServerRateLimit(userId) -> Firestore rate_limits
  -> Admin SDK data access (bypasses Firestore rules)
  -> returns response

Client
  -> renders; realtime via Firestore onSnapshot (client SDK)
```

Plan normalization in middleware: legacy `institution` -> `premium`; valid `free|pro|gold|premium`, else `free`.

---

## Authentication Flow

1. User signs in with Google (Firebase).
2. `onIdTokenChanged` syncs the token to the `auth-token` cookie.
3. `onAuthStateChanged` upserts `users/{uid}`.
4. Middleware reads cookie (page navigations) OR Bearer header (API calls).
5. Dev bypass: `rawToken === 'dev-token'` (or no token in dev) injects `dev-user-123` / `pro`.

**Onboarding gate:** gated behind `ONBOARDING_GATE_ENABLED === 'true'` and is currently DEFAULT-OFF (the 2026-06-08 incident locked out the whole user base; the gate must stay off until the grandfather rule is softened and a backfill is applied).

---

## AI Architecture

### Rule: Pages NEVER call AI flows directly

```
Page (client) -> API Route (/api/ai/[feature]) -> AI Flow (server module) -> Gemini
```

AI flows are plain server TypeScript modules (NO `'use server'`). They are imported only by API routes, keeping AI logic server-only.

### Default model

`googleai/gemini-2.5-flash` (`src/ai/genkit.ts`), overridable via `GENKIT_DEFAULT_MODEL`. `gemini-2.0-flash` was removed (free-tier per-minute quota saturation). Non-default models: `gemini-2.5-pro` (assignment grading), `gemini-3-pro-image-preview` (visual-aid image), `gemini-2.5-flash-image` (avatar).

### AI resilience

`runResiliently()` in `genkit.ts` rotates a comma-separated API-key pool loaded from Secret Manager (`GOOGLE_GENAI_API_KEY`), failing over on 429/401/403 with jittered backoff. Single-key pools use longer 20s/40s backoff for per-minute quota windows; a 50s total-budget guard ensures a typed `AIQuotaExhaustedError` (HTTP 503 + Retry-After) surfaces before the dispatcher's 60s `withTimeout` fires an unclassified error.

### VIDYA Assistant (OmniOrb)

```
OmniOrb -> /api/assistant (orchestrator) -> agent-router intent classify (/api/ai/intent)
        -> NAVIGATE to a tool page  OR  vidya-assistant reply  OR  instantAnswer ANSWER
```

TODO(verify: assistant session caching internals and `/api/vidya/profile` + `/api/vidya/session` state - not re-read here).

---

## AI Sidecar (ADK-Python)

An external ADK-Python sidecar lives in a SEPARATE repo (`sahayakai-agents/`), not in this tree. Wiring is in `src/lib/sidecar/`:

- Base URL env: `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` (throws `SidecarConfigError` if unset).
- 17 `*-dispatch.ts` dispatchers (assessment-scanner, assignment-assessor, avatar-generator, community-persona-message, exam-paper, instant-answer, lesson-plan, parent-message, quiz, rubric, teacher-training, video-storyteller, vidya, virtual-field-trip, visual-aid, voice-to-text, worksheet) plus parent-call in `dispatch.ts`.
- Dispatch modes per agent (`<agent>SidecarMode` / `<agent>SidecarPercent` in Firestore `system_config/feature_flags`): `off` (Genkit only - default for all), `shadow` (Genkit serves; sidecar called fire-and-forget for parity), `canary` (sidecar serves; Genkit fallback on error/timeout), `full` (sidecar serves, percent=100).
- Auth to sidecar: App Check token minting (`app-check-mint.ts`) + HMAC signing (`signing.ts`); sidecar enforces via its own `SAHAYAKAI_REQUIRE_APP_CHECK` env.
- Timeout: `with-timeout.ts` `FALLBACK_TIMEOUT_MS = 60_000`.
- By default all agents are `off`, so production is pure Genkit and the sidecar is untouched.

---

## Telephony (Attendance Parent Calls)

Provider selected at runtime by `VOICE_PROVIDER`, defaulting to `twilio` (`src/app/api/attendance/call/route.ts`).

- **Twilio (default):** calls the Twilio REST API directly via fetch (no `twilio` npm SDK) using `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`; returns 503 if unset. Conversational call driven by TwiML webhooks `/api/attendance/twiml` + `/twiml-status` (public, no auth header). `parent-call-agent.ts` generates live replies/summary within Twilio's ~15s webhook budget. `voicePipelineMode: 'batch'`.
- **Exotel (opt-in):** `VOICE_PROVIDER=exotel` makes the route `forwardToExotel()` -> POST to `VOICE_EXOTEL_CALL_URL` (the separate `sahayakai-voice-call` Cloud Run repo running a WebSocket streaming voicebot: Sarvam STT/TTS + Gemini, 11 langs). `voicePipelineMode: 'streaming'`.

---

## Provider Stack (layout.tsx)

```tsx
<LanguageProvider>          // 11 Indic languages
  <AuthProvider>            // Firebase auth, cookie sync
    <SidebarProvider>
      <Header />
      <AppSidebar />        // live unread badge
      <main>{children}</main>
      <OmniOrb />           // floating VIDYA mic orb
      <Toaster />
    </SidebarProvider>
  </AuthProvider>
</LanguageProvider>
```

TODO(verify: exact provider nesting and font choices against current `layout.tsx`).

---

## Security Headers (middleware.ts)

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` - microphone restricted to `self` (voice-first app needs the mic)
- `Strict-Transport-Security` (HSTS) in production
- Content-Security-Policy with a per-request nonce (`x-nonce`)

Canonical host: bare `sahayakai.com` -> `https://www.sahayakai.com` (308), skipping `/api/*` and `/__/*`, stripping the `:8080` Cloud Run internal port from the redirect target.

---

## Feature Flags

Primarily Firestore `system_config/feature_flags` (`src/lib/feature-flags.ts`), read server-side with a 5-min cache, deduped in-flight fetch, and a `FALLBACK_CONFIG` safety net. Billing flags + all 17 agent sidecar modes live here. Infra gates are env vars: `ONBOARDING_GATE_ENABLED`, `APP_CHECK_REQUIRED`, `VOICE_PROVIDER`, `SAHAYAKAI_REQUIRE_APP_CHECK`. Notable fallback defaults: `billingKillSwitch: true` (all plan checks return "free"), `subscriptionEnabled: false`.

---

## Rate Limiting

`checkServerRateLimit(userId)` writes/reads Firestore `rate_limits/{userId}`, called inside sensitive flows (AI generation, content, chat). Fails open on non-limit errors.

---

## Deployment

- **Cloud Run service:** `sahayakai-hotfix-resilience`, region `asia-southeast1`, project `sahayakai-b4248` (project number `640589855975`).
- **Image:** `asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/sahayakai-hotfix-resilience:{$SHORT_SHA,latest}`.
- **Trigger:** Cloud Build GitHub trigger `sahayakai-main-deploy` on push to `main` (build context `sahayakai-main`). NOT auto-routed.
- **`--no-traffic` by default:** new revisions are built + warm but not auto-routed; an operator flips traffic via `gcloud run services update-traffic ... --to-latest`. `scripts/safe-deploy.sh` adds guards (aborts on in-flight build, on a revision <90s old, on a dirty tree).
- **Baked at build (Dockerfile ARG->ENV):** `NEXT_PUBLIC_FIREBASE_*` (incl. default VAPID key), `SENTRY_AUTH_TOKEN`, `GIT_SHA`/`BUILD_ID`. Runtime: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_OPTIONS=--max-old-space-size=4096`. Model IDs are NOT baked; API keys come from Secret Manager at runtime.

---

## Key Architectural Decisions

1. **Admin SDK writes, client deletes** - e.g. connections are created server-side (bypassing rules), deleted client-side.
2. **Denormalization everywhere** - participant names/photos, sender info, last-message previews duplicated to avoid joins.
3. **Optimistic UI** for community chat, likes, follows.
4. **Fail-open on non-critical errors** - rate limits, analytics, persistence, TTS fail silently rather than blocking the user.
5. **Server/client AI boundary** - AI flows are pure server modules; only API routes import them.
6. **Genkit-default, sidecar-optional** - every agent defaults to pure Genkit; the ADK-Python sidecar is gated off until per-agent Firestore flags promote it.
