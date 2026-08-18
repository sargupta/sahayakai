# SahayakAI — Flutter v1 Screen Inventory & API Contracts

**Source of truth:** `sahayakai-main` (Next.js web app). This document is the v1 build
queue for the fresh native Flutter (Material 3) Android app. The predecessor failed on
layout/design, so every screen here lists exact routes, exact backend endpoints, exact
request/response JSON, and exact form inputs. Build in the P0 order given.

---

## 0. Global contracts (read first — applies to every screen)

### Auth pattern (Firebase ID token → Bearer → `x-user-id`)
- Auth is **Firebase Authentication, Google sign-in only** (`GoogleAuthProvider`).
  On the web, mobile browsers use `signInWithRedirect`; on native Flutter use
  `google_sign_in` + `firebase_auth` `signInWithCredential` (popup/redirect not needed).
- Every authenticated API call sends header: `Authorization: Bearer <firebaseIdToken>`.
- The Next.js **middleware** (`src/middleware.ts`) verifies the ID token, then injects
  trusted headers for the route handler: `x-user-id` (= token `sub`), `x-user-email`,
  `x-user-name`, `x-user-plan` (`free` | `pro` | `gold` | `premium`).
- **The client must NEVER send `x-user-id`/`x-user-plan` itself** — middleware strips any
  client-supplied copy before verifying. Client sends only the `Authorization` header.
- On an invalid/expired token to a protected route, the server returns **401**
  `{ "error": "Invalid token" }` (or `"Unauthorized"`). Flutter must catch 401, refresh
  the Firebase token, retry once, then route to Login.
- **Content-Type:** `application/json`. All AI endpoints are **POST**.
- Optional header `X-Firebase-AppCheck: <token>` (App Check). Not enforced unless
  `APP_CHECK_REQUIRED=true`; wire it later, not P0.

### Base URL
- Production: `https://www.sahayakai.com` (canonical host; bare `sahayakai.com` 308-redirects
  to `www` for pages — always call `www`). API routes live under `/api/...`.

### Standard AI-call wrapper (mirror `src/lib/ai-fetch.ts`)
Every AI POST returns one of:
- **200** → the tool payload (shapes below).
- **403** `{ "error": "PLAN_UPGRADE_REQUIRED", "message", "feature", "requiredPlan", "currentPlan" }`
  → show upgrade prompt (`upgradeRequired`).
- **429** `{ "error": "USAGE_LIMIT_REACHED" | "DAILY_LIMIT_REACHED", "message", "feature", "used", "limit", "currentPlan" }`
  → show limit-reached prompt (`limitReached`).
- **503** `{ "error", "message" }` + `Retry-After` header → AI busy / quota; tell user to retry.
- **400** → invalid input (schema/safety); surface `message` so the teacher can rephrase.
- All AI tool endpoints are wrapped in `withPlanCheck(feature)` — **all require auth** and
  are metered per plan. `free` has monthly/daily limits; `pro`/`gold`/`premium` raise them.

### Shared enumerations (from `src/types/index.ts` — hardcode these exact lists in Flutter)

**GRADE_LEVELS** (15):
`Nursery, LKG, UKG, Class 1, Class 2, Class 3, Class 4, Class 5, Class 6, Class 7, Class 8, Class 9, Class 10, Class 11, Class 12`

**SUBJECTS** (13):
`Mathematics, Science, Social Science, History, Geography, Civics, English, Hindi, Sanskrit, Kannada, Computer Science, Environmental Studies (EVS), General`

**LANGUAGES** (11 — never Hindi-only; this is the language picker set):
`English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Malayalam, Odia`

**INDIAN_STATES** (35 — 28 states + 7 UTs):
`Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal, Delhi, Chandigarh, Jammu and Kashmir, Ladakh, Puducherry, Andaman and Nicobar Islands, Lakshadweep, Dadra and Nagar Haveli and Daman and Diu`

