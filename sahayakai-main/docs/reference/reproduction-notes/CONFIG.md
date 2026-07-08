# SahayakAI - Configuration

**Verified:** 2026-06-10

## Environment Variables

### Required

| Variable | Purpose | Source |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | Gemini API - comma-separated key POOL with failover/backoff (`src/ai/genkit.ts`) | Secret Manager |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK | env or Secret Manager |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK | Firebase console (baked at build) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth (default `www.sahayakai.com`) | baked at build |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `sahayakai-b4248` | baked at build |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage | baked at build |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` / `_APP_ID` / `_MEASUREMENT_ID` / `_VAPID_KEY` | FCM + analytics (VAPID has a hardcoded Dockerfile default) | baked at build |

### Infra / feature gates (runtime env vars)

| Variable | Purpose | Code default |
|---|---|---|
| `ONBOARDING_GATE_ENABLED` | Onboarding redirect gate in middleware | OFF (must stay off - see auth-middleware doc) |
| `VOICE_PROVIDER` | Telephony provider for attendance calls | `twilio` (`exotel` opt-in) |
| `APP_CHECK_REQUIRED` | Enforce Firebase App Check on `/api/ai/*` | tolerant when unset |
| `SAHAYAKAI_REQUIRE_APP_CHECK` | Sidecar-side App Check enforcement (read by the ADK sidecar) | - |
| `GENKIT_DEFAULT_MODEL` | Override the default text model | `googleai/gemini-2.5-flash` |
| `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` | ADK-Python sidecar base URL | unset → `SidecarConfigError` if a dispatcher needs it |

### Telephony / payments / other

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio REST (call route returns 503 if unset) |
| `VOICE_EXOTEL_CALL_URL` | Forward target for the Exotel streaming voicebot |
| `RAZORPAY_*` | Razorpay payments + HMAC webhook verification |
| `SARVAM_API_KEY` | Sarvam AI STT/TTS | 
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Error tracking + source-map upload |

### Feature flags (NOT all env)

Most flags live in **Firestore** at document `system_config/feature_flags` (`src/lib/feature-flags.ts`): the `billingKillSwitch`, subscription rollout, consent-notice flag, per-feature map, and all 17 agent sidecar mode/percent pairs. Read server-side with a 5-min in-memory cache and a `FALLBACK_CONFIG`. Only the infra gates above are env vars. Seed/update via `src/scripts/seed-feature-flags.ts` and `update-flags.ts`.

---

## next.config Key Settings

```
output: 'standalone'
serverExternalPackages: [
  '@genkit-ai/googleai', '@genkit-ai/firebase', '@genkit-ai/google-cloud', 'genkit',
  '@opentelemetry/sdk-node', '@opentelemetry/api', '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-metrics', 'firebase-admin',
  '@google-cloud/secret-manager', '@google-cloud/logging',
]
serverActions: { bodySizeLimit: '25mb' }   // allows image uploads via server actions
```

PWA via `next-pwa` (disabled in dev). Sentry source maps + tunnel route. Saffron (#f97316) PWA theme.

---

## tailwind.config Key Settings

- Tokens: primary saffron orange, secondary deep green, accent navy; white background.
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography`.
- Content path: `./src/**/*.{ts,tsx}`.

---

## Key Dependencies (package.json)

- Next.js `^15.5.11` (App Router), React `^18.3.1`.
- Genkit `^1.28.0` + `@genkit-ai/googleai` `^1.28.0`.
- `firebase ^11.9.1`, `firebase-admin ^13.4.0`.
- `razorpay ^2.9.6` (no Stripe). `next-pwa ^5.6.0`. `idb`, `zod`, `react-hook-form`, `lucide-react`, `@sentry/nextjs`, `pino`, `katex`.

---

## Firebase Project Configuration

- Firestore: Native mode, default database, project `sahayakai-b4248`.
- Storage: voice messages `voice-messages/{uid}/{ts}.{ext}`, content files `users/{uid}/{type}/{filename}`.
- Auth: Google Sign-In.
- Required composite indexes: conversations (`participantIds` array-contains + sort), messages (`createdAt` asc), `community_chat` (`createdAt` asc), `library_resources` (`type` + `createdAt`), `parent_outreach` (`createdAt` asc - added in a recent fix). See `firestore.indexes.json`.

---

## Cloud Run Configuration

- Region: **`asia-southeast1`** (NOT asia-south1).
- Service: `sahayakai-hotfix-resilience`, project `sahayakai-b4248` (number `640589855975`).
- NOT auto-routed on push - see DEPLOYMENT.md (`--no-traffic`, `scripts/safe-deploy.sh`).
- Runtime env (Dockerfile): `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_OPTIONS=--max-old-space-size=4096`.
