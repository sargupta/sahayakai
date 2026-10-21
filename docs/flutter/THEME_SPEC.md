# THEME_SPEC.md — SahayakAI Flutter (Material 3) Theme

Pixel-faithful port of the SahayakAI web design system (`globals.css` + `tailwind.config.ts`) to a fresh native Flutter Android app. Every value below is derived directly from the web source of truth. Where the web comments disagree with the actual computed color, the **computed value wins** (that is what the browser renders — matching it is the whole point).

Source files this spec is derived from:
- `src/app/globals.css` — `:root`, `.dark`, `.force-light` token blocks
- `tailwind.config.ts` — font families, radius, shadow, chart tokens
- `src/app/layout.tsx` — Google Fonts (`Inter` 300–700 body / `Outfit` 400–800 headline), `themeColor #f97316`
- `public/indic-font-preload.js` — Noto Sans family per Indic language
- `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `badge.tsx`, `mobile-bottom-nav.tsx` — component sizing

---

## 0. CRITICAL COLOR FINDING (read first)

The CSS comment claims `--primary: 28 70% 59%` is `#FF9933` (bright flag saffron). **It is not.** HSL(28, 70%, 59%) computes to **`#E0924D`** — a muted amber/terracotta. `#FF9933` is actually HSL(30, 100%, 60%).

**Decision: use the token-accurate `#E0924D` as `primary`** so the Flutter app renders identically to the live web app. The predecessor app failed on design fidelity; matching the real rendered pixels (not the aspirational comment) is the safe choice. If the brand team later wants true `#FF9933`, that is a *design change to make in both web and Flutter together*, not a Flutter-only deviation. This spec flags every place the two diverge.

Secondary note: the Android system status-bar color (`viewport.themeColor`) is a *different* orange, `#f97316` (Tailwind `orange-500`). Use it only for the system chrome / splash, not as an in-app surface color.

---

## 1. Color tokens — computed hex (authoritative)

All `hsl(H S% L%)` tokens converted to sRGB hex. Opacity-suffixed Tailwind classes (`/90`, `/10` …) become `Color.withOpacity()` in Flutter.

### 1.1 Light (`:root` / `.force-light`)

| Token | HSL | Hex | Role |
|---|---|---|---|
| `background` | 40 20% 99.5% | `#FEFEFD` | scaffold background (warm off-white) |
| `foreground` | 222 47% 11% | `#0F1729` | primary text |
| `card` | 0 0% 100% | `#FFFFFF` | card / sheet surface |
| `card-foreground` | 222 47% 11% | `#0F1729` | text on card |
| `popover` | 0 0% 100% | `#FFFFFF` | menu / dialog surface |
| `popover-foreground` | 222 47% 11% | `#0F1729` | text on popover |
| `primary` | 28 70% 59% | **`#E0924D`** | saffron brand (see §0) |
| `primary-foreground` | 0 0% 100% | `#FFFFFF` | text/icon on primary |
| `secondary` | 123 37% 25% | `#28572B` | deep flag green |
| `secondary-foreground` | 0 0% 100% | `#FFFFFF` | text on secondary |
| `muted` | 210 40% 96% | `#F1F5F9` | subtle fill / chip bg |
| `muted-foreground` | 215 16% 47% | `#65758B` | secondary text, inactive icons |
| `accent` | 240 100% 25% | `#000080` | navy (flag) — links/emphasis |
| `accent-foreground` | 0 0% 100% | `#FFFFFF` | text on accent |
| `destructive` | 0 84% 60% | `#EF4444`¹ | error / delete |
| `destructive-foreground` | 0 0% 100% | `#FFFFFF` | text on error |
| `border` | 220 16% 93% | `#EAECF0` | hairline borders |
| `input` | 220 16% 90% | `#E1E4EA` | input outline (slightly darker) |
| `ring` | 28 70% 59% | `#E0924D` | focus ring (saffron) |

¹ Exact math of `0 84% 60%` rounds to `#EF4343`; the intended value is Tailwind `red-500` `#EF4444`. Use `#EF4444`.

Saffron scale (landing/marketing accents — same hue family):

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `saffron-50` | `#FFF4EB` | | `saffron-300` | `#F7B67E` |
| `saffron-100` | `#FEE9D7` | | `saffron-600` | `#DF6C20` |
| `saffron-200` | `#FDD4AF` | | `saffron-700` | `#AC4815` |
| | | | `saffron-800` | `#8B330E` |

`saffron-500` and `saffron` DEFAULT both alias `primary` = `#E0924D`.

Chart palette (light): `#E0924D` `#28572B` `#000080` `#FBBD23` `#E92063`.

Sidebar (light): bg `#FAFAFA`, fg `#3F3F46`, primary `#18181B`, primary-fg `#FAFAFA`, accent `#FBF2E9` (saffron tint), accent-fg `#E0924D`, border `#E5E7EB`, ring `#E0924D`.

### 1.2 Dark (`.dark`)

