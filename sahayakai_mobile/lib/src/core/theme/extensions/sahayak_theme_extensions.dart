import 'package:flutter/material.dart';

/// Custom Color Extension for Saffron Design System
/// Allows for Studio-specific semantic aliases.
@immutable
class SahayakColors extends ThemeExtension<SahayakColors> {
  final Color primary;
  final Color accent;
  final Color studioSurface;
  final Color onStudioSurface;
  final LinearGradient aiLoaderGradient;
  final Color micGlow;

  const SahayakColors({
    required this.primary,
    required this.accent,
    required this.studioSurface,
    required this.onStudioSurface,
    required this.aiLoaderGradient,
    required this.micGlow,
  });

  @override
  SahayakColors copyWith({
    Color? primary,
    Color? accent,
    Color? studioSurface,
    Color? onStudioSurface,
    LinearGradient? aiLoaderGradient,
    Color? micGlow,
  }) {
    return SahayakColors(
      primary: primary ?? this.primary,
      accent: accent ?? this.accent,
      studioSurface: studioSurface ?? this.studioSurface,
      onStudioSurface: onStudioSurface ?? this.onStudioSurface,
      aiLoaderGradient: aiLoaderGradient ?? this.aiLoaderGradient,
      micGlow: micGlow ?? this.micGlow,
    );
  }

  @override
  SahayakColors lerp(ThemeExtension<SahayakColors>? other, double t) {
    if (other is! SahayakColors) {
      return this;
    }
    return SahayakColors(
      primary: Color.lerp(primary, other.primary, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      studioSurface: Color.lerp(studioSurface, other.studioSurface, t)!,
      onStudioSurface: Color.lerp(onStudioSurface, other.onStudioSurface, t)!,
      aiLoaderGradient:
          LinearGradient.lerp(aiLoaderGradient, other.aiLoaderGradient, t)!,
      micGlow: Color.lerp(micGlow, other.micGlow, t)!,
    );
  }
}

/// Custom Typography Extension for Script-Aware Scaling
@immutable
class SahayakTypography extends ThemeExtension<SahayakTypography> {
  final TextStyle displayLarge; // Outfit
  final TextStyle headlineMedium; // Outfit
  final TextStyle bodyLarge; // Inter
  final TextStyle bodyMedium; // Inter
  final String fontFamilyHeading;
  final String fontFamilyBody;

  const SahayakTypography({
    required this.displayLarge,
    required this.headlineMedium,
    required this.bodyLarge,
    required this.bodyMedium,
    required this.fontFamilyHeading,
    required this.fontFamilyBody,
  });

  @override
  SahayakTypography copyWith({
    TextStyle? displayLarge,
    TextStyle? headlineMedium,
    TextStyle? bodyLarge,
    TextStyle? bodyMedium,
    String? fontFamilyHeading,
    String? fontFamilyBody,
  }) {
    return SahayakTypography(
      displayLarge: displayLarge ?? this.displayLarge,
      headlineMedium: headlineMedium ?? this.headlineMedium,
      bodyLarge: bodyLarge ?? this.bodyLarge,
      bodyMedium: bodyMedium ?? this.bodyMedium,
      fontFamilyHeading: fontFamilyHeading ?? this.fontFamilyHeading,
      fontFamilyBody: fontFamilyBody ?? this.fontFamilyBody,
    );
  }

  @override
  SahayakTypography lerp(ThemeExtension<SahayakTypography>? other, double t) {
    if (other is! SahayakTypography) {
      return this;
    }
    return SahayakTypography(
      displayLarge: TextStyle.lerp(displayLarge, other.displayLarge, t)!,
      headlineMedium: TextStyle.lerp(headlineMedium, other.headlineMedium, t)!,
      bodyLarge: TextStyle.lerp(bodyLarge, other.bodyLarge, t)!,
      bodyMedium: TextStyle.lerp(bodyMedium, other.bodyMedium, t)!,
      fontFamilyHeading: other.fontFamilyHeading, // No lerp for strings
      fontFamilyBody: other.fontFamilyBody,
    );
  }
}
