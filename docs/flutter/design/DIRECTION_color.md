# DIRECTION — Color, Surface & Depth

**Lens:** Color, surface & depth. **Goal:** kill the "extremely boring / flat white" read and make SahayakAI feel like a tool a top CBSE/ICSE/IB school is proud to open — quietly luxurious, warm, credible.

**Codename:** *Ivory & Ink · Saffron & Pine.* A warm-paper light theme, a warm-espresso luxe dark theme, a real 5-step elevation system with warm-tinted shadows, and a disciplined 3-note accent story (deep saffron primary · deep pine secondary · indigo-ink for depth).

This is a **re-skin of the presentation layer only** — it replaces the values in `lib/core/theme/app_colors.dart` and `lib/core/theme/app_shadows.dart` and adds one gradient helper. Component wiring, tokens API surface (`AppColors.lPrimary` etc.), and the 747 tests survive: same field names, new values. Every text pairing below states its measured WCAG contrast ratio.

---

## 1. Diagnosis — why the shipped app reads cheap

Read against the four screenshots (`01_launch`, `03_dashboard`, `04_lessonplan`, `05_dark`):

1. **Flat-white monotony — the #1 offender.** Scaffold `#FEFEFD` and card `#FFFFFF` differ by ~0.4% luminance (contrast **1.01:1**). Cards do not exist as objects — they dissolve into one undifferentiated white sheet. The dashboard reads as a plain list, not a product. There is zero figure-ground.
2. **Shadows are invisible.** `AppShadows.soft` is black at **0.04 + 0.03 alpha**. On white that is imperceptible. So cards are held together by a single 1px hairline only — the visual language of a *wireframe*, not a finished surface. No depth anywhere.
3. **Cold slate chrome fighting a warm brand.** Neutrals are Tailwind default slate — `#F1F5F9`, `#65758B`, `#EAECF0`, foreground `#0F1729` (blue-black). Warm saffron brand sitting on cold blue-gray neutrals reads incoherent and generic ("default M3 + an orange button").
4. **Saffron quarantined.** The brand color appears only as tiny `#FBF2E9` icon-well squares and one CTA. Nothing else carries color. The palette never asserts itself, so it never feels *branded* — it feels like a template.
5. **Dark mode is a raw invert.** `#13151B` base / `#1C1F26` card is flat blue-black; cards lift by one imperceptible step. The bright `#FFAB57` Generate button reads almost neon against dead charcoal — cheap, not luxe.
6. **One elevation plane.** AppBar, cards, sheets are all elevation 1. No hierarchy, so the eye has nothing to climb.

The fix is not "more saffron." It is **warm neutrals + genuine depth + a considered accent hierarchy.**

---

## 2. Palette philosophy

- **Paper, not white.** Light theme is built on a warm ivory *paper* scaffold with cards floating *above* it in warm-white. The lift is real (1.13:1 luminance step) and reinforced by warm shadows — the single biggest premium upgrade.
- **Ink, not blue-black.** Text is a warm charcoal ink. Warm brand + warm neutrals = coherence.
- **Three accents, ranked.** Deep saffron (primary, brand + CTA) · deep pine/teal (secondary — success, category, quiet sophistication) · indigo-ink (tertiary, rare — depth, links-in-context). Saffron leads; pine and indigo give the palette a grown-up spread beyond one orange note.
- **Dark = warm espresso, lit from above.** Not inverted slate. A warm near-black leather tone, elevation carried by *surface steps* plus a 1px top highlight that fakes light catching each raised edge, and a single saffron *glow* on the primary CTA. This is the luxe-dark trick (leather/whisky, not charcoal-and-neon).
- **Restraint.** Subtle warm gradients and a faint paper wash — no mesh gradients, no glassmorphism, no gradient text, no glow spam. Premium is what you *withhold*.

---

## 3. LIGHT palette — exact hex, roles, AA

### 3.1 Surfaces (the warm-paper ramp)

