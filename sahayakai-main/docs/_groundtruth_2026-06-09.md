# SahayakAI — Canonical Ground-Truth Reference

> Generated 2026-06-10 from live source under `sahayakai-main/src/`, `cloudbuild.yaml`,
> `scripts/safe-deploy.sh`, `Dockerfile`, `package.json`. **Derived only from code, not docs/.**
> This is the contract downstream documentation agents must map every claim to.
> Where a fact could not be confirmed it is marked `UNRESOLVED:`.

---

## 1. Routes

App Router pages under `src/app/**`. (`route.ts` API handlers are listed in §3.)

### Teacher tools (AI generation)
- `/lesson-plan` — `src/app/lesson-plan/page.tsx`
- `/quiz-generator` — `src/app/quiz-generator/page.tsx`
- `/exam-paper` — `src/app/exam-paper/page.tsx`
- `/worksheet-wizard` — `src/app/worksheet-wizard/page.tsx`
- `/rubric-generator` — `src/app/rubric-generator/page.tsx`
- `/instant-answer` — `src/app/instant-answer/page.tsx`
- `/visual-aid-creator` — `src/app/visual-aid-creator/page.tsx`
- `/visual-aid-designer` — `src/app/visual-aid-designer/page.tsx` (two visual-aid routes coexist)
- `/video-storyteller` — `src/app/video-storyteller/page.tsx`
- `/virtual-field-trip` — `src/app/virtual-field-trip/page.tsx`
- `/teacher-training` — `src/app/teacher-training/page.tsx`
- `/assess-assignment` — `src/app/assess-assignment/page.tsx`
- `/assessment-scanner` — `src/app/assessment-scanner/page.tsx`
- `/content-creator` — `src/app/content-creator/page.tsx`
- `/review-panel` — `src/app/review-panel/page.tsx`

### Classroom / attendance
- `/attendance` — `src/app/attendance/page.tsx`
- `/attendance/[classId]` — `src/app/attendance/[classId]/page.tsx`
- `/attendance/[classId]/marks` — `src/app/attendance/[classId]/marks/page.tsx`
- `/impact-dashboard` — `src/app/impact-dashboard/page.tsx`

### Community
- `/community` — `src/app/community/page.tsx`
- `/community-library` — `src/app/community-library/page.tsx`
- `/my-library` — `src/app/my-library/page.tsx`
- `/submit-content` — `src/app/submit-content/page.tsx`
- `/profile/[uid]` — `src/app/profile/[uid]/page.tsx`

### Messages
- `/messages` — `src/app/messages/page.tsx`
- `/notifications` — `src/app/notifications/page.tsx`

### Admin / org
- `/admin/cost-dashboard` — `src/app/admin/cost-dashboard/page.tsx`
- `/admin/log-dashboard` — `src/app/admin/log-dashboard/page.tsx`
- `/organization/dashboard` — `src/app/organization/dashboard/page.tsx`

### Auth / onboarding / account
- `/onboarding` — `src/app/onboarding/page.tsx`
- `/my-profile` — `src/app/my-profile/page.tsx`
- `/settings` — `src/app/settings/page.tsx`
- `/usage` — `src/app/usage/page.tsx`
- `/pricing` — `src/app/pricing/page.tsx`
- `/` (landing/dashboard) — `src/app/page.tsx`

### Marketing / public (route group `(marketing)`)
- `/about` — `src/app/(marketing)/about/page.tsx`
- `/for-schools` — `src/app/(marketing)/for-schools/page.tsx`
- `/terms` — `src/app/(marketing)/terms/page.tsx`
- `/privacy-for-teachers` — `src/app/privacy-for-teachers/page.tsx`
- `/bn`, `/kn`, `/ta` — localized landing pages `src/app/(marketing)/{bn,kn,ta}/page.tsx`
- Blog: `/blog/sahayak-ai-kya-hai`, `/blog/sahayakai-vs-chatgpt`, `/blog/sahayakai-vs-diksha` — `src/app/(marketing)/blog/**`

### Dev tools
- `/api-docs` — `src/app/api-docs/page.tsx`
- `/api-playground` — `src/app/api-playground/page.tsx`

NEW/notable: two parallel visual-aid routes (`visual-aid-creator` + `visual-aid-designer`); `assess-assignment` and `assessment-scanner` are distinct features.

---

## 2. AI Flows — `src/ai/flows/*.ts`

