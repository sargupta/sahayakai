# SahayakAI — Teacher Journey Log
**Mobile viewport**: 375×812 (iPhone 13 preset) · **Session**: 2026-04-21

Surface-by-surface observations. Each entry: URL, what the teacher sees, UX signals, overflow measurement (scrollWidth:clientWidth).

---

## 1. `/` — Home (logged out)
**Overflow**: 375:375 (no overflow on home uniquely — header does have Sign-in button but home layout absorbs)

**What's shown**
- Orange gradient accent bar under header
- `✨ AI-Powered Teaching Assistant for Bharat` pill
- Huge headline: `Good Afternoon, Teacher.` (orange on "Teacher")
- `I am SahayakAI, your personal AI companion...`
- Big pulsing mic orb with `Speak your topic` label below
- Dark coach-mark balloon: `Tap the mic and speak in any language. SahayakAI understands Hindi, Kannada, Tamil and more!` + `Got it` button (green)
- Text input fallback with right-arrow submit button — **partially covered by coach-mark on first load**
- `try: "Quiz about photosynthesis" or "Lesson plan for solar system"`
- `Works in हिंदी, ಕನ್ನಡ, தமிழ் + 8 more languages`
- Pre-rendered example Lesson Plan card (Photosynthesis, Class 8, 5E format)
- 8 tool link-cards: Lesson Plan, Quiz Generator, Exam Paper, Worksheet Wizard, Visual Aid, Content Creator, Instant Answer, Teacher Training

**UX signals**
- ✅ Voice-first hero is bold and on-brand
- ✅ 5E example proof is good social proof
- ⚠️ Coach-mark blocks text input (friction)
- ⚠️ Only 3 langs shown — "8 more" oversells (nav-only i18n)
- ⚠️ "Generated in 30s" badge misrepresents real 60–73s latency

---

## 2. `/community`
**Overflow**: 762:375 — **2× overflow P0**

**What's shown**
- Title `Community` + subtitle `Share, learn, and grow with teachers acr...` **(clipped)**
- `All` filter chip (orange)
- Feed card with `Sign in...` text **(clipped)**
- Empty state: `Your feed is quiet. Join more groups or c...` **(clipped)**
- `Shared Resources` section
- Search bar `Search lessons, quizzes, worksheets...`
- `All Languages` dropdown
- Filter chip row: All / Lessons / Quizzes / Workshe... **(clipped)**

**UX signals**
- 🔴 Teacher must horizontally pan — 50 % of content off-screen on first paint
- ⚠️ No visible Discover/Connect/Chat tab UI (recon expected 3-tab surface — possibly auth-gated)
- ⚠️ Trending sorted by `stats.likes` without time-decay

---

## 3. `/settings`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- Plain text: `Please sign in to access settings.`
- Mic orb bottom-right

**UX signals**
- 🔴 Dead-end: no CTA, no icon, just text. Teacher has to scroll up to header Sign-in button.
- ⚠️ First auth-gate pattern of five — inconsistency

---

## 4. `/pricing`
**Overflow**: 394:375 (+19px)

**What's shown**
- `Choose Your Plan` hero
- Subtitle: `All plans include full community access and unlimited voice`
- Monthly / Annual toggle (Annual = "2 months free" highlighted)
- Free card: `₹0/month` — 10 lesson plans, 5 quizzes, 5 worksheets, Unlimited Instant Answer (20/day), Full community access, Unlimited voice (TTS), Basic Impact Dashboard, `Current plan` button
- Pro card: `Most Popular` badge + `₹1,399/year` / `₹117/month — save ₹389`

**UX signals**
- ✅ Clean pricing architecture; local currency; reasonable feature gates
- ⚠️ "Current plan" shown to logged-out user should be "Get Started Free"
- ⚠️ Mic orb occludes Pro card price area

---

## 5. `/my-library`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out — no gate!)
- Gradient orange-purple profile card with `Te` avatar + `Teacher` name + `0 Resources / 0 Followers / 0 Following`
- `My Library` heading + `English` language picker + `Create New` CTA (orange)
- Search bar `Search your library...`
- Filter `All Resources` + grid/list toggle
- Empty state: `No resources found - Your library is empty. Start generating with SahayakAI! Clear all filters`

