# 05 — Frontend Architecture for a Full Redesign

**Lens:** the component architecture that makes a full redesign *fast, consistent, and maintainable*. Design ambition is worthless if applying it means editing 15 pages by hand. This proposal defines the primitives so that one edit re-skins every generator.

## 1. The problem: 15 pages, 3 dialects, 1 shape

Every generator page (`lesson-plan`, `quiz-generator`, `worksheet-wizard`, `exam-paper`, `rubric-generator`, `visual-aid-designer`, `virtual-field-trip`, `teacher-training`, `instant-answer`, `content-creator`, `assessment-scanner`, …) is the **same state machine**:

> auth guard → build headers (`Bearer` / `x-user-id`) → `POST /api/ai/*` → handle 401 / limit (`useLimitGuard`) / 202 / malformed → set result → render display + `ShareToCommunityCTA` → restore-from-`?id` → VIDYA `?topic=` prefill + 300ms auto-submit → VIDYA form-snapshot sync.

That logic is **copy-pasted with drift** across all of them. Three incompatible dialects have emerged:

- **`quiz-generator/page.tsx`** — Tailwind utility hell inline (`lg:col-span-7`, hand-built accent bars, bespoke Result divider), chrome via `translate()`.
- **`worksheet-wizard/page.tsx`** — a **200-line per-language `translations` dict literal** hardcoded in the file (en/hi/bn/te/mr/ta/gu/kn/pa/ml/or), its own loading `Card`, its own Result divider.
- **`exam-paper/page.tsx`** — imperative `useState` (no react-hook-form), its own auth guard, its own skeleton, ~200 lines of bespoke paper-preview markup, and *its own* per-language `Q`-prefix / marks-abbrev maps.

**What already exists and works** (do not rebuild):
- `src/components/ui/result-shell.tsx` — `ResultShell` unifies the *output card* chrome (header, meta badges, actions, footer). **Adopted by 10 display components.** This is the success case to emulate.
- `src/components/layout/` — Phase 1-2 primitives: `PageShell`, `SectionCard`, `FieldRow`, `EmptyState`, `PageCTA`, `InlineMicButton`, plus `container-narrow/default/wide`, `type-*`, `rounded-surface-*`, `shadow-soft/elevated`, `duration-micro` tokens in `globals.css` + `DESIGN_TOKENS.md`.
- `src/features/lesson-planner/` — the **gold-standard module shape**: `hooks/use-lesson-plan.ts` (all logic) + `components/lesson-plan-view.tsx` (all markup) + `types.ts`. Page is 11 lines.

The gap is **the middle layer**: `ResultShell` skins the result, `SectionCard` skins a panel, but nothing owns the *page-level orchestration + layout*. So each page re-invents it. Close that gap and a redesign is a props change, not a 15-file rewrite.

## 2. The `GeneratorPage` primitive

A single headless-hook + presentational-shell pair that every generator composes. Modeled on the lesson-planner split, generalized.

### 2a. `useGenerator<TInput, TOutput>` — the orchestration hook

Absorbs the duplicated state machine so pages stop hand-writing `fetch`/401/limit/VIDYA logic.

```ts
// src/features/_shared/use-generator.ts
interface UseGeneratorConfig<TInput extends FieldValues, TOutput> {
  feature: FeatureKey;              // "quiz" — drives limit guard + usage badge + analytics
  endpoint: string;                 // "/api/ai/quiz"
  schema: ZodSchema<TInput>;
  defaults: DefaultValues<TInput>;
  toRequest?: (v: TInput) => object;        // default: strip "General" subject, force non-empty language
  fromSaved?: (doc: SavedContent) => { input: Partial<TInput>; output: TOutput };
  vidyaKeys?: (keyof TInput)[];             // fields to hydrate from ?topic=&subject=… + snapshot
  autoSubmitOnVidya?: boolean;              // default true, the 300ms pattern
}
interface UseGeneratorResult<TInput, TOutput> {
  form: UseFormReturn<TInput>;
  result: TOutput | null;
  status: "idle" | "loading" | "success" | "error" | "pending"; // "pending" = 202
  submit: () => void;
  regenerate: () => void;
  reset: () => void;
  limitState: LimitState;
  canUseAI: boolean; aiUnavailableReason?: string;
}
```

