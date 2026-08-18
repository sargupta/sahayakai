# PREMIUM_DESIGN_SPEC.md — SahayakAI Flutter (LOCKED, single source of truth)

**Status:** LOCKED · **Phase:** design-foundation · **Supersedes:** the flat-white token
tables in `DESIGN_RUBRIC.md §0` and `THEME_SPEC.md §2/§7` for all presentation values.
**Scope:** presentation layer only — `lib/core/theme/`, `lib/shared/widgets/`, and screen
composition. All functional wiring (providers, routes, controllers, models, DTOs) and the
**747 behavior tests survive** — this is a re-skin. Golden image tests re-baseline (that is
what a re-skin is); logic/widget-behavior tests do not change.

This document is the synthesis of the five directions (`DIRECTION_brand`, `DIRECTION_color`,
`DIRECTION_type`, `DIRECTION_motion`, `DIRECTION_components`) resolved through three critic
lenses:
- **Taste** — the winning look is **"The Ledger · Ivory & Ink, Saffron & Pine."**
- **A11y / Indic** — every text pairing states a measured WCAG AA ratio; 11-script Noto
  coverage with line-height floors; ≥48dp targets; Lucide-only (no emoji); teacher dignity.
  Nothing that breaks AA / Indic / 48dp / dignity ships.
- **Feasibility** — leverage order is **theme + shared-widget re-skin first** (everything
  transforms at once because the M3 slots and widget APIs are preserved), **then the hero
  screens**, then the long tail.

Buildable today on Material 3 + `google_fonts` + `lucide_icons` (all present) +
`flutter_animate ^4.5.0` (one new, sanctioned dependency) + `shimmer ^3.0.0` (already a dep).

---

## 1. THE CONCEPT

SahayakAI should feel like a **beautifully bound institutional almanac from a heritage
school** — warm ivory paper, warm charcoal ink, one editorial serif masthead, hairline ruled
registers, real sheets that lift off the page with soft warm-tinted shadows, and a single
saffron wax-seal that authenticates the work. The teacher is a professional whose craft is
being *recorded, composed, and sealed* — not a user filling a form. The register is composed,
warm, authoritative, unhurried: the confidence of a principal's office. Premium here is
**restraint plus a few authored moments** — a paper ground instead of clinical white, a serif
where it earns gravitas, saffron as scarcity (< 10% of any screen), depth via two-layer
shadows, and three signature motions (the Seal on splash, the Almanac home, Inking the Page
on result). Pine and indigo-ink give the palette a grown-up spread so it never reads as "M3 +
one orange button."

---

## 2. COLOR & SURFACE (LOCKED — supersedes the flat-white system)

Canonical palette: **Ivory & Ink · Saffron & Pine.** Warm-paper light, warm-espresso dark, a
real 5-level warm-tinted elevation system, a 3-note accent story (deep saffron primary · deep
pine secondary · indigo-ink tertiary). Field names in `AppColors` are unchanged so the
`ColorScheme` mapping and 747 tests compile as-is; values change, a few tokens are additive.

### 2.1 Light — "Ivory"

| Role / token | Hex | Use | Contrast (measured) |
|---|---|---|---|
| `lBackground` (paper scaffold) | `#F3EEE4` | app background | ink on it 14.1:1 ✓ |
| `lCard` | `#FFFCF8` | resting card / list tile | lift 1.13:1 over paper (visible) |
| `lSurfaceContainerLow` | `#FBF6EE` | grouped block, input fill | structural |
| `lPopover` (highest) | `#FFFFFF` | dialogs, menus | pops hardest |
| `lMuted` (sunken well) | `#ECE6DA` | muted chips, sunken groups | structural |
| `lSurfaceContainerHigh` | `#E4DCCC` | active/hover neutral fill | structural |
| `lForeground` (ink) | `#232019` | primary text | **15.9:1** on card / **14.1:1** on paper ✓ |
| `lMutedForeground` | `#6B6157` | secondary text, hints | **5.9:1** on card / **5.2:1** on paper ✓ AA |
| `lPrimary` (saffron FILL/CTA) | `#C2410C` | filled buttons, focus ring, active | white label on fill **5.18:1** ✓ |
| `lPrimaryText` (saffron TEXT/ICON) *(additive)* | `#A8380A` | saffron text, eyebrows, links-in-context, glyphs | **6.4:1** card / **5.6:1** paper ✓ |
| `lOnPrimary` | `#FFFFFF` | label on saffron fill | 5.18:1 ✓ |
| `lPrimaryContainer` | `#FBEEE2` | saffron-tinted well / selected chip | — |
| `lOnPrimaryContainer` | `#8B330E` | text/icon in the tint | **~7.9:1** ✓ |
| `lSecondary` (deep pine) | `#12554A` | success, secondary CTA, category | text on card **8.5:1** / white on fill **8.7:1** ✓ |
| `lSecondaryContainer` | `#E1EEE9` | pine tint well | — |
| `lOnSecondaryContainer` | `#0C3E36` | text in pine tint | ✓ high |
| `lTertiary` (indigo-ink) | `#22346B` | rare depth accent, info | white on fill **11.9:1** ✓ |
| `lError` | `#C0342B` | destructive (warmed) | white on fill **5.0:1** ✓ |
| `lBorder` | `#E7E0D4` | card outline, dividers (warm hairline) | decorative |
| `lInput` | `#DCD3C4` | input enabled border | decorative |
| `lOutlineVariant` | `#EFE9DE` | subtle internal dividers, ruled registers | decorative |
| `lRing` | `#C2410C` | focus ring (2px) | >3:1 non-text ✓ |
| `brandBrass` *(additive, decorative ONLY)* | `#B08D57` | seal ring, ornament hairlines — **never text/small icon** | exempt |
| `brandSaffron` *(additive, large decorative ONLY)* | `#FF9933` | splash seal fill, logo mark — **never behind small text** (2.13:1) | exempt |
| `lShadowBase` *(additive)* | `#3A2E1E` | warm brown-black base for light shadows | shadow only |