**RESOLVED: The default text model is `gemini-2.5-flash`. `gemini-2.0-flash` is NOT used anywhere** — `src/ai/genkit.ts:12-18` explicitly moved off 2.0-flash (free-tier per-minute quota saturation) to `googleai/gemini-2.5-flash`, overridable via `GENKIT_DEFAULT_MODEL` env.

Per-flow model (string proven in code):

| Flow file | Purpose | Model ID |
|---|---|---|
| `lesson-plan-generator.ts` | Lesson plan generation | `googleai/gemini-2.5-flash` (`:130`) |
| `quiz-definitions.ts` / `quiz-generator.ts` | MCQ quiz (3 difficulties in parallel) | `gemini-2.5-flash` (tracked `:136`, via `quizGenerator.prompt`) |
| `exam-paper-generator.ts` | Full exam paper | `gemini-2.5-flash` (`:455`, `examPaperGenerator.prompt`) |
| `worksheet-wizard.ts` | Differentiated worksheets | `gemini-2.5-flash` (`:190`, `worksheetWizard.prompt`) |
| `rubric-generator.ts` | Grading rubric | `gemini-2.5-flash` (`:159`, `rubricGenerator.prompt`) |
| `instant-answer.ts` | Grounded Q&A (Google Search grounding) | `gemini-2.5-flash` (`:182,211`, `instantAnswer.prompt`) |
| `visual-aid-designer.ts` | Visual aid — image + text | **image: `googleai/gemini-3-pro-image-preview` (`:131`)**; text: `googleai/gemini-2.5-flash` (`:177`) |
| `avatar-generator.ts` | Avatar image | `googleai/gemini-2.5-flash-image` (`:52`) |
| `video-storyteller.ts` | Story/video script | `gemini-2.5-flash` (`videoStoryteller.prompt`) |
| `virtual-field-trip.ts` | Virtual field trip | `gemini-2.5-flash` (`:145`, `virtualFieldTrip.prompt`) |
| `teacher-training.ts` | Teacher training content | `gemini-2.5-flash` (`:129`, `teacherTraining.prompt`) |
| `assignment-assessor.ts` | Grade assignments (vision+reasoning) | **`googleai/gemini-2.5-pro` (`:28`, `ASSESSMENT_MODEL`)** |
| `assessment-scanner.ts` | Scan/grade handwritten assessment | `gemini-2.5-flash` (default genkit; no explicit override found) |
| `parent-message-generator.ts` | Draft parent message | `gemini-2.5-flash` (`parentMessage.prompt`) |
| `parent-call-agent.ts` | Live parent-call reply + summary | `gemini-2.5-flash` (`parentCallAgentReply.prompt`, `parentCallSummary.prompt`) |
| `community-persona-message.ts` | AI community persona chat | `gemini-2.5-flash` (`:7`, 150-token cap) |
| `vidya-assistant.ts` | VIDYA voice assistant reply | `googleai/gemini-2.5-flash` (`:413`) |
| `agent-router.ts` / `agent-definitions.ts` | VIDYA intent router (11 intents) | default genkit `gemini-2.5-flash` |
| `voice-to-text.ts` | STT (Sarvam primary, Gemini fallback) | `gemini-2.5-flash` fallback (`:331`) |

Validation companion flows (no separate model claim): `assignment-assessor-validation.ts`, `quiz-definitions-enhanced-validation.ts`, `virtual-field-trip-validation.ts`, `worksheet-validation.ts`.

Evaluators (Genkit eval, `src/ai/evaluators/`): `lesson-plan-alignment.ts` and `quiz-quality.ts` both use `googleai/gemini-2.5-flash`.

Prompt files (`src/ai/prompts/*.prompt`) ALL declare `model: googleai/gemini-2.5-flash`.

**Distinct non-2.5-flash models in the tree:** `gemini-2.5-pro` (assignment grading), `gemini-3-pro-image-preview` (visual-aid image), `gemini-2.5-flash-image` (avatar). Everything else = `gemini-2.5-flash`.

---

## 3. API Handlers — `src/app/api/**/route.ts`

