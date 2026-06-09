# SahayakAI Data Architecture & Schema Plan

**Last updated:** 2026-06-10
**Status:** LIVE (implemented). Verified against `src/types/**` and `collection()` usage in `src/`.

---

## 1. Overview
This document defines the data models for the SahayakAI platform. The application has moved from stateless AI generations to a structured, persistent application state backed by Cloud Firestore.

**Primary database:** Cloud Firestore (NoSQL).
**Secondary store:** Cloud SQL (PostgreSQL) for `certifications` only (`src/lib/services/certification-service.ts`, queried via `src/lib/db/sql`). All other data is in Firestore.
**Voice subproject store:** `services/voice-server/` runs its own SQLite call-intelligence store (see `services/voice-server/docs/DATABASE_SCHEMA.md`); it syncs back to Firestore `parent_outreach`.
**Structure:** User-centric with global shared libraries.

## 2. Shared Common Enumerations

Source of truth: `src/types/index.ts`.

### `GradeLevel` (Enum)
- `Nursery`, `LKG`, `UKG`, `Class 1` … `Class 12` (full list in `GRADE_LEVELS`).

### `Subject` (Enum)
- `Mathematics`, `Science`, `Social Science`, `History`, `Geography`, `Civics`, `English`, `Hindi`, `Sanskrit`, `Kannada`, `Computer Science`, `Environmental Studies (EVS)`, `General`.

### `Language` (Enum)
- `English`, `Hindi`, `Kannada`, `Tamil`, `Telugu`, `Marathi`, `Bengali`, `Gujarati`, `Punjabi`, `Malayalam`, `Odia` (11 Indic languages).

### `ContentType` (Enum)
- `lesson-plan`, `quiz`, `worksheet`, `visual-aid`, `rubric`, `micro-lesson`, `virtual-field-trip`, `instant-answer`, `teacher-training`, `exam-paper`, `assessment`, `assessment-submission`.

### `EducationBoard`, `IndianState`, `AdministrativeRole`, `Qualification`
- Defined in `src/types/index.ts` (`EDUCATION_BOARDS`, `INDIAN_STATES`, `ADMINISTRATIVE_ROLES`, `QUALIFICATIONS`).

---

## 3. Firestore Collection Inventory

Distinct collection / subcollection names referenced via `collection()` / `.collection()` in `src/` (verified 2026-06-10):

```
analytics, assessment_batches (sub), assessments (sub), attendance, billing_monthly_reports,
billing_reconciliation_actions, billing_reconciliation_runs, cached_lesson_plans,
chat (sub), classes, community_chat, community_posts, connection_requests, connections,
consent_log (sub), content (sub), conversations, fcm_tokens (sub), feedback, feedbacks,
groups, invites, library_resources, likes (sub), members (sub), messages (sub),
ncert_chapters, ncert_curriculum, ncert_textbooks, notifications, organizations,
parent_outreach, pendingSignInLinks, posts, rate_limits, records (sub),
sarkar_verifications, saves, shadow_calls (sub of agent_shadow_diffs), students (sub),
subscriptions, system_config, teacher_analytics, telemetry_events, turns (sub),
usageCounters, users, vidya_sessions (sub of users), webhook_events
```

`(sub)` = subcollection segment, not a top-level collection.

> **TODO(verify: which collection is canonical).** Both `feedback` (written by `dbAdapter.saveFeedback`, `src/lib/db/adapter.ts:334`) and `feedbacks` (written by the feedback server action, `src/app/actions/feedback.ts:37`) exist and receive writes. Likely a legacy/current duplication; confirm which is canonical and consolidate.

---

## 4. Core Entities (Collections)

### A. `users/{uid}` (Collection)
Represents the authenticated teacher/educator. Full interface: `UserProfile` (`src/types/index.ts:155`).

