# DIRECTION_components.md — Component & Screen System (Premium Elevation)

**Lens.** The building blocks. This document redesigns the actual widgets so screens
stop reading like a settings menu and start reading like something a top CBSE / ICSE / IB
school's staff is proud to open. Scope = the presentation layer only: `lib/core/theme/`,
`lib/shared/widgets/`, and the screen layouts that compose them. All functional wiring
(providers, routes, controllers, models) and the 747 passing tests survive — this is a
**re-skin**, not a rewrite. Golden screenshots re-baseline (that is what a re-skin is);
logic/widget-behavior tests do not change.

**Constraints honored throughout.** WCAG AA (ratios stated per use); 11 Indic scripts via
Noto with line-height ≥ 1.4 and no clipped matras; ≥ 48dp targets; no emoji (Lucide only);
teacher dignity; Flutter-buildable today on Material 3 + `google_fonts` + `lucide_icons`
(all present) + `flutter_animate` (one new dep, sanctioned by the brief).

Sibling docs own the full palette and type-scale rationale (theme lens) and the tokens
themselves. Where a component needs a token that does not exist yet, it is called out as
**NEW TOKEN** with an exact value and a note to land it in `lib/core/theme/`.

---

## 1. Diagnosis — why the shipped app reads "extremely boring"

Read against the four screenshots (`01_launch`, `03_dashboard`, `04_lessonplan`, `05_dark`).

| # | Symptom | Root cause in code | Where you see it |
|---|---|---|---|
| D1 | **Everything is coplanar — no depth.** | Canvas `#FEFEFD` vs card `#FFFFFF` is a **0.4% luminance step**, and `AppShadows.soft` is `black @ 0.04 / 0.03` — imperceptible on white. Cards are defined only by a 1px `#EAECF0` outline. | `03_dashboard`: the six tool cards read as a hairline-ruled list = iOS Settings. |
| D2 | **Weak type hierarchy.** | Dashboard hero greeting is `headlineSmall` = **20/600**; tool titles are `titleMedium` = **18/600**. The "home moment" is 2sp bigger than a list row. `displayLarge/Medium` (36/30) are defined but **unused**. | `03_dashboard`: "Welcome back" barely outranks "Lesson Plan". |
| D3 | **Saffron is a timid accent.** | `IconWell` = a flat `primary @ 10%` peach square with a saffron glyph, **identical on all seven tools**. The only real saffron is the flat CTA rectangle. | `03/04`: seven identical pale-peach squares; the "Generate" bar is the one spot of colour. |
| D4 | **No signature moments / zero motion.** | `flutter_animate` is not even a dependency. No entrance stagger, no press feedback beyond default ink, no result reveal. | Every screen appears fully-formed and inert. |
| D5 | **The app bar is a bare title, twice.** | `AppBar(title: appTitle)` **plus** a separate `headlineSmall` greeting = two competing titles and no identity. The most-trafficked strip of the app is dead space. | `03_dashboard` top third. |
| D6 | **Tool tiles feel un-crafted.** | Uniform full-width rows: peach square + title + subtitle + chevron. Correct for accessibility, but visually a list of settings toggles. | `03_dashboard`. |
| D7 | **Forms read like government forms.** | Inputs are transparent-outline boxes on white (invisible fill), grade chips are flat grey pills, the CTA is a flat block. Nothing is composed. | `04_lessonplan`. |
| D8 | **Empty states are forgettable.** | `EmptyView` = one muted 24dp glyph + a line of text. Functional, zero personality. | recent-work empty, palette empty. |
| D9 | **Result views are form-dumps.** | `LessonPlanResultView` = section labels + bullets stacked in the page. A premium artifact (a lesson plan a school prints) reads as a rendered document, not a scrolled form. | `04` result path. |

**The through-line:** the system is *correct* (AA, Indic, tokens, states all handled) but
**flat, uniform, and silent.** Premium is not more colour or more chrome — it is
**depth, hierarchy, craft, and restraint-with-a-few-signature-moments.** Everything below
adds exactly those, and nothing below breaks an existing constraint.

---

## 2. Foundation the components stand on (exact new/changed tokens)

Three things unlock the whole component system. They are token-level but load-bearing for
every widget in §3, so they are specified here and cross-referenced to the theme lens.