| Token | Hex | Role | Approx L |
|---|---|---|---|
| `lBackground` (paper) | `#F3EEE4` | scaffold — warm ivory paper | 0.858 |
| `lCard` | `#FFFCF8` | resting card / list tile (warm white) | 0.977 |
| `lSurfaceContainerLow` | `#FBF6EE` | grouped block behind cards | 0.905 |
| `lPopover` / raised | `#FFFFFF` | dialogs, menus, the highest surfaces (pops hardest) | 1.000 |
| `lMuted` (sunken well) | `#ECE6DA` | input wells, muted chips, sunken groups | 0.815 |
| `lSurfaceContainerHigh` | `#E4DCCC` | active/hover neutral fill | 0.735 |

> **Card lift = 1.13:1** (card `#FFFCF8` over paper `#F3EEE4`). Visible, tasteful, and amplified by the e1 shadow (§5). This single ratio is what makes the dashboard stop looking flat.

### 3.2 Ink & text

| Token | Hex | On `lCard` (0.977) | On paper (0.858) |
|---|---|---|---|
| `lForeground` (ink, primary text) | `#232019` | **15.9:1** ✓ | **14.1:1** ✓ |
| `lMutedForeground` (secondary text, hints, "Optional") | `#6B6157` | **5.9:1** ✓ | **5.2:1** ✓ |

Warm charcoal ink replaces the cold `#0F1729`. Muted taupe-gray replaces cold `#65758B` and **passes AA on both card and paper** — the current slate did not clear on paper.

### 3.3 Accents

| Token | Hex | Use | AA |
|---|---|---|---|
| `lPrimary` (saffron **fill/CTA**) | `#C2410C` | Filled buttons, focus ring, active states | white label on fill = **5.18:1** ✓ |
| `lPrimaryText` (saffron **as text/icon**) | `#A8380A` | saffron text, links-in-context, icon glyphs on light surfaces | **6.4:1** on card, **5.6:1** on paper ✓ |
| `lPrimaryContainer` | `#FBEEE2` | saffron-tinted icon wells / selected chips | — |
| `lOnPrimaryContainer` | `#8B330E` | text/icon inside the tint | **~7.9:1** ✓ |
| `lSecondary` (deep pine) | `#12554A` | success, secondary CTA, category accent | text on card **8.5:1** ✓; white on fill **8.7:1** ✓ |
| `lSecondaryContainer` | `#E1EEE9` | pine tint wells | — |
| `lOnSecondaryContainer` | `#0C3E36` | text in pine tint | ✓ high |
| `lTertiary` (indigo-ink) | `#22346B` | rare depth accent, info | white on fill **11.9:1** ✓ |
| `lError` | `#C0342B` | destructive (warmed from cold `#EF4444`) | white on fill **5.0:1** ✓ |

> **Two saffron tokens on purpose.** Vivid `#FF9933` fails AA (2.13:1). `#C2410C` is the proven CTA-fill saffron (white label 5.18:1) but as *text on the warm paper* it lands at 4.48:1 — a hair under. So saffron **text/icons** use the slightly deeper `#A8380A`, which clears 4.5 on every surface. Fill vs. text: one rule, no guesswork. Vivid `#FF9933` survives only as `brandSaffron` for large decorative brand moments (splash mark, logo) — never behind small text.

### 3.4 Borders (warm hairlines)

| Token | Hex | Use |
|---|---|---|
| `lBorder` | `#E7E0D4` | card outline, dividers (warm, replaces cold `#EAECF0`) |
| `lInput` | `#DCD3C4` | input enabled border |
| `lOutlineVariant` | `#EFE9DE` | subtle internal dividers |
| `lRing` | `#C2410C` | focus ring (2px, >3:1 non-text ✓) |

---

## 4. DARK palette — luxe espresso, exact hex, roles, AA

### 4.1 Surfaces (warm-espresso ramp — elevation IS the surface step)

| Token | Hex | Role | Approx L |
|---|---|---|---|
| `dBackground` (base) | `#17130E` | scaffold — warm near-black espresso | 0.007 |
| `dSurfaceContainerLow` (sunken) | `#1C1811` | sunken wells | 0.010 |
| `dCard` | `#221D16` | resting card | 0.013 |
| `dPopover` / raised | `#2A241B` | raised cards, menus, popovers | 0.018 |
| `dSurfaceContainerHigh` | `#332B20` | active/hover, highest surfaces | 0.026 |
| `dMuted` | `#241F17` | muted chip / sunken group | 0.014 |

