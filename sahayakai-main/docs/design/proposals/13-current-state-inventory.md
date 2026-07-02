# 13 — Current-State Inventory (The Grounding Map)

**Purpose.** This is the shared, factual map the rest of the design board builds on. It is a page-by-page inventory of what SahayakAI *actually* looks like today, inferred from the JSX/classNames in `src/app/**/page.tsx` and the components they render (no screenshots — every claim is traceable to a class name). It is descriptive, not prescriptive: fixes live in the sibling proposals (see `04-taste-audit.md`, `03-motion.md`).

**Method.** All ~47 route files were read. Cross-cutting facts (radius counts, accent-bar variants, hardcoded colors, shell adoption) were verified with repo-wide `grep`. Counts below are real.

**One-paragraph verdict.** The app is not one design — it is **three**, stitched at the shell. (1) A **marketing island** (`landing`, `pricing`, `about`, `for-schools`) that is genuinely premium: warm saffron radial grounds, editorial kicker/title/body ramps, bespoke shadows, `force-light`. (2) An **admin/dev island** (`cost-dashboard`, `log-dashboard`, `api-playground`, `api-docs`) that is bare shadcn primitives + gradient-text H1s. (3) The **core in-app product** (dashboard + ~15 generators + community + attendance + account) which *has* a real token system (`PageShell`, `SectionCard`, `ResultShell`, `type-h*`, `rounded-surface-*`, `card-accent-bar`, `shadow-soft`) — but **barely uses it**. The tokens exist; adoption never happened. That gap is the whole story.

---

## 1. Page-by-page inventory

Grouped by surface. "Header" = the top-of-page treatment. "Shell" = whether it uses the shared `PageShell`/`SectionCard`/`ResultShell` or ad-hoc `<div>`/`<Card>`.

### Shell & home

| Page | Purpose | Layout pattern | Components | Notable issues |
|---|---|---|---|---|
| `app-shell.tsx` | Global chrome router (marketing vs app) | Sidebar + 56px header (search pill, theme, lang, auth) + centered `<main>` `p-3→p-8` | `AppSidebar`, `OmniOrb`, `MobileBottomNav`, `CommandPalette` | Solid, consistent shell. Main is `items-center` → every page must self-manage max-width, which is where divergence starts. |
| `/` dashboard-home | Authed teacher home | Centered hero (`text-4xl→7xl`) → big mic → suggestions → 9-card `QuickActionCard` grid | ad-hoc `<Card>`, `MicrophoneInput`, onboarding widgets | Textbook AI-slop hero+equal-cards. `border-l-2 border-l-primary` on **all 9** cards (accent = noise). Stray `absolute h-1.5 bg-primary` bar unaligned to any edge. Hardcoded English leaks. |
| `/` landing-page | Cold-visitor B2B home | Saffron radial → rotating headline → pillar strip → quote → footer | `LandingNav/Hero/PillarStrip/Quote/Footer` | **Premium.** Cohesive editorial island. |

### Generator tools (the ~15)

