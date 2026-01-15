import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tokens/base_tokens.dart';
import 'tokens/brand_tokens.dart';
import 'extensions/sahayak_theme_extensions.dart';

enum StudioType {
  wizard,
  gameMaster,
  director,
  artStudio,
  notebook,
  grid,
  professional,
  academy,
  community,
  standard
}

class StudioThemeMap {
  static ThemeData getTheme(StudioType studio) {
    // 1. Resolve Tokens based on Studio
    final SahayakColors studioColors = _resolveColors(studio);
    final SahayakTypography studioTypography = _resolveTypography(studio);

    // 2. Build Base ThemeData (Material 3)
    final baseTheme = ThemeData(
      useMaterial3: true,
      brightness:
          studio == StudioType.director ? Brightness.dark : Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: studioColors.primary,
        primary: studioColors.primary,
        secondary: studioColors.accent,
        surface: studioColors.studioSurface,
        onSurface: studioColors.onStudioSurface,
        background: studioColors.studioSurface,
      ),
      scaffoldBackgroundColor: studioColors.studioSurface,

      // Integrate Typography Extension
      extensions: [
        studioColors,
        studioTypography,
      ],
    );

    // 3. Override Core Component Themes using Tokens
    return baseTheme.copyWith(
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: studioColors.onStudioSurface,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: studioColors.onStudioSurface),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: studioColors.primary,
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          elevation: 4,
          shadowColor: studioColors.primary.withOpacity(0.4),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: studio == StudioType.director
            ? Colors.white.withOpacity(0.1)
            : Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: studioColors.primary, width: 2),
        ),
        hintStyle:
            TextStyle(color: studioColors.onStudioSurface.withOpacity(0.5)),
      ),
    );
  }

  static SahayakColors _resolveColors(StudioType studio) {
    // Default / Standard
    Color primary = BrandColors.saffronPrimary;
    Color accent = BrandColors.saffronDeep;
    Color surface = BrandColors.paper;
    Color onSurface = BrandColors.ink;
    LinearGradient aiGradient = BrandColors.warmGradient;
    Color micGlow = BrandColors.saffronPrimary;

    switch (studio) {
      case StudioType.wizard:
        primary = BrandColors.saffronPrimary;
        accent = BrandColors.saffronLight;
        micGlow = Colors.orange;
        break;
      case StudioType.gameMaster:
        primary = BrandColors.forestGreen;
        accent = Colors.lightGreen;
        micGlow = Colors.green;
        break;
      case StudioType.director:
        primary = BrandColors.plum;
        accent = BrandColors.rose;
        surface = const Color(0xFF0F0A1F); // Deep cinematic dark
        onSurface = Colors.white;
        micGlow = Colors.purpleAccent;
        break;
      case StudioType.artStudio:
        primary = BrandColors.violet;
        accent = BrandColors.pink;
        micGlow = Colors.pinkAccent;
        break;
      case StudioType.notebook:
        primary = BrandColors.slate;
        accent = Colors.grey;
        surface = const Color(0xFFF3F4F6); // Paper grey
        micGlow = Colors.blueGrey;
        break;
      case StudioType.grid:
        primary = BrandColors.indigo;
        accent = Colors.blue;
        micGlow = Colors.indigoAccent;
        break;
      case StudioType.professional:
        primary = BrandColors.slate;
        accent = BrandColors.royalBlue;
        micGlow = Colors.blue;
        break;
      case StudioType.academy:
        primary = BrandColors.royalBlue;
        accent = Colors.lightBlue;
        micGlow = Colors.blue;
        break;
      case StudioType.community:
        primary = const Color(0xFFFF5722); // Social Orange
        accent = BrandColors.plum;
        micGlow = Colors.orangeAccent;
        break;
      case StudioType.standard:
        break;
    }

    return SahayakColors(
      primary: primary,
      accent: accent,
      studioSurface: surface,
      onStudioSurface: onSurface,
      aiLoaderGradient: aiGradient,
      micGlow: micGlow,
    );
  }

  static SahayakTypography _resolveTypography(StudioType studio) {
    // Basic resolution based on Language could happen here too.
    // For now, we stick to the Brand definition.
    return SahayakTypography(
      displayLarge: GoogleFonts.outfit(
          fontSize: BaseTypography.displayLarge, fontWeight: FontWeight.bold),
      headlineMedium: GoogleFonts.outfit(
          fontSize: BaseTypography.headlineMedium, fontWeight: FontWeight.w600),
      bodyLarge: GoogleFonts.inter(fontSize: BaseTypography.bodyLarge),
      bodyMedium: GoogleFonts.inter(fontSize: BaseTypography.bodyMedium),
      fontFamilyHeading: BrandTypographyFamily.indic,
      fontFamilyBody: BrandTypographyFamily.latin,
    );
  }
}