```typescript
interface UserProfile {
  uid: string;                 // Firebase Auth ID
  email?: string;
  phoneNumber?: string;
  displayName: string;
  photoURL?: string;

  // Professional Profile
  schoolName?: string;
  schoolNormalized?: string;   // fuzzy-match key
  district?: string;
  pincode?: string;
  state?: string;
  educationBoard?: string;     // free string (legacy, kept for back-compat)
  preferredBoard?: EducationBoard;  // canonical typed board, set at onboarding
  verifiedStatus?: 'none' | 'pending' | 'verified';
  bio?: string;
  department?: string;
  designation?: string;
  badges: string[];

  // Experience & role
  yearsOfExperience?: number;
  administrativeRole?: AdministrativeRole;
  qualifications?: Qualification[];

  gradeLevels: GradeLevel[];
  teachingGradeLevels?: GradeLevel[];   // @deprecated — use gradeLevels
  subjects: Subject[];
  preferredLanguage: Language;

  // Social
  followersCount: number;
  followingCount: number;

  // Usage
  createdAt: Timestamp;
  lastLogin: Timestamp;
  planType: 'free' | 'pro' | 'gold' | 'premium';  // legacy 'institution' normalized to 'premium'

  // Gamification
  impactScore: number;
  contentSharedCount: number;

  // UX / onboarding flags
  groupIds?: string[];
  onboardingPhase?: 'setup' | 'first-generation' | 'exploring' | 'completing' | 'done';
  profileCompletionLevel?: 'basic' | 'complete';
  // … further onboarding/checklist fields, see src/types/index.ts
}
```

Subcollections under `users/{uid}`: `content`, `vidya_sessions`, `fcm_tokens`, `consent_log`.

### B. `users/{uid}/content/{id}` (Sub-collection)
Stores all generated content (lesson plans, quizzes, etc.). Interface `BaseContent` (`src/types/index.ts:228`).

```typescript
interface BaseContent<T = any> {
  id: string;
  type: ContentType;           // see ContentType enum above
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Search/Filter metadata
  gradeLevel: GradeLevel;
  subject: Subject;
  topic: string;
  language: Language;

  // Status
  isPublic: boolean;
  isDraft: boolean;
  deletedAt?: Timestamp | null;  // null = active, set = soft-deleted
  expiresAt?: Timestamp | null;  // TTL: Firestore auto-purges 30 days after soft-delete

  // Storage
  storagePath?: string;        // path to full JSON/Markdown in Cloud Storage
  data?: T;                    // the schema-specific payload (see §5)
}
```

---

## 5. Feature-Specific Schemas (Payloads)

Source of truth: `src/types/index.ts`. Shapes below match the implemented interfaces.

### 1. Lesson Plan (`lesson-plan`)
*Status: Implemented (`LessonPlanSchema`)*

```typescript
interface LessonPlanSchema {
  title: string;
  gradeLevel?: string;
  duration?: string;
  subject?: string;
  objectives: string[];
  keyVocabulary?: Array<{ term: string; meaning: string }>;
  materials: string[];
  activities: Activity[];      // flat list; each activity carries its 5E phase
  assessment?: string;
  homework?: string;
}

interface Activity {
  phase: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
  name: string;
  description: string;
  duration: string;
  teacherTips?: string;
  understandingCheck?: string;
}
```

> Correction: the prior draft modelled the 5E phases as separate `engage/explore/...` arrays under a `content` object. The implemented schema uses a single flat `activities: Activity[]` with a `phase` field on each activity.

### 2. Quiz (`quiz`)
*Status: Implemented (Zod)*

```typescript
interface QuizSchema {
  format: 'print' | 'interactive';
  questions: Array<{
    id: string;
    text: string;
    type: 'multiple-choice' | 'fill-in-blank' | 'short-answer' | 'true-false';
    options?: string[];       // For MCQ
    correctAnswer: string;
    explanation: string;      // For teacher/student review
    difficulty: 'easy' | 'medium' | 'hard';
    bloomsLevel?: string;     // e.g. "Recall", "Application"
  }>;
  answerKey: Record<string, string>; // ID -> Answer mapping
}
```

### 3. Worksheet (`worksheet`)
*Current Status: Markdown String (Needs Structure)*

```typescript
interface WorksheetSchema {
  // Structured for PDF generation
  sections: Array<{
    title: string;          // e.g. "Part A: Vocabulary"
    instructions: string;
    items: Array<{
      type: 'text' | 'image' | 'drawing_box' | 'lines';
      content: string;      // The question or prompt
      spaceAllocated: string; // e.g. "3-lines", "half-page"
    }>;
  }>;
  layout: 'portrait' | 'landscape';
  theme?: 'minimal' | 'playful';
}
```

### 4. Visual Aid (`visual-aid`)
*Status: Implemented (`VisualAidSchema`)*

```typescript
interface VisualAidSchema {
  imageDataUri?: string;     // optional — passed around, not stored in DB
  storageRef?: string;       // reference to Cloud Storage path
  pedagogicalContext: string;
  discussionSpark: string;
}
```