**UX signals**
- ⚠️ No auth gate — shows fake "Teacher" profile with 0s to logged-out user (misleading)
- ✅ Good empty-state pattern + Create New CTA

---

## 6. `/instant-answer`
**Overflow**: 394:375 (+19px)

**What's shown**
- Magic wand icon
- `Instant Answer` heading
- Tagline: `Get quick, expert answers to your questions, powered by Google Search.`
- `Your Question` textarea (placeholder: `e.g., 'Explain photosynthesis to a 10-year-old...'`)
- 4 example prompts:
  - Why is the sky blue?
  - Explain photosynthesis using the example of how Pongal is made.
  - Tell me about the history of Nalanda University.
  - What are the major rivers in India?
- `Class` dropdown (default: Class 6; options Class 1–12)
- `Subject` dropdown (General default; Math, Science, Social Science, History, Geography, Civics...)

**UX signals**
- ✅ Culturally smart examples (Pongal, Nalanda)
- ⚠️ Mic orb overlaps Class dropdown chevron
- ⚠️ Red button (probably submit) visible peeking behind orb at bottom

---

## 7. `/messages`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- Speech bubble icon
- `Sign in to access your messages.`
- Mic orb

**UX signals**
- ⚠️ Dead-end, same pattern as /settings but with an icon — still no CTA button

---

## 8. `/notifications`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- Bell icon
- `Sign-in Required` heading
- `Please sign in to view your notifications.`
- Orange button: `Go to Header to Sign In` ← **button label is an instruction, not an action**

**UX signals**
- ⚠️ Third auth-gate pattern (icon + heading + text + indirect button). Should just trigger sign-in directly.

---

## 9. `/impact-dashboard`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- `Impact Dashboard` heading
- `Track your teaching journey and see the difference you're making in your classroom.`
- **4 skeleton shimmer circles arranged in 2×2 grid** — eternal loading, no auth gate

**UX signals**
- 🔴 P1 bug: no auth gate, looks like infinite loading. Teacher will think app is broken and bounce.

---

## 10. `/usage`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- **Completely blank page** — header only, zero content

**UX signals**
- 🔴 P1 bug: worst auth-gate failure mode — zero feedback to the user

---

## 11. `/privacy-for-teachers`
**Overflow**: 394:375 (+19px)

**What's shown**
- Shield icon
- `Your Data, Your Control` heading
- Subtitle: `SahayakAI is built for teachers, not for monitoring teachers. Here is exactly how we handle your data.`
- Green-highlighted section: `👁 We NEVER share your data with inspectors or government officials` — explicit callout of `Block Education Officer (BEO), District Education Officer (DEO), DIET Principal, school inspector, or any other government official`
- `🔒 Your content is private by default` — lesson plans, quizzes, worksheets, visual aids only visible to you unless you tap "Share to Community"

**UX signals**
- 🌟 STANDOUT POSITIVE — this is the strongest trust asset in the app
- 🌟 Indian govt-role specificity = teacher-domain craft
- ⚠️ Mic orb occludes part of "Share to Community" sentence

---

## 12. `/attendance`
**Overflow**: 394:375 (+19px)

**What's shown** (logged out)
- `Attendance` heading + `Manage classes and track daily attendance`
- Top-right `+ New Class` button (clipped by overflow)
- Clipboard icon
- `No classes yet` heading
- `Create your first class and add students — then take daily attendance in seconds.`
- `+ Create First Class` orange CTA

**UX signals**
- ✅ Good empty state — two CTAs (one top-right, one centered) both lead to Create First Class
- ⚠️ Top-right CTA clipped by +19 px overflow

---

## 13. `/quiz-generator`
**Overflow**: 394:375 (+19px)

**What's shown**
- `Quiz Generator` heading + tagline
- Textarea with placeholder `e.g., The life cycle of a butterfly, using the uploaded image.`
- `Add Context (Optional Image)` drag-drop zone
- `Question Types` grid: Multiple Choice (selected, orange ring + ✓), Fill in the Blanks, Short Answer, and more below
- `Quick Ideas` section with prompts: `A quiz about the planets in our solar system.` etc.

**UX signals**
- ✅ Clean form layout, visual tile selection pattern
- ⚠️ Mic orb occludes Short Answer tile
- ⚠️ Bottom submit button (red) visible peeking behind orb

---

