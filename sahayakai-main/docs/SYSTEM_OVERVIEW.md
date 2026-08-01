# SahayakAI System Overview

**Status:** Canonical engineering reference. Read this first.
**Last updated:** 2026-07-19
**Describes production release:** `main @ 1b0f59ef9` ("full program live on both regions", 2026-07-04), served at **https://www.sahayakai.com**.

This is the single source of truth for what SahayakAI actually is in production, component by component. It exists because no other document does that job: the top-level `README.md` still describes a three-flow MVP on Firebase Functions, and roughly half of `docs/` predates the current architecture or describes systems that were never built (see Section 14). Every claim here was verified against the code at the release commit above, not against older planning docs.

When this document and any other doc disagree, this document wins until it is itself proven stale. When this document and the **code** disagree, the code wins: fix this document.

---

## How to use this document

- New engineer, day one: read Sections 1 through 4, then the "Onboarding path" in Section 16.
- Working on a specific area: jump to its section, then follow the linked canonical sub-doc for depth.
- Wondering whether a `docs/` file can be trusted: check Section 14 first.
- Things that will bite you: Section 15 (known issues and technical debt) and the glossary (Appendix A), which disambiguates two different systems both called "sidecar".

---

## Table of contents

1. What SahayakAI is
2. The teacher journey
3. System architecture at a glance
4. Repository map
5. Feature catalog (route-complete)
6. The AI layer
7. Request lifecycle, API surface, and auth
8. Data model (Firestore)
9. Billing, quotas, moderation, and DPDP compliance
10. Voice and parent-call system
11. Infrastructure, deploy, CI/CD, and monitoring
12. Internationalization and offline
13. Local development setup
14. Documentation map
15. Known issues and technical debt
16. Onboarding path (your first week)
- Appendix A: Glossary of internal terms

---

## 1. What SahayakAI is

SahayakAI is a voice-first, eleven-language teaching platform for K-12 teachers in India. Not a single lesson-plan generator: the production app is a suite of AI content tools built around a "prep spine" (plan, worksheet, quiz, exam paper, rubric, instant answer), plus three substantial products layered on top:

- **An attendance and parent-outreach CRM.** Class rosters, daily attendance, marks, and a priority-sorted "who needs a parent call today" triage that places an AI-scripted phone call to the parent in their own language (Section 10).
- **A teacher social network.** Groups, a staff-room feed and chat, a teacher directory, connection requests, 1:1 direct messages with presence and typing indicators, and a shared resource library (Section 5).
- **An analytics layer.** A per-teacher "Impact Score" (a five-dimension health/engagement score, see [`docs/IMPACT_SCORE.md`](./IMPACT_SCORE.md)) and a principal-facing school analytics dashboard.

It is deliberately not positioned as "a rural tool." The pricing ladder runs from a free tier up to school and enterprise plans with SSO and private deployment, and the beachhead is Tier-2 CBSE schools and school chains as much as individual teachers. Eleven Indian languages are a first-class constraint everywhere: never Hindi-only.

Scale as of this release (from [`docs/FABLE5_CRITICAL_REVIEW_2026-07-03.md`](./FABLE5_CRITICAL_REVIEW_2026-07-03.md), cross-checked against the tree): roughly 153,000 lines of source across about 778 files, 47 routed pages, 153 API route handlers, and 25 AI flow files.

---

## 2. The teacher journey

1. **Cold visit.** `/` renders a B2B marketing landing page for signed-out visitors (`src/components/landing/landing-page.tsx`). It is auth-sticky, so a returning, signed-in teacher lands straight on the dashboard (`src/app/page.tsx`).
2. **Sign-up and onboarding.** `src/app/onboarding/page.tsx` is a three-step flow: language picker, then a single-screen accordion (role, school and state with auto-lookup, board, subjects, classes, optional phone and pincode with geo-detect), then a "hybrid aha moment" that shows a pre-baked sample lesson plan plus one real AI generation before finishing. Principals and vice-principals route to `/organization/dashboard`; everyone else to the dashboard.
3. **Core loop.** The dashboard has a single mic/text box (`src/components/dashboard/dashboard-home.tsx`) that classifies intent via `POST /api/ai/intent` and routes to one of the six spine tools, each rendered through a shared generator shell. Output is saved to My Library or shared to Community.
4. **Supporting habits.** Daily attendance and parent outreach, the Community feed and DMs, My Library (every past generation), and the Impact Dashboard.
5. **Monetization.** The Usage page shows per-feature quota bars; the Pricing page offers Free, Pro, and three School tiers; checkout is Razorpay (Section 9).
6. **Account controls.** Settings (profile, language, theme, plan, consent, data export, account deletion), Labs (parked and experimental tools), and, for admins, the Mission Control and Log dashboards.

---

## 3. System architecture at a glance

