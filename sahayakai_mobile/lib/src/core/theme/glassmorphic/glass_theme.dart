import 'package:flutter/material.dart';

/// Glassmorphic Design System Colors
/// Inspired by the warm, premium aesthetic with frosted glass effects
class GlassColors {
  // Background Gradients - Warm Tan/Beige Theme
  static const Color backgroundStart = Color(0xFFD4C4A8); // Warm tan
  static const Color backgroundMid = Color(0xFFE5D9C3); // Lighter tan
  static const Color backgroundEnd = Color(0xFFF5EFE6); // Cream

  // Glass Card Colors
  static const Color cardBackground = Color(0xFFFFFFFD); // Near white
  static const Color cardBorder = Color(0xFFE8E8E8); // Light grey border

  // Primary Accent - Saffron Orange
  static const Color primary = Color(0xFFFF9933); // Indian Saffron
  static const Color primaryLight = Color(0xFFFFB366);
  static const Color primaryDark = Color(0xFFE68A00);

  // Text Colors
  static const Color textPrimary = Color(0xFF1F2937); // Dark charcoal
  static const Color textSecondary = Color(0xFF6B7280); // Medium grey
  static const Color textTertiary = Color(0xFF9CA3AF); // Light grey
  static const Color textAccent = Color(0xFFFF9933); // Saffron

  // UI Element Colors
  static const Color inputBackground = Color(0xFFF9FAFB);
  static const Color inputBorder = Color(0xFFE5E7EB);
  static const Color divider = Color(0xFFE5E7EB);

  // Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);

  // Switch/Toggle Colors
  static const Color switchActive = primary;
  static const Color switchInactive = Color(0xFFD1D5DB);
  static const Color switchTrackActive = Color(0xFFFFE4CC);
  static const Color switchTrackInactive = Color(0xFFE5E7EB);

  // Chip Colors
  static const Color chipSelected = primary;
  static const Color chipUnselected = Color(0xFFF3F4F6);
  static const Color chipBorder = Color(0xFFE5E7EB);

  // Shadows
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: Colors.black.withOpacity(0.04),
          blurRadius: 20,
          offset: const Offset(0, 4),
          spreadRadius: 0,
        ),
        BoxShadow(
          color: Colors.black.withOpacity(0.02),
          blurRadius: 6,
          offset: const Offset(0, 2),
          spreadRadius: 0,
        ),
      ];

  static List<BoxShadow> get buttonShadow => [
        BoxShadow(
          color: primary.withOpacity(0.3),
          blurRadius: 16,
          offset: const Offset(0, 6),
          spreadRadius: -2,
        ),
      ];

  // Gradients
  static const LinearGradient backgroundGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [backgroundStart, backgroundMid, backgroundEnd],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient warmBackgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Color(0xFFB8A88A), // Darker olive-tan (top-left corner shade)
      Color(0xFFC4B494), // Medium tan
      Color(0xFFD4C4A8), // Warm tan
      Color(0xFFE0D4BE), // Light tan
      Color(0xFFEAE0D0), // Lighter cream  
      Color(0xFFF0E8DC), // Cream (bottom-right)
    ],
    stops: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
  );

  // Radial shaded background for more depth
  static RadialGradient get shadedBackgroundGradient => RadialGradient(
    center: Alignment.topLeft,
    radius: 1.5,
    colors: const [
      Color(0xFFD8C8AC), // Center - lighter
      Color(0xFFC4B494), // Mid
      Color(0xFFB0A080), // Outer - darker shade
    ],
    stops: const [0.0, 0.5, 1.0],
  );

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryLight, primary, primaryDark],
  );
}

/// Glassmorphic Design System Spacing
class GlassSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  // Padding presets
  static const EdgeInsets cardPadding = EdgeInsets.all(20);
  static const EdgeInsets sectionPadding = EdgeInsets.symmetric(horizontal: 20);
  static const EdgeInsets screenPadding = EdgeInsets.all(20);
}

/// Glassmorphic Design System Border Radius
class GlassRadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 28;
  static const double pill = 100;

  // BorderRadius presets
  static BorderRadius get cardRadius => BorderRadius.circular(lg);
  static BorderRadius get buttonRadius => BorderRadius.circular(md);
  static BorderRadius get inputRadius => BorderRadius.circular(sm);
  static BorderRadius get chipRadius => BorderRadius.circular(pill);
}

/// Glassmorphic Typography Styles
class GlassTypography {
  // Display/Decorative - Script style for headers like "Drafting New Worksheet..."
  static TextStyle decorativeLabel({Color? color}) => TextStyle(
        fontFamily: 'Dancing Script',
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: color ?? GlassColors.textSecondary,
        fontStyle: FontStyle.italic,
      );

  // Headlines
  static TextStyle headline1({Color? color}) => TextStyle(
        fontFamily: 'Outfit',
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: color ?? GlassColors.textPrimary,
        height: 1.2,
      );

  static TextStyle headline2({Color? color}) => TextStyle(
        fontFamily: 'Outfit',
        fontSize: 22,
        fontWeight: FontWeight.bold,
        color: color ?? GlassColors.textPrimary,
        height: 1.2,
      );

  static TextStyle headline3({Color? color}) => TextStyle(
        fontFamily: 'Outfit',
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: color ?? GlassColors.textPrimary,
        height: 1.3,
      );

  // Body Text
  static TextStyle bodyLarge({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: color ?? GlassColors.textPrimary,
        height: 1.5,
      );

  static TextStyle bodyMedium({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: color ?? GlassColors.textPrimary,
        height: 1.5,
      );

  static TextStyle bodySmall({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: color ?? GlassColors.textSecondary,
        height: 1.4,
      );

  // Labels
  static TextStyle labelLarge({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: color ?? GlassColors.textPrimary,
        letterSpacing: 0.5,
      );

  static TextStyle labelMedium({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: color ?? GlassColors.textSecondary,
        letterSpacing: 0.8,
      );

  static TextStyle labelSmall({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: color ?? GlassColors.textTertiary,
        letterSpacing: 1.0,
      );

  // Section Header (uppercase labels like "TOPIC OR CHAPTER")
  static TextStyle sectionHeader({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 11,
        fontWeight: FontWeight.w600,
        color: color ?? GlassColors.textSecondary,
        letterSpacing: 1.2,
      );

  // Button Text
  static TextStyle buttonLarge({Color? color}) => TextStyle(
        fontFamily: 'Outfit',
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: color ?? Colors.white,
        letterSpacing: 0.5,
      );

  static TextStyle buttonMedium({Color? color}) => TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: color ?? Colors.white,
      );
}
