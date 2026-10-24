import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../shared/motion/lift_settle_transitions.dart';
import 'app_colors.dart';
import 'app_glass.dart';
import 'app_radius.dart';
import 'app_shadows.dart';
import 'app_spacing.dart';
import 'app_text.dart';

export 'app_colors.dart';
export 'app_glass.dart';
export 'app_gradients.dart';
export 'app_icon_size.dart';
export 'app_motion.dart';
export 'app_radius.dart';
export 'app_shadows.dart';
export 'app_spacing.dart';
export 'app_text.dart'
    show kIndicFallback, kIndicSansFallback, AppText, AppTextExtras;

/// SahayakAI Material 3 theme — pixel-faithful port of the Design System v3.
///
/// Light theme only for demo (per spec). Dark theme kept functional but
/// warm-retinted. All tokens from design_zip/tokens/*.css.
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  /// Rebuild the theme for an Indic locale (raised line-heights).
  /// Re-runs the WHOLE [_build] instead of `copyWith(textTheme:)`,
  /// because Flutter resolves component text styles with `??` and
  /// swapping only `textTheme` would strand AppBar/bottom nav on Latin metrics.
  static ThemeData withIndic(ThemeData base) =>
      _build(base.brightness, isIndic: true);

  /// Force light theme for demo regardless of system setting.
  static ThemeData get demo => light();

  static ThemeData _build(Brightness b, {bool isIndic = false}) {
    final isDark = b == Brightness.dark;

    // Use the canonical ColorScheme from AppColors (tokens/colors.css)
    final scheme = isDark ? AppColors.darkScheme : AppColors.lightScheme;

    final textTheme = AppText.build(scheme, isIndic: isIndic);
    final textExtras = AppText.buildExtras(scheme, isIndic: isIndic);

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      // Solid surface; the pastel wash is painted as a DecoratedBox by the
      // scaffold wrapper (AppShell / PhoneScreen), never as scaffoldBackgroundColor.
      // Transparent so the shared AppBackground (applied in app.dart's builder)
      // shows through. Screens that paint their own gradient still override.
      scaffoldBackgroundColor: Colors.transparent,
      shadowColor: isDark ? Colors.black : AppColors.ink900,
      textTheme: textTheme,
      extensions: [textExtras],
      splashFactory: InkRipple.splashFactory,

      // -----------------------------------------------------------------------
      // AppBar — transparent, glass-backed by scaffold wrapper
      // -----------------------------------------------------------------------
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),

      // -----------------------------------------------------------------------
      // Buttons — pill-shaped, 52px CTA, StadiumBorder everywhere
      // -----------------------------------------------------------------------
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.1),
                scheme.primary,
              );
            }
            if (states.contains(WidgetState.disabled)) {
              return scheme.primary.withValues(alpha: 0.38);
            }
            return scheme.primary; // saffron-500
          }),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.ctaHeight), // 52px
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: AppSpacing.space8),
          ),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          elevation: const WidgetStatePropertyAll(0),
          shadowColor: WidgetStatePropertyAll(
            isDark
                ? AppShadows.dSaffronGlow.first.color
                : AppShadows.cta.color,
          ),
        ),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return Color.alphaBlend(
                Colors.white.withValues(alpha: 0.1),
                scheme.primary,
              );
            }
            if (states.contains(WidgetState.disabled)) {
              return scheme.primary.withValues(alpha: 0.38);
            }
            return scheme.primary;
          }),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.ctaHeight),
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: AppSpacing.space8),
          ),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          elevation: const WidgetStatePropertyAll(0),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return scheme.onSurface.withValues(alpha: 0.38);
            }
            return scheme.primary;
          }),
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.ctaHeight),
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: AppSpacing.space8),
          ),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return BorderSide(
                color: scheme.outline.withValues(alpha: 0.38),
                width: 1,
              );
            }
            return BorderSide(color: scheme.primary, width: 1.5);
          }),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return scheme.primary.withValues(alpha: 0.38);
            }
            return scheme.primary;
          }),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: AppSpacing.space6),
          ),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),

      // -----------------------------------------------------------------------
      // Cards — GlassSurface.flat, rCard (18), two-layer warm shadow
      // -----------------------------------------------------------------------
      cardTheme: CardThemeData(
        color: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: const ContinuousRectangleBorder(
          borderRadius: AppRadius.rCard,
        ),
      ),

      // -----------------------------------------------------------------------
      // Input fields — filled, rField (14), 2px saffron focus ring
      // -----------------------------------------------------------------------
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? AppGlass.dFlatFillSoft : AppGlass.lFlatFillSoft,
        contentPadding: AppSpacing.fieldPadding,
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.rField,
          borderSide: BorderSide(color: scheme.outline, width: 1),
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.rField,
          borderSide: BorderSide(color: scheme.outline, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.rField,
          borderSide: BorderSide(
            color: scheme.primary,
            width: 2,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rField,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rField,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),

      // -----------------------------------------------------------------------
      // Chips — pill (StadiumBorder), 8-9px vertical padding, selected = saffron/leaf
      // -----------------------------------------------------------------------
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFillSoft : AppGlass.lFlatFillSoft,
        selectedColor: scheme.primaryContainer, // saffron-100 / leaf-100 / indigo-100
        checkmarkColor: scheme.onPrimaryContainer,
        labelStyle: textTheme.labelMedium?.copyWith(color: scheme.onSurface),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w600,
        ),
        padding: AppSpacing.chipPadding,
        shape: const StadiumBorder(),
        side: BorderSide(color: scheme.outline),
        pressElevation: 0,
      ),

      // -----------------------------------------------------------------------
      // Navigation bar — the custom FloatingBottomNav is what ships, but this
      // theme is the ??-resolved chrome slot every legacy NavigationBar reads,
      // so it keeps the §0 floors (12sp / 1.4) AND the per-state emphasis:
      // selected = w600 in the brand primary, unselected = w500 in the muted
      // role. Flattening both states to one style (as a restyle pass did) drops
      // the only affordance that says which tab you are on.
      // -----------------------------------------------------------------------
      navigationBarTheme: NavigationBarThemeData(
        height: 56,
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return textTheme.labelMedium?.copyWith(
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? scheme.primary : scheme.onSurfaceVariant,
          );
        }),
      ),

      // -----------------------------------------------------------------------
      // Dialogs & Sheets — flat glass (no blur), squircle corners
      // Real-blur surfaces use GlassSurface.chrome() directly.
      // -----------------------------------------------------------------------
      dialogTheme: DialogThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        surfaceTintColor: Colors.transparent,
        shape: const ContinuousRectangleBorder(
          borderRadius: AppRadius.rCard,
        ),
      ),

      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        surfaceTintColor: Colors.transparent,
        shape: const ContinuousRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheet),
          ),
        ),
      ),

      // -----------------------------------------------------------------------
      // SnackBar, Divider, Tooltip
      // -----------------------------------------------------------------------
      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
        ),
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadius.rRow,
        ),
        behavior: SnackBarBehavior.floating,
      ),

      dividerTheme: DividerThemeData(
        color: scheme.outline.withValues(alpha: 0.4),
        thickness: 1,
        space: 1,
      ),

      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: AppRadius.rRow,
          border: Border.all(color: scheme.outline),
        ),
        // `??`-resolved, so this style (not the TextTheme) is what a tooltip
        // renders: bodySmall is 11sp, under the DESIGN_RUBRIC §0 12sp floor.
        // bodyMedium is the same body role at 12sp with the sanctioned height.
        textStyle: textTheme.bodyMedium?.copyWith(color: scheme.onSurface),
      ),

      // -----------------------------------------------------------------------
      // Page transitions — Lift & Settle (cubic-bezier(.4,0,.2,1), 800ms)
      // -----------------------------------------------------------------------
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: LiftSettleTransitionsBuilder(),
          TargetPlatform.iOS: LiftSettleTransitionsBuilder(),
        },
      ),

      // -----------------------------------------------------------------------
      // Visual density — comfortable for teacher use on low-end phones
      // -----------------------------------------------------------------------
      visualDensity: VisualDensity.adaptivePlatformDensity,
    );
  }
}