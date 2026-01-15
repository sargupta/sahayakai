import 'package:flutter/material.dart';

/// Brand Layer - Saffron Core
/// These are the signature colors of the SahayakAI identity.
class BrandColors {
  // Saffron Identity
  static const Color saffronPrimary = Color(0xFFFF9933); // Indian Saffron
  static const Color saffronDeep = Color(0xFFE68A00);
  static const Color saffronLight = Color(0xFFFFB766);

  // Studio Identities
  static const Color ink = Color(0xFF1F2937); // Dark Grey/Black for text
  static const Color paper =
      Color(0xFFF9FAFB); // Light Grey/White for backgrounds

  static const Color royalBlue = Color(0xFF2563EB); // Academy
  static const Color indigo = Color(0xFF4338CA); // Rubric
  static const Color forestGreen = Color(0xFF2C5F2D); // Quiz / Secondary
  static const Color plum = Color(0xFF5B2D8B); // Director
  static const Color rose = Color(0xFFBE123C); // Director Accent
  static const Color violet = Color(0xFF8B5CF6); // Art Studio
  static const Color pink = Color(0xFFEC4899); // Art Studio Accent
  static const Color slate = Color(0xFF64748B); // Professional

  // Gradients
  static const LinearGradient warmGradient = LinearGradient(
    colors: [saffronPrimary, Color(0xFFEC4899)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient glassGradient = LinearGradient(
    colors: [Color(0xCCFFFFFF), Color(0x66FFFFFF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

/// Brand Typography
class BrandTypographyFamily {
  static const String latin = 'Inter';
  static const String indic = 'Outfit'; // For Headings/Display
  static const String arabic = 'Noto Naskh Arabic';
}