**Two saffron tokens, one rule:** saffron **fills/CTAs** use `#C2410C` (white label 5.18:1);
saffron **text/icons/eyebrows** use `#A8380A` (clears 4.5:1 on paper and card). Vivid
`#FF9933` is `brandSaffron`, large decorative only. This is the founder-approved accessible
split (locked by `test/core/theme/theme_contrast_test.dart`) — do not regress it.

### 2.2 Dark — "Warm Espresso, lit from above"

| Role / token | Hex | Use | Contrast (measured) |
|---|---|---|---|
| `dBackground` (base) | `#17130E` | scaffold — warm near-black espresso | — |
| `dSurfaceContainerLow` | `#1C1811` | sunken wells | — |
| `dCard` | `#221D16` | resting card | — |
| `dPopover` (raised) | `#2A241B` | raised cards, menus, popovers | — |
| `dSurfaceContainerHigh` | `#332B20` | active/hover, highest | — |
| `dMuted` | `#241F17` | muted chip / sunken group | — |
| `dForeground` (ivory) | `#F5EFE6` | primary text | **14.6:1** on card ✓ |
| `dMutedForeground` | `#A89A86` | secondary text | **6.1:1** on card ✓ |
| `dPrimary` (candlelit saffron) | `#F6A959` | CTA fill **and** saffron text | text on card **8.6:1** ✓ |
| `dOnPrimary` | `#231200` | label on saffron fill | **9.3:1** ✓ (fixes the white-on-bright dark-button bug) |
| `dPrimaryContainer` | `#2E2417` | saffron-tinted well / selected chip | — |
| `dOnPrimaryContainer` | `#F6A959` | text in the tint | **~7.4:1** ✓ |
| `dSecondary` (bright pine) | `#4FB3A2` | secondary / success / category | text on card **6.6:1** ✓ |
| `dSecondaryContainer` | `#1E3A34` | pine tint well | — |
| `dOnSecondaryContainer` | `#B7E4DA` | text in pine tint | ✓ |
| `dTertiary` (soft indigo) | `#8DA4E0` | rare depth/info | on card ✓ high |
| `dError` | `#E0645A` | destructive | text on card ✓ |
| `dBorder` | `#3A3226` | card outline, dividers | decorative |
| `dInput` | `#453B2C` | input border | decorative |
| `dOutlineVariant` | `#2C261D` | subtle dividers | decorative |
| `dRing` | `#F6A959` | focus ring | ✓ |
| `brandBrass` (dark ornament) | `#8A6E43` | seal ring, ornaments | exempt |

Warm espresso, not cold slate. Saffron warmed from neon to candlelit `#F6A959` so the CTA
reads brass/amber, not fluorescent.

### 2.3 Elevation & shadow — the depth engine (LOCKED)

Five levels. **Light = warm-tinted two-layer shadows** (pure black on warm paper looks
dirty). **Dark = surface steps + a 1px top highlight + black key shadow only where things
float.** `cardTheme.elevation` stays `0` in `ThemeData` (`surfaceTintColor: transparent`);
draw these on the widget's own `Container`/`DecoratedBox` (Material tonal elevation cannot
express two layers). Live in `lib/core/theme/app_shadows.dart` (exempt from token_guard).

```dart
class AppShadows {
  AppShadows._();
  static const _l = AppColors.lShadowBase; // warm brown-black #3A2E1E

  // e1 — resting card / list tile / input
  static final List<BoxShadow> e1 = [
    BoxShadow(color: _l.withValues(alpha: 0.04), offset: const Offset(0, 1), blurRadius: 3),
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 2), blurRadius: 6, spreadRadius: -1),
  ];
  // e2 — raised / hover / the one focal card / result masthead
  static final List<BoxShadow> e2 = [
    BoxShadow(color: _l.withValues(alpha: 0.05), offset: const Offset(0, 2), blurRadius: 6),
    BoxShadow(color: _l.withValues(alpha: 0.09), offset: const Offset(0, 8), blurRadius: 20, spreadRadius: -4),
  ];
  // e3 — dialog / menu / floating CTA bar / floating nav
  static final List<BoxShadow> e3 = [
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 4),  blurRadius: 10),
    BoxShadow(color: _l.withValues(alpha: 0.14), offset: const Offset(0, 16), blurRadius: 40, spreadRadius: -8),
  ];
  // e4 — bottom sheet / modal
  static final List<BoxShadow> e4 = [
    BoxShadow(color: _l.withValues(alpha: 0.08), offset: const Offset(0, 8),  blurRadius: 16),
    BoxShadow(color: _l.withValues(alpha: 0.20), offset: const Offset(0, 28), blurRadius: 64, spreadRadius: -12),
  ];

  // Dark: floating key shadow (sheets/dialogs only) + 1px top highlight border.
  static final List<BoxShadow> dKey = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: const Offset(0, 16), blurRadius: 48, spreadRadius: -12),
  ];
  static final Border dTopHighlight =
      Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1));

  // Signature saffron glow — CTA only, never repeated. Dark uses candlelit saffron.
  static final List<BoxShadow> ctaGlowLight = [
    BoxShadow(color: const Color(0xFFC2410C).withValues(alpha: 0.22), offset: const Offset(0, 6), blurRadius: 18, spreadRadius: -4),
  ];
  static final List<BoxShadow> dSaffronGlow = [
    BoxShadow(color: const Color(0xFFF6A959).withValues(alpha: 0.18), offset: const Offset(0, 6), blurRadius: 24, spreadRadius: -6),
  ];

  // Back-compat aliases so existing call sites keep compiling during migration:
  static final List<BoxShadow> soft = e1;
  static final List<BoxShadow> elevated = e2;
  static final List<BoxShadow> floating = e3;
}
```

