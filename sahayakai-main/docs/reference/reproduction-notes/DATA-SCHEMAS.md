# SahayakAI - Data Schemas

> Refreshed 2026-06-10 against current source (`src/types/*`, `firestore.rules`,
> ground-truth collection list). Shapes below are derived from TS interfaces;
> fields marked TODO(verify) were not re-read line-by-line.

## Firestore Collections (full list)

Distinct collection names referenced in `src/`:

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

Plus sidecar collections (Admin-SDK-only): `agent_sessions` (+ `turns`), `agent_shadow_diffs` (+ `shadow_calls`), `agent_voice_sessions`, `agent_auto_abort_seen`.

Note: `feedback` and `feedbacks` both appear (likely legacy + current). `chat` / `turns` / `records` / `members` are subcollection segment names.

---

### `users/{uid}` - `UserProfile` (`src/types/index.ts`)

```
uid, email?, phoneNumber?, displayName, photoURL?, schoolName?, schoolNormalized?,
district?, pincode?, state?, educationBoard?, preferredBoard?, verifiedStatus?,
gradeLevels[], subjects[], preferredLanguage, followersCount, followingCount,
createdAt, lastLogin, planType ('free'|'pro'|'gold'|'premium'), impactScore,
contentSharedCount, badges[], groupIds?, ...
```

Note: `planType` is the four-tier set `free|pro|gold|premium` (NOT just free/pro). `teachingGradeLevels` is read by some flows (e.g. instant-answer fallback). TODO(verify: full field list and `teachingGradeLevels` vs `gradeLevels` naming).

### `content/{docId}` - user content (top-level collection)

Per `firestore.rules`, content is a TOP-LEVEL `content/{docId}` collection keyed by `resource.data.userId` (not a `users/{uid}/content` subcollection at the rules layer).

```
{
  id, type (ContentType), title, gradeLevel, subject, topic, language,
  userId, isPublic, isDraft?, storagePath?, deletedAt?, expiresAt?,
  data: object,   // feature-specific (see below)
  createdAt, updatedAt
}
```

Saved via `dbAdapter.saveContent`. Files are written to GCS at `users/{uid}/{contentType}/{filename}.json`.

### `library_resources/{id}` - public community resources

```
{
  id, type (ContentType), title, gradeLevel, subject, language,
  authorId, authorName, authorPhotoURL?,
  stats: { likes, saves, downloads, views? },
  tags?, storagePath?, data?, createdAt
}
```
Subcollections `likes/{likerId}`, `saves/{saverId}` (owner-only). TODO(verify: exact `stats` shape).

### `conversations/{id}` - `Conversation` (`src/types/messages.ts`)

```
{
  id, type ('direct'|'group'), participantIds[], participants{},
  name?, lastMessage, lastMessageAt, lastMessageSenderId, unreadCount{},
  createdAt?, updatedAt?
}
```

### `conversations/{id}/messages/{id}` - `Message`

```
{
  id, type ('text'|'resource'|'audio'), text, senderId, senderName, senderPhotoURL,
  resource?, audioUrl?, audioDuration?, readBy[], createdAt,
  clientMessageId?, deliveryStatus?, deliveredTo?, mediaStatus?
}
```
Rules cap `text` at 1000 chars on create.

### `community_chat/{id}` - broadcast chat

```
{ text, audioUrl?, authorId, authorName, authorPhotoURL, createdAt }
```
Rules: `text.size() <= 500 OR audioUrl is string` (voice-only allowed).

### `connections/{pairId}` / `connection_requests/{pairId}`

`Connection`: `{ id (sorted {uid1}_{uid2}), uids[2], initiatedBy, connectedAt }`. Created only by Admin SDK; deletable by either participant (client SDK).

`ConnectionRequest`: `{ id, fromUid, toUid, createdAt, expiresAt (30d) }`. Create requires `fromUid == auth.uid && fromUid != toUid`; immutable (`update: false`); deletable by either party.

### `notifications/{id}`

```
{ type, recipientId, senderId?, senderName?, senderPhotoURL?, title, message,
  isRead, metadata?, createdAt }
```
Read: recipient only. Create/update/delete: server (Admin SDK) only - client cannot fabricate or mark read directly (goes through `markNotificationAsReadAction`).

### `parent_outreach/{id}` - `ParentOutreach` (`src/types/attendance.ts`)

```
{ id, teacherUid, classId, className, studentId, studentName, parentPhone,
  parentLanguage, reason, generatedMessage,
  deliveryMethod ('twilio_call'|'whatsapp_copy'), subject?, teacherName?, schoolName?,
  callSid?, callStatus?, transcript?(TranscriptTurn[]), callSummary?(CallSummary),
  voicePipelineMode? ('streaming'|'batch'), performanceContext?, createdAt, updatedAt }
```

### `classes/{classId}` + students/attendance

