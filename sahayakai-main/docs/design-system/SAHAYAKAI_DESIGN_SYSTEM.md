# SahayakAI Design System: as built

**What this is.** A description of the SahayakAI visual system **as it exists in code today**. It is not a proposal. Every value below was read from source at **`develop` @ `92837486`** ("feat(teacher-training): back in the main sidebar, with VIDYA on the page"), which matched `origin/develop` on 2026-11-03.

**What this is not.** It does not include the uncommitted redesign work in `E:\sargvision\riya-wt\sahayakai-main`'s working tree, which touches 52 files including `globals.css`, `app-sidebar.tsx`, `generator-page.tsx`, the Exam Paper, Quiz, Worksheet and Rubric views, and Sampark's theme. §11 lists what that work would change.

**Evidence levels used throughout**

| Mark | Meaning |
|---|---|
| **V** | Verified: copied from source (file and line given) or measured in the running app |
| **C** | Computed: hex derived mechanically from the HSL triplet in source (exact HSL to sRGB, rounded) |
| **I** | Inferred: a reading of intent, usage or behaviour, not a literal value |

Companion files: [`COMPONENT_INVENTORY.md`](./COMPONENT_INVENTORY.md) · [`DESIGN_REFERENCE_INDEX.md`](./DESIGN_REFERENCE_INDEX.md) · [`SAHAYAKAI_UI_SHOWCASE.html`](./SAHAYAKAI_UI_SHOWCASE.html) · [`screenshots/`](./screenshots/)

---

## 1. Brand and visual identity

### 1.1 Overall direction (I, backed by V comments)
SahayakAI reads as **warm, calm and paper-like**:
- an ivory/milk ground with a soft peach-to-sage wash and one saffron glow in the top-right corner (`.bg-wash-screen`);
- near-black warm "ink" text;
- **saffron** as the one action colour;
- **leaf green** and **indigo** reserved for meaning (done/success and working/info);
- large, friendly Bricolage Grotesque titles over Instrument Sans UI text.

The source names this as the "Oct 2026 design system", taken from the founder-approved document *"SahayakAI is a voice-first teaching…"* (`src/app/globals.css:491-499`). Its rules, as stated in comments:
- shadows are "warm, low, rare" (`globals.css:589`);
- one easing curve, "gentle and never bouncy" (`tailwind.config.ts`);
- focus is "a 2px saffron-600 outline offset 2px, never a shadow" (`globals.css:916`);
- colour comes "from meaning, not decoration" (Sampark section, `globals.css:961`).

### 1.2 Brand personality (I)
A helpful, Indian, voice-first teaching companion. The site has:
- **VIDYA**, a warm saffron orb that *is* the voice control;
- Indic script marks floating in the landing background (`.mark-float-*`);
- every UI string localised into 11 languages;
- copy that addresses teachers directly ("Namaste…" greeting on the dashboard).

### 1.3 Two products, one family (V)
| Product | Where | Mark | Theme scope |
|---|---|---|---|
| **SahayakAI** (teacher app) | every route except `/sampark/**` | `SahayakWordmark` = saffron resting orb plus "SahayakAI" in Bricolage 600 (`src/components/shell/brand.tsx`) | `:root` tokens |
| **SamparkAI** (school-to-parent calls) | `/sampark/**` (and `sampark.*` hosts via middleware) | `SamparkMark` = two linked rings in leaf on a leaf tint (`brand.tsx`) | `.theme-sampark` re-points shared tokens to a cooler slate/white console look (`globals.css:992-1027`) |

On the landing page the logo shows as "SahayakAI" with the byline "BY SARGVISION INTELLIGENCE" (see `screenshots/01-landing-logged-out.png`).

---

## 2. Colour system

All app colours are CSS custom properties in `src/app/globals.css`. They are mapped to Tailwind names in `tailwind.config.ts` (`theme.extend.colors`). Family tokens are HSL triplets used as `hsl(var(--x))`. Surfaces, borders and tints are complete `rgba()` values.

### 2.1 Semantic (shadcn) tokens: light `:root` (V values, C hex)
| Token | HSL in source | Hex (C) | Tailwind | Notes |
|---|---|---|---|---|
| `--primary` | `24.7 70.1% 38%` | **#A5551D** | `bg-primary` `text-primary` | = `--saffron-600`. The inline comment still says "≈#C96A28", which is **stale** (see §12) |
| `--primary-foreground` | `0 0% 100%` | #FFFFFF | | |
| `--secondary` | `121.2 36.7% 27.3%` | #2C5F2D | `bg-secondary` | = leaf-500 = success |
| `--accent` | `229.9 54.6% 36.3%` | #2A3B8F | `bg-accent` | = indigo-500 = info. **shadcn uses `accent` as the hover surface** (ghost/outline buttons, menu items). See §12 |
| `--background` | `37.5 50% 96.9%` | #FBF8F3 | `bg-background` | = milk-200, the page ground |
| `--foreground` | `25.7 17.9% 7.6%` | #171310 | `text-foreground` | = ink-900 |
| `--card` / `--popover` | `40 100% 98.8%` | #FFFDF9 | `bg-card` | = milk-50 |
| `--muted` | `36.9 41.9% 93.9%` | #F6F1E9 | `bg-muted` | = milk-400 |
| `--muted-foreground` | `30 10.8% 32.5%` | #5C534A | `text-muted-foreground` | = ink-600 |
| `--border` | `37.5 12.9% 87.8%` | #E4E1DC | `border-border` (applied to `*` in `@layer base`) | |
| `--input` | `37.5 10% 84.3%` | #DBD8D3 | `border-input` | |
| `--ring` | `24.7 70.1% 38%` | #A5551D | `ring-ring` | |
| `--destructive` | `5.6 63.4% 46.1%` | #C0392B | `bg-destructive` | = red-500 |
| `--success` | `121.2 36.7% 27.3%` | #2C5F2D | `text-success` | |
| `--warning` | `26 90.5% 37.1%` | #B45309 | `text-warning` | = amber-500 |
| `--info` | `229.9 54.6% 36.3%` | #2A3B8F | `text-info` | |
| `--radius` | `0.75rem` | n/a | `rounded-lg` | 12px |