Elevation → component map: e0 scaffold/flush rows · e1 resting cards/tool tiles/inputs · e2
the one focal "continue" card, hovered/pressed cards, result masthead · e3 menus, dialogs,
floating CTA bar, floating nav · e4 bottom sheets, modals. Dark adds `dTopHighlight` on every
raised surface and `dKey` on e3/e4.

### 2.4 Gradients & texture — barely-there (LOCKED sanctioned set)

Additive `lib/core/theme/app_gradients.dart`. **Banned:** mesh gradients, glassmorphism blur
panels, gradient-filled text, multi-stop rainbow, any gradient behind body text. If a
gradient is noticeable at a glance, it is too strong.

```dart
class AppGradients {
  AppGradients._();
  static const lightPaper = LinearGradient(         // 3% vertical warm wash, scaffold body
    begin: Alignment.topCenter, end: Alignment.bottomCenter,
    colors: [Color(0xFFFBF7F0), Color(0xFFF1EADD)]);
  static const lightHeroWash = RadialGradient(      // 8%→0% saffron top-right corner, hero only
    center: Alignment(1.0, -1.0), radius: 1.2,
    colors: [Color(0x14C2410C), Color(0x00C2410C)]);
  static const darkVignette = RadialGradient(       // warm center-top → darker edges
    center: Alignment(0.0, -0.6), radius: 1.4,
    colors: [Color(0xFF1E1811), Color(0xFF140F09)]);
  static const accentBar = LinearGradient(          // 3px saffron ribbon: primary → primary@0
    colors: [Color(0xFFC2410C), Color(0x00C2410C)]);
}
```

Paint `lightPaper`/`darkVignette` as a `DecoratedBox` behind scaffold content, never as
`scaffoldBackgroundColor` (must stay a solid `Color`). `lightHeroWash` only on the dashboard
hero and marketing/onboarding, never behind dense content.

---

## 3. TYPOGRAPHY (LOCKED)

**Two families, one Indic-safe dual-fallback strategy. Outfit is retired.** Fraunces
(editorial serif) carries every brand/human/masthead moment; Inter carries all functional
UI, body, labels, and data. Register contrast (serif↔sans) is the single biggest prestige
lever. The 15 M3 `TextTheme` slot names are preserved, so every current widget and all 747
tests inherit the new look for free; editorial extras are additive opt-ins exposed via a
`ThemeExtension<AppTextExtras>` built on the same `scheme`/`isIndic` path as `AppTheme`.

### 3.1 Families & weights
- **Fraunces** — `GoogleFonts.fraunces(...)`, weights **400 / 500 / 600 only** (never heavier;
  high-contrast serifs get muddy and bloom on OLED above 600). Italic 400 for rare editorial
  accent words (never full Indic sentences).
- **Inter** — `GoogleFonts.inter(...)`, weights 400/500/600/700, with `tabularFigures()` +
  `liningFigures()` for data.
- Code/monospace — platform monospace, unchanged.

### 3.2 Indic fallback plan (mandatory, 9 scripts, serif↔serif / sans↔sans)
Flutter does not fall back by script unless `fontFamilyFallback` is supplied. Two parallel
chains keep register consistent when a string switches script (Hinglish or a full Indic
locale): serif Latin → **Noto Serif** per script; sans Latin → **Noto Sans** per script.

```dart
const kIndicSerifFallback = [ // Fraunces styles
  'Noto Serif Devanagari','Noto Serif Bengali','Noto Serif Tamil','Noto Serif Telugu',
  'Noto Serif Kannada','Noto Serif Malayalam','Noto Serif Gujarati','Noto Serif Gurmukhi','Noto Serif Oriya'];
const kIndicSansFallback = [ // Inter styles
  'Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Tamil','Noto Sans Telugu',
  'Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Gujarati','Noto Sans Gurmukhi','Noto Sans Oriya'];
const kIndicFallback = kIndicSansFallback; // back-compat alias
```

Extend `warmIndicFonts()` to warm **all 20 families** (Inter, Fraunces, 9 Noto Sans, 9 Noto
Serif) once at startup before any is used as a fallback. If a serif ever fails to resolve for
a script the chain degrades to Noto Sans / Inter — never a tofu box. **Line-height floor is
absolute: no style `height < 1.4`;** Indic clamps: serif display ≥ 1.32, serif titles ≥ 1.42,
body ≥ 1.70 (per-slot Indic column below), preserving the `.indic-text` no-clipped-matra
guarantee across all 9 Noto Serif + 9 Noto Sans scripts.

