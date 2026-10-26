import 'package:flutter/material.dart';

/// SahayakAI colour tokens — design system v2 (`tokens.json` v2, synced
/// 2026-10-24, the canonical v3 mobile design).
///
/// The first block is the design system itself, under its own token names
/// (`saffron-500` → [saffron500], `surface-glass` → [surfaceGlass]). Values
/// are copied exactly; `test/core/theme/design_tokens_parity_test.dart` checks
/// every one against the vendored `design/tokens.v2.json`, so a token can
/// never drift from the source again.
///
/// The second block keeps the role names the app already uses (`lPrimary`,
/// `lForeground`, …) and points each at a v2 token, so every screen and the
/// `ColorScheme` in `app_theme.dart` move to v2 without call-site churn.
///
/// CONTRAST (light, measured on the composited ground; locked by
/// `theme_contrast_test.dart`):
///   • Saffron as text is [saffron600] `#A5551D` (5.28:1 on milk-50, 4.9:1 on
///     the wash's warmest stop), or [saffron700] on saffron tints (5.55:1).
///   • White on [saffron500] is 3.77:1 — the shipped brand pair, kept EXACT and
///     FLAGGED in the design system's open founder decisions (labels stay
///     13px/600 or larger). Do not "fix" it here.
///   • White on [leaf500] 7.55:1, on [indigo500] 9.9:1, on [red500] 5.44:1.
///
/// Light only: the design system retired dark mode on 26 Oct 2026. The one
/// dark surface is the camera (the `camera*` tokens).
class AppColors {
  AppColors._();

  // ===== v2 palette ========================================================

  // Milk grounds (warm whites).
  static const milk50 = Color(0xFFFFFDF9);
  static const milk100 = Color(0xFFFFF8F0);
  static const milk200 = Color(0xFFFBF8F3);
  static const milk300 = Color(0xFFFBF6EE);
  static const milk400 = Color(0xFFF6F1E9);
  static const milk500 = Color(0xFFF4F2ED);

  // Warm ink.
  static const ink900 = Color(0xFF171310);
  static const ink800 = Color(0xFF1B1713);
  static const ink600 = Color(0xFF5C534A);
  static const ink500 = Color(0xFF6E655C);
  static const ink400 = Color(0xFF8A7F73);

  // Stone (offline orb, pending steps).
  static const stone500 = Color(0xFF8A8178);
  static const stone100 = Color(0xFFE6E1DA);

  // Saffron: VIDYA and the one action.
  static const saffron100 = Color(0xFFFFE3C2);
  static const saffron200 = Color(0xFFFFD9AE);
  static const saffron300 = Color(0xFFE0A878);
  static const saffron400 = Color(0xFFE08A3C);
  static const saffron500 = Color(0xFFC96A28);
  static const saffron600 = Color(0xFFA5551D);
  static const saffron700 = Color(0xFF8A4A08);
  static const saffron750 = Color(0xFF7A4A08);
  static const saffron800 = Color(0xFF7E3F16);

  // Leaf: selected, done, ready.
  static const leaf100 = Color(0xFFCFE6CF);
  static const leaf300 = Color(0xFF7FBF7F);
  static const leaf500 = Color(0xFF2C5F2D);
  static const leaf700 = Color(0xFF234B24);

  // Indigo: working and curriculum.
  static const indigo100 = Color(0xFFDCE2FA);
  static const indigo500 = Color(0xFF2A3B8F);

  // Status.
  static const red500 = Color(0xFFC0392B);
  static const red700 = Color(0xFF8A1C1C);
  static const amber500 = Color(0xFFB45309);