Warm espresso (`#17130E`), **not** cold slate (`#13151B`). Each step is a perceptible climb in dark. Raised surfaces additionally get a **1px top highlight** (`#FFFFFF @ 0.05`) to fake light catching the edge — the luxe-dark move that makes cards read as physical objects (§5.2).

### 4.2 Ink & text

| Token | Hex | On `dCard` (0.013) |
|---|---|---|
| `dForeground` (ivory, primary text) | `#F5EFE6` | **14.6:1** ✓ |
| `dMutedForeground` (secondary) | `#A89A86` | **6.1:1** ✓ |

Warm ivory text, not cold `#F2F5F8`.

### 4.3 Accents

| Token | Hex | Use | AA |
|---|---|---|---|
| `dPrimary` (candlelit saffron) | `#F6A959` | CTA fill **and** saffron text | text on card **8.6:1** ✓ |
| `dOnPrimary` | `#231200` | label on saffron fill | **9.3:1** ✓ |
| `dPrimaryContainer` | `#2E2417` | saffron-tinted well | — |
| `dOnPrimaryContainer` | `#F6A959` | text in the tint | ✓ |
| `dSecondary` (bright pine) | `#4FB3A2` | secondary / success / category | text on card **6.6:1** ✓ |
| `dSecondaryContainer` | `#1E3A34` | pine tint well | — |
| `dOnSecondaryContainer` | `#B7E4DA` | text in pine tint | ✓ |
| `dTertiary` (soft indigo) | `#8DA4E0` | rare depth/info | on card ✓ high |
| `dError` | `#E0645A` | destructive | text on card ✓ |

Saffron warmed from neon `#FFAB57` → candlelit `#F6A959`. Against warm espresso it reads like brass/amber, not fluorescent — the fix for the "cheap Generate button" in `05_dark`.

### 4.4 Borders

| Token | Hex | Use |
|---|---|---|
| `dBorder` | `#3A3226` | card outline, dividers |
| `dInput` | `#453B2C` | input border |
| `dOutlineVariant` | `#2C261D` | subtle dividers |
| `dRing` | `#F6A959` | focus ring |

---

## 5. Elevation & shadow system — the depth engine

Five levels. **Light uses warm-tinted two-layer shadows** (pure black on warm paper looks dirty); **dark uses surface steps + a top highlight + black key shadows only where things float.**

Warm light shadow base: **`#3A2E1E`** (warm brown-black). Add to `AppColors` as `lShadowBase`.

### 5.1 Light shadows (exact `BoxShadow`)

```dart
// e0 — flush (scaffold, in-flow rows): no shadow.

// e1 — resting card / list tile / input
[
  BoxShadow(color: lShadowBase.withValues(alpha: 0.04), offset: Offset(0, 1),  blurRadius: 3),
  BoxShadow(color: lShadowBase.withValues(alpha: 0.06), offset: Offset(0, 2),  blurRadius: 6,  spreadRadius: -1),
]

// e2 — raised / hover / the primary "continue" card
[
  BoxShadow(color: lShadowBase.withValues(alpha: 0.05), offset: Offset(0, 2),  blurRadius: 6),
  BoxShadow(color: lShadowBase.withValues(alpha: 0.09), offset: Offset(0, 8),  blurRadius: 20, spreadRadius: -4),
]

// e3 — dialog / menu / floating bottom CTA bar
[
  BoxShadow(color: lShadowBase.withValues(alpha: 0.06), offset: Offset(0, 4),  blurRadius: 10),
  BoxShadow(color: lShadowBase.withValues(alpha: 0.14), offset: Offset(0, 16), blurRadius: 40, spreadRadius: -8),
]

// e4 — bottom sheet peak / modal
[
  BoxShadow(color: lShadowBase.withValues(alpha: 0.08), offset: Offset(0, 8),  blurRadius: 16),
  BoxShadow(color: lShadowBase.withValues(alpha: 0.20), offset: Offset(0, 28), blurRadius: 64, spreadRadius: -12),
]
```