### 2.1 A real elevation model — the single biggest lever (fixes D1)

The card must float off a warm surface. Two layers, warm-tinted (never pure grey), wide
blur, low opacity — the premium shadow signature.

**NEW / REPLACED `AppShadows`** (drop-in replacement, same names so call sites are untouched):

```dart
class AppShadows {
  static const _ink = Color(0xFF0F1729); // warm-cool ink, matches shadowBase

  // Card at rest — an ambient fill + a soft key light. ~5x the old presence,
  // still gentle. THIS is what makes a white card read as an object.
  static final List<BoxShadow> soft = [
    BoxShadow(color: _ink.withValues(alpha: 0.04), offset: const Offset(0, 1),  blurRadius: 3),
    BoxShadow(color: _ink.withValues(alpha: 0.08), offset: const Offset(0, 6),  blurRadius: 16, spreadRadius: -4),
  ];

  // Hover / pressed / feature tile / result masthead.
  static final List<BoxShadow> elevated = [
    BoxShadow(color: _ink.withValues(alpha: 0.05), offset: const Offset(0, 2),  blurRadius: 6),
    BoxShadow(color: _ink.withValues(alpha: 0.12), offset: const Offset(0, 12), blurRadius: 28, spreadRadius: -6),
  ];

  // Sheets, floating nav, dialogs.
  static final List<BoxShadow> floating = [
    BoxShadow(color: _ink.withValues(alpha: 0.10), offset: const Offset(0, 4),  blurRadius: 12),
    BoxShadow(color: _ink.withValues(alpha: 0.16), offset: const Offset(0, 20), blurRadius: 48, spreadRadius: -8),
  ];

  // Saffron CTA glow — the button reads lit, not printed. Light theme only
  // (dark uses tone). Uses the accessible CTA colour, not #FF9933.
  static final List<BoxShadow> ctaGlow = [
    BoxShadow(color: const Color(0xFFC2410C).withValues(alpha: 0.28), offset: const Offset(0, 6), blurRadius: 18, spreadRadius: -4),
    BoxShadow(color: _ink.withValues(alpha: 0.10), offset: const Offset(0, 2), blurRadius: 6),
  ];
}
```

Dark mode: shadows on near-black are near-invisible, so lift is carried by **tone + a 1px
top inner highlight** on cards — see §3.1. Keep these shadow lists (they cost nothing on
dark) but the visible separation there is tonal.

### 2.2 Warm paper canvas (coordinate with theme lens — fixes D1 without breaking AA)

The card only floats if the canvas is not also white. Warm the light scaffold a touch:

- **NEW** light `surfaceContainerLowest` (scaffold): `#FEFEFD` → **`#FAF6EF`** (warm paper).
- Cards stay pure `#FFFFFF`. Now white-on-warm-paper separation is real even before the shadow.

**AA compensation (mandatory, hand to the theme lens).** `muted-foreground #65758B` on
`#FAF6EF` drops to ~4.0:1 — under AA for small text (section labels, subtitles sit here).
Fix by darkening the text-on-canvas muted role to **`#586172`** (→ 4.9:1 on `#FAF6EF`,
5.4:1 on white). This keeps every muted label AA. If the theme lens declines the canvas
shift, **the shadow in §2.1 alone still delivers the depth** on today's `#FEFEFD` — so this
subsection is an enhancement, not a blocker. Dark canvas `#13151B` is unchanged (already
tonally separated from card `#1C1F26`).

### 2.3 Softer corners + one motion primitive (fixes D4, adds craft)

- **CHANGED `AppRadius`:** introduce two semantic aliases and soften cards:
  - `card = 16` (was `lg = 12`) — premium cards/sheets/result surfaces.
  - `control = 12` (was `md = 10`) — buttons, inputs, segmented controls.
  - Keep `sm = 8`, `pill = StadiumBorder`, `hero = 20` (now used by the dashboard header).
  - Update `DESIGN_RUBRIC §0` radius table and re-baseline goldens (expected in a re-skin).
- **Add `flutter_animate: ^4.5.0`** to `pubspec.yaml`. One dependency, used only for the
  entrance/press/reveal primitives in §4. Curve stays the single canonical
  `AppMotion.easeOutQuart = Cubic(0.16, 1, 0.3, 1)`; durations stay 150/250/350.

