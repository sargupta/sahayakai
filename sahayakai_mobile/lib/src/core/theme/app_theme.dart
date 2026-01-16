import 'package:flutter/material.dart';
import 'studio_theme_resolver.dart';

class AppTheme {
  /// Returns the default (Standard/Saffron) theme for the app.
  /// For feature-specific themes, use the [StudioScaffold] widget.
  static ThemeData get lightTheme {
    return StudioThemeMap.getTheme(StudioType.standard);
  }
}