**EDUCATION_BOARDS** (26): `CBSE, ICSE / ISC`, then the 24 state boards:
`Andhra Pradesh State Board, Assam State Board (SEBA), Bihar State Board (BSEB), Chhattisgarh State Board (CGBSE), Goa Board of Secondary Education, Gujarat State Board (GSEB), Haryana State Board (HBSE), Himachal Pradesh State Board (HPBOSE), Jharkhand Academic Council (JAC), Karnataka State Board (KSEEB), Kerala State Board (SCERT), Madhya Pradesh State Board (MPBSE), Maharashtra State Board (MSBSHSE), Manipur State Board (COHSEM), Meghalaya State Board (MBOSE), Nagaland State Board (NBSE), Odisha State Board (BSE Odisha), Punjab State Board (PSEB), Rajasthan State Board (RBSE), Tamil Nadu State Board (SSLC), Telangana State Board (TSBIE), Tripura State Board (TBSE), UP Board (UPMSP), Uttarakhand State Board (UBSE), West Bengal State Board (WBBSE), Delhi Board (DBSE), Puducherry Board`

### Bottom navigation (from `src/components/mobile-bottom-nav.tsx`) — 4 tabs
1. **Home** — icon `Home` — route `/` (dashboard)
2. **Create** — icon `Sparkles` — **action**, opens the command palette / tool picker (not a route)
3. **Library** — icon `Library` — route `/my-library`
4. **Me** — icon `User` — route `/my-profile`

---

# PRIORITIZED v1 BUILD QUEUE

> Build strictly top-to-bottom. P0 = ship-blocking core loop. P1 = complete the tool suite.
> P2 = deferred (image/voice-heavy). Auth column: **No** = pre-login; **Yes** = Firebase Bearer required.

---

## ▶ P0 — Core loop (auth shell + top 4 teacher tools)

### P0.1 — Splash
- **Screen:** Splash / bootstrap
- **Route:** `/` (transient; Flutter native splash → auth check)
- **Purpose:** Show brand, restore Firebase session, decide Login vs Dashboard.
- **Endpoint:** none. Calls `FirebaseAuth.currentUser` + silent token refresh.
- **Request/Response:** n/a.
- **Form inputs:** none.
- **Auth:** No. Routes to Dashboard if a valid session exists, else Onboarding/Login.

### P0.2 — Onboarding / Login (Google)
- **Screen:** Onboarding + Google sign-in
- **Route:** `/onboarding` (web page) — Flutter combines the login CTA + profile setup.
- **Purpose:** Google sign-in, then collect the teacher profile that personalizes AI output.
- **Endpoint(s):**
  - Sign-in: client-side Firebase (`GoogleAuthProvider` → `signInWithCredential`). No REST call.
  - Save profile: **POST server action `updateProfileAction`** (web uses a Next server action;
    for Flutter expose/point at the profile save API — persists to Firestore `users/<uid>`).
    Fields listed below are the persisted profile document.
- **Profile fields collected (single-screen accordion, `formData` in `onboarding/page.tsx`):**
  | field | type | source list |
  |---|---|---|
  | `displayName` | string | free text |
  | `schoolName` | string | free text (triggers school→location lookup) |
  | `educationBoard` | string | EDUCATION_BOARDS |
  | `boardCategory` | string | `cbse` / `icse` / `state_board` |
  | `state` | string | INDIAN_STATES |
  | `district` | string | free text (auto-filled from pincode/school) |
  | `subjects` | string[] | SUBJECTS (multi-select) |
  | `gradeLevels` | string[] | GRADE_LEVELS (multi-select) |
  | `preferredLanguage` | Language | LANGUAGES (default `English`) |
  | `administrativeRole` | enum? | `teacher` / `hod` / `principal` (optional) |
  | `phoneNumber` | string | validated |
  | `pincode` | string | validated (drives location auto-detect) |