| Token | HSL | Hex | Role |
|---|---|---|---|
| `background` | 222 18% 9% | `#13151B` | scaffold (soft near-black) |
| `foreground` | 210 30% 96% | `#F2F5F8` | primary text |
| `card` | 222 16% 13% | `#1C1F26` | elevated surface |
| `card-foreground` | 210 30% 96% | `#F2F5F8` | text on card |
| `popover` | 222 16% 14% | `#1E2129` | menu / dialog surface |
| `popover-foreground` | 210 30% 96% | `#F2F5F8` | text on popover |
| `primary` | 28 80% 60% | **`#EB9447`** | saffron (brighter for dark) |
| `primary-foreground` | 0 0% 100% | `#FFFFFF` | text/icon on primary |
| `secondary` | 123 33% 40% | `#448848` | lighter green for dark |
| `secondary-foreground` | 0 0% 100% | `#FFFFFF` | text on secondary |
| `muted` | 222 14% 17% | `#252931` | subtle fill |
| `muted-foreground` | 215 16% 64% | `#95A1B2` | secondary text, inactive icons |
| `accent` | 222 15% 20% | `#2B303B` | hover surface (NOT navy in dark) |
| `accent-foreground` | 210 30% 96% | `#F2F5F8` | text on accent |
| `destructive` | 0 62% 45% | `#BA2C2C` | error |
| `destructive-foreground` | 0 0% 100% | `#FFFFFF` | text on error |
| `border` | 222 13% 22% | `#31353F` | separators (lighter than card) |
| `input` | 222 13% 22% | `#31353F` | input outline |
| `ring` | 28 80% 60% | `#EB9447` | focus ring (saffron) |

Chart palette (dark): `#EB9447` `#50AF55` `#5C8BD6` `#F6CA5A` `#E3638E`.

Sidebar (dark): bg `#0E1015`, fg `#F2F5F8`, primary `#EB9447`, primary-fg `#FFFFFF`, accent `#23262F`, accent-fg `#F2F5F8`, border `#282C34`, ring `#EB9447`.

> Note: in dark mode `accent` is a neutral elevated surface (`#2B303B`), **not** navy. Do not map dark `accent` to a Material 3 "tertiary/navy" role — it is a hover/hover-surface. Navy `#000080` only exists as an accent in light mode.

### 1.3 Material 3 `ColorScheme` mapping

Material 3 has no `card`/`muted`/`accent` slots, so map onto the M3 role system as follows (these are the exact values wired into the Dart in §7):

| M3 role | Light | Dark | Web token |
|---|---|---|---|
| `primary` | `#E0924D` | `#EB9447` | primary |
| `onPrimary` | `#FFFFFF` | `#FFFFFF` | primary-foreground |
| `primaryContainer` | `#FBF2E9` | `#23262F` | sidebar-accent / saffron tint |
| `onPrimaryContainer` | `#8B330E` | `#EB9447` | saffron-800 / primary |
| `secondary` | `#28572B` | `#448848` | secondary |
| `onSecondary` | `#FFFFFF` | `#FFFFFF` | secondary-foreground |
| `secondaryContainer` | `#E8F0E8` | `#2A3A2B` | derived green tint² |
| `onSecondaryContainer` | `#1B3A1C` | `#C7E0C8` | derived² |
| `tertiary` | `#000080` | `#5C8BD6` | accent (navy light / chart-3 dark)³ |
| `onTertiary` | `#FFFFFF` | `#FFFFFF` | accent-foreground |
| `error` | `#EF4444` | `#BA2C2C` | destructive |
| `onError` | `#FFFFFF` | `#FFFFFF` | destructive-foreground |
| `surface` | `#FFFFFF` | `#1C1F26` | card |
| `onSurface` | `#0F1729` | `#F2F5F8` | card-foreground |
| `surfaceContainerLowest` | `#FEFEFD` | `#13151B` | background |
| `surfaceContainerLow` | `#FAFAFA` | `#1A1D24` | derived² |
| `surfaceContainer` | `#F1F5F9` | `#252931` | muted |
| `surfaceContainerHigh` | `#EAECF0` | `#2B303B` | border / accent(dark) |
| `surfaceContainerHighest` | `#E1E4EA` | `#31353F` | input / border(dark) |
| `onSurfaceVariant` | `#65758B` | `#95A1B2` | muted-foreground |
| `outline` | `#EAECF0` | `#31353F` | border |
| `outlineVariant` | `#E1E4EA` | `#282C34` | input / sidebar-border |
| `surfaceTint` | `#E0924D` | `#EB9447` | primary (keep M3 tinting on-brand) |
| `inverseSurface` | `#0F1729` | `#F2F5F8` | foreground |
| `onInverseSurface` | `#FEFEFD` | `#13151B` | background |
| `scrim` / `shadow` | `#000000` | `#000000` | — |

² Derived tints (web has no explicit token) — chosen to sit tonally between the base color and surface; adjust only if design provides real tokens.
³ `tertiary` carries the navy flag accent in light. In dark the web reuses navy sparingly; `#5C8BD6` (dark chart-3) is the legible dark-mode navy. If you want strict flag navy in dark too, use `#000080` but it fails contrast on `#13151B` — prefer the lightened value.

Set `ThemeData.scaffoldBackgroundColor` to `surfaceContainerLowest` (`#FEFEFD` / `#13151B`) — the web `background` token — **not** `surface`, because web `background ≠ card`.

---

## 2. Typography

### 2.1 Fonts (via `google_fonts`)

| Web role | Family | Weights loaded | Flutter |
|---|---|---|---|
| Headline (`font-headline`) | **Outfit** | 400, 500, 600, 700, 800 | `GoogleFonts.outfit(...)` |
| Body (`font-body`, default `<body>`) | **Inter** | 300, 400, 500, 600, 700 | `GoogleFonts.inter(...)` |
| Code | monospace | — | platform monospace |

`pubspec.yaml`: add `google_fonts: ^6.2.1`. Fonts stream at runtime; for offline-first rural users **bundle the .ttf files** in `assets/fonts/` and let `google_fonts` pick them up (set `GoogleFonts.config.allowRuntimeFetching = false` and register assets), or ship them as regular Flutter fonts. Do not rely on network fetch on first launch.

### 2.2 Indic script fallback (per language)

Web appends Noto Sans families after the base font so the browser auto-picks glyphs per Unicode block (`tailwind.config.ts` `fontFamily.body/headline`). Flutter does **not** auto-fall-back by script unless you supply `fontFamilyFallback`. Map from `public/indic-font-preload.js`:

| Language (UI key) | Script | Noto family | google_fonts loader |
|---|---|---|---|
| Hindi, Marathi | Devanagari | Noto Sans Devanagari | `GoogleFonts.notoSansDevanagari` |
| Bengali | Bengali | Noto Sans Bengali | `GoogleFonts.notoSansBengali` |
| Tamil | Tamil | Noto Sans Tamil | `GoogleFonts.notoSansTamil` |
| Telugu | Telugu | Noto Sans Telugu | `GoogleFonts.notoSansTelugu` |
| Kannada | Kannada | Noto Sans Kannada | `GoogleFonts.notoSansKannada` |
| Malayalam | Malayalam | Noto Sans Malayalam | `GoogleFonts.notoSansMalayalam` |
| Gujarati | Gujarati | Noto Sans Gujarati | `GoogleFonts.notoSansGujarati` |
| Punjabi | Gurmukhi | Noto Sans Gurmukhi | `GoogleFonts.notoSansGurmukhi` |
| Odia | Oriya | Noto Sans Oriya | `GoogleFonts.notoSansOriya` |
| English | Latin | — (Inter/Outfit) | — |

Every weight loaded for the Latin base (300–800) should be loaded for the active language's Noto family too (`400;500;600;700` per the preload script).

Two-part strategy in Flutter:
1. **Global fallback chain**: give every `TextStyle` a `fontFamilyFallback` listing the google_fonts family names for all nine scripts, so mixed "Hinglish" strings render correctly even without switching locale. The family name strings google_fonts registers are exactly `"Noto Sans Devanagari"`, `"Noto Sans Bengali"`, etc. You must *call each loader once at startup* so the family is registered before it is referenced as a fallback (see §7 `_warmIndicFonts`).
2. **Active-language primary swap**: when the user picks a non-English language, rebuild the `TextTheme` so the *primary* family for that script's Noto Sans is first (better shaping/perf than relying on fallback). Optional optimisation — the fallback chain alone is correct.

### 2.3 Line-height (Indic ≥ 1.4 — mandatory)

Web body defaults to `line-height:1.5` (`<body>`), paragraphs `1.6`, headings `1.15–1.3`, and `.indic-text` forces `1.7` body / `1.45` headings. Flutter `TextStyle.height` is a multiplier of `fontSize`.

Rule: **no text style may use `height < 1.4`.** Latin headings that were `1.15`/`1.2`/`1.3` on web are raised to `1.3–1.4` here (they still read tight) and an Indic-aware builder clamps them to `≥1.45` and body to `1.7` when the active locale is Indic. This prevents Devanagari/Bengali matra and Tamil/Kannada/Malayalam ascender-descender clipping — the exact failure `.indic-text` guards against.

### 2.4 Type scale → Material 3 `TextTheme`

Tailwind sizes: `xs`=12, `sm`=14, `base`=16, `lg`=18, `xl`=20, `2xl`=24, `3xl`=30. Weights: Outfit 700=bold, 600=semibold; Inter 500=medium, 400=normal, 300=light.

| M3 slot | Font | Size | Weight | height (Latin) | height (Indic) | Web origin |
|---|---|---|---|---|---|---|
| `displayLarge` | Outfit | 36 | 800 | 1.15 → **1.4** | 1.45 | landing hero |
| `displayMedium` | Outfit | 30 | 700 | 1.15 → **1.4** | 1.45 | `type-h1` (`text-3xl` bold) |
| `displaySmall` | Outfit | 24 | 700 | 1.2 → **1.4** | 1.45 | `type-h2` |
| `headlineLarge` | Outfit | 30 | 700 | **1.4** | 1.45 | h1 alias |
| `headlineMedium` | Outfit | 24 | 600 | 1.2 → **1.4** | 1.45 | `type-h2` |
| `headlineSmall` | Outfit | 20 | 600 | 1.3 → **1.4** | 1.45 | section headers |
| `titleLarge` | Outfit | 20 | 600 | 1.35 | 1.45 | `CardTitle` (`text-xl` semibold) |
| `titleMedium` | Outfit | 18 | 600 | 1.4 | 1.5 | `type-h3` (`text-lg` semibold) |
| `titleSmall` | Outfit | 14 | 600 | 1.4 | 1.5 | `.section-title` (uppercase — see below) |
| `bodyLarge` | Inter | 16 | 500 | 1.6 | 1.7 | `type-body-lg` (`text-base` medium) |
| `bodyMedium` | Inter | 14 | 400 | 1.6 | 1.7 | `type-body` (`text-sm`) |
| `bodySmall` | Inter | 12 | 400 | 1.5 | 1.7 | fine print |
| `labelLarge` | Inter | 14 | 500 | 1.4 | 1.5 | button text (`text-sm font-medium`) |
| `labelMedium` | Inter | 12 | 500 | 1.4 | 1.5 | chip / meta |
| `labelSmall` | Inter | 12 | 500 | 1.4 | 1.5 | `type-caption` (uppercase, `tracking-wide`) |

Extra web specifics to reproduce where used explicitly (not global):
- `.type-caption` / `.section-title`: `letterSpacing` ≈ `0.05 * fontSize` (`tracking-wide`/`wider`), `TextTransform`→ uppercase in the widget (Flutter has no CSS `text-transform`; uppercase the string or use `.toUpperCase()`).
- `CardTitle`: `letterSpacing: -0.2` (`tracking-tight`), height `1.35` (`leading-snug`).
- Bottom-nav label: 10px, weight 500 (600 when active). Not a TextTheme slot — style inline (§6).

---

## 3. Shape / radius scale

Web has two radius systems. `--radius = 0.75rem = 12px`. shadcn defaults derive `lg=12, md=10, sm=8` from it; the "surface" namespace adds `surface-sm=6, surface-md=12, surface-lg=20, pill=9999`. Buttons/inputs render `rounded-md` = **10px**; cards render `rounded-[var(--radius)]` = **12px**.