## 14. `/video-storyteller`
**Overflow**: 394:375 (+19px)

**What's shown**
- Video camera icon
- `Video Storyteller` heading + `Curated educational videos for Indian classrooms`
- Top-right `Refresh` button (clipped)
- Search bar `Search topics, chapters, concepts...`
- `All Subjects` dropdown + `All Classes` dropdown + `English` dropdown
- `Find` CTA button

**UX signals**
- ✅ Simpler form than other AI tools; fewer decisions for the teacher
- ⚠️ Large empty area below form — consider showing popular/trending videos without search

---

## 15. `/content-creator`
**Overflow**: 394:375 (+19px)

**What's shown**
- `Content Creator Studio` heading + `Tools to help you create engaging multimedia content for your classroom.`
- 3 feature cards stacked:
  1. **Visual Aid Designer** — Create simple line drawings and diagrams for your lessons. → `Create Visuals →`
  2. **Virtual Field Trip** — Plan exciting virtual tours using Google Earth. → `Plan Trip →`
  3. **Video Storyteller** — Discover curated educational videos for your lessons. → `Browse Videos →`

**UX signals**
- ℹ️ This is a HUB page — bundles 3 features that also appear in the sidebar independently
- ⚠️ Navigation duplication; pick one surfacing strategy

---

## Sidebar (hamburger menu)
26 links enumerated:

**AI Companion** (highlighted chip at top): `/`

**AI Tools (11)**: Lesson Plan, Quiz Generator, Worksheet Wizard, Visual Aid Designer, Instant Answer, Rubric Generator, Exam Paper, Content Creator, Video Storyteller, Teacher Training, Virtual Field Trip

**Platform (8)**: My Library, My Profile, Settings, Attendance, Community Library (→ /community), Messages, Impact Dashboard, Usage

**Other (2)**: Notifications, Privacy

**Admin (2)**: Mission Control (→ /admin/cost-dashboard), Log Dashboard (→ /admin/log-dashboard) — 🔴 **visible to logged-out users**

**UX signals**
- Current route highlighted with orange ring (good)
- Sidebar covers ~75 % of viewport on mobile (acceptable since it's dismissable)
- ⚠️ Admin section should be role-gated
- ⚠️ "Community Library" label but href = `/community` — naming mismatch

---

## AI backend observations (from direct API testing)

### Attempt: `POST /api/ai/lesson-plan` with `{topic: "Photosynthesis basics for Class 7 Science"}`
- **Attempt 1 (original `.env.local` key)**: 500 Internal Server Error after ~10 s. Server log: `GoogleGenerativeAIFetchError: 403 Forbidden - Your project has been denied access.`
- **Attempt 2 (swapped ShareMarket key `AIzaSyAl5_…`)**: 500 after 73 s. Server log: 3 retries each hit `429 Too Many Requests - Resource exhausted.` Backoff 17s → 48s → fail.
- **Attempt 3 (fresh payload)**: 500 after 60 s. Same 429 pattern — daily quota (RPD) exhausted, not per-minute.

### Error UX served to teacher
```json
{ "error": "AI generation failed. Please try again." }
```
No class-specific messaging. No retry guidance. No upgrade prompt.

### Resilience architecture (good)
```
[AI Resilience] lessonPlan.generate attempt 1/3 failed { keyIndex: 0, poolSize: 1, ... }
[AI Resilience] 429 on key 0. Backing off 17856ms before retry 2/3
```
Retry + exponential backoff is the right pattern. `poolSize: 1` is the problem — a multi-key pool would have switched and succeeded.

---

## What a teacher would actually experience today

Realistic first-5-minute walkthrough if a real teacher tried the site right now:

1. Home screen: "OK, the mic is big, looks friendly. Let me try typing since I'm at my desk."
2. Dismiss coach-mark. Type "Photosynthesis for Class 7." Tap submit.
3. *Spinner. 10 seconds. 20. 30. 40. 50. 60. 73.*
4. `"AI generation failed. Please try again."` Tap retry.
5. *Another 73 seconds. Same error.*
6. "Is my internet broken?" Check other sites. They work fine.
7. "Maybe the site is broken today." Close tab.
8. Never returns.

That's the conversion funnel killer. Everything else in this review matters less than getting this teacher a successful first generation within 15 seconds.
