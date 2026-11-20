# SahayakAI Design Reference Index

A one-page map for anyone redesigning a SahayakAI page. Baseline: **`develop` @ `92837486`** (2026-11-03). Paths are relative to `sahayakai-main/`.

- **See it:** [`SAHAYAKAI_UI_SHOWCASE.html`](./SAHAYAKAI_UI_SHOWCASE.html). Open it in a browser; it is self-contained apart from Google Fonts and screenshots.
- **Read it:** [`SAHAYAKAI_DESIGN_SYSTEM.md`](./SAHAYAKAI_DESIGN_SYSTEM.md)
- **Find it:** [`COMPONENT_INVENTORY.md`](./COMPONENT_INVENTORY.md)
- **Real screens:** [`screenshots/`](./screenshots/)

---

## 1. Where the design tokens are defined

| What | File | Lines / section |
|---|---|---|
| All CSS custom properties (light), with shadcn semantic and Oct-2026 families, surfaces, tints, gradients, orb, shadows and layout vars | `src/app/globals.css` | `:root` in `@layer base`, about lines 345–605 |
| Dark overrides (shadcn tokens only) | `src/app/globals.css` | `.dark`, about 607–680 |
| Light mirror for marketing pages | `src/app/globals.css` | `.force-light`, about 237–286 |
| SamparkAI palette and theme re-pointing | `src/app/globals.css` | "SamparkAI theme", about 961–1027 |
| VIDYA orb CSS (`.vidya-*`) | `src/app/globals.css` | about 63–191 |
| Type utilities (`type-h1…caption`, `type-eyebrow`), containers, focus ring, wash | `src/app/globals.css` | `@layer utilities` blocks |
| Tailwind names for every token: colours, radii, shadows, font sizes, durations, easings, widths | `tailwind.config.ts` | `theme.extend` |
| Font families (next/font) | `src/app/layout.tsx` | lines 30–98 (`--font-ui`, `--font-display`, `--font-noto-*`) |
| shadcn config | `components.json` | style default, `baseColor: neutral`, Lucide |
| Token rules and contrast notes (partly stale, see §6) | `docs/DESIGN_TOKENS.md` | |
| Token CI gate and budget | `scripts/ci/check-design-tokens.mjs`, `scripts/ci/design-tokens-budget.json` | |
| VIDYA orb behaviour notes | `docs/VIDYA_ORB.md` | |

## 2. Which components are authoritative

| Need | Use | Path |
|---|---|---|
| Page layout (app) | `AppShell` (automatic) | `src/app/app-shell.tsx` |
| Navigation | `ProductSideNav` via `AppSidebar` | `src/components/shell/side-nav.tsx`, `src/components/app-sidebar.tsx` |
| Wordmark | `SahayakWordmark` / `SamparkWordmark` | `src/components/shell/brand.tsx` |
| Generator tool page | `GeneratorPage` + `GeneratorSubmitBar` | `src/features/generator/components/generator-page.tsx` |
| AI output frame | `ResultShell` | `src/components/ui/result-shell.tsx` |
| Section container | `SectionCard` | `src/components/layout/section-card.tsx` |
| Generic page container | `PageShell` (intended standard; used only in Sampark so far) | `src/components/layout/page-shell.tsx` |
| Empty state | `EmptyState` | `src/components/layout/empty-state.tsx` |
| Status label | `StatusPill` | `src/components/sampark/status-pill.tsx` |
| Error / loading blocks | `ErrorPanel`, `LoadingBlock`, `InlineSpinner` | `src/components/sampark/states.tsx` |
| Skeletons | `Skeleton` and presets | `src/components/ui/skeleton.tsx` |
| Buttons, inputs, selects, dialogs, tabs, toasts | shadcn primitives | `src/components/ui/*` |
| VIDYA orb | `VidyaSphere` (WebGL, in the floating orb and dashboard) or `VidyaPresence` (CSS, landing). **Two renderers, decide before redesigning** | `src/components/vidya/` |

## 3. Main layout and navigation files