Canonical Flutter scale (`AppRadius`), reconciling the task's semantic scale with web-actual component values:

| Name | px | Web source | Applied to |
|---|---|---|---|
| `sm` | 8 | `rounded-sm` (12−4) | small chips, tight tags |
| `md` | 10 | `rounded-md` (12−2) | **buttons, inputs, small menus** |
| `lg` | 12 | `--radius` / `rounded-lg`/`rounded-xl` | **cards, sheets, dialogs, containers** |
| `xl` | 16 | `rounded-2xl` default | large media tiles |
| `hero` | 20 | `--radius-lg` (`surface-lg`) | landing/hero surfaces only |
| `pill` | 9999 | `--radius-pill` / `rounded-full` | badges, chips, voice orbs, FAB |

`RoundedRectangleBorder` specs:
```dart
sm   = RoundedRectangleBorder(borderRadius: BorderRadius.circular(8));
md   = RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)); // buttons/inputs
lg   = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)); // cards
xl   = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
hero = RoundedRectangleBorder(borderRadius: BorderRadius.circular(20));
pill = StadiumBorder();                                                 // badges/chips/orbs
```

> The task brief lists "md 12". That refers to the *surface* scale where `surface-md = --radius = 12`. Because the actual web **button** uses `rounded-md = 10px`, this spec keeps buttons/inputs at **10px** for pixel fidelity and reserves 12px for cards (`lg`). If you prefer a single 12px radius everywhere, set button radius to `lg` — but it will not match the current web app.

---

## 4. Elevation / shadows

Flutter `BoxShadow` equivalents of the Tailwind `boxShadow` tokens (light-mode tuned; in dark, reduce opacity ~30% or rely on surface tonal elevation). Colors that are `rgb(0 0 0 / a)` → `Colors.black.withOpacity(a)`; `hsl(222 47% 11% / a)` → `Color(0xFF0F1729).withOpacity(a)`.

| Token | Web value | Flutter `List<BoxShadow>` |
|---|---|---|
| `soft` (Card default) | `0 1px 2px rgb(0 0 0/.04), 0 1px 3px rgb(0 0 0/.03)` | `[BoxShadow(color: black04, offset: (0,1), blurRadius: 2), BoxShadow(color: black03, offset: (0,1), blurRadius: 3)]` |
| `elevated` (`card-elevated`, `shadow-md`) | `0 4px 12px -2px rgb(0 0 0/.08), 0 2px 4px -2px rgb(0 0 0/.04)` | `[BoxShadow(color: black08, offset:(0,4), blurRadius:12, spreadRadius:-2), BoxShadow(color: black04, offset:(0,2), blurRadius:4, spreadRadius:-2)]` |
| `floating` (`--shadow-floating`, bottom-nav, modals) | `0 16px 40px hsl(222 47% 11%/.12)` | `[BoxShadow(color: Color(0xFF0F1729).withOpacity(.12), offset:(0,16), blurRadius:40)]` |
| `glow` (saffron focus) | `0 0 0 3px hsl(28 70% 59%/.12), 0 4px 12px -2px rgb(0 0 0/.08)` | ring: `Border`/`BoxShadow(color: primary.withOpacity(.12), spreadRadius:3)` + elevated |
| `--shadow-soft` var | `0 1px 2px hsl(222 47% 11%/.04)` | single soft shadow |
| `--shadow-elevated` var | `0 4px 12px hsl(222 47% 11%/.08)` | single elevated shadow |

Because Material 3 components take a numeric `elevation`, use these approximate mappings when a real shadow list can't be passed: Card `soft` → `elevation: 1`; `elevated` → `elevation: 3`; `floating` → `elevation: 8`. Prefer passing explicit `BoxShadow` lists via `Container`/`Material` for exact parity (Material's default shadow color/opacity differs from the web values). Set `ThemeData.useMaterial3 = true` and keep `shadowColor: Color(0xFF0F1729)` so tonal shadows match the `hsl(222 47% 11%)` base.

Motion tokens (from `--motion-*` / `--ease-out-quart`): `micro 150ms`, `small 250ms`, `medium 350ms`, curve `Cubic(0.16, 1, 0.3, 1)` (= `Curves.easeOutQuart`-ish; define `const appEaseOutQuart = Cubic(0.16, 1.0, 0.3, 1.0)`).

---

## 5. Component themes

### 5.1 Buttons

Web `button.tsx` sizes (heights bumped to iOS/Material minimums): `default h-11`=**44px**, `sm h-10`=40px, `lg h-12`=48px, `icon h-11`=44×44. Radius `rounded-md`=10px. `default` variant = `bg-primary text-primary-foreground`, hover `primary/90`.

