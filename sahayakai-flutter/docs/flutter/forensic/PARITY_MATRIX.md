# PARITY_MATRIX.md — Page × Axis Parity Ledger

**Date:** 2026-07-28. **Subject app:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter` (405 dart files, `lib/features/*`, `com.sargvision.sahayakai` — the real, shipping app). **Web source of truth:** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src`. This is the scannable distillation of the four verified sibling docs (`VOICE_FIRST_GAP.md`, `REMEDIATION_PLAN.md`, `BUG_FORENSICS.md`, `PAGE_INVENTORY.md`); every mobile citation is a real `lib/features/*` (or `lib/shared/*`) path — no `lib/src/*` (stale tree) paths appear.

---

## Overall verdict (read this first)

**Mobile is at parity or ahead of web on the entire *front* of the voice pipe and on generation *content*, and behind on every *payoff* axis — output fidelity, finishing controls, and the last inch of the voice loop.** The capture → VAD → 11-language STT → intent-classify → TTS-speak-back → closed-flow-guard → compound-chip chain is fully built and matches or beats the production web Omni-Orb; the home tab is a genuine voice canvas web does not have. But at the moment a spoken sentence should become a finished artifact, mobile pre-fills the tool form and **stops at a Generate button** (`vidya_nav_dispatcher.dart` pushes prefill, no `_submit` ever fires — a repo-wide grep for `autoSubmit` returns nothing), where web auto-runs on a 300 ms timer. Downstream the same shortfall compounds: model output renders through a bare `Text` widget so LaTeX and `**bold**` come out as literal characters; 11 of 13 tool results finish with **copy-to-clipboard and nothing else** (no PDF, no Save, no Share — the actual deliverable for a printerless classroom); grade/subject dropdowns and ~48% of UI strings leak English on the 10 non-English locales, violating the hard 11-language mandate on the exact forms voice strands the teacher on; and four whole web surfaces (Attendance/roster/marks, Community Library, Impact Dashboard, Org dashboard) have no mobile route at all. The plumbing is sophisticated and the backend is shared — every gap below is a client-side UI/DTO omission, not an API limit — but the app is voice-first at the entrance and keyboard-era at the desk.

**Legend.** `PARITY` = at web parity or ahead. `GAP(BLOCKER|HIGH|MED|LOW)` = mobile behind, severity in parens. Axes per page: **design** (color/layout), **content**, **features**, **voice** (voice-first / product-concept), **output** (output-fidelity), **params** (parameters), **inputs**.

---

## AI tool pages (13)

### 1. Lesson Plan — mobile `/lesson-plan` (`lib/features/lesson_planner/presentation/lesson_plan_screen.dart`) · web `src/app/lesson-plan`
| Axis | Verdict | Note |
|---|---|---|
| design | GAP(LOW) | `ToolScaffold` scrolling form ≤640dp of 7 stacked fields (`tool_scaffold.dart:8`); functional, not the richer web layout |
| content | PARITY | Same schema (title/objectives/vocab/materials/activities/assessment); backend flow shared |
| features | GAP(HIGH) | Result bar is Regenerate + Copy only (`lesson_plan_result_view.dart`); no Save, no PDF, no share vs web |
| voice | GAP(HIGH) | `initState`→`_applyPrefill` (:58-79) fills fields; `_submit` bound only to Generate button (:151) — voice fills, never runs |
| output | GAP(LOW) | `AiText` bare `Text` renders `**bold**`/`*italic*` as literal asterisks (`ai_text.dart:25-36`, `lesson_plan_result_view.dart:80,363`) |
| params | GAP(MED) | Single grade only + English-only grade/subject labels; web has `gradeLevels[]` multi-select + localized `{t(grade)}` |
| inputs | GAP(HIGH) | No context-image (`imageDataUri`), no NCERT chapter selector — core India differentiators absent from the DTO |

### 2. Quiz — mobile `/quiz-generator` (`lib/features/quiz_generator/presentation/quiz_generator_screen.dart`) · web `src/app/quiz-generator`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Standard `ToolScaffold` form; parity |
| content | PARITY | variants[]→questions[], Bloom's, teacher instructions — same shape |
| features | GAP(HIGH) | Ephemeral + copy-only; web has Show/Hide answers, inline Edit, Save, PDF (answer-key page), Share-to-Community |
| voice | GAP(HIGH) | Same fill-but-never-run dispatcher; no auto-submit after prefill |
| output | GAP(LOW) | Read-only, plain text; web result is an editable workspace (per-question refine/add) |
| params | GAP(MED) | English-only grade/subject labels (11-lang miss); Bloom's + numQ + types otherwise at parity |
| inputs | GAP(HIGH) | No image input though schema calls `imageDataUri` "the primary context for the quiz" (`quiz.dart:45` comment defers it) |

### 3. Instant Answer — mobile `/instant-answer` (`lib/features/instant_answer/presentation/instant_answer_screen.dart`) · web `src/app/instant-answer`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Standard form; best-formatted mobile result |
| content | PARITY | Google-Search-grounded answer; server auto-persists |
| features | GAP(MED) | Regenerate + Copy only; web adds Copy (answer already saved server-side, so Save is lower-value here) |
| voice | GAP(HIGH) | `initState`→`_applyPrefill` (:61-81); `ask()` reachable only via `_submit`→button (:154) — fills, never runs |
| output | GAP(LOW-MED) | Custom parser (`answer_markdown.dart`) **drops link URLs** (:239-241) and has **no blockquote** (:59-98) — citation links become dead text on a "powered by Search" tool |
| params | GAP(MED) | English-only grade/subject labels (`instant_answer_screen.dart:218,239` render raw enums) |
| inputs | PARITY | question + InlineFieldMic present; matches web |

### 4. Worksheet Wizard — mobile `/worksheet-wizard` (`lib/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart`) · web `src/app/worksheet-wizard`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Form + image row; parity |
| content | PARITY | studentInstructions/activities/answer — same flow |
| features | GAP(HIGH) | Save + Regenerate + Copy; no PDF (the print handout is the deliverable), no markdown download, no proactive usage badge |
| voice | GAP(HIGH) | Same fill-but-never-run gap |
| output | GAP(**HIGH**) | **Math renders as raw LaTeX** — flow emits all math as `$…$` (`worksheet-wizard.ts` rule 5), mobile prints it literally via `AiText` (`worksheet_result_view.dart:90-105`); web typesets with KaTeX. Every math worksheet looks broken |
| params | PARITY | Minimal params; parity |
| inputs | GAP(LOW) | Image + prompt present (good); web adds ExamplePrompts starter chips |

### 5. Rubric Generator — mobile `/rubric-generator` (`lib/features/rubric_generator/presentation/rubric_generator_screen.dart`) · web `rubric-display.tsx`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Standard form |
| content | PARITY | Criteria/levels table; same |
| features | GAP(HIGH) | The three things you do with a rubric — Save, PDF, QuickShare link, FeedbackDialog — all absent; Regenerate + Copy only |
| voice | GAP(HIGH) | `initState`→`_applyPrefill` (:54-76); `_submit` fires only from button (:144) — fills, never runs |
| output | GAP(LOW) | Plain-text render |
| params | GAP(MED) | English-only grade/subject labels |
| inputs | PARITY | assignment text + grade/subject/language; parity |

### 6. Exam Paper — mobile `/exam-paper` (`lib/features/exam_paper/presentation/exam_paper_screen.dart`) · web `src/app/exam-paper`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Multi-section form |
| content | PARITY | sections/questions; both drive board blueprints |
| features | GAP(MED) | Save + Regenerate + Copy; web PDF is itself a disabled "Coming Soon" — near-parity on export |
| voice | GAP(HIGH) | Same dispatcher gap; also not in VIDYA's flow map |
| output | **PARITY (mobile ahead)** | Mobile renders internalChoice (OR), per-Q source badge, Previous-Year-Questions, maxMarks — web declares but never renders these |
| params | GAP(**MED**) | **Grade list offers Nursery/LKG/UKG/Class 1-8** for a *board* exam (`picker_options.dart:11-27`); web restricts to Class 9/10 (`page.tsx:90`) — invalid input space |
| inputs | GAP(MED) | Chapters are hand-typed free-text (`:307-376`); web has blueprint chapter chips with per-chapter mark weightage; mobile drops per-section instructions |

### 7. Teacher Training — mobile `/teacher-training` (`lib/features/teacher_training/presentation/teacher_training_screen.dart`) · web `src/app/teacher-training`
| Axis | Verdict | Note |
|---|---|---|
| design | GAP(LOW) | More form-heavy than web on the exact axis under scrutiny |
| content | PARITY | Pedagogy advice; same flow |
| features | GAP(MED) | Regenerate + Copy only |
| voice | GAP(HIGH) | Same fill-but-never-run gap |
| output | GAP(LOW) | Plain `AiText` |
| params | **GAP (mobile regression)** | Mobile **re-adds a Subject dropdown web deliberately removed** ("pedagogy advice doesn't change by subject", `teacher-training/page.tsx:506-526`) |
| inputs | PARITY | question + language |

### 8. Assess Assignment — mobile `/assess-assignment` (`lib/features/assess_assignment/presentation/assess_assignment_screen.dart`) · web
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Image + mode form |
| content | PARITY | Rubric scorecard; same |
| features | GAP(MED) | Regenerate + Copy; no result read-aloud on either grader (HEAR half unmet both platforms) |
| voice | GAP(HIGH) | Not in VIDYA flow map — unreachable by voice entirely |
| output | GAP(LOW) | Plain-text scorecard |
| params | GAP(HIGH) | **No rubric control** — always the backend's generic 4-criterion default; web `RubricPicker` offers infer / generate-from-description / reuse-saved (`rubric-picker.tsx:52-266`) |
| inputs | PARITY | Image (required) + transcript + language |

### 9. Assessment Scanner — mobile `/assessment-scanner` (`lib/features/assessment_scanner/presentation/assessment_scanner_screen.dart`) · web
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Multi-image + answer-key form |
| content | PARITY | Multi-page grade report; parity on flow |
| features | GAP(MED) | Regenerate + Copy only (same copy-only ceiling) |
| voice | GAP(HIGH) | Not in VIDYA flow map — unreachable by voice |
| output | GAP(LOW) | Plain-text report |
| params | PARITY | subject/grade/language |
| inputs | PARITY | pages (multi-image) + answerKey |

### 10. Visual Aid Designer — mobile `/visual-aid-designer` (`lib/features/visual_aid/presentation/visual_aid_screen.dart`) · web `visual-aid-designer`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Prompt form |
| content | PARITY | Generated teaching image + discussion note |
| features | GAP(MED) | Regenerate + Copy; no Save/Share of the image |
| voice | GAP(HIGH) | Same fill-but-never-run gap (`visual-aid-designer/page.tsx:334` auto-submits on web) |
| output | PARITY | Image output; parity |
| params | GAP(MED) | English-only grade/subject labels |
| inputs | PARITY | prompt + InlineFieldMic present |

### 11. Video Storyteller — mobile `/video-storyteller` (`lib/features/video_storyteller/presentation/video_storyteller_screen.dart`) · web `src/app/video-storyteller`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Categorized `VideoCard` buckets |
| content | PARITY | YouTube recommender on **both** — no video *generation* anywhere on web either |
| features | GAP(LOW) | Opens `watchUrl` externally (`video_card.dart:24-30`); web `window.open`s too — near parity; on-card play glyph decorative |
| voice | PARTIAL | In VIDYA flow map + InlineFieldMic present; but no auto-submit |
| output | PARITY | Browse result; parity |
| params | GAP(MED) | English-only grade/subject labels |
| inputs | PARITY | topic/subject/grade/language |

### 12. Virtual Field Trip — mobile `/virtual-field-trip` (`lib/features/virtual_field_trip/presentation/virtual_field_trip_screen.dart`) · web `virtual-field-trip`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Itinerary stops list |
| content | PARITY | stops[] itinerary; parity |
| features | GAP(MED) | Regenerate only; no Save/Share |
| voice | GAP(HIGH) | Same fill-but-never-run gap (`virtual-field-trip/page.tsx:318` auto-submits on web) |
| output | PARITY | Itinerary render |
| params | PARITY | topic/grade/language (no subject, matches web) |
| inputs | PARITY | topic + grade |

### 13. Content Creator hub — mobile `/content-creator` (`lib/features/content_creator/presentation/content_creator_screen.dart`) · web `content-creator`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Deep-link hub, no backend |
| content | PARITY | Mirrors web hub |
| features | PARITY | Routes to visual-aid / video / field-trip |
| voice | GAP(LOW) | Not in VIDYA flow map (hub only, low impact) |
| output | PARITY | n/a |
| params | PARITY | n/a |
| inputs | PARITY | n/a |

---

## Parent / messaging surfaces

### 14. Parent Message — mobile `/messages` (`lib/features/parent_message/presentation/parent_message_screen.dart`) · web modal `contact-parent-modal.tsx`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Full composer form |
| content | PARITY | Drafted message + wordCount; same flow |
| features | **PARITY (mobile ahead)** | Only mobile tool with a **Share** control (Regenerate/Copy/Share); web is a modal, not a route |
| voice | GAP(HIGH) | Not in VIDYA flow map — unreachable by voice (parent loop ceiling) |
| output | GAP(LOW) | Plain-text draft |
| params | PARITY | reason enum, absentDays, parentLanguage, context |
| inputs | GAP(LOW) | **Path collision:** `routes.dart:94-95` claims it mirrors web `/messages`, but web `/messages` is the peer inbox — deep-links land wrong |

### 15. Parent Hotline — mobile `/parent-hotline` (`lib/features/parent_hotline/presentation/parent_hotline_screen.dart`) · web embedded in `/attendance`
| Axis | Verdict | Note |
|---|---|---|
| design | **PARITY (mobile ahead)** | First-class staged flow (pickStudent→reason→compose→review→calling); web has no standalone page |
| content | PARITY | Same Twilio/Exotel voicebot (`api/attendance/call/route.ts`) |
| features | PARITY | WhatsApp + Call parent (language-gated, 5-min dedup countdown, :495-496) |
| voice | GAP(**BLOCKER for the thesis**) | "AI calls Ravi's mother because I asked it to" is **not voice-reachable** — `VidyaFlow` (`vidya_action.dart:12-22`) has no `parentHotline`; shared 10-flow ceiling with web |
| output | PARITY | Call summary via `/api/attendance/call-summary` |
| params | PARITY | `{outreachId, parentLanguage}` |
| inputs | GAP(LOW) | Message-draft step intentionally omitted (`parent_hotline_repository.dart:29`) |

---

## Voice / navigation / account surfaces

### 16. VIDYA voice home — mobile `/` (`lib/features/vidya/presentation/vidya_home_screen.dart`, `vidya_controller.dart`) · web `OmniOrb` overlay (`omni-orb.tsx`)
| Axis | Verdict | Note |
|---|---|---|
| design | **PARITY (mobile ahead)** | Home tab **is** a voice canvas; web boots to a form-first `DashboardHome` with the orb as overlay |
| content | PARITY | Spoken turn inks as document block; quick-tools row |
| features | GAP(MED) | Launcher **not omnipresent** — VIDYA absent from Library/Me/inbox/staffroom/network (they skip `ToolScaffold`); web mounts one global orb (`app-shell.tsx:119`) |
| voice | **PARITY on capture, GAP(HIGH) on act** | Hands-free VAD (`vidya_controller.dart:531-542`), 11-lang STT, classify, TTS speak-back, compound chips all at parity; the single `NAVIGATE_AND_FILL` → **stops** (no `_AND_RUN`) is the whole gap |
| output | GAP(HIGH) | TTS has exactly one caller — VIDYA's chat sentence (`vidya_controller.dart:651-659`); **no result view reads the deliverable aloud** — HEAR half of the loop unmet |
| params | PARITY | Closed 10-flow guard (`vidya_action.dart:12-22`) mirrors web `KNOWN_FLOWS` |
| inputs | GAP(MED) | InlineFieldMic on only 5/13 tools; 8 tools + 5 flows (parent-message/hotline/assess/scanner/content-creator) unreachable by voice |

### 17. Library — mobile `/library` tab + `/library/:id` (`lib/features/library/presentation/library_screen.dart`) · web "My work" sidebar
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Type-filter chips over newest-20; tap re-renders via owning tool's result view |
| content | PARITY | `GET /api/content/list`; shared backend |
| features | GAP(HIGH) | Only worksheet + exam-paper can Save *into* it (`_SaveBar`); 11 of 13 tools produce ephemeral output that never persists |
| voice | GAP(LOW) | No VIDYA action on this surface |
| output | GAP(LOW) | `/library/:id` detail 401s on stub auth today |
| params | PARITY | client-side filter |
| inputs | PARITY | n/a (read surface) |

### 18. Inbox (peer) — mobile `/inbox` + `/inbox/thread` (`lib/features/inbox/presentation/inbox_screen.dart`, `conversation_thread_screen.dart`) · web `/messages`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Conversation list + thread, sign-in-gated |
| content | PARITY | Same peer-messaging feature |
| features | GAP(HIGH) | **Voice-note messaging dropped** — audio type modeled but rendered as a dead badge (`message_bubble.dart:164-219`), no recorder in composer; web ships record→upload→play |
| voice | GAP(LOW) | No VIDYA action here |
| output | GAP(MED) | `AudioBubble` playback absent |
| params | PARITY | — |
| inputs | GAP(LOW) | Path swap vs web `/messages` (see Parent Message collision) |

### 19. Staffroom — mobile `/staffroom` (+ `/group/:id`, `/chat`) (`lib/features/staffroom/presentation/*`) · web `/community`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Feed / groups / chat |
| content | PARITY | `/api/community/persona-pulse` |
| features | GAP(MED) | No browse-shared-content (that lives in web `/community-library`, absent on mobile) |
| voice | GAP(LOW) | No VIDYA action |
| output | GAP(LOW) | Voice-note playback absent in community chat too |
| params | PARITY | — |
| inputs | PARITY | — |

### 20. Profile / Me — mobile `/my-profile` + `Me` tab (`lib/features/profile/presentation/profile_screen.dart`, `me_screen.dart`) · web `/profile/[uid]` (public) + `/usage`
| Axis | Verdict | Note |
|---|---|---|
| design | PARITY | Editor: name/school/board/subjects(multi-chip)/grades(multi-chip)/state/district/pincode/phone |
| content | PARITY | PUT profile; `GET /api/usage` folded into Me tab |
| features | GAP(LOW) | Own-editor only; web `/profile/[uid]` is a **public** profile (different concept, no mobile equivalent) |
| voice | GAP(MED) | Onboarding/profile not voice-fillable; no VIDYA capture |
| output | PARITY | Plan & usage summary |
| params | PARITY | Defaults board |
| inputs | PARITY | Full profile field set at parity |

### 21. Settings — mobile `/settings` (`lib/features/settings/presentation/settings_screen.dart`) · web scattered across account pages
| Axis | Verdict | Note |
|---|---|---|
| design | **PARITY (mobile ahead)** | Consolidated: profile, appearance/theme, language, notifications, Danger zone (scheduled delete) |
| content | PARITY | Same settings surface |
| features | PARITY | Theme (system/light/dark) + notifications toggle |
| voice | GAP(LOW) | No VIDYA action |
| output | PARITY | n/a |
| params | PARITY | board/qualifications/admin role |
| inputs | PARITY | n/a |

### 22. Onboarding — mobile `/onboarding` (`lib/features/onboarding/presentation/onboarding_screen.dart`) · web onboarding `page.tsx`
| Axis | Verdict | Note |
|---|---|---|
| design | GAP(MED) | "Terrible" per founder; substantially correct — choreography + payoff diverge |
| content | GAP(MED) | Dead-ends on a read-back of what the teacher typed (`onboarding_screen.dart:577-645`); web generates + saves a first lesson (`page.tsx:488-536`) |
| features | GAP(MED) | **Duplicate language step** — asked on login *and* onboarding step 0 (`onboarding_screen.dart:528-575`); web asks once, pre-selects from `navigator.language` |
| voice | GAP(HIGH) | Grep `mic\|voice\|speech` across `lib/features/onboarding` returns nothing — a silent form corridor into a voice-first home, no bridge |
| output | GAP(MED) | No mother-tongue spoken greeting (web `mother-tongue-greeting.tsx:72`) |
| params | PARITY | Same profile field set |
| inputs | GAP(MED) | No device-locale pre-selection; keyboard-only capture |

### 23. Dashboard / Prep Desk — mobile `/prep-desk` (`lib/features/dashboard/presentation/dashboard_screen.dart`, `app_shell.dart`) · web sidebar
| Axis | Verdict | Note |
|---|---|---|
| design | **PARITY (mobile-only surface)** | Full-width tool tiles + Recent list (`GET /api/content/list`); web's tool index is the sidebar |
| content | PARITY | Teaching-tools register deep-links to live routes |
| features | GAP(MED) | Shell `IndexedStack` (`app_shell.dart:49-57`) has no persistent floating mic; web orb is shell-level |
| voice | GAP(MED) | Launcher not omnipresent across shell tabs |
| output | PARITY | Recent list |
| params | PARITY | — |
| inputs | PARITY | — |

---

## Web-only pages (no mobile route — mobile: ABSENT)

Each of these has a confirmed web page and **no** mobile route or DTO — nothing to grade per-axis beyond ABSENT.

### 24. Attendance — web `src/app/attendance/page.tsx` (+ `[classId]/page.tsx`, `[classId]/marks/page.tsx`) · mobile: **ABSENT**
| Axis | Verdict | Note |
|---|---|---|
| all axes | GAP(HIGH) | Create classes, mark attendance, record marks, trigger parent calls — **only the call slice survived** as `/parent-hotline`; no roster/attendance/marks entry on mobile (`routes.dart` has no attendance route). This is also why one-shot voice parent-calling has no contact source to resolve `{studentName}→{guardianPhone}` |

### 25. Community Library — web `src/app/community-library/page.tsx` (+ `submit-content`, `review-panel`) · mobile: **ABSENT**
| Axis | Verdict | Note |
|---|---|---|
| all axes | GAP(MED) | Browse content shared by other teachers, publish your work, moderation queue — all absent; staffroom has recs but no browse/submit. Blocks the Share-to-Community CTA web offers on every result |

### 26. Impact Dashboard — web `src/app/impact-dashboard/page.tsx` · mobile: **ABSENT**
| Axis | Verdict | Note |
|---|---|---|
| all axes | GAP(MED) | Teacher impact analytics (time saved, outputs produced) — no mobile route, no DTO |

### 27. Org Dashboard — web `src/app/organization/dashboard/page.tsx` · mobile: **ABSENT**
| Axis | Verdict | Note |
|---|---|---|
| all axes | GAP(MED) | Org/school admin dashboard + analytics — no mobile route; B2B admin surface entirely unbuilt on mobile |

*(Also web-only, out of this matrix's named scope but ABSENT on mobile: `/profile/[uid]` public profile, `/notifications` (deferred), `/pricing` + Razorpay, `/try-call` demo-call, `/api-docs`/`/api-playground`, `/admin/*` dashboards, and the marketing/legal/landing tree.)*

---

## Biggest gaps, ranked

1. **Voice fills the form but never runs it** — GAP(HIGH), the whole thesis. `NAVIGATE_AND_FILL` with no `_AND_RUN`; `_submit()` never called from `initState` on Lesson Plan / Instant Answer / Rubric / Quiz / Worksheet / Visual Aid / Field Trip / Teacher Training (`vidya_nav_dispatcher.dart`, `lesson_plan_screen.dart:58-79,151`). One `autoSubmit` boolean + guarded post-frame call closes it (~1 day).
2. **11 of 13 tool results finish copy-only** — GAP(HIGH). No PDF/print, no Save (except worksheet + exam-paper), no Share. For a printerless classroom the print artifact *is* the deliverable; "copy text" is not.
3. **Output presentation flattens** — GAP(HIGH on worksheet math). `AiText` bare `Text` renders LaTeX `$…$` and `**bold**` literally (`ai_text.dart:25-36`); every math worksheet looks broken vs web's KaTeX. Same root also loses Instant Answer's citation-link URLs.
4. **HEAR half of the voice loop unmet** — GAP(HIGH). TTS has one caller (VIDYA chatter, `vidya_controller.dart:651-659`); no result view or grader reads the deliverable aloud. "speak → generate → hear" is two-thirds done.
5. **11-language mandate violated on the destination form** — GAP(MED-HIGH). Grade/subject dropdowns render raw English enums (`instant_answer_screen.dart:218,239`); ~48% of UI strings untranslated on the 10 non-English locales — the exact form voice strands the teacher on is English.
6. **Parent-call not voice-reachable** — GAP(BLOCKER for the "AI calls the parent" thesis). Shared 10-flow classifier ceiling (`vidya_action.dart:12-22`); telephony is built but no voice route to it, and no roster to resolve the number.
7. **Four whole web surfaces absent** — GAP(MED-HIGH). Attendance/roster/marks, Community Library (+submit/review), Impact Dashboard, Org dashboard — no route, no DTO.
8. **Onboarding is a silent keyboard form** — GAP(MED). Duplicate language step, no voice, no device-locale pre-select, dead-ends on a type-back — trains the old paradigm right before the voice canvas.
9. **Launcher not omnipresent** — GAP(MED). VIDYA missing from Library/Me/inbox/staffroom/network vs web's one global orb (`app-shell.tsx:119`).
10. **Exam Paper invalid input space** — GAP(MED). Nursery/LKG/UKG/Class 1-8 offered for a board exam (`picker_options.dart:11-27`); web restricts to Class 9/10.

*Reverse gaps (mobile ahead — do not regress): voice-first home canvas, first-class staged Parent Hotline, richer Exam Paper output (OR-choices/PYQ/provenance), consolidated Settings, Parent Message Share control, and working in-field dictation vs web's never-rendered `MicrophoneInput`.*
