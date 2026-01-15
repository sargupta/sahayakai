import 'package:flutter/material.dart';

enum TimePhase {
  morning, // 6 AM - 11 AM: Warm, rising shadows
  noon, // 11 AM - 3 PM: Harsh, direct light, short shadows
  afternoon, // 3 PM - 6 PM: Soft, long shadows
  evening, // 6 PM - 9 PM: Cool, deep shadows
  night // 9 PM - 6 AM: Dark, ambient glow only
}

class LightConfig {
  final TimePhase phase;
  final Offset
      globalLightSource; // Coordinate of the sun/moon relative to center (0,0)
  final double shadowLengthMultiplier;
  final Color castShadowColor;
  final Color ambientLightColor;
  final Offset shadowOffset;

  const LightConfig({
    required this.phase,
    required this.globalLightSource,
    required this.shadowLengthMultiplier,
    required this.castShadowColor,
    required this.ambientLightColor,
    required this.shadowOffset,
  });

  static LightConfig fromTime(DateTime time) {
    final hour = time.hour;

    if (hour >= 6 && hour < 11) {
      return const LightConfig(
        phase: TimePhase.morning,
        globalLightSource: Offset(-1.0, -0.5), // Top-left
        shadowLengthMultiplier: 1.5, // Long shadows
        castShadowColor: Color(0x335D4037), // Warm brown shadow
        ambientLightColor: Color(0xFFFFF3E0), // Warm orange tint
        shadowOffset: Offset(4, 4),
      );
    } else if (hour >= 11 && hour < 15) {
      return const LightConfig(
        phase: TimePhase.noon,
        globalLightSource: Offset(0.0, -1.0), // Top-center
        shadowLengthMultiplier: 0.8, // Short shadows
        castShadowColor: Color(0x40000000), // Sharp black shadow
        ambientLightColor: Color(0xFFFFFFFF), // Pure white
        shadowOffset: Offset(0, 2),
      );
    } else if (hour >= 15 && hour < 18) {
      return const LightConfig(
        phase: TimePhase.afternoon,
        globalLightSource: Offset(1.0, -0.5), // Top-right
        shadowLengthMultiplier: 1.8, // Very long shadows
        castShadowColor: Color(0x334E342E), // Deep warm
        ambientLightColor: Color(0xFFFFF8E1), // Soft gold
        shadowOffset: Offset(-4, 4),
      );
    } else if (hour >= 18 && hour < 21) {
      return const LightConfig(
        phase: TimePhase.evening,
        globalLightSource: Offset(1.0, 0.0), // Horizon
        shadowLengthMultiplier: 2.0,
        castShadowColor: Color(0x4D1A237E), // Navy shadow
        ambientLightColor: Color(0xFFE8EAF6), // Cool blue tint
        shadowOffset: Offset(-6, 2),
      );
    } else {
      return const LightConfig(
        phase: TimePhase.night,
        globalLightSource: Offset(0.0, 0.0), // Ambient
        shadowLengthMultiplier: 0.0,
        castShadowColor: Color(0x99000000), // Dark shadow
        ambientLightColor: Color(0xFF121212), // Dark
        shadowOffset: Offset(0, 1),
      );
    }
  }
}