**Two-layer grammar throughout:** a tight *ambient* (contact) shadow + a soft *key* (cast) shadow with negative spread so it stays gathered under the object. This is what separates premium depth from the blurry gray halo of AI-slop.

### 5.2 Dark shadows + top highlight

In dark, cast shadows barely read; elevation is the **surface step** (§4.1) plus a hairline highlight:

```dart
// Every raised dark card/sheet: paint a 1px top-edge highlight to catch light.
// Implement as a gradient border or a top BorderSide:
Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1))

// e3/e4 floating elements ALSO get a pure-black key shadow:
[ BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: Offset(0, 16), blurRadius: 48, spreadRadius: -12) ]
```

### 5.3 Signature: the saffron CTA glow (dark only, primary button only)

```dart
// Beneath the primary Generate/Continue button in dark theme — makes it feel lit, not painted on.
BoxShadow(color: Color(0xFFF6A959).withValues(alpha: 0.18), offset: Offset(0, 6), blurRadius: 24, spreadRadius: -6)
```

One element, one glow. Never repeat it — repetition is what tips glow into slop.

### 5.4 Elevation → component map

| Level | Light | Dark | Applied to |
|---|---|---|---|
| e0 | none | base surface | scaffold, flush rows |
| e1 | soft two-layer | `dCard` + no highlight | resting cards, tool tiles, inputs |
| e2 | raised two-layer | `dPopover` + top highlight | primary card, hovered/pressed card |
| e3 | dialog two-layer | `dPopover` + highlight + black key | menus, dialogs, floating CTA bar |
| e4 | sheet two-layer | `dSurfaceContainerHigh` + highlight + black key | bottom sheets, modals |

Retire the flat "everything is elevation 1" model. `cardTheme.elevation` stays 0 in `ThemeData` — draw these shadows on the card's own `Container`/`Material` so the two-layer grammar is exact (Material's tonal elevation cannot express two layers).

---

## 6. Gradients & texture — barely-there, on purpose

**Light scaffold** — a 3% vertical warm wash so the paper breathes instead of banding:

```dart
LinearGradient(
  begin: Alignment.topCenter, end: Alignment.bottomCenter,
  colors: [Color(0xFFFBF7F0), Color(0xFFF1EADD)], // top lighter → bottom warmer, ~3% shift
)
```

**Light hero / AppBar wash** — one faint saffron corner glow (brand presence, not decoration):

```dart
RadialGradient(
  center: Alignment(1.0, -1.0), radius: 1.2,
  colors: [Color(0x14C2410C), Color(0x00C2410C)], // 8% → 0% saffron, top-right corner
)
```

**Dark scaffold** — warm vignette (the luxe move):

```dart
RadialGradient(
  center: Alignment(0.0, -0.6), radius: 1.4,
  colors: [Color(0xFF1E1811), Color(0xFF140F09)], // warm center-top → darker edges
)
```

**Banned:** mesh gradients, glassmorphism blur panels, gradient-filled text, multi-stop rainbow anything. If a gradient is noticeable at a glance, it is too strong — dial to where it only registers subliminally.

---

## 7. Signature color moments (cheap to build, high payoff)

1. **Category spine.** Each tool tile on the dashboard gets a 3px left spine in a rotating accent (saffron → pine → indigo → saffron…). Instantly turns the monotone list in `03_dashboard` into a rhythm with color, at zero layout cost.
2. **Icon wells earn their tint.** Keep the rounded icon well, but tint it to the tile's category accent container (`lPrimaryContainer` / `lSecondaryContainer` / indigo tint) instead of all-saffron. Color now *means* something.
3. **The one raised card.** A "Continue where you left off" / most-recent card sits at e2 with a saffron top hairline — the single object that pops off the paper, giving the dashboard a focal point.
4. **Warm empty states.** Empty-state surfaces use `lSurfaceContainerLow` with a pine or saffron line icon on tint — warm and intentional, never a gray void.

---

## 8. Drop-in Flutter — replace `app_colors.dart` values

Same field names → tests and component wiring untouched. New values only. (`lPrimaryText`, `lShadowBase`, gradient helper are additive.)

