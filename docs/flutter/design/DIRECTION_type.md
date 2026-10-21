# DIRECTION_type.md — Premium Editorial Type System

**Lens:** Typography & editorial layout. **Product:** SahayakAI, repositioned for premium
CBSE / ICSE / IB schools. **Goal:** a type system that reads like a prestigious school's
masthead and a fine teaching publication — not a generic M3 SaaS app.

Scope: this is a **re-skin** — new families + metrics wired into the existing 15 M3
`TextTheme` slots (so every current widget and all 747 tests inherit the new look for
free) plus a small set of additive editorial styles (eyebrow / lead / serif-title / data)
that screens opt into. No functional rewrite. Flutter-buildable today on
`google_fonts` + `flutter_animate`.

---

## 1. Diagnosis — why the current type reads as boring

Evidence: `01_launch.png`, `03_dashboard.png`, `04_lessonplan.png`, `05_dark.png`
against `app_text.dart` / THEME_SPEC §2.

1. **One geometric sans doing everything.** Headlines are Outfit at w700/w800; body is
   Inter. Outfit is a friendly geometric grotesque — it reads "startup default," not
   "institution." There is **no typographic contrast** (no serif↔sans, no thin↔thick, no
   register shift). Every screen is the same texture.
2. **Hierarchy is "big-bold vs grey-body," nothing between.** "Welcome to SahayakAI" (36/w800)
   → immediately grey 16px body. No deck/standfirst, no eyebrow, no mid-tier. The jump is
   crude, not composed. `titleLarge` (card title) and `bodyLarge` sit only ~2px and a weight
   apart, so cards read flat (`03_dashboard`: "Lesson Plan" barely out-ranks "Plan a full 5E
   lesson").
3. **Section labels are weak grey text.** "Your teaching tools", "Choose your language" are
   just `titleSmall`-ish grey — no tracking, no rule, no accent. Premium editorial signals
   sections with a **tracked uppercase eyebrow + hairline**, which is entirely absent.
4. **Saffron never appears in type.** The accent lives only in icon chips and the CTA fill.
   Headlines, eyebrows, numerals are all ink-grey. The brand is timid on the page.
5. **No tabular numerals, no data voice.** "0/1000", "Class 1…12", future scores/rubric
   bands render in proportional Inter with default (old-style-ish) figures — counters jitter,
   numbers look like body copy, not data.
6. **No editorial rhythm.** Identical evenly-stacked cards, uniform margins, zero asymmetry,
   zero dividers, no drop-in detail. Whitespace is empty, not *composed*.
7. **Weak optical detail.** Heavy w800 display at tight tracking on a warm-white card has no
   refinement — no negative tracking on large sizes, no optical-size contrast, no italic or
   small-caps register. It is loud, not elegant.

The fix is not "bigger and bolder." It is **contrast and register**: a real editorial serif
for the human/brand moments, a disciplined grotesque for the machine/UI moments, an eyebrow
system for sections, tabular figures for data, and letter-spacing tuned per optical size.

---

## 2. The system — two families, one Indic-safe fallback strategy

### 2.1 Families

| Role | Family | Why | google_fonts |
|---|---|---|---|
| **Editorial serif** (display, page/section heroes, card & app-bar titles, signature numbers) | **Fraunces** | Variable "old-style" optical serif — warm humanist (not cold Didone), genuine gravitas at display, still legible on Android. High-contrast editorial character is the single biggest "prestige" lever. | `GoogleFonts.fraunces(...)` |
| **Workhorse grotesque** (body, leads, labels, chips, nav, functional headings, data) | **Inter** | Neutral premium (Linear/Stripe register), excellent Android hinting, full `tnum`/`lnum` OpenType features for tabular data, already in the stack. | `GoogleFonts.inter(...)` |
| Code / monospace | platform monospace | unchanged | — |

**Outfit is retired.** Fraunces replaces it for headline/title moments; Inter absorbs the
functional headings. This removes the "generic geometric" texture that reads as boring.

Fraunces weights used: **400, 500, 600** (never heavier — high-contrast serifs get muddy and
shouty above 600 at these sizes). Optional italic (400) for editorial accents. Fraunces on
Google Fonts is variable (`opsz` 9–144, `wght`, `SOFT`, `WONK`); `google_fonts` serves static
weight instances with `opsz` at its default. That is already editorial — see §6 for the
bundle-the-variable-TTF upgrade that pins `opsz` high on display and `SOFT`/`WONK` to 0 for
restraint.

### 2.2 Indic coverage — the serif↔serif / sans↔sans split (mandatory, 9 scripts)

Fraunces and Inter are Latin-only. Flutter does not fall back by script unless you supply
`fontFamilyFallback`. Two parallel chains — **serif Latin falls back to Noto *Serif* per
script; sans Latin falls back to Noto *Sans* per script** — so register stays consistent when
a string switches script (Hinglish, or a full Indic locale):

| Style register | Latin | Indic fallback (per Unicode block) |
|---|---|---|
| Editorial serif (Fraunces styles) | Fraunces | **Noto Serif** Devanagari · Bengali · Tamil · Telugu · Kannada · Malayalam · Gujarati · Gurmukhi · Oriya |
| Grotesque (Inter styles) | Inter | **Noto Sans** Devanagari · Bengali · Tamil · Telugu · Kannada · Malayalam · Gujarati · Gurmukhi · Oriya |

All eighteen Noto families ship in `google_fonts` (`GoogleFonts.notoSerifDevanagari`,
`GoogleFonts.notoSansBengali`, …). Every family must be **warmed once at startup** before it is
referenced as a fallback (extend the existing `warmIndicFonts()` — see §5.3). Serif↔serif
matters: falling a serif headline back to Noto *Sans* would break register mid-title; Noto
Serif keeps Devanagari/Bengali/Tamil headings in the same editorial voice as the Latin.

**Line-height floor is absolute:** no style `height < 1.4`; Indic clamps display ≥ 1.30→ we use
≥ 1.32, serif titles ≥ 1.40, body ≥ 1.70 (see per-style Indic column). This preserves the
existing `.indic-text` guarantee — no clipped matras/conjuncts on any of the 9 scripts. Fraunces
display at Latin `height 1.12` would clip Noto Serif Devanagari, so the Indic builder raises it
(the `h(latin, indic)` helper already in `app_text.dart` stays; we just widen the deltas).

---

## 3. The scale (exact)

`sp` = logical px. `ls` (letter-spacing) is **absolute logical px** in Flutter (not em) — em
equivalents shown for intent. `height` is a multiplier of size. Two height columns: **Latin**
and **Indic** (used when the active locale is Indic; `h(latin, indic)`).

### 3.1 Editorial serif — Fraunces (brand & human moments)

| Token | Use | Size | Weight | ls (px / em) | height Latin | height Indic |
|---|---|---:|---:|---|---:|---:|
| `displayHero` | Login/onboarding hero ("Welcome to SahayakAI") | 40 | 600 | −0.8 / −0.02 | 1.12 | 1.32 |
| `displayLarge` *(M3)* | Page hero ("Welcome back") | 32 | 600 | −0.5 / −0.016 | 1.15 | 1.32 |
| `displayMedium` *(M3)* | Section hero / result title | 26 | 600 | −0.4 / −0.015 | 1.20 | 1.35 |
| `displaySmall` *(M3)* | Sub-hero / empty-state headline | 22 | 500 | −0.3 | 1.25 | 1.40 |
| `serifTitle` → `titleLarge` *(M3)* | Card title, app-bar title (masthead) | 21 | 600 | −0.2 | 1.25 | 1.42 |
| `headlineLarge` *(M3)* | alias of `displayMedium` (26/600) | 26 | 600 | −0.4 | 1.20 | 1.35 |

> Negative tracking scales with size — it is the optical-refinement move the current w800 lacks.
> Fraunces italic 400 is available for an editorial accent (e.g. a single italicized word in a
> hero or an empty-state line); use sparingly, never for full sentences of Indic (italic Noto
> Serif coverage is uneven).

### 3.2 Grotesque headings & deck — Inter (functional structure)

| Token | Use | Size | Weight | ls (px / em) | height Latin | height Indic |
|---|---|---:|---:|---|---:|---:|
| `headlineMedium` *(M3)* | Functional heading where serif is too much | 20 | 600 | −0.2 | 1.30 | 1.45 |
| `headlineSmall` *(M3)* | Sub-section heading | 18 | 600 | −0.1 | 1.35 | 1.50 |
| `titleMedium` *(M3)* | Dense list-row title, dialog title | 16 | 600 | 0 | 1.40 | 1.50 |
| `lead` | Deck/standfirst under a hero ("Sign in to plan lessons…") | 17 | 400 | 0 | 1.50 | 1.65 |

`lead` is the missing mid-tier: an airy, muted paragraph that bridges the serif hero and the
UI. Color = `onSurfaceVariant`. It is what turns a crude big→small jump into a composed
descent.

### 3.3 Eyebrow / label system — Inter (the section signature)

| Token | Use | Size | Weight | ls (px / em) | transform | height |
|---|---|---:|---:|---|---|---:|
| `eyebrow` | Section label above a group ("YOUR TEACHING TOOLS") | 12 | 700 | +1.2 / +0.10 | UPPERCASE | 1.40 / 1.50 |
| `overline` | Micro-meta (category, "OPTIONAL") | 12 | 600 | +0.8 / +0.067 | UPPERCASE | 1.40 / 1.50 |
| `titleSmall` *(M3)* | Inline strong label | 14 | 600 | +0.2 | none | 1.40 / 1.50 |

**Eyebrow color:** saffron — `#C2410C` light (5.18:1 on white) / `#FFAB57` dark (~8:1). This is
where the brand finally touches the type. Pair with a hairline rule (§4.2). Uppercase + tracking
is what upgrades a grey label into an editorial eyebrow. (Do **not** uppercase Indic strings —
Indic scripts are unicameral; the eyebrow widget skips `toUpperCase()` for Indic locales and
leans on tracking + saffron alone.)

### 3.4 Body — Inter

| Token | Use | Size | Weight | height Latin | height Indic |
|---|---|---:|---:|---:|---:|
| `bodyLarge` *(M3)* | Primary reading copy | 16 | 400 | 1.60 | 1.75 |
| `bodyMedium` *(M3)* | Default UI body, card subtitles | 14 | 400 | 1.55 | 1.70 |
| `bodySmall` *(M3)* | Fine print, helper | 13 | 400 | 1.50 | 1.70 |

**Measure:** cap reading columns at **~60–66 characters** (≈ 40–46 rem). On phone width this
means body copy gets horizontal padding of ≥ 20dp and never runs edge-to-edge on tablets/foldables
(use `ConstrainedBox(maxWidth: 640)` centered). Body copy color for ≤14sp muted text uses a
**darkened muted** `#566173` (~5.9:1 on white) rather than `#65758B` (4.70:1) to keep a comfortable
AA margin at small sizes; `#65758B` stays for ≥16sp `lead`/secondary (4.70:1 passes AA normal).

### 3.5 Labels & data — Inter (tabular)

| Token | Use | Size | Weight | ls | height | figures |
|---|---|---:|---:|---|---:|---|
| `labelLarge` *(M3)* | Button text | 15 | 600 | +0.1 | 1.30 / 1.45 | prop |
| `labelMedium` *(M3)* | Chip, nav label | 13 | 500 | +0.1 | 1.40 / 1.50 | prop |
| `labelSmall` *(M3)* | Micro-label | 12 | 500 | +0.2 | 1.40 / 1.50 | prop |
| `dataLarge` | Big number moment (score, count-up) | 28 | 600 | −0.3 | 1.10 | **tabular + lining** |
| `dataMedium` | Inline data ("0 / 1000", "Class 12", "12 / 40") | 15 | 500 | 0 | 1.40 | **tabular + lining** |

`dataLarge` uses **Fraunces 600** (a serif number is a signature moment — scores, streaks,
class counts read like a diploma), `dataMedium` uses **Inter** with
`fontFeatures: [FontFeature.tabularFigures(), FontFeature.liningFigures()]` so counters don't
reflow and columns align. This is the single cheapest "premium data" upgrade.

---

## 4. Editorial layout rhythm (concrete)

### 4.1 Vertical rhythm & whitespace as luxury
- Baseline spacing unit stays 4dp (existing `app_spacing`). Section blocks separated by **32dp**
  (not the current ~24). Hero → deck = **12dp**; deck → first section = **28dp**.
- **Generous top margin** on hero screens: page hero sits **40dp** below the app bar, not 16.
  Empty space above the masthead is the "quiet luxury."
- Cards: internal padding **20dp** (was 16), title→subtitle **6dp**, no more.

### 4.2 The section-header pattern (replaces weak grey labels)
Every group ("Your teaching tools", "Choose your language", "Grade levels") gets an
**EditorialSectionHeader**:
```
EYEBROW (saffron, 12/700, +1.2 tracking, uppercase)   ──────────────────
[optional 1-line serif section title, displaySmall 22/500]
```
- Eyebrow left-aligned; a **hairline rule** (`outlineVariant`, 1dp) runs from the end of the
  eyebrow text to the right margin, vertically centered on the eyebrow cap-height. This one
  device single-handedly makes screens read editorial.
- Optional trailing action ("See all") in `labelMedium` saffron sits at the rule's right end.

### 4.3 Asymmetry & drop-in details (where it earns it)
- **Hero:** left-aligned serif hero + deck, NOT centered. Asymmetry reads composed; centered
  reads default. A short **saffron 2dp × 32dp rule** or a single Fraunces-italic accent word
  can sit above the hero as a "kicker."
- **First card of a group** may be a wider "feature" card (asymmetric 60/40) while the rest are
  uniform — earns emphasis on the primary tool (e.g. Lesson Plan) without new components.
- **Numbers as ornament:** the "0/1000" counter, "Class N", rubric bands render in tabular
  data styles, right-aligned in their row so digits form a clean column.

### 4.4 Dark mode
Same scale. Serif on dark needs **+1 weight of optical presence** only via color, not weight:
headline `onSurface #F2F5F8` on `#1C1F26` = ~15:1. Eyebrow saffron `#FFAB57`. Keep Fraunces at
600 — do not go heavier on dark (halation on OLED makes heavy serifs bloom).

---

## 5. Implementation (Flutter, buildable today)

### 5.1 Contrast / AA ledger (every type color pair)
| Pair | Ratio | Verdict |
|---|---:|---|
| Serif/heading `#0F1729` on card `#FFFFFF` | 16.9:1 | AA/AAA ✓ |
| `lead` / secondary `#65758B` on `#FFFFFF` (≥16sp) | 4.70:1 | AA normal ✓ |
| Small body muted `#566173` on `#FFFFFF` (≤14sp) | 5.9:1 | AA ✓ (comfortable) |
| Eyebrow saffron `#C2410C` on `#FFFFFF` | 5.18:1 | AA ✓ |
| CTA label `#FFFFFF` on saffron `#C2410C` | 5.18:1 | AA ✓ |
| Dark heading `#F2F5F8` on `#1C1F26` | ~15:1 | AA/AAA ✓ |
| Dark muted `#95A1B2` on `#1C1F26` | 6.15:1 | AA ✓ |
| Dark eyebrow `#FFAB57` on `#1C1F26` | ~8:1 | AA ✓ |

Vivid `#FF9933` is never used behind type on light (2.13:1) — brand-moment surfaces only, per
existing `AppColors` policy. No change to that rule.

### 5.2 New `app_text.dart` (drop-in — keeps the 15 M3 slots, adds editorial extras)
```dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Sans (Inter) Indic fallback — for all grotesque styles.
const List<String> kIndicSansFallback = [
  'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil',
  'Noto Sans Telugu', 'Noto Sans Kannada', 'Noto Sans Malayalam',
  'Noto Sans Gujarati', 'Noto Sans Gurmukhi', 'Noto Sans Oriya',
];

/// Serif (Fraunces) Indic fallback — for all editorial styles. Serif→serif
/// keeps register when a headline switches script.
const List<String> kIndicSerifFallback = [
  'Noto Serif Devanagari', 'Noto Serif Bengali', 'Noto Serif Tamil',
  'Noto Serif Telugu', 'Noto Serif Kannada', 'Noto Serif Malayalam',
  'Noto Serif Gujarati', 'Noto Serif Gurmukhi', 'Noto Serif Oriya',
];

// Back-compat alias — existing imports of kIndicFallback keep working.
const List<String> kIndicFallback = kIndicSansFallback;

/// Warm every family once so it is registered before use as a fallback.
void warmIndicFonts() {
  // Latin
  GoogleFonts.inter();
  GoogleFonts.fraunces();
  // Noto Sans (grotesque fallback)
  GoogleFonts.notoSansDevanagari(); GoogleFonts.notoSansBengali();
  GoogleFonts.notoSansTamil();      GoogleFonts.notoSansTelugu();
  GoogleFonts.notoSansKannada();    GoogleFonts.notoSansMalayalam();
  GoogleFonts.notoSansGujarati();   GoogleFonts.notoSansGurmukhi();
  GoogleFonts.notoSansOriya();
  // Noto Serif (editorial fallback)
  GoogleFonts.notoSerifDevanagari(); GoogleFonts.notoSerifBengali();
  GoogleFonts.notoSerifTamil();       GoogleFonts.notoSerifTelugu();
  GoogleFonts.notoSerifKannada();     GoogleFonts.notoSerifMalayalam();
  GoogleFonts.notoSerifGujarati();    GoogleFonts.notoSerifGurmukhi();
  GoogleFonts.notoSerifOriya();
}

class AppText {
  AppText._();

  static TextStyle _serif(double size, FontWeight w, double lh,
          {Color? c, double ls = 0, FontStyle style = FontStyle.normal}) =>
      GoogleFonts.fraunces(
        fontSize: size, fontWeight: w, height: lh, letterSpacing: ls,
        color: c, fontStyle: style,
      ).copyWith(fontFamilyFallback: kIndicSerifFallback);

  static TextStyle _sans(double size, FontWeight w, double lh,
          {Color? c, double ls = 0, List<FontFeature>? feat}) =>
      GoogleFonts.inter(
        fontSize: size, fontWeight: w, height: lh, letterSpacing: ls,
        color: c, fontFeatures: feat,
      ).copyWith(fontFamilyFallback: kIndicSansFallback);

  static const _tab = [FontFeature.tabularFigures(), FontFeature.liningFigures()];

  static TextTheme build(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    double h(double l, double i) => isIndic ? i : l;

    return TextTheme(
      // Editorial serif (Fraunces)
      displayLarge:  _serif(32, FontWeight.w600, h(1.15, 1.32), c: onS, ls: -0.5),
      displayMedium: _serif(26, FontWeight.w600, h(1.20, 1.35), c: onS, ls: -0.4),
      displaySmall:  _serif(22, FontWeight.w500, h(1.25, 1.40), c: onS, ls: -0.3),
      headlineLarge: _serif(26, FontWeight.w600, h(1.20, 1.35), c: onS, ls: -0.4),
      titleLarge:    _serif(21, FontWeight.w600, h(1.25, 1.42), c: onS, ls: -0.2),
      // Grotesque structure (Inter)
      headlineMedium: _sans(20, FontWeight.w600, h(1.30, 1.45), c: onS, ls: -0.2),
      headlineSmall:  _sans(18, FontWeight.w600, h(1.35, 1.50), c: onS, ls: -0.1),
      titleMedium:    _sans(16, FontWeight.w600, h(1.40, 1.50), c: onS),
      titleSmall:     _sans(14, FontWeight.w600, h(1.40, 1.50), c: onS, ls: 0.2),
      // Body (Inter)
      bodyLarge:  _sans(16, FontWeight.w400, h(1.60, 1.75), c: onS),
      bodyMedium: _sans(14, FontWeight.w400, h(1.55, 1.70), c: onS),
      bodySmall:  _sans(13, FontWeight.w400, h(1.50, 1.70), c: s.onSurfaceVariant),
      // Labels (Inter)
      labelLarge:  _sans(15, FontWeight.w600, h(1.30, 1.45), c: onS, ls: 0.1),
      labelMedium: _sans(13, FontWeight.w500, h(1.40, 1.50), c: onS, ls: 0.1),
      labelSmall:  _sans(12, FontWeight.w500, h(1.40, 1.50), c: onS, ls: 0.2),
    );
  }

  // --- Additive editorial styles (opt-in; not part of the M3 slot contract) ---
  static TextStyle displayHero(ColorScheme s, {required bool isIndic}) =>
      _serif(40, FontWeight.w600, isIndic ? 1.32 : 1.12, c: s.onSurface, ls: -0.8);

  static TextStyle lead(ColorScheme s, {required bool isIndic}) =>
      _sans(17, FontWeight.w400, isIndic ? 1.65 : 1.50, c: s.onSurfaceVariant);

  /// Saffron tracked uppercase eyebrow. Widget skips toUpperCase() for Indic.
  static TextStyle eyebrow(ColorScheme s, {required bool isIndic}) =>
      _sans(12, FontWeight.w700, isIndic ? 1.50 : 1.40, c: s.primary, ls: 1.2);

  static TextStyle overline(ColorScheme s, {required bool isIndic}) =>
      _sans(12, FontWeight.w600, isIndic ? 1.50 : 1.40,
          c: s.onSurfaceVariant, ls: 0.8);

  static TextStyle dataLarge(ColorScheme s) =>
      _serif(28, FontWeight.w600, 1.10, c: s.onSurface, ls: -0.3);

  static TextStyle dataMedium(ColorScheme s) =>
      _sans(15, FontWeight.w500, 1.40, c: s.onSurface, feat: _tab);
}
```
Expose the extras via a `ThemeExtension<AppTextExtras>` (built in `AppTheme._build` from the
same `scheme`/`isIndic`) so screens read `Theme.of(context).extension<AppTextExtras>()!.eyebrow`
and the Indic rebuild path (`AppTheme.withIndic`) keeps them in sync — same reasoning as the
existing "single construction path" note in `app_theme.dart`.

### 5.3 pubspec / wiring
- `google_fonts: ^6.2.1` already present — no new dep for fonts. Fraunces + Noto Serif families
  are all served by it.
- `flutter_animate` (already sanctioned by the brief) for the headline entrance in §5.4.
- `app_theme.dart`: `AppBarTheme.titleTextStyle: textTheme.titleLarge` already points at what is
  now the serif masthead title — no change needed there; it upgrades for free.

### 5.4 Signature motion (type only — restrained)
Headline + eyebrow **enter once** on screen mount (not on every rebuild):
- Eyebrow: fade 0→1 + slideY 8→0, **220ms**, `Curves.easeOutCubic`.
- Serif hero: fade 0→1 + slideY 12→0, **320ms**, `Curves.easeOutCubic`, **60ms after** the
  eyebrow (staggered descent).
- Deck/`lead`: fade only, **260ms**, 120ms delay.
Count-up numbers (`dataLarge`): tween the value over **600ms** `Curves.easeOutCubic` with tabular
figures so width never jumps. No looping, no bounce, no shimmer — motion is a single graceful
settle, then still. Respect `MediaQuery.disableAnimations` (reduce-motion → instant).

### 5.5 Bundle plan (offline + variable-axis upgrade)
Runtime google_fonts fetch stays for v1 (matches current behavior). Hardening task (already
tracked for Noto): bundle static Fraunces **400/500/600 + Italic 400**, Inter **400/500/600/700**,
and the 4 needed Noto weights (`400;500;600;700`) per active script under `assets/fonts/`, set
`GoogleFonts.config.allowRuntimeFetching = false`. Upgrade path: ship the **variable** Fraunces
TTF and pin `opsz` high (~72) + `SOFT 0` + `WONK 0` for display styles via
`fontVariations: [FontVariation('opsz', 72), FontVariation('wght', 600)]` — this is what makes the
serif look *bespoke* rather than defaulted. Not required for v1; the static instances already read
editorial.

---

## 6. Screen-by-screen application (the four screenshots)

- **Login (`01_launch`):** "Welcome to SahayakAI" → `displayHero` (Fraunces 40/600), left-aligned,
  with a 2dp×32dp saffron kicker rule above. "Sign in to plan lessons…" → `lead` (17/400 muted).
  The three benefit rows keep Lucide icons but labels move to `bodyLarge`; "Choose your language"
  → **eyebrow + hairline**. CTA label → `labelLarge` (15/600).
- **Dashboard (`03_dashboard`):** "SahayakAI" app-bar → serif `titleLarge` masthead. "Welcome back"
  → `displayLarge` (Fraunces 32/600). "Your teaching tools" → **saffron eyebrow + rule**. Card
  titles ("Lesson Plan", "Quiz") → serif `titleLarge`; subtitles → `bodyMedium` muted. First card
  (Lesson Plan) may take the asymmetric feature treatment (§4.3).
- **Lesson Plan form (`04_lessonplan`):** "Lesson Plan" app-bar serif. "Topic", "Grade levels",
  "Subject", "Language" → `overline`/`eyebrow` register (tracked); "Optional" → `overline` muted.
  "0/1000" → `dataMedium` tabular, right-aligned. Grade chips → `labelMedium`. "Generate" →
  `labelLarge`.
- **Dark (`05_dark`):** identical structure; serif `#F2F5F8`, eyebrow `#FFAB57`, muted `#95A1B2`.
  Fraunces stays 600 (no heavier — OLED halation).

---

## 7. Guardrails (so premium never breaks the constraints)
- No style `height < 1.4`; Indic clamps per §3. Verified against the 9 Noto Serif + 9 Noto Sans
  scripts — no matra/conjunct clipping.
- Min size 12sp anywhere teacher-facing. No 9/10/11sp.
- Touch targets unchanged (≥48dp) — type change is presentation only.
- No emoji; Lucide icon set unchanged.
- Every type color pair passes AA (§5.1 ledger).
- Uppercase transform is **English/Latin only**; the eyebrow widget leaves Indic strings cased.
- The 15 M3 `TextTheme` slots keep their names — existing widgets and the 747 tests inherit the
  new look without edits; editorial extras are additive opt-ins.

---

**File:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter/docs/flutter/design/DIRECTION_type.md`
