import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import '../extensions/sahayak_theme.dart';

class StudioTokenLoader {
  static Future<SahayakTheme> load(String studio, String locale) async {
    // 1. Load JSONs
    final baseJson = await rootBundle.loadString('assets/tokens/base.json');
    // Defaulting to wizard if file not found would be good practice, but for now strict loading
    final studioJson =
        await rootBundle.loadString('assets/tokens/studio_$studio.json');
    // Defaulting to hi if not found
    String localeJson;
    try {
      localeJson =
          await rootBundle.loadString('assets/tokens/locale_$locale.json');
    } catch (_) {
      localeJson = await rootBundle.loadString('assets/tokens/locale_hi.json');
    }

    // 2. Decode
    final base = json.decode(baseJson);
    final studioLayer = json.decode(studioJson);
    final localeLayer = json.decode(localeJson);

    // 3. Helper
    Color parseColor(String hex) =>
        Color(int.parse(hex.replaceFirst('#', '0xff')));

    // 4. Map to ThemeExtension
    return SahayakTheme(
      primary: parseColor(
          studioLayer['color']['primary'] ?? base['color']['primary']),
      accent: parseColor(studioLayer['color']['accent']),
      surface: parseColor(base['color']['surface']),
      background: parseColor(base['color']['background']),
      success: parseColor(base['color']['success']),
      warning: parseColor(base['color']['warning']),
      error: parseColor(base['color']['error']),
      aiThinkingGradient: LinearGradient(
        colors: [
          parseColor(studioLayer['aiGradient']['start']),
          parseColor(studioLayer['aiGradient']['end']),
        ],
      ),
      cardRadius: (studioLayer['radius']['card'] as num).toDouble(),
      sheetRadius: (studioLayer['radius']['sheet'] as num).toDouble(),
      layoutDensity:
          (localeLayer['layout']['densityMultiplier'] as num).toDouble(),
      // Glass Tokens (using safe lookup or defaults)
      glassTint: parseColor(
          studioLayer['glass']?['tint'] ?? '#FFFFFF'), // Default to White tint
      glassBlur: ((studioLayer['glass']?['blur'] ?? 20) as num).toDouble(),
      glassOpacity:
          ((studioLayer['glass']?['opacity'] ?? 0.12) as num).toDouble(),
    );
  }
}