### 2.2 Brand families (Oct 2026 design-system tokens)
**Saffron, the action colour.** Defined in two places: `globals.css:371-377` (landing scale) and `:500-501`.
| Token | Hex (C) | Tailwind | Use per source comments |
|---|---|---|---|
| `--saffron-50` | #FFF4EB | `saffron-50` | decorative tint only |
| `--saffron-100` | #FFE3C2 | `saffron-100` | decorative |
| `--saffron-200` | #FFD9AE | `saffron-200` | decorative; the orb highlight |
| `--saffron-300` | #E0A878 | `saffron-300` | decorative |
| `--saffron-400` | #E08A3C | `saffron-400` | orb mid-stop |
| `--saffron-500` | **#C96A28** | `saffron` / `saffron-500` | the brand saffron: orb body, TabBar active disc, active-nav dot, composer send disc |
| `--saffron-600` | **#A5551D** | `saffron-600` | = `--primary`: filled buttons, active nav icons, focus outline |
| `--saffron-700` | #8A4A08 | `saffron-700` | VIDYA focus-visible outline |
| `--saffron-800` | #7E3F16 | `saffron-800` | dark end of the CTA band |

**Milk (surfaces).** `milk-50` #FFFDF9 · `milk-100` #FFF8F0 · `milk-200` #FBF8F3 (page) · `milk-300` #FBF6EE · `milk-400` #F6F1E9 (active nav item fill) · `milk-500` #F4F2ED

**Ink (text).** `ink-400` #8A7F73 · `ink-500` #6E655C (secondary text, inactive icons) · `ink-600` #5C534A (nav labels) · `ink-800` #1B1713 · `ink-900` #171310 (titles)

**Stone.** `stone-100` #E6E1DA · `stone-500` #8A8178

**Leaf (done / success / "connected").** `leaf-100` #CFE6CF · `leaf-300` #7FBF7F · `leaf-500` #2C5F2D · `leaf-700` #234B24

**Indigo (working / info).** `indigo-100` #DCE2FA · `indigo-500` #2A3B8F

**Status extras (no Tailwind mapping).** `--red-500` #C0392B · `--red-700` #8A1C1C · `--amber-500` #B45309

### 2.3 Surfaces, lines and tints (V, `globals.css:525-553`)
| Token | Value | Tailwind |
|---|---|---|
| `--surface-glass` | `rgba(255,255,255,.82)` | `bg-surface-glass` (top-bar search field) |
| `--surface-glass-soft` | `rgba(255,255,255,.7)` | `bg-surface-glass-soft` |
| `--surface-glass-strong` | `rgba(255,255,255,.88)` | `bg-surface-glass-strong` |
| `--surface-chrome` | `rgba(255,253,249,.9)` | `bg-surface-chrome` (top bar, sidebar) |
| `--surface-capsule` | `rgba(255,253,249,.92)` | `bg-surface-capsule` (phone TabBar) |
| `--surface-float` | `rgba(255,253,249,.96)` | `bg-surface-float` |
| `--surface-segment` | `rgba(255,255,255,.62)` | `bg-surface-segment` |
| `--surface-disc` | `rgba(255,255,255,.8)` | `bg-surface-disc` (dashboard composer) |
| `--border-glass` | `rgba(255,255,255,.95)` | `border-line-glass` |
| `--border-hairline` | `rgba(23,19,16,.08)` | `border-line-hairline` (shell dividers) |
| `--border-row` | `rgba(23,19,16,.10)` | `border-line-row` |
| `--border-control` | `rgba(23,19,16,.14)` | `border-line-control` |
| `--fill-quiet` / `-subtle` / `-mark` | ink at .06 / .04 / .07 | `bg-tint-quiet` / `tint-subtle` (nav hover) / `tint-mark` |
| `--accent-tint` (+ `-strong` .12, `-border` .22, `-soft` .08) | `rgba(201,106,40,.10)` | `bg-tint-accent*` |
| `--success-tint` / `--leaf-tint-border` | leaf at .12 / .24 | `bg-tint-success` / `border-tint-success-border` |
| `--info-tint` / `--info-tint-border` | indigo at .08 / .18 | `bg-tint-info` |
| `--red-tint` / `--amber-tint` | .12 | `bg-tint-danger` / `bg-tint-warning` |
| `--web-nav-glass`, `--web-hairline`, `--web-glass`, `--web-device-edge` | marketing-only values | none (CSS only) |

### 2.4 Gradients (V, `globals.css:555-587`)
| Token | Value |
|---|---|
| `--wash-screen` | `linear-gradient(168deg, #fff3e4 0%, #fdefee 36%, #eff4ee 72%, #fff7ec 100%)` |
| `--glow-saffron` | `radial-gradient(circle at 38% 32%, rgba(255,214,170,.78), rgba(201,106,40,0) 76%)` |
| `--glow-web-saffron` / `--glow-web-indigo` | marketing radial glows |
| `--orb-resting` | `radial-gradient(circle at 34% 30%, #ffd9ae, #c96a28 72%)` (wordmark orb) |
| `--orb-live` / `-working` / `-speaking` | five-stop VIDYA live-orb gradients (saffron / indigo / leaf) |
| `--vidya-live-0..4`, `--vidya-working-0..4`, `--vidya-speaking-0..4` | the stops above as single colours, read by the WebGL sphere |
| `--band-cta` | `linear-gradient(140deg, #c96a28 0%, #a5551d 52%, #7e3f16 100%)` |
| `.ambient-glow` | radial saffron to ivory, landing background, `ambient-breathe` 9s |
| `.card-accent-bar` | `bg-gradient-to-r from-primary to-primary/40`, a 4px top bar on tool cards |

