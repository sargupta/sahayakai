# PAGE_INVENTORY.md — Mobile vs Web, Field-Level Parity Ledger

**What this document is.** A per-page inventory of the SahayakAI Flutter app: for every mobile screen, its **inputs** (what the teacher supplies), **parameters** (the enumerated choices/toggles that shape the request), **outputs** (what comes back and how it renders), and **primary controls** (the buttons that act on the result) — set beside the **web equivalent's** inputs/outputs/parameters so the delta is legible without cross-referencing two trees.

**Evidence roots (all citations are `file:line` under these).**
- **Mobile (`M:`):** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter` — single GoRouter `lib/core/router/app_router.dart`, path constants `lib/core/router/routes.dart`, 24 feature packages under `lib/features/`.
- **Web (`W:`):** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main` — 47 `page.tsx` under `src/app`, AI flows under `src/ai/flows`.

**Backend is shared.** Both platforms POST the same routes (`/api/ai/*`, `/api/content/*`, `/api/attendance/*`, `/api/usage`), confirmed in `lib/features/*/data/*.dart`. Every delta below is a **client-surface** delta: the server already supports the richer shape; mobile does not expose it. This matters because it means every gap is a UI/DTO omission, not a backend limitation.

**Conventions.** "plain `AiText`" = `lib/shared/widgets/ai_text.dart` (a bare `Text`, no markdown/LaTeX). "InlineFieldMic" = per-field dictation. Grade/subject/language dropdowns exist on nearly every tool; where a page adds nothing, they are stated once. **No mobile screen anywhere exports PDF or reads output aloud** (grep `pdf`/`printing` across `lib/` and `pubspec.yaml` returns nothing).

---

## 0. Cross-cutting deltas (true on almost every tool page)

| Capability | Web | Mobile | Where it bites |
|---|---|---|---|
| **PDF / print export** | Present on lesson-plan, worksheet, quiz, rubric (real printable artifacts, some pro-gated) | **Absent everywhere** | The deliverable for a chalk-and-blackboard classroom is a printout; mobile can only copy text |
| **Save to My Library** | Every tool result | **Only worksheet + exam-paper** (`worksheet_result_view.dart` `_SaveBar`, `exam_paper_result_view.dart` `_SaveBar`) | 11 of 13 tools produce ephemeral output on mobile |
| **Context image input** | lesson-plan, quiz, worksheet, assess, scanner | **Only worksheet, assess, scanner** (lesson-plan & quiz DTOs have no image key) | "Photograph the textbook page" use-case unreachable on the two biggest tools |
| **Markdown/LaTeX render** | react-markdown / KaTeX | plain `AiText` except instant-answer (custom parser) | `**bold**` and `$x^2$` render as literal characters |
| **Usage/quota badge** | Proactive "N remaining" badge + inline upgrade | Reactive only — an error card *after* a 429 | Teacher can't see remaining quota before hitting the wall |
| **Server profile enrichment** | flows back-fill language/grade/subject/state/district when `userId` present | mobile relies on the same enrichment but sends fewer client fields | Behaviour parity depends on `userId` being sent |

---

## 1. Navigation shell

### Home — `/` → `VidyaHomeScreen` (M: `lib/features/vidya/presentation/vidya_home_screen.dart:26-35`)
- **Inputs:** one large Seal Mic (voice); a quick-tools row; inbox entry button.
- **Parameters:** none — free-form spoken utterance parsed to `plannedActions[]`.
- **Outputs:** each spoken turn inks as a document block; a valid intent routes into a tool **prefilled** via `vidya_nav_dispatcher.dart` (`NAVIGATE_AND_FILL` — fills a form and drops you on it; does **not** complete by voice).
- **Controls:** Seal Mic; confirm chips on compound intent; Prep-desk app-bar action.
- **Web equivalent:** `src/app/page.tsx:89-93` → `DashboardHome` = a **topic form + MicrophoneInput + quick-action tiles**; voice agent (VIDYA) is a floating `OmniOrb` overlay (`app-shell.tsx:114`), not the page.
- **Delta:** **Mobile is the more voice-first of the two here** (founder's #1 correction, inverted vs web's form-first landing). Bottom nav identical: Home / Create / Library / Me.

