import 'package:flutter/material.dart';

/// SahayakAI color tokens — "The Ledger · Ivory & Ink, Saffron & Pine."
/// See PREMIUM_DESIGN_SPEC.md §2 (LOCKED). Warm-paper light, warm-espresso
/// dark, a 5-level warm-tinted elevation system, and a 3-note accent story
/// (deep saffron primary · deep pine secondary · indigo-ink tertiary).
///
/// The `AppColors` field names and the `ColorScheme` mapping in
/// `app_theme.dart` are PRESERVED so the re-skin flows through every screen
/// and the 747 behavior tests for free; values change, a few tokens are
/// additive.
///
/// ACCESSIBLE SAFFRON SPLIT (founder-approved, locked by
/// `test/core/theme/theme_contrast_test.dart` — do not regress):
///   • saffron FILLS / CTAs use [lPrimary] `#C2410C` (white label 5.18:1 ✓)
///   • saffron TEXT / icons / eyebrows use [lPrimaryText] `#A8380A`
///     (6.4:1 card / 5.6:1 paper ✓)
///   • vivid [brandSaffron] `#FF9933` is LARGE-decorative only (splash seal,
///     logo mark) — 2.13:1 on white, never behind small text
///   • dark: [dPrimary] `#F6A959` fill AND saffron text, [dOnPrimary]
///     `#231200` label (9.3:1 ✓)
class AppColors {
  AppColors._();

  /// Vivid flag saffron #FF9933 — brand-moment color for LARGE decorative
  /// surfaces only (splash seal fill, logo mark). Fails AA on white (2.13:1);
  /// never behind small text. Use [lPrimaryText] for saffron text/icons.
  static const brandSaffron = Color(0xFFFF9933);

  /// Warm brass, decorative ONLY — seal ring, ornament hairlines. Never text
  /// or a small icon. Exempt from contrast.
  static const brandBrass = Color(0xFFB08D57);

  /// Dark-theme brass ornament.
  static const dBrandBrass = Color(0xFF8A6E43);

  // ---- Light · "Ivory" (§2.1) ----
  static const lBackground = Color(0xFFF3EEE4); // paper scaffold
  static const lCard = Color(0xFFFFFCF8); // resting card / list tile
  static const lSurfaceContainerLow = Color(0xFFFBF6EE); // grouped block, input fill
  static const lPopover = Color(0xFFFFFFFF); // dialogs, menus (highest)
  static const lMuted = Color(0xFFECE6DA); // muted chips, sunken well
  static const lSurfaceContainerHigh = Color(0xFFE4DCCC); // active/hover neutral fill
  static const lForeground = Color(0xFF232019); // ink — primary text
  static const lMutedForeground = Color(0xFF6B6157); // secondary text, hints

  static const lPrimary = Color(0xFFC2410C); // saffron FILL/CTA (white 5.18:1 ✓)
  static const lPrimaryText = Color(0xFFA8380A); // saffron TEXT/ICON/eyebrow (additive)
  static const lOnPrimary = Color(0xFFFFFFFF);
  static const lPrimaryContainer = Color(0xFFFBEEE2); // saffron tint well / selected chip
  static const lOnPrimaryContainer = Color(0xFF8B330E);

  static const lSecondary = Color(0xFF12554A); // deep pine
  static const lSecondaryContainer = Color(0xFFE1EEE9);
  static const lOnSecondaryContainer = Color(0xFF0C3E36);

  static const lTertiary = Color(0xFF22346B); // indigo-ink
  static const lError = Color(0xFFC0342B); // warmed destructive

  static const lBorder = Color(0xFFE7E0D4); // card outline, dividers (warm hairline)
  static const lInput = Color(0xFFDCD3C4); // input enabled border
  static const lOutlineVariant = Color(0xFFEFE9DE); // subtle dividers, ruled registers
  static const lRing = Color(0xFFC2410C); // focus ring (2px), matches saffron fill

  /// Warm brown-black base for LIGHT two-layer shadows (pure black on warm
  /// paper reads dirty). Shadow-only. (§2.3)
  static const lShadowBase = Color(0xFF3A2E1E);

  /// Named pine / indigo accents (aliases of the secondary/tertiary roles) so
  /// call sites can name the intent (§2, sanctioned accents R5).
  static const lPine = lSecondary;
  static const lIndigo = lTertiary;

  // ---- Dark · "Warm Espresso, lit from above" (§2.2) ----
  static const dBackground = Color(0xFF17130E); // warm near-black espresso
  static const dSurfaceContainerLow = Color(0xFF1C1811); // sunken wells
  static const dCard = Color(0xFF221D16); // resting card
  static const dPopover = Color(0xFF2A241B); // raised cards, menus
  static const dSurfaceContainerHigh = Color(0xFF332B20); // active/hover, highest
  static const dMuted = Color(0xFF241F17); // muted chip / sunken group
  static const dForeground = Color(0xFFF5EFE6); // ivory — primary text (14.6:1 ✓)
  static const dMutedForeground = Color(0xFFA89A86); // secondary text (6.1:1 ✓)

  static const dPrimary = Color(0xFFF6A959); // candlelit saffron — CTA fill AND text
  static const dPrimaryText = dPrimary; // dark saffron text/eyebrow (additive alias)
  // Dark primary is a BRIGHT saffron, so its label is DARK, not white
  // (white on #F6A959 fails). #231200 = 9.3:1 ✓ (fixes the dark-CTA bug).
  static const dOnPrimary = Color(0xFF231200);
  static const dPrimaryContainer = Color(0xFF2E2417); // saffron tint well / selected chip
  static const dOnPrimaryContainer = Color(0xFFF6A959);

  static const dSecondary = Color(0xFF4FB3A2); // bright pine
  static const dSecondaryContainer = Color(0xFF1E3A34);
  static const dOnSecondaryContainer = Color(0xFFB7E4DA);

  static const dTertiary = Color(0xFF8DA4E0); // soft indigo
  static const dError = Color(0xFFE0645A);

  static const dBorder = Color(0xFF3A3226); // card outline, dividers
  static const dInput = Color(0xFF453B2C); // input border
  static const dOutlineVariant = Color(0xFF2C261D); // subtle dividers
  static const dRing = Color(0xFFF6A959); // focus ring

  static const dPine = dSecondary;
  static const dIndigo = dTertiary;

  /// Back-compat: the theme-wide `shadowColor` for any Material-drawn shadow.
  /// Repointed to the warm brown-black base so tonal fallbacks stay warm.
  static const shadowBase = lShadowBase;
}
