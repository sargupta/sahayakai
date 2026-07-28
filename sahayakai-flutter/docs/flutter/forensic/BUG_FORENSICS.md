# BUG_FORENSICS.md

## SahayakAI Flutter App — Confirmed Defects

**Scope of this document.** The full mobile review produced 40 confirmed findings. The large majority are *parity gaps* — capabilities the web app has and the mobile app simply never built (no PDF export, no save-to-library, no example prompts, no image input, no community share). Those are catalogued in the parity report and are **not** repeated here.

This document isolates the subset that are genuine **defects**: places where the mobile app does the wrong thing rather than merely omitting a feature — output that renders broken, a promised flow that silently dies half-way, a hard product mandate violated at runtime, or an input space that admits nonsensical values. A missing feature is a gap; a filled form that never generates, a math worksheet full of raw `$…$`, and an English-only dropdown in a "11 Indic languages" product are defects. Six of them, ranked by severity.

Every defect below was traced to a concrete `file:line` in the mobile source. Where the web contrast clarifies the *intended* behavior, it is cited too.

---

### Severity summary

| # | Defect | Class | Tools affected | Severity |
|---|--------|-------|----------------|----------|
| 1 | Worksheet math renders as raw LaTeX markup | Output corruption | Worksheet Wizard | **HIGH** |
| 2 | Voice/VIDYA intent fills the form but never generates | Broken flow (silent) | Lesson Plan, Instant Answer, Rubric | **HIGH** |
| 3 | Grade & Subject option labels are English-only | i18n mandate violation | Instant Answer (pattern likely wider) | **MEDIUM-HIGH** |
| 4 | Board-exam paper offers Nursery/LKG/UKG grades | Invalid input space | Exam Paper | **MEDIUM** |
| 5 | Instant Answer markdown parser discards link URLs & blockquotes | Output data loss | Instant Answer | **LOW-MEDIUM** |
| 6 | Lesson-plan body renders literal `**asterisks**` | Output corruption (cosmetic) | Lesson Plan | **LOW** |

Note the two clusters: **#1, #5, #6 share one root cause family** — mobile's text renderer does not parse markdown/LaTeX. **#2 is a single broken dispatcher** manifesting identically across three tools. Fixing the roots kills five of the six findings.

---

## DEFECT 1 — Math worksheets render as raw LaTeX markup

**Severity: HIGH** (source finding P22). Output corruption on a core use case.

**What's broken.** The worksheet-generation server flow is *hard-instructed* to emit every mathematical formula as LaTeX wrapped in dollar signs — `src/ai/flows/worksheet-wizard.ts` rule 5: "Use LaTeX for ALL mathematical formulas … Wrap ALL LaTeX in dollar signs: `$…$`". The web display typesets it with KaTeX. The mobile display pipes the identical string through a bare Flutter `Text` widget, so a fraction the model emits as `$\frac{1}{2}$` appears on the teacher's screen literally as `$\frac{1}{2}$`. Any math worksheet — arguably *the* worksheet use case — comes out looking broken.

**Location (mobile):**
- `lib/features/worksheet_wizard/presentation/widgets/worksheet_result_view.dart:90-105` — routes `studentInstructions` / `activity.content` / `answer` through `AiText`.
- `lib/shared/widgets/ai_text.dart:25-36` (widget body, doc at `:13-38`) — `AiText` is a plain `Text`; no markdown, no math, no `$…$` handling.
- `lib/features/worksheet_wizard/domain/worksheet.dart:65` — the domain model itself flags the hazard: "The activity itself … may carry LaTeX in `$…$`." The renderer ignores the warning.

**Location (web, intended behavior):** `src/components/worksheet-display.tsx:6-8` imports `remark-math` / `rehype-katex` + KaTeX CSS; `:131-136` renders through `<ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>`.

**Repro:**
1. Open Worksheet Wizard, supply a math context (photo a Class 8 algebra page) and prompt "5 questions on solving linear equations."
2. Generate.
3. Observe the result: equations show as literal `$...$` strings; any `**bold**` shows literal asterisks.

**Impact.** The tool's deliverable is a print-ready worksheet handed to students. For any math topic it produces garbage the teacher cannot use and would be embarrassed to distribute. This is a shipping-blocker for the worksheet tool on math content, which is a large fraction of primary-grade worksheets.