### Prep Desk — `/prep-desk` → `DashboardScreen` (M: `lib/features/dashboard/presentation/dashboard_screen.dart`)
- **Inputs/Controls:** the teaching-tools register (full-width tiles, deep-link to each live route) + Recent list off `GET /api/content/list`.
- **Web equivalent:** no route — the **sidebar** (`app-sidebar.tsx:67-514`) is web's tool index. Mobile-only surface.

---

## 2. AI tool pages (13 — the strongest-mapped group)

Each page: mobile POSTs `/api/ai/<tool>`; shell is `ToolScaffold` (a ≤640dp scrolling form + sticky Generate + a VIDYA co-teacher sheet). Grade/subject/language dropdowns present unless noted. **Grade & subject option labels are English-only on mobile** (`instant_answer_screen.dart:218,239` render raw `kGradeLevels`/`kSubjects` enum strings), whereas web localizes every label (`grade-level-selector.tsx:51 {t(grade)}`) — an 11-language-mandate miss that applies to *every* tool with those dropdowns.

### 2.1 Lesson Plan — `/lesson-plan` (M: `lib/features/lesson_planner/presentation/lesson_plan_screen.dart:162-176`)
| Axis | Mobile | Web (`src/app/lesson-plan`, flow `lesson-plan-generator.ts`) |
|---|---|---|
| Inputs | topic (**+InlineFieldMic**), grade, subject, language | topic, **+context image `imageDataUri`** (`lesson-plan-sidebar.tsx:69-91`), **+NCERT chapter selector** (`:194-211`), server hyperlocal enrichment |
| Parameters | resourceLevel (low/med/high), difficultyLevel (remedial/standard/advanced), **rural toggle** | same three + `gradeLevels[]` **multi-select** (mobile is single) |
| Outputs | title, gradeLevel, duration, subject, objectives[], keyVocabulary[]{term,meaning}, materials[], activities, assessment, teacher tip, understanding check — all **plain `AiText`** | same schema (2-pass materials audit) rendered **markdown** (bold/italic) |
| Controls | **Regenerate, Copy** | Copy, Save, **PDF** (pro-gated), share |
| **Delta** | No image, no NCERT alignment (core India differentiator), no PDF, no Save, `**bold**` shows as literal asterisks | — |

### 2.2 Quiz — `/quiz-generator` (M: `lib/features/quiz_generator/presentation/quiz_generator_screen.dart:174-190`)
| Axis | Mobile | Web (`src/app/quiz-generator`) |
|---|---|---|
| Inputs | topic (+mic), grade, subject, language | topic + **context image `imageDataUri`** documented as "the primary context for the quiz" (`quiz-generator-schemas.ts:15-17`) |
| Parameters | numQuestions, questionTypes (multi-select), difficulty, **Bloom's level** | same |
| Outputs | variants[]→questions[], teacher instructions, note | same |
| Controls | **Regenerate, Copy** | Show/Hide answers, Edit, Copy, **Save**, **PDF** (separate answer-key page + branding), **Share-to-Community CTA** |
| **Delta** | Quiz is **ephemeral + copy-only**: cannot save, cannot print, cannot publish; no image input | — |

### 2.3 Worksheet Wizard — `/worksheet-wizard` (M: `lib/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart:148-158`)
| Axis | Mobile | Web (`src/app/worksheet-wizard`, `worksheet-wizard.ts`) |
|---|---|---|
| Inputs | **image (ImagePicker — present)**, prompt, grade, subject, language | same image + prompt + **ExamplePrompts starter chips** (`example-prompts.tsx:474`) |
| Parameters | — | — |
| Outputs | studentInstructions, activities[].content, answer — **plain `AiText`; LaTeX `$…$` shows raw** | KaTeX-typeset math + markdown (`worksheet-display.tsx:131-136`) |
| Controls | **Save, Regenerate, Copy** | Copy, **PDF + markdown download**, **UsageRemainingBadge + inline UpgradePrompt** |
| **Delta** | Math worksheets render broken (`$x^2$` literal); no PDF; quota only shown post-failure; no example prompts | — |

### 2.4 Rubric Generator — `/rubric-generator` (M: `lib/features/rubric_generator/presentation/rubric_generator_screen.dart:155-163`)
| Axis | Mobile | Web (`rubric-display.tsx`) |
|---|---|---|
| Inputs | assignment (text), grade, subject, language | same |
| Outputs | rubric criteria/levels table | same |
| Controls | **Regenerate, Copy** | Copy, **Save**, **PDF**, **QuickShare link**, **FeedbackDialog** |
| **Delta** | The three things you do with a finished rubric — save, print, share — all absent | — |