### 3.3 The scale (exact — `sp`/logical px; `ls` absolute logical px; Latin / Indic height)

Editorial serif — **Fraunces** (mapped into M3 slots):
| Slot (M3 / extra) | Use | Size | Weight | ls | h Latin | h Indic |
|---|---|--:|--:|--|--:|--:|
| `displayHero` *(extra)* | login/onboarding hero | 40 | 600 | −0.8 | 1.12 | 1.32 |
| `displayLarge` | page hero ("Welcome back") | 32 | 600 | −0.5 | 1.15 | 1.32 |
| `displayMedium` / `headlineLarge` | section hero / result title | 26 | 600 | −0.4 | 1.20 | 1.35 |
| `displaySmall` | sub-hero / empty-state headline | 22 | 500 | −0.3 | 1.25 | 1.40 |
| `titleLarge` | card title, app-bar masthead | 21 | 600 | −0.2 | 1.25 | 1.42 |

Grotesque structure & body — **Inter**:
| Slot (M3 / extra) | Use | Size | Weight | ls | h Latin | h Indic |
|---|---|--:|--:|--|--:|--:|
| `headlineMedium` | functional heading (serif too much) | 20 | 600 | −0.2 | 1.30 | 1.45 |
| `headlineSmall` | sub-section heading | 18 | 600 | −0.1 | 1.35 | 1.50 |
| `titleMedium` | dense list-row title, dialog title | 16 | 600 | 0 | 1.40 | 1.50 |
| `titleSmall` | inline strong label | 14 | 600 | +0.2 | 1.40 | 1.50 |
| `lead` *(extra)* | deck/standfirst under a hero | 17 | 400 | 0 | 1.50 | 1.65 |
| `bodyLarge` | primary reading copy | 16 | 400 | 0 | 1.60 | 1.75 |
| `bodyMedium` | default UI body, card subtitle | 14 | 400 | 0 | 1.55 | 1.70 |
| `bodySmall` | fine print, helper (muted) | 13 | 400 | 0 | 1.50 | 1.70 |
| `labelLarge` | button text | 15 | 600 | +0.1 | 1.30 | 1.45 |
| `labelMedium` | chip, nav label | 13 | 500 | +0.1 | 1.40 | 1.50 |
| `labelSmall` | micro-label | 12 | 500 | +0.2 | 1.40 | 1.50 |
| `eyebrow` *(extra)* | section label ("YOUR TEACHING TOOLS") | 12 | 700 | +1.2 UPPERCASE¹ | 1.40 | 1.50 |
| `overline` *(extra)* | micro-meta ("OPTIONAL", category) | 12 | 600 | +0.8 UPPERCASE¹ | 1.40 | 1.50 |
| `dataLarge` *(extra)* | big number moment (score, count) | 28 | 600 (**Fraunces**) | −0.3 | 1.10 tabular | — |
| `dataMedium` *(extra)* | inline data ("0 / 1000", "Class 12") | 15 | 500 (Inter, tabular) | 0 | 1.40 | 1.40 |

¹ **Eyebrow/overline color = saffron `lPrimaryText #A8380A` / dark `#F6A959`.** Uppercase is
**Latin only** — the eyebrow widget skips `toUpperCase()` for Indic (unicameral scripts) and
leans on tracking + saffron. `dataLarge` uses Fraunces (a serif numeral reads like a diploma);
`dataMedium` uses Inter with `[FontFeature.tabularFigures(), FontFeature.liningFigures()]` so
counters never reflow. `12sp` is the absolute minimum anywhere teacher-facing.

### 3.4 Editorial rhythm
Section blocks separated by **32dp**; hero→deck 12dp; deck→first section 28dp; page hero sits
**40dp** below the app bar (quiet-luxury top margin). Cards: internal padding 20dp, title→
subtitle 6dp. Every group gets an **EditorialSectionHeader**: saffron eyebrow + a 1px
`outlineVariant` hairline rule running from the eyebrow to the right margin. Heroes are
**left-aligned** serif + `lead` deck, not centered. Reading columns cap at ~60–66 chars
(`ConstrainedBox(maxWidth: 640)`, already enforced by `ToolScaffold`).

---

## 4. MOTION (LOCKED)

**Curve family = exactly three** (relaxes the old single-curve rubric rule — see §6.G).
Durations add two slots. Everything degrades to an instant/cross-fade when
`MediaQuery.disableAnimations` is true. Animate only `opacity` / `transform` (scale/translate)
/ pre-tuned `BoxShadow`+color — never `width`/`height`/`padding` inside a stagger. Lives in
`lib/core/theme/app_motion.dart` (exempt).

```dart
class AppMotion {
  AppMotion._();
  // Durations
  static const Duration instant = Duration(milliseconds: 120); // color/opacity only
  static const Duration micro   = Duration(milliseconds: 160); // tap depress, focus, hover
  static const Duration small   = Duration(milliseconds: 240); // reveal, dropdown, chip select
  static const Duration medium  = Duration(milliseconds: 320); // page, dialog, sheet, result card
  static const Duration large   = Duration(milliseconds: 420); // hero / splash element (single)
  static const Duration stagger = Duration(milliseconds: 55);  // per-item entrance offset
  // Curves — the WHOLE sanctioned set (lint/guard bans any Cubic/Curves.* outside these three)
  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.30, 1.0); // canonical decelerate — entrances, reveals, settle
  static const Cubic emphasized   = Cubic(0.20, 0.00, 0.00, 1.0); // page/sheet/result — travels distance
  static const Cubic standard     = Cubic(0.40, 0.00, 0.20, 1.0); // reversible/symmetric — theme cross-fade, toggle
}
```