**Fix direction.** Give `AiText` (or a math-aware variant) a markdown + LaTeX renderer, or route worksheet content through a KaTeX-capable Flutter widget. This is the same renderer gap as Defects 5 and 6.

---

## DEFECT 2 — Voice/VIDYA intent fills the form, then dies at a static form

**Severity: HIGH** (source findings P2, P15, P33). A silently broken flow that guts the product's stated differentiator, reproduced identically across three tools.

**What's broken.** On web, a VIDYA voice directive arrives as URL params, sets the fields, and then auto-fires generation after 300 ms — "plan a Class 10 maths lesson on fractions" spoken produces a finished plan with **zero taps**. On mobile, the VIDYA navigation dispatcher pushes the route with a prefill payload that fills the fields and then **stops**. The teacher is dropped on a static, pre-filled form and must hunt for the Generate button. The spoken request never completes to a result. The "speak → generate" leg — the founder's entire voice-first thesis — is present in the plumbing (the prefill is delivered) but the final submit call was never wired. It fails silently: nothing errors, the form just sits there filled.

**Location (mobile):**
- `lib/features/vidya/presentation/vidya_nav_dispatcher.dart:66-72` — dispatch is `context.push(route, extra: prefill)` and nothing else; no submit is ever invoked.
- Lesson Plan: `lib/features/lesson_planner/presentation/lesson_plan_screen.dart:68-79` (`_applyPrefill` sets controllers/fields only) + `:87-100` (`_submit` fires *only* from the Generate button).
- Instant Answer: `lib/features/instant_answer/presentation/instant_answer_screen.dart:61-81` (`initState` calls only `_applyPrefill`); `ask()` is reachable only via `_submit()` (line 99), wired only to the sticky button (line 154).
- Rubric: `lib/features/rubric_generator/presentation/rubric_generator_screen.dart:54-59` (`initState` → `_applyPrefill`, no generate), `:65-76` (`_applyPrefill` seeds fields only), `:84-94` (`_submit` fires only from the Generate button at `:144`).

**Location (web, intended behavior):** all three auto-submit after prefill —
- `src/features/lesson-planner/hooks/use-lesson-plan.ts:262-277` — `setValue(...)` then `setTimeout(() => form.handleSubmit(onSubmit)(), 300)`.
- `src/app/instant-answer/page.tsx:312-326` — same pattern.
- `src/app/rubric-generator/page.tsx:152-162` — same pattern.

**Repro:**
1. Trigger VIDYA and issue a fully-specified voice request (e.g., "make a rubric for a Class 8 debate assignment").
2. VIDYA dispatches `NAVIGATE_AND_FILL`; the app routes to the tool screen with fields pre-populated.
3. Observe: the form is filled, but no generation runs. You are left on the form and must locate and tap Generate to actually get output.

**Impact.** Every voice-driven task ends at a form instead of a result. For a product whose north star is voice-first, hands-free use by rural teachers, this converts the headline capability into "voice fills a form for you" — strictly worse than the web app, which completes the task. It is silent (no error, no hint that a step is missing), so it will be read as "the assistant is dumb," not "a submit call is missing." One dispatcher fix (invoke the screen's submit after prefill, guarded so partial prefills don't auto-run) repairs all three tools.

---

## DEFECT 3 — Grade and Subject dropdown labels are English-only

**Severity: MEDIUM-HIGH** (source finding P18). Runtime violation of the hard 11-language product mandate.

**What's broken.** SahayakAI's non-negotiable mandate is 11 Indic languages, never English/Hindi-only. On the Instant Answer form, the Grade and Subject dropdowns render the raw English API enum values (`"Class 6"`, `"Mathematics"`) verbatim, regardless of the UI language. A teacher who has set the app to Bengali or Tamil sees the class and subject options in English script. Web resolves every one of these labels through the localization dictionary. Only the "Any grade"/"Any subject" placeholders and the language picker itself are localized on mobile — the actual option lists leak the backend enum straight to the UI.

**Location (mobile):**
- `lib/features/instant_answer/presentation/instant_answer_screen.dart:218` — `DropdownMenuItem(value: grade, child: Text(grade))`.
- `:239` — `Text(subject)`.
- Both draw straight from `lib/shared/domain/picker_options.dart:11-44` (`kGradeLevels` / `kSubjects`), which are deliberately un-localized API enum values.

