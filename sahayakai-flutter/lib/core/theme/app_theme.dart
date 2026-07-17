import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_text.dart';

export 'app_colors.dart';
export 'app_motion.dart';
export 'app_radius.dart';
export 'app_shadows.dart';
export 'app_spacing.dart';
export 'app_text.dart' show kIndicFallback, warmIndicFonts, AppText;

/// SahayakAI Material 3 theme — pixel-faithful port of the web design system.
/// See docs/flutter/THEME_SPEC.md for the full derivation.
///
/// NOTE ON `primary`: the founder chose the vivid flag saffron #FF9933 (light)
/// / #FFAB57 (dark) as a deliberate BRAND choice, overriding THEME_SPEC's
/// token-accurate #E0924D / #EB9447 (see [AppColors]). Everything else here is
/// ported verbatim from THEME_SPEC §7 (surfaceTint transparent on cards/menus,
/// scaffoldBackground = surfaceContainerLowest, buttons >=48dp radius 10, cards
/// radius 12, all TextStyle.height >= 1.4, Indic fallbacks).
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  /// Rebuild the theme's TextTheme for an Indic locale (raised line-heights).
  static ThemeData withIndic(ThemeData base) =>
      base.copyWith(textTheme: AppText.build(base.colorScheme, isIndic: true));

  static ThemeData _build(Brightness b) {
    final isDark = b == Brightness.dark;

    final scheme = isDark
        ? const ColorScheme(
            brightness: Brightness.dark,
            primary: AppColors.dPrimary,
            onPrimary: AppColors.dOnPrimary,
            primaryContainer: AppColors.dPrimaryContainer,
            onPrimaryContainer: AppColors.dOnPrimaryContainer,
            secondary: AppColors.dSecondary,
            onSecondary: Color(0xFFFFFFFF),
            secondaryContainer: AppColors.dSecondaryContainer,
            onSecondaryContainer: AppColors.dOnSecondaryContainer,
            tertiary: AppColors.dTertiary,
            onTertiary: Color(0xFFFFFFFF),
            error: AppColors.dError,
            onError: Color(0xFFFFFFFF),
            surface: AppColors.dCard,
            onSurface: AppColors.dForeground,
            surfaceContainerLowest: AppColors.dBackground,
            surfaceContainerLow: AppColors.dSurfaceContainerLow,
            surfaceContainer: AppColors.dMuted,
            surfaceContainerHigh: AppColors.dSurfaceContainerHigh,
            surfaceContainerHighest: AppColors.dBorder,
            onSurfaceVariant: AppColors.dMutedForeground,
            outline: AppColors.dBorder,
            outlineVariant: AppColors.dOutlineVariant,
            surfaceTint: AppColors.dPrimary,
            inverseSurface: AppColors.dForeground,
            onInverseSurface: AppColors.dBackground,
            shadow: Color(0xFF000000),
            scrim: Color(0xFF000000),
          )
        : const ColorScheme(
            brightness: Brightness.light,
            primary: AppColors.lPrimary,
            onPrimary: AppColors.lOnPrimary,
            primaryContainer: AppColors.lPrimaryContainer,
            onPrimaryContainer: AppColors.lOnPrimaryContainer,
            secondary: AppColors.lSecondary,
            onSecondary: Color(0xFFFFFFFF),
            secondaryContainer: AppColors.lSecondaryContainer,
            onSecondaryContainer: AppColors.lOnSecondaryContainer,
            tertiary: AppColors.lTertiary,
            onTertiary: Color(0xFFFFFFFF),
            error: AppColors.lError,
            onError: Color(0xFFFFFFFF),
            surface: AppColors.lCard,
            onSurface: AppColors.lForeground,
            surfaceContainerLowest: AppColors.lBackground,
            surfaceContainerLow: AppColors.lSurfaceContainerLow,
            surfaceContainer: AppColors.lMuted,
            surfaceContainerHigh: AppColors.lSurfaceContainerHigh,
            surfaceContainerHighest: AppColors.lInput,
            onSurfaceVariant: AppColors.lMutedForeground,
            outline: AppColors.lBorder,
            outlineVariant: AppColors.lOutlineVariant,
            surfaceTint: AppColors.lPrimary,
            inverseSurface: AppColors.lForeground,
            onInverseSurface: AppColors.lBackground,
            shadow: Color(0xFF000000),
            scrim: Color(0xFF000000),
          );

    final textTheme = AppText.build(scheme, isIndic: false);

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surfaceContainerLowest, // web `background`
      shadowColor: AppColors.shadowBase,
      textTheme: textTheme,
      splashFactory: InkRipple.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surfaceContainerLowest,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 2,
        shadowColor: AppColors.shadowBase,
        centerTitle: false,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          height: 1.35,
          color: scheme.onSurface,
        ).copyWith(fontFamilyFallback: kIndicFallback),
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding:
              const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          elevation: const WidgetStatePropertyAll(0),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding:
              const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          elevation: const WidgetStatePropertyAll(1),
          shadowColor: WidgetStatePropertyAll(AppColors.shadowBase),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.onSurface),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding:
              const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 16)),
          side: WidgetStatePropertyAll(
              BorderSide(color: scheme.outlineVariant, width: 1)),
          shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.primary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          shape: const WidgetStatePropertyAll(
              RoundedRectangleBorder(borderRadius: AppRadius.rMd)),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 1,
        shadowColor: AppColors.shadowBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rLg,
          side: BorderSide(color: scheme.outline, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        hintStyle: GoogleFonts.inter(
          fontSize: 14,
          color: scheme.onSurfaceVariant,
        ).copyWith(fontFamilyFallback: kIndicFallback),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.primary, width: 2), // saffron ring
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rMd,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainer, // muted chip
        selectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.primary,
        labelStyle: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ).copyWith(fontFamilyFallback: kIndicFallback),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        shape: const StadiumBorder(),
        side: BorderSide(color: scheme.outline),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 56,
        backgroundColor: scheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent, // web colors the icon, no pill
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: 20,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => GoogleFonts.inter(
            fontSize: 10,
            fontWeight: s.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          ).copyWith(fontFamilyFallback: kIndicFallback),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.rLg),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: GoogleFonts.inter(
          color: scheme.onInverseSurface,
          fontSize: 14,
        ).copyWith(fontFamilyFallback: kIndicFallback),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.rMd),
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outline.withValues(alpha: 0.6),
        thickness: 1,
        space: 1,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: AppRadius.rSm,
          border: Border.all(color: scheme.outline),
        ),
        textStyle: GoogleFonts.inter(
          fontSize: 12,
          color: scheme.onSurface,
        ).copyWith(fontFamilyFallback: kIndicFallback),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        },
      ),
    );
  }
}