- **Onboarding steps:** Step 0 = language picker; Step 1 = single-screen profile form; Step 2 = "aha" preview.
- **Auth:** Sign-in = No; profile save = Yes (Bearer). Note: `ONBOARDING_GATE_ENABLED` is OFF in prod,
  so onboarding is **not** force-gated — a signed-in user can reach the dashboard without completing it.
  Treat profile completion as encouraged, not blocking.

### P0.3 — Dashboard Home
- **Screen:** Dashboard (home tab)
- **Route:** `/`
- **Purpose:** Landing surface for a signed-in teacher — greeting, quick-access tool tiles,
  recent library items, entry to Create.
- **Endpoint:** No dedicated AI call. Reads profile (`users/<uid>`) + recent content
  (library list, see P1.9). Renders tool grid that deep-links to the tool screens below.
- **Form inputs:** none (navigation surface). Hosts the 4-tab bottom nav.
- **Auth:** Yes (page renders public marketing variant if logged out; the app treats `/` as
  the dashboard once authenticated).

### P0.4 — Lesson Plan Generator ★ flagship
- **Screen:** Lesson Plan
- **Route:** `/lesson-plan`
- **Purpose:** Generate a structured (5E-model) lesson plan for a topic/grade.
- **Endpoint:** `POST /api/ai/lesson-plan`
- **Request body:**
  ```json
  {
    "topic": "Photosynthesis",              // string, required, max 1000
    "gradeLevels": ["Class 5"],             // string[], optional (GRADE_LEVELS)
    "subject": "Science",                   // string, optional (SUBJECTS)
    "language": "English",                  // string, optional (LANGUAGES), default English
    "resourceLevel": "low",                 // "low"|"medium"|"high", optional, default low
    "difficultyLevel": "standard",          // "remedial"|"standard"|"advanced", optional
    "useRuralContext": true,                // boolean, optional, default true
    "imageDataUri": "data:image/...;base64,..." // optional (textbook photo) — P2, skip in P0
  }
  ```
  (Server injects `userId`, `state`, `district`, pedagogy blocks from the profile — do not send them.)
- **Response (fields to render):**
  ```json
  {
    "title": "string",
    "gradeLevel": "string|null",
    "duration": "string|null",              // e.g. "45 minutes"
    "subject": "string|null",
    "objectives": ["string"],
    "keyVocabulary": [{ "term": "string", "meaning": "string" }],
    "materials": ["string"],
    "activities": [{
      "phase": "Engage|Explore|Explain|Elaborate|Evaluate",
      "name": "string",
      "description": "string",
      "duration": "string",
      "teacherTips": "string|null",
      "understandingCheck": "string|null"
    }],
    "assessment": "string|null",
    "homework": "string|null",
    "language": "string",
    "validationWarning": { "invalid": true, "lenient": true, "message": "string" } // nullable, show as banner
  }
  ```
- **Form inputs:** Topic (text, required) · Grade level(s) (multi-select) · Subject (select) ·
  Language (select) · Resource level (segmented low/medium/high) · Difficulty
  (segmented remedial/standard/advanced) · Rural context (toggle).
- **Auth:** Yes. `maxDuration` 120s — show a long-running loader; handle 202/503 gracefully.

### P0.5 — Quiz Generator ★
- **Screen:** Quiz Generator
- **Route:** `/quiz-generator`
- **Purpose:** Generate a quiz (returns easy/medium/hard variants) for a topic/grade.
- **Endpoint:** `POST /api/ai/quiz`
- **Request body:**
  ```json
  {
    "topic": "Fractions",                   // string, required, max 1000
    "numQuestions": 5,                      // number, default 5
    "questionTypes": ["multiple_choice", "true_false"], // required; enum members:
                                            //   "multiple_choice"|"fill_in_the_blanks"|"short_answer"|"true_false"
    "gradeLevel": "Class 6",                // string, optional
    "subject": "Mathematics",               // string, optional
    "language": "English",                  // string, optional
    "bloomsTaxonomyLevels": ["Understand", "Apply"], // string[], optional
    "targetDifficulty": "medium",           // "easy"|"medium"|"hard", optional
    "imageDataUri": "data:image/...;base64" // optional — P2
  }
  ```