> Correction: the prior draft listed `prompt/style/imageUrl/altText/suggestedCaption/discussionQuestions`. The implemented schema is the four fields above. The image itself is referenced via `storageRef`, not an `imageUrl` field. Generated by `gemini-3-pro-image-preview` (image) + `gemini-2.5-flash` (text).

### 5. Micro-Lesson (`micro-lesson`)
*New Feature Schema*

```typescript
interface MicroLessonSchema {
  // Concept: A stack of "Stories" or Slides
  slides: Array<{
    id: string;
    type: 'title' | 'concept' | 'quiz' | 'video' | 'image';
    content: {
      headline: string;
      bodyText: string;
      mediaUrl?: string;     // Image or Video
      bulletPoints?: string[];
    };
    script: string;          // Voiceover script for the slide
    duration: number;        // Recommended seconds
  }>;
}
```

### 6. Rubric (`rubric`)
*Current Status: Needs Definition*

```typescript
interface RubricSchema {
  assignmentTitle: string;
  scale: number;             // e.g. 4-point, 5-point
  criteria: Array<{
    name: string;            // e.g. "Grammar"
    weight?: number;         // Percentage
    levels: Array<{
      score: number;         // e.g. 4
      label: string;         // e.g. "Exceeds Expectations"
      descriptor: string;    // "No grammatical errors..."
    }>;
  }>;
}
```

---

### 7. Global News Feed (`news-feed`)
*Shared global collection*

```typescript
interface NewsItemSchema {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Timestamp;
  tags: string[];           // ["Education Policy", "CBSE"]
  relevanceScore: number;   // AI-calculated relevance to Indian teachers
}
```

### 8. Gamification & Impact (`user-impact`)
*Sub-collection or embedded in User Profile*

```typescript
interface UserImpactSchema {
  streakDays: number;
  totalContentGenerated: number;
  badges: Array<{
    id: string;
    name: string;      // e.g. "Early Adopter", "Curriculum Master"
    awardedAt: Timestamp;
    icon: string;
  }>;
  savings: {
    timeSavedHours: number;
    moneySavedINR: number;
  };
}
```

---

## 6. Other Live Collections (added 2026-06-10)

These collections exist in code but were absent from the original plan. Shapes derived from the TS interfaces or the write sites cited.

### Classroom / attendance (`src/types/attendance.ts`)
- **`classes/{classId}`** — `ClassRecord`: `id, teacherUid, name, subject, gradeLevel, section?, academicYear, studentCount, createdAt, updatedAt`.
- **`classes/{classId}/students/{studentId}`** — `Student`: `id, classId, rollNumber, name, parentPhone (E.164), parentLanguage, createdAt, updatedAt`.
- **`attendance/{classId}/records/{YYYY-MM-DD}`** — `DailyAttendanceRecord`: `classId, date, teacherUid, records (studentId→'present'|'absent'|'late'), submittedAt, isFinalized`. Parent doc `attendance/{classId}` is an empty container.
- **`parent_outreach/{outreachId}`** — `ParentOutreach`: `id, teacherUid, classId, className, studentId, studentName, parentPhone, parentLanguage, reason, teacherNote?, generatedMessage, deliveryMethod ('twilio_call'|'whatsapp_copy'), subject?, teacherName?, schoolName?, callSid?, callStatus?, transcript? (TranscriptTurn[]), callSummary? (CallSummary), answeredBy?, callDurationSeconds?, turnCount?, voicePipelineMode? ('streaming'|'batch'), performanceContext? (PerformanceContext), createdAt, updatedAt`.

### Assessments / performance (`src/types/performance.ts`)
- **`classes/{classId}/assessment_batches/{batchId}`** — `AssessmentBatch`: `id, classId, teacherUid, name, type (AssessmentType), subject, maxMarks, term ('term1'|'term2'|'annual'), date, academicYear, studentCount, classAverage?, createdAt, updatedAt`.
- **`classes/{classId}/students/{studentId}/assessments/{assessmentId}`** — `Assessment`: `id, classId, batchId, studentId, teacherUid, type, name, subject, maxMarks, marksObtained, percentage, grade?, term, academicYear, date, coScholastic? (CoScholasticEntry[]), remarks?, createdAt, updatedAt`.