Per-interaction assignment:
| Interaction | Duration | Curve | Mechanism |
|---|---|---|---|
| Tap depress (buttons, cards, chips, rows) | micro 160 | easeOutQuart | `PressableScale` → `AnimatedScale` 1.0→0.98 on tapDown, keep M3 ink underneath |
| Focus ring / input border | micro 160 | standard | `AnimatedContainer` border 1→2px + `lRing` + 3px focus glow |
| Chip select / toggle | small 240 | easeOutQuart | `AnimatedContainer` fill+border cross-fade, 1.0→1.04→1.0 settle |
| List / card entrance | small 240 + stagger 55 | easeOutQuart | `flutter_animate` `.fadeIn().slideY(12→0)`, cap 8 items, once per mount |
| Dropdown / accordion reveal | small 240 | easeOutQuart | `AnimatedSize`/`AnimatedSwitcher` (never inside a list stagger) |
| Page push / pop | medium 320 | emphasized | `LiftSettleTransitionsBuilder`: slideX +0.06→0 + fade + scale 0.985→1; outgoing recedes to 0.99/0.85 |
| Bottom-nav tab switch | small 240 | standard | `AnimatedSwitcher` cross-fade (peers don't slide) + fresh content stagger; active icon 1.0→1.08 + color, micro |
| Dialog / bottom sheet | medium 320 | emphasized | route transition |
| Skeleton → content | small 240 | easeOutQuart | `AnimatedSwitcher` cross-fade |
| Shimmer sweep | 1200 loop | (linear texture) | `shimmer` — indeterminate progress, carve-out from the no-linear rule |
| Result reveal (hero) | medium 320 + stagger | emphasized | §7 "Inking the Page" sequence |
| Segmented thumb | small 240 | easeOutQuart | sliding thumb |
| Theme light↔dark | medium 320 | standard | `AnimatedTheme` |
| Splash Seal + underline draw | large 420 ×2 | easeOutQuart | §Splash |

**Signature reveal — "Ink-settle" (`inkSettle`)**: each result block `fadeIn` + `moveY 8→0`,
350ms `easeOutQuart`, 40–55ms stagger per block; the document assembles itself. **Splash "The
Seal":** saffron monogram presses in `scale 0.92→1.0` + `fade`, then an ink underline **draws
left-to-right** (`width 0→full`) — the signature of authorship — then the wordmark rises;
route-out cross-fades with the mark's final geometry matching the login header (poor-man's
hero). **Reduce-motion:** show the final composed frame, hold, cross-fade only.

---

## 5. COMPONENTS (exact Flutter specs)

One card grammar, one button family, re-skinned in place — public APIs preserved so tests and
call sites survive. Radius: **`card = 16`, `control = 12`, `sm = 8`, `well = 14`, `hero = 20`,
`pill = StadiumBorder`** (adds `card`/`control` semantic aliases + `well = 14`; §6.F).

- **AppCard v2** (keystone). Radius `card` 16, fill `surface`, 1px `outline` border, shadow
  `e1` (rest) → `e2` (press/hover when `onTap != null`). Dark adds a 1px top `#FFFFFF@0.05`
  catch-light. Variants: `flat` (border + e1, default) · `elevated` (e2, no border — feature
  tile, result masthead) · `inset` (no shadow, `surfaceContainerLow` fill, 1px border — nested
  panels read as recession). Optional 3px `accentBar` gradient on the top edge (top corners
  clipped). Press: `PressableScale` 0.98 + e1→e2. Padding 16 phone / 24 tablet (≥600dp).
- **Buttons.** `PrimaryButton v2`: height 56, full-width, radius `control` 12, fill `primary`,
  label `labelLarge` `onPrimary`; `ctaGlowLight` (light) / `dSaffronGlow` (dark) so the CTA
  reads lit; press scale 0.97 + glow tightens; busy = inline 20dp `onPrimary` spinner (width
  holds); disabled `primary@0.38` fill. **Solid fill only — no fill gradient** (a two-stop
  saffron gradient fails white-label AA on the lighter stop). `SecondaryButton` (wraps
  OutlinedButton): 52dp, radius 12, transparent fill, 1.5px `primary` border, `lPrimaryText`
  label (5.6:1 on paper ✓). `Ghost`: `lPrimaryText` label, no fill, ≥44dp.
- **Input / LabeledField v2.** `filled: true`, `fillColor: surfaceContainerLow`, radius 12,
  content padding 16/16 (~56dp height), enabled border 1px `outlineVariant`, **focus 2px
  `lRing` + `primary@0.14` glow (spread 3), 160ms**. Optional leading Lucide glyph (20dp
  `onSurfaceVariant`) for long forms. Char counter → `dataMedium` tabular, right-aligned. Hint
  `onSurfaceVariant`. Error 2px `error` + `bodySmall` error text. Text roles unchanged (Indic
  safe).