**Decision: enforce a 48dp minimum touch target** (Material accessibility + the file's own stated intent). Use `minimumSize: Size(0, 48)` for the primary/filled default, keep `sm`=40, `lg`=52. This is a deliberate +4dp over web `h-11`=44 to hit the Material 48dp floor; buttons stay visually the same weight.

- **FilledButton** (maps `variant=default`): bg `primary`, fg `onPrimary`, radius 10, height 48, `padding: horizontal 16` (`px-4`), textStyle `labelLarge` (Inter 14/500), no elevation (flat, like web). Hover/pressed overlay = `primary` @ 8–10% (web `/90` ≈ darken; use M3 state layer).
- **ElevatedButton**: same colors as FilledButton but `elevation: 1` with `soft` shadow — use only where web adds a shadow; default to FilledButton.
- **OutlinedButton** (`variant=outline`): transparent bg, `side: BorderSide(color: input, width: 1)`, fg `foreground`, hover bg `accent`/`onSurface@8%`, radius 10, height 48.
- **secondary** variant: bg `secondary` `#28572B`, fg white.
- **destructive** variant: bg `error`, fg white.
- **ghost**: transparent, hover `accent`; **link**: text `primary`, underline on hover.
- **TextButton**: fg `primary`, radius 10.
- **IconButton**: 44–48 square, radius `pill` for round, else 10.

### 5.2 Card

Web: `rounded-[12px] border bg-card shadow-soft`, header padding `p-4 md:p-6` (16 / 24), transitions colors. Flutter `CardTheme`:
- `color: surface` (`#FFFFFF` / `#1C1F26`), `surfaceTintColor: Colors.transparent` (web cards are not tinted — important; M3 would otherwise tint them saffron).
- `elevation: 0` + explicit `soft` `BoxShadow` via wrapping `Container`, OR `elevation: 1` with `shadowColor: #0F1729` as a fast approximation.
- `shape: RoundedRectangleBorder(radius 12)` + `side: BorderSide(color: outline, width: 1)` (web cards have a border).
- Default content padding: `EdgeInsets.all(16)` (mobile `p-4`).
- Elevated variant (`card-elevated`): `elevated` shadow + `border: outline @ 60%`.

### 5.3 InputDecoration

Web `input.tsx`: `h-10`=**40px**, `rounded-md`=10, `border border-input bg-background px-3 py-2`, text `text-base`(16, mobile) / `md:text-sm`(14), placeholder `muted-foreground`, focus `ring-2 ring-ring`(saffron) `ring-offset-2`.
- `filled: false`, `fillColor: background` (transparent over scaffold), or `filled: true, fillColor: surface` for contrast on colored sections.
- `border`/`enabledBorder`: `OutlineInputBorder(radius 10, side: BorderSide(color: input, width: 1))`.
- `focusedBorder`: `OutlineInputBorder(radius 10, side: BorderSide(color: ring/*saffron*/, width: 2))`.
- `errorBorder`/`focusedErrorBorder`: `error` color, width 1/2.
- `contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)` (min height ~48 for touch even though web is 40 — bump for Android tap comfort).
- `hintStyle`: `muted-foreground`, Inter 14. `isDense: false`.

### 5.4 Chip / Badge

Web `badge.tsx`: `rounded-full px-2.5 py-0.5 text-xs font-semibold border`. Variants default=`bg-primary`, secondary=`bg-secondary`, destructive=`bg-destructive`, outline=`text-foreground` transparent.
`ChipTheme`:
- `shape: StadiumBorder()` (pill), `labelStyle: Inter 12/600`, `padding: EdgeInsets.symmetric(horizontal: 10, vertical: 2)`.
- Default filled: bg `primary`, label `onPrimary`. Muted chip (common in-app): bg `muted` `#F1F5F9`, label `muted-foreground`/`foreground`.
- `side: BorderSide(color: outline)` for outline variant; transparent border for filled.
- `selectedColor`: `primaryContainer` (`#FBF2E9`), `checkmarkColor: primary`.

### 5.5 BottomNavigationBar / NavigationBar (mirrors `mobile-bottom-nav.tsx`)

Web nav: height `h-14`=**56px** + `pb-[safe-area-inset-bottom]`, `bg-background/95 backdrop-blur-md`, `border-t border-border`, `shadow-floating`. Four tabs: **Home** (`Home`), **Create** (`Sparkles`, opens command palette), **Library** (`Library`), **Me** (`User`) — Lucide icons. Icon `h-5 w-5`=**20px**. Active = `primary` (saffron) icon+label, icon `scale-110`; inactive = `muted-foreground` (hover `foreground`). Label `text-[10px]`=10px, `font-medium`, active `font-semibold`. Active tap ripple `primary/5`.

**Recommendation: use Material 3 `NavigationBar`** (not the legacy `BottomNavigationBar`) for correct M3 behaviour, styled to match:
- `height: 56`, `backgroundColor: background` with 95% opacity (`#FEFEFD`.withOpacity(.95) / `#13151B`.withOpacity(.95)) over a `BackdropFilter(blur 8)` if you want the web glass effect; else solid `surfaceContainerLowest`.
- Top border: 1px `outline` (`#EAECF0`/`#31353F`) — add via a `Border(top:)` on a wrapping container since NavigationBar has no border slot.
- `indicatorColor: primary.withOpacity(.10)` (pill), or set `indicatorColor: transparent` and color the icon saffron to match web exactly (web has no pill indicator — it just colors the icon). **Prefer transparent indicator + saffron icon/label** for fidelity.
- Selected icon/label: `primary`; unselected: `muted-foreground`.
- `labelBehavior: alwaysShow`, label style Inter 10/500 (600 selected), icon size 20 (24 is M3 default — override to 20 for parity, or accept 24).
- `elevation: 0`; apply `floating` shadow via wrapper. Lucide icons: use `lucide_icons` / `lucide_flutter` package (Home, Sparkles, Library, User) to match the web glyphs exactly rather than Material icons.
- Honor `SafeArea`/`MediaQuery.padding.bottom` for the home indicator.

### 5.6 AppBar (recommendation)

Web in-app pages have **no saffron top bar** — headers sit on the light `background`/`card` surface with saffron used only as an accent (icons, active states, `card-accent-bar` gradient). A fully saffron AppBar would (a) not match the web, (b) clash with the muted `#E0924D` primary (it reads dull as a large fill), and (c) waste the flag-saffron on chrome instead of CTAs.

**Recommendation: surface AppBar with saffron accents.**
- `backgroundColor: surface` (`#FFFFFF` / `#1C1F26`) — or `surfaceContainerLowest` to match scaffold and go seamless.
- `foregroundColor: onSurface` (`#0F1729` / `#F2F5F8`) for title + icons.
- `elevation: 0`, `scrolledUnderElevation: 2` with `shadowColor: #0F1729` (subtle `soft` on scroll), `surfaceTintColor: transparent`.
- Title: Outfit 20/600 (`titleLarge`), `centerTitle: false`.
- Accent: leading/action icons or an active tab underline in `primary`; optional 1px bottom `outline` border or a 3px saffron `card-accent-bar` gradient (`primary → primary@40%`) for branded screens.
- System status bar: `SystemUiOverlayStyle` with `statusBarColor: transparent`, icons dark in light / light in dark. The web `themeColor #f97316` is only for the PWA/system theme; for a native app set the status bar to match the AppBar surface, not `#f97316`.

Also theme: `DialogTheme` radius 12 + `surface`; `BottomSheetTheme` radius 12 top corners + `surface` + `floating` shadow; `SnackBarTheme` bg `inverseSurface` fg `onInverseSurface`, radius 10; `DividerTheme` color `outline @ 60%`, thickness 1 (`section-divider` = `bg-border/60`); `TooltipTheme` bg `popover`, radius 8.

---

## 6. Spacing / layout reference (for screen work, not the ThemeData)

Tailwind 4px base unit. Common paddings seen: card header `p-4/p-6` (16/24), page container `px-4 py-6 md:py-10` (16 / 24–40), `card-section p-4 md:p-5` (16/20), `tool-icon-wrap 48×48 rounded-12 bg-primary/10 text-primary`. Container max-widths (desktop, informational): narrow 672, default 1024, wide 1280, page 896. Gaps `gap-2`=8, `gap-3`=12. Keep an `AppSpacing` scale of 4/8/12/16/20/24/32/40.

---

## 7. Ready-to-paste `lib/core/theme/app_theme.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// SahayakAI theme — pixel-faithful port of the web design system.
/// See docs/flutter/THEME_SPEC.md for the full derivation and color findings.
///
/// NOTE ON `primary`: the web token `--primary: 28 70% 59%` renders as
/// #E0924D (muted saffron/amber), NOT the #FF9933 the CSS comment claims.
/// We match the real rendered pixels. Change in web + Flutter together if
/// the brand ever moves to true #FF9933.
class AppColors {
  // ---- Light ----
  static const lBackground = Color(0xFFFEFEFD); // scaffold
  static const lForeground = Color(0xFF0F1729);
  static const lCard = Color(0xFFFFFFFF);
  static const lPopover = Color(0xFFFFFFFF);
  static const lPrimary = Color(0xFFE0924D); // saffron (token-accurate)
  static const lOnPrimary = Color(0xFFFFFFFF);
  static const lPrimaryContainer = Color(0xFFFBF2E9);
  static const lOnPrimaryContainer = Color(0xFF8B330E);
  static const lSecondary = Color(0xFF28572B); // deep green
  static const lSecondaryContainer = Color(0xFFE8F0E8);
  static const lOnSecondaryContainer = Color(0xFF1B3A1C);
  static const lTertiary = Color(0xFF000080); // navy
  static const lMuted = Color(0xFFF1F5F9);
  static const lMutedForeground = Color(0xFF65758B);
  static const lError = Color(0xFFEF4444);
  static const lBorder = Color(0xFFEAECF0);
  static const lInput = Color(0xFFE1E4EA);
  static const lRing = Color(0xFFE0924D);

  // ---- Dark ----
  static const dBackground = Color(0xFF13151B);
  static const dForeground = Color(0xFFF2F5F8);
  static const dCard = Color(0xFF1C1F26);
  static const dPopover = Color(0xFF1E2129);
  static const dPrimary = Color(0xFFEB9447);
  static const dOnPrimary = Color(0xFFFFFFFF);
  static const dPrimaryContainer = Color(0xFF23262F);
  static const dOnPrimaryContainer = Color(0xFFEB9447);
  static const dSecondary = Color(0xFF448848);
  static const dSecondaryContainer = Color(0xFF2A3A2B);
  static const dOnSecondaryContainer = Color(0xFFC7E0C8);
  static const dTertiary = Color(0xFF5C8BD6); // lightened navy for dark
  static const dMuted = Color(0xFF252931);
  static const dMutedForeground = Color(0xFF95A1B2);
  static const dError = Color(0xFFBA2C2C);
  static const dBorder = Color(0xFF31353F);
  static const dInput = Color(0xFF31353F);
  static const dRing = Color(0xFFEB9447);

  static const shadowBase = Color(0xFF0F1729); // hsl(222 47% 11%)
}

class AppRadius {
  static const double sm = 8;
  static const double md = 10; // buttons, inputs
  static const double lg = 12; // cards (= --radius)
  static const double xl = 16;
  static const double hero = 20;
  static const rSm = BorderRadius.all(Radius.circular(sm));
  static const rMd = BorderRadius.all(Radius.circular(md));
  static const rLg = BorderRadius.all(Radius.circular(lg));
  static const rXl = BorderRadius.all(Radius.circular(xl));
}

class AppShadows {
  static const _b = AppColors.shadowBase;
  static List<BoxShadow> soft = [
    BoxShadow(color: Colors.black.withOpacity(0.04), offset: const Offset(0, 1), blurRadius: 2),
    BoxShadow(color: Colors.black.withOpacity(0.03), offset: const Offset(0, 1), blurRadius: 3),
  ];
  static List<BoxShadow> elevated = [
    BoxShadow(color: Colors.black.withOpacity(0.08), offset: const Offset(0, 4), blurRadius: 12, spreadRadius: -2),
    BoxShadow(color: Colors.black.withOpacity(0.04), offset: const Offset(0, 2), blurRadius: 4, spreadRadius: -2),
  ];
  static List<BoxShadow> floating = [
    BoxShadow(color: _b.withOpacity(0.12), offset: const Offset(0, 16), blurRadius: 40),
  ];
}

class AppMotion {
  static const Duration micro = Duration(milliseconds: 150);
  static const Duration small = Duration(milliseconds: 250);
  static const Duration medium = Duration(milliseconds: 350);
  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.3, 1.0);
}