- **Response (fields to render):**
  ```json
  {
    "easy":   { "title": "string", "questions": [Question], "teacherInstructions": "string", "gradeLevel": "string", "subject": "string" } | null,
    "medium": { ...same shape } | null,
    "hard":   { ...same shape } | null,
    "id": "string|null",
    "gradeLevel": "string|null",
    "subject": "string|null",
    "topic": "string|null",
    "isSaved": false
  }
  ```
  where each **Question** =
  ```json
  {
    "questionText": "string",
    "questionType": "multiple_choice|fill_in_the_blanks|short_answer|true_false",
    "options": ["string"],           // present for multiple_choice
    "correctAnswer": "string",
    "explanation": "string",
    "difficultyLevel": "easy|medium|hard"
  }
  ```
- **Form inputs:** Topic (text) · Num questions (stepper) · Question types (multi-select chips) ·
  Grade (select) · Subject (select) · Language (select) · Difficulty (select). Render 3 tabs (Easy/Medium/Hard).
- **Auth:** Yes. `maxDuration` 120s.

### P0.6 — Instant Answer ★ (fastest, cheapest — great first "aha")
- **Screen:** Instant Answer / Ask
- **Route:** `/instant-answer`
- **Purpose:** Direct, grade-tailored answer to a teacher/student question (Google-search grounded).
- **Endpoint:** `POST /api/ai/instant-answer`
- **Request body:**
  ```json
  {
    "question": "What is photosynthesis?", // string, required
    "language": "English",                 // string, optional
    "gradeLevel": "Class 5",               // string, optional
    "subject": "Science"                   // string, optional
  }
  ```
- **Response:**
  ```json
  {
    "answer": "string",                    // main body (render markdown)
    "videoSuggestionUrl": "string|null",   // optional YouTube suggestion
    "gradeLevel": "string|null",
    "subject": "string|null"
  }
  ```
- **Form inputs:** Question (multiline text, required) · Grade (select) · Subject (select) · Language (select).
- **Auth:** Yes. Metered as a **daily** limit for free plan (429 `DAILY_LIMIT_REACHED`).

### P0.7 — Settings (language switch)
- **Screen:** Settings
- **Route:** `/settings`
- **Purpose:** Switch app+AI language, theme, edit qualifications/board, delete account.
- **Endpoints:**
  - Language/theme/profile prefs → persisted client-side + profile save (server action / profile API).
  - Delete account → **POST `/api/user/delete-account`** (requires fresh re-auth token; type `DELETE` to confirm).
- **Form inputs:** Language (select — LANGUAGES, drives i18n + AI output language) ·
  Theme (light/dark via `next-themes`) · Notifications (Switch) · Education board (select) ·
  Qualifications (multi-toggle) · Administrative role · Delete-account (destructive, typed confirm).
- **Auth:** Yes (logged-out state shows a sign-in prompt card).

### P0.8 — Profile (Me)
- **Screen:** My Profile
- **Route:** `/my-profile`
- **Purpose:** View/edit teacher identity, school, grades, subjects; plan status; sign out.
- **Endpoint:** Read/write `users/<uid>` profile doc (same fields as Onboarding P0.2). Sign-out = client Firebase.
- **Form inputs:** All Onboarding profile fields, editable. Plan badge (free/pro/gold/premium) read from token.
- **Auth:** Yes.

---

## ▶ P1 — Complete the tool suite

### P1.1 — Worksheet Wizard
- **Route:** `/worksheet-wizard` · **Endpoint:** `POST /api/ai/worksheet`
- **Purpose:** Generate a worksheet from a textbook-page photo + prompt.
- **Request body:**
  ```json
  {
    "imageDataUri": "data:image/png;base64,...", // string, REQUIRED (textbook photo)
    "prompt": "Create a multiplication worksheet from this page", // string, required, max 2000
    "gradeLevel": "Class 4",   // optional
    "subject": "Mathematics",  // optional
    "language": "English"      // optional
  }
  ```