  // Surfaces.
  static const surfacePage = milk500;
  static const surfaceWeb = milk200;
  static const surfaceBand = milk400;
  static const surfaceCard = milk50;
  static const surfaceGlass = Color.fromRGBO(255, 255, 255, 0.82);
  static const surfaceGlassSoft = Color.fromRGBO(255, 255, 255, 0.7);
  static const surfaceGlassStrong = Color.fromRGBO(255, 255, 255, 0.88);
  static const surfaceGlassChip = Color.fromRGBO(255, 255, 255, 0.86);
  static const surfaceDisc = Color.fromRGBO(255, 255, 255, 0.8);
  static const surfaceSegment = Color.fromRGBO(255, 255, 255, 0.62);
  static const surfaceInset = milk300;
  static const surfaceChrome = Color.fromRGBO(255, 253, 249, 0.9);
  static const surfaceCapsule = Color.fromRGBO(255, 253, 249, 0.92);
  static const surfaceCapsuleStrong = Color.fromRGBO(255, 253, 249, 0.94);
  static const surfaceFloat = Color.fromRGBO(255, 253, 249, 0.96);

  // Edges and quiet fills.
  static const borderGlass = Color.fromRGBO(255, 255, 255, 0.95);
  static const borderHairline = Color.fromRGBO(23, 19, 16, 0.08);
  static const borderRow = Color.fromRGBO(23, 19, 16, 0.1);
  static const borderStrong = Color.fromRGBO(23, 19, 16, 0.12);
  static const borderControl = Color.fromRGBO(23, 19, 16, 0.14);
  static const fillQuiet = Color.fromRGBO(23, 19, 16, 0.06);
  static const fillSubtle = Color.fromRGBO(23, 19, 16, 0.04);
  static const dotIdle = Color.fromRGBO(23, 19, 16, 0.28);
  static const ringIdle = Color.fromRGBO(23, 19, 16, 0.16);
  static const fillMark = Color.fromRGBO(23, 19, 16, 0.07);
  static const scrim = Color.fromRGBO(23, 19, 16, 0.14);

  // Text.
  static const textStrong = ink900;
  static const textBody = ink600;
  static const textMuted = ink500;
  static const textFaint = ink400;
  static const textEyebrow = saffron600;
  static const textOnAccent = Color(0xFFFFFFFF);
  static const textLink = saffron600;
  static const textLinkHover = saffron500;

  // Accent (saffron) tints.
  static const accent = saffron500;
  static const accentTint = Color.fromRGBO(201, 106, 40, 0.1);
  static const accentTintStrong = Color.fromRGBO(201, 106, 40, 0.12);
  static const accentTintBorder = Color.fromRGBO(201, 106, 40, 0.22);
  static const accentTintSoft = Color.fromRGBO(201, 106, 40, 0.08);
  static const accentTintBorderSoft = Color.fromRGBO(201, 106, 40, 0.2);
  static const accentWash = Color.fromRGBO(201, 106, 40, 0.14);
  static const accentEdge = Color.fromRGBO(201, 106, 40, 0.3);
  static const accentOutline = Color.fromRGBO(201, 106, 40, 0.35);

  // Success (leaf) tints.
  static const success = leaf500;
  static const successTint = Color.fromRGBO(44, 95, 45, 0.12);
  static const successTintStrong = Color.fromRGBO(44, 95, 45, 0.16);
  static const leafWash = Color.fromRGBO(44, 95, 45, 0.14);
  static const leafTintEdge = Color.fromRGBO(44, 95, 45, 0.22);
  static const leafTint = Color.fromRGBO(44, 95, 45, 0.1);
  static const leafTintBorder = Color.fromRGBO(44, 95, 45, 0.24);
  static const leafRow = Color.fromRGBO(231, 240, 229, 0.85);
  static const leafRowBorder = Color.fromRGBO(44, 95, 45, 0.18);

  // Info (indigo) tints.
  static const info = indigo500;
  static const infoTint = Color.fromRGBO(42, 59, 143, 0.08);
  static const infoTintStrong = Color.fromRGBO(42, 59, 143, 0.1);
  static const infoTintBorder = Color.fromRGBO(42, 59, 143, 0.18);
  static const infoTrack = Color.fromRGBO(42, 59, 143, 0.12);
  static const infoRing = Color.fromRGBO(42, 59, 143, 0.35);
  static const indigoWash = Color.fromRGBO(42, 59, 143, 0.14);