**Location (web, intended behavior):** `src/components/grade-level-selector.tsx:51` renders `{t(grade)}`; `src/components/subject-selector.tsx:26` renders `{t(subject)}` — localized for all 11 languages.

**Repro:**
1. Set app language to Bengali (or Tamil).
2. Open Instant Answer.
3. Open the Grade dropdown, then the Subject dropdown.
4. Observe every option is in English ("Class 6", "Mathematics"), not the selected script.

**Impact.** Two of the most-used controls in the app break the core localization promise for every non-English user. Because these dropdowns are fed by the shared `kGradeLevels`/`kSubjects` constants and rendered with the same `Text(value)` pattern, **this is almost certainly not confined to Instant Answer** — the same anti-pattern should be audited across every tool that renders a grade/subject picker (Quiz, Lesson Plan, Rubric, Exam Paper). Treat P18 as the confirmed instance of a likely-systemic i18n defect.

**Fix direction.** Route grade/subject labels through the l10n layer at render time while keeping the English enum as the transmitted `value`. Then grep the codebase for `Text(grade)` / `Text(subject)` / direct `kGradeLevels`/`kSubjects` rendering and fix all sites.

---

## DEFECT 4 — Board-exam paper accepts Nursery / LKG / UKG grades

**Severity: MEDIUM** (source finding P36). Invalid input space; the UI admits nonsensical requests the web app deliberately blocks.

**What's broken.** The Exam Paper tool generates board-pattern exam papers, and the app only has official board blueprints for Class 9 and Class 10. Web restricts the grade dropdown to exactly those two values. Mobile populates the same dropdown from the generic 15-entry grade list — Nursery, LKG, UKG, Class 1–8 included — so a teacher can request a "board exam paper for Nursery." That is not a real thing; there is no board exam and no blueprint for it, but the form happily accepts it and sends it to generation.

**Location (mobile):**
- `lib/features/exam_paper/presentation/exam_paper_screen.dart:237-254` — `_gradeField` iterates `kGradeLevels`.
- `lib/shared/domain/picker_options.dart:11-27` — `kGradeLevels` has 15 entries beginning `'Nursery', 'LKG', 'UKG'`.

**Location (web, intended behavior):** `src/app/exam-paper/page.tsx:90` — `GRADE_OPTIONS = ['Class 9','Class 10']`; the grade `Select` at `:438-449` iterates only those two.

**Repro:**
1. Open Exam Paper.
2. Open the Grade dropdown → Nursery, LKG, UKG, Class 1–8 are all offered.
3. Select "Nursery," complete the form, generate.
4. A "board exam paper for Nursery" is produced (no blueprint exists, so the output has no board grounding).

**Impact.** Wastes a generation on an incoherent request, produces board-pattern output for a grade that has no board, and signals to the teacher that the tool doesn't understand its own domain. Web treats this as an invalid state by construction; mobile does not. Lower blast radius than #1–#3 (only teachers who pick an absurd grade hit it), hence MEDIUM.

**Fix direction.** Restrict the Exam Paper grade list to the blueprint-backed grades (Class 9, Class 10), matching `GRADE_OPTIONS`. Ideally derive it from the available blueprints so it stays correct as blueprints are added.

---

## DEFECT 5 — Instant Answer markdown parser drops link URLs and blockquotes

**Severity: LOW-MEDIUM** (source finding P20). Silent data loss in rendered output, worst on a search-grounded tool.

**What's broken.** Instant Answer is the one mobile tool with a hand-rolled markdown renderer (`answer_markdown.dart`), but it is lossy in two specific ways. Its inline regex captures a `[label](url)` link but then keeps only the label and **discards the URL**, so a clickable source becomes flat text. And its sealed `MarkdownBlock` set has no blockquote type, so any `>` line falls through and renders as a plain paragraph. Web renders the answer through `ReactMarkdown` (CommonMark), so links stay clickable and blockquotes render as quote blocks.

**Location (mobile):**
- `lib/features/instant_answer/domain/answer_markdown.dart:110-115` — inline regex captures the link.
- `:239-241` — `addPlain(match.group(6)!)` keeps only the label; the URL is thrown away.
- `:59-98` — the sealed `MarkdownBlock` set has heading/paragraph/bullet/numbered/code/divider but **no blockquote**; a `>` line hits the paragraph fallthrough at `:197`.

