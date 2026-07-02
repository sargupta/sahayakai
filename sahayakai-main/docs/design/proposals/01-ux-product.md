# UX / Product Design Review — End-to-End Teacher Journey & IA

**Lens:** teacher journey + information architecture. **Persona anchor:** Kavita, a Class 6 science teacher in a Tier-2 town, 8 free minutes between periods, mid-range Android (4 GB RAM, patchy 4G), reads Kannada more comfortably than English.

Files reviewed: `dashboard-home.tsx`, `app-sidebar.tsx`, `mobile-bottom-nav.tsx`, `command-palette.tsx`, `onboarding/page.tsx`, `lesson-plan-view.tsx` + `lesson-plan-input-section.tsx` + `lesson-plan-display.tsx`, `quiz-generator/page.tsx`, `worksheet-wizard/page.tsx`, `my-library/page.tsx`, `content-gallery` / `library-card.tsx`, `onboarding-checklist.tsx`, `share-to-community-cta.tsx`.

---

## 1. Current-state journey assessment

The core loop today is **land → (pick a tool) → configure a form → generate → review → save/download → dead-end**. The bones are good — voice-first home, an intent router (`/api/ai/intent`), progressive-disclosure sidebar, a ⌘K palette, and a genuinely thoughtful onboarding "aha moment." But the loop leaks at the seams.

**Top friction points, in priority order:**

1. **Two competing front doors that don't share a mental model.** The home page (`dashboard-home.tsx`) sells a *conversational* promise: one big mic, "tell Sahayak what you want to teach today," and a smart router that navigates or answers. But the moment the router lands you on `/quiz-generator` or `/worksheet-wizard`, you hit a *dense form* — textarea, image uploader, subject/grade/language selectors, question-type cards **duplicated** as checkboxes, a Bloom's-taxonomy multi-select, a slider. The home screen trained Kavita to *speak a sentence*; the tool screen demands she *fill a spreadsheet*. That whiplash is the single biggest journey break.

2. **The generator forms are over-configured for the 8-minute use case.** The quiz page renders question-types **twice** (SelectableCards in the left column, then checkboxes in the right), plus Bloom's levels with per-level pedagogical-strategy copy. This is a power-user control panel bolted onto a "quick" tool. For a time-poor teacher every one of these is a decision she didn't ask to make. Smart defaults already exist in code (5 questions, MCQ+short-answer, Remember+Understand) — the UI just doesn't *trust* them enough to hide the rest.

3. **The loop dead-ends after generation.** After a lesson plan renders, the act-bar is Edit / Copy / Save / PDF / Share (`lesson-plan-display.tsx`). There is **no chaining** (confirmed: nothing anywhere offers "make a quiz from this lesson"). Yet "I just planned photosynthesis for Class 6 — now I need a quiz and a worksheet on the same thing" is *the* teacher workflow. Today she must navigate to a new tool and re-type topic, grade, subject, language from scratch. The product's biggest latent value — one context, many artifacts — is invisible.

4. **Navigation is a taxonomy, not a workflow.** The sidebar groups tools by *what the tool is* (Create / Assess / Engage / Ask / My work) with **~18 destinations** across 37 routes. That's a librarian's IA. A teacher thinks by *what she's doing this period* ("teach a new topic," "check what they learned," "grade this stack of papers"). The verb-groups are close but the sheer count, plus a separate ⌘K palette, plus a 4-tab mobile bar, means three parallel navigation systems to learn.

5. **Inconsistent i18n architecture signals inconsistent screens.** Home, sidebar, quiz use the shared `t()`; worksheet-wizard and lesson-plan-view ship **giant per-file `translations` objects** (11 languages hand-inlined). Beyond maintenance debt, this is why chrome quality varies screen to screen — some tools feel first-class in Tamil, others fall back to English. For an 11-language voice-first product, that unevenness *is* a UX defect.

6. **"Save" is ambiguous and the return trip is cold.** Lesson display has a `Save` action *and* a `QuickShareButton onSave`; worksheet had a fake save that was removed. A teacher can't tell whether her work is safe. And when she returns, `/my-library` is a flat gallery with only Open / Download / Delete — no "continue where I left off," no grouping by class or topic, no re-generate.

---

## 2. Reimagined IA / navigation model

**Principle: navigate by teacher intent, collapse the tool count at the surface.** Teachers don't want 18 tools; they want ~4 jobs done. Reframe the top level around the **teaching moment**, and let tools become *outputs of an intent*, not destinations.

Proposed primary IA (three verbs + workspace):

- **Teach** — plan and build teaching material (lesson plan, content/story, visual aid, video, field trip). Entry point: "What are you teaching?"
- **Check** — everything assessment (quiz, worksheet, exam paper, rubric, scan & grade, attendance). Entry point: "What do you want to check?"
- **Ask** — instant answers + teacher training. Entry point: "Ask anything."
- **My Work** — library, community, messages, impact, profile.

