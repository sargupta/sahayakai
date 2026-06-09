# Attendance — /attendance

**File:** `src/app/attendance/page.tsx` (class list), `src/app/attendance/[classId]/page.tsx` (class detail)
**Auth:** Required (full redirect if not signed in)
**Plan gate:** Pro or Institution (enforced server-side on all write actions)

---

## Purpose

Full attendance management system for teachers. Create classes, add students (with parent contact info), take daily attendance via tap-to-cycle grid, view monthly reports, and contact parents via AI-generated multilingual messages delivered through Twilio voice calls or WhatsApp copy.

---

## Route Structure

| Route | File | Description |
|---|---|---|
| `/attendance` | `src/app/attendance/page.tsx` | Class list — shows all classes for the authenticated teacher |
| `/attendance/[classId]` | `src/app/attendance/[classId]/page.tsx` | Class detail — 3-tab view (Today, Students, Reports) |

---

## Component Tree

```
AttendancePage (/attendance)
├── Header ("Attendance" + "New Class" button)
├── Loading spinner / Empty state / Class card list
│   └── Class card × N (click → /attendance/{classId})
│       ├── GraduationCap icon
│       ├── Class name, grade, subject, section
│       ├── Student count + academic year
│       ├── Delete button (ghost, hover-visible)
│       └── ChevronRight
└── CreateClassDialog

ClassDetailPage (/attendance/[classId])
├── Header (back arrow + class name + metadata)
├── At-risk alert banner (students with >= 2 consecutive absences)
│   └── Student badge × N (click → opens ContactParentModal)
├── Tabs (Today | Students | Reports)
│   ├── TabsContent "today"
│   │   └── AttendanceGrid
│   │       ├── Summary bar (Present / Absent / Late counts + "All Present" button)
│   │       ├── Legend (P/A/L color chips)
│   │       ├── Student row × N (tap to cycle: present → absent → late → present)
│   │       └── Sticky submit button ("Submit Attendance" / "Attendance Saved")
│   ├── TabsContent "students"
│   │   ├── StudentManager
│   │   │   ├── Student count + "Add Student" button
│   │   │   ├── Student list (roll#, name, phone, language badge)
│   │   │   │   ├── Edit button → opens Sheet
│   │   │   │   └── Delete button
│   │   │   └── Add/Edit Sheet (side panel)
│   │   │       ├── Roll Number (1–40)
│   │   │       ├── Student Name
│   │   │       ├── Parent Phone (+91 prefix)
│   │   │       └── Parent Language (select from LANGUAGES)
│   │   └── Parent Outreach section
│   │       └── Student row × N with attendance rate + "Contact" button
│   └── TabsContent "reports"
│       └── AttendanceCalendar
│           ├── Month navigator (prev/next, no future months)
│           └── Summary table (Student | Present | Absent | Late | Days | Rate%)
│               └── Color-coded progress bar per student
└── ContactParentModal (dialog, 5-step wizard)
    ├── Step 1: "reason" — select outreach reason (4 options)
    ├── Step 2: "note" — optional teacher note textarea
    ├── Step 3: "review" — generated message preview
    │   ├── Regenerate button
    │   ├── "Copy for WhatsApp" button
    │   └── "Call Parent" button (green, only if Twilio configured + language supported)
    ├── Step 4: "calling" — live call status with pulse animation
    │   ├── Status badge (Calling.../Connected/Completed/Failed)
    │   ├── Turn count badge (conversation turns)
    │   └── Polls /api/attendance/call-summary every 5s
    └── Step 5: "summary" — structured call results
        ├── Parent response card
        ├── Concerns (amber), Commitments (blue), Action Items (orange), Guidance (violet)
        ├── Follow-up suggestion (rose) if needed
        └── Collapsible transcript viewer (Bot/UserCircle icons)
```

---

## Types — `src/types/attendance.ts`

### Core Enums

```ts
type AttendanceStatus = 'present' | 'absent' | 'late';

type OutreachReason =
    | 'consecutive_absences'
    | 'poor_performance'
    | 'behavioral_concern'
    | 'positive_feedback';

type CallStatus = 'initiated' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'manual';
```

### Firestore Document Types

**`classes/{classId}`** — `ClassRecord`