```dart
class AppColors {
  AppColors._();

  static const brandSaffron = Color(0xFFFF9933); // large decorative brand moments only

  // ---- Light ----
  static const lBackground            = Color(0xFFF3EEE4); // warm paper scaffold
  static const lForeground            = Color(0xFF232019); // warm ink  (15.9:1 on card)
  static const lCard                  = Color(0xFFFFFCF8); // warm-white card (1.13:1 over paper)
  static const lPopover               = Color(0xFFFFFFFF); // highest surface
  static const lPrimary               = Color(0xFFC2410C); // saffron FILL/CTA (white 5.18:1)
  static const lPrimaryText           = Color(0xFFA8380A); // saffron TEXT/ICON (5.6:1 on paper) — additive
  static const lOnPrimary             = Color(0xFFFFFFFF);
  static const lPrimaryContainer      = Color(0xFFFBEEE2);
  static const lOnPrimaryContainer    = Color(0xFF8B330E);
  static const lSecondary             = Color(0xFF12554A); // deep pine (8.5:1 text on card)
  static const lSecondaryContainer    = Color(0xFFE1EEE9);
  static const lOnSecondaryContainer  = Color(0xFF0C3E36);
  static const lTertiary              = Color(0xFF22346B); // indigo-ink (white 11.9:1)
  static const lMuted                 = Color(0xFFECE6DA); // sunken well
  static const lMutedForeground       = Color(0xFF6B6157); // warm secondary text (5.2:1 on paper)
  static const lError                 = Color(0xFFC0342B);
  static const lBorder                = Color(0xFFE7E0D4);
  static const lInput                 = Color(0xFFDCD3C4);
  static const lRing                  = Color(0xFFC2410C);

  static const lSurfaceContainerLow   = Color(0xFFFBF6EE);
  static const lSurfaceContainerHigh  = Color(0xFFE4DCCC);
  static const lOutlineVariant        = Color(0xFFEFE9DE);

  /// Warm brown-black — base for LIGHT two-layer shadows (never pure black on paper).
  static const lShadowBase            = Color(0xFF3A2E1E); // additive

  // ---- Dark ----
  static const dBackground            = Color(0xFF17130E); // warm espresso base
  static const dForeground            = Color(0xFFF5EFE6); // ivory (14.6:1 on card)
  static const dCard                  = Color(0xFF221D16);
  static const dPopover               = Color(0xFF2A241B); // raised
  static const dPrimary               = Color(0xFFF6A959); // candlelit saffron (8.6:1 text, fill 9.3:1)
  static const dOnPrimary             = Color(0xFF231200);
  static const dPrimaryContainer      = Color(0xFF2E2417);
  static const dOnPrimaryContainer    = Color(0xFFF6A959);
  static const dSecondary             = Color(0xFF4FB3A2); // bright pine (6.6:1 on card)
  static const dSecondaryContainer    = Color(0xFF1E3A34);
  static const dOnSecondaryContainer  = Color(0xFFB7E4DA);
  static const dTertiary              = Color(0xFF8DA4E0);
  static const dMuted                 = Color(0xFF241F17);
  static const dMutedForeground       = Color(0xFFA89A86); // warm gray (6.1:1 on card)
  static const dError                 = Color(0xFFE0645A);
  static const dBorder                = Color(0xFF3A3226);
  static const dInput                 = Color(0xFF453B2C);
  static const dRing                  = Color(0xFFF6A959);

  static const dSurfaceContainerLow   = Color(0xFF1C1811);
  static const dSurfaceContainerHigh  = Color(0xFF332B20);
  static const dOutlineVariant        = Color(0xFF2C261D);

  /// Retained for any web-parity call sites; new shadows use lShadowBase (light) / black (dark).
  static const shadowBase             = Color(0xFF0F1729);
}
```

### 8.1 Replace `app_shadows.dart`

