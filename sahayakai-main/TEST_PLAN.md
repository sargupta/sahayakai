# SahayakAI — Comprehensive E2E Test Plan

> **Goal**: Exhaustive testing of every page, API, component, and feature with all meaningful permutations.
> **Framework**: Jest (unit/integration) + Playwright (E2E) — Playwright to be added
> **Estimated API calls**: ~1,800–2,200 for full practical coverage

---

## Table of Contents

1. [Test Infrastructure Setup](#1-test-infrastructure-setup)
2. [Layer 1 — Unit Tests (Lib & Utilities)](#2-layer-1--unit-tests)
3. [Layer 2 — API Contract Tests](#3-layer-2--api-contract-tests)
4. [Layer 3 — Component Tests](#4-layer-3--component-tests)
5. [Layer 4 — Page Integration Tests](#5-layer-4--page-integration-tests)
6. [Layer 5 — E2E User Journeys (Playwright)](#6-layer-5--e2e-user-journeys)
7. [Test Matrix — Permutation Tables](#7-test-matrix--permutation-tables)
8. [Execution Summary & Call Counts](#8-execution-summary)

---

## 1. Test Infrastructure Setup

### 1.1 New Dependencies Needed

```bash
npm i -D playwright @playwright/test msw@latest  # E2E + API mocking
```

### 1.2 Files to Create

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright config (3 viewports, base URL) |
| `src/__tests__/setup/mock-auth.ts` | Firebase auth mock (authenticated / unauthenticated / expired) |
| `src/__tests__/setup/mock-firestore.ts` | Firestore mock with seed data |
| `src/__tests__/setup/mock-genkit.ts` | Gemini/Genkit mock (deterministic AI responses) |
| `src/__tests__/setup/mock-tts.ts` | Google TTS mock (returns stub audio buffer) |
| `src/__tests__/setup/mock-twilio.ts` | Twilio mock (call initiation + callbacks) |
| `src/__tests__/setup/mock-youtube.ts` | YouTube API mock (canned video results) |
| `src/__tests__/setup/test-fixtures.ts` | Shared test data (users, classes, content) |
| `src/__tests__/setup/msw-handlers.ts` | MSW request handlers for external services |

### 1.3 Auth States (used across ALL test layers)

| State | Token | `x-user-id` | Description |
|-------|-------|-------------|-------------|
| `authenticated` | Valid Firebase ID token | `test-uid-001` | Normal teacher user |
| `unauthenticated` | None | None | Not logged in |
| `expired` | Expired token | None | Session timeout |
| `admin` | Valid token + admin flag | `admin-uid-001` | Admin user (for admin pages) |

### 1.4 Test Data Fixtures

```typescript
// src/__tests__/setup/test-fixtures.ts
export const TEST_TEACHER = {
  uid: 'test-uid-001',
  displayName: 'Test Teacher',
  email: 'test@sahayakai.com',
  grade: 'Class 5',
  subject: 'Mathematics',
  language: 'hi',
  board: 'CBSE',
  state: 'Karnataka',
  resourceLevel: 'medium',
};

export const GRADES = ['Nursery','LKG','UKG','Class 1','Class 2','Class 3','Class 4',
  'Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'];

export const SUBJECTS = ['Mathematics','Science','English','Hindi','Social Studies',
  'Environmental Studies','Physics','Chemistry','Biology','History','Geography',
  'Economics','Computer Science','Sanskrit','Kannada'];

export const LANGUAGES = ['en','hi','kn','ta','te','ml','gu','pa','bn','mr','or'];

export const RESOURCE_LEVELS = ['low','medium','high'];

// Priority matrix: test these combos first (covers 80% of real usage)
export const PRIORITY_MATRIX = {
  grades: ['Class 3','Class 5','Class 8','Class 10'],     // primary, upper-primary, middle, secondary
  subjects: ['Mathematics','Science','English','Hindi'],    // top 4 by usage
  languages: ['en','hi','kn'],                              // top 3 by usage
  resourceLevels: ['low','medium'] as const,                // most common
};
```

---

## 2. Layer 1 — Unit Tests

**Scope**: Pure functions, utilities, validators, type guards
**Mocking**: None (or minimal)
**API calls**: 0

### 2.1 Existing Tests (keep & expand)

| File | Status | Notes |
|------|--------|-------|
| `lib/utils.test.ts` | EXISTS | Expand edge cases |
| `lib/safety.test.ts` | EXISTS | Add XSS, injection vectors |
| `lib/logger.test.ts` | EXISTS | OK |
| `lib/errors.test.ts` | EXISTS | OK |
| `lib/grade-utils.test.ts` | EXISTS | Add all 15 grades |
| `lib/indian-context.test.ts` | EXISTS | Add all states/boards |
| `lib/config.test.ts` | EXISTS | OK |
| `data/ncert.test.ts` | EXISTS | OK |

### 2.2 New Unit Tests Needed

| Test File | Module Under Test | Test Cases | Count |
|-----------|-------------------|------------|-------|
| `lib/tts.test.ts` | TTS client | Language→voice mapping for all 11 languages, cache key generation, error handling | 15 |
| `lib/usage-tracker.test.ts` | Usage tracker | Increment, check limit, reset, per-feature limits | 10 |
| `lib/server-safety.test.ts` | Rate limiter | Rate exceeded, rate OK, sliding window, per-user isolation | 8 |
| `lib/analytics-events.test.ts` | Event taxonomy | All event types validate, unknown event rejected | 6 |
| `lib/analytics-consent.test.ts` | Consent manager | Grant, revoke, check, persist | 5 |
| `lib/analytics/impact-model.test.ts` | Impact calc | Score boundaries, zero input, max input | 6 |
| `lib/analytics/impact-score.test.ts` | Score computation | Weighted average, missing fields, edge cases | 5 |
| `lib/indexed-db.test.ts` | IndexedDB helpers | Get/set/delete/clear, quota exceeded | 6 |
| `lib/performance-monitor.test.ts` | Perf monitor | Mark, measure, report | 4 |
| `lib/youtube.test.ts` | YouTube client | Search, channel filter, error handling | 5 |
| `lib/youtube-rss.test.ts` | RSS parser | Parse valid feed, malformed feed, empty feed | 4 |
| `lib/curated-videos.test.ts` | Curated list | All entries have required fields, no broken references | 3 |
| `lib/db/adapter.test.ts` | DB adapter | EXISTS — expand CRUD, batch ops, error paths | 8 |
| `lib/services/cost-service.test.ts` | Cost tracker | Log cost, aggregate, per-feature breakdown | 5 |
| `lib/services/log-service.test.ts` | Log query | Filter by date, level, feature | 5 |
| `lib/services/certification-service.test.ts` | Cert tracker | Progress calc, completion, partial | 4 |
| `lib/teacher-activity-tracker.test.ts` | Activity tracker | Record activity, streak calc, inactive detection | 5 |
| `lib/get-auth-token.test.ts` | Token helper | Token present, absent, expired | 3 |
| `lib/auth-utils.test.ts` | Auth utils | Validate, decode, role check | 4 |
| `types/index.test.ts` | Type guards | Validate all enums/types, reject invalid | 10 |

**Layer 1 Total: ~150 test cases, 0 API calls**

---

## 3. Layer 2 — API Contract Tests

**Scope**: Every API route — request validation, auth check, response shape, error codes
**Mocking**: Genkit (AI), Firestore, TTS, Twilio, YouTube — all mocked
**API calls**: 0 real calls (all mocked), but each test simulates 1 call

### 3.1 Existing Contract Tests (keep & expand)

| Test | Status |
|------|--------|
| `api/lesson-plan.contract.test.ts` | EXISTS |
| `api/quiz.contract.test.ts` | EXISTS |
| `api/virtual-field-trip.contract.test.ts` | EXISTS |
| `api/worksheet.contract.test.ts` | EXISTS |

### 3.2 Full API Contract Test Matrix

#### 3.2.1 AI Generation Endpoints (13 routes)

Each AI endpoint gets the same test structure:

```
For each AI endpoint:
  ✅ Returns 200 with valid input + auth
  ✅ Returns 401 without auth token
  ✅ Returns 401 with expired token
  ✅ Returns 400 with missing required fields
  ✅ Returns 400 with invalid grade
  ✅ Returns 400 with invalid subject
  ✅ Returns 400 with invalid language
  ✅ Returns 429 when rate limited
  ✅ Returns 500 when AI service fails (Genkit error)
  ✅ Response matches expected schema (Zod validation)
  ✅ x-user-id header is set in downstream call
  ✅ Cost tracking is called
  ✅ Telemetry event is logged
```

| Endpoint | File to Create | Tests |
|----------|---------------|-------|
| `POST /api/ai/instant-answer` | `api/instant-answer.contract.test.ts` | 13 |
| `POST /api/ai/lesson-plan` | Expand existing | +9 |
| `POST /api/ai/quiz` | Expand existing | +9 |
| `POST /api/ai/rubric` | `api/rubric.contract.test.ts` | 13 |
| `POST /api/ai/teacher-training` | `api/teacher-training.contract.test.ts` | 13 |
| `POST /api/ai/virtual-field-trip` | Expand existing | +9 |
| `POST /api/ai/worksheet` | Expand existing | +9 |
| `POST /api/ai/avatar` | `api/avatar.contract.test.ts` | 13 |
| `POST /api/ai/visual-aid` | `api/visual-aid.contract.test.ts` | 13 |
| `POST /api/ai/video-storyteller` | `api/video-storyteller.contract.test.ts` | 13 |
| `POST /api/ai/voice-to-text` | `api/voice-to-text.contract.test.ts` | 13 |
| `POST /api/ai/parent-message` | `api/parent-message.contract.test.ts` | 13 |
| `POST /api/ai/intent` | `api/intent.contract.test.ts` | 13 |

**AI endpoint subtotal: 13 × 13 = 169 tests**

#### 3.2.2 AI Endpoints — Permutation Tests (Priority Matrix)

For the 4 most-used AI endpoints (lesson-plan, quiz, worksheet, instant-answer), test the priority matrix:

```
4 grades × 4 subjects × 3 languages × 2 resource levels = 96 combos per endpoint
4 endpoints × 96 = 384 parameterized tests
```

| Endpoint | Params | Tests |
|----------|--------|-------|
| `lesson-plan` | grade × subject × lang × resourceLevel | 96 |
| `quiz` | grade × subject × lang × resourceLevel | 96 |
| `worksheet` | grade × subject × lang × resourceLevel | 96 |
| `instant-answer` | grade × subject × lang × resourceLevel | 96 |

**Permutation subtotal: 384 tests**

#### 3.2.3 Content CRUD (5 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `POST /api/content/save` | 10 | Auth ×3, valid save, duplicate, invalid type, missing fields, oversize, schema validation, telemetry |
| `POST /api/content/delete` | 8 | Auth ×3, own content, others' content (403), not found, already deleted, telemetry |
| `POST /api/content/list` | 8 | Auth ×3, empty list, pagination, type filter, sort order, telemetry |
| `POST /api/content/get` | 7 | Auth ×3, found, not found, deleted content, telemetry |
| `POST /api/content/download` | 7 | Auth ×3, valid download, not found, format conversion, telemetry |

**Content subtotal: 40 tests**

#### 3.2.4 User/Auth (3 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `GET /api/user/profile` | 6 | Auth ×3, found, not found, telemetry |
| `POST /api/user/profile` | 8 | Auth ×3, valid update, partial update, invalid fields, oversize bio, telemetry |
| `POST /api/auth/profile-check` | 5 | Auth ×3, profile exists, profile missing |

**User/Auth subtotal: 19 tests**

#### 3.2.5 Attendance/Twilio (4 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `POST /api/attendance/call` | 10 | Auth ×3, valid call, invalid phone, Twilio error, 7 languages, telemetry |
| `POST /api/attendance/outreach` | 8 | Auth ×3, batch call, empty list, partial failure, rate limit, telemetry |
| `GET /api/attendance/twiml` | 5 | Valid callback, invalid signature, missing params, language param, status |
| `POST /api/attendance/twiml-status` | 5 | Completed, failed, busy, no-answer, invalid signature |

**Attendance subtotal: 28 tests**

#### 3.2.6 VIDYA Assistant (3 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `POST /api/assistant` | 12 | Auth ×3, text query, voice query, intent routing (×5 intents), context-aware, cache hit, cache miss |
| `GET /api/vidya/profile` | 5 | Auth ×3, profile found, not found |
| `POST /api/vidya/session` | 7 | Auth ×3, create session, resume session, session expired, telemetry |

**VIDYA subtotal: 24 tests**

#### 3.2.7 TTS (1 route)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `POST /api/tts` | 16 | Auth ×3, 11 languages (correct voice tier per language), empty text, oversize text, cache hit |

**TTS subtotal: 16 tests**

#### 3.2.8 Analytics/Admin (5 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `GET /api/health` | 3 | Returns 200, includes version, includes uptime |
| `GET /api/metrics` | 4 | Auth ×3, returns valid metrics object |
| `POST /api/feedback` | 6 | Auth ×3, valid feedback, missing fields, telemetry |
| `POST /api/teacher-activity` | 5 | Auth ×3, valid activity, invalid event type |
| `GET /api/analytics/teacher-health/[userId]` | 6 | Auth ×3, valid user, not found, admin-only check |
| `POST /api/analytics/seed` | 4 | Auth check, admin-only, seed completes, idempotent |
| `POST /api/migrate-ncert` | 4 | Auth check, admin-only, migration runs, idempotent |

**Admin subtotal: 32 tests**

#### 3.2.9 Jobs (2 routes)

| Endpoint | Tests | Cases |
|----------|-------|-------|
| `POST /api/jobs/storage-cleanup` | 5 | Auth/cron check, runs cleanup, nothing to clean, error handling, telemetry |
| `POST /api/jobs/community-chat-cleanup` | 5 | Auth/cron check, runs cleanup, nothing to clean, error handling, telemetry |

**Jobs subtotal: 10 tests**

### Layer 2 Total: 722 tests, 0 real API calls (all mocked)

---

## 4. Layer 3 — Component Tests

**Scope**: React component rendering, user interaction, state management
**Framework**: Jest + React Testing Library
**API calls**: 0 (all mocked)

### 4.1 Existing Component Tests (keep)

| Test | Status |
|------|--------|
| `components/feedback-dialog.test.tsx` | EXISTS |
| `components/lesson-plan/lesson-plan-input-section.test.tsx` | EXISTS |
| `components/ui/*.test.tsx` (11 files) | EXISTS |
| `hooks/use-toast.test.ts` | EXISTS |
| `hooks/use-lesson-plan.test.ts` | EXISTS |

### 4.2 New Component Tests

#### Auth Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `AuthGuard` | 4 | Renders children when authed, redirects when not, shows loading, handles expired |
| `SignInForm` | 5 | Renders form, Google OAuth click, email/password submit, validation errors, loading state |
| `SignUpForm` | 5 | Renders form, submit, validation, duplicate email error, loading |

#### Community Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `CommunityPage` (3 tabs) | 6 | Renders all 3 tabs, tab switching, active tab styling, URL sync |
| `DiscoverTab` | 7 | Renders trending, type filter chips work, teacher strip renders, voice search toggle, empty state, loading skeleton, error state |
| `ConnectTab` | 6 | Renders teacher list, search filter, send connection request, pending state, connected state, empty state |
| `ChatTab` | 8 | Renders messages, send text message, send voice message, scroll to bottom, message timestamp, delete own message, empty state, loading |
| `CreatePostDialog` | 5 | Opens on FAB click, form validation, submit post, cancel, loading state |
| `TeacherStrip` | 3 | Renders teachers, horizontal scroll, click navigates to profile |

#### Lesson Plan Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `LessonPlanOutput` | 5 | Renders 5E sections, download PDF, copy to clipboard, share, empty state |
| `LessonPlanForm` | Expand existing | +3 (all grade/subject combos validate) |

#### Messages Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `MessageThread` | 8 | Render messages, send text, send voice (MediaRecorder mock), receive message, audio playback, resource message, timestamp formatting, empty thread |
| `ConversationList` | 5 | Render list, unread badge, last message preview, click opens thread, empty state |
| `VoiceRecorder` | 6 | Start recording, stop recording, cancel, audio preview, duration display, upload progress |

#### Profile Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `ProfileEditor` | 7 | Render form, update name, update grade/subject, update language, update avatar, validation errors, save success |
| `ProfileCard` | 4 | Render card, connection status badge, verified badge, click navigates |
| `PublicProfile` | 5 | Render profile, connect button, disconnect, message button, resource count |

#### Content Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `ContentGallery` | 6 | Render grid, filter by type, sort, pagination, empty state, loading |
| `ContentCard` | 5 | Render card, like toggle, save toggle, share, download |
| `ContentViewer` | 4 | Render content, PDF export, print, close |

#### AI Feature Components (one per page)
| Component | Tests | Cases |
|-----------|-------|-------|
| `QuizGenerator` | 6 | Form render, generate quiz, display results, export, regenerate, error state |
| `RubricGenerator` | 5 | Form, generate, display, export, error |
| `WorksheetWizard` | 5 | Form, generate, display, export, error |
| `InstantAnswer` | 5 | Input, submit, display answer, voice input, error |
| `VisualAidCreator` | 5 | Form, generate image, display, download, error |
| `VisualAidDesigner` | 5 | Form, generate, display, download, error |
| `VirtualFieldTrip` | 5 | Form, generate, display, share, error |
| `TeacherTraining` | 5 | Form, generate, display, certificate, error |
| `VideoStoryteller` | 6 | Search, display results, filter, play video, recommendation tier display, error |
| `ContentCreator` | 5 | Form, generate, preview, save, error |
| `ParentMessage` | 5 | Form, generate, copy, translate, error |

#### Navigation & Layout
| Component | Tests | Cases |
|-----------|-------|-------|
| `OmniOrb` (VIDYA) | 7 | Render floating orb, click opens, voice input, text input, send query, close, screen-aware context |
| `Navbar` | 4 | Render nav, active link highlight, mobile menu toggle, user avatar |
| `Sidebar` | 4 | Render menu items, collapse/expand, active item, mobile overlay |
| `NotificationBell` | 4 | Render bell, unread count badge, click opens dropdown, mark as read |

#### Attendance Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `ClassManager` | 6 | Create class, edit class, delete class, add student, remove student, validation |
| `AttendanceMarker` | 6 | Render roster, mark present/absent, submit, date picker, summary stats, undo |
| `ParentOutreachForm` | 5 | Select absent students, initiate call, language selection, status display, error |

#### Admin Components
| Component | Tests | Cases |
|-----------|-------|-------|
| `CostDashboard` | 4 | Render charts, date filter, feature breakdown, export |
| `LogDashboard` | 4 | Render logs, level filter, search, pagination |

### Layer 3 Total: ~258 test cases, 0 API calls

---

## 5. Layer 4 — Page Integration Tests

**Scope**: Full page render with mocked APIs — tests data fetching, auth guards, routing
**Framework**: Jest + React Testing Library
**API calls**: 0 (MSW intercepts all)

### 5.1 Per-Page Test Matrix

Each page is tested across: **3 auth states × 3 viewports**

Viewports: `mobile (375px)`, `tablet (768px)`, `desktop (1280px)`

| Page | Auth States | Viewport Tests | Feature-Specific | Total |
|------|------------|----------------|-----------------|-------|
| `/` (home) | 3 | 3 | Redirect logic (onboarded vs not) | 9 |
| `/onboarding` | 3 | 3 | Multi-step wizard, all 11 languages, grade picker | 12 |
| `/lesson-plan` | 3 | 3 | Full generation flow, 5E display | 10 |
| `/quiz-generator` | 3 | 3 | Generate + display + export | 10 |
| `/worksheet-wizard` | 3 | 3 | Generate + display + export | 10 |
| `/rubric-generator` | 3 | 3 | Generate + display | 9 |
| `/instant-answer` | 3 | 3 | Query + voice + answer | 10 |
| `/visual-aid-creator` | 3 | 3 | Generate image + download | 9 |
| `/visual-aid-designer` | 3 | 3 | Generate + download | 9 |
| `/virtual-field-trip` | 3 | 3 | Generate + display | 9 |
| `/teacher-training` | 3 | 3 | Generate + certificate | 9 |
| `/video-storyteller` | 3 | 3 | Search + filter + play | 10 |
| `/content-creator` | 3 | 3 | Create + preview + save | 9 |
| `/community` | 3 | 3 | 3 tabs + post + chat | 12 |
| `/community-library` | 3 | 3 | Gallery + filter + download | 10 |
| `/messages` | 3 | 3 | Thread list + messaging + voice | 11 |
| `/my-library` | 3 | 3 | Content list + filter + delete | 10 |
| `/my-profile` | 3 | 3 | Edit form + avatar | 9 |
| `/profile/[uid]` | 3 | 3 | Public profile + connect/message | 10 |
| `/notifications` | 3 | 3 | List + mark read + click through | 9 |
| `/attendance` | 3 | 3 | Class list + create | 9 |
| `/attendance/[classId]` | 3 | 3 | Roster + mark + outreach | 10 |
| `/impact-dashboard` | 3 | 3 | Charts + metrics | 9 |
| `/submit-content` | 3 | 3 | Form + upload + submit | 9 |
| `/review-panel` | 3 | 3 | Review queue + approve/reject | 9 |
| `/api-docs` | 3 | 3 | Swagger UI renders | 7 |
| `/api-playground` | 3 | 3 | Endpoint selector + execute | 8 |
| `/admin/cost-dashboard` | 3 | 3 | Admin-only gate + charts | 8 |
| `/admin/log-dashboard` | 3 | 3 | Admin-only gate + logs | 8 |

### Layer 4 Total: ~280 test cases, 0 real API calls

---

## 6. Layer 5 — E2E User Journeys (Playwright)

**Scope**: Real browser, real (staging) API, full user flows
**Framework**: Playwright
**API calls**: REAL calls against staging environment

### 6.1 Critical User Journeys

| Journey | Steps | API Calls | Priority |
|---------|-------|-----------|----------|
| **J1: New Teacher Onboarding** | Sign up → profile setup → select grade/subject/language → complete onboarding → land on home | 4 | P0 |
| **J2: Lesson Plan Generation** | Login → /lesson-plan → fill form → generate → view 5E output → save to library → download PDF | 5 | P0 |
| **J3: Quiz Generation & Export** | Login → /quiz-generator → fill form → generate → review questions → export | 4 | P0 |
| **J4: Worksheet Generation** | Login → /worksheet-wizard → fill form → generate → download | 4 | P0 |
| **J5: Instant Answer** | Login → /instant-answer → type question → get answer → voice input → get answer | 4 | P0 |
| **J6: Community Post & Chat** | Login → /community → create post → like post → chat message → voice message | 6 | P0 |
| **J7: Teacher Connection Flow** | Login as Teacher A → find Teacher B → send request → Login as B → accept → verify connected → verify both see connection | 6 | P0 |
| **J7a: Connection → Disconnect → Reconnect** | A connects to B → A disconnects → A re-requests → B accepts again | 8 | P0 |
| **J7b: Decline Connection** | A sends request → B declines → verify both return to stranger state → A can re-request | 5 | P0 |
| **J8: Direct Messaging (Text)** | Login → /messages → select thread → send text → verify delivered → mark read | 5 | P0 |
| **J8a: Voice Messaging** | Login → /messages → record voice → preview → send → recipient plays audio | 6 | P0 |
| **J8b: Resource Sharing via DM** | Generate lesson plan → share via message → recipient sees resource card → clicks to view | 6 | P0 |
| **J8c: Community Chat Full Flow** | Login → /community → Chat tab → send text → send voice → see other users' messages → scroll history | 7 | P0 |
| **J8d: Connect → Message Integration** | Login → /community → Connect tab → find teacher → connect → accept → click "Message" → lands in DM thread | 8 | P0 |
| **J9: Attendance Flow** | Login → /attendance → create class → add students → mark attendance → trigger parent outreach | 7 | P1 |
| **J10: VIDYA Assistant** | Login → click OmniOrb → ask text question → get response → ask voice question → get response | 5 | P1 |
| **J11: Visual Aid Generation** | Login → /visual-aid-creator → fill form → generate → download image | 4 | P1 |
| **J12: Virtual Field Trip** | Login → /virtual-field-trip → fill form → generate → view trip | 4 | P1 |
| **J13: Teacher Training** | Login → /teacher-training → select module → complete → view certificate | 4 | P1 |
| **J14: Video Storyteller** | Login → /video-storyteller → search → filter → play video | 4 | P1 |
| **J15: Content Lifecycle** | Login → generate lesson plan → save → view in My Library → share → delete | 6 | P1 |
| **J16: Profile Management** | Login → /my-profile → edit name → change avatar → update language → save | 5 | P2 |
| **J17: Impact Dashboard** | Login → /impact-dashboard → verify charts render → check metrics accuracy | 3 | P2 |
| **J18: Rubric Generation** | Login → /rubric-generator → fill form → generate → view output | 4 | P2 |
| **J19: Parent Message** | Login → generate parent message → copy → translate to another language | 4 | P2 |
| **J20: Content Review** | Login as reviewer → /review-panel → review submission → approve/reject | 4 | P2 |
| **J21: Admin Dashboards** | Login as admin → /admin/cost-dashboard → verify charts → /admin/log-dashboard → verify logs | 4 | P2 |
| **J22: Notification Flow** | Login → trigger action (connection request) → verify notification appears → click through → mark read | 4 | P2 |

### 6.2 Cross-Browser Matrix (Playwright)

| Browser | Viewports | Journeys | API Calls |
|---------|-----------|----------|-----------|
| Chromium | mobile + desktop | J1–J22 | ~100 × 2 = 200 |
| WebKit (Safari) | mobile + desktop | J1–J10 (P0+P1) | ~50 × 2 = 100 |
| Firefox | desktop only | J1–J6 (P0) | ~27 |

### 6.3 Language Permutation E2E (Chromium only)

Test J2 (Lesson Plan) and J5 (Instant Answer) across all 11 languages:

```
2 journeys × 11 languages × ~5 API calls = 110 API calls
```

### Layer 5 Total: ~437 real API calls

---

## 7. Test Matrix — Permutation Tables

### 7.0 PRIORITY FEATURES — Messages, Community Chat & Teacher Connections

These three features are **P0 priority** and get the deepest permutation coverage.

---

#### 7.0.1 Direct Messaging — Full Test Matrix

**Server Actions Under Test** (from `actions/messages.ts`):
- `getOrCreateDirectConversationAction`
- `createGroupConversationAction`
- `sendMessageAction`
- `markConversationReadAction`
- `getTotalUnreadCountAction`

**A. Action-Level Contract Tests** (`src/__tests__/actions/messages.contract.test.ts`)

| Action | Test Case | Auth | Count |
|--------|-----------|------|-------|
| `getOrCreateDirectConversation` | Create new conversation between 2 teachers | ✅ | 1 |
| | Return existing conversation (idempotent) | ✅ | 1 |
| | Fail if target user doesn't exist | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| | Fail with self as target | ✅ | 1 |
| `createGroupConversation` | Create group with 3+ members | ✅ | 1 |
| | Fail with < 2 members | ✅ | 1 |
| | Fail with duplicate members | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| `sendMessage` | Send text message | ✅ | 1 |
| | Send audio message (type: 'audio', audioUrl set) | ✅ | 1 |
| | Send resource message (type: 'resource') | ✅ | 1 |
| | Fail with empty text on type: 'text' | ✅ | 1 |
| | Fail with missing audioUrl on type: 'audio' | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| | Fail if not a conversation member | ✅ | 1 |
| | Message appears in recipient's thread | ✅ | 1 |
| | Updates conversation lastMessage & timestamp | ✅ | 1 |
| | Increments recipient's unread count | ✅ | 1 |
| `markConversationRead` | Resets unread count to 0 | ✅ | 1 |
| | No-op if already read | ✅ | 1 |
| | Fail if not a member | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| `getTotalUnreadCount` | Returns 0 for no unread | ✅ | 1 |
| | Returns correct count across multiple convos | ✅ | 1 |
| | Fail without auth | ❌ | 1 |

**Subtotal: 26 contract tests**

**B. Message Type Permutations**

| Message Type | Payload Shape | Browser | Tests |
|--------------|---------------|---------|-------|
| `text` | `{ type:'text', text:'hello' }` | All | 3 |
| `audio` (Chrome) | `{ type:'audio', text:'', audioUrl, audioDuration }` — `audio/webm;codecs=opus` | Chromium | 2 |
| `audio` (Safari) | `{ type:'audio', text:'', audioUrl, audioDuration }` — `audio/mp4` | WebKit | 2 |
| `resource` | `{ type:'resource', text:'Lesson Plan', resourceId, resourceType }` | All | 3 |

**Subtotal: 10 permutation tests**

**C. Voice Message Recording Permutations** (`VoiceRecorder` component)

| Scenario | Steps | Tests |
|----------|-------|-------|
| Record + send (Chrome) | Start → record 3s → stop → preview → send → verify audioUrl in Firestore | 1 |
| Record + send (Safari) | Same flow, verify `audio/mp4` MIME type | 1 |
| Record + cancel | Start → record → cancel → verify no upload | 1 |
| Record + re-record | Start → stop → discard → re-record → send | 1 |
| Long recording (>60s) | Start → auto-stop at limit → send | 1 |
| Permission denied | MediaRecorder blocked → show error state | 1 |
| Upload failure | Record → network error on upload → retry UI | 1 |
| Playback before send | Record → stop → play preview → verify duration display | 1 |

**Subtotal: 8 tests**

**D. Real-Time / Ordering Tests**

| Scenario | Tests |
|----------|-------|
| Messages appear in chronological order | 1 |
| New message scrolls to bottom | 1 |
| Unread badge updates when message received | 1 |
| Conversation list sorted by most recent message | 1 |
| Typing indicator (if implemented) | 1 |
| Offline message queuing (if implemented) | 1 |

**Subtotal: 4–6 tests**

**D. Messages Page Integration (across viewports)**

| Viewport | Auth | Scenarios | Tests |
|----------|------|-----------|-------|
| Mobile (375px) | Auth ×3 | Conversation list → thread → back, voice recorder fits screen, FAB visible | 6 |
| Tablet (768px) | Auth ×3 | Split pane layout, thread + list side by side | 4 |
| Desktop (1280px) | Auth ×3 | Full split layout, keyboard shortcuts | 4 |

**Subtotal: 14 tests**

#### **Messages Total: 62 tests**

---

#### 7.0.2 Community Chat — Full Test Matrix

**Server Action Under Test** (from `actions/community.ts`):
- `sendChatMessageAction`

**Plus Firestore listener tests** on `community_chat` collection.

**A. Action-Level Contract Tests** (`src/__tests__/actions/community-chat.contract.test.ts`)

| Action / Scenario | Auth | Count |
|-------------------|------|-------|
| Send text chat message | ✅ | 1 |
| Send audio chat message (audioUrl set) | ✅ | 1 |
| Fail without auth | ❌ | 1 |
| Fail with empty text and no audioUrl | ✅ | 1 |
| Message appears in community_chat collection | ✅ | 1 |
| Message includes sender profile (name, avatar) | ✅ | 1 |
| Message timestamp is server-generated | ✅ | 1 |
| Messages are ordered by timestamp | ✅ | 1 |
| Rate limiting: > N messages/minute blocked | ✅ | 1 |
| Content safety: profanity/abuse filtered | ✅ | 1 |
| Community chat cleanup job removes old messages | — | 1 |

**Subtotal: 11 contract tests**

**B. Community Chat UI Permutations**

| Scenario | Steps | Tests |
|----------|-------|-------|
| Load chat → see recent messages | Open Chat tab → verify messages render with sender name + avatar | 1 |
| Send text message | Type → send → verify appears at bottom | 1 |
| Send voice message | Record → send → verify audio player renders | 1 |
| Scroll history | Scroll up → load older messages (pagination) | 1 |
| New message from other user | Another user sends → verify auto-appears (real-time listener) | 1 |
| Empty chat state | No messages → show placeholder | 1 |
| Delete own message | Long-press/right-click → delete → confirm → removed | 1 |
| Cannot delete others' messages | Verify no delete option on others' messages | 1 |
| Chat tab badge | Unread messages → badge on Chat tab | 1 |
| Voice message playback | Click play on audio message → plays → shows duration | 1 |
| Link detection | Message with URL → rendered as clickable link | 1 |

**Subtotal: 11 UI tests**

**C. Community Chat Viewport Tests**

| Viewport | Tests |
|----------|-------|
| Mobile: full-screen chat, input bar fixed at bottom, mic button visible | 3 |
| Tablet: chat within tab layout | 2 |
| Desktop: chat within tab layout | 2 |

**Subtotal: 7 tests**

#### **Community Chat Total: 29 tests**

---

#### 7.0.3 Teacher Connections — Full Test Matrix

**Server Actions Under Test** (from `actions/connections.ts`):
- `sendConnectionRequestAction`
- `acceptConnectionRequestAction`
- `declineConnectionRequestAction`
- `disconnectAction`
- `getMyConnectionDataAction`

**A. Action-Level Contract Tests** (`src/__tests__/actions/connections.contract.test.ts`)

| Action | Test Case | Auth | Count |
|--------|-----------|------|-------|
| `sendConnectionRequest` | Send request to valid teacher | ✅ | 1 |
| | Returns `already_pending` for duplicate request | ✅ | 1 |
| | Returns `already_connected` if already connected | ✅ | 1 |
| | Fail sending request to self | ✅ | 1 |
| | Fail sending to non-existent user | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| | Creates `connection_requests/{pairId}` doc | ✅ | 1 |
| | pairId is `[uid1,uid2].sort().join('_')` | ✅ | 1 |
| `acceptConnectionRequest` | Accept pending request | ✅ | 1 |
| | Creates `connections/{pairId}` doc | ✅ | 1 |
| | Removes/updates `connection_requests` doc | ✅ | 1 |
| | Fail accepting already-accepted request | ✅ | 1 |
| | Fail accepting request not addressed to you | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| | Notification sent to requester on accept | ✅ | 1 |
| `declineConnectionRequest` | Decline pending request | ✅ | 1 |
| | Updates request status to declined | ✅ | 1 |
| | Fail declining non-existent request | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| `disconnect` | Disconnect from connected teacher | ✅ | 1 |
| | Removes `connections/{pairId}` doc | ✅ | 1 |
| | Fail disconnecting from non-connected teacher | ✅ | 1 |
| | Fail without auth | ❌ | 1 |
| | After disconnect, can re-send connection request | ✅ | 1 |
| `getMyConnectionData` | Returns connections + pending requests | ✅ | 1 |
| | Returns empty arrays for new user | ✅ | 1 |
| | Fail without auth | ❌ | 1 |

**Subtotal: 27 contract tests**

**B. Connection Flow State Machine Tests**

Full lifecycle permutations:

| Flow | Steps | Tests |
|------|-------|-------|
| Happy path: Request → Accept → Connected | A sends → B accepts → both see connection | 1 |
| Request → Decline | A sends → B declines → both back to strangers | 1 |
| Request → Accept → Disconnect → Re-request | Full cycle with reconnection | 1 |
| Request → Accept → Disconnect (by requester) | A disconnects from B | 1 |
| Request → Accept → Disconnect (by accepter) | B disconnects from A | 1 |
| Mutual request (A→B while B→A pending) | Both send simultaneously → one wins | 1 |
| Request → Cancel (if supported) | A cancels own pending request | 1 |

**Subtotal: 7 state machine tests**

**C. Connect Tab UI Tests**

| Scenario | Steps | Tests |
|----------|-------|-------|
| Teacher directory loads | Open Connect tab → verify teacher list renders with name, subject, grade | 1 |
| Search filter | Type name → list filters in real-time | 1 |
| Send request from UI | Click "Connect" → button changes to "Pending" | 1 |
| Accept request from UI | See incoming request → click "Accept" → status changes to "Connected" | 1 |
| Decline request from UI | Click "Decline" → request disappears | 1 |
| Disconnect from UI | Click "Disconnect" → confirmation dialog → status reverts | 1 |
| Connected teacher → Message button appears | Verify "Message" button only on connected teachers | 1 |
| Connected teacher → Click Message → opens DM | Navigate to /messages with pre-selected thread | 1 |
| Recommended teachers section | Verify recommendations appear, differ from connections | 1 |
| Empty state | No teachers found matching filter → show placeholder | 1 |
| Pending requests section | Incoming requests shown with Accept/Decline buttons | 1 |
| Connection count display | "N connections" badge updates after accept/disconnect | 1 |

**Subtotal: 12 UI tests**

**D. Cross-Feature Integration Tests (Connections ↔ Messages ↔ Community)**

| Scenario | Steps | Tests |
|----------|-------|-------|
| Connect → opens DM | Accept connection → click Message → new conversation created | 1 |
| Disconnect → DM still accessible | Disconnect → existing thread still readable but can't send new messages (if applicable) | 1 |
| Connection request → notification | Send request → recipient sees notification on /notifications | 1 |
| Accept → notification to requester | Accept → requester sees "X accepted your connection" | 1 |
| Connected teacher appears in community Discover | Connected teacher's posts weighted higher in feed | 1 |
| Profile page shows connection status | Visit /profile/[uid] → see correct Connect/Pending/Connected/Message button | 1 |
| Connection data in community Chat | Connected teachers show "Connected" badge in community chat messages | 1 |

**Subtotal: 7 integration tests**

**E. Connection Viewport Tests**

| Viewport | Tests |
|----------|-------|
| Mobile: Connect tab scrollable, request cards stack vertically, swipe actions | 3 |
| Tablet: 2-column grid of teacher cards | 2 |
| Desktop: 3-column grid, sidebar with pending requests | 2 |

**Subtotal: 7 tests**

#### **Teacher Connections Total: 60 tests**

---

#### 7.0.4 Community — Posts, Library & Discover (Expanded)

**Server Actions Under Test** (from `actions/community.ts`):
- `createPostAction`, `toggleLikeAction`, `getPosts`, `followTeacherAction`, `getFollowingIdsAction`
- `getLibraryResources`, `trackDownloadAction`, `getRecommendedTeachersAction`, `getAllTeachersAction`
- `likeResourceAction`, `saveResourceToLibraryAction`, `publishContentToLibraryAction`

**A. Community Action Contract Tests** (`src/__tests__/actions/community.contract.test.ts`)

| Action | Test Cases | Count |
|--------|------------|-------|
| `createPost` | Valid post, with image, empty content rejected, auth required, visibility: public/connections-only | 5 |
| `toggleLike` | Like, unlike (toggle), auth required, non-existent post | 4 |
| `getPosts` | No filter, filter by language, filter by grade, filter by subject, limit/pagination, empty result | 6 |
| `followTeacher` | Follow, unfollow (toggle), auth required, follow self rejected | 4 |
| `getFollowingIds` | Returns correct list, empty for new user, auth required | 3 |
| `getLibraryResources` | No filter, by type, by language, by author, exclude types, empty result | 6 |
| `trackDownload` | Increments count, auth required | 2 |
| `getRecommendedTeachers` | Returns recommendations excluding self & connections, empty fallback, auth required | 3 |
| `getAllTeachers` | Returns list excluding current user, includes profile data | 2 |
| `likeResource` | Like, unlike toggle, auth required, non-existent resource | 4 |
| `saveResourceToLibrary` | Save, unsave toggle, auth required, non-existent resource | 4 |
| `publishContentToLibrary` | Publish content, duplicate rejected, auth required, invalid content type | 4 |

**Subtotal: 47 contract tests**

**B. Discover Tab UI Tests**

| Scenario | Tests |
|----------|-------|
| Trending resources load on mount | 1 |
| Type filter chips (click to filter) | 1 |
| FileTypeIcon renders correct icon per type | 1 |
| Teacher strip renders horizontal scrollable list | 1 |
| Voice search: activate → speak → results filter | 1 |
| Pull-to-refresh (mobile) | 1 |
| Resource card: like, save, download actions work | 1 |
| Empty state when no resources match filter | 1 |

**Subtotal: 8 UI tests**

#### **Community Posts/Library Total: 55 tests**

---

#### **PRIORITY FEATURES GRAND TOTAL: 206 tests**

| Feature | Contract | UI/Component | Integration | Viewport | Total |
|---------|----------|-------------|-------------|----------|-------|
| Messages | 26 | 18 | 4 | 14 | 62 |
| Community Chat | 11 | 11 | — | 7 | 29 |
| Teacher Connections | 27 | 12 | 7 | 7 | 60* |
| Community Posts/Library | 47 | 8 | — | — | 55 |
| **Total** | **111** | **49** | **11** | **28** | **206** |

*includes 7 state machine tests

---

### 7.1 AI Endpoint Full Permutation Matrix

For **reference only** — the full combinatorial space:

```
13 AI endpoints × 15 grades × 15 subjects × 11 languages × 3 resource levels = 96,525 combos
```

**Practical coverage strategy** (3 tiers):

| Tier | Coverage | Formula | Tests |
|------|----------|---------|-------|
| **Tier 1: Smoke** | 1 happy path per endpoint | 13 × 1 | 13 |
| **Tier 2: Priority Matrix** | 4 grades × 4 subjects × 3 langs × 2 levels for top 4 endpoints | 4 × 96 | 384 |
| **Tier 3: Boundary** | Min/max grade + every language for all endpoints | 13 × (2 + 11) | 169 |
| **Total** | | | **566** |

### 7.2 TTS Permutation Matrix

```
11 languages × 3 text lengths (short/medium/long) × 2 cache states = 66 tests
```

### 7.3 Auth Permutation Matrix

```
40 API routes × 3 auth states = 120 tests (already counted in Layer 2)
```

### 7.4 Viewport Permutation Matrix

```
29 pages × 3 viewports = 87 render tests (already counted in Layer 4)
```

---

## 8. Execution Summary

### Total Test Cases by Layer

| Layer | Type | Test Cases | Real API Calls | Mock API Calls |
|-------|------|-----------|----------------|----------------|
| **L1** | Unit | 150 | 0 | 0 |
| **L2** | API Contract + Server Action Contract | 833 (+111 priority features) | 0 | 833 |
| **L3** | Component | 258 | 0 | ~100 |
| **L4** | Page Integration | 280 | 0 | ~280 |
| **L5** | E2E Journeys | 22 journeys (437 steps) | **437** | 0 |
| **Priority Features** | Messages + Chat + Connections | 206 | 0 | 206 |
| **Total** | | **~2,100+** | **~490** | **~1,350** |

### Real API Call Breakdown (Layer 5 only)

| Category | Calls |
|----------|-------|
| AI generation (Gemini) | ~180 |
| TTS (Google Cloud) | ~40 |
| Content CRUD (Firestore) | ~60 |
| Auth (Firebase) | ~44 |
| VIDYA assistant | ~20 |
| Attendance/Twilio | ~14 |
| Community/Messages | ~40 |
| YouTube | ~10 |
| Analytics/Admin | ~15 |
| Language permutations | ~14 |
| **Total real calls** | **~437** |

### Estimated Cost of Full E2E Run (Layer 5)

| Service | Calls | Est. Cost |
|---------|-------|-----------|
| Gemini 2.0 Flash | ~180 | ~$0.05 (very cheap) |
| Google Cloud TTS | ~40 | ~$0.60 |
| Twilio (test calls) | ~14 | ~$0.50 |
| Firebase reads/writes | ~300 | ~$0.01 |
| YouTube API | ~10 | $0 (within quota) |
| **Total per full run** | | **~$1.16** |

### Execution Time Estimates

| Layer | Parallelism | Est. Time |
|-------|-------------|-----------|
| L1 Unit | Full parallel | ~10s |
| L2 API Contract | Full parallel | ~30s |
| L3 Component | Full parallel | ~45s |
| L4 Page Integration | Full parallel | ~60s |
| L5 E2E (3 browsers) | 3 workers | ~15min |
| **Total** | | **~17 min** |

### npm Scripts to Add

```json
{
  "test": "jest",
  "test:unit": "jest src/__tests__/lib/",
  "test:api": "jest src/__tests__/api/",
  "test:components": "jest src/__tests__/components/",
  "test:pages": "jest src/__tests__/app/",
  "test:coverage": "jest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:p0": "playwright test --grep @P0",
  "test:all": "jest && playwright test"
}
```

### Recommended Execution Order

```
1. npm run test:unit          ← Run first (fastest, catches logic bugs)
2. npm run test:api           ← Run second (catches contract breaks)
3. npm run test:components    ← Run third (catches UI regressions)
4. npm run test:pages         ← Run fourth (catches integration issues)
5. npm run test:e2e:p0        ← Run on every PR (critical paths only)
6. npm run test:e2e           ← Run nightly (full E2E suite)
```

### CI Pipeline Suggestion

```
PR checks:        L1 + L2 + L3 (< 2 min, 0 cost)
Pre-merge:        L1 + L2 + L3 + L4 (< 3 min, 0 cost)
Nightly:          L1 + L2 + L3 + L4 + L5 (< 17 min, ~$1.16)
Release gate:     Full L5 × all browsers (~$1.16)
```

---

## Appendix: Files to Create (Implementation Checklist)

### Infrastructure (create first)
- [ ] `playwright.config.ts`
- [ ] `src/__tests__/setup/mock-auth.ts`
- [ ] `src/__tests__/setup/mock-firestore.ts`
- [ ] `src/__tests__/setup/mock-genkit.ts`
- [ ] `src/__tests__/setup/mock-tts.ts`
- [ ] `src/__tests__/setup/mock-twilio.ts`
- [ ] `src/__tests__/setup/mock-youtube.ts`
- [ ] `src/__tests__/setup/test-fixtures.ts`
- [ ] `src/__tests__/setup/msw-handlers.ts`

### Layer 1 — Unit Tests (20 new files)
- [ ] `src/__tests__/lib/tts.test.ts`
- [ ] `src/__tests__/lib/usage-tracker.test.ts`
- [ ] `src/__tests__/lib/server-safety.test.ts`
- [ ] `src/__tests__/lib/analytics-events.test.ts`
- [ ] `src/__tests__/lib/analytics-consent.test.ts`
- [ ] `src/__tests__/lib/analytics/impact-model.test.ts`
- [ ] `src/__tests__/lib/analytics/impact-score.test.ts`
- [ ] `src/__tests__/lib/indexed-db.test.ts`
- [ ] `src/__tests__/lib/performance-monitor.test.ts`
- [ ] `src/__tests__/lib/youtube.test.ts`
- [ ] `src/__tests__/lib/youtube-rss.test.ts`
- [ ] `src/__tests__/lib/curated-videos.test.ts`
- [ ] `src/__tests__/lib/services/cost-service.test.ts`
- [ ] `src/__tests__/lib/services/log-service.test.ts`
- [ ] `src/__tests__/lib/services/certification-service.test.ts`
- [ ] `src/__tests__/lib/teacher-activity-tracker.test.ts`
- [ ] `src/__tests__/lib/get-auth-token.test.ts`
- [ ] `src/__tests__/lib/auth-utils.test.ts`
- [ ] `src/__tests__/types/index.test.ts`

### PRIORITY: Server Action Contract Tests (P0 — implement first)
- [ ] `src/__tests__/actions/messages.contract.test.ts` (26 tests)
- [ ] `src/__tests__/actions/community-chat.contract.test.ts` (11 tests)
- [ ] `src/__tests__/actions/connections.contract.test.ts` (27 tests)
- [ ] `src/__tests__/actions/community.contract.test.ts` (47 tests)
- [ ] `src/__tests__/actions/connections-state-machine.test.ts` (7 tests)
- [ ] `src/__tests__/integration/connections-messages.test.ts` (7 tests)

### PRIORITY: Component Tests for Messages/Chat/Connections (P0)
- [ ] `src/__tests__/components/messages/message-thread.test.tsx`
- [ ] `src/__tests__/components/messages/conversation-list.test.tsx`
- [ ] `src/__tests__/components/messages/voice-recorder.test.tsx`
- [ ] `src/__tests__/components/community/chat-tab.test.tsx`
- [ ] `src/__tests__/components/community/connect-tab.test.tsx`
- [ ] `src/__tests__/components/community/discover-tab.test.tsx`
- [ ] `src/__tests__/components/community/create-post-dialog.test.tsx`

### PRIORITY: E2E Journeys for Messages/Chat/Connections (P0)
- [ ] `e2e/journeys/j07-connection-flow.spec.ts`
- [ ] `e2e/journeys/j07a-disconnect-reconnect.spec.ts`
- [ ] `e2e/journeys/j07b-decline-connection.spec.ts`
- [ ] `e2e/journeys/j08-direct-messaging-text.spec.ts`
- [ ] `e2e/journeys/j08a-voice-messaging.spec.ts`
- [ ] `e2e/journeys/j08b-resource-sharing-dm.spec.ts`
- [ ] `e2e/journeys/j08c-community-chat.spec.ts`
- [ ] `e2e/journeys/j08d-connect-to-message.spec.ts`

### Layer 2 — API Contract Tests (9 new + 4 expanded)
- [ ] `src/__tests__/api/instant-answer.contract.test.ts`
- [ ] `src/__tests__/api/rubric.contract.test.ts`
- [ ] `src/__tests__/api/teacher-training.contract.test.ts`
- [ ] `src/__tests__/api/avatar.contract.test.ts`
- [ ] `src/__tests__/api/visual-aid.contract.test.ts`
- [ ] `src/__tests__/api/video-storyteller.contract.test.ts`
- [ ] `src/__tests__/api/voice-to-text.contract.test.ts`
- [ ] `src/__tests__/api/parent-message.contract.test.ts`
- [ ] `src/__tests__/api/intent.contract.test.ts`
- [ ] `src/__tests__/api/content-crud.contract.test.ts`
- [ ] `src/__tests__/api/user-profile.contract.test.ts`
- [ ] `src/__tests__/api/attendance.contract.test.ts`
- [ ] `src/__tests__/api/vidya.contract.test.ts`
- [ ] `src/__tests__/api/tts.contract.test.ts`
- [ ] `src/__tests__/api/admin.contract.test.ts`
- [ ] `src/__tests__/api/jobs.contract.test.ts`
- [ ] `src/__tests__/api/ai-permutations.test.ts` (parameterized matrix)

### Layer 3 — Component Tests (~25 new files)
- [ ] Auth, Community, Messages, Profile, Content, AI features, Navigation, Attendance, Admin

### Layer 4 — Page Tests (29 new files, one per page)

### Layer 5 — E2E Tests (22 journey files)
- [ ] `e2e/journeys/j01-onboarding.spec.ts` through `j22-notifications.spec.ts`

**Total new files: ~105**