| Field | Type | Notes |
|---|---|---|
| `teacherUid` | `string` | Owner teacher's UID |
| `name` | `string` | e.g. "Class 6A" |
| `subject` | `Subject` | From shared types |
| `gradeLevel` | `GradeLevel` | From shared types |
| `section` | `string?` | "A", "B", etc. |
| `academicYear` | `string` | "2025-26" |
| `studentCount` | `number` | Denormalized, incremented/decremented via FieldValue.increment |
| `createdAt` | `string` | ISO |
| `updatedAt` | `string` | ISO |

**`classes/{classId}/students/{studentId}`** — `Student`

| Field | Type | Notes |
|---|---|---|
| `classId` | `string` | Parent class ID |
| `rollNumber` | `number` | 1–40 |
| `name` | `string` | Full name |
| `parentPhone` | `string` | E.164 format: `+919876543210` |
| `parentLanguage` | `Language` | One of 11 Indic languages |
| `createdAt` | `string` | ISO |
| `updatedAt` | `string` | ISO |

**`attendance/{classId}/records/{YYYY-MM-DD}`** — `DailyAttendanceRecord`

| Field | Type | Notes |
|---|---|---|
| `classId` | `string` | |
| `date` | `string` | YYYY-MM-DD |
| `teacherUid` | `string` | |
| `records` | `Record<string, AttendanceStatus>` | studentId -> status map |
| `submittedAt` | `string` | ISO |
| `isFinalized` | `boolean` | Always `false` currently |

Note: `attendance/{classId}` is an empty container document. Actual records are in the `records` subcollection keyed by date string.

**`parent_outreach/{outreachId}`** — `ParentOutreach`

| Field | Type | Notes |
|---|---|---|
| `teacherUid` | `string` | |
| `classId` | `string` | |
| `className` | `string` | Denormalized |
| `studentId` | `string` | |
| `studentName` | `string` | Denormalized |
| `parentPhone` | `string` | E.164 |
| `parentLanguage` | `Language` | |
| `reason` | `OutreachReason` | |
| `teacherNote` | `string?` | Optional teacher context |
| `generatedMessage` | `string` | AI-generated message |
| `deliveryMethod` | `'twilio_call' \| 'whatsapp_copy'` | |
| `callSid` | `string?` | Twilio Call SID (set after call initiation) |
| `callStatus` | `CallStatus` | `'manual'` for WhatsApp, `'initiated'` -> updated by status callback |
| `transcript` | `TranscriptTurn[]?` | Conversation history (`{ role, text, timestamp }[]`) |
| `callSummary` | `CallSummary?` | AI-generated structured summary (post-call) |
| `answeredBy` | `string?` | Twilio AnsweredBy (human/machine) |
| `callDurationSeconds` | `number?` | From Twilio CallDuration |
| `turnCount` | `number?` | Number of conversation turns |
| `createdAt` | `string` | ISO |
| `updatedAt` | `string` | ISO |

### Computed (not stored) — `StudentAttendanceSummary`

| Field | Type | Notes |
|---|---|---|
| `studentId` | `string` | |
| `studentName` | `string` | |
| `rollNumber` | `number` | |
| `totalDays` | `number` | present + absent + late |
| `presentDays` | `number` | |
| `absentDays` | `number` | |
| `lateDays` | `number` | |
| `attendanceRate` | `number` | 0–100, `round(present/total * 100)` |
| `consecutiveAbsences` | `number` | Max streak of consecutive absent days in the month |

---

## Server Actions — `src/app/actions/attendance.ts`

All actions use `'use server'` directive. Auth via `headers().get('x-user-id')` (injected by middleware from Firebase ID token).

### Auth & Plan Helpers

- `getAuthUserId()` — reads `x-user-id` header, throws if missing
- `requireProPlan(uid)` — checks `planType === 'pro' | 'institution'`, throws `'PREMIUM_REQUIRED'` otherwise
- `normalizeToE164(phone)` — converts 10-digit or 91+10-digit to `+91XXXXXXXXXX`

### Class Management

| Action | Plan Gate | Description |
|---|---|---|
| `createClassAction(data)` | Pro | Creates class doc, returns `{ classId }` |
| `getClassesAction()` | No | Lists all classes for teacher, sorted by createdAt desc |
| `getClassAction(classId)` | No | Single class lookup with ownership check |
| `updateClassAction(classId, data)` | No | Partial update (name, subject, grade, section) |
| `deleteClassAction(classId)` | No | Cascade deletes: batch-delete students subcollection, delete class doc, `recursiveDelete` attendance container |