/// Noto Sans fallback family names (as registered by google_fonts) so mixed
/// Latin+Indic strings shape correctly regardless of active locale.
const List<String> kIndicFallback = [
  'Noto Sans Devanagari',
  'Noto Sans Bengali',
  'Noto Sans Tamil',
  'Noto Sans Telugu',
  'Noto Sans Kannada',
  'Noto Sans Malayalam',
  'Noto Sans Gujarati',
  'Noto Sans Gurmukhi',
  'Noto Sans Oriya',
];

/// Call once at startup so every Noto family is registered before it is
/// referenced as a fontFamilyFallback. In production, prefer bundling these
/// as assets and setting GoogleFonts.config.allowRuntimeFetching = false.
void warmIndicFonts() {
  GoogleFonts.notoSansDevanagari();
  GoogleFonts.notoSansBengali();
  GoogleFonts.notoSansTamil();
  GoogleFonts.notoSansTelugu();
  GoogleFonts.notoSansKannada();
  GoogleFonts.notoSansMalayalam();
  GoogleFonts.notoSansGujarati();
  GoogleFonts.notoSansGurmukhi();
  GoogleFonts.notoSansOriya();
  GoogleFonts.inter();
  GoogleFonts.outfit();
}

class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness b) {
    final isDark = b == Brightness.dark;

