# SahayakAI — Global Architecture

## Overview

SahayakAI is a Next.js 15 (App Router) application targeting teachers across India. It is a voice-first, multilingual (11 Indic languages + English) AI toolkit deployed on Google Cloud Run.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router, React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4, Shadcn/ui (Radix primitives) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Firestore (client SDK with IndexedDB persistence) |
| File Storage | Firebase Storage (client upload) + Google Cloud Storage (server) |
| AI | Google Gemini via Genkit (`@genkit-ai/googleai`) |
| TTS | Google Cloud TTS API |
| Deployment | Cloud Run (standalone output), asia-south1 |
| Monitoring | Sentry (error tracking), Google Cloud Logging |
| Analytics | Custom event batching → Firestore |

---

## Request Lifecycle

```
Browser
  ↓ Firebase getIdToken() every 55 min
  ↓ Token stored in `auth-token` cookie
  ↓ HTTP request to Next.js

middleware.ts (runs on every route)
  ↓ Reads Bearer header OR auth-token cookie
  ↓ Verifies with Google public certs (5h cache)
  ↓ Injects x-user-id into request headers
  ↓ Applies security headers (CSP, HSTS, XFrame-Options)

Server Action / API Route
  ↓ Reads x-user-id from headers() — NEVER trust client-supplied identity
  ↓ Calls checkServerRateLimit(userId) → Firestore rate_limits collection
  ↓ Fetches server-side data via Admin SDK (bypasses Firestore security rules)
  ↓ Returns response

Client
  ↓ Renders result
  ↓ Real-time updates via Firestore onSnapshot listeners (client SDK)
```

---

## Authentication Flow

1. User clicks "Sign in with Google" → `AuthDialog` → Firebase `signInWithPopup`
2. `onIdTokenChanged` fires → syncs token to `auth-token` cookie (55-min refresh cadence)
3. `onAuthStateChanged` fires → calls `syncUserAction()` (upserts Firestore `users/{uid}`)
4. Middleware reads cookie OR Bearer header on subsequent requests
5. Dev bypass: `'dev-token'` maps to `'dev-user-123'` on localhost

**Key: The cookie is how middleware gets the identity on page navigations. The Bearer header is used for API route calls from client code.**

---

## AI Architecture

### Rule: Pages NEVER call AI flows directly

```
Page (client) → API Route (/api/ai/[feature]) → AI Flow (server module) → Gemini
```

AI flows are plain server TypeScript modules (no `'use server'`). They are imported only by API routes. This ensures AI logic is server-only and never bundled into client JavaScript.

### VIDYA Assistant (OmniOrb)

The floating mic orb uses a different path:
```
OmniOrb → /api/assistant → agent-router.ts → (intent classification) → tool-specific flow or chat response
```

The assistant has 2-tier caching:
- L1: In-memory (per Node process lifetime)
- L2: Firestore `assistant_sessions/{userId}` (persists across requests)

---

## Provider Stack (layout.tsx)

```tsx
<LanguageProvider>           // 11 Indic languages, Firestore sync
  <AuthProvider>             // Firebase auth, cookie sync, session tracking
    <SidebarProvider>        // Radix sidebar state
      <Header />             // Logo + AuthButton (top bar)
      <AppSidebar />         // Left nav with live unread badge
      <main>{children}</main>
      <OmniOrb />            // Floating VIDYA mic orb
      <Toaster />            // Toast notification system
    </SidebarProvider>
  </AuthProvider>
</LanguageProvider>
```

---

## Fonts

- **Body:** Inter (Google Fonts, variable font)
- **Headlines:** Outfit (Google Fonts, variable font)

Applied via `next/font/google` in layout.tsx. CSS variables `--font-inter` and `--font-outfit`.

---

## Security Headers (middleware.ts)

- `X-Frame-Options: DENY` — no iframes
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — all blocked at HTTP level
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Content-Security-Policy with nonce (applied per-request)

---

## Rate Limiting

Two layers:
1. **Server-side (middleware):** IP-based, sliding window, stored in Firestore `rate_limits/{userId}`
2. **Action-level:** `checkServerRateLimit(userId)` called inside server actions for sensitive operations (chat, content creation)

Fails open on non-limit errors (logs but does not block the request).

---

## Environment Variables

| Variable | Where Used | Required |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | AI flows | Yes |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | firebase-admin.ts | Yes (or Secret Manager) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | firebase.ts (client) | Yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | firebase.ts | Yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | firebase.ts | Yes |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | firebase.ts | Yes |
| `SENTRY_DSN` | Sentry | Optional |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client | Optional |

Validated at startup by `src/lib/config.ts` using Zod. In production, missing required vars cause `process.exit(1)`.

---

## PWA Configuration

- Service worker enabled in production, disabled in dev
- `skipWaiting: true` — auto-updates without user prompt
- Manifest configured with saffron theme color `#f97316`

---

## Build & Deploy

```bash
npm run build        # next build (standalone output)
# Docker image → Cloud Run (asia-south1)
# Push to main → auto-deploys
```

Server-external packages (not bundled by webpack): `@genkit-ai/googleai`, `firebase-admin`, `@opentelemetry/*`, `@google-cloud/logging`, `@google-cloud/storage`

---

## Key Architectural Decisions

1. **Admin SDK writes, client deletes** — connections are created server-side (bypasses Firestore rules), deleted client-side
2. **Denormalization everywhere** — participant names/photos, sender info, last message previews all duplicated to avoid joins
3. **Optimistic UI** — community chat, likes, follows all update UI before server confirms
4. **Fail-open on non-critical errors** — rate limit checks, analytics flush, TTS all fail silently rather than blocking user actions
5. **Conceptual server/client boundary** — AI flows are pure server modules; only API routes import them