### 2.5 Exam Paper — `/exam-paper` (M: `lib/features/exam_paper/presentation/exam_paper_screen.dart:191-207`)
| Axis | Mobile | Web (`src/app/exam-paper`, blueprints `board-blueprints.ts`) |
|---|---|---|
| Inputs | board (dropdown), **chapters = free-text "type + tap ＋"** (`:307-376`) | **blueprint-driven chapter chips w/ per-chapter mark weightage** (`:517-544`) |
| Parameters | grade = **all 15 incl. Nursery/LKG (wrong — board exam)**, subject = static 13 + "Other" free-text, difficulty, language | grade **restricted to Class 9/10** (`:90`); subject **blueprint-aware** + "AI will generate a standard pattern" hint when no blueprint |
| Outputs | sections[]{name,label,totalMarks,questions[]}, **internalChoice (OR), per-Q source badge, Previous-Year-Questions section, maxMarks** — *richer than web* | sections + maxMarks; declares `internalChoice`/`source` but **never renders them**; no PYQ concept |
| Controls | **Save, Regenerate, Copy** | Copy; PDF is a **disabled "Coming Soon"** button |
| **Delta** | Biggest **input** regression (hand-typed chapters, nonsensical grade range, no per-chapter marks); drops per-section `instructions`. **Reverse gap:** mobile **output** is richer (OR-choices, provenance, PYQ). Neither exports PDF. | — |

### 2.6 Instant Answer — `/instant-answer` (M: `lib/features/instant_answer/presentation/instant_answer_screen.dart:163-171`)
| Axis | Mobile | Web (`src/app/instant-answer`) |
|---|---|---|
| Inputs | question (**+InlineFieldMic**), grade, subject, language | same |
| Outputs | answer via **custom markdown parser** (`answer_markdown.dart`): headings/paragraph/bullet/numbered/code/divider; **no blockquote; inline-link URLs dropped, label kept** | ReactMarkdown CommonMark — clickable links + blockquotes |
| Controls | **Regenerate, Copy** | Copy |
| **Delta** | Best-formatted mobile tool, but links degrade to plain text and quotes flatten; grade/subject labels English-only | — |

### 2.7 Teacher Training — `/teacher-training` (M: `lib/features/teacher_training/presentation/teacher_training_screen.dart:155-161`)
| Axis | Mobile | Web (`src/app/teacher-training`) |
|---|---|---|
| Inputs | question, **subject dropdown**, language | question + **response-language only** — web's UX audit **deliberately removed** the Subject dropdown ("pedagogy advice doesn't change by subject", `:506-526`) |
| Controls | Regenerate, Copy | — |
| **Delta** | **Mobile re-adds a control web cut** — the more form-heavy of the two on the exact axis the founder is worried about | — |

### 2.8 Visual Aid Designer — `/visual-aid-designer` (M: `lib/features/visual_aid/presentation/visual_aid_screen.dart:176-184`)
- **Inputs:** prompt, grade, subject, language. **Outputs:** generated teaching image + discussion-spark note. **Controls:** Regenerate, Copy. **Web:** same generation; delta minor.

### 2.9 Video Storyteller — `/video-storyteller` (M: `lib/features/video_storyteller/presentation/video_storyteller_screen.dart:153-161`)
- **Inputs:** topic, subject, grade, language. **Outputs:** `personalizedMessage` + categorized buckets of tappable `VideoCard`s (open `watchUrl`), capped 6/section — a **browse result, no Regenerate/Copy action bar**. **Web:** curated YouTube recs; parity.

### 2.10 Virtual Field Trip — `/virtual-field-trip` (M: `lib/features/virtual_field_trip/presentation/virtual_field_trip_screen.dart:171-177`)
- **Inputs:** topic, grade, language (no subject). **Outputs:** itinerary `stops[]` (count label). **Controls:** Regenerate. **Web:** Google-Earth itinerary; parity.