- **Chip (choice / grade levels).** Rest: `surfaceContainerHigh` fill, `outline` 1px,
  `labelMedium` `onSurface`. Selected: `primaryContainer` fill, 1.5px `primary` border, label
  `onPrimaryContainer` w600 (`#8B330E` on `#FBEEE2` ≈ 7.9:1 / dark `#F6A959` on `#2E2417`
  ≈ 7.4:1 ✓), no checkmark (border+fill suffice; keep `Semantics(selected:)`). ≥48dp tap row.
- **AppSegmented (new).** For binary/tertiary choices. `surfaceContainerHigh` track radius 12,
  sliding `surface` thumb with `e1` + 1px border (240ms easeOutQuart), selected label
  `onSurface` w600 / unselected `onSurfaceVariant`, each segment ≥48dp, `labelLarge`. Falls
  back to a wrapped chip row when >3 options or long/Indic labels (never clips).
- **App bar (dashboard).** Transparent/seamless: `elevation 0`, `scrolledUnderElevation` shows
  `e1` only when content scrolls under. Leading = SahayakAI Seal mini (28dp), title = wordmark
  `titleLarge` (serif masthead), trailing = Me/avatar. Deliberately quiet chrome; the hero
  owns the top.
- **Dashboard hero header (the Almanac).** A scroll item (not the AppBar), so it moves away as
  the teacher works: saffron **eyebrow** = date · school (`TUESDAY · DELHI PUBLIC SCHOOL`),
  serif greeting `displayLarge`/`displayMedium` (name in `onSurface`, never gradient text),
  an **almanac date line** (`dataMedium`/`almanacNumeral`), a 2px×48dp saffron rule under the
  greeting, then the `EditorialSectionHeader` eyebrow "YOUR TEACHING TOOLS". Optional real-data
  summary strip ("3 lessons this week · 12 saved"), hidden when zero. Time-aware greeting via 3
  new l10n keys across all 11 languages.
- **Bottom nav — floating.** Inset floated bar (radius 20, `surface`, `e3`, 1px `outline`),
  height 56 + safe inset. Active pill = `primary@0.12` stadium behind the active icon (240ms
  slide+fade), active icon `primary` scaled 1.08 (160ms), inactive `onSurfaceVariant`, label
  `labelMedium` (≥12sp, 600 active). Lucide glyphs Home/Sparkles/Library/User; Create is an
  action (opens palette), never shows the active pill.
- **Tool tile.** First `kToolRegistry` entry → **feature tile** (`AppCard(elevated)`, large
  64dp gradient IconWell, `titleLarge` name, `bodyMedium` subtitle, "Open" + `chevronRight`,
  3px accent bar). Remaining → **refined rows** (`AppCard(flat)` + IconWell v2 + `titleMedium`
  + `bodyMedium` muted + 32dp `surfaceContainerHigh` circular chevron). **IconWell v2:** 48dp
  (or 64dp feature), radius `well` 14, diagonal `LinearGradient([primary@0.16, primary@0.06])`,
  1px `primary@0.22` inner border, 20dp (28dp feature) Lucide glyph in `primary`. Optional 3px
  left category spine rotating saffron→pine→indigo turns the monotone list into rhythm.
- **Empty state — `EmptyView v2`.** Left-aligned (rubric §11, no centered hero stack). A 72dp
  **haloed glyph** (`primary@0.06` outer / `primary@0.12` inner, 28dp Lucide `primary`) +
  optional `titleMedium` title + `bodyLarge` muted message (≤2 lines, dignified copy assuming
  competence) + a `SecondaryButton` next step. One entrance (fade + scale 0.92→1.0, 320ms) then
  a barely-perceptible 3000ms opacity breathe; reduce-motion → static frame.
- **Result-document — `DocumentSheet` (new shared widget).** The premium payoff: a generated
  artifact reads like a printed document, not a chat dump. `AppCard(elevated)` radius 16, e2,
  padding 24 phone / 32 tablet, 3px saffron accent bar + hairline `outlineVariant` page edge,
  max reading width 640. **Masthead:** saffron eyebrow doc-type ("LESSON PLAN · 5E MODEL"),
  title `displaySmall`/`displayMedium` (Fraunces), 2px saffron→transparent rule, meta badges in
  a `Wrap` (accent tone on the primary tag). **Section headers:** `titleSmall` UPPERCASE
  preceded by a 4dp saffron tick; 24dp between sections. **Body:** unchanged `AiText`
  (line-height 1.7, Indic height behavior, soft-wrap) — do not touch; matra-safety guarantee.
  **Numbered items:** `AppCard(inset)` + saffron numeral medallion. **Scorecard:** hero
  `ScoreRing` (`CustomPaint` gauge, track `surfaceContainerHigh`, progress `primary`, center
  score `dataLarge` + `labelSmall` denominator, 350ms sweep) over criteria in `inset` cards.
  Reveal runs the **Ink-settle** sequence; sticky footer action bar (Save `PrimaryButton` /
  Regenerate `SecondaryButton` / Copy ghost, ≥48dp, above the gesture inset).

---

## 6. IMPLEMENTATION PLAN (ordered, for an autonomous loop)

Feasibility leverage order: **(a) theme + shared-widget re-skin transforms everything at once**
(the M3 slots and widget APIs are preserved, so all screens inherit), **(b) hand-craft 3–4
hero screens**, **(c) the long tail.** Branch `develop`, one commit per unit, `git add`
explicit paths only, never push. Universal per-unit acceptance: **`flutter analyze` = 0 issues,
`scripts/token_guard.sh` = PASS, 747 behavior tests green** (goldens re-baseline — expected for
a re-skin; regenerate 360/800dp light+dark with the Indic probe strings), plus each unit's
extra acceptance below.

