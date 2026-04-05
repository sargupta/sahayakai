# SahayakAI — Configuration

## Environment Variables

### Required (app will not start in production without these)

| Variable | Purpose | Source |
|---|---|---|
| `GOOGLE_GENAI_API_KEY` | Gemini AI API | Google AI Studio |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin SDK | Firebase Console → Service Accounts, or Secret Manager |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client SDK | Firebase Console → App config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project | Firebase Console |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage | Firebase Console |

### Optional

| Variable | Purpose | Default |
|---|---|---|
| `SENTRY_DSN` | Server-side error tracking | None (Sentry disabled) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side error tracking | None |
| `GOOGLE_API_KEY` | Fallback if GOOGLE_GENAI_API_KEY missing | — |
| `NODE_ENV` | Environment mode | `development` |

### Secret Manager Support
`FIREBASE_SERVICE_ACCOUNT_KEY` can be stored in Google Secret Manager. `firebase-admin.ts` fetches it at runtime if not found as env var.

---

## next.config.ts Key Settings

```
output: 'standalone'           // Docker-friendly build
serverExternalPackages: [      // Not bundled by webpack (server-only)
  '@genkit-ai/googleai',
  'firebase-admin',
  '@opentelemetry/*',
  '@google-cloud/logging',
  '@google-cloud/storage',
  'pino',
]
serverActions: {
  bodySizeLimit: '25mb'        // Allows image uploads via server actions
}
```

### Webpack Client Fallbacks
These Node.js modules are stubbed out for client-side bundles:
`fs`, `path`, `crypto`, `net`, `tls`, `child_process`, `dns`, `os`, `stream`, `http`, `https`, `zlib`

### PWA (next-pwa)
- Disabled in development
- `skipWaiting: true` — auto-updates
- Manifest: saffron (#f97316) theme
- Service worker: registered at root

### Sentry
- Source maps uploaded on build
- Tunnel route: `/monitoring` (avoids ad-blocker blocking)
- Auto-instrumentation for Node, browser

---

## tailwind.config.ts Key Settings

### Design Tokens
```
primary: saffron orange (HSL 28 70% 59%)
secondary: deep green (HSL 123 37% 25%)
accent: navy blue (HSL 240 100% 25%)
background: white
foreground: dark gray (#1F2937)
sidebar: off-white (98%) with saffron accents
```

### Plugins
- `tailwindcss-animate` — accordion, fade, slide animations
- `@tailwindcss/typography` — prose class for markdown rendering

### Custom Animations
- `accordion-down/up`: height 0 → auto
- `fade-in-up`: translateY(10px) → 0 + opacity 0 → 1
- `bounce-subtle`: 0% → 5% → 0% vertical, 3s loop

### Content Paths
```
'./src/**/*.{ts,tsx}'
```

---

## package.json Key Dependencies

### AI
- `genkit`, `@genkit-ai/googleai` — Gemini AI SDK
- `ai` (Vercel AI SDK) — streaming utilities

### Firebase
- `firebase` — client SDK (v10+)
- `firebase-admin` — server SDK

### UI
- `next`, `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/typography`
- `@radix-ui/*` — all Radix primitives (via Shadcn)
- `lucide-react` — icons
- `class-variance-authority`, `clsx`, `tailwind-merge`

### Forms & Validation
- `react-hook-form`
- `@hookform/resolvers`
- `zod`

### Utilities
- `date-fns` — date formatting
- `uuid` — ID generation
- `idb` — IndexedDB wrapper

### PDF/Export
- `katex` — LaTeX math rendering in worksheets

### Monitoring
- `@sentry/nextjs`
- `pino` — structured logging

### Build
- `next-pwa` — PWA support
- `typescript`

---

## Firebase Project Configuration

**Firestore:** Native mode (not Datastore mode), default database

**Firebase Storage:** Used for:
- Voice messages: `voice-messages/{uid}/{timestamp}.{ext}`
- User content files: `users/{uid}/{type}/{filename}`

**Firebase Auth:** Google Sign-In provider enabled

**Firestore Indexes Required:**
- `conversations` collection: composite index on `participantIds` (array-contains) + `updatedAt` (desc) — for inbox query
- `conversations/{id}/messages`: `createdAt` ascending — for message thread
- `community_chat`: `createdAt` ascending — for chat
- `library_resources`: `type` + `createdAt` (for filtered queries)
- `notifications`: `recipientId` + `isRead` + `createdAt`

---

## Cloud Run Configuration

- **Region:** asia-south1 (Mumbai — lowest latency for India)
- **Service name:** sahayakai-hotfix-resilience
- **Trigger:** Push to `main` branch → auto-deploy
- **Container:** Node.js standalone Next.js build
- **Memory:** 512MB minimum recommended (AI flows are memory-intensive)
- **Concurrency:** Default Cloud Run concurrency (80 per instance)