  // Warning (amber) and danger (red) tints.
  static const warning = amber500;
  static const amberTint = Color.fromRGBO(180, 83, 9, 0.12);
  static const amberWash = Color.fromRGBO(180, 83, 9, 0.14);
  static const amberRow = Color.fromRGBO(254, 246, 231, 0.9);
  static const amberRowBorder = Color.fromRGBO(180, 83, 9, 0.22);
  static const danger = red500;
  static const redTint = Color.fromRGBO(192, 57, 43, 0.12);
  static const redRow = Color.fromRGBO(254, 236, 236, 0.9);
  static const redRowBorder = Color.fromRGBO(192, 57, 43, 0.22);

  // The camera surface (the scanner): the app's one dark context.
  static const cameraGround = ink900;
  static const onCamera = milk50;
  static const onCameraMuted = Color.fromRGBO(255, 253, 249, 0.66);
  static const onCameraIcon = Color.fromRGBO(255, 253, 249, 0.7);
  static const cameraGlass = Color.fromRGBO(255, 253, 249, 0.16);
  static const cameraBorder = Color.fromRGBO(255, 253, 249, 0.22);
  static const cameraFrame = Color.fromRGBO(255, 253, 249, 0.3);
  static const cameraGuide = Color.fromRGBO(255, 253, 249, 0.4);
  static const scanLine = Color.fromRGBO(255, 214, 170, 0.8);

  // ===== App roles, pointed at v2 ==========================================

  /// The brand saffron fill: the primary button, the active tab disc, the orb.
  /// White on it is 3.77:1 (flagged, kept exact).
  static const brandSaffron = saffron500;

  /// The splash seal's ornament ring. Decorative only, never text. v2 has no
  /// brass, so it uses the nearest warm token.
  static const brandBrass = saffron300;

  /// Back-compat names for the old tricolour accents, now the v2 meaning
  /// colours: indigo (working, curriculum) and leaf (selected, done, ready).
  static const navy = indigo500;
  static const green = leaf500;

  // ---- Light ----
  /// The solid app ground under the wash (`AppGradients.washScreen`), and the
  /// scaffold colour wherever the wash is not painted.
  static const lBackground = milk200;
  static const lCard = surfaceCard;
  static const lSurfaceContainerLow = surfaceInset;
  static const lPopover = surfaceCard;
  static const lMuted = milk400;
  static const lSurfaceContainerHigh = stone100;
  static const lForeground = textStrong;
  static const lMutedForeground = textBody;

  static const lPrimary = saffron500;
  static const lPrimaryText = textEyebrow; // saffron-600
  static const lOnPrimary = textOnAccent;
  static const lPrimaryContainer = saffron100;
  static const lOnPrimaryContainer = saffron700; // saffron as text on tints

  static const lSecondary = leaf500;
  static const lSecondaryContainer = leaf100;
  static const lOnSecondaryContainer = leaf700;

  static const lTertiary = indigo500;
  static const lError = red500;
  static const lErrorContainer = redRow;
  static const lOnErrorContainer = red700;

  static const lBorder = borderRow;
  static const lInput = borderControl;
  static const lOutlineVariant = borderHairline;

  /// Focus is a 2px `saffron-600` outline (4.9:1 or better on every ground).
  static const lRing = saffron600;

  /// Shadows are warm ink-tinted (`shadow-*` tokens use ink-900).
  static const lShadowBase = ink900;

  /// Saffron as text, icon or eyebrow on a light ground.
  static const saffronText = lPrimaryText;

  /// Saffron as text ON A SAFFRON TINT (badges, avatars, the joined pill):
  /// v2 sets it in saffron-700 there, because saffron-600 on a 12% saffron
  /// tint over an inset ground drops to 4.36:1.
  static const lPrimaryTextOnTint = saffron700;

  static const lPine = lSecondary;
  static const lIndigo = lTertiary;

  /// The theme-wide `shadowColor` for any Material-drawn shadow.
  static const shadowBase = lShadowBase;
}
