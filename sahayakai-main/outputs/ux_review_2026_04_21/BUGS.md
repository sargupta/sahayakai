# SahayakAI — Bugs & UX Issues Found
**Review date**: 2026-04-21 · **Viewport**: 375×812 (iPhone 13 mobile preset) · **Reviewer**: AI-assisted teacher-persona walkthrough

Severity scale: **P0** = platform-broken / revenue-blocking / data-loss · **P1** = core teacher flow degraded · **P2** = polish / edge cases

---

## P0 — Platform-breaking

### P0-1 · Gemini API key project is denied access
- `GOOGLE_GENAI_API_KEY` in `.env.local` (prefix `AIzaSyDD9M`) returns `403 PERMISSION_DENIED: "Your project has been denied access."` when called directly against `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash`.
- Confirmed by direct curl test outside the app — the Google project tied to this key is suspended or quota-revoked.
- **Impact**: every AI flow in the product is dead locally and likely in production if the same key is used: lesson plan, quiz, worksheet, rubric, exam paper, visual aid, avatar, instant answer, VIDYA orb, teacher training, parent message, virtual field trip, video storyteller.
- **Also in `.env`**: `GEMINI_API_KEY=secrets/GE...` is a Google Secret Manager reference path, not a literal key — treated as a string by the SDK and returns `400 API_KEY_INVALID`. Resolution hook likely exists for Cloud Run but not in dev.
- **Fix**: create a new key in AI Studio under a healthy Google project and verify billing. Check whether prod Cloud Run uses this same denied key.

### P0-2 · Single-key pool → no failover
Server log confirms `poolSize: 1` on every retry:
```
[AI Resilience] lessonPlan.generate attempt 1/3 failed { keyIndex: 0, poolSize: 1, ... }
```
When one key hits 429 or 403, there is no second key to fail over to. The resilience wrapper exists but has nothing to switch to. Recommendation: rotate 3–5 keys across at least 2 Google projects for prod.

### P0-3 · AI-generation error UX is catastrophic
- Total wait time observed with retry backoff: **60–73 seconds** on first failure.
- Final error shown to teacher: `"AI generation failed. Please try again."` — single string, no context, no actionable guidance.
- Scenario: teacher in a live class, taps Generate, waits 73 s staring at a spinner, gets a useless retry prompt. Real teacher on a 3G connection will churn.
- **Fix options**:
  1. Cap total retry time at ~15 s for user-facing flows
  2. Differentiate error messages: "temporarily busy — retrying in background" vs "quota hit — upgrade or wait for reset" vs "connection issue"
  3. Queue the request for background completion + notify via notifications center

### P0-4 · Community page has 2× horizontal overflow on 375 px
- Measured: `document.documentElement.scrollWidth = 762` on a 375 px viewport.
- Teacher must horizontally pan to see the right half of the feed, filter chips, and sign-in prompt.
- Content visibly clipped: `"Share, learn, and grow with teachers acr..."` and `"Sign in..."` in feed card.
- Root cause likely: sidebar rendering inline in flex layout instead of off-canvas sheet on mobile breakpoint. `sidebar-wrapper` div measures 762 px; main measures 762 px; each is `w-full` inside a parent that isn't constrained to viewport.
- **Impact**: community is the social-retention surface — 2× overflow on the most common screen size reduces engagement and signup conversion.

---

## P1 — Core teacher flow degraded

### P1-1 · Universal +19 px header overflow
Every page tested has `scrollWidth = 394` vs `clientWidth = 375`. The `Google Sign-in` button (150 px wide, envelope icon + text) extends past the 375 px right edge. Visible consequence: `"SahayakAI"` wordmark is visually clipped on the right by the button.
- Affected pages (confirmed): `/`, `/community`, `/settings`, `/pricing`, `/my-library`, `/instant-answer`, `/messages`, `/notifications`, `/impact-dashboard`, `/privacy-for-teachers`, `/attendance`, `/quiz-generator`, `/video-storyteller`, `/content-creator`.
- **Fix**: shrink Sign-in button to icon-only on `<sm` breakpoint, or reduce horizontal padding on header, or word-break the wordmark.