### (a) Theme + shared-widget re-skin (everything transforms at once)

- **U1 — token layer.** Rewrite `app_colors.dart` (§2.1/2.2 values; additive `lPrimaryText`,
  `lShadowBase`, `brandBrass`, `brandSaffron`, pine, indigo), `app_shadows.dart` (§2.3 e1–e4 +
  dark + glows), new `app_gradients.dart` (§2.4), `app_radius.dart` (add `card=16`,
  `control=12`, `well=14`, `rCard`/`rControl`/`rWell`), `app_motion.dart` (§4 three curves +
  `instant`/`large`/`stagger`). **Acceptance:** `theme_contrast_test.dart` still green (the
  accessible saffron split intact); token_guard PASS after the §6.F radius relaxation lands.
- **U2 — type system + theme wiring.** Rewrite `app_text.dart` (§3: Fraunces+Inter,
  dual-fallback chains, `warmIndicFonts()` warms 20 families, `AppText.build` maps the 15 M3
  slots, additive `displayHero`/`lead`/`eyebrow`/`overline`/`dataLarge`/`dataMedium`), add
  `AppTextExtras` `ThemeExtension` built on the same `scheme`/`isIndic` path in `app_theme.dart`
  (so `AppTheme.withIndic` keeps extras in sync). Wire `app_theme.dart`: `cardTheme.elevation
  0` + `surfaceTintColor transparent`, `inputDecorationTheme` (filled + focus glow), chip
  selected theme, appbar `titleTextStyle: titleLarge` (now serif), scaffold gradient DecoratedBox.
  **Acceptance:** Indic line-height clamp verified against the §11 Bengali/Tamil/Malayalam probes
  (zero clipped matras) in a golden; Outfit fully removed.
- **U3 — shared widgets re-skin.** `app_card.dart` (variants + PressableScale + dark
  catch-light), `icon_well.dart` (gradient v2), `primary_button.dart` (glow/press), new
  `press_scale.dart`, `secondary_button.dart`, `app_segmented.dart`, `empty_view.dart` (halo),
  `labeled_field.dart` (leading glyph + tabular counter), new `editorial_section_header.dart`
  (eyebrow + hairline), `section_label.dart` (saffron tick), `app_skeleton.dart` wired through
  `result_view.dart`'s loading branch (shimmer, mirrors real shape), new `document_sheet.dart`
  + `score_ring.dart`. **Acceptance:** existing widget tests green (APIs preserved); add golden
  coverage for the 6 new/changed widgets at 360/800 light+dark.