### AI generation (`/api/ai/*`)
- `assess-assignment` — grade assignment images
- `assessment-scanner` — scan handwritten assessment
- `avatar` — generate teacher avatar image
- `exam-paper`, `exam-paper/stream` — exam paper (sync + streaming)
- `instant-answer` — grounded Q&A
- `intent` — classify utterance intent
- `lesson-plan`, `lesson-plan/stream` — lesson plan (sync + streaming)
- `parent-message` — draft parent message (injects Gemini key, recent fix)
- `quiz`, `quiz/health` — quiz generation + health probe (health is public)
- `rubric` — rubric generation
- `teacher-training` — training content
- `video-storyteller` — story/video script
- `virtual-field-trip` — field trip generation
- `visual-aid` — visual aid (image+text)
- `voice-to-text` — STT (Sarvam→Gemini)
- `/api/assistant` — VIDYA orchestrator entry (OmniOrb mic)
- `/api/vidya/profile`, `/api/vidya/session` — VIDYA profile + session state

### Attendance / voice
- `attendance/call` — initiate parent call (Twilio REST or Exotel forward; see §7)
- `attendance/call-context` — context payload for live call
- `attendance/call-summary` — post-call summary
- `attendance/outreach`, `attendance/outreach-latest` — create/list parent_outreach
- `attendance/transcript-sync` — sync call transcript turns
- `attendance/twiml`, `attendance/twiml-status` — Twilio TwiML webhook + status callback (public, no auth header)

### Billing
- `billing/create-subscription`, `billing/create-public-subscription` (anon checkout, public)
- `billing/cancel`, `billing/callback` (Razorpay redirect, public)
- `webhooks/razorpay` — HMAC-verified payment webhook (public)

### Content
- `content/save`, `content/get`, `content/list`, `content/delete`, `content/download`
- `export`, `export/status` — content export jobs
- `migrate-ncert` — NCERT data migration

### Community
- `community/persona-pulse` — AI persona activity loop

### User / auth
- `auth/profile-check` (public, pre-login)
- `user/profile`, `user/consent`, `user/delete-account`
- `profile/mark-complete` — issues profile-complete cookie (≥80% complete)
- `fcm/register` — FCM token registration
- `organizations` (+ `/invite`, `/remove`, `/[orgId]/analytics`)
- `sarkar/verify` — govt teacher verification

### Config / flags
- `config/flags` — read feature flags
- `feature-flags/me` — per-user flag evaluation

### Jobs / cron (`/api/jobs/*` — public, OIDC-validated by Cloud Run/Scheduler)
- `ai-community-agent`, `ai-reactive-reply`, `billing-reconciliation`,
  `community-chat-cleanup`, `daily-briefing`, `edu-news`, `export-reminder`,
  `grow-persona-pool`, `storage-cleanup`

### Analytics
- `analytics/seed`, `analytics/teacher-health/[userId]`
- `teacher-activity`, `performance/batch`, `performance/student/[studentId]`
- `usage`, `metrics` (public web-vitals), `feedback`

### SEO (`/api/seo/*` — public)
- `seo/llms`, `seo/llms-full`, `seo/google-verify`

### Misc
- `health` (public), `tts` (Google Cloud TTS + Sarvam), `geo/reverse`,
  `assessment-scanner/[id]`, `api-docs`

---

## 4. Firestore Collections

Distinct collection names referenced via `collection(`/`.collection(` in `src/`:

```
analytics, assessment_batches, assessments, attendance, billing_monthly_reports,
billing_reconciliation_actions, billing_reconciliation_runs, cached_lesson_plans,
chat, classes, community_chat, community_posts, connection_requests, connections,
consent_log, content, conversations, fcm_tokens, feedback, feedbacks, groups,
invites, library_resources, likes, members, messages, ncert_chapters,
ncert_curriculum, ncert_textbooks, notifications, organizations, parent_outreach,
pendingSignInLinks, posts, rate_limits, records, sarkar_verifications, saves,
shadow_calls, students, subscriptions, system_config, teacher_analytics,
telemetry_events, turns, usageCounters, users, vidya_sessions, webhook_events
```

Note: `feedback` and `feedbacks` both appear (likely legacy + current). `chat`/`turns`/`records`/`members` are subcollection segment names.

### Key collection shapes (from TS interfaces)

**`users/{uid}`** — `UserProfile` (`src/types/index.ts:155`): `uid, email?, phoneNumber?, displayName, photoURL?, schoolName?, schoolNormalized?, district?, pincode?, state?, educationBoard?, preferredBoard?, verifiedStatus?, gradeLevels[], subjects[], preferredLanguage, followersCount, followingCount, createdAt, lastLogin, planType('free'|'pro'|'gold'|'premium'), impactScore, contentSharedCount, badges[], groupIds?, ...`

