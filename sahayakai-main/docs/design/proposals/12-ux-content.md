# Proposal 12 — UX Content & Voice

**Lens:** Microcopy, labels, states, onboarding narrative, tool names, CTAs.
**Board seat:** UX Writer / Content Designer
**Constraint:** Every string ships in 11 Indic languages. Words must survive translation and honour the teacher's dignity.

---

## 1. Current-state assessment

The product is warm in places and cold in others — there is no single voice. Evidence from the code:

- **Machine-centric loading copy.** `types.ts` rotates `"Analyzing Topic..."` and `"Consulting Educational Resources..."`. This describes what the *server* is doing, not what the *teacher* is getting. The dashboard shows a bare `"Thinking"`.
- **Title-Case system-speak in states.** `"Generation Failed"`, `"Load Failed"`, `"Setup Failed"`, `"Scan Failed"`, `"Update Failed"`, `"PDF failed"`. "Generation" and "Load" are developer nouns; a teacher created a *quiz*, not a "generation". Title Case reads as a Windows error dialog, not a colleague.
- **Blame-shaped errors.** `"There was an error generating the quiz. Please try again."` repeats verbatim across quiz / worksheet / rubric / field-trip. It is generic, gives no next step, and the passive "there was an error" quietly implies the teacher's input was at fault.
- **Robotic empty states.** `"No students yet"`, `"No posts yet"`, `"No saved resources yet"` state a lack without offering a first step. (Two do it well — see §3.)
- **Undignified defaults.** The greeting falls back to `"Teacher"` as a name (`teacherName = ... || "Teacher"`). Being addressed as "Teacher, " because the system doesn't know your name is impersonal in exactly the moment meant to feel personal.
- **Jargon leaking to the surface.** `"Pedagogical Strategy"`, `"Bloom's Taxonomy Levels"` sit on the primary quiz screen. Useful to some; opaque to a Class-3 teacher in a rural school. Not wrong — just unframed.
- **Untranslated fragments & idioms.** `try: "Quiz about photosynthesis"` and `Works in हिंदी, ಕನ್ನಡ, தமிழ் + 8 more languages` are hardcoded English on the dashboard, bypassing `t()`. `"Worksheet Wizard"` — "Wizard" has no clean, non-magical translation in most Indic languages.
- **Inconsistent register.** `"Namaste"`, `"You're all set!"`, `"Welcome aboard."`, and `"Almost there!"` are friendly; `"Profile setup required"`, `"Session expired. Please log in again."`, `"Unauthorized"` are curt. Same app, two personalities.

The good news: the ingredients of a warm voice already exist (`"Namaste"`, the `couldNotGenerate` reassurance line, the attendance empty state). We standardise on the best of what's here.

---

## 2. Voice & Tone guide for SahayakAI

**Persona:** A calm, capable colleague in the next classroom — never a boss, never a salesperson, never a robot. Speaks *to* the teacher as an equal professional.

### Five principles

1. **Respect the teacher's expertise.** They are the educator; we are the assistant. We hand them a draft, they decide. Never "we made you a perfect lesson" — always "here's a starting point, yours to shape."
2. **Plain over clever.** No wordplay, no "Wizard", no marketing adjectives ("powerful", "revolutionary", "seamless"). A word that puns in English breaks in Marathi.
3. **Name the thing, not the mechanism.** Teachers think in *quiz, lesson, worksheet* — not *generation, payload, request*. Copy names the teacher's object.
4. **Every dead-end has a door.** Errors and empty states always give one concrete next action.
5. **Warm, not chatty.** Encouraging in one short line. No exclamation storms, no forced cheer around failures.

### Do / Don't

| Situation | Don't | Do |
|---|---|---|
| Loading | "Analyzing Topic…" | "Preparing your lesson…" |
| Success | "Generation complete." | "Your quiz is ready." |
| Error | "Generation Failed." | "The quiz didn't come through. Let's try once more." |
| Empty | "No students yet" | "Add your first student to begin." |
| Unknown name | "Namaste, Teacher." | "Namaste." (drop the placeholder name) |
| Jargon | "Pedagogical Strategy" | "Why these fit" (keep the term as a subtitle) |
| Aggressive | "Unlock powerful AI tools!" | "Tools to help you prepare, faster." |

---

## 3. Rewrite framework for the key moments

**Onboarding welcome.** Lead with the teacher, not the product. Today: *"I am SahayakAI, your personal AI companion. I can help you create lesson plans, quizzes…"* → **"Namaste. Tell me what you'd like to teach today, and I'll help you prepare it — a lesson, a quiz, a worksheet."** Frames *them* acting, us assisting.