- **U4 — motion infrastructure.** Add `flutter_animate ^4.5.0` to `pubspec.yaml`; new
  `lib/shared/motion/lift_settle_transitions.dart` (page transition, wired in `app_theme.dart`
  for both platforms, `PredictiveBack` kept only for Android's OS-driven back), new
  `animated_entrance.dart` (`staggeredItem`, one-shot, cap 8), new `inkSettle` helper, and a
  `context.motionEnabled` reduce-motion helper every animation site checks. **Acceptance:**
  reduce-motion golden = final composed frame (no tween); no animated layout properties.

### (b) Hero screens — hand-crafted first (the wow moments)

- **U5 — Splash "The Seal"** (`splash_screen.dart`). Ivory ground, saffron monogram seal
  press-in + ink-underline draw + wordmark rise; route-out cross-fade with matched mark
  geometry; first-class error/retry state retained. **Acceptance:** reduce-motion path renders
  composed frame; no regression to the existing bootstrap-error retry.
- **U6 — Login / Onboarding** (`login_screen.dart`). Ivory sheet `AppCard`, `displayHero`
  masthead + `lead` deck (left-aligned, 2dp×32dp saffron kicker), value props as a hairline
  ruled list (not saffron bullets), one `PrimaryButton`, `EditorialSectionHeader` over the
  language picker. Stub-auth flip unchanged; language picker keeps all 11 native labels.
- **U7 — Dashboard "The Almanac"** (`dashboard_screen.dart`). Seamless app bar + hero header
  (§5) + feature tile + refined-row register with the ink-settle stagger; 3 new time-aware
  greeting l10n keys across all 11 languages. **Acceptance:** real routing/recent-list states
  (skeleton/empty/error/401) preserved; saffron surface < 10%.
- **U8 — one tool + result: Lesson Plan** (`lesson_plan_screen.dart`). Re-skin the form
  (filled inputs, eyebrow section headers, segmented/chips) and wrap the 5E result in
  `DocumentSheet` with the Ink-settle reveal + sticky action bar. This is the reference
  implementation every other tool copies. **Acceptance:** all four states intact; 5E render
  unchanged in content; auto-scroll to result header.

### (c) Remaining screens (copy the U8 pattern)

- **U9** — floating bottom nav + `app_shell.dart` (tab cross-fade + fresh stagger).
- **U10** — remaining P0/P1 tool forms + results wrapped in `DocumentSheet`: Quiz, Instant
  Answer, Worksheet, Rubric (ScoreRing/grid), Exam Paper, Teacher Training, Parent Message,
  Assess Assignment (ScoreRing).
- **U11** — Settings, Profile, My Library (+ detail), Create Palette re-skin.
- **U12** — P2 screens as they are built (Visual Aid, Assessment Scanner, Video Storyteller,
  Virtual Field Trip, Attendance, Demo Call, Community, Impact, Pricing, Notifications) adopt
  the system natively.

### Guard / rubric relaxations (exactly what changed and why)

- **F — `scripts/token_guard.sh` radius allowlist.** Add `14` → allowed `.circular()` set
  becomes **8/10/12/14/16/20**. *Why:* IconWell v2's gradient well uses r14; it is an
  on-scale premium value, not drift. Also update the `DESIGN_RUBRIC §0` radius table with
  `card=16` / `control=12` / `well=14` aliases. No other token_guard code change — gradients,
  shadows, and the three curves all resolve to constants inside `lib/core/theme/` (exempt), and
  the four banned curves (bounce/elastic/linear-on-reveal) stay banned.
- **G — `DESIGN_RUBRIC §0` curve + duration rule.** Replace "the SINGLE canonical curve /
  more than one custom curve = FAIL / >400ms = FAIL" with: **the sanctioned set is exactly the
  three named curves** (`easeOutQuart`, `emphasized`, `standard`); single-element ceiling
  **420ms**; multi-element orchestrations (splash, result reveal) may span **~600ms wall-clock**
  provided each element ≤420ms and input is never blocked >350ms. *Why:* one curve cannot drive
  both a 160ms tap and a 320ms page push convincingly; the emphasized/standard pair is the
  minimum premium motion needs. Bounce/elastic still banned.
- **H — `DESIGN_RUBRIC §0` shadow table.** Replace the flat `.04/.08/.12` grammar and the
  "drop shadows darker than .12 = FAIL" line with the two-layer warm-tinted **e1–e4** system
  (e4 reaches `.20`) + dark 1px top-highlight + the single CTA glow. *Why:* the flat `.04`
  shadow on white is imperceptible — the #1 "cheap utility app" tell.
- **I — `DESIGN_RUBRIC §153` gradient rule.** Expand the sanctioned gradient list beyond the
  accent bar to the §2.4 set (paper wash 3%, hero corner wash 8% saffron, dark vignette, CTA
  glow, ribbon, IconWell tint). *Still banned:* mesh gradients, glassmorphism, gradient-filled
  text, gradient behind body text.
- **J — `DESIGN_RUBRIC §213` palette rule.** Add **pine** (`#12554A`/`#4FB3A2`) and
  **indigo-ink** (`#22346B`/`#8DA4E0`) as sanctioned tertiary accents alongside saffron/green/
  navy. *Still banned:* glassmorphism, purple/indigo "AI-slop" palettes used as primary.
- **K — `DESIGN_RUBRIC §0` color tables + §2 typography.** Supersede the flat-white light and
  blue-black dark tables with the §2 Ivory & Ink / warm-espresso values (+ new named tokens);
  record Fraunces as the editorial display family and mark Outfit retired. *Why:* the tables
  are the "named-token-only" gate's source of truth; the gate must reference the shipped values.

---

## 7. DEFINITION OF PREMIUM DONE (a critic grades rendered screenshots against this)

1. **Paper, not white.** Light screens read as warm ivory with cards visibly floating above
   the ground (real 1.13:1 lift + a soft warm two-layer shadow). No two coplanar whites.
2. **Depth is legible.** Every card casts a gathered, warm, two-layer shadow; the one focal
   card (feature tile / result masthead) sits a clear step higher; dark cards show a top
   catch-light. No hairline-only "wireframe" surfaces.
3. **The serif is present and restrained.** Fraunces carries the wordmark, page/section
   heroes, card titles, and result titles (~3–6 strings/screen); Inter carries everything
   else. Clear serif↔sans register contrast. No Outfit anywhere.
4. **Sections read editorial.** Every group has a saffron tracked-uppercase (Latin) eyebrow +
   a hairline rule — never a weak grey label.
5. **Saffron is scarce and confident.** Saffron surface < 10% of any screen: CTA, active nav,
   focus ring, ribbon, seal, eyebrow. `#C2410C` fills, `#A8380A` text, `#FF9933` only on the
   splash/logo mark. No all-tiles-are-peach tinting; the dark CTA reads brass, not neon.
6. **The three moments land.** Splash presses in the Seal + draws the ink underline; the
   dashboard opens as a composed Almanac (serif greeting + date line + ruled register); a
   result inks in block-by-block onto a `DocumentSheet` — never a chat-bubble dump.
7. **Motion is confident, never playful.** Staggered entrances, press-depress on every
   tappable surface, skeletons (never a bare spinner), the Lift-&-Settle page push, the
   result reveal — all within the 3-curve / ≤420ms (≤600ms orchestration) budget. Reduce-motion
   shows the final frame instantly.
8. **A11y holds under stress.** Every text pair passes WCAG AA (ratios in §2/§3); 48dp targets;
   longest Bengali + Tamil + Malayalam strings render with no clipped matra/conjunct at
   textScale 1.3, 360dp, light + dark; Lucide-only, no emoji; dignified copy.
9. **It looks curated, not generated.** Composed asymmetry, a masthead, a seal, hairline
   discipline, tabular data — a heritage school's headmaster would keep it in their ledger.

---

**File:** `docs/flutter/design/PREMIUM_DESIGN_SPEC.md`
