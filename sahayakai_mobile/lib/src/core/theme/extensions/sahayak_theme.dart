import 'dart:ui';
import 'package:flutter/material.dart';

@immutable
class SahayakTheme extends ThemeExtension<SahayakTheme> {
  final Color primary;
  final Color accent;
  final Color surface;
  final Color background;
  final Color success;
  final Color warning;
  final Color error;

  final Gradient aiThinkingGradient;
  final double cardRadius;
  final double sheetRadius;
  final double layoutDensity;

  // Glassmorphism Tokens
  final Color glassTint;
  final double glassBlur;
  final double glassOpacity;

  // Cultural Intelligence
  final Color? festivalOverlayColor; // If set, applies a festive tint

  const SahayakTheme({
    required this.primary,
    required this.accent,
    required this.surface,
    required this.background,
    required this.success,
    required this.warning,
    required this.error,
    required this.aiThinkingGradient,
    required this.cardRadius,
    required this.sheetRadius,
    required this.layoutDensity,
    required this.glassTint,
    required this.glassBlur,
    required this.glassOpacity,
    this.festivalOverlayColor,
  });

  @override
  SahayakTheme copyWith({
    Color? primary,
    Color? accent,
    Color? surface,
    Color? background,
    Color? success,
    Color? warning,
    Color? error,
    Gradient? aiThinkingGradient,
    double? cardRadius,
    double? sheetRadius,
    double? layoutDensity,
    Color? glassTint,
    double? glassBlur,
    double? glassOpacity,
    Color? festivalOverlayColor,
  }) {
    return SahayakTheme(
      primary: primary ?? this.primary,
      accent: accent ?? this.accent,
      surface: surface ?? this.surface,
      background: background ?? this.background,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      aiThinkingGradient: aiThinkingGradient ?? this.aiThinkingGradient,
      cardRadius: cardRadius ?? this.cardRadius,
      sheetRadius: sheetRadius ?? this.sheetRadius,
      layoutDensity: layoutDensity ?? this.layoutDensity,
      glassTint: glassTint ?? this.glassTint,
      glassBlur: glassBlur ?? this.glassBlur,
      glassOpacity: glassOpacity ?? this.glassOpacity,
      festivalOverlayColor: festivalOverlayColor ?? this.festivalOverlayColor,
    );
  }

  @override
  SahayakTheme lerp(ThemeExtension<SahayakTheme>? other, double t) {
    if (other is! SahayakTheme) return this;
    return SahayakTheme(
      primary: Color.lerp(primary, other.primary, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      background: Color.lerp(background, other.background, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      aiThinkingGradient:
          Gradient.lerp(aiThinkingGradient, other.aiThinkingGradient, t)!,
      cardRadius: lerpDouble(cardRadius, other.cardRadius, t)!,
      sheetRadius: lerpDouble(sheetRadius, other.sheetRadius, t)!,
      layoutDensity: lerpDouble(layoutDensity, other.layoutDensity, t)!,
      glassTint: Color.lerp(glassTint, other.glassTint, t)!,
      glassBlur: lerpDouble(glassBlur, other.glassBlur, t)!,
      glassOpacity: lerpDouble(glassOpacity, other.glassOpacity, t)!,
      festivalOverlayColor:
          Color.lerp(festivalOverlayColor, other.festivalOverlayColor, t),
    );
  }
}