| Page | Purpose | Layout | Header | Notable issues |
|---|---|---|---|---|
| `quiz-generator` | Quiz builder | **12-col split** (`container-wide`) + `ResultShell` | centered icon-in-`rounded-full bg-primary/10` + `card-accent-bar` | Question-Types control appears **twice** (cards + checkboxes). Radius soup (`surface-md/lg/xl/2xl`). Hardcoded `bg-[#1e293b] text-white border-slate-700` tooltip (cold gray in a warm app). `bg-primary/8` off-scale. |
| `worksheet-wizard` | Textbook→worksheet | single `max-w-2xl` | bare icon (no circle) + `card-accent-bar` + `rounded-2xl` | Mixes a local `translations` object with `t()`. Result card is bespoke `rounded-xl border-l-4`. |
| `rubric-generator` | Grading rubric | single `max-w-4xl` | centered icon + info-Dialog | Loading card missing the `animate-fade-in-up` other pages use (inconsistent motion). |
| `exam-paper` | Board exam paper | `max-w-3xl`, **imperative `useState`** (no RHF) | left-aligned + `card-accent-bar` | Only generator not on react-hook-form. Uncontrolled blueprint selects. No result animation. Partially a "coming soon" shell. |
| `instant-answer` | Search-grounded answer | single `max-w-2xl` + `ResultShell` | centered `Wand2` + `card-accent-bar` | Local `translations` object. `bg-primary/8` + `bg-accent/30` off-scale opacities. |
| `visual-aid-designer` | Line-drawing generator | single `max-w-2xl` + `ResultShell` | centered `Images` in `rounded-full bg-primary/10` | 200-line inline `translations` object (3rd i18n pattern). Icon indistinguishable from other generators. |
| `virtual-field-trip` | Google-Earth tour plan | single `max-w-2xl` + `ResultShell` | centered `Globe2` + `card-accent-bar` | Local `translations`. `ExamplePrompts` wrapped in one-off `bg-accent/20 rounded-lg`. Errors logged silently, no toast. |
| `video-storyteller` | Curated video recs | **`max-w-7xl`** grid + carousels | left-aligned `Video` in `rounded-xl bg-primary/10` | Widest generator by far. `bg-primary/8` insight banner, `bg-accent/30` hover. No standard empty/loading. |
| `assessment-scanner` | Answer-sheet OCR + score | `max-w-4xl` + `AssessmentResultCard` | centered `ScanLine` + `card-accent-bar` | Hybrid i18n (local tables + `t()`). Hardcoded `bg-green-600` check, `bg-amber-500/5`, `border-primary/30` off-scale. |
| `teacher-training` | Pedagogy coaching | **12-col split** (`max-w-6xl`) | centered `GraduationCap` (`sm:hidden`!) + `card-accent-bar` | Icon hidden on mobile (inconsistent). Hardcoded `green-600` counter. `border-primary/40` off-scale. Two local translation tables. |
| `visual-aid-creator` | (stub) | single `max-w-2xl` | `rounded-xl` + raw `h-1.5 bg-primary` bar | **"Coming soon" placeholder.** Duplicate/confusing route vs `visual-aid-designer` (the real one). |
| `content-creator` | Studio landing | `max-w-6xl` 3-col | centered title, `card-accent-bar` cards | 3 equal cards, `rounded-xl` icon tiles — mini AI-slop grid. |
| `lesson-plan` | Flagship planner | delegates to `LessonPlanView` (uses `SectionCard`) | — | One of the few real `SectionCard` consumers. Shape-matched skeleton (good). |
| `assess-assignment` | Assignment assessor | Suspense → `assess-client` | spinner fallback | Camera-heavy; behind `AuthGate`. |

### Community, library, messaging

| Page | Purpose | Layout | Header | Notable issues |
|---|---|---|---|---|
| `community` | Staff-room hub | `max-w-7xl` split (feed + sidebar) + 2-col action tiles | left icon in **`bg-muted rounded-md`** | Radius disagrees with rest (`rounded-md` header vs `surface-md`/`2xl` elsewhere). `text-white` FAB. Triage tones hardcoded (`red/rose/orange/emerald`). `bg-primary/8`, `/15`. Press physics differ (`scale-95` vs `0.98`). |
| `community-library` | Shared-resource discovery | `max-w-7xl`, `bg-card/30 backdrop-blur-lg` glass Card + Tabs | centered `Library` in circle | **Search bar is non-functional placeholder.** Content is mock/static. `AUTHOR_NAME_TABLE` (Latin→11 scripts). |
| `messages` | DMs | full-height split pane, `rounded-2xl` container | none (empty-state icon circle only) | Mobile relies purely on state-toggle visibility, no hamburger affordance. Empty state well-done. |
| `my-library` | Personal saved items | `container-wide`, `ProfileCard` + `SectionCard` | ultra-thin `h-0.5 bg-primary/60` accent | Uses `SectionCard` (good) but a **4th** accent-bar variant (`h-0.5`). Empty state delegated to `ContentGallery`. |

### Attendance

| Page | Purpose | Layout | Notable issues |
|---|---|---|---|
| `attendance` | Class roster | `max-w-2xl`, `grid gap-3` cards | Browser `confirm()` for delete (not modal). Empty state `rounded-2xl bg-primary/8`. |
| `attendance/[classId]` | Class detail | `max-w-2xl`, 3 tabs + triage banner | `TONE_CLASSES` map hardcodes amber/rose/orange/emerald 50–900. Priority logic invisible to user. Local `DAYS_IN_A_ROW`/`TOP_LABEL` tables. |
| `attendance/[classId]/marks` | Marks entry | `max-w-3xl`, table | `text-white`. 3 local i18n tables. Validation only on save. |

### Account, onboarding, org, notifications

