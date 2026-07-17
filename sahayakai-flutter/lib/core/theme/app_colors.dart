import 'package:flutter/material.dart';

/// SahayakAI color tokens — pixel-faithful port of the web design system,
/// with ONE deliberate brand override (see [lPrimary]).
///
/// BRAND DECISION (foundation-v1): the primary saffron is set to the vivid
/// flag saffron #FF9933 (light) / #FFAB57 (dark) at the founder's request.
/// THEME_SPEC.md §0 mandates the token-accurate #E0924D / #EB9447 (the muted
/// amber the web `--primary: 28 70% 59%` actually computes to) for strict
/// web-pixel parity. We intentionally choose the brighter #FF9933 here as a
/// brand choice. If web later adopts #FF9933, this stops being a deviation;
/// until then, change it in web + Flutter together — never Flutter-only drift.
class AppColors {
  AppColors._();

  // ---- Light ----
  static const lBackground = Color(0xFFFEFEFD); // scaffold (warm off-white)
  static const lForeground = Color(0xFF0F1729);
  static const lCard = Color(0xFFFFFFFF);
  static const lPopover = Color(0xFFFFFFFF);
  static const lPrimary = Color(0xFFFF9933); // saffron — brand override (was #E0924D)
  static const lOnPrimary = Color(0xFFFFFFFF);
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
  static const lRing = Color(0xFFFF9933); // focus ring — matches saffron primary

  // ---- Dark ----
  static const dBackground = Color(0xFF13151B);
  static const dForeground = Color(0xFFF2F5F8);
  static const dCard = Color(0xFF1C1F26);
  static const dPopover = Color(0xFF1E2129);
  static const dPrimary = Color(0xFFFFAB57); // saffron — brand override (was #EB9447)
  static const dOnPrimary = Color(0xFFFFFFFF);
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