**Stack:** Next.js 15 (App Router) is the whole application: UI, API routes, and server logic in one deployable. AI is [Genkit](https://firebase.google.com/docs/genkit) over Google Gemini. Data is Cloud Firestore. Auth is Firebase Authentication. The app runs as a container on Cloud Run, not on Firebase Functions.

**Production topology:**

```
  Teacher browser (India + global)
        |
        v
  sahayakai.com  (DNS via Cloudflare -> A record 34.50.150.243)
        |
        v
  Global external HTTPS Load Balancer
   - url-map + target-https-proxy
   - backend: sahayakai-backend-service
   - WAF: Cloud Armor "sahayakai-bot-block"
        |            |
   (serverless NEG)  (serverless NEG)
   asia-southeast1   asia-south1
        |            |
        v            v
  Cloud Run          Cloud Run
  sahayakai-hotfix-  sahayakai-hotfix-
  resilience (SG)    resilience (Mumbai)
        |            |
        +-----+------+   (LB geo-routes: India -> Mumbai, else Singapore)
              |
              v
  Firestore (default), asia-south1 (Mumbai)   <- all app data and PII, India-resident
  Cloud Storage: sahayakai-b4248-mumbai (new) + legacy US bucket (read-only soak)
  Firebase Auth (global)
  Presence + typing: Firestore (Mumbai) as of 2026-07-04 (migrated off Singapore RTDB)
```

Key facts a new engineer must internalize:

- **Production is dual-region.** The load balancer fronts both Mumbai (`asia-south1`) and Singapore (`asia-southeast1`), serving the same Cloud Run service name (`sahayakai-hotfix-resilience`) in each. A deploy that only touches one region leaves the other stale. See Section 11.
- **All user data is India-resident** in Firestore Mumbai, completed via the migration in [`docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md`](./MUMBAI_REGION_MIGRATION_RUNBOOK.md).
- **Firebase Hosting (`*.web.app`) is legacy.** The `README.md` "try it live" `sahayakai-f69e0.web.app` link is stale; real traffic flows through the Cloud Run + load balancer path above.
- **Two external services sit beside the app** and are easy to confuse (Appendix A): a Python "ADK" agent service (`sahayakai-agents`) used for gradual-rollout AI dispatch, and a standalone Exotel voice service (`sahayakai-voice-call`) currently dormant. Neither is in this repository.

---

## 4. Repository map

This repository (`sargupta/sahayakai`) is a monorepo. The production web app lives in `sahayakai-main/`.

**Branches and what is live.** Production is `main`. Integration/staging is `develop` (auto-deploys to `sahayakai-preview`). Short-lived branches are `feature/*`, `fix/*`, `hotfix/*`. See [`docs/BRANCHING.md`](./BRANCHING.md). Note that a local `main` can lag `origin/main`; always confirm production against `origin/main`, not a local checkout.

**`sahayakai-main/src/` layout:**

| Directory | What lives here |
|---|---|
| `app/` | Next.js App Router. `app/**/page.tsx` are the ~47 pages; `app/api/**/route.ts` are the 153 API handlers. |
| `ai/` | The Genkit AI layer: `genkit.ts` (central instance), `flows/` (25 flows), `schemas/`, `soul.ts`, `prompt-hardening.ts`, `evaluators/`, `eval-datasets/`, `tools/`, `data/`. Section 6. |
| `server/` | Plain server modules (`community.ts`, `groups.ts`, `payments.ts`, `attendance.ts`, etc.) that API routes call into. The service layer. |
| `lib/` | Shared helpers: `api/` (typed client), `sidecar/` (AI dispatch), `db/adapter.ts` (data-access allowlist), `feature-flags.ts`, `plan-guard.ts`, `razorpay.ts`, `sarvam.ts`, `bhashini.ts`, voice-pipeline, and more. |
| `features/` | The redesigned per-tool decomposition. `features/generator/` holds the shared `GeneratorPage` shell and `useGenerator` hook used by the six spine tools. |
| `locales/` | Ten Indic locale JSON dictionaries, lazily loaded (Section 12). |
| `components/`, `context/`, `hooks/`, `store/` | UI components, React context (including `language-context.tsx`), hooks, client state. |
| `middleware.ts` | The single auth and security-header choke point (Section 7). |

**Sibling repositories and directories** (separate from `sahayakai-main`, some not in this git repo):

- `sahayakai-agents/` (sibling repo, not present here): the Python "ADK" agent service targeted by the sidecar dispatchers. See Appendix A.
- `sahayakai-voice-call/`: a standalone Next.js + custom-WebSocket service implementing an Exotel streaming voicebot. Real, prod-adjacent, currently dormant (Section 10).
- `sahayakai-voice-call-{gujarati,marathi,tamil}/`: single-language intern training sandboxes. Not deployed, not production (Section 10).
- `sahayakai-android/`: a Capacitor wrapper around the PWA (early phase; not the native Flutter app that some stale docs describe).
- `course-studio/`, `agent-mesh/`: separate projects, out of scope for this document.

---

## 5. Feature catalog (route-complete)

Every user-facing page, grouped. All paths are under `src/app`.

### Spine tools (shared generator shell)

The six core tools all compose `GeneratorPage` (`src/features/generator/components/generator-page.tsx`) + `useGenerator` (`src/features/generator/hooks/use-generator.ts`), which centralizes the input card, double-submit guard, Bearer-token attach, streaming and progress, quota-aware error handling (403/429/503 render an upgrade prompt, not a generic toast), and abortable fetch. Each page file is a roughly fifteen-line composition.

| Tool | Route | What it does |
|---|---|---|
| Lesson Plan | `/lesson-plan` | Flagship generator; NCERT/board-aware 5E lesson plans. Streaming variant at `/api/ai/lesson-plan/stream`. |
| Worksheet Wizard | `/worksheet-wizard` | Printable worksheet from a photographed textbook page (multimodal). |
| Quiz Generator | `/quiz-generator` | MCQ/short-answer quiz with question-type picker and Bloom's-taxonomy tagging. Fans out three difficulty variants per request. |
| Exam Paper | `/exam-paper` | Board-pattern exam paper against an official blueprint and a past-question bank. Streaming variant at `/api/ai/exam-paper/stream`. |
| Rubric Generator | `/rubric-generator` | Four-level grading rubric from an assignment description. |
| Instant Answer | `/instant-answer` | One-shot Q&A with an optional video suggestion. |

### Supporting features (main navigation)

| Feature | Route(s) | What it does |
|---|---|---|
| Attendance | `/attendance`, `/attendance/[classId]`, `/attendance/[classId]/marks` | Roster CRUD, daily attendance grid, monthly reports, parent-outreach triage, and the Twilio "Contact Parent" call flow (Section 10). |
| Community | `/community` | Real social feed: groups, staff-room chat, teacher directory and search, connection requests, resource shares, likes. |
| My Library | `/my-library` | All saved content across every tool. |
| Messages | `/messages` | 1:1 DMs, gated on an accepted connection. |
| Notifications | `/notifications` | Connection requests, replies, activity. |
| Profiles | `/my-profile`, `/profile/[uid]` | Own vs public professional profile. |

### Labs-parked tools

Parked behind a hand-maintained registry (`src/lib/labs.ts`), surfaced together on `/labs` with a Labs banner. Parking is a product decision that ships through code review, deliberately not a runtime feature flag. These tools have not migrated to the shared generator shell yet (Section 15).

| Tool | Route |
|---|---|
| Visual Aid Designer | `/visual-aid-designer` |
| Content Creator (hub) | `/content-creator` |
| Assessment Scanner | `/assessment-scanner` |
| Assess Work | `/assess-assignment` |
| Video Storyteller | `/video-storyteller` |
| Virtual Field Trip | `/virtual-field-trip` |
| Teacher Training | `/teacher-training` |
| Impact Dashboard | `/impact-dashboard` |

### Account and legal

`/settings`, `/my-profile`, `/pricing`, `/usage`, `/privacy-for-teachers`, `/onboarding` (flow only, not in nav).

### Admin and organization

| Surface | Route | Notes |
|---|---|---|
| Mission Control (cost) | `/admin/cost-dashboard` | Live GCP cost and quota monitoring. |
| Log Dashboard | `/admin/log-dashboard` | Cloud Logging viewer. |
| Organization Dashboard | `/organization/dashboard` | Principal/VP-only; server-resolves org membership (hardened against client-side privilege escalation). |
| Review Panel | `/review-panel` | "Coming soon" stub. |

Server-side authorization for admin surfaces is enforced in the server actions/routes (`isAdmin`, org-membership resolution). Note the client-side nav gate is weaker than the server gate (Section 15).

### Marketing and developer surfaces

- Marketing (chrome-free layout): `/(marketing)/{about,for-schools,terms}`, blog posts under `/(marketing)/blog/*`, and localized landing pages `/(marketing)/{bn,kn,ta}`. Also `/pricing` and `/privacy-for-teachers` (marketing-styled, outside the route group).
- Developer API (public, but linked from nowhere in the UI): `/api-docs` (Swagger UI) and `/api-playground` (interactive tester).

### Duplicate/stub surfaces to know about

`/community-library` is an older second "community" page still rendering hardcoded mock data; `/submit-content` and `/review-panel` are "coming soon" stubs. See Section 15.

---

## 6. The AI layer

Full detail in the code under `src/ai/`. This section is the map.

### Framework and central instance

Genkit (`genkit@^1.28.0`) with the Google AI plugin. The central instance is `src/ai/genkit.ts`:

```ts
export const ai = genkit({
  plugins: [googleAI()],
  model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
});
```

Every flow without an explicit model override runs on **`gemini-2.5-flash`**. The app moved off `gemini-2.0-flash` because its per-minute free-tier quota was saturating in production (quiz generation alone fires three parallel calls per request).

Two infrastructure pieces wrap almost every call:

- **`runResiliently()`** (`src/ai/genkit.ts`): a pool of Gemini API keys with retry/backoff on 429/401/403 and a hard 50-second budget, so callers always get a typed `AIQuotaExhaustedError` (HTTP 503 + `Retry-After`) rather than an unclassified failure.
- **Telemetry**: production-only Cloud Trace/Cloud Logging export via the Firebase Genkit plugin.

### The flow-to-route pattern (and the dispatcher)

Each flow follows: Zod input schema and output schema, an inline `ai.definePrompt(...)`, an `ai.defineFlow(...)` that adds resilience/validation/persistence, a thin exported wrapper doing safety/rate-limit/profile-localization pre-flight, and an API route at `src/app/api/ai/<feature>/route.ts` that reads the middleware-injected `x-user-id`, applies `withPlanCheck('<feature>')`, and calls a **dispatcher**.

**The single most important architectural fact here:** no API route calls a Genkit flow directly. Each flow has a paired dispatcher (`src/lib/sidecar/<flow>-dispatch.ts`) that routes between the in-process Genkit flow and an external Python "ADK" service (`sahayakai-agents`) based on a per-flow Firestore feature flag with modes `off | shadow | canary | full`. **All fifteen sidecar flags default to `off`** (Genkit only). So: read the Genkit flows as "what runs in production today"; the dispatcher is rollout scaffolding around them.

### Model and provider inventory

| Provider / model | Role |
|---|---|
| `googleai/gemini-2.5-flash` (default) | Primary text/structured-JSON LLM for nearly all flows |
| `googleai/gemini-2.5-pro` | Vision + high-reasoning grading; only `assignment-assessor` |
| `googleai/gemini-3-pro-image-preview` | Image generation; `visual-aid-designer` |
| `googleai/gemini-2.5-flash-image` | Image generation; `avatar-generator` (most expensive single surface, roughly $0.04/image) |
| Sarvam AI (Bulbul v3 TTS, Saaras v3 STT) | Primary Indic voice, 11 languages; via `/api/tts` and voice-to-text |
| Bhashini (Govt. of India) | TTS fallback for Telugu, Marathi, Odia only |
| Google Cloud TTS | Final TTS fallback tier |
| YouTube Data API + RSS | Video sourcing for `video-storyteller` (ranking is local, deterministic, non-LLM) |
| Twilio | Parent-call telephony (production default) |
| Exotel | Alternate telephony via the separate voice-call service (dormant) |

Providers that are **not** integrated despite appearing in stale docs or comments: Tavily, OpenAI, Azure Speech, ElevenLabs (a comment only). The `googleSearch` Genkit tool wired into `instant-answer` is a **mock** that returns hardcoded stubs; no real web grounding happens on the Genkit path (Section 15).

### Flow catalog

Twenty-five flow files under `src/ai/flows/`. The product-facing flows and their routes:

| Flow | Purpose | API route |
|---|---|---|
| lesson-plan-generator | 5E lesson plan (two Gemini calls: generate + materials audit) | `/api/ai/lesson-plan` (+ `/stream`) |
| worksheet-wizard | Worksheet from a textbook photo | `/api/ai/worksheet` |
| quiz-generator | Three parallel difficulty variants | `/api/ai/quiz` |
| exam-paper-generator | Board-blueprint exam paper | `/api/ai/exam-paper` (+ `/stream`) |
| rubric-generator | Four-level rubric | `/api/ai/rubric` |
| instant-answer | Q&A + optional video | `/api/ai/instant-answer` |
| assessment-scanner | Grades a photographed answer sheet (OCR then grade) | `/api/ai/assessment-scanner` |
| assignment-assessor | Grades one handwritten assignment (gemini-2.5-pro) | `/api/ai/assess-assignment` |
| visual-aid-designer | Chalk-style line illustration | `/api/ai/visual-aid` |
| video-storyteller | Five-category YouTube recommendations | `/api/ai/video-storyteller` |
| virtual-field-trip | Google-Earth-linked itinerary | `/api/ai/virtual-field-trip` |
| avatar-generator | Teacher headshot | `/api/ai/avatar` |
| voice-to-text | STT (Sarvam then Gemini fallback) | `/api/ai/voice-to-text` |
| teacher-training | Pedagogy advice | `/api/ai/teacher-training` |
| vidya-assistant | VIDYA conversational assistant | `/api/assistant` |
| agent-definitions (router) | Intent classifier | `/api/ai/intent` |
| parent-call-agent | Live call turn reply + post-call summary | `/api/attendance/twiml*` |
| parent-message-generator | Parent SMS/WhatsApp message | `/api/ai/parent-message` |
| community-persona-message | Demo persona chat | `/api/community/persona-pulse` |

### VIDYA and the "multi-agent" question

VIDYA is the persistent floating voice assistant (the OmniOrb, mounted app-wide). Be precise: on the TypeScript/Genkit side it is **not** a true multi-agent system. "Routing" is a single supervisor LLM call that classifies intent into structured JSON, interpreted by a plain TypeScript `switch` that produces a `NAVIGATE_AND_FILL` frontend action. There is no LLM-to-LLM handoff in this repository. If a genuine writer/evaluator/reviser loop exists, it is server-side in the Python `sahayakai-agents` service, out of scope here. Note also that `vidya-assistant.ts` and `agent-definitions.ts` maintain two near-duplicate intent-disambiguation blocks by hand, and `agent-router.ts::processAgentRequest` is effectively dead code (its only importer is its test); the live `/api/ai/intent` route re-implements a similar switch. These can drift (Section 15).

### Prompt safety

Two pieces: `src/ai/soul.ts` (the SahayakAI persona plus a `STRUCTURED_OUTPUT_OVERRIDE` that re-locks single-language output for content flows) and `src/ai/prompt-hardening.ts` (an injection guard: user input is wrapped in `<user_input>` tags and a length-preserving neutralizer prevents crafted values from closing the delimiter, which matters because Genkit's dotprompt runs with escaping off). Most flows have full coverage. Two flows do not wrap free-text input: `avatar-generator` and, with a larger blast radius, `assessment-scanner` (a 20,000-character "authoritative" answer-key field interpolated raw). See Section 15.

### The eval harness (and its current gating reality)

`src/ai/eval-datasets/` holds golden cases for eleven flows in three languages (English, Bengali, Tamil), run by `scripts/eval/run-evals.mts`, which checks schema validity and, for Bengali/Tamil cases, counts target-script characters to verify the output is genuinely in-language. There are also three Genkit-native evaluators (`src/ai/evaluators/`) for exam-paper fidelity, lesson-plan alignment, and quiz quality.

Important caveat for a new engineer: **AI-quality evals do not currently block a PR or deploy.** The `genkit-eval.yml` workflow runs with `continue-on-error: true` and points at pre-refactor dataset paths; the blocking `run-evals.mts` script is not referenced by any workflow. Making evals blocking is an outstanding Tranche 4 item in [`docs/EXECUTION_PLAN_2026-07.md`](./EXECUTION_PLAN_2026-07.md). Until then, run `npx tsx scripts/eval/run-evals.mts --all` manually (needs `GOOGLE_GENAI_API_KEY`).

### Cost notes

Highest-cost surfaces: the two image flows (`avatar-generator`, `visual-aid-designer`), `assignment-assessor` (Pro model + vision), and `quiz-generator` (three parallel calls). `lesson-plan-generator` makes two calls. Sidecar `shadow`/`canary` modes double spend while active (both engines run for parity scoring), currently zero because all flags are `off`. `COST_ANALYSIS.md` is dated March 2026, still lists `gemini-2.0-flash`, and books a real cost for the mocked grounding tool; treat it as directional only.

---

## 7. Request lifecycle, API surface, and auth

The founder-ratified rule (Tranche 5, [`docs/API_MIGRATION_PATTERN.md`](./API_MIGRATION_PATTERN.md)) is: **API routes under `src/app/api/**` are the single backend boundary.** Server Actions are being migrated out; CI blocks new files in `src/app/actions/`. The future Flutter client consumes the same `/api/*` surface.

### The lifecycle of an authenticated request

1. **Client** calls a typed wrapper in `src/lib/api/<domain>.ts`, which calls `apiFetch<T>()` in `src/lib/api/client.ts`. That reads the Firebase client user, gets an ID token, and attaches `Authorization: Bearer <idToken>`.
2. **`src/middleware.ts`** runs on every non-static path. It:
   - strips any client-supplied `x-user-id` / `x-user-plan` / `x-user-email` / `x-user-name` headers (these are trust-boundary headers; only middleware may set them, a P0 fix),
   - short-circuits bot-probe paths to a bare 404,
   - verifies the Bearer token (or `auth-token` cookie for pages) as a Firebase ID token via Google's JWKS,
   - on success, injects `x-user-id` and friends from verified token claims (including `x-user-plan` from the `planType` custom claim),
   - returns 401 for a protected route with an invalid/missing token,
   - attaches CSP, HSTS, and other security headers.
3. **Route handler** reads `x-user-id` (never trusts a body-supplied uid), Zod-validates input, and calls into the service layer.
4. **Service layer** (`src/server/<domain>.ts`) and helpers (`plan-guard.ts`, `usage-tracker.ts`, etc.).
5. **Data-access** via `src/lib/db/adapter.ts` (a field-level allowlist for `users`/`content` writes) or `src/lib/firebase-admin.ts::getDb()` directly.
6. **Response** as JSON; errors funnel through shared mappers (`src/server/api-error.ts`, `src/server/api-response.ts`) that never leak internals.

Auth in one line: Bearer Firebase ID token, verified by middleware, projected into `x-user-*` headers that every downstream trusts, and only those.

### API surface map

Of 153 routes, about 130 use the standard authenticated pattern. The rest are an explicit public/internal allowlist: SEO/health (none), payments (HMAC signature or anon-by-design), pre-login profile-check, Twilio callbacks (request-signature validated), internal service-to-service (`X-Internal-Key`), and cron jobs (`CRON_SECRET` bearer or Pub/Sub OIDC).

Route families: `account`, `ai` (16), `analytics`, `attendance` (13, includes the Twilio call pipeline), `auth`, `billing`, `community` (11), `connections`, `content`, `export`, `fcm`, `feedback`, `groups` (8), `jobs` (10 cron), `messages`, `moderation`, `notifications`, `organizations`, `performance`, `profile`, `tts`, `usage`, `user`, `vidya`, `webhooks`, plus a misc set (`assistant`, `logs`, `telemetry`, `metrics`, `geo/reverse`, `ncert/*`, `sarkar/verify`, `config/flags`, `feature-flags/me`).

### The security model to imitate

The house style is worth learning because new code should match it:

- **Single trust boundary through middleware** (client cannot set identity headers).
- **Double-layer field protection on `users/{uid}`**: `firestore.rules::protectedUserFields()` (database deny-list) plus `src/lib/db/adapter.ts::CLIENT_EDITABLE_USER_FIELDS` (application allow-list). Both independently prevent a client from self-granting `role`, `plan`, org membership, or aggregates. This is the fix for the admin/premium self-grant issue raised in the 2026-07-02 audit; as of this release it is closed.
- **Fail-open vs fail-closed is deliberate and per-callsite**: billing/subscription gating fails closed (outage keeps gating on); moderation feed-filtering and daily usage caps fail open (an outage never blanks the feed or grounds the product); the feature-flag system falls back to a safe config (kill switch on, all sidecars off). Each has an inline rationale.
- **Webhooks are signature- or secret-gated**, and the parent-call flow dedupes per turn to survive Twilio's at-least-once delivery.
- **Irreversible actions require fresh re-auth** (account deletion requires an ID token minted within five minutes).

First files to read, in order: `src/middleware.ts`, `docs/API_MIGRATION_PATTERN.md`, `src/lib/api/client.ts` + `src/server/api-error.ts`, `src/app/api/ai/lesson-plan/route.ts` + `src/lib/plan-guard.ts`, then `firestore.rules`.

---

## 8. Data model (Firestore)

There is no single schema doc that matches the code (the existing schema docs are stale or fictional, Section 14). The catalog below is derived from the code and `firestore.rules`. `firestore.indexes.json` defines composite indexes for twelve collection groups.

The most important security artifact in the data model is `firestore.rules::protectedUserFields()` (roughly lines 34-58): it blocks direct-client writes to role/admin fields, all billing/plan fields, org membership, server-computed aggregates, and identity fields. This is mirrored in code by `CLIENT_EDITABLE_USER_FIELDS`.

Core collections (not exhaustive; see the code for the full ~45):

| Collection | Purpose | Written by |
|---|---|---|
| `users/{uid}` | Profile, plan, role, consent, deletion state | Client (allowlisted fields only); privileged fields Admin-SDK only |
| `users/{uid}/content/{id}` | Generated content library | Owner |
| `users/{uid}/blocks/{blockedUid}` | Moderation block list | Owner |
| `users/{uid}/consent_log/{id}` | DPDP consent audit trail | Server, append-only |
| `users/{uid}/vidya_sessions/{id}` | VIDYA chat sessions | Owner, server-validated |
| `users/{uid}/analytics/{date}` | Daily activity analytics (365-day TTL) | Server |
| `community_chat`, `community_posts`/`posts`, `library_resources` | Social feed, staff-room, shared resources | Server / signed-in users per rules |
| `groups/{id}` + `members`, `posts`, `chat` | Groups | Server / members |
| `conversations/{id}` + `messages` | Direct and group messaging | Participants |
| `connections`, `connection_requests` | Teacher connections | Server |
| `reports/{id}` | Moderation reports (no client read path, 10/day rate limit) | Reporter create-only |
| `notifications/{id}` | Per-recipient notifications | Server write, recipient read |
| `webhook_events`, `payments_ledger`, `subscriptions` | Razorpay idempotency, amount-binding ledger, subscription mirror | Admin-SDK only (Section 9) |
| `organizations/{orgId}` + `members` | School/chain orgs | Admin-SDK only |
| `daily_user_usage/{uid_date}`, `usageCounters/{uid}` | Daily cost caps and monthly feature quotas | Server only |
| `system_config/feature_flags` | Master flag/remote-config doc | Admin-SDK / operator |
| `parent_outreach/{id}` + `turns` | Parent-call records and append-only transcript | Teacher create, server mutate |
| `classes/{id}` + `students`, `attendance/*`, `performance` | Attendance and gradebook | Server |
| `teacher_analytics/{uid}` | Aggregated per-teacher analytics | Server |
| `presence/{uid}`, `typing_status/{conversationId}` | Online presence and typing (Firestore Mumbai) | Owner/participant |
| `agent_sessions`, `agent_shadow_diffs`, `agent_voice_sessions` | ADK sidecar session state and shadow-diff capture (deny-all in rules; TTL'd) | Sidecar only |

---

## 9. Billing, quotas, moderation, and DPDP compliance

### Billing (Razorpay)

Client in `src/lib/razorpay.ts`; plans in `src/lib/plan-config.ts` (Pro at launch pricing, School Gold with a per-seat volume ladder, School Premium custom-quote). Plan resolution is strict: only the immutable Razorpay `plan_id` maps to a tier, never forgeable `notes`.

The webhook (`src/app/api/webhooks/razorpay/route.ts`) is the correctness-critical piece. It verifies an HMAC signature before any processing; only `subscription.charged` provisions access; it enforces **H21 amount-binding** (the captured amount must match the canonical price table, else the grant is rejected and logged) and **replay-proof idempotency** (a Firestore transaction reads `payments_ledger/{paymentId}` first, so a replayed payment id can never double-provision). It sets the `planType` custom claim so middleware picks it up on the next token refresh. Anonymous public-checkout buyers get a passwordless magic sign-in link and the user is created only after payment.

Reconciliation (`src/lib/billing-reconciliation.ts`, cron every 4 hours) compares live Razorpay state against Firestore, auto-fixes safe mismatches, flags risky ones, and alerts on double-charge or a burst of active-in-Razorpay-but-free-in-Firestore mismatches (a suspected webhook outage).

### Quotas

Three layers: daily cost caps (`src/lib/usage-tracker.ts`, per-user ceilings on Gemini tokens, TTS characters, image generations; fails open), monthly plan-gated feature quotas (`src/lib/plan-guard.ts` + `usageCounters/{uid}`; `withPlanCheck()` reserves and rolls back atomically; fails closed on the gating decision), and voice-cloud minutes (`src/lib/voice-quota-guard.ts`).

### Moderation

Closed a gap from the 2026-07-02 audit (a social network with DMs had no block/report recourse). Block is idempotent and the blocked user is never notified (dignity-first). Reports go to `reports/{id}` with no client read path and a 10/day rate limit. Enforcement is fail-closed on message send, fail-open on feed read. Routes under `/api/moderation/*`.

### Feature flags

A single Firestore doc `system_config/feature_flags` (not Firebase Remote Config), server-cached five minutes, failing to a safe fallback. It carries global toggles (billing kill switch, maintenance mode, subscription rollout percent), the ~17 per-agent sidecar dispatch modes, a DPDP consent-notice toggle, and per-feature toggles. Client-readable state is a hardcoded whitelist via `/api/feature-flags/me`; admin-only flags are never exposed. See [`docs/FEATURE_FLAGS.md`](./FEATURE_FLAGS.md). Note two env-var-only flags outside this system: `ONBOARDING_GATE_ENABLED` (must stay off in prod; flipping it locked out the user base on 2026-06-08) and `DEMO_CALL_ENABLED` (the demo-call lead magnet, not in this release; see Section 15).

### Background jobs

Ten cron routes under `/api/jobs/*`, all `CRON_SECRET`- or OIDC-gated: analytics retention (DPDP 365-day deletion), billing reconciliation, storage cleanup, community-chat cleanup (90-day), the AI community agent and reactive replies, persona-pool growth, export reminders (with anonymization after the deletion grace period), and the daily briefing.

### DPDP compliance

Right to erasure (`/api/user/delete-account`) requires `confirm: true` and fresh re-auth, then cancels the subscription, flags a 30-day export grace period, and paginates deletion of connections, content, analytics, VIDYA sessions, and usage before immediately deleting the Firebase Auth account. A documented gap: community posts/chat and Storage files are not purged here (called out in a code comment). Consent (`/api/user/consent`) is per-category and logged. Retention is actually enforced by the analytics-retention job. See [`docs/compliance/DPDP_DATA_PROTECTION.md`](./compliance/DPDP_DATA_PROTECTION.md).

---

## 10. Voice and parent-call system

The feature: a teacher triggers an AI-scripted phone call to a student's parent (about attendance, performance, behavior, or praise) in the parent's own language. Production uses Twilio.

### Call lifecycle (production Twilio path)

1. Teacher opens `ContactParentModal` (`src/components/attendance/contact-parent-modal.tsx`) from the attendance page.
2. `generateParentMessage()` (`src/ai/flows/parent-message-generator.ts`) writes the message in the parent's language.
3. `POST /api/attendance/outreach` verifies ownership, reads `parentPhone` from the student record server-side (never trusts a client-supplied phone), dedupes, and writes `parent_outreach/{id}`.
4. `POST /api/attendance/call` places the call. A provider switch on `VOICE_PROVIDER` (default `twilio`; `exotel` forwards to the separate voice service) posts to the Twilio Calls API (pinned to the Singapore Twilio edge for India latency).
5. Twilio fetches `GET /api/attendance/twiml` on pickup. Default mode is batch: a spoken greeting and message plus a `<Gather>` for the parent's reply. TTS on the call is Twilio `<Say>` using Google voices (`TWILIO_VOICE_MAP`); Odia has no native voice and falls back to a Hindi voice reading Odia text.
6. `POST /api/attendance/twiml` validates the Twilio signature, dedupes turns by fingerprint, appends the transcript atomically, and calls the parent-call agent for the next reply (up to six turns).
7. `POST /api/attendance/twiml-status` (Twilio status callback) idempotently triggers `generateCallSummary()` once the call completes.
8. The frontend polls `GET /api/attendance/call-summary` for the transcript and AI summary.

Signature validation (`src/lib/twilio-validate.ts`) never skips in production regardless of Host header (a hardening fix). A scaffolded streaming pipeline (`src/lib/voice-pipeline/*`) exists but defaults to batch; treat streaming as not-yet-proven.

Note that Sarvam is used for in-app read-aloud (`/api/tts`) across all eleven languages including Odia, but the phone-call path does not use Sarvam, which is why Odia degrades on calls specifically.

### The sibling voice-call repositories

- **`sahayakai-voice-call`**: a real, standalone Cloud Run service (same GCP project) implementing an Exotel WebSocket streaming voicebot, with its own custom Node server for WS upgrades. The main app can forward to it via `VOICE_EXOTEL_CALL_URL`, but Exotel is parked (no paid subscription), so this is live infrastructure that is currently dormant, not the active call path. Its code supports thirteen languages (the eleven plus Nepali and Assamese, the latter two via Sarvam because Google lacks voices for them); its README understates this.
- **`sahayakai-voice-call-{gujarati,marathi,tamil}`**: single-language intern training sandboxes. No Dockerfile, no deploy, pointed at a separate `sahayakai-voice-dev` Firebase project, each intern's own Twilio trial with a hard test-number override. Not production or staging. There is no automated path that merges their tuned strings back into the main app; treat that as a manual step.

---

## 11. Infrastructure, deploy, CI/CD, and monitoring

### Deploy

Production deploys are **manual and gated**, not automatic. The Cloud Build push trigger is currently inactive, so the canonical path is `scripts/safe-deploy.sh`, which is branch-aware (`main` to the prod service, `develop` to `sahayakai-preview`, `hotfix/*` to prod with relaxed guards) and refuses to run on a dirty tree, on a too-recent revision, or while a build is in flight. It defaults to `--no-traffic --tag=sha-<sha>`: the new revision is built and warmed at 0% traffic until a human flips it with `gcloud run services update-traffic --to-latest`. See [`DEPLOY.md`](../DEPLOY.md) and the deploy-safety contract in [`AGENTS.md`](../AGENTS.md). Never run raw `gcloud run deploy`.

Dual-region caveat: `safe-deploy.sh` defaults to Singapore only. Mumbai is a separate load-balancer backend and requires a second run with `REGION=asia-south1 SERVICE=sahayakai-hotfix-resilience`, or Mumbai serves a stale image. Run `scripts/audit-deployments.sh` before and after.

Rollback is a traffic flip to a prior revision (under a minute); see [`docs/ROLLBACK.md`](./ROLLBACK.md). Build provenance is exposed at `/api/health` (SHAs and build id, but only to authenticated callers; anonymous callers get `{status: ok}`).

### CI/CD gates

GitHub reads workflows at the **repository root** only; the nested `sahayakai-main/.github/` is inert (a Tranche 1 finding). The root workflows:

- **test.yml**: typecheck, lint, jest with coverage (exit code now honored), build, and a first-load JS budget check. Blocking.
- **e2e-smoke.yml**: Playwright smoke on public routes. Blocking.
- **genkit-eval.yml**: AI flow evals on `src/ai/**` changes, but `continue-on-error` (does not block, and points at stale dataset paths). See Section 6.
- **quality-gates.yml**: eight-plus sub-gates including no-`--no-verify`, schema drift, typecheck, a changed-files `console.log` ratchet (Gate 5), a ban on new server actions, and a design-token ratchet. Mostly blocking.

### Environment

`.env.example` documents only the tunable knobs; production secrets live in Cloud Run env and Secret Manager. About 77 env vars are read across `src/`, grouped as Firebase, Gemini/Google, Twilio/voice, Razorpay, sidecar, security flags (`CSP_ENFORCED`, `APP_CHECK_REQUIRED`, `ONBOARDING_GATE_ENABLED`), and per-flow LLM timeouts. Twilio credentials were moved from plaintext env to Secret Manager (fix F1-04). A boot-time guard (`src/instrumentation.ts`) requires `GOOGLE_GENAI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT_KEY`.

### Monitoring

Sentry (server, edge, and browser with masked replay), a Cloud Monitoring dashboard (`monitoring/dashboard.json`, nine widgets), billing-specific alerts (`monitoring/billing-alerts.tf`), alert recipes in [`docs/ALERTS.md`](./ALERTS.md) (the Razorpay webhook-absence alert is the single most important one), Cloud Armor WAF, in-app admin cost and log dashboards, and an append-only incident log at [`docs/INCIDENTS.md`](./INCIDENTS.md).

---

## 12. Internationalization and offline

**Eleven languages:** English (no dictionary; the key is the English string) plus ten Indic locale JSON files under `src/locales/` (Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia). `src/context/language-context.tsx` loads only the active locale via dynamic import, cached for the session. This replaced a roughly 7,400-line inline dictionary that every session downloaded, and is the source of a 323 kB (about 34%) first-load reduction, now protected by the CI budget gate. Missing translations fall back to English rather than breaking. To add a key, use the English string as the key and add it to each locale JSON; to add a language, add a locale file plus loader and BCP-47 entries. `scripts/find-missing-i18n-keys.mjs` reports missing and orphan keys (not wired into CI).

**Offline/PWA:** `@serwist/next` (replacing the abandoned `next-pwa`), service worker at `src/app/sw.ts`. It precaches the static shell and an `offline.html` fallback, and runtime-caches fonts, icons, and a few `/api/config|user|health` responses. This is a scaffolded offline shell, not a full offline-capable app: AI generation, Firestore, and auth all require network. Do not claim offline general availability.

---

## 13. Local development setup

From `sahayakai-main/`:

```bash
npm install
cp .env.example .env.local     # fill in Firebase config and keys
npm run dev                    # Next.js dev, http://localhost:3000
npm run genkit:dev             # Genkit dev UI (tsx src/ai/dev.ts)
npm run typecheck              # tsc --noEmit
npm run lint
npm test                       # jest
npm run predeploy              # typecheck && build, run before every push
npm run qa:e2e                 # Playwright end-to-end
```

Node is pinned to `>=20 <21` (matches the `node:20-alpine` container). The `README.md` claim that pushing to `main` auto-deploys is stale; deploys are the manual `safe-deploy.sh` flow in Section 11.

---

## 14. Documentation map

The `docs/` tree is trustworthy in a narrow, recent cluster and misleading elsewhere. Use this map before trusting any other doc.

### Canonical (current, matches code, link and trust)

- [`AGENTS.md`](../AGENTS.md), [`DEPLOY.md`](../DEPLOY.md), [`docs/BRANCHING.md`](./BRANCHING.md), [`docs/ROLLBACK.md`](./ROLLBACK.md), [`docs/PREVIEW_ENV.md`](./PREVIEW_ENV.md) - process and ops.
- [`docs/API_MIGRATION_PATTERN.md`](./API_MIGRATION_PATTERN.md), [`docs/FEATURE_FLAGS.md`](./FEATURE_FLAGS.md), [`docs/DESIGN_TOKENS.md`](./DESIGN_TOKENS.md) - architecture and design system.
- [`docs/IMPACT_SCORE.md`](./IMPACT_SCORE.md), [`docs/VIDEO_RECOMMENDATION_ALGORITHM.md`](./VIDEO_RECOMMENDATION_ALGORITHM.md) - the two deepest, accurate feature specs.
- [`docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md`](./MUMBAI_REGION_MIGRATION_RUNBOOK.md) - current infra topology.
- [`docs/compliance/DPDP_DATA_PROTECTION.md`](./compliance/DPDP_DATA_PROTECTION.md), [`docs/compliance/APP_CHECK_ROLLOUT.md`](./compliance/APP_CHECK_ROLLOUT.md) - compliance.
- [`docs/ALERTS.md`](./ALERTS.md), [`docs/INCIDENTS.md`](./INCIDENTS.md), [`docs/I18N_BACKLOG.md`](./I18N_BACKLOG.md).
- [`docs/EXECUTION_PLAN_2026-07.md`](./EXECUTION_PLAN_2026-07.md) (what is next) and [`docs/FABLE5_CRITICAL_REVIEW_2026-07-03.md`](./FABLE5_CRITICAL_REVIEW_2026-07-03.md) (ground-truth critique). Read both.

### Stale (describes a real but obsolete past; do not follow)

`README.md` (Section 15), `docs/blueprint.md`, `docs/project_requirements.md`, `docs/PROJECT_DETAIL.md`, `docs/BRANCH_STRATEGY.md`, `docs/DATABASES_SCHEMA.md` + `DATABASE_SCHEMA_REVIEW.md`, `docs/GAP_EXECUTION_PLAN.md`, `docs/MONITORING.md` and `docs/TEACHER_LOOKUP.md` (four-dimension score, superseded by the current five-dimension model), the four `USER_MANUAL*` / testing-prompt files, everything under `docs/project/*`, `docs/ai_changes|baseline|journey_changes|production_checks|ui_fixes/*`, and `docs/change_log.md`.

### Fictional (describes systems never built; actively misleading, candidates for `docs/archive/`)

`docs/SOLUTION_ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md` + `ARCHITECTURE_REVIEW_ADDENDUM.md` (a VertexAI "Agent Garden" / "A2A" stack that does not exist), `docs/MOBILE_UX_ANALYSIS.md` (a native Flutter app; the real Android app is a Capacitor wrapper), and `docs/TEACHER_CONNECT_SCHEMA.md` + `TEACHER_CONNECT_PUB_SUB.md` + `docs/DATABASE_VERIFICATION_REPORT.md` (Cloud SQL, Pub/Sub, Algolia, none of which are dependencies). `docs/COMMUNICATION_PROTOCOL.md` and `docs/project/sahayakai.md` reference a different AI tool's process and do not apply here.

### Gaps this document fills

There was previously no system overview, no API reference, no Firestore schema matching the code, and no current AI-flow catalog. This document and the code are now the reference for those.

---

## 15. Known issues and technical debt

Flagged during the audit that produced this document. Verify each against current code before acting; some are inferences.

**Correctness bugs:**
- **Mojibake on the localized SEO landing pages.** `src/app/(marketing)/{bn,kn,ta}/page.tsx` have double/triple-encoded UTF-8 in titles, meta, and visible headings; real Bengali/Kannada/Tamil visitors and crawlers see garbled text.
- **Phantom sitemap routes.** `src/app/sitemap.ts` submits about ten URLs (`/faq`, `/hi/*`, several blog slugs) that do not exist as routes; `next.config.ts` even has cache rules for them. They 404.
- **Mocked grounding booked as real.** The `googleSearch` tool is a mock, yet `UsageTracker.trackGrounding` increments and `COST_ANALYSIS.md` books a real per-call cost for instant-answer.

**Security and safety debt:**
- **Prompt-injection gaps** in `avatar-generator` and, with a larger blast radius, `assessment-scanner` (a 20,000-char raw-interpolated answer-key field). Every other free-text flow wraps input; these do not.
- **Admin nav gate is client-weak.** The sidebar admin footer renders for any signed-in user; real authorization is server-side, but the client gate should match.
- **DPDP erasure is incomplete.** Account deletion does not purge community posts/chat or Storage files (documented in code, but real).

**Architecture and drift:**
- **Two intent-classification switch statements** (`agent-router.ts` vs the inline copy in `/api/ai/intent`) and two hand-maintained VIDYA disambiguation blocks can drift. `agent-router.ts::processAgentRequest` is effectively dead code.
- **Dead prompt files.** `src/ai/prompts/*.prompt` are not loaded by Genkit (the dotprompt loader is disabled); the live prompts are inline in each flow. Editing the `.prompt` files has no runtime effect, and at least one already contradicts its live counterpart.
- **AI evals do not gate.** See Section 6.
- **Labs tools have not migrated** to the shared generator shell; they are hand-rolled per-page forms, a visible fault line between `src/features/` and the rest.
- **Duplicate/mock surfaces in production:** `/community-library` renders hardcoded mock data; `/submit-content` and `/review-panel` are "coming soon" stubs.
- **`README.md` is dangerously stale:** it describes a Firebase Functions backend and claims pushing to `main` auto-deploys. A contributor following it could attempt a forbidden raw deploy. It should be rewritten (keep only its Impact Score section).

**Not in this release (staged elsewhere):** the "Hear the Call" demo-call lead magnet (`/try-call`, `/api/demo-call`, behind `DEMO_CALL_ENABLED=false`) lives on a feature branch, not on `main`. Do not document it as live.

---

## 16. Onboarding path (your first week)

1. **Day 1, orientation.** Read Sections 1-4 of this document. Skim [`docs/FABLE5_CRITICAL_REVIEW_2026-07-03.md`](./FABLE5_CRITICAL_REVIEW_2026-07-03.md) and [`docs/EXECUTION_PLAN_2026-07.md`](./EXECUTION_PLAN_2026-07.md) for ground truth and direction.
2. **Day 1-2, run it.** Follow Section 13. Get `npm run dev` and `npm run genkit:dev` working. Create a test account, generate a lesson plan, take attendance.
3. **Day 2-3, trace one request end to end.** Pick lesson-plan. Read `src/middleware.ts`, `src/app/api/ai/lesson-plan/route.ts`, `src/lib/plan-guard.ts`, `src/lib/sidecar/lesson-plan-dispatch.ts`, `src/ai/flows/lesson-plan-generator.ts`. This teaches the whole spine.
4. **Day 3-4, the safety model.** Read `firestore.rules`, `src/lib/db/adapter.ts`, and the fail-open/fail-closed conventions in Section 7.
5. **Day 4-5, your area.** Go deep in the relevant section here and its linked canonical doc.
6. **Before your first deploy.** Read [`AGENTS.md`](../AGENTS.md) and [`DEPLOY.md`](../DEPLOY.md) in full. Understand the dual-region caveat and the no-traffic-then-flip flow. Never run raw `gcloud run deploy`.

---

## Appendix A: Glossary of internal terms

- **Spine / prep spine.** The six core content tools (lesson plan, worksheet, quiz, exam paper, rubric, instant answer) that get the shared generator shell and the deepest investment.
- **Labs.** Parked, de-prioritized tools, hidden behind a code-maintained registry (not a runtime flag), reachable at `/labs`.
- **VIDYA.** The app-wide voice assistant (the OmniOrb). A single-LLM-call intent classifier plus a navigate-and-fill action, not a multi-agent system on the TypeScript side.
- **Sidecar (dispatch).** `src/lib/sidecar/*-dispatch.ts`: the layer that routes each AI flow between in-process Genkit and the external Python "ADK" agent service (`sahayakai-agents`), controlled by per-flow Firestore flags (`off`/`shadow`/`canary`/`full`). Defaults to `off` (Genkit only).
- **`sahayakai-agents`.** The Python ADK agent service (separate repo) that the sidecar dispatch targets. Not in this repository.
- **Voice-call service.** `sahayakai-voice-call` (separate repo): the standalone Exotel streaming voicebot, currently dormant. Do not confuse this with the sidecar-dispatch "sahayakai-agents" service; they are unrelated systems that both sit beside the app.
- **ADK.** The agent framework used by the Python `sahayakai-agents` service.
- **H21, F1-04, C6, etc.** Finding identifiers from the security audits and forensic reviews; you will see them in code comments marking specific fixes.
- **Tranche.** A unit of the July 2026 hardening and redesign program; see [`docs/EXECUTION_PLAN_2026-07.md`](./EXECUTION_PLAN_2026-07.md).