```dart
class AppShadows {
  AppShadows._();
  static const _l = AppColors.lShadowBase; // warm, light theme

  /// e1 — resting card. (Was `soft`; ~2× the old alpha so it actually reads.)
  static final List<BoxShadow> e1 = [
    BoxShadow(color: _l.withValues(alpha: 0.04), offset: const Offset(0, 1), blurRadius: 3),
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 2), blurRadius: 6, spreadRadius: -1),
  ];
  /// e2 — raised / hover / primary card. (Was `elevated`.)
  static final List<BoxShadow> e2 = [
    BoxShadow(color: _l.withValues(alpha: 0.05), offset: const Offset(0, 2), blurRadius: 6),
    BoxShadow(color: _l.withValues(alpha: 0.09), offset: const Offset(0, 8), blurRadius: 20, spreadRadius: -4),
  ];
  /// e3 — dialog / menu / floating CTA bar. (Was `floating`.)
  static final List<BoxShadow> e3 = [
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 4),  blurRadius: 10),
    BoxShadow(color: _l.withValues(alpha: 0.14), offset: const Offset(0, 16), blurRadius: 40, spreadRadius: -8),
  ];
  /// e4 — bottom sheet / modal.
  static final List<BoxShadow> e4 = [
    BoxShadow(color: _l.withValues(alpha: 0.08), offset: const Offset(0, 8),  blurRadius: 16),
    BoxShadow(color: _l.withValues(alpha: 0.20), offset: const Offset(0, 28), blurRadius: 64, spreadRadius: -12),
  ];

  /// Dark floating key shadow (sheets/dialogs only) + top highlight border.
  static final List<BoxShadow> dKey = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: const Offset(0, 16), blurRadius: 48, spreadRadius: -12),
  ];
  static final Border dTopHighlight =
      Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1));

  /// Signature saffron glow — dark primary button ONLY, never repeated.
  static final List<BoxShadow> dSaffronGlow = [
    BoxShadow(color: const Color(0xFFF6A959).withValues(alpha: 0.18), offset: const Offset(0, 6), blurRadius: 24, spreadRadius: -6),
  ];

  // Back-compat aliases so existing call sites keep compiling during migration:
  static final List<BoxShadow> soft = e1;
  static final List<BoxShadow> elevated = e2;
  static final List<BoxShadow> floating = e3;
}
```

### 8.2 Add a gradient helper (`app_gradients.dart`, additive)

```dart
class AppGradients {
  AppGradients._();
  static const lightPaper = LinearGradient(
    begin: Alignment.topCenter, end: Alignment.bottomCenter,
    colors: [Color(0xFFFBF7F0), Color(0xFFF1EADD)],
  );
  static const lightHeroWash = RadialGradient(
    center: Alignment(1.0, -1.0), radius: 1.2,
    colors: [Color(0x14C2410C), Color(0x00C2410C)],
  );
  static const darkVignette = RadialGradient(
    center: Alignment(0.0, -0.6), radius: 1.4,
    colors: [Color(0xFF1E1811), Color(0xFF140F09)],
  );
}
```

Paint `lightPaper` / `darkVignette` as the scaffold body background (a `DecoratedBox` behind content), not as `scaffoldBackgroundColor` (which must stay a solid `Color`).

---

## 9. Migration notes & guardrails

- **Names unchanged** in `AppColors` → `app_theme.dart` `ColorScheme` mapping compiles as-is; 747 tests unaffected. New fields (`lPrimaryText`, `lShadowBase`, `dTopHighlight`, gradients) are additive.
- **`cardTheme.elevation` → 0.** Draw §5 shadows on the card container; keep `surfaceTintColor: Colors.transparent` (already set).
- **Saffron text call sites:** swap `colorScheme.primary`-as-text to `AppColors.lPrimaryText` on light. Fills/CTAs keep `colorScheme.primary`. In dark, `dPrimary` serves both (8.6:1 text ✓).
- **AA is the gate.** Every pairing here states a measured ratio; all body/label pairings clear 4.5:1, all large/UI clear 3:1. Do not introduce vivid `#FF9933` behind any small text.
- **Indic-safe:** this is a color/surface change only — no font, line-height, or matra impact. Noto fallbacks and `height ≥ 1.4` untouched.
- **Touch targets / no-emoji / Lucide** unchanged — out of this lens.
- **Verify after wiring:** re-screenshot `03_dashboard` + `05_dark` and confirm cards now read as objects and the dark CTA reads brass, not neon.
```