```
src/app/layout.tsx                      fonts, <html>/<body>, providers
src/app/app-shell.tsx                   chooses Sampark / landing / app layout; top bar, <main>
src/components/app-sidebar.tsx          SahayakAI nav model (sections, badges, VIDYA lead, SamparkAI card)
src/components/shell/side-nav.tsx       shared sidebar + rail renderer
src/components/shell/brand.tsx          wordmarks
src/components/shell/use-collapsed.ts   fold state
src/components/mobile-bottom-nav.tsx    phone TabBar capsule
src/components/command-palette.tsx      ⌘K
src/components/language-pill.tsx        language switch
src/components/sampark/workspace-frame.tsx   SamparkAI chrome
src/components/sampark/demo/demo-frame.tsx   Sampark demo chrome
src/app/sampark/layout.tsx              Sampark route layout
src/components/landing/landing-page.tsx marketing home
```

## 4. Pages that show the strongest existing design (I)

| Page | Why | Screenshot |
|---|---|---|
| **Worksheet Wizard** `/worksheet-wizard` (GeneratorPage) | The cleanest tool layout: accent-bar card, centred icon disc and title, dashed upload, prompt chips, 3-up selects, full-width saffron CTA, `EmptyState` result placeholder. **The template for Exam Paper and Quiz redesigns** | `03-worksheet-wizard.png` |
| **Lesson Plan** `/lesson-plan` | The richest form: two columns, Quick Ideas, Quick Start Templates grid, settings panel with eyebrow label | `02-lesson-plan.png` |
| **App shell / sidebar** | Fully on Oct-2026 tokens: pill nav items, eyebrows, milk active state, saffron dot, "Talk to VIDYA" lead, SamparkAI card | every app screenshot |
| **Landing** `/` | Brand at its most expressive: ambient glow, Indic marks, hero VIDYA orb, rotating headline | `01-landing-logged-out.png` |
| **Sampark public site** `/sampark` | Second-product marketing on the same type and tokens | `16-sampark-public-site.png` |
| **Signed-in dashboard** (`DashboardHome`) | Greeting, orb, composer pill, prep chips. Source only; not captured (needs sign-in) | none (reconstructed in showcase) |

## 5. Reuse rather than recreate