---

## 3. Component specs

Each spec: **anatomy → exact values → states → Flutter sketch.** Values reference the token
files. "sketch" is illustrative, not the final diff.

### 3.1 Elevated Card — `AppCard` v2 (the keystone; fixes D1, D6)

The one card grammar, re-skinned. Same public API (`child`, `padding`, `onTap`,
`accentBar`) plus a new `variant`.

**Anatomy.** Rounded-16 white surface, warm two-layer `AppShadows.soft`, hairline border,
optional 3px saffron accent bar, optional top inner-highlight for dark lift.

**Exact values.**
- Radius: `AppRadius.card` = **16**.
- Fill: `scheme.surface` (`#FFFFFF` / `#1C1F26`).
- Border: light `#EAECF0` @ 1px; **dark** `#31353F` @ 1px **plus** a 1px top inset
  `#FFFFFF @ 0.04` highlight line (the "catch-light" that lifts a card on near-black).
- Shadow: `AppShadows.soft` (rest) → `AppShadows.elevated` on press/hover (`onTap != null`).
- Padding: default `EdgeInsets.all(space4=16)` phone / `space6=24` tablet (≥600dp) — read
  `MediaQuery.sizeOf(context).width`.
- Accent bar: 3px (was 4), gradient `primary → primary@0.35`, only top corners clipped.
- Press: scale to **0.98** over `AppMotion.micro` (150ms, easeOutQuart) + shadow rest→elevated.

**Variants (new `AppCardVariant` enum).**
- `flat` — border only, `AppShadows.soft`. Default; replaces today's look at higher fidelity.
- `elevated` — `AppShadows.elevated` at rest, no border. For the feature tool tile (§3.4)
  and the result masthead (§3.10).
- `inset` — no shadow, fill `surfaceContainerLow`, 1px border. For nested panels (a note
  block inside a card) so nesting reads as recession, not another floating card.

**Sketch.**
```dart
Widget build(BuildContext context) {
  final s = Theme.of(context).colorScheme;
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final decor = BoxDecoration(
    color: variant == AppCardVariant.inset ? s.surfaceContainerLow : s.surface,
    borderRadius: AppRadius.rCard,
    border: Border.all(color: s.outline, width: 1),
    boxShadow: switch (variant) {
      AppCardVariant.elevated => AppShadows.elevated,
      AppCardVariant.inset => null,
      _ => AppShadows.soft,
    },
  );
  Widget card = DecoratedBox(
    decoration: decor,
    child: ClipRRect(
      borderRadius: AppRadius.rCard,
      child: Stack(children: [
        if (isDark) // top catch-light for dark lift
          Positioned(top: 0, left: 0, right: 0, height: 1,
            child: ColoredBox(color: Colors.white.withValues(alpha: 0.04))),
        Material(type: MaterialType.transparency,
          child: InkWell(onTap: onTap, child: _body(context))),
      ]),
    ),
  );
  return onTap == null ? card
    : _PressScale(child: card); // 0.98 scale + soft→elevated on tapDown
}
```
Indic/AA: unchanged from v1 (content padding, text styles). Border+shadow are decorative.

### 3.2 Icon well — `IconWell` v2 (fixes D3)

The flat 10% peach square is the single most repeated "boring" element. Give it craft.

**Anatomy.** Rounded-14 well, a **diagonal saffron gradient tint**, a hairline inner
saffron border, a saffron glyph. Still one size (48dp), still non-configurable (drift guard).

**Exact values.**
- Box: 48×48, radius **14**.
- Fill: `LinearGradient(topLeft→bottomRight, [primary@0.16, primary@0.06])`.
- Inner border: 1px `primary @ 0.22`.
- Glyph: Lucide, `AppIconSize.well` = 20dp, `scheme.primary`.
- Optional `size: large` (64×64, glyph 28) **only** for the feature tile (§3.4) and empty
  states (§3.9) — added as a private variant, not exposed to call sites broadly.

All values decorative → no AA obligation. The saffron here is `#C2410C` (light) / `#FFAB57`
(dark) as tint, never carrying text.