- `classes/{classId}` - `ClassRecord`: `{ id, teacherUid, name, subject, gradeLevel, section?, academicYear, studentCount, createdAt, updatedAt }`
- `classes/{classId}/students/{studentId}` - `Student`: `{ id, classId, rollNumber, name, parentPhone (E.164), parentLanguage, createdAt, updatedAt }`
- `attendance/{classId}/records/{YYYY-MM-DD}` - `DailyAttendanceRecord`: `{ classId, date, teacherUid, records (studentId->'present'|'absent'|'late'), submittedAt, isFinalized }`

### `organizations/{id}` - `Organization` (`src/lib/organization.ts`)

```
{ id, name, type ('school'|'chain'|'government'), adminUserId,
  plan ('gold'|'premium'), subscriptionId?, totalSeats, usedSeats, createdAt, updatedAt }
```
Subcollections: `members` (`OrgMember`), invites (`OrgInvite`).

### Billing / system

- `subscriptions/{subId}` - Razorpay subscription tracking (read: owner; write: Admin only).
- `usageCounters/{userId}` - per-user usage counters (read: owner; write: Admin only).
- `webhook_events/{eventId}` - Razorpay idempotency (backend-only).
- `system_config/{docId}` - feature flags + operator state. Client-readable only when docId matches `^public_.*`; `feature_flags` is Admin-SDK-only.
- `rate_limits/{userId}` - `{ timestamps: number[] }` (managed by `server-safety.ts`).

---

## Feature-Specific Content `data` Schemas

These mirror each flow's output schema. See the per-flow reproduction notes for authoritative shapes.

### Lesson Plan (`data`)
```
{ title, gradeLevel?, duration?, subject?, objectives[], keyVocabulary?[],
  materials[], activities[{ phase, name, description, duration, teacherTips?, understandingCheck? }],
  assessment?, homework?, language?, validationWarning? }
```
Note: activities are an ARRAY of `{ phase, ... }` objects (5E phases), NOT a `sections.{engage,...}` map as the prior doc stated.

### Quiz (`data` = `QuizVariantsOutput`)
```
{ easy|null, medium|null, hard|null, id, gradeLevel, subject, topic, isSaved, validationWarning? }
```
TODO(verify: per-question shape from `quiz-generator-schemas.ts`).

### Visual Aid (`data`)
```
{ imageUrl, pedagogicalContext, discussionSpark, altText }  // TODO(verify) against current source
```

### Rubric / Worksheet / Virtual Field Trip
TODO(verify: re-read `rubric-generator.ts`, `worksheet-wizard.ts`, `virtual-field-trip.ts` for exact `data` shapes - prior doc's shapes are unverified).

---

## TypeScript Enums

### ContentType
`lesson-plan | quiz | worksheet | visual-aid | rubric | micro-lesson | virtual-field-trip | instant-answer | teacher-training` (TODO(verify: confirm full union including exam-paper / assessment types in `src/types`)).

### Language (11 Indic)
`hi, en, bn, ta, kn, ml, gu, pa, te, mr` + Odia fallback. Display forms via `LANGUAGE_CODE_MAP`.

### GradeLevel
`Nursery | LKG | UKG | Class 1 ... Class 12`.

TODO(verify: `Subject`, `NotificationType`, `ConnectionStatus` enum members against `src/types/index.ts`).

---

## Firebase Storage Paths (`storage.rules`)

| Purpose | Path | Rule |
|---|---|---|
| Voice messages (1:1 chat) | `voice-messages/{uid}/{ts}.{webm|m4a}` | owner-write, signed-in read, <5 MB, `audio/.*` |
| User uploads | `users/{uid}/uploads/{uuid}_{filename}` | owner-write, signed-in read, <10 MB |
| Profile photos | `profile-photos/{uid}/{uuid}.{ext}` | owner-write, signed-in read, <5 MB, `image/.*` |
| Legacy uploads | `uploads/{uid}/{filename}` | owner-write fallback |
| AI content JSON | `users/{uid}/{contentType}/{file}.json` | written server-side (Admin) |

---

## API Contracts (current)

### POST /api/ai/instant-answer
```
Request:  { question, language?, gradeLevel?, subject?, userId }
Response: { answer, videoSuggestionUrl?, gradeLevel?, subject? }
```

### POST /api/ai/lesson-plan
```
Request:  LessonPlanInput (topic, gradeLevels?, language?, userId, ncertChapter?, resourceLevel?, ...)
Response: LessonPlanOutput
```

### POST /api/ai/quiz
```
Request:  QuizGeneratorInput (topic, gradeLevel, subject?, language?, numQuestions?, userId)
Response: QuizVariantsOutput { easy, medium, hard, id, gradeLevel, subject, topic, isSaved, validationWarning? }
```

### POST /api/ai/intent
```
Request:  { prompt, language?, gradeLevels?, imageDataUri?, userId? }
Response: AgentRouterOutput { type, topic?, gradeLevel?, subject?, language?, plannedActions?, result }
```
