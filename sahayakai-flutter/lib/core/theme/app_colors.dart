import 'package:flutter/material.dart';

/// SahayakAI color tokens — pixel-faithful port of the web design system,
/// with a deliberate, accessibility-aware saffron brand system.
///
/// BRAND + ACCESSIBILITY DECISION (founder-approved 2026-07):
/// The founder chose vivid flag saffron #FF9933 over the token-accurate
/// #E0924D (the muted amber the web `--primary: 28 70% 59%` computes to). But
/// #FF9933 fails WCAG AA on white — #FF9933 text on white and white text on a
/// #FF9933 fill are both 2.13:1 (AA needs 4.5). So we run a SPLIT:
///   • LIGHT theme `primary` = #C2410C (deep saffron) — 5.18:1 on white, so
///     saffron TEXT/ICONS and CTA buttons (white label) both pass AA. Focus
///     ring and active states use it too (>=3:1 non-text UI).
///   • DARK theme `primary` = #FFAB57 / vivid saffron reads at 8-9:1 on the
///     near-black surfaces, so dark theme keeps the bright saffron.
///   • [brandSaffron] = #FF9933 stays as the LARGE brand-moment color (splash
///     mark, logo) where it is decorative, not carrying small text.
/// Never put #FF9933 behind small text on a light surface. If web adopts the
/// same split, this stops being a deviation; change web + Flutter together.
class AppColors {
  AppColors._();

  /// Vivid flag saffron #FF9933 — brand-moment color for LARGE decorative
  /// surfaces only (splash mark, logo). NOT for small text on light (fails AA);
  /// use [lPrimary] (#C2410C) for saffron text/CTA in light theme.
  static const brandSaffron = Color(0xFFFF9933);

  // ---- Light ----
  static const lBackground = Color(0xFFFEFEFD); // scaffold (warm off-white)
  static const lForeground = Color(0xFF0F1729);
  static const lCard = Color(0xFFFFFFFF);
  static const lPopover = Color(0xFFFFFFFF);
  static const lPrimary = Color(0xFFC2410C); // accessible deep saffron (5.18:1 on white); see class doc
  static const lOnPrimary = Color(0xFFFFFFFF); // white on #C2410C = 5.18:1, passes AA
  static const lPrimaryContainer = Color(0xFFFBF2E9); // saffron tint
  static const lOnPrimaryContainer = Color(0xFF8B330E);
  static const lSecondary = Color(0xFF28572B); // deep flag green
  static const lSecondaryContainer = Color(0xFFE8F0E8);
  static const lOnSecondaryContainer = Color(0xFF1B3A1C);
  static const lTertiary = Color(0xFF000080); // navy (flag)
  static const lMuted = Color(0xFFF1F5F9);
  static const lMutedForeground = Color(0xFF65758B);
  static const lError = Color(0xFFEF4444);
  static const lBorder = Color(0xFFEAECF0);
  static const lInput = Color(0xFFE1E4EA);
  static const lRing = Color(0xFFC2410C); // focus ring — matches accessible saffron primary

  // ---- Dark ----
  static const dBackground = Color(0xFF13151B);
  static const dForeground = Color(0xFFF2F5F8);
  static const dCard = Color(0xFF1C1F26);
  static const dPopover = Color(0xFF1E2129);
  static const dPrimary = Color(0xFFFFAB57); // vivid saffron — reads 9.7:1 on dark surfaces
  // Dark primary is a BRIGHT saffron, so its foreground must be DARK, not white
  // (white on #FFAB57 is ~1.9:1). Deep warm near-black = ~8:1, passes AA.
  static const dOnPrimary = Color(0xFF231200);
  static const dPrimaryContainer = Color(0xFF23262F);
  static const dOnPrimaryContainer = Color(0xFFFFAB57); // matches saffron primary
  static const dSecondary = Color(0xFF448848);
  static const dSecondaryContainer = Color(0xFF2A3A2B);
  static const dOnSecondaryContainer = Color(0xFFC7E0C8);
  static const dTertiary = Color(0xFF5C8BD6); // lightened navy for dark
  static const dMuted = Color(0xFF252931);
  static const dMutedForeground = Color(0xFF95A1B2);
  static const dError = Color(0xFFBA2C2C);
  static const dBorder = Color(0xFF31353F);
  static const dInput = Color(0xFF31353F);
  static const dRing = Color(0xFFFFAB57); // focus ring — matches saffron primary

  // Derived surface containers (web has no explicit token).
  static const lSurfaceContainerLow = Color(0xFFFAFAFA);
  static const lSurfaceContainerHigh = Color(0xFFEAECF0);
  static const lOutlineVariant = Color(0xFFE1E4EA);
  static const dSurfaceContainerLow = Color(0xFF1A1D24);
  static const dSurfaceContainerHigh = Color(0xFF2B303B);
  static const dOutlineVariant = Color(0xFF282C34);

  /// hsl(222 47% 11%) — the base tone for web-parity shadows.
  static const shadowBase = Color(0xFF0F1729);
}