```dart
Container(
  width: 48, height: 48,
  decoration: BoxDecoration(
    borderRadius: AppRadius.rXl, // 16 -> use 14 via a dedicated const
    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [s.primary.withValues(alpha: .16), s.primary.withValues(alpha: .06)]),
    border: Border.all(color: s.primary.withValues(alpha: .22), width: 1),
  ),
  alignment: Alignment.center,
  child: Icon(icon, size: 20, color: s.primary),
);
```

### 3.3 Dashboard hero header + premium app bar (fixes D2, D5)

Replace the bare `AppBar(title)` + separate greeting with **one composed home moment**. The
dashboard app bar becomes transparent/seamless and the hero panel owns the top.

**Anatomy (top to bottom).**
1. **Seamless app bar** — `backgroundColor: surfaceContainerLowest`, `elevation: 0`,
   `scrolledUnderElevation: 3` (the warm `soft` shadow appears only when content scrolls
   under it). Leading = the SahayakAI mark in an `IconWell`-mini (28dp), title = wordmark in
   `titleLarge`. Trailing = a `Me`/avatar affordance. This is chrome, deliberately quiet.
2. **Hero block** (not an AppBar — a scroll item, so it moves away as the teacher works):
   - Eyebrow: date + school name, `labelSmall` UPPERCASE, `primary`, letter-spacing 0.5.
     e.g. `TUESDAY · DELHI PUBLIC SCHOOL`.
   - Greeting: **`displayMedium`** (Outfit **30/700**, height 1.15 single line, allowed by
     rubric for w≥600 single-line) — "Good morning, Lakshmi." Name in `onSurface` (≈15:1,
     dignified and AA-trivial), NOT gradient text (would risk AA).
   - A 2px saffron rule, 48dp wide, under the greeting (`primary → primary@0`) — the one
     signature flourish, replaces the empty second title.
   - Optional **summary strip**: 1–3 inline stats from real data ("3 lessons this week ·
     12 saved"), `bodyMedium`, muted. Hidden when counts are zero (no filler).
3. Time-aware greeting string keyed off local hour → `l10n.dashboardGreetingMorning/Afternoon/Evening`
   (add 3 keys, all 11 languages; falls back to existing `dashboardGreeting`).

**Exact values.** Hero padding `EdgeInsets.fromLTRB(16, 8, 16, 24)`; eyebrow→greeting gap
`space2=8`; greeting→rule gap `space3=12`; rule→summary gap `space3`. No background wash on
the hero itself (keeps AA of muted summary text trivial); the warmth comes from the §2.2
canvas.

**Optional branded wash (behind a flag, marketing/onboarding screens only).** A *sanctioned*
top-of-screen gradient `saffron-50 #FFF4EB → surfaceContainerLowest`, height ≤ 160dp, text
sits on the solid lower region. This is the ONE permitted decorative gradient beyond the
accent bar; do not put it behind body text. Keep it off the dense dashboard.

```dart
// dashboard hero (a ListView child, above _ToolList)
Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
  Text(eyebrow, style: text.labelSmall?.copyWith(color: s.primary, letterSpacing: .5)),
  const SizedBox(height: 8),
  Text(greeting, style: text.displayMedium), // 30/700
  const SizedBox(height: 12),
  Container(height: 2, width: 48, decoration: BoxDecoration(
    borderRadius: BorderRadius.circular(2),
    gradient: LinearGradient(colors: [s.primary, s.primary.withValues(alpha: 0)]))),
  if (hasStats) ...[const SizedBox(height: 12), _SummaryStrip(...)],
]);
```

### 3.4 Tool tiles — feature tile + refined row + grid tile (fixes D3, D6)

Break the uniform list. Information gets a layout, not a template (rubric §11).

**(a) Feature tile — the first / most-used tool as a hero card.**
- `AppCard(variant: elevated)`, radius 16, `AppShadows.elevated`.
- Layout: large `IconWell(size: large)` (64dp) top-left, title `titleLarge` (20/600),
  subtitle `bodyMedium` muted, and a `primary` "Open" affordance row with a `chevronRight`.
- Full-bleed subtle accent: a 3px saffron accent bar on top (reuse `AppCard.accentBar`).
- Height wraps content (no fixed aspect ratio — Indic/textScale safe).

**(b) Refined row — the remaining tools (keeps the accessible full-width row).**
- `AppCard(variant: flat)` + `IconWell` v2 (gradient well) + title `titleMedium` + subtitle
  `bodyMedium` muted + a **circular chevron affordance**: a 32dp `surfaceContainerHigh`
  circle holding a 20dp `chevronRight` in `onSurfaceVariant` — reads as a "go" control, not
  a bare glyph. Whole card is the 48dp+ target.
- Press: `AppCard` scale-0.98 + shadow lift (§3.1).

**(c) Grid tile — for the Create palette / a future 2-col tools view (≥600dp).**
- `AppCard(variant: flat)`, `IconWell` v2 top-left, title + one-line under it, no chevron.
- 2-col via `LayoutBuilder` (≥600dp), single column below. Never a fixed `childAspectRatio`
  (banned §7) — use a `Wrap` or `IntrinsicHeight` row pairs so height follows content.

**Layout rule for the dashboard tools section:** first `kToolRegistry` entry → feature tile;
`space3=12` gap; remaining entries → refined rows with `space3` between. This alone turns
`03_dashboard` from a settings list into a composed home.

### 3.5 Buttons — primary / secondary / ghost (fixes D3, D7)

**`PrimaryButton` v2** (same API: `label`, `onPressed`, `isBusy`, `icon`).
- Height 56, full-width, radius **`AppRadius.control` = 12**.
- Fill: `scheme.primary` (`#C2410C` light / `#FFAB57` dark). Label/icon `onPrimary`
  (white on `#C2410C` = **5.18:1 AA**; near-black `#231200` on `#FFAB57` = **~8:1 AA**).
- **Saffron glow**: `AppShadows.ctaGlow` (light) so the CTA reads lit. Dark: `AppShadows.soft`
  only (glow on near-black is muddy).
- Optional **subtle vertical gradient** `saffron-600 #DF6C20 → primary #C2410C` (light) for a
  crafted, non-flat fill. Both stops keep white label ≥ 4.5:1 (`#DF6C20` on white text: white
  on `#DF6C20` = 3.9:1 — **fails**, so gradient is decorative depth only IF label stays over
  the darker `#C2410C` majority; **safer: skip the gradient, use solid `#C2410C`** and rely on
  the glow + press motion for richness. Recommend solid.)
- Press: scale 0.97 + glow tightens (offset y 6→3), `AppMotion.micro`.
- Busy: current inline 20dp spinner (`onPrimary`) — keep.
- Disabled: `primary @ 0.38` fill, `onPrimary @ 0.7` label.

**`SecondaryButton` (new, wraps OutlinedButton).** 52dp, radius 12, transparent fill, 1.5px
`primary` border, `primary` label. For "Regenerate", "Copy", secondary actions on result
views. `#C2410C` text on white = 5.18:1 AA.

**Ghost / text button.** Unchanged role; `primary` label, no fill; 44dp min. Used for
dismiss/skip.

### 3.6 Inputs & `LabeledField` (fixes D7)

The transparent-outline box on white is invisible and cheap. Give inputs a fill and a real
focus moment.

**`inputDecorationTheme` changes.**
- `filled: true`, `fillColor: surfaceContainerLow` (light `#FAFAFA` / dark `#1A1D24`) at rest
  — a faint inset that reads as a field, not a hairline rectangle.
- Radius `AppRadius.control` = 12. Content padding `EdgeInsets.symmetric(horizontal: 16,
  vertical: 16)` → ~56dp height (comfortable, thumb-friendly).
- Enabled border: 1px `outlineVariant`. **Focus: 2px `primary` + a soft focus glow**
  (`primary @ 0.14`, blur 0, spread 3 via a wrapping `AnimatedContainer` boxShadow) — the
  "glow" token from THEME_SPEC §4, finally used. 150ms.
- Hint: `onSurfaceVariant`, Inter 14 (unchanged, Indic fallback intact).
- Error: 2px `error`, error text `bodySmall` in `error` (unchanged).

**`LabeledField` v2.** Label stays `titleSmall` tight. Add optional **leading Lucide glyph**
(20dp, `onSurfaceVariant`) before the label for scannability on long forms (the lesson-plan
form has 6+ fields). Char counter ("0/1000") moves to `labelSmall` muted, right-aligned — as
today, but tabular.

Indic: fill + radius are decorative; text roles unchanged, so line-heights and matra safety
are preserved.

### 3.7 Chips & segmented control (fixes D7)

**Choice chips (grade levels).** The flat grey pills get selection craft.
- Rest: `surfaceContainer` fill, `outline` 1px border, `labelMedium` `onSurface`.
- **Selected: `primaryContainer` fill (`#FBF2E9` light / `#23262F` dark), 1.5px `primary`
  border, label `onPrimaryContainer` (`#8B330E` on `#FBF2E9` = 6.9:1 AA / `#FFAB57` on
  `#23262F` = 7.4:1 AA), weight 600.** A checkmark is redundant with the border+fill — drop
  it for a cleaner pill (keep the `selected` semantics for a11y via `Semantics(selected:)`).
- Press/select transition: `AppMotion.micro`, fill + border cross-fade.
- Height ≥ 40 with ≥ 48dp tap row (wrap padding). Wrap layout (already correct on the form).

**Segmented control (new — `AppSegmented`).** For binary/tertiary choices currently done as
dropdowns or chip rows (e.g. quiz difficulty Easy/Medium/Hard, worksheet mode). A single
`surfaceContainer` track (radius 12), a sliding `surface` thumb with `AppShadows.soft` and a
1px border, selected label `onSurface` w600 / unselected `onSurfaceVariant`. Thumb slides
250ms easeOutQuart. Each segment ≥ 48dp tall, label `labelLarge`. Falls back to a wrapped
chip row when > 3 options or labels are long (Indic/textScale) so it never clips.

### 3.8 Bottom nav — floating, crafted (fixes D6)

The current nav is a flat bar with a saffron icon. Elevate to a floating, deliberate control.

**Anatomy.** A floated rounded bar inset from the screen edges, `AppShadows.floating`, an
active pill indicator, icon scale + label weight on active.
- Container: inset `EdgeInsets.fromLTRB(12, 0, 12, viewPadding.bottom + 8)`, radius **20**,
  `surface` fill, `AppShadows.floating`, 1px `outline` border. (Full-bleed bar is fine too;
  the float is the premium read — pick float for the marquee feel.)
- Height 56 + safe inset.
- **Active indicator (bring back a tasteful pill):** `primary @ 0.12` stadium behind the
  active icon, 250ms slide+fade. Reverses today's "transparent indicator" call — a soft
  saffron pill on a floated bar reads crafted, not busy.
- Active icon: `primary`, scaled **1.1** (150ms). Inactive: `onSurfaceVariant`.
- Label: `labelMedium` (12/500, 600 active) — keep the ≥12sp Indic floor (never the web's
  10px). Active `primary`, inactive `onSurfaceVariant`.
- Lucide glyphs unchanged (Home / Sparkles / Library / User). Create stays an action
  (opens palette), so its slot never shows the active pill.

AA: active `primary` icon/label on `surface` — `#C2410C` on `#FFFFFF` = 5.18:1; inactive
`onSurfaceVariant` label meets AA at 12sp. Pill fill is decorative.

### 3.9 Empty states with personality — `EmptyView` v2 (fixes D8)

Keep the API (`icon`, `title`, `message`, `action`) and dignity; add a composed focal point.

**Anatomy.** A **haloed glyph** + optional title + message + a real primary action, still
left-aligned (rubric §11 bans the centered-hero stack — so this is left-aligned with a
contained halo, not a full-screen centered illustration).
- Halo: a 72dp circle, concentric `primary @ 0.06` outer / `primary @ 0.12` inner (two
  stacked `Container`s or a `RadialGradient`), holding a 28dp Lucide glyph in `primary`.
  A crafted focal object instead of a lone grey 24dp icon.
- Title: `titleMedium` `onSurface` (optional).
- Message: `bodyLarge`, muted, ≤ 2 lines, dignified copy (assumes competence — §10).
- Action: a `SecondaryButton` (§3.5) when a next step exists ("Plan your first lesson").
- Gaps: halo→title `space4=16`, title→message `space1=4`, message→action `space4`.

Glyph/halo decorative (no AA). Message text uses muted role at AA. Reuse for: recent-work
empty, Create palette no-match (`searchX`), library empty, offline (pairs with `OfflineView`).

### 3.10 Result views as documents (fixes D9)

The highest-leverage premium moment: a generated lesson plan / rubric / exam paper should
read like a **printed artifact a school is proud to hand out**, not a scrolled form. Wrap
every result in a shared **`DocumentSheet`** and give it a masthead + typographic sections.

**`DocumentSheet` (new shared widget).** The outer artifact surface.
- `AppCard(variant: elevated)` at radius 16, `AppShadows.elevated`, padding `space6=24`
  phone / `space8=32` tablet (a document breathes more than a form field).
- A hairline `outlineVariant` "page edge" and a 3px saffron accent bar on top (`accentBar`).
- Max reading width 640 (already enforced by `ToolScaffold`) — a document has a measure.

**Masthead (replaces the bare `_Header`).**
- Eyebrow: doc type, `labelSmall` UPPERCASE `primary` ("LESSON PLAN · 5E MODEL").
- Title: **`displaySmall`** (Outfit 24/700, up from `headlineSmall` 20) — the artifact's name.
- A thin full-width saffron→transparent rule under the title (2px).
- Meta badges (grade / subject / duration) in a `Wrap` of `AppBadge` — unchanged widget,
  now under a real masthead. `AppBadgeTone.accent` for the primary meta (grade), neutral for
  the rest, so the eye lands on the most important tag.

**Section headers (upgrade `SectionLabel` usage in documents).**
- A `titleSmall` UPPERCASE label preceded by a **4dp saffron tick** (a tiny rounded
  `primary` bar) instead of a bare label — gives each section a crafted anchor.
- `space6=24` between document sections (more air than the form's `space4`).

**Body prose.** Unchanged `AiText` (line-height 1.7, Indic height behavior, soft-wrap) — do
not touch; it is the matra-safety guarantee. Bullets keep `BulletDot`.

**Numbered items (activities, questions).** Render as `AppCard(variant: inset)` with a
**saffron numeral medallion** (reuse `AppBadge.count` in an accent pill, 28dp) top-left, name
`titleMedium`, description `AiText`, tips/checks as `NoteBanner` (unchanged). Reads as a
sequenced document, not a stack of identical grey cards.

**Scorecard treatment (rubric / assess-assignment results).** A hero **score ring** at the
top: a `CustomPaint` circular gauge, track `surfaceContainerHigh`, progress `primary` (sweep
= score/total), centered score in `displaySmall` + a `labelSmall` denominator. 350ms
`easeOutQuart` fill on reveal. Below it, the criteria table in `inset` cards. This turns a
rubric from a grid dump into a report a teacher would print.

**Document action bar.** A sticky footer on result screens (reuse `ToolScaffold`'s
`bottomNavigationBar` slot): `PrimaryButton` "Save" + `SecondaryButton` "Regenerate" +
a ghost "Copy" — real labels (§11), ≥ 48dp, above the gesture inset.

All type roles above already carry Indic line-heights and fallbacks; the only text-bearing
colour on a non-neutral surface is `onPrimaryContainer` on the numeral medallion (AA-verified
in §5). Everything else is `onSurface` / muted on `surface` — trivially AA.

---

## 4. Motion & signature moments (fixes D4)

One curve (`AppMotion.easeOutQuart`), three durations. Add `flutter_animate`. Restraint:
motion confirms and delights, never decorates for its own sake.

| Moment | Spec | Where |
|---|---|---|
| **Screen entrance** | Cards/rows fade 0→1 + rise 12dp→0, **350ms** easeOutQuart, **40ms stagger** by index (cap the stagger after ~6 items). | Dashboard tools, library list, result sections. |
| **Press feedback** | Scale to 0.97–0.98 on tapDown, back on tapUp, **150ms**. Shadow `soft`→`elevated`. | `AppCard(onTap)`, `PrimaryButton`. |
| **Focus glow** | Input border 1→2px + `primary @ .14` glow fades in, **150ms**. | All fields (§3.6). |
| **Result reveal** | On generate success, `DocumentSheet` fades+rises **350ms**; masthead first, sections stagger 40ms. | Every tool result. |
| **Score ring** | Sweep animates 0→value, **350ms** easeOutQuart, once per load. | Scorecards (§3.10). |
| **Nav pill** | Active indicator slides + icon scales 1.0→1.1, **150–250ms**. | Bottom nav (§3.8). |
| **Segmented thumb** | Thumb slides between segments, **250ms**. | `AppSegmented` (§3.7). |

Hard limits (rubric §0): no duration < 120ms or > 400ms; no `Curves.bounce/elastic/linear`
on reveals; nothing that blocks input. Respect `MediaQuery.disableAnimations` (reduce-motion)
— gate entrance/reveal staggers behind it, keep press/focus (they are feedback, not flourish).

---

## 5. AA contrast ledger (every text-bearing colour pairing introduced)

| Foreground | On | Ratio | Use | Verdict |
|---|---|---|---|---|
| `#FFFFFF` (onPrimary) | `#C2410C` (light primary) | 5.18:1 | Primary CTA label | AA ✓ |
| `#231200` (dOnPrimary) | `#FFAB57` (dark primary) | ~8:1 | Dark CTA label | AA ✓ |
| `#C2410C` (primary) | `#FFFFFF` (card) | 5.18:1 | Saffron text/secondary btn/nav on card | AA ✓ |
| `#C2410C` (primary) | `#FAF6EF` (warm canvas) | ~4.68:1 | Eyebrow/rule on canvas | AA ✓ (keep to ≥14sp; prefer white cards for small saffron text) |
| `#586172` (muted-fg, darkened) | `#FAF6EF` (warm canvas) | ~4.9:1 | Section labels/subtitles on canvas | AA ✓ |
| `#586172` | `#FFFFFF` (card) | ~5.4:1 | Muted body on card | AA ✓ |
| `#8B330E` (onPrimaryContainer) | `#FBF2E9` (primaryContainer) | ~6.9:1 | Selected chip / numeral medallion (light) | AA ✓ |
| `#FFAB57` (dOnPrimaryContainer) | `#23262F` (dark primaryContainer) | ~7.4:1 | Selected chip / medallion (dark) | AA ✓ |
| `#0F1729` (onSurface) | `#FFFFFF` / `#FAF6EF` | ~17 / ~15:1 | Titles, greeting name | AA ✓ |

Decorative-only (no AA obligation, stated for completeness): all gradient tints in IconWell,
accent bars, halos, nav pill, focus glow, card shadows, score-ring track.

---

## 6. What changes, what is untouched (test/migration guardrails)

**Touched (presentation only):**
- `lib/core/theme/`: `app_shadows.dart` (§2.1), `app_radius.dart` (§2.3), `app_theme.dart`
  (input fill, chip selected, radius, nav) — and, coordinated with the theme lens,
  `app_colors.dart` canvas + muted-fg (§2.2).
- `lib/shared/widgets/`: `app_card.dart` (variants), `icon_well.dart` (gradient), `empty_view.dart`
  (halo), `primary_button.dart` (glow/press), `labeled_field.dart` (leading glyph); NEW
  `secondary_button.dart`, `app_segmented.dart`, `document_sheet.dart`, `score_ring.dart`,
  `press_scale.dart`.
- Screen composition: `dashboard_screen.dart` (hero + feature tile), `app_shell.dart` (floating
  nav), and each `*_result_view.dart` wrapped in `DocumentSheet`.

**Untouched:** all providers/controllers/repositories/models, routing, i18n keys (except 3
new greeting strings + any new labels, added across all 11 languages), `ai_text.dart`,
`note_banner.dart` body behavior, the four-state machine (`ResultView`), `tool_registry.dart`.

**Test impact:** widget/logic/golden-behavior tests pass unchanged (APIs preserved). **Golden
image tests re-baseline** — expected and correct for a re-skin; regenerate at 360dp + 800dp,
light + dark, with the §11 Indic strings. Add golden coverage for the 5 new widgets. Run the
15-point pre-merge checklist (`DESIGN_RUBRIC §12`) per screen; update §0 radius + muted-fg
values in the rubric so the "named token only" gate still passes.

**Ship order (each independently landable, each visibly premium):**
1. §2.1 shadows + §2.3 radius + `AppCard` v2 + `IconWell` v2 → depth lands everywhere at once.
2. §3.3 dashboard hero + §3.4 feature tile → the home moment.
3. §3.8 floating nav + §4 entrance/press motion → the app feels alive.
4. §3.5–3.7 buttons/inputs/chips/segmented → forms stop reading as forms.
5. §3.9 empty states + §3.10 `DocumentSheet` → results become artifacts.
```