### 2.11 Assess Assignment — `/assess-assignment` (M: `lib/features/assess_assignment/presentation/assess_assignment_screen.dart:152-162`)
| Axis | Mobile | Web |
|---|---|---|
| Inputs | **image (required)**, mode field, transcript (conditional), language | image + **RubricPicker: 3 modes** — infer / generate-from-description / reuse-saved (`rubric-picker.tsx:52-266`, hits `/api/ai/rubric` + `/api/content/list`) |
| Outputs | rubric scorecard | same |
| Controls | Regenerate, Copy | — |
| **Delta** | **No rubric control at all** — always the backend's generic 4-criterion default; teacher can never choose what work is graded against | — |

### 2.12 Assessment Scanner — `/assessment-scanner` (M: `lib/features/assessment_scanner/presentation/assessment_scanner_screen.dart:155-165`)
- **Inputs:** pages (**multi-image**), subject, grade, language, answerKey (text). **Outputs:** multi-page grade report. **Controls:** Regenerate, Copy. **Web:** multi-page answer-sheet grader; parity on flow, same copy-only mobile ceiling.

### 2.13 Content Creator hub — `/content-creator` (M: `lib/features/content_creator/presentation/content_creator_screen.dart`)
- **No inputs/outputs/API** — a no-backend hub that deep-links to visual-aid / video-storyteller / virtual-field-trip. Explicitly "mirrors the web `content-creator/page.tsx`" (`routes.dart:87-90`). Parity.

**Voice-reach gaps (parameters axis, structural):** InlineFieldMic exists on only **5/13** tools (instant-answer, lesson-plan, quiz, video-storyteller, visual-aid); the other 8 are tap-and-type. VIDYA's `flow→route` map (`vidya_nav_dispatcher.dart:27-49`) covers 10 flows and **omits parent-message, parent-hotline, assess-assignment, assessment-scanner, content-creator** — those 5 are unreachable by voice.

---

## 3. Parent / messaging surfaces (paths mean *different things* across platforms)

### 3.1 Parent Message composer — mobile `/messages` (M: `lib/features/parent_message/presentation/parent_message_screen.dart:154-176`)
- **Inputs:** studentName, className, subject (enum), reason (`ParentMessageReason` enum), absentDays (conditional), parentLanguage, reasonContext, teacherNote, teacherName, schoolName. POST `/api/ai/parent-message`.
- **Outputs:** drafted message + wordCount. **Controls:** Regenerate, **Copy, Share** (the **only** tool with a Share control).
- **Web equivalent:** **not a route** — a modal `contact-parent-modal.tsx` opened from the attendance flow.
- **⚠ Path collision:** `routes.dart:94-95` claims mobile `/messages` "mirrors the web's `/messages` composer," but **web `/messages` is the teacher-to-teacher peer inbox** (`src/app/messages/page.tsx`). The same path resolves to two different screens; cross-platform deep-links land wrong.

### 3.2 Parent Hotline — mobile `/parent-hotline` (M: `lib/features/parent_hotline/presentation/parent_hotline_screen.dart:37`)
- **Inputs / stages:** pickStudent → reason → compose → review → **calling**. Endpoints: `POST /api/attendance/outreach` → `outreachId`, `POST /api/attendance/call`, `/api/attendance/call-summary`, `/api/attendance/outreach-latest`.
- **Parameters:** `{outreachId, parentLanguage}`. **Controls:** **WhatsApp (always offered), Call parent (language-gated; disabled with a 5-min dedup countdown)** (`:495-496`).
- **Web equivalent:** **no standalone route** — parent-calling is embedded inside `/attendance` (contact-parent-modal + `/api/attendance/call`).
- **Delta:** Mobile promotes this to first-class; web has no such page. Message-draft step is intentionally omitted from the mobile hotline repository (`parent_hotline_repository.dart:29`).

### 3.3 Peer Inbox — mobile `/inbox` + `/inbox/thread` (M: `lib/features/inbox/presentation/inbox_screen.dart`, `conversation_thread_screen.dart`)
- **Inputs/Controls:** conversation list, thread view, sign-in-gated. **Web equivalent:** `/messages` (`ConversationList` + `ConversationThread` + `NewConversationPicker`). **Delta:** same feature, **swapped paths** (see 3.1).

---

## 4. Mobile-only surfaces (no web route)

