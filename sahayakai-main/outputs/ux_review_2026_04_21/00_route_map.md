# Route Map — SahayakAI (recon 2026-04-21)

33 pages, 68 API routes. Full list below, grouped.

## Public / Landing
- `/` — home dashboard (post-login: time-of-day greeting, contextual CTAs, input box for topic + tool picker)
- `/pricing` — paid tier comparison (Free vs Pro ₹149/mo)
- `/privacy-for-teachers` — privacy policy

## Auth & Onboarding
- `/onboarding` — 3-step flow (language → profile accordion → aha-moment)
- `/my-profile` — edit own teacher profile
- `/profile/[uid]` — public teacher profile

## AI Content Tools (12 surfaces)
- `/lesson-plan` — flagship; 5E model
- `/quiz` — quiz generator + variants
- `/worksheet` — image-based worksheet wizard
- `/rubric` — assessment rubric
- `/instant-answer` — Q&A with Google Search grounding
- `/exam-paper` — board-aligned previous-year papers
- `/video-storyteller` (route TBD) — YouTube discovery
- `/visual-aid` — image generation
- `/avatar` — teacher avatar image gen
- `/teacher-training` — pedagogy advice
- `/parent-message` — multilingual parent comms (gated: not on free)
- `/virtual-field-trip` — geography

## Classroom
- `/attendance` — class list
- `/attendance/[classId]` — per-class, with Twilio IVR integration

## Libraries & Content
- `/my-library` — own saved content
- `/community/library` — shared content feed
- content submission flow (gated inside community)

## Community (unified)
- `/community` — 3 tabs: Discover / Connect / Chat
- `/messages` — 1:1 DMs (separate from community chat)

## Analytics
- `/impact` — impact dashboard
- `/usage` — quota usage stats
- `/notifications` — notification center

## Settings
- `/settings` — single-page: profile, language, plan, privacy toggles, export, delete account

## Admin/Dev
- `/admin/*` — admin dashboards
- `/playground` — API playground

## API (68 routes) — key groups
- `/api/ai/*` — 16+ AI flow endpoints (streaming variants where applicable)
- `/api/auth/profile-check` — gates onboarding redirect
- `/api/billing/*` — Razorpay subscription create/webhook
- `/api/content/*` — save/list/download
- `/api/tts` — Google Cloud TTS (Neural2/Wavenet/Standard per lang)
- `/api/vidya/*` — OmniOrb assistant
- `/api/assistant` — chat router
- `/api/attendance/*` + Twilio webhooks
- `/api/webhooks/*` — public (Razorpay, Twilio)
- `/api/health`, `/api/analytics` — public

## Middleware
- File: `src/middleware.ts`
- Verifies Firebase ID token via Google public keys (5h cache)
- Token source: `Authorization: Bearer` header OR `auth-token` cookie
- Injects `x-user-id`, `x-user-plan` on valid token
- **Dev bypass**: token value `dev-token` → mock `x-user-id=dev-user-123, x-user-plan=pro` (only in dev mode)
- Unauth on `/api/*` or `/admin/*` → 401
- Unauth on pages → pass through

## Default post-login redirect
- `/` (home). No forced flow after onboarding.
