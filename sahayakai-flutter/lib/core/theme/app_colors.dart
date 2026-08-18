import 'package:flutter/material.dart';

/// SahayakAI color tokens — "Saffron Design System" (production parity).
///
/// Re-skinned 2026-07 to match the REAL production web/PWA brand, corrected to
/// LIVE-SAMPLED values (`getComputedStyle` on sahayakai.com). Production RENDERS
/// the `globals.css` HSL, so the real saffron the founder sees is the muted
/// `#E0924D` — the CSS `/* #FF9933 */` comment is inaccurate. The predecessor
/// "Ledger / Ivory & Ink" palette diverged from production; this repoints every
/// value to the live saffron system while PRESERVING the `AppColors` field
/// names and the `ColorScheme` mapping in `app_theme.dart`, so the re-skin flows
/// through every screen and all behavior tests without call-site churn.
///
/// PRODUCTION SAFFRON-FILL vs SAFFRON-TEXT CONTRAST CONTRACT
/// (mirrors globals.css; locked by `test/core/theme/theme_contrast_test.dart`):
///   • LIGHT: saffron is a FILL with WHITE text — buttons, active cards, the
///     mic orb (`--primary` + `--primary-foreground: white`). [brandSaffron] /
///     [lPrimary] `#E0924D` is 2.5:1 with white: a large brand FILL, EXEMPT from
///     the 4.5 text rule (production parity).
///   • saffron as TEXT / icon / eyebrow on a light surface uses saffron-700
///     [saffronText] / [lPrimaryText] `#AC4815` (5.3:1 on bg / 5.7:1 on card ✓).
///     This is the ONLY saffron routed through small text — never `#E0924D`.
///   • DARK flips to DARK text on the saffron button: production `.dark`
///     `--primary-foreground` computes to `#0F1729`, so [dOnPrimary] `#0F1729`
///     on [dPrimary] `#EB9447` is ~7.5:1 — a genuinely ACCESSIBLE pairing, not
///     white-on-saffron. Saffron-as-text on the dark ground uses [dPrimaryText]
///     `#EB9447` itself (7.7:1 ✓).
class AppColors {
  AppColors._();

  /// Production saffron #E0924D — the brand primary FILL (buttons, active cards,
  /// the mic orb) with WHITE text in LIGHT. Large brand fill: 2.5:1 with white,
  /// EXEMPT from the 4.5 text rule (production parity). For saffron TEXT/icons on
  /// light surfaces use [saffronText] / [lPrimaryText]. Unifies with
  /// `saffron.DEFAULT` == `--primary`.
  static const brandSaffron = Color(0xFFE0924D);

  /// Warm brass, decorative ONLY — the splash seal ring / ornament hairlines.
  /// Never text or a small icon. Exempt from contrast.
  static const brandBrass = Color(0xFFB08D57);

  /// Dark-theme brass ornament.
  static const dBrandBrass = Color(0xFF8A6E43);

  // ---- Saffron scale (globals.css `--saffron-*`, live-sampled) — same ~28°
  // hue, shaded across lightness. Landing/pillar chrome, tint wells, glow. ----
  static const saffron50 = Color(0xFFFFF4EB);
  static const saffron100 = Color(0xFFFEE9D7);
  static const saffron200 = Color(0xFFFDD4AF);
  static const saffron300 = Color(0xFFF7B67E);
  static const saffron600 = Color(0xFFDF6C20);
  static const saffron700 = Color(0xFFAC4815); // = saffronText (AA on light)
  static const saffron800 = Color(0xFF8B330E);

  /// Flag-adjacent named accents (Indian tricolour). White foregrounds; both
  /// pass AA as large fills (navy 16:1, green 8.4:1).
  static const navy = Color(0xFF000080); // `--accent`
  static const green = Color(0xFF28572B); // `--secondary`

  // ---- Light (globals.css `:root`, live-sampled) ----
  static const lBackground = Color(0xFFF9F7F3); // warm off-white scaffold
  static const lCard = Color(0xFFFFFFFF); // card / list tile
  static const lSurfaceContainerLow = Color(0xFFF8FAFC); // grouped block, input fill
  static const lPopover = Color(0xFFFFFFFF); // dialogs, menus
  static const lMuted = Color(0xFFF1F5F9); // `--muted` slate-100 well
  static const lSurfaceContainerHigh = Color(0xFFE5E9F0); // active/hover neutral fill
  static const lForeground = Color(0xFF0F1729); // `--foreground` ink (16.7:1 ✓)
  static const lMutedForeground = Color(0xFF65758B); // `--muted-foreground`

  static const lPrimary = Color(0xFFE0924D); // saffron FILL/CTA (white label, exempt)
  static const lPrimaryText = Color(0xFFAC4815); // saffron-700 TEXT/ICON/eyebrow (5.3:1 ✓)
  static const lOnPrimary = Color(0xFFFFFFFF);
  static const lPrimaryContainer = Color(0xFFFEE9D7); // saffron-100 tint well / selected chip
  static const lOnPrimaryContainer = Color(0xFF8B330E); // saffron-800 label (6.9:1 ✓)

