# 04 — Taste Audit: Where SahayakAI Still Looks Cheap

Reviewer's lens: honest, ruthless, constructive. Read against real class names in `dashboard-home.tsx`, `community/page.tsx`, `pricing/page.tsx`, `quiz-generator/page.tsx`, `visual-aid-designer/page.tsx` + their display components. Scope is taste only — not code health.

The good news first: you have real design tokens (`rounded-surface-md`, `shadow-soft`, `shadow-elevated`, `type-h2`, `ease-out-quart`, `card-accent-bar`) and a shared `ResultShell`. The problem is nobody uses them consistently. The app looks like three different teams shipped three different design systems and never reconciled.

## 1. What looks cheap / template-y, screen by screen

**Dashboard home (`dashboard-home.tsx`)**
- **Textbook AI-slop skeleton**: centered badge pill ("Sparkles + AI-Powered Teaching Assistant for Bharat") → giant centered `text-7xl` greeting → centered subhead → centered input → a **2×4 / 4-col grid of equal cards**. This is the exact hero+equal-cards template the brief says to hate. Nine identical `QuickActionCard`s with the same icon-in-a-tinted-circle treatment read as filler, not hierarchy.
- **Every card is the same weight.** `border-l-2 border-l-primary` on all nine tools means the accent stops meaning anything — an accent everywhere is an accent nowhere.
- **Icon monotony**: every tool icon sits in `bg-primary/10 rounded-surface-md` — no color coding, no size variance. A wall of orange-tinted squares.
- **Hardcoded English leaks** in an 11-language app: `try: "Quiz about photosynthesis"…` and `Works in हिंदी, ಕನ್ನಡ, தமிழ் + 8 more` are raw strings, not `t()`. Cheap on a Tamil teacher's screen.
- **The `absolute top-0 h-1.5 w-full bg-primary` bar** floats over a `container-wide` flex column — it doesn't align to any card edge, so it reads as a stray ruler.

**Community (`community/page.tsx`)**
- **Radius civil war**: this page uses `rounded-md` everywhere (header, tiles, hints, empty state) while the dashboard uses `rounded-surface-md` and visual-aid uses `rounded-2xl`. Side by side the corners visibly disagree.
- **Header is a generic SaaS bar**: `bg-muted` icon chip + title + subtitle. Fine, but forgettable — no editorial character for a page that's meant to feel like a staff room.
- **Two equal `grid-cols-2` action tiles** (Staff Room / Find Teachers) are yet another equal-card pattern. `active:scale-[0.98]` on tiles but `active:scale-95` on the FAB — inconsistent press physics.
- **`text-white` hardcoded** on the FAB and elsewhere instead of `text-primary-foreground` — breaks the token contract and any future dark mode.
- **Section headings drift**: `type-h2` on the page title but raw `font-headline text-lg font-bold` on "Shared Resources" and the sub-views. Two heading systems.

**Pricing (`pricing/page.tsx`)** — *the most premium page in the set, and it proves the others are undercooked.*
- This page is genuinely editorial: bracketed pixel type (`text-[42px]`, `leading-[1.05]`), italic accent clause, `md:divide-x` tier columns instead of floating cards, restrained saffron. **This is the bar.** But…
- **It's a design island.** It hardcodes its own `PRICING_STRINGS` table, its own radii (`rounded-[12px]`, `rounded-[14px]`), its own shadows (`shadow-[0_14px_28px_-12px_…]`). None of this is tokenized, so the quality can't propagate.
- **`force-light`** opts the whole page out of theming — a tell that the token system wasn't trusted to hold.
- Bespoke shadow math (`0_10px_22px_-8px_hsl(...)`) repeated inline five times is a maintenance and consistency trap.

**Quiz generator (`quiz-generator/page.tsx`)**
- **Centered icon-in-a-circle + title + description** header — the same slop hero as every other generator. `FileSignature` in `rounded-full bg-primary/10` is indistinguishable from the visual-aid page's `Images` in `rounded-full bg-primary/10`. Tools aren't visually differentiated.
- **Redundant, conflicting controls**: Question Types appears **twice** — once as `SelectableCard`s (left col) and again as checkboxes in a `rounded border border-border/50` box (right col). Two mechanisms, two radii, for one field. Confusing and unpolished.
- **Radius soup in one file**: `rounded-surface-md`, `rounded-lg`, `rounded-xl`, `rounded` all appear. Plus `bg-primary/8` (an off-scale opacity nobody else uses).
- **Hardcoded slate tooltip**: `bg-[#1e293b] text-white border-slate-700` — a cold gray-blue dropped into a warm saffron app. Jarring.
- **Micro-typography abuse**: `text-[10px] uppercase tracking-tighter` for "Pedagogical Strategy" is cramped and hard to read, especially in Indic scripts.