| Page | Purpose | Layout | Header | Notable issues |
|---|---|---|---|---|
| `onboarding` | Profile wizard (1320 ln) | single col, accordion steps, `rounded-xl` containers | left, inline `GraduationCap` | Ad-hoc containers (not `Card`/`SectionCard`). ~1K lines of inline i18n tables. Auto-collapse-on-Next gives no "saved" feedback. |
| `settings` | Prefs/plan/privacy (875 ln) | `max-w-2xl`, `<Card>` sections | `card-accent-bar` + left title | Uses raw `<Card>` throughout, not `SectionCard`. Consent toggles lack confirmation toast. Local i18n tables. |
| `usage` | Quota display | `max-w-2xl`, Card grid | `Sparkles` in `rounded-2xl bg-primary/10` | `text-white` tier badge. Local `FEATURE_LABELS`. |
| `notifications` | Activity feed | `max-w-4xl` + `NotificationFeed` | `Bell` in `rounded-2xl bg-primary/10`, `border-primary/20` | Yet another header pattern (icon-in-`rounded-2xl`, not `rounded-full`). |
| `organization/dashboard` | Principal analytics | `max-w-5xl`, bespoke `ProofStat` grid | `text-[26px→32px]`, uppercase kicker, radial gradient | **Design island** (premium, marketing-adjacent). Inline `hsl(28 75% 96%)`, `border-black/[0.08]`. Not tokenized. |
| `my-profile` / `profile/[uid]` | Teacher profile | `md:grid-cols-12` main+sidebar | avatar in `rounded-md` card | Cards use `rounded-md` (disagrees). Cert badges hardcode `green-50/700`. Static activity timeline. |
| `impact-dashboard` | Personal impact | `max-w-6xl` + `TeacherAnalyticsDashboard` | plain `BarChart3` h1 | Analytics component uses **rainbow** hardcoded strokes (`green/yellow/red/blue/purple-500/600`) + raw `h-1.5 bg-primary` bar + `gray-200`. |

### Marketing, pricing, admin/dev

| Page | Purpose | Design register | Notable |
|---|---|---|---|
| `pricing` | Freemium table | **Premium editorial** — `text-[42px→54px]`, `md:divide-x` columns, saffron | `force-light`, `PRICING_STRINGS` table, 5× bespoke `shadow-[...]`, `rounded-[10/12/14px]`. The bar for the app — but a total island. |
| `about`, `for-schools`, `(marketing)/bn|kn|ta` | B2B narrative/landing | Premium editorial, shared with pricing | `LandingNav/Footer`, kicker 01–04 ramps, `border-l-4 border-saffron-200`. Many strings **hardcoded English** (i18n gap). |
| `admin/cost-dashboard`, `admin/log-dashboard` | Ops monitoring | Utilitarian shadcn | Gradient-text H1, `Badge` variants, local i18n. No warmth (fine for internal). |
| `api-playground`, `api-docs` | Dev tools | Boilerplate shadcn/Swagger | `api-playground` is partly a "coming soon" shell. |

---

## 2. Most common inconsistencies (repeated across pages)

1. **Radius anarchy.** Repo-wide in `app/`: `rounded-full` ×67, `rounded-xl` ×63, `rounded-lg` ×39, `rounded-2xl` ×30, `rounded-md` ×13, bespoke `rounded-[10/12/14/16px]` ×17 — vs the token `rounded-surface-*` used only **6 times total**. The scale exists and is ignored. Corners visibly disagree between adjacent pages (community `rounded-md` vs generators `rounded-2xl` vs pricing `rounded-[14px]`).
2. **No shared page shell for inputs.** Container width is decided per-page: `max-w-2xl` / `3xl` / `4xl` / `5xl` / `6xl` / `7xl` / `container-wide` all appear among the generators alone. `PageShell` exists and is used by **~0 pages**; `SectionCard` by **only 2** (`my-library`, `quiz-generator`) + `lesson-plan`. Meanwhile 17 pages import raw `<Card>`.
3. **Header treatment is a free-for-all.** At least five patterns: centered icon in `rounded-full bg-primary/10` (most generators), icon in `rounded-2xl bg-primary/10` (usage, notifications), icon in `bg-muted rounded-md` (community), left-aligned no-icon (exam-paper, attendance, settings), and bespoke kicker+`text-[Npx]` (org dashboard, marketing).
4. **Four accent-bar variants.** `card-accent-bar` (the intended token, used by ~10 generators — the *one* consistent thing), raw `h-1.5 w-full bg-primary` (dashboard, visual-aid-creator, teacher-analytics, voice-assistant), `absolute top-0 h-1.5` unaligned (dashboard), and `h-0.5 bg-primary/60` (my-library).
5. **Hardcoded colors in a warm-saffron app.** 25× `text-white` (should be `text-primary-foreground`); cold `#1e293b` + `slate-700` tooltip; 16 distinct raw hex; status/triage rainbows (`green/amber/rose/orange/emerald/yellow/blue/purple-500/600`) hardcoded rather than tokenized.
6. **Off-scale opacities.** `bg-primary/8` ×3, `/15`, `border-primary/30`, `border-primary/40`, `bg-accent/30` — none on the `/5 /10 /20` scale everyone else uses.
7. **i18n implemented ~10 different ways.** Central `t()` (community, messages, rubric), *plus* per-file local tables (`translations`, `PRICING_STRINGS`, `AUTHOR_NAME_TABLE`, `TONE_CLASSES`, `DAYS_IN_A_ROW`, `FEATURE_LABELS`, `ROLE_LABEL_I18N`, …), *plus* raw hardcoded English on marketing pages. Onboarding alone carries ~1K lines of inline tables.
8. **Empty/loading states inconsistent.** A shared `EmptyState` component exists (`components/layout/empty-state.tsx`) but most pages hand-roll icon-circle+text+CTA; the org dashboard has its *own* `empty-state.tsx`. Loading is usually a centered `Loader2` but some pages skeleton and some (rubric) drop the fade-in.
9. **"Coming soon" shells still shipping.** `submit-content`, `review-panel`, `visual-aid-creator` are placeholders; `exam-paper` and `api-playground` are partial. Two use a legacy `bg-white/30 backdrop-blur` glass card that appears nowhere else.
10. **Button variant skew.** `variant="outline"` ×26 dominates; `default` only ×2. Primary CTAs are frequently outline-styled, flattening hierarchy.