### Messaging (`src/types/messages.ts`)
- **`conversations/{id}`** — `Conversation`: `id, type ('direct'|'group'), participantIds[], participants (Record<uid, ParticipantSnapshot>), name?, groupPhotoURL?, createdBy?, lastMessage, lastMessageAt, lastMessageSenderId, unreadCount (Record<uid, number>), createdAt, updatedAt`.
- **`conversations/{id}/messages/{id}`** — `Message`: `id, type ('text'|'resource'|'audio'), text, senderId, senderName, senderPhotoURL, resource? (SharedResource), audioUrl?, audioDuration?, readBy[], createdAt, clientMessageId?, deliveryStatus?, deliveredTo?, mediaStatus?`.

### Community / social
- **`posts/{postId}`** — community feed posts (`src/app/actions/community.ts`). TODO(verify: full Post field shape; no dedicated interface, fields include `authorId, content, createdAt` and likes/saves counters).
- **`library_resources/{id}`** — shared resources; `authorId, authorName, title, type, gradeLevel?, subject?, language?, stats.{likes,saves,downloads}, createdAt` (write sites in `src/app/actions/community.ts`). TODO(verify: exhaustive library_resources field list; assembled inline, no exported interface).
- **`community_chat/{id}`** — community chat messages (text/audio), same shape family as `Message`.
- **`community_posts/{id}`** — used by data-export-service (`src/lib/services/data-export-service.ts`). TODO(verify: relationship between `posts` and `community_posts`; both referenced, confirm whether distinct features or a rename in progress).
- **`groups/{groupId}`** — `Group` (`src/types/community.ts`); subcollections `members`, `posts`, `chat`. `GroupPost`, `GroupMember`, `GroupChatMessage` shapes in `src/types/community.ts`.
- **`connections/{pairId}`** — `Connection`: `id (sorted {uid1}_{uid2}), uids[2], initiatedBy, connectedAt`.
- **`connection_requests/{fromUid}_{toUid}`** — `ConnectionRequest`: `id, fromUid, toUid, createdAt, expiresAt (30d)`.
- **`notifications/{id}`** — `Notification` (`src/types/index.ts:387`): `id, recipientId, type (NotificationType), title, message, senderId?, senderName?, senderPhotoURL?, link?, metadata?, isRead, createdAt`.
- **`likes`, `saves`, `invites`** — like/save toggle docs and org invites. TODO(verify: exact field shapes of `saves` and `invites` top-level vs subcollection usage).

### Billing
- **`subscriptions/{razorpaySubscriptionId}`** — `razorpaySubscriptionId, userId, planKey, status, shortUrl, createdAt, updatedAt` (write sites in `src/app/api/billing/*` and `webhooks/razorpay`).
- **`webhook_events/{eventId}`** — Razorpay idempotency ledger: `event, status ('processing'|'completed'|'failed'), receivedAt, retriedAt?` (`src/app/api/webhooks/razorpay/route.ts`).
- **`pendingSignInLinks/{userId}`** — email sign-in link state set during public checkout (`webhooks/razorpay`). TODO(verify: full field shape of pendingSignInLinks).
- **`billing_monthly_reports`, `billing_reconciliation_runs`, `billing_reconciliation_actions`** — reconciliation artifacts (`src/lib/billing-reconciliation.ts`). TODO(verify: field shapes for the three billing reconciliation collections).

### Usage / quota / analytics
- **`usageCounters/{userId}`** — per-user monthly + daily feature counters, `Record<string, number>` keyed by feature field, plus `lastUpdated` (`src/lib/usage-counters.ts`).
- **`rate_limits/{key}`** — rate-limit buckets. TODO(verify: field shape of rate_limits docs).
- **`teacher_analytics/{uid}`** — computed teacher health: `score, level, risk_level, activity_score, engagement_score, success_score, growth_score, community_score, estimated_students_impacted, is_cold_start, lastUpdated, …` (`src/lib/aggregator.ts`).
- **`telemetry_events/{autoId}`** — client telemetry batch sink: `{...event, userId, syncedAt}` (`src/app/actions/telemetry.ts`).
- **`analytics`** — analytics collection (`src/app/api/analytics/seed`). TODO(verify: analytics doc field shape).

### Auth / verification / config / consent
- **`sarkar_verifications/{userId}`** — govt teacher verification: `userId, udiseCode, schoolName, district, state, status ('pending'|'verified'|'rejected'), submittedAt` (`src/app/api/sarkar/verify/route.ts`).
- **`users/{uid}/fcm_tokens/{tokenHash}`** — `token, platform ('web'), updatedAt` (`src/app/api/fcm/register/route.ts`).
- **`users/{uid}/consent_log/{autoId}`** — DPDP consent audit: `changes, timestamp, ip` (`src/app/api/user/consent/route.ts`).
- **`system_config/feature_flags`** — `FeatureFlagsConfig` (billing kill-switch, maintenance, subscription rollout, 17 per-agent sidecar mode/percent pairs). See `src/lib/feature-flags.ts`.