**App ground** = `.bg-wash-screen` (`globals.css:924-931`): `milk-200` base, the saffron glow at `right -160px top -200px` (640×640), and the wash fixed under it. Applied once, on the app-shell root (`src/app/app-shell.tsx`).

### 2.5 Charts (V)
`--chart-1` #C96A28 saffron · `--chart-2` #2C5F2D green · `--chart-3` #2A3B8F navy · `--chart-4` #FBBD23 gold · `--chart-5` #E92063 rose.

### 2.6 SamparkAI palette (V `globals.css:971-990`, C hex)
| Token | Hex | Meaning (source comment) |
|---|---|---|
| `--sampark-saffron` / `-strong` | #C96A28 / #A5551D | live, active |
| `--sampark-peach` / `-peach-border` | #FEF4EC / #F5DAC2 | "live / needs a person" |
| `--sampark-indigo` / `-soft` / `-border` | #293A8E / #F1F3FE / #D4DBF7 | notices, scheduled |
| `--sampark-leaf` / `-soft` / `-border` | #2B5E2C / #EDF7EE / #CAE2CB | done, reached |
| `--sampark-rose` / `-soft` / `-border` | #B6251B / #FEF2F1 / #F9D0CD | complaints |
| `--sampark-slate` / `-slate-soft` | #0F1729 / #F8FAFC | text, inner tiles |
| `--sampark-line` | #EAECF0 | hairlines |

Inside `html:not(.dark) .theme-sampark` the **shared** tokens are re-pointed: background #FEFEFD, card #FFFFFF, foreground #0F1729, muted-foreground #65758B, border #EAECF0, ink-400…900 become the slate scale (#94A3B8 … #0F1729), milk-400 becomes peach #FDF2E7, and every glass surface becomes opaque white. Sampark therefore renders **cool slate on white**, not warm ink on milk. Compare `screenshots/17-sampark-workspace.png` with `02-lesson-plan.png`.

### 2.7 Dark mode (V `globals.css:607-680`)
`darkMode: ['class']`, toggled by next-themes on `<html>`. Only the **shadcn** tokens get dark values: background #13151B, card #1C1F26, primary #EB9447 with **navy** foreground #0F1729, border #31353F, and so on. The Oct-2026 families (milk, ink, saffron, surfaces, tints, wash) are **not** redefined for dark. Shell chrome built on them (sidebar, top bar, TabBar) stays light-valued in dark mode (I; not screenshotted). `.force-light` re-declares the light shadcn values for marketing pages. Sampark is light-only by design.