### Student Management

| Action | Plan Gate | Description |
|---|---|---|
| `addStudentAction(classId, data)` | Pro | Max 40 students enforced via COUNT aggregation. Batch: create student + increment studentCount |
| `getStudentsAction(classId)` | No | Ordered by rollNumber asc |
| `updateStudentAction(classId, studentId, data)` | No | Partial update, normalizes phone |
| `deleteStudentAction(classId, studentId)` | No | Batch: delete student + decrement studentCount |

### Attendance Recording

| Action | Plan Gate | Description |
|---|---|---|
| `saveAttendanceAction(classId, date, records)` | Pro | Validates date is not future, not older than 7 days. Writes to `attendance/{classId}/records/{date}` |
| `getAttendanceForDateAction(classId, date)` | No | Single day lookup |
| `getMonthlyAttendanceAction(classId, year, month)` | No | Range query on date field for the month |
| `getStudentSummariesAction(classId, year, month)` | No | Computes summaries in-memory: parallel fetch students + monthly attendance, iterates sorted dates to calculate consecutive absences streak |

### Parent Outreach

| Action | Plan Gate | Description |
|---|---|---|
| `saveOutreachRecordAction(data)` | Pro | Creates `parent_outreach` doc |
| `getOutreachHistoryAction(classId, studentId?)` | No | By student (limit 20) or by class (limit 50) |
| `getTwilioConfigStatusAction()` | No | Returns `{ configured: boolean }` based on env vars |

---

## API Routes

### `POST /api/attendance/outreach`

**File:** `src/app/api/attendance/outreach/route.ts`

Creates a `parent_outreach` document. Duplicate of `saveOutreachRecordAction` but as an API route (called directly from `ContactParentModal` via `fetch`). Includes plan check (pro/institution required).

**Request body:** Same fields as `ParentOutreach` minus auto-generated fields.
**Response:** `{ outreachId: string }`

### `POST /api/attendance/call`

**File:** `src/app/api/attendance/call/route.ts`

Initiates a Twilio voice call to a parent.

**Request body:**
```json
{ "outreachId": "string", "to": "+919876543210", "parentLanguage": "Hindi" }
```