### VIDYA assistant
- **`users/{uid}/vidya_sessions/{sessionId}`** — `messages[] (capped 50), createdAt, updatedAt, actionsTriggered? (arrayUnion), screenPaths? (arrayUnion)`. Pruned to 10 most-recent sessions (`src/app/api/vidya/session/route.ts`).

### Sidecar shadow diffs
- **`agent_shadow_diffs/{YYYY-MM-DD}/shadow_calls/{callSid__turn}`** — parent-call Genkit-vs-sidecar parity samples: `callSid, turnNumber, parentLanguage, genkitReply, sidecarReply, sidecarError, sidecarLatencyMs, capturedAt, expireAt (TTL)` (`src/lib/sidecar/shadow-diff.ts`). Note: `shadow_calls` is a subcollection of `agent_shadow_diffs/{day}`, not top-level.

### NCERT reference data
- **`ncert_curriculum`, `ncert_textbooks`, `ncert_chapters`** — read-only NCERT reference data (migrated via `/api/migrate-ncert`). TODO(verify: field shapes of the three NCERT collections).

### Feedback (duplication)
- **`feedback`** — `dbAdapter.saveFeedback`: `userId, ...feedbackData, createdAt`.
- **`feedbacks`** — feedback action: `...data, userId?, timestamp`. TODO(verify: which collection is canonical); see §3.

### Organizations
- **`organizations/{id}`** — `Organization` (`src/lib/organization.ts`): `id, name, type ('school'|'chain'|'government'), adminUserId, plan ('gold'|'premium'), subscriptionId?, totalSeats, usedSeats, createdAt, updatedAt`. Members and invites stored as `OrgMember` / `OrgInvite`.

---

## 7. UX Considerations for Data Strategy
*Addressing user feedback regarding performance and experience.*

1.  **Optimistic UI:** All "Save" and "Star" actions must update the UI immediately, syncing to Firestore in the background.
2.  **Skeleton Loading:** Schemas are designed to allow partial data fetching (e.g., fetching only `metadata` for list views) to keep the "My Library" page fast.
3.  **Offline Support:** The Firestore SDK's offline persistence will be enabled to allow teachers in low-connectivity rural areas to view previously loaded content.
4.  **Instant Search:** Client-side indexing (using a lightweight engine like Fuse.js on the `title` and `tags` fields) will provide instant search results for personal libraries.

---

## 8. File Storage Strategy (Cloud Storage)

While metadata is stored in Firestore, heavy content generated by AI is stored in Google Cloud Storage buckets to reduce database costs and strictly separate data from files.

| Content Type | Storage Path Pattern | Format |
| :--- | :--- | :--- |
| **Lesson Plan** | `users/{uid}/lesson-plans/{timestamp}-{id}.json` | `application/json` |
| **Worksheet** | `users/{uid}/worksheets/{timestamp}-{id}.md` | `text/markdown` |
| **Quiz** | `users/{uid}/quizzes/{timestamp}-{id}.json` | `application/json` |
| **Visual Aid** | `users/{uid}/visual-aids/{timestamp}-{id}.png` | `image/png` |
| **Field Trip** | `users/{uid}/virtual-field-trips/{timestamp}-{id}.json` | `application/json` |
| **Rubric** | `users/{uid}/rubrics/{timestamp}-{id}.json` | `application/json` |

---

## 9. Implementation Roadmap (historical — most phases complete)

1.  **Phase 1: Type Definitions**
    -   Create `src/types/schema.d.ts` (or individual files in `src/ai/schemas`) to strictly type these models.
    -   Update existing Zod schemas to match these structured definitions.

2.  **Phase 2: Database Adapters**
    -   Create `src/lib/db/adapter.ts` to handle CRUD operations for `users/{uid}/content`.
    -   Implement "Save to Library" functionality in all flows.

3.  **Phase 3: Migration (Data Modeling)**
    -   Refactor `worksheet-wizard` to return JSON instead of Markdown string.
    -   Refactor `lesson-plan` to strictly match the new persisted schema.

4.  **Phase 4: UI Binding**
    -   Update UI components to render from these new structured types instead of loose props.