**`classes/{classId}`** — `ClassRecord` (`src/types/attendance.ts:17`): `id, teacherUid, name, subject, gradeLevel, section?, academicYear, studentCount, createdAt, updatedAt`

**`classes/{classId}/students/{studentId}`** — `Student`: `id, classId, rollNumber, name, parentPhone(E.164), parentLanguage, createdAt, updatedAt`

**`attendance/{classId}/records/{YYYY-MM-DD}`** — `DailyAttendanceRecord`: `classId, date, teacherUid, records(studentId→'present'|'absent'|'late'), submittedAt, isFinalized`

**`parent_outreach/{outreachId}`** — `ParentOutreach` (`src/types/attendance.ts`): `id, teacherUid, classId, className, studentId, studentName, parentPhone, parentLanguage, reason, generatedMessage, deliveryMethod('twilio_call'|'whatsapp_copy'), subject?, teacherName?, schoolName?, callSid?, callStatus?, transcript?(TranscriptTurn[]), callSummary?(CallSummary), voicePipelineMode?('streaming'|'batch'), performanceContext?, createdAt, updatedAt`

**`messages/{id}`** (under conversations) — `Message` (`src/types/messages.ts:31`): `id, type('text'|'resource'|'audio'), text, senderId, senderName, senderPhotoURL, resource?, audioUrl?, audioDuration?, readBy[], createdAt, clientMessageId?, deliveryStatus?, deliveredTo?, mediaStatus?`

**`conversations/{id}`** — `Conversation`: `id, type('direct'|'group'), participantIds[], participants{}, name?, lastMessage, lastMessageAt, lastMessageSenderId, unreadCount{}`

**`connections/{pairId}`** — `Connection` (`src/types/index.ts:419`): `id(sorted {uid1}_{uid2}), uids[2], initiatedBy, connectedAt`. **`connection_requests/{fromUid}_{toUid}`** — `ConnectionRequest`: `id, fromUid, toUid, createdAt, expiresAt(30d)`

**`organizations/{id}`** — `Organization` (`src/lib/organization.ts:16`): `id, name, type('school'|'chain'|'government'), adminUserId, plan('gold'|'premium'), subscriptionId?, totalSeats, usedSeats, createdAt, updatedAt`. Members → `OrgMember`, invites → `OrgInvite`.

**`system_config/feature_flags`** — `FeatureFlagsConfig` (see §5).

---

## 5. Feature Flags

**RESOLVED: Flags live in Firestore at document `system_config/feature_flags`** (`src/lib/feature-flags.ts:4,317`). Read server-side via `readConfig()`/`getFeatureFlags()` with a 5-min in-memory cache, deduped in-flight fetch, and a safe `FALLBACK_CONFIG` when Firestore is unreachable. **There is ALSO an env-var component:** `ONBOARDING_GATE_ENABLED` and `APP_CHECK_REQUIRED` are read from `process.env` in middleware, and sidecar enforcement uses env (`SAHAYAKAI_REQUIRE_APP_CHECK`, `VOICE_PROVIDER`, etc.). So: **agent sidecar dispatch + billing flags = Firestore; infra gates = env vars.** Seed/update via `src/scripts/seed-feature-flags.ts` and `src/scripts/update-flags.ts`.

### Global flags + defaults (FALLBACK_CONFIG)
| Flag | Fallback default | Meaning |
|---|---|---|
| `billingKillSwitch` | `true` | If true, ALL plan checks return "free" (everything free) |
| `maintenanceMode` | `false` | Show maintenance banner, skip billing |
| `maintenanceMessage` | `''` | Banner text |
| `subscriptionEnabled` | `false` | Subscription system live |
| `subscriptionRolloutPercent` | `0` | 0-100 hash-bucketed rollout |
| `subscriptionAllowlist` | `[]` | UIDs always on subscription |
| `consentNoticeEnabled` | `false` | TwiML plays DPDP consent prologue (off until 11-lang translations land) |
| `features` | `{}` | Per-feature `{enabled, allowlist?, blocklist?}` map; unlisted features default ON |