**Flow:**
1. Auth check (`x-user-id` header)
2. Verify Twilio env vars exist (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`)
3. Verify ownership of outreach record
4. Check language is supported for Twilio calls (only English and Hindi have voice support)
5. Build TwiML callback URL: `{protocol}://{host}/api/attendance/twiml?outreachId={id}`
6. Build status callback URL: `{protocol}://{host}/api/attendance/twiml-status`
7. POST to Twilio REST API (`Calls.json`) with Basic auth
8. Update outreach record with `callSid`

**Response:** `{ callSid: string }`

### `GET /api/attendance/twiml` — Initial call pickup

**File:** `src/app/api/attendance/twiml/route.ts`

**PUBLIC route** — called by Twilio when the parent picks up. Validated via `X-Twilio-Signature` HMAC-SHA1.

**Query param:** `outreachId`

**Flow:** Greeting → teacher message → invite parent to speak → `<Gather input="speech dtmf">`

- Initializes transcript with agent's opening (`[{ role: 'agent', text: greeting + message }]`)
- Saves initial transcript + `turnCount: 1` to Firestore
- Falls back to `<Hangup/>` on any error or missing data

### `POST /api/attendance/twiml` — Conversational turn handler

**PUBLIC route** — receives `SpeechResult` / `Digits` from Twilio's `<Gather>`.

**Flow:**
1. Validates Twilio signature (POST variant with form params)
2. If `Digits === '2'` or `'*'` → goodbye + hangup
3. If no speech (timeout): first time → retry prompt; second time → goodbye
4. Appends parent speech to transcript
5. Calls `generateAgentReply()` → AI response in parent's language (max 3-4 sentences)
6. Appends agent reply to transcript, updates Firestore
7. If `shouldEndCall` or `turnCount >= 6` → say reply + thanks + hangup
8. Otherwise → say reply + next `<Gather>` for continued conversation
9. On AI failure → graceful English error message + hangup

### `GET /api/attendance/call-summary`

**File:** `src/app/api/attendance/call-summary/route.ts`

**Auth:** `x-user-id` header + teacherUid ownership check.

**Query param:** `outreachId`

**Returns:** `{ callStatus, callDurationSeconds, answeredBy, turnCount, transcript[], callSummary }`

### `POST /api/attendance/twiml-status`

**File:** `src/app/api/attendance/twiml-status/route.ts`

**PUBLIC route** — Twilio status callback. Receives form-encoded data.

**Key fields from Twilio:** `CallSid`, `CallStatus`

**Status mapping:**
| Twilio Status | Stored `CallStatus` |
|---|---|
| `completed` | `completed` |
| `failed` | `failed` |
| `no-answer` | `no_answer` |
| `busy` | `busy` |
| `canceled` | `failed` |

- Finds outreach record by `callSid` query, updates `callStatus`
- Captures `AnsweredBy` and `CallDuration` from Twilio
- On `completed` + `transcript.length > 1`: fire-and-forget `generateAndSaveSummary()` → saves structured `CallSummary` to Firestore
- Always returns 200 (Twilio requirement)

---

## AI Flow — Parent Message Generator

**File:** `src/ai/flows/parent-message-generator.ts`

Generates empathetic, multilingual parent notification messages via Genkit.

**Called from:** `POST /api/ai/parent-message` (not in attendance folder — standard AI route pattern)

### Input Schema (`ParentMessageInput`)

| Field | Required | Description |
|---|---|---|
| `studentName` | Yes | |
| `className` | Yes | |
| `subject` | Yes | |
| `reason` | Yes | One of 4 OutreachReason values |
| `reasonContext` | Yes | Auto-populated from `REASON_CONTEXT` map |
| `teacherNote` | No | Specific details from teacher |
| `parentLanguage` | Yes | Language name (e.g. "Hindi") |
| `consecutiveAbsentDays` | No | For absence reason |
| `teacherName` | No | Auto-enriched from user profile |
| `schoolName` | No | Auto-enriched from user profile |
| `userId` | No | Used to fetch teacher/school name |

### Output Schema (`ParentMessageOutput`)

| Field | Description |
|---|---|
| `message` | Complete ready-to-send message in parent's language. Max 250 words. |
| `languageCode` | BCP-47 code (hardcoded from `LANGUAGE_TO_BCP47` map, not AI-generated) |
| `wordCount` | Approximate word count |

### Reason Context Map

Each `OutreachReason` maps to specific prompt guidance:
- `consecutive_absences` — Express concern, ask if everything is okay, be warm not accusatory
- `poor_performance` — Focus on support and partnership, not blame
- `behavioral_concern` — Acknowledge positive qualities, describe concern objectively
- `positive_feedback` — Warm, celebratory, encourage parent to praise at home

### Key Design Decisions (Message Generator)
- `languageCode` is hardcoded from a map — never trusted from AI output
- `reasonContext` is resolved before sending to the prompt — no dynamic lookup in template
- If `userId` provided, enriches with `teacherName` and `schoolName` from user profile via `dbAdapter`
- Uses `SAHAYAK_SOUL_PROMPT` + `STRUCTURED_OUTPUT_OVERRIDE` system prompts

---

## AI Flow — Parent Call Agent (Conversational)

**File:** `src/ai/flows/parent-call-agent.ts`

Two capabilities powered by Genkit/Gemini with structured output:

### `generateAgentReply(input)` — Real-time conversational turn

**Input:** studentName, className, subject, reason, teacherMessage, teacherName?, schoolName?, parentLanguage, transcript[], parentSpeech, turnNumber

**Output:** `{ reply: string, shouldEndCall: boolean, followUpQuestion?: string }`

**Key behaviors:**
- Reply in parent's native language + script (Devanagari for Hindi, Kannada script for Kannada, etc.)
- Max 3-4 sentences (spoken on phone, not written)
- Pedagogical guidance: practical home tips (read together 10 min, check homework, praise effort)
- Wraps up naturally at turn >= 5; sets `shouldEndCall=true` at turn >= 6 or when parent is done
- Warm, conversational tone — "like a kind teacher at a chai meeting"

### `generateCallSummary(input)` — Post-call structured summary

**Input:** studentName, className, subject, reason, teacherMessage, teacherName?, schoolName?, parentLanguage, transcript[], callDurationSeconds?

**Output (`CallSummary`):**
| Field | Type | Description |
|---|---|---|
| `parentResponse` | `string` | 1-2 sentence summary |
| `parentConcerns` | `string[]` | Specific concerns raised |
| `parentCommitments` | `string[]` | Things parent agreed to do |
| `actionItemsForTeacher` | `string[]` | Recommended follow-ups (always >= 1) |
| `guidanceGiven` | `string[]` | Pedagogical advice shared |
| `parentSentiment` | `enum` | cooperative/concerned/grateful/upset/indifferent/confused |
| `callQuality` | `enum` | productive/brief/difficult/unanswered |
| `followUpNeeded` | `boolean` | Whether teacher should follow up |
| `followUpSuggestion` | `string?` | What to do next |

All summary fields in English (teacher's internal records).

---

## Security — Twilio Request Validation

**File:** `src/lib/twilio-validate.ts`

- `validateTwilioSignature(req)` — HMAC-SHA1 for GET (URL-only signing)
- `validateTwilioSignaturePost(req, params)` — HMAC-SHA1 for POST (URL + sorted form params)
- `isValidE164(phone)` — regex `/^\+[1-9]\d{6,14}$/`
- Constant-time comparison via `crypto.timingSafeEqual`
- Skipped on localhost (Twilio can't reach local dev)

---

## Twilio Integration Details

### Environment Variables Required

| Var | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio auth secret |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (From field) |

### Language Support for Voice Calls

**10 of 11 languages** supported via Google TTS voices on Twilio (Odia excluded — no Google TTS available):

| Language | Voice | Tier | Speech Recognition |
|---|---|---|---|
| English | `Google.en-IN-Neural2-A` | Neural2 (best) | `en-IN` |
| Hindi | `Google.hi-IN-Neural2-A` | Neural2 (best) | `hi-IN` |
| Kannada | `Google.kn-IN-Wavenet-A` | Wavenet | `kn-IN` |
| Tamil | `Google.ta-IN-Wavenet-A` | Wavenet | `ta-IN` |
| Telugu | `Google.te-IN-Standard-A` | Standard | `te-IN` |
| Malayalam | `Google.ml-IN-Wavenet-A` | Wavenet | `ml-IN` |
| Bengali | `Google.bn-IN-Wavenet-A` | Wavenet | `bn-IN` |
| Marathi | `Google.mr-IN-Wavenet-A` | Wavenet | `mr-IN` |
| Gujarati | `Google.gu-IN-Wavenet-A` | Wavenet | `gu-IN` |
| Punjabi | `Google.pa-IN-Wavenet-A` | Wavenet | `pa-Guru-IN` |

Only Odia returns `null` in `TWILIO_LANGUAGE_MAP` — UI hides "Call Parent" for Odia, leaving only "Copy for WhatsApp".

### Call Flow Sequence (Conversational Agent)

```
1. Teacher selects reason + optional note in ContactParentModal
2. Frontend calls POST /api/ai/parent-message → AI generates message
3. Teacher reviews message (can regenerate)
4. Teacher clicks "Call Parent"
5. Frontend calls POST /api/attendance/outreach → creates parent_outreach doc
6. Frontend calls POST /api/attendance/call with outreachId + phone + language
7. Server initiates Twilio call (Singapore edge, MachineDetection: DetectMessageEnd, 30s timeout)
8. Parent picks up → Twilio GETs /api/attendance/twiml?outreachId=X
9. Server returns TwiML: greeting → teacher message → invite parent to speak → <Gather input="speech dtmf">
10. Parent speaks → Twilio POSTs SpeechResult to /api/attendance/twiml
11. Server: saves parent speech to transcript → calls generateAgentReply() (Gemini AI) → returns <Say> + next <Gather>
12. Loop continues up to MAX_TURNS=6 (or parent presses 2 / agent decides to end)
13. Call ends → Twilio POSTs to /api/attendance/twiml-status with final status
14. Server updates callStatus; if completed + transcript > 1 turn → fire-and-forget generateCallSummary()
15. CallSummary saved to parent_outreach/{id}.callSummary (structured: concerns, commitments, action items, sentiment)
16. Frontend polls GET /api/attendance/call-summary every 5s during call, 3s after completion
```

### WhatsApp Copy Flow

```
1–3. Same as above (reason, generate, review)
4. Teacher clicks "Copy for WhatsApp"
5. Frontend calls POST /api/attendance/outreach (deliveryMethod: 'whatsapp_copy')
6. Message copied to clipboard via navigator.clipboard.writeText
7. Teacher pastes into WhatsApp manually
```

---

## Component Props/Interfaces

### AttendanceGrid

```ts
interface AttendanceGridProps {
    classId: string;
    students: Student[];
    date: string;  // YYYY-MM-DD
}
```

- On mount, loads existing attendance for the date via `getAttendanceForDateAction`
- If no existing record, defaults all students to `'present'`
- Tap-to-cycle: `present` -> `absent` -> `late` -> `present`
- "All Present" button resets all to present
- Submit calls `saveAttendanceAction`; shows "Attendance Saved" state on success
- PREMIUM_REQUIRED error handled with specific message

### ContactParentModal

```ts
interface ContactParentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: Student;
    classId: string;
    className: string;
    subject: string;
    consecutiveAbsences?: number;
    twilioConfigured: boolean;
}
```

- 3-step wizard: `reason` -> `note` -> `review`
- `canCall = twilioConfigured && !!TWILIO_LANGUAGE_MAP[student.parentLanguage]`
- Resets all state on close (with 300ms delay for animation)
- Message generation calls `/api/ai/parent-message` with auth token

### AttendanceCalendar

```ts
interface AttendanceCalendarProps {
    classId: string;
    initialSummaries?: StudentAttendanceSummary[];
}
```

- Month navigator, no future months allowed
- Skips fetch for current month if `initialSummaries` provided
- Color-coded attendance rate: >= 85% green, >= 70% amber, < 70% red

### CreateClassDialog

```ts
interface CreateClassDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: (classId: string) => void;
}
```

- Form: name, gradeLevel (from `GRADE_LEVELS`), section, subject (from `SUBJECTS`), academicYear
- Academic year defaults to `{currentYear}-{nextYear last 2 digits}`
- On success, calls `onCreated(classId)` which navigates to the new class

### StudentManager

```ts
interface StudentManagerProps {
    classId: string;
    students: Student[];
    onRefresh: () => void;
}
```

- Max 40 students (button disabled at limit, server also enforces)
- Add/Edit via side Sheet component
- Phone input strips +91 prefix for editing, re-normalizes on save
- Parent language select from `LANGUAGES` constant
- Roll number auto-increments for new students (`students.length + 1`)

---

## Key Implementation Details

### Data Loading (ClassDetailPage)

On mount, loads in parallel:
1. `getClassAction(classId)` — class metadata
2. `getStudentsAction(classId)` — student list
3. `getTwilioConfigStatusAction()` — whether Twilio env vars are set

Then sequentially loads current-month summaries via `getStudentSummariesAction` for the at-risk alert banner.

### Consecutive Absence Calculation

Computed server-side in `getStudentSummariesAction`:
- Iterates all attendance records for the month in date order
- Tracks a running streak (`currentStreak`) — incremented on `absent`, reset on `present` or `late`
- `consecutiveAbsences = max streak seen`
- Students with >= 2 consecutive absences appear in the at-risk alert banner

### Attendance Date Validation

- Cannot mark attendance for future dates
- Cannot mark attendance older than 7 days
- Date comparison uses `toLocaleDateString('sv')` for YYYY-MM-DD in local timezone (avoids UTC issues)

### Cascade Delete (deleteClassAction)

When deleting a class:
1. Batch-delete all students in `classes/{classId}/students/` (max 40 docs)
2. Delete the class document itself
3. `db.recursiveDelete(attendance/{classId})` — handles all records subcollection docs

### Phone Normalization

- StudentManager strips `+91` for display, user enters 10 digits
- Server normalizes: 10-digit -> `+91XXXXXXXXXX`, 12-digit starting with 91 -> `+XXXXXXXXXXXX`
- Invalid lengths throw error

### Premium Gating

Actions that require Pro plan: `createClassAction`, `addStudentAction`, `saveAttendanceAction`, `saveOutreachRecordAction`, outreach API route. Read-only actions (get/list) are not gated.

---

## Firestore Indexes

No composite indexes required — all queries use single equality filters. Sorting done in JavaScript:
- Classes: `where('teacherUid', '==', uid)`, sorted by `createdAt` desc in JS
- Students: `orderBy('rollNumber', 'asc')` — single field
- Attendance records: `where('date', '>=', start).where('date', '<', end)` — range on single field
- Outreach: `where('teacherUid', '==', uid)` + optional `where('studentId', '==', id)`, sorted in JS
- Status callback: `where('callSid', '==', sid).limit(1)` — single field