**Location (web, intended behavior):** `src/app/instant-answer/page.tsx:567` — `<ReactMarkdown>{answer.answer}</ReactMarkdown>` (default CommonMark).

**Repro:**
1. Ask a question whose answer cites a source link or includes a quoted passage (e.g., a factual/current-events question).
2. Observe: the link renders as plain text with the destination URL gone; the quote renders as an ordinary paragraph with a leading `>`-stripped line.

**Impact.** This tool is branded "powered by Google Search," so citation links are the point — silently deleting the URL is worse here than in a generic renderer; the teacher can see a source is named but can't reach it. Blockquote loss is cosmetic. Rated LOW-MEDIUM because it degrades trust/verifiability rather than breaking generation.

**Fix direction.** In `answer_markdown.dart`, preserve the captured URL (emit a tappable link span) and add a blockquote block type. If the renderer is unified with `AiText` per Defect 1's fix, ensure the shared renderer covers links and blockquotes.

---

## DEFECT 6 — Lesson-plan body renders literal `**asterisks**`

**Severity: LOW** (source finding P6). Cosmetic output corruption; same root cause as Defect 1.

**What's broken.** The lesson-plan model emits markdown emphasis (`**bold**`, `*italic*`) in activity names, descriptions, and the assessment. Web converts it to real bold/italic. Mobile renders each of these through the bare `AiText`/`Text` widget, so the emphasis shows up as literal asterisks in the plan.

**Location (mobile):**
- `lib/shared/widgets/ai_text.dart:13-38` — plain `Text`, no markdown parsing (the doc comment itself notes only Instant Answer has a markdown renderer).
- `lib/features/lesson_planner/presentation/widgets/lesson_plan_result_view.dart:80, 363` — uses `AiText` for description/assessment.

**Location (web, intended behavior):** `src/components/lesson-plan-display.tsx:31-38` (`renderMarkdown`) applied at `:518-520` (activity name/description) and `:544` (assessment).

**Repro:**
1. Generate any lesson plan.
2. Read the activities/assessment — emphasized phrases appear as `**like this**` with visible asterisks.

**Impact.** Purely cosmetic; the plan is readable, just unpolished and visibly "raw." Low severity on its own, but it is the cheapest confirmation that the `AiText` renderer gap (Defect 1) touches multiple tools. Fixing `AiText` once resolves this and Defect 1 together.

---

## Root-cause rollup

Two roots account for five of the six defects:

1. **`AiText` is a bare `Text` widget** (`lib/shared/widgets/ai_text.dart:25-36`). It parses neither markdown nor LaTeX, yet is used to display model output that is *contractually* markdown/LaTeX. This produces Defect 1 (worksheet LaTeX, HIGH) and Defect 6 (lesson-plan bold, LOW), and Instant Answer only escapes it by using a *separate, lossy* parser that yields Defect 5. **One fix** — a shared markdown+math-aware text widget — closes Defects 1, 5, and 6.

2. **The VIDYA dispatcher delivers prefill but never triggers submit** (`vidya_nav_dispatcher.dart:66-72`). One missing call, replicated across Lesson Plan, Instant Answer, and Rubric, is Defect 2 (HIGH). **One fix** — invoke the target screen's submit after a complete prefill — repairs the voice-first flow across all three.

The remaining two are independent, small, and mechanical: localize the grade/subject option labels (Defect 3, and audit the other tools for the same `Text(value)` pattern) and restrict the Exam Paper grade list to blueprint-backed grades (Defect 4).

## Explicitly out of scope (parity gaps, not defects)

For completeness, the following confirmed findings were reviewed and **excluded** from this document because they are missing capabilities, not defective behavior: absence of PDF/print export, save-to-library, share-to-community, in-place editing, per-question refine/add, feedback dialogs, example-prompt chips / quick-start templates, image/context-photo input, NCERT chapter linking, blueprint preview cards, proactive usage badges, offline generation fallback, and result read-aloud/TTS. They are real product gaps and belong in the parity report — but the app is not doing anything *wrong* when it lacks them, so they are not bugs. Two honest edges worth flagging as you triage: mobile is actually *ahead* of web on voice **input** (working field dictation mic vs. web's imported-but-never-rendered `MicrophoneInput`), and **neither** platform speaks results aloud — so the "hear the result" half of the voice loop is unmet everywhere, a gap rather than a mobile regression.