### Sidecar dispatch modes (`off`/`shadow`/`canary`/`full`)
Defined in `src/lib/feature-flags.ts:40-91`. Semantics:
- `off` — Genkit only (default). Sidecar untouched even if deployed.
- `shadow` — Genkit serves; sidecar called fire-and-forget for parity scoring; output ignored.
- `canary` — Sidecar serves; Genkit fallback on any sidecar error/timeout.
- `full` — Sidecar serves; same fallbacks as canary; percent treated as 100.

Each agent has a `<agent>SidecarMode` + `<agent>SidecarPercent` pair. **All default to `off` / `0` in FALLBACK_CONFIG.** Bucketing: parent-call on `callSid`; everything else on teacher `uid`.

### Agents wired to sidecar flags (mode+percent pairs)
Original three: `parentCall`, `lessonPlan`, `vidya`. Phase J.5 cohort (12 migrated from env→Firestore) + 2 more:
`quiz, examPaper, visualAid, worksheet, rubric, teacherTraining, virtualFieldTrip, instantAnswer, parentMessage, videoStoryteller, avatar, voiceToText, assessmentScanner, communityPersonaMessage, assignmentAssessor`.

Total 17 dispatchers exist in `src/lib/sidecar/*-dispatch.ts` (matches: assessment-scanner, assignment-assessor, avatar-generator, community-persona-message, exam-paper, instant-answer, lesson-plan, parent-message, quiz, rubric, teacher-training, video-storyteller, vidya, virtual-field-trip, visual-aid, voice-to-text, worksheet). Parent-call dispatch is in `dispatch.ts`.

---

## 6. Auth / Middleware (`src/middleware.ts`)

- **Canonical host redirect**: bare `sahayakai.com` → `https://www.sahayakai.com` (308), skips `/api/*` and `/__/*`; clears `:8080` Cloud Run internal port from redirect target.
- **Header stripping (P0 security)**: deletes client-supplied `x-user-id`, `x-user-plan`, `x-user-email`, `x-user-name` on EVERY request before any branch — only post-verify code may set them.
- **ID token verification**: resolves token from `Authorization: Bearer` (API) or `auth-token` cookie (pages/server actions). Verifies via `jose` against Google's cached x509 certs (5h TTL), checking `issuer=securetoken.google.com/sahayakai-b4248`, `audience=sahayakai-b4248`. On success injects `x-user-id`(sub), `x-user-email`, `x-user-name`, `x-user-plan` (normalized: legacy `institution`→`premium`; valid free/pro/gold/premium else free), and `x-onboarding-completed=1` if claim present.
- **App Check**: when `APP_CHECK_REQUIRED==='true'`, verifies `X-Firebase-AppCheck` JWT against `firebaseappcheck.googleapis.com/v1/jwks`; strict mode rejects missing token on `/api/ai/*`; on success sets `x-app-check-app`. Tolerant when env not set.
- **Project ID**: `sahayakai-b4248`, project number `640589855975`.
- **Public APIs (skip auth)**: `/api/health`, `/api/ai/quiz/health`, `/api-docs`, `/api/metrics`, `/api/auth/*`, `/api/attendance/twiml*`, `/api/jobs/*` (OIDC), `/api/webhooks/*` (HMAC), `/api/billing/callback`, `/api/billing/create-public-subscription`, `/api/seo/*`.
- **401 not 500**: invalid/missing token on API/admin routes OR a non-API page POST (server action) returns 401. Page GETs without token pass through.
- **Dev bypass**: `rawToken==='dev-token'` (or no token in dev) injects `dev-user-123`/`pro`.
- **Onboarding gate**: gated behind `ONBOARDING_GATE_ENABLED==='true'` — **currently DEFAULT-OFF** (incident 2026-06-08 locked out entire base). When on, authenticated page GETs without valid `PROFILE_COMPLETE_COOKIE` (verified via `verifyProfileCompleteCookie`) or `onboardingCompleted` claim → redirect to `/onboarding`, with an allowlist.
- **Security headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (mic=self only), HSTS in prod; per-request CSP nonce in `x-nonce`.

---

## 7. Telephony

**RESOLVED: BOTH Twilio and Exotel are wired; selected at runtime by the `VOICE_PROVIDER` env var, defaulting to `twilio`.** (`src/app/api/attendance/call/route.ts:75`).