    final scheme = isDark
        ? const ColorScheme(
            brightness: Brightness.dark,
            primary: AppColors.dPrimary,
            onPrimary: AppColors.dOnPrimary,
            primaryContainer: AppColors.dPrimaryContainer,
            onPrimaryContainer: AppColors.dOnPrimaryContainer,
            secondary: AppColors.dSecondary,
            onSecondary: Color(0xFFFFFFFF),
            secondaryContainer: AppColors.dSecondaryContainer,
            onSecondaryContainer: AppColors.dOnSecondaryContainer,
            tertiary: AppColors.dTertiary,
            onTertiary: Color(0xFFFFFFFF),
            error: AppColors.dError,
            onError: Color(0xFFFFFFFF),
            surface: AppColors.dCard,
            onSurface: AppColors.dForeground,
            surfaceContainerLowest: AppColors.dBackground,
            surfaceContainerLow: Color(0xFF1A1D24),
            surfaceContainer: AppColors.dMuted,
            surfaceContainerHigh: Color(0xFF2B303B),
            surfaceContainerHighest: AppColors.dBorder,
            onSurfaceVariant: AppColors.dMutedForeground,
            outline: AppColors.dBorder,
            outlineVariant: Color(0xFF282C34),
            surfaceTint: AppColors.dPrimary,
            inverseSurface: AppColors.dForeground,
            onInverseSurface: AppColors.dBackground,
            shadow: Color(0xFF000000),
            scrim: Color(0xFF000000),
          )
        : const ColorScheme(
            brightness: Brightness.light,
            primary: AppColors.lPrimary,
            onPrimary: AppColors.lOnPrimary,
            primaryContainer: AppColors.lPrimaryContainer,
            onPrimaryContainer: AppColors.lOnPrimaryContainer,
            secondary: AppColors.lSecondary,
            onSecondary: Color(0xFFFFFFFF),
            secondaryContainer: AppColors.lSecondaryContainer,
            onSecondaryContainer: AppColors.lOnSecondaryContainer,
            tertiary: AppColors.lTertiary,
            onTertiary: Color(0xFFFFFFFF),
            error: AppColors.lError,
            onError: Color(0xFFFFFFFF),
            surface: AppColors.lCard,
            onSurface: AppColors.lForeground,
            surfaceContainerLowest: AppColors.lBackground,
            surfaceContainerLow: Color(0xFFFAFAFA),
            surfaceContainer: AppColors.lMuted,
            surfaceContainerHigh: AppColors.lBorder,
            surfaceContainerHighest: AppColors.lInput,
            onSurfaceVariant: AppColors.lMutedForeground,
            outline: AppColors.lBorder,
            outlineVariant: AppColors.lInput,
            surfaceTint: AppColors.lPrimary,
            inverseSurface: AppColors.lForeground,
            onInverseSurface: AppColors.lBackground,
            shadow: Color(0xFF000000),
            scrim: Color(0xFF000000),
          );

