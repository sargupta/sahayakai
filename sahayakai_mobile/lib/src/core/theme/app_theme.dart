import 'package:flutter/material.dart';
import 'studio_theme_resolver.dart';
import 'tokens/brand_tokens.dart';

/// Shim for backward compatibility.
/// Use [SahayakTheme] tokens (primary, accent, etc.) instead.
@deprecated
class AppColors {
  // Backward Compatibility Shim linking to new BrandTokens
  static const Color primary = BrandColors.saffronPrimary;
  static const Color secondary = BrandColors.forestGreen;
  static const Color accent = BrandColors.indigo;

  static const Color background = BrandColors.paper;
  static const Color surface = BrandColors.paper;
  static const Color textMain = BrandColors.ink;
  static const Color textLight = BrandColors.slate;

  // Glassmorphism
  static const Color glassWhite = Color(0xCCFFFFFF);
  static const Color glassBorder = Color(0x33FFFFFF);
}

class AppTheme {
  /// Returns the default (Standard/Saffron) theme for the app.
  /// For feature-specific themes, use the [StudioScaffold] widget.
  static ThemeData get lightTheme {
    return StudioThemeMap.getTheme(StudioType.standard);
  }
}