- **Response:**
  ```json
  {
    "title": "string", "gradeLevel": "string", "subject": "string",
    "learningObjectives": ["string"],
    "studentInstructions": "string",
    "activities": [{ "type": "question|puzzle|creative_task", "content": "string", "explanation": "string", "chalkboardNote": "string" }],
    "answerKey": [ ... ]   // present when generated
  }
  ```
- **Form inputs:** Image (camera/gallery, **required**) · Prompt (text) · Grade · Subject · Language.
- **Auth:** Yes. Note: image-dependent → schedule with P2 camera work if camera not yet built,
  but the tool itself is P1.

### P1.2 — Rubric Generator
- **Route:** `/rubric-generator` · **Endpoint:** `POST /api/ai/rubric`
- **Purpose:** Generate a performance rubric for an assignment.
- **Request body:**
  ```json
  {
    "assignmentDescription": "A Class 5 project on renewable energy", // string, required, max 2000
    "gradeLevel": "Class 5", "subject": "Science", "language": "English" // all optional
  }
  ```
- **Response:**
  ```json
  {
    "title": "string",
    "description": "string",
    "criteria": [{
      "name": "string",
      "description": "string",
      "levels": [{ "name": "Exemplary", "description": "string", "points": 4 }]
    }],
    "gradeLevel": "string", "subject": "string"
  }
  ```
- **Form inputs:** Assignment description (multiline, required) · Grade · Subject · Language.
- **Auth:** Yes. Render as a criteria × levels grid/table.

### P1.3 — Exam Paper Generator (board-pattern)
- **Route:** `/exam-paper` · **Endpoint:** `POST /api/ai/exam-paper`
- **Purpose:** Generate a full board-blueprint exam paper with answer key + marking scheme.
- **Request body:**
  ```json
  {
    "board": "CBSE",              // string, REQUIRED (EDUCATION_BOARDS)
    "gradeLevel": "Class 10",     // string, REQUIRED (GRADE_LEVELS)
    "subject": "Mathematics",     // string, REQUIRED (SUBJECTS)
    "chapters": ["Quadratic Equations", "Triangles"], // string[]; [] = all chapters
                                  // NOTE: for non-blueprinted board/grade/subject, >=1 chapter REQUIRED (else 400)
    "difficulty": "mixed",        // "easy"|"moderate"|"hard"|"mixed", default mixed
    "language": "English",        // default English
    "includeAnswerKey": true,     // default true
    "includeMarkingScheme": true  // default true
  }
  ```
- **Response:**
  ```json
  {
    "title": "string", "board": "string", "subject": "string", "gradeLevel": "string",
    "duration": "3 Hours", "maxMarks": 80,
    "generalInstructions": ["string"],
    "sections": [{
      "name": "Section A", "label": "Multiple Choice Questions", "totalMarks": 20,
      "questions": [{
        "number": 1, "text": "string", "marks": 1,
        "options": ["(a) ...","(b) ...","(c) ...","(d) ..."],  // MCQs only
        "internalChoice": "string|null",
        "answerKey": "string", "markingScheme": "string",
        "source": "AI Generated|PYQ 2019"
      }]
    }],
    "blueprintSummary": { "chapterWise": [{ "chapter": "string", "marks": 0 }], "difficultyWise": [{ "level": "string", "percentage": 0 }] },
    "pyqSources": [{ "id": "string", "year": 2019, "chapter": "string" }]
  }
  ```
- **Also:** `PUT /api/ai/exam-paper` with `{ "paper": <the generated object> }` → saves to library
  (`{ "success": true, "contentId": "string" }`).