Everything else (settings, privacy, admin) lives in an account menu. The **⌘K palette becomes the canonical flat search** across all 18 tools for power users — so we can *safely* shrink the browsable surface without hiding anything. Mobile bottom bar stays 4 tabs but re-labels to **Home · Create · Library · Me** (already close), where "Create" opens an **intent sheet** (Teach / Check / Ask) rather than the raw palette.

The win: a new teacher learns **3 verbs**, not a 5-group × 18-item tree.

---

## 3. The ideal "one-tap" teacher home & tool-launch pattern

Keep the voice-first hero — it's the product's soul — but make it the *actual* launch mechanism, not a router that abandons you at a form.

**"Speak once, configure never (unless you want to)."**

1. Kavita taps the mic (or types) once: *"Class 6 science quiz on photosynthesis in Kannada."*
2. The intent router already extracts tool + topic + grade + subject + language. Today it `router.push`es to a form. **Instead: it should generate immediately with smart defaults and land her on the *result*,** with the extracted parameters shown as **editable chips** above the output ("Class 6 · Science · Kannada · 5 questions · MCQ").
3. Every chip is a one-tap adjustment that **re-generates in place**. The full form becomes a collapsed **"More options"** drawer for the 10% who want Bloom's levels and sliders.

This inverts the current model from *configure-then-generate* to **generate-then-refine** — which matches how a rushed teacher actually works (see something, nudge it) and how the voice promise already sets expectations. The dense forms don't get deleted; they get **demoted to progressive disclosure**, exactly as the sidebar already does for new users.

For the browse path (no voice), each intent lands on a **single prompt box with example chips**, not a wall of selectors. The quiz page's duplicated question-type controls collapse to one row; defaults do the rest.

---

## 4. How the generate → review → act loop should feel

Right now the loop *ends* at review. It should **spiral**: every output is a launchpad for the next teaching artifact on the same context.

- **Live progress, not a frozen spinner.** Lesson plan already got this right (`LessonPlanLoadingOverlay`, shape-matched skeleton, Cancel). Quiz and worksheet still show a bare spinner ("wizard is working its magic…") for 20–30s — port the shape-matched, cancellable, rotating-hint overlay to *every* generator. On patchy 4G, a 25-second dead spinner reads as "the app crashed."

- **Trust cues on review.** Keep the honest "Sahayak can make mistakes, please review" line — it fits the teacher-dignity tone (she's the expert; AI is the assistant). Make the act-bar identical and predictable across every output type: **Edit · Save · Download · Share · Listen** (TTS read-aloud is a natural voice-first fit and currently absent from results).

- **The critical addition — "Next" chaining.** After any generation, surface 2–3 context-carrying follow-ups:
  > *Lesson plan done →* **[Make a quiz]** **[Make a worksheet]** **[Create a visual aid]** — all pre-filled with the same topic/grade/subject/language, one tap, no re-typing.

  This is a small component (a row of buttons that deep-link with query params — the pages *already* parse `?topic=&subject=&gradeLevel=&language=`, so the plumbing exists) and it's the highest-leverage UX change in this doc. It turns 5 disconnected tools into one coherent lesson-prep session.

- **Save must be unambiguous.** One primary **Save** that persists to library with a clear confirmation ("Saved to My Library" + a tap-through), and demote Share to secondary. Auto-save a draft the instant a result renders so nothing is ever lost on a dropped connection.

- **Warm the return.** `/my-library` should open on **"Recent"** with a "Continue" affordance and group by class/subject, so coming back feels like reopening a notebook, not browsing a file dump.

---

## 5. Prioritization — quick-wins vs big-bets

**Quick wins (days, high leverage, low risk):**

1. **"Next: Make a quiz / worksheet / visual aid" chaining row** on every result. Deep-links already accept the params. *Highest ROI in the doc.*
2. **De-duplicate the quiz form** (remove the redundant question-type block) and **collapse advanced controls** (Bloom's, sliders) behind "More options," defaults visible. Same for worksheet.
3. **Port the lesson-plan loading overlay** (skeleton + Cancel + rotating hints) to quiz, worksheet, and every other generator.
4. **Add "Listen" (TTS read-aloud)** to result act-bars — voice-first product, currently output-only-visual.
5. **Unify the act-bar** label set and order across all output components; make Save's confirmation explicit.

**Big bets (weeks, reshape the model):**

1. **Generate-then-refine home flow:** router generates immediately and lands on result with editable parameter chips; forms demoted to a drawer. Rewires the app's central loop to finally honor the voice promise.
2. **Intent-first IA (Teach / Check / Ask + My Work):** shrink the browsable surface, let ⌘K be the power-user index. Re-onboard the mental model around 3 verbs.
3. **Library as workspace:** recents-first, grouped by class/topic, "continue," re-generate — the teacher's notebook, not a file list.
4. **Consolidate i18n architecture** (retire per-file `translations` objects → shared `t()`), so every screen reaches first-class quality in all 11 languages. Infra work, but it's why screen quality is uneven today.

**Sequencing:** ship the quick wins first — chaining + form simplification alone will visibly tighten the loop and de-risk the bigger generate-then-refine bet by proving the deep-link plumbing under real teacher load.