1. `GeneratorPage` / `GeneratorSubmitBar`, not hand-built tool cards.
2. `ResultShell`, not ad-hoc output headers and action rows.
3. `SectionCard` and `EmptyState`, not new card or empty patterns.
4. `StatusPill`, not coloured `Badge` for status.
5. `ErrorPanel` / `LoadingBlock` / `Skeleton`, not bespoke spinners.
6. `ProductSideNav`, not `ui/sidebar.tsx` (shadcn's kit is effectively unused).
7. `.focus-ring` for focus on new custom controls.
8. Selectors (`GradeLevelSelector`, `SubjectSelector`, `LanguageSelector`, `NCERTChapterSelector`) for curriculum pickers.
9. Tokens only: `milk-*`, `ink-*`, `saffron-*`, `leaf-*`, `indigo-*`, `tint-*`, `line-*`, `surface-*`. **No raw palette classes, no hex** (Gate 11).

## 6. Inconsistencies and duplicated styling

Recorded as found, **not** fixed. Evidence marks: **V** verified in source or app, **C** computed, **I** inferred.

### 6.1 Token values vs their documentation
1. **`--primary` is #A5551D, not #C96A28.** **V/C**
   - `globals.css` `:root` sets `--primary: 24.7 70.1% 38%` (= `--saffron-600`, #A5551D).
   - The comment beside it says "≈#C96A28".
   - `docs/DESIGN_TOKENS.md §1` documents `hsl(24 65% 47%)` and its whole contrast table is computed for that older value.
   - The brand saffron #C96A28 is now `--saffron-500` (and `--chart-1`, `--sampark-saffron`).
2. **Stale hex comments in `:root`.** **V/C**

   | Token | Comment says | Actual |
   |---|---|---|
   | `--foreground` | `#1F2937` | #171310 |
   | `--muted` | `#F9FAFB` | #F6F1E9 |
   | `--muted-foreground` | `#6B7280` | #5C534A |
   | `--destructive` | `#EF4444` | #C0392B |
   | `--success` | `#15803D` | #2C5F2D |
   | `--info` | `#2563EB` | #2A3B8F |
   | `--accent` | `#000080` | #2A3B8F |

   `--sidebar-accent-foreground` is described as "Saffron text", but it is ink.
3. **Font variable names.** **V**
   - `DESIGN_TOKENS.md §6` names `--font-instrument` / `--font-bricolage` and says "Inter / Outfit remain as fallbacks".
   - The code defines `--font-ui` / `--font-display` and loads no Inter or Outfit.
   - `tailwind.config.ts` comments still mention Inter/Outfit.
4. **Broken font reference.** `.vidya-wordmark` (`globals.css`) uses `var(--font-bricolage), var(--font-outfit), system-ui`. Neither variable is defined, so the VIDYA wordmark renders in **system-ui**, not Bricolage. Used by `vidya-presence.tsx`. **V**
5. **`DESIGN_TOKENS.md §8` contracts vs primitives.** **V**

   | Item | Contract | Code |
   |---|---|---|
   | Modal backdrop | `bg-foreground/40 backdrop-blur-sm` | `ui/dialog.tsx` uses `bg-black/80` |
   | Modal shadow | `shadow-floating` | `shadow-lg` |
   | Button radius | `rounded-surface-md` (12px) | `rounded-md` (10px) |
   | Spacing | bans `p-5`, `space-y-1.5` | `.card-section` uses `md:p-5`; `CardHeader` / `DialogHeader` use `space-y-1.5` |
   | Radius | bans `rounded-2xl` | 51 uses |
   | Shadow | bans `shadow-lg/xl/2xl` | 41 uses |

6. **Shadow class vs variable.** **V** `--shadow-soft` / `--shadow-elevated` CSS variables (navy-tinted) exist, but `shadow-soft` / `shadow-elevated` classes use different literal values from `tailwind.config.ts`. `shadow-floating` is cool navy (`hsl(222 47% 11%)`), while the Oct-2026 shadows are warm ink (`rgba(23,19,16,…)`).

### 6.2 Parallel systems that coexist
7. **Two "single" easing curves.** `ease-out-quart` `cubic-bezier(.16,1,.3,1)` (Phase 1, 19 uses) and `ease-standard` `cubic-bezier(.4,0,.2,1)` (Oct 2026, 29 uses). Both are documented as *the* one curve. **V**
8. **Four radius vocabularies** (shadcn `sm/md/lg`, Tailwind `xl/2xl`, `surface-*`/`pill`, Oct-2026 `xs…band`). `rounded-xl` (164) and `rounded-lg` (131) are both 12px. **V**
9. **Three type scales.** Phase-1 `type-*` (18 uses of `type-h*`), Oct-2026 named sizes (15), and raw `font-headline text-*` (220). Plus **261 arbitrary `text-[Npx]`** sizes. **V**
10. **Two focus treatments.** `.focus-ring` (2px saffron-600 **outline**, 80 uses) vs shadcn `ring-2 ring-ring ring-offset-2` (**box-shadow**). `Textarea` uses `ring-1` with no offset, unlike `Input`. **V**
11. **`--accent` is indigo but is shadcn's hover surface.** **V (token resolution)**
    - `outline` and `ghost` Buttons, Select and Dropdown items, and `BackButton` all hover or focus to **#2A3B8F with white text**.
    - Shell controls avoid this with `hover:bg-tint-subtle`.
    - Result: two hover languages (quiet ink tint vs strong indigo).
12. **Three "active" metaphors.**
    - Nav: milk-400 pill, saffron icon, saffron dot.
    - Tabs: solid saffron pill, white text.
    - TabBar: saffron-500 disc.
    - Command palette selection: `primary/10`. **V**
13. **Two green "secondary" meanings.** `Badge variant="secondary"` and `Button variant="secondary"` are **leaf-green fills**, because `--secondary` = leaf. ResultShell meta badges are green by default. **V**
14. **Near-duplicate colour tokens.** **C**

    | Sampark token | Hex | Core token | Hex |
    |---|---|---|---|
    | `--sampark-indigo` | #293A8E | `--indigo-500` | #2A3B8F |
    | `--sampark-leaf` | #2B5E2C | `--leaf-500` | #2C5F2D |
    | `--sampark-saffron` | | `--saffron-500` / `--chart-1` | (same value) |

    Also, `--secondary`, `--success` and `--leaf-500` are one colour, and so are `--accent`, `--info` and `--indigo-500`.
15. **Partial dark mode.** **V**
    - Only shadcn tokens have `.dark` values. Milk, ink, surface, tint and wash tokens stay light, so the shell chrome is not dark-aware.
    - `.force-light` does not mirror `--success/--warning/--info`, so those keep dark values on marketing pages under `.dark`.
16. **SamparkAI looks like a different product.** `.theme-sampark` re-points shared tokens to cool slate on white (#0F1729 text, #EAECF0 lines, opaque white surfaces). SahayakAI is warm ink on milk with glass. Compare `17-sampark-workspace.png` with `02-lesson-plan.png`. **V** (The uncommitted riya-wt work reverses this.)

### 6.3 Duplicated or competing components
17. **Exam Paper exists twice.** **V**
    - Live: `src/app/exam-paper/components/*` (16 files).
    - Unused: `src/features/exam-paper/components/{exam-paper-form,exam-paper-preview,exam-paper-view}.tsx`, a GeneratorPage version with no importers outside its own folder.
18. **Four page-header patterns.** **V**

    | Pattern | Alignment and style |
    |---|---|
    | GeneratorPage | centred, icon disc |
    | `PageShell` | left, `type-h1`, Sampark only |
    | Sampark `PageHeader` | left, eyebrow, `font-display` |
    | Lesson Plan's own card header | centred, no icon |

    Plus dashboard and ResultShell titles. Title sizes vary between 24/30px, 30/36px and 48px.
19. **Two VIDYA orb renderers with conflicting state colours.** **V**
    - `VidyaPresence` (CSS): speaking is **saffron**; error has a **red ring**.
    - `VidyaSphere` (WebGL): speaking is **leaf**; error is desaturated and "never red".
    - The floating orb and dashboard use VidyaSphere; the landing hero uses VidyaPresence.
20. **Two KPI tiles** (`console-ui.tsx` `KpiCard` vs `kpi-tile.tsx` `KpiTile`), **two progress bars** (`ui/progress` h-4 vs console `ProgressBar` h-2), **three badges** (`ui/badge`, `StatusPill`, side-nav `Badge`), **two Sampark frames** (`WorkspaceFrame` vs `DemoFrame`). **V**
21. **Unused or orphaned components.** **V**
    - Unused shadcn pieces: `ui/sidebar.tsx` (770 lines, 1 partial importer), `ui/{calendar,chart,collapsible,menubar,scroll-area}.tsx` (0 importers each).
    - Orphaned components: `omni-orb-live.tsx`, `voice-assistant.tsx`, `sahayak-avatar.tsx`, `logo.tsx` (0 importers each).
    - Unused CSS class: `.page-container` (0 uses).
22. **The intended page standard is barely adopted.** `PageShell` (the documented "canonical page container") is used only by two Sampark files. `container-*` classes appear 12 times; `max-w-[…]` appears 68 times. **V**

### 6.4 Debt and visible issues
23. **Token gate fails on `develop`.** `node scripts/ci/check-design-tokens.mjs` reports **760 banned hits across 108 files > `maxHits` 744** (run 2026-11-03 on the clean checkout). Raw palette classes: 496 `(bg|text|border)-<palette>-N`, 89 `orange-*`, 24 six-digit hex in `.tsx`. Examples:
    - `quick-templates.ts` subject colours;
    - `GeneratorPage` `text-amber-600`;
    - `AuthButton` `bg-slate-200`;
    - `EmptyState` `text-[10px]`. **V**
24. **Command palette:** the dialog's close ✕ (`ui/dialog.tsx`, `absolute right-4 top-4`) overlaps the "ESC" kbd hint in the search row (`14-command-palette-modal.png`). **V (screenshot)**
25. **Naming:** the nav says "Teacher Training"; the page says "Sign in to ask the AI Coach" (`11-teacher-training-vidya.png`). **V**
26. **Signed-out tool pages differ.** **V (screenshots)**
    - Lesson Plan, Worksheet, Quiz, Rubric and Instant Answer render their full forms.
    - Exam Paper shows a bare icon line ("Please log in to generate exam papers.") with **no sign-in button**.
    - Library and Teacher Training show a proper sign-in card with a CTA.
27. **Tokens with no emitted CSS.** `rounded-panel`, `rounded-sheet`, `shadow-glow` and `shadow-inner-soft` are defined in `tailwind.config.ts` but never used as plain classes, so the compiled stylesheet has no rule for them. `shadow-current` and `shadow-sampark-raised` exist only as `focus-within:` / `hover:` variants. Found by checking the showcase's classes against the compiled CSS. **V**
28. **Quiz settings panel** renders an empty bordered strip above Subject/Class/Language (`04-quiz-generator.png`). **V (screenshot)**
29. **Hand-built tables.** `ui/table` has one importer. Rosters, call logs and attendance lists are custom grids, so row height, borders and hover differ by page. **I**