    final textTheme = _textTheme(scheme, isIndic: false);

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surfaceContainerLowest, // web `background`
      shadowColor: AppColors.shadowBase,
      textTheme: textTheme,
      splashFactory: InkRipple.splashFactory,

      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surfaceContainerLowest,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 2,
        shadowColor: AppColors.shadowBase,
        centerTitle: false,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 20, fontWeight: FontWeight.w600, height: 1.35,
          color: scheme.onSurface, fontFamilyFallback: kIndicFallback,
        ),
        systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          shape: const WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          elevation: const WidgetStatePropertyAll(0),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          shape: const WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          elevation: const WidgetStatePropertyAll(1),
          shadowColor: WidgetStatePropertyAll(AppColors.shadowBase),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.onSurface),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          side: WidgetStatePropertyAll(BorderSide(color: scheme.outlineVariant, width: 1)),
          shape: const WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.primary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          shape: const WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 1,
        shadowColor: AppColors.shadowBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rLg,
          side: BorderSide(color: scheme.outline, width: 1),
        ),
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        hintStyle: GoogleFonts.inter(
          fontSize: 14, color: scheme.onSurfaceVariant, fontFamilyFallback: kIndicFallback,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.primary, width: 2), // saffron ring
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainer, // muted chip
        selectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.primary,
        labelStyle: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w600, color: scheme.onSurface,
          fontFamilyFallback: kIndicFallback,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        shape: const StadiumBorder(),
        side: BorderSide(color: scheme.outline),
      ),

      navigationBarTheme: NavigationBarThemeData(
        height: 56,
        backgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent, // web colors the icon, no pill
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
              size: 20,
              color: s.contains(WidgetState.selected)
                  ? scheme.primary
                  : scheme.onSurfaceVariant,
            )),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => GoogleFonts.inter(
              fontSize: 10,
              fontWeight: s.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
              color: s.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant,
              fontFamilyFallback: kIndicFallback,
            )),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.rLg),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: GoogleFonts.inter(color: scheme.onInverseSurface, fontSize: 14),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.rMd),
        behavior: SnackBarBehavior.floating,
      ),

      dividerTheme: DividerThemeData(
        color: scheme.outline.withOpacity(0.6),
        thickness: 1,
        space: 1,
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: AppRadius.rSm,
          border: Border.all(color: scheme.outline),
        ),
        textStyle: GoogleFonts.inter(fontSize: 12, color: scheme.onSurface),
      ),

      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      }),
    );
  }

  /// Outfit (display/headline/title) + Inter (body/label). Pass isIndic:true
  /// when the active locale uses an Indic script to raise line-heights so
  /// matras/ascenders/descenders never clip (mirrors web `.indic-text`).
  static TextTheme _textTheme(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    final onV = s.onSurfaceVariant;
    double h(double latin, double indic) => isIndic ? indic : latin;

    TextStyle head(double size, FontWeight w, double lh, {Color? c, double ls = 0}) =>
        GoogleFonts.outfit(
          fontSize: size, fontWeight: w, height: lh, letterSpacing: ls,
          color: c ?? onS, fontFamilyFallback: kIndicFallback,
        );
    TextStyle body(double size, FontWeight w, double lh, {Color? c, double ls = 0}) =>
        GoogleFonts.inter(
          fontSize: size, fontWeight: w, height: lh, letterSpacing: ls,
          color: c ?? onS, fontFamilyFallback: kIndicFallback,
        );

    return TextTheme(
      displayLarge:  head(36, FontWeight.w800, h(1.4, 1.45)),
      displayMedium: head(30, FontWeight.w700, h(1.4, 1.45)),
      displaySmall:  head(24, FontWeight.w700, h(1.4, 1.45)),
      headlineLarge: head(30, FontWeight.w700, h(1.4, 1.45)),
      headlineMedium:head(24, FontWeight.w600, h(1.4, 1.45)),
      headlineSmall: head(20, FontWeight.w600, h(1.4, 1.45)),
      titleLarge:    head(20, FontWeight.w600, h(1.35, 1.45), ls: -0.2),
      titleMedium:   head(18, FontWeight.w600, h(1.4, 1.5)),
      titleSmall:    head(14, FontWeight.w600, h(1.4, 1.5), ls: 0.6), // section-title (uppercase in widget)
      bodyLarge:     body(16, FontWeight.w500, h(1.6, 1.7)),
      bodyMedium:    body(14, FontWeight.w400, h(1.6, 1.7), c: onS),
      bodySmall:     body(12, FontWeight.w400, h(1.5, 1.7), c: onV),
      labelLarge:    body(14, FontWeight.w500, h(1.4, 1.5)),  // button text
      labelMedium:   body(12, FontWeight.w500, h(1.4, 1.5)),
      labelSmall:    body(12, FontWeight.w500, h(1.4, 1.5), ls: 0.5), // caption (uppercase in widget)
    );
  }

  /// Rebuild the theme's TextTheme for an Indic locale (raised line-heights).
  static ThemeData withIndic(ThemeData base) =>
      base.copyWith(textTheme: _textTheme(base.colorScheme, isIndic: true));
}
```

Usage:
```dart
void main() {
  warmIndicFonts(); // register Noto families before use as fallbacks
  runApp(MaterialApp(
    theme: AppTheme.light(),
    darkTheme: AppTheme.dark(),
    themeMode: ThemeMode.system, // web uses next-themes class toggle; mirror with a controller
  ));
}
// When user selects an Indic language:
//   final t = AppTheme.withIndic(Theme.of(context));  // or rebuild via provider
```

`pubspec.yaml` deps: `google_fonts: ^6.2.1`, `lucide_icons: ^0.257.0` (or `lucide_flutter`) for the exact Home/Sparkles/Library/User bottom-nav glyphs.

---

## 8. Fidelity checklist (why the predecessor's layout can't repeat)

- [ ] `primary` = `#E0924D` everywhere, **not** `#FF9933` (§0). Search for stray `#FF9933`.
- [ ] Cards/menus set `surfaceTintColor: transparent` — M3's default saffron tint on elevated surfaces is the #1 "why is everything slightly orange" bug.
- [ ] `scaffoldBackgroundColor` = `background` token (`#FEFEFD`/`#13151B`), not `surface`.
- [ ] Buttons ≥ 48dp, radius 10; cards radius 12 — two different radii, on purpose.
- [ ] Every `TextStyle.height ≥ 1.4`; Indic locales use `AppTheme.withIndic`.
- [ ] `fontFamilyFallback: kIndicFallback` on every custom TextStyle, and `warmIndicFonts()` called at startup.
- [ ] Bottom nav: 56dp, transparent indicator, saffron active icon+label, Lucide glyphs, 10px labels.
- [ ] AppBar is surface-colored with saffron accents, not a saffron fill.
- [ ] Dark `accent` (`#2B303B`) is a neutral hover surface, not navy.