- **Twilio (default path)**: `/api/attendance/call` calls the Twilio REST API directly (NO `twilio` npm package — uses fetch with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`; returns 503 if unset). Conversational call driven by TwiML webhooks `/api/attendance/twiml` + `/twiml-status`. `TWILIO_LANGUAGE_MAP` (`src/types/attendance.ts`) maps languages to Twilio voices. E.164 validation in `src/lib/twilio-validate.ts`. `parent-call-agent.ts` generates the live replies/summary within Twilio's 15s webhook budget.
- **Exotel (opt-in)**: `VOICE_PROVIDER=exotel` makes the route `forwardToExotel()` — POSTs to `VOICE_EXOTEL_CALL_URL` (e.g. `https://sahayakai-voice-call-xxxx.a.run.app/api/exotel/call`), the **separate `sahayakai-voice-call` repo** running a WebSocket streaming voicebot (Sarvam STT/TTS + Gemini, 11 langs). `ParentOutreach.voicePipelineMode` records `'streaming'` (Pipecat/Exotel) vs `'batch'` (Twilio Gather/Say).

So: in THIS repo's prod default, attendance calls go via **Twilio batch TwiML**; Exotel streaming is the opt-in path delegated to an external Cloud Run service.

---

## 8. AI Sidecar (ADK-Python)

**YES — an external ADK-Python sidecar exists and is called from `src/lib/sidecar/`.**

- **Base URL env**: `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` (`src/lib/sidecar/parent-call-client.ts:101`). Parent-call endpoint: `${baseUrl}/v1/parent-call/reply`. Throws `SidecarConfigError` if unset.
- **Dispatchers**: 17 `*-dispatch.ts` files in `src/lib/sidecar/` + parent-call in `dispatch.ts`. Each unifies the Genkit path + sidecar path under one entry, gated by the Firestore `<agent>SidecarMode`/`Percent` flags (§5). `dispatch.ts` runs shadow mode by calling Genkit + sidecar in parallel (`Promise.all`) and recording latency/error.
- **Gating**: Firestore feature flags decide off/shadow/canary/full per agent; **all default `off`**, so by default everything is pure Genkit and the sidecar is untouched.
- **Auth to sidecar**: App Check token minting (`app-check-mint.ts`) + HMAC signing (`signing.ts`); sidecar enforces via its own `SAHAYAKAI_REQUIRE_APP_CHECK` env.
- **Timeout**: `with-timeout.ts` `FALLBACK_TIMEOUT_MS=60_000`.
- Shadow-diff persistence: `shadow-diff-writer.ts`, `canary-shadow-diff.ts`; generated types in `types.generated.ts`.

UNRESOLVED: the ADK-Python service source is NOT in this repo (lives in `sahayakai-agents/` per repo siblings). The wiring/contract here is complete, but the deployed sidecar URL/availability cannot be confirmed from `src/`.

---

## 9. Deployment

- **Cloud Run service**: `sahayakai-hotfix-resilience` (`cloudbuild.yaml` substitution `_SERVICE`, `scripts/safe-deploy.sh:45`).
- **Region**: `asia-southeast1`. **Project**: `sahayakai-b4248` (project number `640589855975`).
- **Image**: `asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/sahayakai-hotfix-resilience:{$SHORT_SHA,latest}`.
- **Trigger**: Cloud Build GitHub trigger `sahayakai-main-deploy` on `git push origin main` (build context `dir: sahayakai-main`).
- **`--no-traffic` by default**: new revision built+warm but NOT auto-routed; operator flips via `gcloud run services update-traffic ... --to-latest`. Prevents parallel-deploy races. `scripts/safe-deploy.sh` adds guards: aborts on in-flight build, on a revision created <90s ago, and on dirty tree.
- **Baked at build (Dockerfile ARG→ENV)**: `NEXT_PUBLIC_FIREBASE_*` config (incl. hardcoded default `NEXT_PUBLIC_FIREBASE_VAPID_KEY`), `SENTRY_AUTH_TOKEN`, `GIT_SHA`/`GIT_SHA_FULL`/`BUILD_ID`. Runtime: `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_OPTIONS=--max-old-space-size=4096`. **Model IDs are NOT baked into the Dockerfile** — `GENKIT_DEFAULT_MODEL` defaults in code to `googleai/gemini-2.5-flash`; API keys come from Secret Manager (`GOOGLE_GENAI_API_KEY` pool) at runtime.

UNRESOLVED: Whether `VOICE_PROVIDER`, `APP_CHECK_REQUIRED`, `ONBOARDING_GATE_ENABLED`, `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` are set on the running Cloud Run revision — these are runtime env, not in the repo. Code defaults: `VOICE_PROVIDER=twilio`, gate OFF.

---

## 10. Tech Stack

From `package.json`:
- **Next.js** `^15.5.11` (App Router), **React** `^18.3.1` / react-dom `^18.3.1`.
- **Genkit** `^1.28.0` (`genkit`, `genkit-cli`) + plugins `@genkit-ai/googleai`, `@genkit-ai/firebase`, `@genkit-ai/next` (all `^1.28.0`). Central instance `src/ai/genkit.ts`.
- **Firebase**: client `firebase ^11.9.1`; admin `firebase-admin ^13.4.0`.
- **PWA**: `next-pwa ^5.6.0`. Theming `next-themes`. Forms `react-hook-form`, `react-day-picker`, `react-markdown`.
- **Payments**: `razorpay ^2.9.6` (HMAC-verified webhooks at `/api/webhooks/razorpay`). No Stripe.
- **Telephony**: Twilio via REST (no SDK dep); Exotel via external service.

### AI / inference
- **LLM**: Google Gemini via Genkit `googleai` plugin. Default `gemini-2.5-flash`; also `gemini-2.5-pro` (grading), `gemini-3-pro-image-preview` (visual-aid image), `gemini-2.5-flash-image` (avatar). API keys: comma-separated pool from Secret Manager `GOOGLE_GENAI_API_KEY` with failover/backoff (`runResiliently`, `src/ai/genkit.ts`).
- **Grounding**: Google Search grounding used by Instant Answer (live facts); removed from lesson plan for cost.

### TTS (`src/app/api/tts/route.ts`, `src/lib/sarvam.ts`)
Two providers:
- **Google Cloud Text-to-Speech** — tier priority Neural2 > Wavenet > Standard:
  - `hi-IN`, `en-IN` → Neural2-A (female)
  - `bn-IN`, `ta-IN`, `kn-IN`, `ml-IN`, `gu-IN`, `pa-IN` → Wavenet-A
  - `te-IN` → Standard-A (no Wavenet/Neural2 for Telugu)
  - `mr-IN` → Standard-A; unsupported langs (e.g. Odia) fall back to `hi-IN-Standard-A` (phonetic approximation).
- **Sarvam AI** — primary path for Indian-language **STT** (Saaras v3) in `/api/ai/voice-to-text` (cheaper, purpose-built; only accepts mpeg/mp3/wav, falls back to Gemini for webm/opus). Also `sarvamTTS` available in the TTS route. The external streaming voicebot (Exotel path) uses Sarvam STT/TTS across 11 langs.

### Languages
11 Indic languages supported (hi, en, bn, ta, kn, ml, gu, pa, te, mr, + Odia fallback). UI is language-neutral / icon-driven.

---

## Resolved contradictions (summary)
1. **Model version**: `gemini-2.5-flash` everywhere by default; `gemini-2.0-flash` deliberately removed. Exceptions: `2.5-pro` (assignment grading), `gemini-3-pro-image-preview` (visual-aid image), `gemini-2.5-flash-image` (avatar).
2. **Telephony**: Twilio (REST, default) + Exotel (opt-in via `VOICE_PROVIDER=exotel`, external `sahayakai-voice-call` service). Not one-or-the-other — runtime switch.
3. **Feature flags**: primarily **Firestore `system_config/feature_flags`** (billing, all 17 agent sidecar modes); infra gates (`ONBOARDING_GATE_ENABLED`, `APP_CHECK_REQUIRED`, `VOICE_PROVIDER`, `SAHAYAKAI_REQUIRE_APP_CHECK`) are **env vars**.

## Open UNRESOLVED items
- ADK-Python sidecar source not in this repo (`sahayakai-agents/`); deployed URL/availability unverifiable from `src/`.
- Runtime env values on the live Cloud Run revision (`VOICE_PROVIDER`, `APP_CHECK_REQUIRED`, `ONBOARDING_GATE_ENABLED`, `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`, `GENKIT_DEFAULT_MODEL`) not confirmable from code — code defaults documented above.
- `feedback` vs `feedbacks` collections both present — likely legacy duplication; not confirmed which is canonical.
- `assessment-scanner.ts` and `community-persona-message.ts`/`agent-router.ts` have no explicit inline `model:` — they inherit the genkit default `gemini-2.5-flash` (asserted, not an explicit per-flow string).