- **Special statuses:** **202** `{ "error": "generation_in_progress", "message": "...Check My Library in 1 minute" }`
  (still generating — poll library). **422** `{ "error": "exam_paper_unstructured", "code": "SCHEMA_VALIDATION_FAILED" }`
  (retry with fewer chapters). Handle both distinctly.
- **Form inputs:** Board (select, required) · Grade (select, required) · Subject (select, required) ·
  Chapters (add-chip list) · Difficulty (segmented) · Language · Include answer key (toggle) ·
  Include marking scheme (toggle).
- **Auth:** Yes. `maxDuration` 120s.

### P1.4 — Teacher Training / Coach
- **Route:** `/teacher-training` · **Endpoint:** `POST /api/ai/teacher-training`
- **Purpose:** Personalized pedagogical/professional-development advice.
- **Request body:**
  ```json
  { "question": "How do I manage a classroom of 40 students?", // required, max 2000
    "subject": "General", "language": "English" }              // optional
  ```
- **Response:**
  ```json
  {
    "introduction": "string",
    "advice": [{ "strategy": "string", "pedagogy": "string", "explanation": "string" }],
    "conclusion": "string",
    "gradeLevel": "string|null", "subject": "string|null"
  }
  ```
- **Form inputs:** Question (multiline, required) · Subject · Language.
- **Auth:** Yes.

### P1.5 — Parent Message Generator
- **Route:** `/messages` (composer) · **Endpoint:** `POST /api/ai/parent-message`
- **Purpose:** Draft an empathetic, ready-to-send message to a student's parent in the parent's language.
- **Request body:**
  ```json
  {
    "studentName": "Ravi Kumar",        // required
    "className": "Class 6A",            // required
    "subject": "Mathematics",           // required
    "reason": "poor_performance",       // required enum:
                                        //  "consecutive_absences"|"poor_performance"|"behavioral_concern"|"positive_feedback"
    "reasonContext": "string",          // guidance text
    "parentLanguage": "Hindi",          // required (LANGUAGES-ish enum)
    "teacherNote": "string",            // optional
    "consecutiveAbsentDays": 3,         // optional (absence reason)
    "teacherName": "string",            // optional (sign-off)
    "schoolName": "string"              // optional
  }
  ```
  (Returns **400** `{ "error": "Missing required fields" }` if studentName/className/subject/reason/parentLanguage absent.)
- **Response:**
  ```json
  { "message": "string",       // ready-to-send, <=250 words, in parentLanguage
    "languageCode": "hi-IN",   // BCP-47
    "wordCount": 180 }
  ```
- **Form inputs:** Student name · Class · Subject · Reason (select) · Reason context · Parent language (select) ·
  Teacher note (optional) · Absent days (number, if absence) · Teacher name · School name.
- **Auth:** Yes. Add a "copy / share to WhatsApp" action on the result.

### P1.6 — Assess Assignment (grade a photo)
- **Route:** `/assess-assignment` · **Endpoint:** `POST /api/ai/assess-assignment`
- **Purpose:** Grade a handwritten student assignment from a photo against a rubric.
- **Request body:**
  ```json
  {
    "imageDataUri": "data:image/jpeg;base64,...", // REQUIRED (student-work photo)
    "rubricSnapshot": { ... },   // optional rubric object (from P1.2)
    "language": "English",       // optional
    "studentId": "string",       // optional
    "mode": "full"               // "full"|"transcribe"|"score", optional
    // NOTE: do NOT send studentName — server strips PII before the model.
  }
  ```
- **Response:** structured assessment — transcript, overall score, per-criterion feedback, strengths,
  improvements, next steps, per-criterion confidence (render as scorecard).
- **Form inputs:** Image (camera, required) · Rubric (optional picker) · Language · Mode (segmented).
- **Auth:** Yes. Uses the most expensive model (gemini-2.5-pro) → strict per-day token budget; expect 429s.
  Image-dependent — pair with P2 camera work.