This centralizes: auth headers, `getAuthToken`, `useLimitGuard`, `useNetworkAware`, the 401→`openAuthModal`, the 202 "still generating" branch, the malformed-response guard (the exam-paper "undefined undefined undefined" fix), `useVidyaFormSync`, `?id=` restore, analytics/`markChecklistItem`, and the double-submit `submittingRef`. **Every bug fixed once, everywhere.**

### 2b. `<GeneratorPage>` — the presentational shell

Owns the frame so redesigns land here once.

```tsx
<GeneratorPage
  icon={FileSignature} title={t("Quiz Generator")} description={t("Create a quiz…")}
  feature="quiz" status={status} limitState={limitState}
  layout="split"                    // "split" (7/5 form+config) | "stacked" (worksheet) | "wide"
  form={<QuizForm form={form} />}   // the input panel (fields only)
  result={result && <QuizDisplay quiz={result} onRegenerate={regenerate} />}
  loading={<LoadingChoreography feature="quiz" />}
  onSubmit={submit} submitLabel={t("Generate Quiz")}
  share={<ShareToCommunityCTA contentType="quiz" />}
/>
```

`GeneratorPage` renders: `PageHeader` (icon + title + `UsageRemainingBadge`), the `UpgradePrompt` when `limitState.limitReached`, the input `SectionCard`, the submit `Button` + `aiUnavailableReason` note, the `Result` divider, and the result region in a `ResultShell`-consistent frame — **all from tokens**. The page file drops from ~650 lines to ~40. `layout` is an enum, not bespoke grid classes, so the redesign picks widths/columns in one switch.

## 3. Component inventory the design system needs

Existing (`layout/`): `PageShell`, `SectionCard`, `FieldRow`, `EmptyState`, `PageCTA`, `InlineMicButton`, `ResultShell`. **Add:**

| Component | API sketch | Replaces |
|---|---|---|
| `GeneratorPage` | above | the 15 hand-rolled page bodies |
| `PageHeader` | `{ icon, title, description, badge?, breadcrumb? }` | the 3 divergent centered-header blocks (quiz vs worksheet vs exam) |
| `ToolCard` | `{ icon, title, description, href, badge? }` | `QuickActionCard` + `SuggestionCard` (both re-declared inside `dashboard-home.tsx`) + `nav-items` |
| `LoadingChoreography` | `{ feature, variant?: "spinner"\|"skeleton"\|"steps", messages? }` | worksheet spinner-Card, exam-paper `Skeleton` block, lesson-plan step overlay — 3 loaders, 1 API |
| `ResultDivider` | `{ label? }` | the `<hr/>…Result…<hr/>` triplet pasted in ≥4 pages |
| `FieldGroup` / `SelectableChipGroup` | `{ options, value, onChange, multi? }` | the Bloom's-levels + question-types + chapters chip grids (re-hand-rolled per page) |
| `ConfigPanel` | `{ children }` | the right-column `bg-card p-4 … border shadow-soft` config box |
| `AsyncBoundary` | `{ status, loading, error, empty, children }` | the `{isLoading && …}{result && …}` ladders |
| `AuthGate` | `{ children, fallback? }` | exam-paper's bespoke `authed`/`loading` guard |

`ToolCard` is high-leverage: nav sidebar, dashboard grid, and empty-state samples currently describe the *same 15 tools three times*. One `TOOLS` registry (`{ key, icon, label, href, group, badge }`) + `ToolCard` means adding a tool = one array entry.

## 4. Theming / token propagation

Foundation is right: HSL CSS vars in `:root`/`.dark`, semantic aliases (`--primary`, `--card`, `--border`), `type-*`/`container-*`/`rounded-surface-*` utilities. To make token changes propagate cleanly:

- **Ban raw values in feature code.** The blockers today: `bg-[#1e293b]`, `text-saffron-700`, `bg-orange-500`, `text-amber-600`, ad-hoc `rounded-2xl`/`shadow-lg`. Add an ESLint rule (`no-restricted-syntax` on hex/`bg-orange`/`shadow-lg` in `src/app` + `src/components`) so a palette change can't be silently bypassed. Route everything through semantic tokens.
- **Extend, don't invent.** `card-accent-bar`, the `border-l-4 border-l-primary/70 bg-primary/5` result frame, and the pill badges are already conventions — promote them to named tokens/components (`ResultDivider`, `AccentBar`) so they change globally.
- **Kill the per-file translation dicts.** `worksheet-wizard`'s 200-line `translations` and the `Q`-prefix/marks maps duplicate what `useLanguage().t` + `result-shell-i18n` already do. Move to the central i18n dictionary; a redesign of copy/tone then happens in one place across 11 languages.
- **One `force-light` truth.** The marketing `force-light` block re-declares every token by hand ("keep in sync" comment = a landmine). Generate it from the `:root` source so palette edits can't desync.

## 5. Accessibility & performance hooks (baked into the primitives)

Because a11y/perf live *inside* `GeneratorPage`/`ResultShell`, every page inherits them for free:

- **A11y:** submit uses `aria-busy` during `loading`; results region is `aria-live="polite"` (screen readers announce generation completion — currently silent); `ResultShell` actions already meet the 40px iOS touch target — enforce via `min-h-11`; focus moves to the result heading on success; every icon-only control (the `X` close, chip toggles) requires an `aria-label` prop (typed non-optional). Indic line-height floor 1.4 stays in `type-*`.
- **Perf:** display components (`quiz-display`, `worksheet-display`, `exam-paper` preview, `react-markdown`, `exportElementToPdf`) are heavy → `next/dynamic` them behind `LoadingChoreography` so the input panel ships in the first bundle and the ~20-30s AI wait hides the chunk fetch. Keep the existing `Suspense` + shape-matched skeleton (lesson-plan does this well). `LoadingChoreography` respects `prefers-reduced-motion`. Target: input interactive well under the AI latency on a mid-range Android (the "lagging" report).

## 6. Migration path (low-risk, incremental — never a big-bang rewrite)

The primitives are **additive**; pages migrate one at a time and old pages keep working.

1. **Ship the primitives** (`useGenerator`, `GeneratorPage`, `PageHeader`, `ToolCard`, `LoadingChoreography`, `AsyncBoundary`) beside `layout/`. Zero page changes. Snapshot-test in isolation.
2. **Pilot one page.** Convert `quiz-generator` (representative: image upload, chips, VIDYA, limits). Prove parity behind existing tests. This is the template PR.
3. **Introduce the `TOOLS` registry**, refactor `app-sidebar` + `dashboard-home` to `ToolCard` + registry. Immediate dedupe, isolated from generators.
4. **Fan out** worksheet, exam-paper, rubric, visual-aid, … one PR each (parallelizable across agents). Delete the per-file translation dicts as you go.
5. **Land the ESLint token guard** only after ≥80% migrated, so it doesn't block the transition.
6. Lesson-planner already matches the target shape → retrofit last (lowest ROI).

## 7. Quick wins vs big bets

**Quick wins (days, high ROI):**
- `ResultDivider` + `PageHeader` + `ToolCard` extraction — pure dedupe, no behavior change, kills the most-copied blocks.
- `TOOLS` registry — removes triple-maintenance of the tool list.
- Delete `worksheet-wizard`'s inline translation dict → central i18n.
- `aria-live` + focus-to-result in `ResultShell` — one edit, app-wide a11y lift.

**Big bets (weeks, transformative):**
- `useGenerator` + `GeneratorPage` — the unlock. Once every generator composes it, a full visual redesign is edits to *two files*, applied everywhere at once, with a11y/perf/limit/VIDYA correctness guaranteed by construction.
- ESLint token firewall — makes the design system *enforced*, not merely *available*.

**Net:** the redesign's cost is dominated by whether the 15 generators share a spine. Build `GeneratorPage` first; everything else composes into it.