### P1-2 · Floating mic orb occludes content on every page
The fixed-position mic orb sits bottom-right and covers page content underneath. Observed covering:
- `Class 6` dropdown chevron on `/instant-answer`
- Pro-plan "Most Popular" pricing block on `/pricing`
- "Short Answer" question-type tile on `/quiz-generator`
- "Share to Community" sentence on `/privacy-for-teachers`
- Submit button at bottom of form on multiple AI pages (red button visible peeking through)
- **Fix**: add a dismiss/minimize affordance; shift orb to bottom-center or allow user to move it; auto-hide when user scrolls down; or reserve bottom-right padding on page content containers so nothing collides.

### P1-3 · Inconsistent auth-gate UX across pages (5 different patterns)
| Page | Gate pattern | Issue |
|------|-------------|-------|
| `/settings` | Plain text only "Please sign in to access settings." | No CTA, dead-end |
| `/messages` | Icon + text "Sign in to access your messages." | No CTA, dead-end |
| `/notifications` | Icon + text + button "Go to Header to Sign In" | Button wording is an instruction, not an action |
| `/my-library` | No gate — shows placeholder "Teacher" profile with 0 stats, "Create New" CTA | Misleading; user thinks they're authed |
| `/impact-dashboard` | No gate — eternal skeleton shimmer loaders | Looks like the app is broken / infinite loading |
| `/usage` | No gate — completely blank page | Worst UX: zero feedback |

**Fix**: one shared auth-gate component used across all routes — icon + heading + message + single "Sign In with Google" button that triggers `signInWithPopup` directly.

### P1-4 · Mic permission failure is silent
Clicked the Start-recording orb on `/quiz-generator`. Expected: permission prompt or a toast error. Observed: button silently stays in idle state, no toast, no visible feedback. `navigator.mediaDevices` exists but `getUserMedia` likely blocked by browser or not called.
- **Impact**: teacher on a phone that denied mic permission will tap repeatedly with no understanding of why nothing is happening. Violates the voice-first value prop.
- **Fix**: wrap `getUserMedia` in try/catch, surface a toast: "Microphone access blocked — tap 🔒 in address bar to allow."

### P1-5 · Admin links visible to logged-out users in sidebar
- `/admin/cost-dashboard` (labeled "Mission Control")
- `/admin/log-dashboard`
- Both visible in sidebar regardless of auth state.
- Info disclosure: reveals internal route names and tool categories to unauthorized viewers.
- **Fix**: hide Admin section unless `user.role === 'admin'`. Server middleware should also 403 these for non-admins (likely already does — verify).

### P1-6 · Homepage coach-mark occludes secondary text input
On first load of `/`, the "Tap the mic and speak in any language" dark tooltip balloon covers the text input textarea and the right-arrow submit button. User must dismiss via "Got it" before using the text fallback. Good intention (teach voice-first), bad execution (blocks alternative input path).

### P1-7 · Auth button uses envelope icon instead of Google logo
Header "Google Sign-in" button shows a ✉️ mail/envelope icon (appears to be a generic "contact" icon). Teachers expecting the familiar "G" or multi-color Google logo may distrust or miss it.

### P1-8 · Oversold language claim
Homepage footer says `"Works in हिंदी, ಕನ್ನಡ, தமிழ் + 8 more languages"`. Per recon of `src/context/language-context.tsx`, only 11 languages have **nav label** translations; the majority of UI strings (toasts, form labels, settings, error messages) remain English regardless of selected language. The claim materially oversells i18n.
- **Impact**: teacher switches to Tamil, expects a Tamil UI, sees 70 % English. Broken promise hurts trust especially with rural and non-metro teachers.
- **Fix**: either translate comprehensively, or temper the claim to "Voice + content generation in 11 languages; UI in English" until i18n is complete.

### P1-9 · Voice message signed URLs expire after 7 days (from code recon)
`voice-messages/{uid}/{timestamp}.webm` in Firebase Storage is served via signed URLs with ~7-day expiry; no refresh mechanism observed. After 7 days, archived voice messages in community chat become unplayable — silent data loss from user POV.
- **Fix**: regenerate signed URLs on demand when a chat is opened, or use gs:// + authenticated download helper.