### P1.7 — My Library
- **Route:** `/my-library` (bottom-nav "Library")
- **Purpose:** List/open the teacher's saved generations (lesson plans, quizzes, worksheets, rubrics,
  exam papers, etc.).
- **Endpoint:** Library list/read API over Firestore + Storage (`users/<uid>/...`). Content docs carry
  `{ id, type, title, gradeLevel, subject, topic, language, storagePath, createdAt }`.
- **Form inputs:** none (list + filters by type). Tapping an item re-renders the tool's result view.
- **Auth:** Yes.

### P1.8 — Create / Command Palette (tool picker)
- **Trigger:** "Create" bottom-nav tab (action, not a route) → opens the tool picker sheet.
- **Purpose:** Searchable list of all tools that deep-links into each tool screen above.
- **Endpoint:** none.
- **Auth:** Yes. In Flutter, implement as a modal bottom sheet / search sheet listing the P0–P1 tools.

---

## ▶ P2 — Deferred (image-heavy / voice / media — build after the text loop is solid)

These exist as web routes + endpoints but rely on camera, audio, image generation, or video and
should NOT block v1. Listed for completeness with their endpoints.

| Screen | Route | Endpoint | Why deferred |
|---|---|---|---|
| Visual Aid Designer | `/visual-aid-designer` | `POST /api/ai/visual-aid` | AI image generation (~$0.04/img, most expensive) |
| Assessment Scanner | `/assessment-scanner` | `POST /api/ai/assessment-scanner` | Camera + vision OCR |
| Video Storyteller | `/video-storyteller` | `POST /api/ai/video-storyteller` | Video recommendation/generation |
| Virtual Field Trip | `/virtual-field-trip` | `POST /api/ai/virtual-field-trip` | Media-heavy |
| Voice-to-Text | (used inside tools) | `POST /api/ai/voice-to-text` | Mic capture; wire into inputs later |
| Avatar | `/profile` avatar | `POST /api/ai/avatar` | Image gen |
| Content Creator | `/content-creator` | (composite) | Depends on above |
| Attendance | `/attendance` | `/api/attendance/*` (Twilio) | Voice-call infra |
| Try Call / Demo Call | `/try-call` | `/api/demo-call` (anon, flag-gated) | Telephony; also anon lead-magnet, off by default |
| Community / Library-share | `/community`, `/community-library` | community APIs | Social; not core teacher loop |
| Impact Dashboard | `/impact-dashboard` | analytics APIs | Reporting |
| Pricing / Usage | `/pricing`, `/usage` | billing APIs | Monetization; add after core loop |
| Notifications | `/notifications` | notifications API | Secondary |

**Image/voice inputs across P0/P1 tools:** several text tools accept an optional `imageDataUri`
(lesson-plan, quiz) or require one (worksheet, assess-assignment). Ship the text path first;
add camera/gallery → base64 data-URI (`data:image/<jpeg|png|webp>;base64,...`, cap ~14 MB) as a
fast-follow. Mic/voice-to-text is P2.

---

## Ordered P0 screen list (the exact build order)
1. **Splash** — `/` bootstrap, no auth
2. **Onboarding / Login (Google)** — `/onboarding`, sign-in no-auth → profile save auth
3. **Dashboard Home** — `/`, auth, hosts 4-tab bottom nav
4. **Lesson Plan** — `/lesson-plan` → `POST /api/ai/lesson-plan`, auth
5. **Quiz Generator** — `/quiz-generator` → `POST /api/ai/quiz`, auth
6. **Instant Answer** — `/instant-answer` → `POST /api/ai/instant-answer`, auth
7. **Settings** — `/settings` (language switch, theme, delete account), auth
8. **Profile (Me)** — `/my-profile`, auth

Then P1: Worksheet · Rubric · Exam Paper · Teacher Training · Parent Message · Assess Assignment ·
My Library · Create palette. P2 = image/voice/media/social/billing screens.