  static const lSecondary = Color(0xFF28572B); // deep green (`--secondary`)
  static const lSecondaryContainer = Color(0xFFE2EFE3);
  static const lOnSecondaryContainer = Color(0xFF1B4A1D);

  static const lTertiary = Color(0xFF000080); // navy (`--accent`)
  static const lError = Color(0xFFEF4343); // `--destructive`

  /// Warm, low-saturation error TINT container (derived from [lError]) for
  /// error surfaces like the send-failed bar — NOT M3's default cool pink
  /// `#FFDAD6`, which clashes with the warm saffron brand. [lOnErrorContainer]
  /// (a dark warm red-brown) is 8.08:1 on this fill ✓ (locked by
  /// `theme_contrast_test`).
  static const lErrorContainer = Color(0xFFFBE1DC);
  static const lOnErrorContainer = Color(0xFF7A241A);

  static const lBorder = Color(0xFFDCDFE5); // `--border` card outline, dividers
  static const lInput = Color(0xFFE1E4EA); // `--input` enabled border
  static const lOutlineVariant = Color(0xFFF0F1F5); // subtle dividers
  static const lRing = Color(0xFFE0924D); // saffron focus ring (`--ring`)

  /// Cool near-black base for LIGHT shadows — production draws shadows as
  /// `hsl(222 47% 11% / a)` (== `--foreground`). Shadow-only.
  static const lShadowBase = Color(0xFF0F1729);

  /// The ONLY saffron sanctioned as TEXT/icon on light surfaces (saffron-700).
  /// Route eyebrows / links / inactive glyphs through this, NOT [brandSaffron].
  static const saffronText = lPrimaryText;

  /// Named accents (aliases of the secondary/tertiary roles) so call sites can
  /// name the intent. Repointed to the production green / navy.
  static const lPine = lSecondary;
  static const lIndigo = lTertiary;

  // ---- Dark (globals.css `.dark` — cool near-black with saffron accents) ----
  static const dBackground = Color(0xFF13151B); // soft near-black base
  static const dSurfaceContainerLow = Color(0xFF181A21); // sunken wells
  static const dCard = Color(0xFF1C1F26); // resting card
  static const dPopover = Color(0xFF1E2129); // raised cards, menus
  static const dSurfaceContainerHigh = Color(0xFF2B303B); // active/hover, highest
  static const dMuted = Color(0xFF252931); // muted chip / sunken group
  static const dForeground = Color(0xFFF2F5F8); // off-white ink (16.7:1 ✓)
  static const dMutedForeground = Color(0xFF95A1B2); // secondary text (7:1 ✓)

  static const dPrimary = Color(0xFFEB9447); // saffron — CTA fill with DARK label
  static const dPrimaryText = dPrimary; // dark saffron text/eyebrow (7.7:1 on dBackground ✓)
  // Production `.dark` `--primary-foreground` computes to #0F1729 — DARK text on
  // the saffron button, ~7.5:1 (ACCESSIBLE, not a fill-only exemption). Restores
  // web parity and fixes the dark-CTA legibility the white label had.
  static const dOnPrimary = Color(0xFF0F1729);
  static const dPrimaryContainer = Color(0xFF3D2A15); // saffron tint well / selected chip
  static const dOnPrimaryContainer = Color(0xFFFFCE9E); // light-saffron label (9.5:1 ✓)

  static const dSecondary = Color(0xFF448848); // lighter green for dark
  static const dSecondaryContainer = Color(0xFF1E3A22);
  static const dOnSecondaryContainer = Color(0xFFBAE0BE);

  static const dTertiary = Color(0xFF8DA4E0); // soft indigo (navy reads on dark)
  static const dError = Color(0xFFBA2C2C); // `.dark --destructive`

  /// Dark-theme warm error TINT container (derived from [dError]) — a deep warm
  /// red-brown, not a cool pink. [dOnErrorContainer] (a light warm salmon) is
  /// 10.6:1 on this fill ✓ (locked by `theme_contrast_test`).
  static const dErrorContainer = Color(0xFF3A1613);
  static const dOnErrorContainer = Color(0xFFFBC5BC);

  static const dBorder = Color(0xFF31353F); // card outline, dividers
  static const dInput = Color(0xFF31353F); // input border
  static const dOutlineVariant = Color(0xFF23272F); // subtle dividers
  static const dRing = Color(0xFFEB9447); // saffron focus ring

  static const dPine = dSecondary;
  static const dIndigo = dTertiary;

  /// Back-compat: the theme-wide `shadowColor` for any Material-drawn shadow.
  /// Repointed to the cool near-black base to match production's shadow hue.
  static const shadowBase = lShadowBase;
}