**Tool prompts / placeholders.** Keep the strong pattern already in use — a real example the teacher can copy: `"e.g. Class 5 science worksheet on the water cycle, 10 short-answer questions"`. Standardise every generator to `"e.g. <grade> <subject> <topic>…"`. Route the two hardcoded dashboard hints through `t()`.

**The "generating…" moment.** Replace server verbs with teacher outcomes, and reassure on wait time (the code already knows it takes 20–30s):
- Lesson: "Preparing your lesson…" → "Shaping the activities…" → "Almost ready…"
- Quiz: "Writing your questions…"
- Keep the two-beat rotation; make both beats about *their* content, never "Consulting Educational Resources".

**Empty states.** Adopt the attendance pattern everywhere — a lack + a first step:
- Library: "Nothing saved yet. Anything you create, you can keep here."
- Posts: keep the existing "No posts yet. Be the first to share something!"
- Students: "No students yet. Add your first to begin taking attendance."

**Errors.** Formula: *plain what happened* + *reassure* + *one action*. "The lesson didn't come through this time. Your details are saved — tap Try again." Never "Failed". Never bare "Unauthorized" → "Please sign in again to continue."

**Success / celebration.** Quiet and specific, not confetti. "Your quiz is ready — review and edit anytime." At genuine milestones (first creation): "That's your first lesson done. It's saved to My Library."

---

## 4. Naming for tools & nav

Names must be instantly legible to a Class-3 teacher AND translate cleanly. Rules: concrete noun for the output; drop cute modifiers; keep it to 1–2 words.

| Current | Verdict | Proposed |
|---|---|---|
| Worksheet Wizard | "Wizard" won't translate | **Worksheet Maker** (or just **Worksheets**) |
| Quiz Generator | "Generator" = machine word | **Quiz Maker** / **Quizzes** |
| Visual Aid Designer | wordy | **Visual Aids** |
| Instant Answer | fine, keep | Instant Answer |
| Lesson Plan | clear, keep | Lesson Plan |
| Assess Work | clear, keep | Assess Work |
| Content Creator | vague overlap w/ Visual Aid | **Stories & Aids** |
| Exam Paper | clear, keep | Exam Paper |

Nav verbs (`Create`, `Assess`, `Engage`, `Ask`) are good — concrete and short. Keep them.

---

## 5. Translation-friendly writing rules

1. **No idioms, no metaphors.** "Wizard", "unlock", "supercharge", "in a snap", "aboard" — all break. Say the literal thing.
2. **Short sentences, one clause.** Long English strings overflow Indic scripts (Tamil/Malayalam run ~30–40% longer). Cap labels at ~2 words, sentences at ~8.
3. **No interpolated grammar assumptions.** Avoid mid-sentence variables that assume English word order/plurals. Prefer whole strings; keep counts as a trailing badge (the quiz page already does this).
4. **Sentence case, not Title Case.** Title Case has no meaning in Indic scripts and looks foreign; sentence case translates predictably.
5. **Never Hindi-as-default.** Every string resolves per `uiLangCode` across all 11; audit for silent English fallback (the role-label local tables show the right pattern — extend it, don't hardcode).
6. **One term, one translation.** Pick "class" **or** "grade", "lesson" **or** "lesson plan" — and never mix, so glossaries stay stable.

---

## 6. Quick-wins vs big-bets

### Quick wins (string-only, high impact)
- **Loading rotators → outcome language.** `types.ts`: "Analyzing Topic…" → "Preparing your lesson…"; "Consulting Educational Resources…" → "Shaping the activities…".
- **Kill "Failed" titles.** Global find on `"* Failed"` → object-named, sentence-case ("The quiz didn't come through").
- **Drop the "Teacher" name placeholder.** When name is unknown, greet with just "Namaste." — not "Namaste, Teacher."
- **Route 2 hardcoded dashboard strings through `t()`** (`try: "Quiz about…"` and the languages line).

**Before / after:**
- `title: t("Generation Failed")` / `description: "There was an error generating the quiz. Please try again."` → **title: "The quiz didn't come through"** / **desc: "Your details are saved. Let's try once more."**
- `"No saved resources yet"` → **"Nothing saved yet — anything you create, you can keep here."**
- `setLoadingMessage("Consulting Educational Resources...")` → **"Shaping the activities…"**

### Big bets (structural)
- **Rename "Wizard" / "Generator" tools** — touches nav, dashboard cards, page titles, and 11 glossaries; needs coordinated re-translation, so plan it as one wave.
- **Centralise a content style layer.** A single reviewed source of truth for state copy (loading/error/empty/success) so no page hand-rolls "Failed" again. Pairs with the existing `t()` dictionary.
- **11-language copy QA pass.** Audit every user-facing string for silent English fallback and overflow, using the role-table pattern as the standard.

**Sequencing:** ship all quick wins first (pure strings, no layout risk, immediate dignity gain), then the rename wave, then the QA pass.