### 2.8 Contrast (V, from `docs/DESIGN_TOKENS.md`, *not re-measured here*)
`DESIGN_TOKENS.md` lists ratios for `--primary = hsl(24 65% 47%)` (#C96A28): 3.88:1 on white, large text and UI only. The **current** `--primary` is #A5551D. The globals comment at `:495` gives "white text 5.28:1" for saffron-600. The table in `DESIGN_TOKENS.md` therefore describes an older primary (§12).

---

## 3. Typography

### 3.1 Families (V `src/app/layout.tsx:30-98`, `tailwind.config.ts`)
| Role | Family | CSS var | Tailwind | Loading |
|---|---|---|---|---|
| UI / body | **Instrument Sans** | `--font-ui` | `font-body` (on `<body>`) | `next/font/google`, latin, variable, `display: swap` |
| Display / headings | **Bricolage Grotesque** | `--font-display` | `font-headline`, `font-display` (aliases) | latin, axis `opsz` (optical size follows font size) |
| Indic fallbacks | Noto Sans Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Oriya | `--font-noto-*` | appended to every stack | weights 400/500/600/700 |
| Code | `monospace` | none | `font-code` | system |

Per-language defaults: `:lang(hi|mr|bn|ta|te|kn|ml|gu|pa|or)` sets `font-family: var(--font-ui), var(--font-noto-<script>)` and `line-height: 1.7` (`globals.css:722-757`). `<html lang>` is synced by LanguageContext.

### 3.2 Weights in use (V by grep, I for intent)
400 body · 500 `font-medium` (labels, buttons, secondary nav) · 600 `font-semibold` (primary nav, titles, wordmark, eyebrows) · 700 `font-bold` (`type-h1`, dashboard greeting, Google sign-in label).

### 3.3 Three type scales coexist (V)
**A. Oct 2026 named sizes** (`tailwind.config.ts` `fontSize`). "App sizes never go under 12px."
| Class | Size / line-height | Seen on |
|---|---|---|
| `text-brand` | 17px / 1 | wordmark |
| `text-tile` | 13px / 1.3 | secondary nav items, search placeholder |
| `text-value` | 14px / 1.3 | primary nav items (Bricolage 600) |
| `text-card-title` | 15px / 1.3 | |
| `text-output-title` | 20px / 1.22 | |
| `text-page-title` | 22px / 1.2 | |
| `text-metric` | 26px / 1.05 | |
| `text-web-body` / `-lead` / `-h3` | 14/1.6 · 18/1.62 · 21/1.2 | marketing |
| `text-web-h2` / `-h1` | `clamp(30px,4vw,44px)`/1.06 · `clamp(40px,6vw,68px)`/1.02 | marketing |
| `.type-eyebrow` | 12px / 1.22, 600, `0.16em`, uppercase | nav section labels "MAKE", "CLASS" |
| `.type-web-eyebrow` | 12px / 1.6, 600, `0.18em`, uppercase | marketing |

**B. Phase-1 utilities (2026-04)** (`globals.css:203-208`)
| Class | Recipe |
|---|---|
| `type-h1` | `font-headline font-bold text-3xl leading-[1.15]` (30px) |
| `type-h2` | `font-headline font-semibold text-2xl leading-[1.2]` (24px) |
| `type-h3` | `font-headline font-semibold text-lg leading-[1.3]` (18px) |
| `type-body-lg` | `text-base leading-[1.6] font-medium` |
| `type-body` | `text-sm leading-[1.6] font-normal` |
| `type-caption` | `text-xs leading-[1.4] font-medium uppercase tracking-wide` |

**C. Raw Tailwind sizes with `font-headline`.** This is still the most common pattern. Examples:
- `GeneratorPage` title: `font-headline text-2xl sm:text-3xl`;
- `ResultShell` title: `text-xl sm:text-2xl md:text-3xl`;
- dashboard greeting: `text-3xl md:text-5xl font-bold`;
- Sampark `PageHeader`: `font-display text-2xl md:text-3xl font-semibold`;
- `CardTitle`: `font-headline text-xl font-semibold leading-snug`.

Usage counts across `src/**/*.tsx`: `font-headline` 220 · `font-display` 47 · `type-h1..3` 18 · named sizes (`text-page-title|card-title|output-title`) 15 · arbitrary `text-[Npx]` **261**.

### 3.4 Line-height and Indic rules (V)
- `body` 1.5, `p` 1.6 (`globals.css:700-707`).
- `.indic-text`: 1.7 with headings 1.45 and `overflow-wrap:anywhere`.
- `.demo-safe-wrap`.
- Eyebrows are never uppercased or letter-spaced in Indic languages (`globals.css:952-956`).

---

## 4. Design tokens: non-colour

### 4.1 Spacing (V)
Tailwind default 4px scale. There is no custom spacing scale. `DESIGN_TOKENS.md §4` names the recipes: card `p-4 md:p-6`, internal `space-y-3`, form rows `space-y-4`, sections `space-y-8`. It also bans `p-5`, `gap-2.5` and `space-y-1.5`, but these appear in shipped primitives (e.g. `CardHeader space-y-1.5`, `.card-section md:p-5`).

### 4.2 Radii (V). Four systems on one config
| System | Class → value | Source |
|---|---|---|
| shadcn (overridden) | `rounded-lg` 12px (= `--radius`) · `rounded-md` 10px · `rounded-sm` 8px | `tailwind.config.ts` |
| Tailwind defaults still used | `rounded-xl` 12px · `rounded-2xl` 16px · `rounded-full` | Tailwind |
| Phase-1 surface radii | `rounded-surface-sm` 6px · `-md` 12px · `-lg` 20px · `rounded-pill` 9999px | `--radius-*` vars |
| Oct 2026 container radii | `rounded-xs` 6 · `mark` 8 · `row` 12 · `field` 14 · `tile` 16 · `card` 18 · `panel` 20 · `web-metric` 24 · `sheet` 26 · `band` 36 | `tailwind.config.ts` |

Counts: `rounded-xl` 164 · `rounded-surface-*` 143 · `rounded-lg` 131 · `rounded-pill` 91 · `rounded-2xl` 51 · Oct container radii 46.

### 4.3 Shadows (V)
| Class | Value |
|---|---|
| `shadow-soft` | `0 1px 2px 0 rgb(0 0 0/.04), 0 1px 3px 0 rgb(0 0 0/.03)` (Card default) |
| `shadow-elevated` | `0 4px 12px -2px rgb(0 0 0/.08), 0 2px 4px -2px rgb(0 0 0/.04)` |
| `shadow-glow` | `0 0 0 3px hsl(24 65% 47%/.12), 0 4px 12px -2px rgb(0 0 0/.08)` |
| `shadow-inner-soft` | `inset 0 1px 2px 0 rgb(0 0 0/.04)` |
| `shadow-floating` | `var(--shadow-floating)` = `0 16px 40px hsl(222 47% 11%/.12)` (cool navy tint) |
| `shadow-float` | `0 10px 30px -12px rgba(23,19,16,.18), 0 2px 6px rgba(23,19,16,.05)` (TabBar, composer) |
| `shadow-card` | `0 12px 32px -18px rgba(23,19,16,.22), 0 1px 2px rgba(23,19,16,.04)` |
| `shadow-cta` | `0 10px 24px -10px rgba(165,85,29,.55)` |
| `shadow-orb` | `0 4px 12px -2px rgba(201,106,40,.45)` (wordmark orb) |
| `shadow-current` | `0 8px 22px rgba(201,106,40,.18)` (focused composer) |
| `shadow-mic` | `0 5px 14px rgba(201,106,40,.36)` (send disc) |
| `shadow-sampark-card` / `-raised` | `0 1px 2px rgba(16,24,40,.04)` / `+ 0 8px 24px -16px rgba(16,24,40,.18)` |

Note: the CSS vars `--shadow-soft` and `--shadow-elevated` (`globals.css:453-454`) exist but **are not** what `shadow-soft` / `shadow-elevated` resolve to. Tailwind defines those classes with literal values. Stock `shadow-sm|md|lg` are still used by shadcn primitives (Select, Dialog, Sheet, Toast).

### 4.4 Borders (V)
`* { @apply border-border }`: every border defaults to #E4E1DC. Shell dividers use `border-line-hairline` (8% ink). Inputs use `border-input` #DBD8D3. Width is 1px everywhere, except:
- `border-l-4 border-l-primary/70` on the GeneratorPage info callout;
- `.result-accent` `border-l-[3px]`;
- Sampark tone panels.

### 4.5 Breakpoints (V)
There is no `screens` override, so Tailwind defaults apply: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536. Shell thresholds (`globals.css:903-913`, `app-shell.tsx`):
- **<768**: phone. h-14 top bar (menu, wordmark, search, language, auth), floating TabBar capsule, full sidebar in a left Sheet.
- **768–1023**: icon **rail** 76px (`--sidebar-w-rail`) and a 64px top bar (`--topbar-h`).
- **≥1024**: full **sidebar** 256px (`--sidebar-w`), foldable to the rail. The fold state is stored under the key `sahayak.sidebar.folded`.

### 4.6 Motion (V)
| Token | Value |
|---|---|
| `ease-out-quart` / `--ease-out-quart` | `cubic-bezier(0.16, 1, 0.3, 1)` (Phase-1 "single canonical curve") |
| `ease-standard` / `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` (Oct 2026 "one curve"). **Two "single" curves coexist** |
| `duration-micro` / `small` / `medium` / `sheet` | 150 / 250 / 350 / 400 ms |
| `--motion-micro|small|medium` | 150 / 250 / 350 ms |
| `animate-fade-in-up` | translateY(20px) to 0, 0.5s ease-out (ResultShell entrance) |
| `animate-accordion-down|up` | 0.2s ease-out |
| `tailwindcss-animate` | radix `animate-in/out`, `fade-*`, `zoom-*`, `slide-in-from-*` on Dialog, Select, Popover, Tooltip, Sheet |
| VIDYA | `vidya-rest` 5s float, `vidya-breath` 1.8s ring, `vidya-dot` 1.4s; ring scales with live `--vidya-level` |
| Ambient | `ambient-breathe` 9s, `mark-float-a/b/c` 11/13/15s |
| Sidebar width | `transition-[width] duration-sheet ease-standard` |

All decorative motion is gated by `prefers-reduced-motion: no-preference`. Shell components add `motion-reduce:transition-none`.

### 4.7 Layout tokens (V)
`--sidebar-w` 256px · `--sidebar-w-rail` 76px · `--topbar-h` 64px · `max-w-web` 1220px · containers `container-narrow` (max-w-2xl 672px, `px-4 md:px-6`), `container-default` (max-w-5xl 1024px, `px-4 md:px-8`), `container-wide` (max-w-7xl 1280px, `px-4 md:px-10`). The legacy `.page-container` (max-w-4xl) has 0 uses.

---

## 5. Component library (summary)

Full table with paths and usage counts: [`COMPONENT_INVENTORY.md`](./COMPONENT_INVENTORY.md). Exact variants as coded:

### 5.1 Button: `src/components/ui/button.tsx` (138 importers)
Base: `inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors`, focus `ring-2 ring-ring ring-offset-2`, disabled `opacity-50 pointer-events-none`, svg `size-4`.
| variant | classes |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` (leaf green) |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

| size | classes |
|---|---|
| `default` | `h-11 px-4 py-2` (44px) |
| `sm` | `h-10 rounded-md px-3` (40px) |
| `lg` | `h-12 rounded-md px-8` (48px) |
| `icon` | `h-11 w-11` |

Because `--accent` is indigo #2A3B8F, **outline and ghost buttons hover to indigo with white text** (V by token resolution). Pages often override this. Shell controls do not use Button: they are hand-rolled `rounded-pill` buttons with `hover:bg-tint-subtle`.

Page-level CTA in practice: the full-width generate button, e.g. "Generate Lesson Plan", is `h-12+`, `bg-primary`, white Bricolage-ish label (see `02-lesson-plan.png`). The Google sign-in button is `Button` default with `shadow-sm font-bold`.

### 5.2 Card: `ui/card.tsx` (55 importers)
`rounded-[var(--radius)]` (12px) `border bg-card text-card-foreground shadow-soft transition-colors duration-150`. Header `p-4 md:p-6 space-y-1.5`. Title `font-headline text-xl font-semibold leading-snug tracking-tight`. Description `text-sm text-muted-foreground leading-relaxed`. Content and footer `p-4 md:p-6 pt-0`.

Related containers:
- `SectionCard` (`layout/section-card.tsx`): `rounded-surface-md border shadow-soft p-4 md:p-6 space-y-3`, tones `default` (bg-card) and `muted` (bg-muted/30).
- `.card-section`: `bg-muted/20 rounded-xl p-4 md:p-5`.
- Sampark `Panel`: `rounded-xl border p-4 md:p-6 shadow-sampark-card` with five tones.

### 5.3 Inputs (V)
- `Input`: `h-10 rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm`, focus ring-2 ring-offset-2.
- `Textarea`: `h-10 … bg-transparent text-sm shadow-sm`, focus **ring-1**, no offset. This differs from Input.
- `SelectTrigger`: `h-10 rounded-md border-input bg-background text-sm`, chevron at 50% opacity. Content `rounded-md border bg-popover shadow-md` with zoom/slide-in. Item `rounded-sm py-1.5 pl-8 pr-2 focus:bg-accent` (indigo).
- `Label`: `text-sm font-medium leading-none`.
- `Checkbox`: `h-4 w-4 rounded-sm border-primary`.
- `Switch`: `h-6 w-11 rounded-full`.
- `Slider` and `RadioGroup`: shadcn defaults.

### 5.4 Tabs: `ui/tabs.tsx` (5 importers)
List `h-10 rounded-md bg-muted/50 p-1 gap-1`. Trigger `rounded-sm px-3 py-1.5 text-sm font-medium`. **Active is a filled saffron pill** (`data-[state=active]:bg-primary text-primary-foreground shadow-sm`). Inactive triggers get `border border-input`. This is not the stock shadcn look.

### 5.5 Badge: `ui/badge.tsx` (29)
`rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants:
- `default`: primary fill;
- `secondary`: **leaf green fill**, white text (ResultShell meta default);
- `destructive`;
- `outline`: `text-foreground`.

Other badge-like components:
- Sampark `StatusPill` (`sampark/status-pill.tsx`): `rounded-pill border px-2 py-1 text-xs font-medium` plus a 2×2 dot, in six tones (neutral, info, success, warning, danger, brand), each `bg-<tone>/10 border-<tone>/30`.
- Shell nav `Badge` (inside `shell/side-nav.tsx`): `h-5 min-w-5 rounded-pill bg-primary|bg-destructive text-white text-xs`.

### 5.6 Navigation (V `shell/side-nav.tsx`, `app-sidebar.tsx`, `mobile-bottom-nav.tsx`, `app-shell.tsx`)
**Sidebar** (`ProductSideNav`): `bg-surface-chrome border-r border-line-hairline`, sticky `h-svh`.
- Brand row is `h-topbar pl-5 pr-3` with the fold button (`PanelLeftClose`).
- Lead slot holds "Talk to VIDYA", a peach `rounded-pill` button with a waveform icon.
- Sections:
  - **primary**: Home, Library, Community, Profile. `min-h-11`, Bricolage `text-value` 600.
  - **secondary**, each under a `type-eyebrow` label: MAKE (Lesson Plan, Worksheet, Quiz, Exam Paper, Rubric, Instant Answer), CLASS (Attendance), training, messaging (Messages, Notifications), EXPLORE (Shared resources, Usage, Privacy, Labs, admin). Items are `min-h-10`, `text-tile` 500.
  - Foldable sections show a rotating chevron.
- Item: `rounded-pill border px-3 gap-3`, 18px Lucide icon at `strokeWidth 1.7`.
  - Active: `border-line-hairline bg-milk-400 text-ink-900`, saffron-600 icon, and a 6px saffron-500 dot on the right.
  - Inactive: `text-ink-600 hover:bg-tint-subtle hover:text-ink-900`.
- Footer card: "SamparkAI · Calls and notices to parents ↗" (cross-product link).

**Rail** (768–1023 or folded): 36×48 `rounded-pill` icon tiles with `text-xs` labels under them. Folded sections become a flyout `DropdownMenu` (`rounded-field p-1.5`).

**Top bar**: `sticky h-14 md:h-topbar border-b border-line-hairline bg-surface-chrome`. It holds:
- the search capsule (`rounded-pill border-line-glass bg-surface-glass max-w-sm`, placeholder "Search tools and your work", `⌘K` kbd chip `rounded-xs bg-tint-quiet`);
- `LanguagePill` ("🌐 EN" pill);
- `AuthButton`.

**Phone TabBar** (`mobile-bottom-nav.tsx`): a floating capsule `rounded-pill border-line-glass bg-surface-capsule p-[7px] shadow-float`, 18px above the safe area, with four 42px discs (Home, Library, Community, Profile). The active disc is `bg-saffron-500 text-white`. It hides on scroll (`translate-y`).

### 5.7 Headers (V)
| Pattern | File | Look |
|---|---|---|
| Tool header inside the tool card | `features/generator/components/generator-page.tsx` | centred icon in a `p-3 rounded-full bg-primary/10` disc, then `font-headline text-2xl sm:text-3xl` title, then muted description. Sits under a 4px `card-accent-bar` |
| `PageShell` header | `components/layout/page-shell.tsx` | left-aligned `type-caption` breadcrumb, `type-h1` title, `type-body-lg` description, CTA on the right |
| Sampark `PageHeader` | `components/sampark/console-ui.tsx` | eyebrow `text-xs uppercase tracking-wider text-ink-500`, title `font-display text-2xl md:text-3xl font-semibold` |
| Dashboard hero | `components/dashboard/dashboard-home.tsx` | centred `font-headline text-3xl md:text-5xl font-bold` "Namaste, *Name*." with the name in `text-saffron-600` |
| Result header | `components/ui/result-shell.tsx` | icon plus title `text-xl→3xl`, meta badges, outline action buttons (`h-10 px-3.5`) |

### 5.8 Tables (V)
`ui/table.tsx` has **1** importer. Rows `border-b hover:bg-muted/50`, head `h-12 px-4 text-muted-foreground font-medium`, cell `p-4`. Most "tables" in the product are hand-built lists: Sampark rosters and call logs, the library grid, and the attendance roster.

### 5.9 Modals and overlays (V)
- `Dialog`: overlay `bg-black/80`; content `max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg`, zoom-95 plus slide; title `text-lg font-semibold`.
- `CommandPalette` (cmdk) overrides it to `rounded-surface-md shadow-floating p-0 max-w-2xl`. Items are `rounded-surface-sm` with `aria-selected:bg-primary/10`.
- `AlertDialog`: the same pattern.
- `Sheet`: `bg-background p-6 shadow-lg`, left/right `w-3/4 sm:max-w-sm`, open 500ms and close 300ms.
- `Popover`: `w-72 rounded-md border bg-popover p-4 shadow-md`.
- `Tooltip`: `rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md`.
- `DropdownMenu`: `rounded-md border bg-popover p-1 shadow-md`; items `rounded-sm px-2 py-1.5 focus:bg-accent`.

### 5.10 Notifications (V)
- `ui/toast.tsx` plus `toaster.tsx` (Radix): `rounded-md border p-6 pr-8 shadow-lg`. Variant `default` is `bg-background`; `destructive` is `bg-destructive text-destructive-foreground`. Toasts slide from the top on phones and from the bottom on sm+.
- `VoiceQuotaToastListener` raises quota toasts.
- Inline banners: `ui/alert.tsx` (`rounded-lg border p-4`, variant `destructive`), `LabsBanner`, Sampark `ModeBanner`.

### 5.11 Tooltips (V)
`ui/tooltip.tsx` has 4 importers. Many controls rely on `title` attributes instead, e.g. `StatusPill`.

### 5.12 VIDYA (V)
| Piece | File | Look |
|---|---|---|
| `VidyaPresence` | `components/vidya/vidya-presence.tsx` + `.vidya-*` CSS | flat CSS orb: radial #FFD9AE → #C96A28, one ring. Indigo while connecting/thinking. Desaturated with a red ring on error. Sizes `hero` / `workspace` / `compact` |
| `VidyaSphere` | `components/vidya/vidya-sphere.tsx` | WebGL live orb: three warm blobs, sheen and grain. Indigo arc while thinking, **leaf** while speaking, desaturated "never red" on error |
| Floating mic orb | `omni-orb.tsx`, `vidya-live-orb.tsx`, `omni-orb-live.tsx` | the saffron circular mic button at the bottom-right of tool pages (see `02-lesson-plan.png`) |
| "Talk to VIDYA" | sidebar lead slot (`app-sidebar.tsx`) | peach pill with a waveform icon |
| Status line | `.vidya-status-dot` | 7px dot: saffron when listening or speaking, indigo when thinking, red on error |

### 5.13 Sampark console kit (V `components/sampark/console-ui.tsx`)
| Piece | Look |
|---|---|
| `PageHeader` | see §5.7 |
| `Panel` | tones `plain`, `live` (peach), `notice` (indigo), `done` (leaf), `alert` (rose) |
| `KpiCard` | label, a 32px tone icon tile `rounded-lg`, value `font-display text-3xl` |
| `MiniStat` | `rounded-lg bg-sampark-slate-soft` |
| `AttentionRow` | |
| `ProgressBar` | `h-2 rounded-full`, fill by tone |
| `ToneIcon` | |
| Also | `StatusPill`, `KpiTile` with `Sparkline`, `ErrorPanel` / `LoadingBlock` / `InlineSpinner` (`states.tsx`) |

---

## 6. Layout patterns (V unless marked)

| Pattern | Where | Structure |
|---|---|---|
| **App shell** | `src/app/app-shell.tsx` | `flex min-h-svh bg-wash-screen`: sidebar, then column with sticky top bar and `<main>`. `main` is `items-center px-3 sm:px-4 md:px-8 pt-4 md:pt-8 pb-[96px+safe] md:pb-24`, with `LabsBanner`, `ErrorBoundary` and `AnalyticsProvider` around children |
| **Landing** | `/` logged out, `(marketing)` | no app chrome. Its own nav (logo, Product, Pricing, language, "Log in", black "Start free" pill), ambient glow and Indic marks, a giant `VidyaPresence` hero orb |
| **Tool page (GeneratorPage)** | Worksheet, Quiz, Rubric, Instant Answer (and the unused `features/exam-paper`) | `container-*` + `py-8 space-y-8`. One `rounded-surface-md` card with an accent bar, centred header and form slot. A "result divider" (`hr` + caption + `hr`), then output in `aria-live` |
| **Tool page (bespoke)** | Lesson Plan (`/lesson-plan`), Exam Paper (`src/app/exam-paper/**`) | Lesson Plan: one big card. Left column holds the topic textarea, Quick Ideas chips and Quick Start template tiles; right column is a "LESSON PLAN SETTINGS" panel with dashed image drop, Class/Subject/Language selects, advanced toggle and a full-width Generate button (`02-lesson-plan.png`) |
| **Result** | `ResultShell` | `max-w-4xl` (`compact` = `max-w-2xl`) card. Header row has title, meta and actions; body `p-4 sm:p-6 md:p-8`. Variants `solid` and `glass` |
| **Dashboard (teacher home)** | `components/dashboard/dashboard-home.tsx` | `container-wide`, centred column: greeting H1, VIDYA orb (`h-40 md:h-52`) with status line, pill composer (`rounded-pill bg-surface-disc shadow-float`, saffron send disc), "Prep tools" chip row, suggestion cards (`hover:border-primary/50 hover:shadow-elevated`), recent-work strip. *Not screenshotted, see §10* |
| **Sampark workspace** | `/sampark/**` | own `WorkspaceFrame` (same `ProductSideNav`, Sampark brand, cross-link back to SahayakAI). `PageHeader`, then `SectionCard` / `Panel` grids, then lists |
| **Two-column tool layout** | Lesson Plan | splits at `lg` (I from screenshot at 1440px) and stacks on phones (`24-phone-lesson-plan.png`) |

Grid: no shared grid component. Pages use `grid` and `flex` utilities directly (e.g. Quick Start templates `grid-cols-5` at desktop).

---

## 7. Interaction patterns (V)

| State | How it looks |
|---|---|
| **Hover** | Shell: `hover:bg-tint-subtle` (4% ink) with text going to ink-900. Buttons: `primary/90`, `secondary/80`. Outline/ghost turn **indigo** (`bg-accent`). Cards: `hover:border-primary/50 hover:shadow-elevated` (dashboard). Sampark `KpiCard`: `hover:shadow-sampark-raised`. Table row: `bg-muted/50` |
| **Focus** | Two systems. (1) Shell and Oct-2026 components use `.focus-ring`: `outline 2px saffron-600, offset 2px`, no shadow. (2) shadcn primitives use `ring-2 ring-ring ring-offset-2` (box-shadow), and Textarea uses `ring-1`. VIDYA uses a 3px saffron-700 outline, offset 5px |
| **Active / pressed** | VIDYA core `scale(0.97)`. Composer send `active:scale-95`. Otherwise none |
| **Selected / current** | Nav: milk-400 fill, hairline border, saffron icon, saffron dot, `aria-current`. Tabs: filled saffron. TabBar: saffron disc. Command palette: `bg-primary/10` |
| **Disabled** | `opacity-50 pointer-events-none` (buttons), `cursor-not-allowed opacity-50` (inputs), `peer-disabled:opacity-70` (labels) |
| **Loading** | `Loader2 animate-spin` in buttons (`ResultShell` actions set `aria-busy`). `Skeleton` = `animate-pulse rounded-surface-sm bg-muted`, with presets (`skeleton.tsx`: card, list, article, grid). `GeneratorProgress`. Sampark `LoadingBlock` (three `h-16` skeletons). `LessonPlanLoading`. Auth button pulse `bg-slate-200` (raw palette) |
| **Error** | Sampark `ErrorPanel`: `rounded-surface-md border-destructive/40 bg-destructive/10`, AlertTriangle, outline "Try again". `Alert` destructive. Toast destructive. `src/app/error.tsx`, `not-found.tsx`, `ErrorBoundary` |
| **Success** | Leaf tokens (`success`, `tint-success`, Sampark `done`), StatusPill `success`, Badge `secondary` |
| **Empty** | `EmptyState` (`layout/empty-state.tsx`): a 48px `rounded-pill bg-primary/10` icon, `type-h3` title, `type-body` copy, an optional dashed "Example" sample card, and primary or ghost CTA |
| **Reduced motion** | All keyframe animation is opt-in under `no-preference`, plus `motion-reduce:transition-none` on shell transitions |

---

## 8. Iconography and illustration (V)
- **Lucide** (`components.json` `iconLibrary: "lucide"`). The shell uses `strokeWidth={1.7}` at 18px (nav) or 20px (TabBar). shadcn primitives use the default 2 at 16px. Sampark uses 1.8.
- Template tiles use small coloured icon discs (`src/components/quick-templates.tsx`, colours in `src/data/quick-templates.ts`): pastel per-subject circles in raw Tailwind palette colours (`text-rose-700`, `text-cyan-700`, …; see §12).
- Illustration is largely **absent by policy** (`EmptyState` docstring: rural users read illustrations literally). Brand imagery is the orb, the Indic glyph marks and the film grain.
- `public/` holds icons and OG images. `src/components/logo.tsx` (raster logo) has **0** importers. The shell draws the wordmark in type.

---

## 9. Responsive behaviour (V from shell code, screenshots)
| Width | Shell | Content |
|---|---|---|
| 390 (phone) | 56px top bar: menu, wordmark, search icon, language, sign-in | single column. Sticky `GeneratorSubmitBar` above the TabBar (`bottom: 3.5rem + safe + .5rem`). Floating TabBar capsule |
| 900 (tablet) | 76px rail with labels under the icons, 64px top bar with search capsule | single or stacked columns |
| 1440 (desktop) | 256px sidebar | two-column tool layouts, `container-*` max widths |

Screens: `23-tablet-rail-lesson-plan.png`, `24-phone-lesson-plan.png`, `25-phone-landing.png`.

---

## 10. Screenshots and capture limits
All captured 2026-11-03 from a **clean checkout of `92837486`**:
- a separate git worktree `E:\sargvision\ds-develop-wt`, sharing `node_modules`;
- `next dev` on `:3011`, reading (never seeding) the already-running local Firestore emulator;
- headless Chromium (Playwright) at 1440×900, 900×1100 and 390×844, DPR 1.

The Next.js dev-tools badge was hidden with CSS. Nothing else was altered.

| Not captured | Why |
|---|---|
| **Signed-in teacher dashboard** (`DashboardHome`) and anything that needs a Firebase user (Library contents, Profile, saved outputs) | Sign-in is real Google/Firebase auth. I did not sign in on the user's behalf. The Sampark dev cookie (`auth-token=dev-token`) does not sign in the teacher app. The dashboard is documented from source and reconstructed (and marked) in the showcase |
| Generated outputs (`ResultShell` bodies) | Need a signed-in user and live AI calls |
| Dark mode | Not toggled. Values listed from source only |
| `/attendance` | Headless Chromium got connection-refused on 4 attempts while curl returned 200 |

Screens 18–25 came from a second, disposable local stack (in-memory emulator, demo school in Practice mode), because the first dev server stopped mid-run.

### Tokens defined but never emitted
The showcase's CSS check found some tokens that are in `tailwind.config.ts` but never written as plain classes in `src/`, so Tailwind's JIT emits no CSS for them:
- `rounded-panel`, `rounded-sheet`, `shadow-glow`, `shadow-inner-soft`;
- `shadow-current` and `shadow-sampark-raised`, which exist only as the `focus-within:` and `hover:` variants.

See [`screenshots/README.md`](./screenshots/README.md) for the per-file list.

---

## 11. Uncommitted work in the riya-wt working tree (not part of this baseline)
`git diff --stat` on 2026-11-03 shows 52 files changed (+1492 / −1034). These changes affect what this document describes:
- `globals.css`: `.theme-sampark` **no longer re-points** the shared tokens. Sampark would take SahayakAI's warm milk/ink look, and only `--sampark-slate`, `-slate-soft`, `-line` and the Sampark shadows follow the warm values.
- `generator-page.tsx` / `index.ts`: new `GeneratorHeader`, `GeneratorSection` and `GENERATOR_SUBMIT_CLASS`.
- Exam Paper (`src/app/exam-paper/**`), Quiz, Worksheet and Rubric views restyled.
- Sidebar copy changed ("AI Coach" rename per project notes).
- Sampark demo components restyled.

When that work lands, §2.6, §5.7 and §6 of this file need updating.

## 12. Inconsistencies
Recorded in full in [`DESIGN_REFERENCE_INDEX.md` §6](./DESIGN_REFERENCE_INDEX.md#6-inconsistencies-and-duplicated-styling). They are deliberately **not** standardised here.