### P1-10 · Onboarding flow untestable without real Google auth
`/onboarding` redirects to `/` when no authenticated Firebase user exists. Dev-token cookie gets the middleware through but doesn't create a Firebase client auth state. Onboarding UX (3 steps — language, profile accordion, aha-moment) therefore could not be directly walked through in this review. Per code recon the flow is well-structured, but **first-time teacher signup UX is the single highest-leverage screen in the product** and should be independently QA'd by the team each release.

---

## P2 — Polish / edge cases

### P2-1 · Pricing page shows "Current plan" to logged-out users
Logged-out visitors to `/pricing` see `Current plan` on the Free tier card. Should be `Get Started Free` as a sign-up CTA.

### P2-2 · "Good Afternoon, Teacher." greeting is generic placeholder
When logged out, greeting uses placeholder "Teacher". Could be softened to `"Good Afternoon! Sign in to pick up where you left off"` as a gentle conversion nudge.

### P2-3 · Content Creator Studio duplicates sidebar items
`/content-creator` is a hub page that bundles `Visual Aid Designer`, `Virtual Field Trip`, `Video Storyteller` — but all three also appear as standalone items in the sidebar. Redundant navigation.

### P2-4 · Connect directory hard-capped at 200 teachers (from recon)
Client-side filter on top 200 teachers. Breaks at scale. Needs server-side pagination + search before ~1k users.

### P2-5 · "Add Image" button in community post composer is a stub (from recon)
Attachment schema exists in Firestore but UI button not wired. Misleading — user clicks and nothing happens.

### P2-6 · Community trending has no time-decay (from recon)
Feed sorted purely by `stats.likes`. Ancient viral items dominate forever. Suggests adding a time-decay factor like `likes / (ageHours + 2)^1.5`.

### P2-7 · "Generated in 30s" badge on homepage sample LP misrepresents reality
Home hero shows a pre-rendered example LP with a `Generated in 30s` badge. Actual production latency measured: 60–73 s on cold path, and failure is common due to quota issues. Badge implies false-advertised speed.

### P2-8 · Group dropdown in community doesn't close on outside click (from recon)
Minor interaction bug.

### P2-9 · Webpack stale-chunk errors crashed dev sessions
During this review the Next.js dev server encountered `Error: Cannot find module './6141.js'` and `ENOENT: .next/server/app-paths-manifest.json` multiple times. Required full `rm -rf .next` + restart to recover. Points to HMR stale-state handling problems — painful for daily development.

---

## Positive findings (keep / amplify)

1. **`/privacy-for-teachers` is a standout page.** Names specific Indian govt officials (BEO, DEO, DIET Principal) in the anti-surveillance promise. This is the kind of thing that builds real teacher trust in India. Amplify — link it from onboarding and pricing.
2. **Voice-first mic orb as hero CTA** on homepage is appropriate and bold. Matches the platform's claim.
3. **Cultural specificity in example prompts**: Pongal festival for photosynthesis, Nalanda University history, "major rivers in India" — reduces blank-page anxiety for teachers unused to AI prompting.
4. **Empty states on `/attendance` and `/my-library`** have the right structure: icon + heading + helpful copy + primary CTA.
5. **5E pedagogy format** (Engage/Explore/Explain) in lesson plan preview is NCERT-aligned; shows the team has done its teacher-domain homework.
6. **Double-submit guard** via `useRef` flag is the correct React pattern for the race window — good engineering.
7. **Plan-limit atomic reservation** in `src/lib/plan-guard.ts` is a well-designed piece of quota infrastructure.
8. **TTS voice tier matching** (Neural2 for Hindi/English, Wavenet for 6 mid-tier langs, Standard for Telugu) is cost-optimized and thoughtful.

---

## Untested (blocked or out of scope this session)

- Full onboarding flow (auth-gated)
- Actual lesson plan output quality (Gemini quota)
- Actual quiz/worksheet/rubric/exam-paper output quality (Gemini quota)
- Image generation quality on visual-aid (Gemini quota)
- VIDYA orb conversation quality (Gemini quota + mic perms)
- Voice message send/receive in chat (auth-gated + mic perms)
- Plan-limit UX on free tier (dev-token = pro plan)
- Razorpay checkout flow (no real card + not the point of a UX review)
- Hindi/Tamil/Kannada UI switch breakage probe (auth-gated settings)
- Offline-mode banner behavior (needs actual offline transition)

Recommend re-running this review once a healthy Gemini key is provisioned.