| Mobile route | Screen | Inputs / Controls | Web equivalent |
|---|---|---|---|
| `/splash` | `splash` | boot | none (web has no splash) |
| `/login` | `login` | auth | web uses an **auth modal**, not a route |
| `/onboarding` | `onboarding` | first-run profile capture | gated off in prod per project rules |
| `/prep-desk` | tool grid | tool tiles + Recent | the **sidebar** is web's tool index |
| `/library` (tab) | `LibraryScreen` | `GET /api/content/list`; **client-side type-filter chips** over newest-20; tap-to-open re-renders through the owning tool's own `*_result_view` | web "My work" sidebar group |
| `/library/:id` | detail | `GET /api/content/get` (401s on stub auth today) | — |
| `/staffroom`, `/staffroom/group/:id`, `/staffroom/chat` | staffroom | feed / groups / chat; `/api/community/persona-pulse` | web `/community` |
| `/network` | `network_hub_screen` | hub tabs (notifications tab **deferred**, `routes.dart:123-125`) | none |
| `/my-profile` | `ProfileScreen` editor | name, school, board-category, board, **subjects (multi-chip), grades (multi-chip)**, state, district, pincode, phone; PUT profile | web `/profile/[uid]` is a **public** profile (different concept) |
| `Me` (tab) | `me_screen.dart` | read-only summary header; **Plan & usage** (`GET /api/usage`, `:40-41`); Defaults board; Privacy & settings rows; Sign out | web `/usage` is a standalone route (mobile folds it in) |
| `/settings` | `settings_screen.dart` | profile (board, qualifications, admin role), **appearance/theme (system/light/dark)**, language switcher, **notifications toggle**, **Danger zone: delete account (scheduled)** | scattered across web account pages |

---

## 5. Web pages with NO mobile page (23 absent)

These have web inputs/outputs the mobile app **cannot reach at all** — no route, no DTO.

| Web route | Web inputs / outputs | Mobile |
|---|---|---|
| `/attendance`, `/attendance/[classId]`, `/attendance/[classId]/marks` | create classes, mark attendance, record marks, trigger parent calls | **Absent** — only the call slice survived as `/parent-hotline`; **no attendance/roster/marks entry** |
| `/community-library` | browse content shared by other teachers | **Absent** (staffroom has recs, no browse) |
| `/submit-content` | publish your work to community | **Absent** |
| `/review-panel` | moderation queue | **Absent** |
| `/profile/[uid]` | **public** teacher profile (view another teacher) | **Absent** — mobile profile is own-editor only |
| `/impact-dashboard` | teacher impact analytics (time saved, outputs) | **Absent** |
| `/notifications` | standalone notifications feed | **Deferred** (data exists, no route) |
| `/pricing` | plans + Razorpay checkout | **Absent** (no subscription surface anywhere) |
| `/organization/dashboard` | org/school admin dashboard + analytics | **Absent** |
| `/for-schools`, `/(marketing)/about`, `/(marketing)/terms`, 3 blog posts, 3 localized landings (`/bn`,`/kn`,`/ta`), `/` landing | B2B + marketing + legal | **Absent** (app-store listing replaces marketing) |
| `/privacy-for-teachers` | privacy explainer (also a sidebar Account item) | **Absent** |
| `/try-call` | anonymous "Hear the Call" demo-call lead magnet (`/api/demo-call`) | **Absent** ("will join" public set — not built, `routes.dart:158-159`) |
| `/api-docs`, `/api-playground` | Swagger ref + interactive playground | **Absent** |
| `/admin/cost-dashboard`, `/admin/log-dashboard` | admin cost + log dashboards | **Absent** |

---

## 6. The one-line verdict per axis

- **Inputs:** Mobile matches web on the 13 tool forms' *core* fields, but strips the high-value optional inputs — context images (lesson-plan, quiz), NCERT chapter linking, blueprint chapter chips, rubric grounding — and hand-types what web offers as tap-select.
- **Parameters:** Mostly at parity, but with three concrete wrongs — English-only grade/subject labels (11-language miss), Nursery-through-Class-8 on a *board-exam* paper, and a re-added Subject dropdown web deliberately deleted.
- **Outputs:** Web renders richer (markdown, KaTeX, links, blockquotes); mobile flattens to plain text — *except* exam-paper, where mobile is genuinely richer (OR-choices, provenance, PYQ). The generation *content* is at parity; the *presentation* is not.
- **Primary controls:** The sharpest, most uniform gap. Web finishes every task with Save + PDF + Share; mobile finishes 11 of 13 with **Copy-to-clipboard and nothing else**. For a print-artifact product used by teachers without printers-on-a-laptop, "copy text" is not the deliverable — and this is the single most consequential delta in the ledger.