---

## 3. Consistency scorecard (reused vs one-off)

| Pattern | Status | Evidence |
|---|---|---|
| App shell (sidebar + header + main) | ✅ **Reused** | Single `app-shell.tsx`, every app route. |
| `ResultShell` for AI **output** | ✅ **Reused** | 12 display components route through it (quiz/rubric/worksheet/visual-aid/field-trip/instant-answer/assessment/training/lesson). The system's best win. |
| `card-accent-bar` on generators | 🟡 **Mostly** | ~10 generators use it; 4 other surfaces roll their own bar. |
| `AuthGate` for signed-out | 🟡 **Mostly** | 11 pages; but empty-state framing still varies. |
| `type-h*` heading tokens | ❌ **One-off** | `font-headline` used ×129 vs `type-h1/h2/h3` ×5 total, `type-display` ×0. |
| `rounded-surface-*` radius scale | ❌ **One-off** | 6 uses vs ~200 raw radius classes. |
| `PageShell` page wrapper | ❌ **Dead** | Built, documented, used by ~0 pages. |
| `SectionCard` input container | ❌ **Barely** | 2 pages + lesson-plan; 17 pages use raw `<Card>`. |
| Shared `EmptyState` | ❌ **Barely** | Bypassed by most; duplicated by org dashboard. |
| Page header treatment | ❌ **One-off** | 5+ distinct patterns. |
| i18n strategy | ❌ **Fragmented** | `t()` + N local tables + hardcoded English. |
| Marketing editorial system | ✅ **Reused within island** | `landing/pricing/about/for-schools` share it — but it never crosses into the product. |

**Net:** the *output* half of the app (ResultShell) is consistent; the *input/page-frame* half is not. The design system is ~30% adopted.

---

## 4. The 8 pages most in need of redesign (ranked)

1. **`/` dashboard-home** — highest traffic, worst first impression. Centered-hero + 9 identical accent-barred cards is the exact AI-slop pattern the board wants gone; hardcoded English leaks in an 11-language app; unaligned floating accent bar. Redesign sets the tone for everything.
2. **Generator tool family (quiz / worksheet / visual-aid / instant-answer / field-trip / training / exam-paper)** — treat as **one** redesign. They diverge on width, i18n, radius, and result chrome despite doing the same job. A single `GeneratorPage` shell (built on the existing `PageShell` + `SectionCard` + `ResultShell`) collapses ~7 bespoke layouts into one and removes the duplicate-control and off-scale-color bugs. Highest leverage per hour.
3. **`community`** — the "staff room," meant to feel human, currently a generic SaaS bar with the app's loudest radius/`text-white`/off-scale-opacity violations and unexplained triage color logic.
4. **`community-library`** — ships a **non-functional search** and mock content behind a glass card that matches nothing else. Either wire it or restyle to signal "preview."
5. **`settings`** (875 ln) — high-intent page built entirely on raw `<Card>` with no `SectionCard`; consent changes lack confirmation. Big surface, easy consistency win.
6. **`onboarding`** (1320 ln) — first authed experience; ad-hoc step containers, no "saved" feedback, ~1K lines of inline i18n. Structurally the heaviest cleanup.
7. **`impact-dashboard` / `teacher-analytics-dashboard`** — rainbow of hardcoded status colors + legacy raw accent bar + `gray-200` rings; reads as a different app.
8. **`visual-aid-creator` + `submit-content` + `review-panel` (+ `exam-paper` partial)** — the "coming soon"/placeholder cluster. Either finish, hide from nav, or give a single honest, on-brand empty state. `visual-aid-creator` vs `visual-aid-designer` is also a confusing duplicate route.

**What's already good (leave alone / harvest):** `pricing`, `landing-page`, `about`, `for-schools`, `organization/dashboard` — the premium editorial voice. The board's job is to **propagate** this into the product, and to make `ResultShell`-quality consistency the norm on the *input* side, by finally adopting the `PageShell`/`SectionCard`/token scale that already ships in the repo.