**Visual aid designer (`visual-aid-designer.tsx`)**
- **`max-w-2xl` single column** while quiz is a 12-col `container-wide` split. Two generators, two completely different page architectures — no shared shell.
- **Giant `translations` object inline** (200 lines) is the *third* i18n pattern in the codebase (dashboard hardcodes, pricing has `PRICING_STRINGS`, this has `translations`). Inconsistency you can feel in drift.
- **`rounded-2xl` card** vs quiz's `rounded-surface-md` `SectionCard`. Same product, different corners.
- **Result divider** (`hr … Result … hr`) is duplicated by hand in both generators with slightly different classes (`tracking-widest` here, `type-caption` in quiz).

## 2. Ten highest-impact "make it look premium" fixes (ranked)

1. **Kill the equal-card grid on the dashboard.** Promote 3–4 primary tools to larger tiles with real color-coded icons and supporting copy; demote the rest to a compact list or "More tools" row. Hierarchy > uniformity.
2. **Adopt the pricing page's editorial voice as the house style** and tokenize it: promote its type ramp, `divide-x` column pattern, and shadow to `shadow-premium` / `type-display` tokens. Make quality reusable.
3. **One radius scale, enforced.** Ban raw `rounded-md/lg/xl/2xl/[12px]`; everything routes through `rounded-surface-{sm,md,lg}`. This single change removes most of the "cheap" feeling.
4. **One shared generator shell.** Both quiz and visual-aid render through the same `<GeneratorPage header controls results>` component (header, accent bar, result divider, spacing). Kills the architecture divergence.
5. **Color-code tool identity.** Give each tool a stable accent (still saffron-family or a curated secondary) so icons stop being a wall of `primary/10` squares. Quiz ≠ Visual Aid at a glance.
6. **Delete duplicate controls.** Quiz's Question Types must appear once. Remove the checkbox block; keep `SelectableCard`s.
7. **Retire every hardcoded color.** `#1e293b`, `text-white`, `bg-primary/8`, `slate-700` → tokens (`text-primary-foreground`, warm `popover` surface, on-scale opacity). Warm app, warm everything.
8. **Unify i18n surfaces.** Collapse the three ad-hoc string tables into the shared `t()` dictionary. Untranslated English in a Bharat-first app is the single loudest cheapness tell.
9. **Fix the accent-bar alignment.** The floating top bar should be a real card edge or `card-accent-bar`, not an unanchored `absolute` ruler.
10. **Reduce accent noise.** Drop `border-l-primary` from *every* card; reserve the left-accent for the active/result/emphasized surface only.

## 3. Five anti-patterns to ban going forward

1. **Centered-hero + N-equal-cards + tinted-circle-icon.** The default AI layout. If a screen is a symmetric stack of identical cards, redesign it.
2. **Raw `rounded-[Npx]` / off-scale `bg-primary/8` / inline `shadow-[…]`.** Any pixel value or opacity not in the token scale is a bug.
3. **Hardcoded hex or `text-white`** — especially cold grays (`slate`, `#1e293b`) in a saffron app.
4. **Per-page i18n string tables.** One dictionary. Untranslated English strings ship = broken.
5. **`text-[10px]` + `tracking-tighter` + `uppercase` micro-labels.** Cramped and hostile to Devanagari/Kannada/Tamil ascenders. Minimum `text-xs`, normal tracking for Indic.

## 4. Three reference aesthetics that fit a dignified Indian-teacher tool

- **Calm editorial (the pricing page, extended).** Generous whitespace, a real type ramp, hairline dividers instead of boxes, italic accents for warmth, restrained saffron used as ink not fill. Reads as considered and trustworthy — Stripe/Linear calm, warmed for Bharat.
- **Warm institutional / "government-grade but human."** The register of a well-made NCERT textbook or a respected public university: structured, legible, serif-ish headlines, muted saffron and ivory, clear labeled sections. Signals credibility to a headmaster without feeling corporate-cold.
- **Quiet craft (voice-first minimal).** For the dashboard specifically: one clear focal action (the mic/input), everything else recedes. Fewer, larger, more deliberate elements; motion that settles fast. Confidence through restraint, not through cramming nine cards above the fold.

**Bottom line:** the pricing page shows this team *can* build premium. The rest of the app hasn't caught up. The fix isn't more design — it's propagating the taste you already shipped, and enforcing one token scale so it can't drift again.
