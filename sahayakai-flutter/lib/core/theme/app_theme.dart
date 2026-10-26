import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../shared/motion/lift_settle_transitions.dart';
import 'app_colors.dart';
import 'app_glass.dart';
import 'app_icon_size.dart';
import 'app_radius.dart';
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
    show
        kDisplayFamily,
        kUiFamily,
        kIndicFallback,
        kIndicSansFallback,
        AppText,
        AppTextExtras,
        AppTypeToken,
        AppTypeTokens;

/// SahayakAI Material 3 theme — design system v2 (the v3 mobile design).
///
/// LIGHT maps the v2 tokens onto the M3 `ColorScheme` roles (`primary` =
/// `saffron-500`, `onSurface` = `ink-900`, `secondary` = `leaf-500`,
/// `tertiary` = `indigo-500`, `error` = `red-500`) and draws the v2 component
/// language: pills for everything pressable, glass cards on the wash, solid
/// `surface-card` sheets.
///
/// The light scaffold is TRANSPARENT: every page route paints the v2 screen
/// wash (`wash-screen` + `glow-saffron`) under its own page, from the page
/// transition (`LiftSettleTransitionsBuilder` → `ScreenWash`), so glass reads
/// as glass on every screen and a pushed page still covers the one beneath.
///
/// DARK is an open founder decision (v2 defines no dark theme), so its colours
/// are the pre-v2 values; only type and shape follow v2.
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  /// Rebuild the theme for an Indic locale (v2 script rules: 10px roles at
  /// 12px, reading text at 1.7, no tracking).
  ///
  /// Re-runs the WHOLE [_build] instead of `copyWith(textTheme:)`, because
  /// Flutter resolves component text styles — `appBarTheme.titleTextStyle`,
  /// `navigationBarTheme.labelTextStyle`, `snackBarTheme.contentTextStyle`,
  /// `tooltipTheme.textStyle`, `ButtonStyle.textStyle` — with `??`: it takes the
  /// component's style INSTEAD of the TextTheme's, it does not merge the two.
  /// Swapping only `textTheme` therefore stranded the AppBar and the bottom nav
  /// — the chrome on EVERY screen — on Latin metrics in all 10 Indic locales,
  /// clipping Bengali/Tamil/Malayalam matras. See DESIGN_RUBRIC §12.
  ///
  /// [_build] is the single construction path and every component style below is
  /// derived from [textTheme], so the two cannot drift apart again.
  static ThemeData withIndic(ThemeData base) =>
      _build(base.brightness, isIndic: true);

  static ThemeData _build(Brightness b, {bool isIndic = false}) {
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
            errorContainer: AppColors.dErrorContainer,
            onErrorContainer: AppColors.dOnErrorContainer,
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
            primary: AppColors.saffron500,
            onPrimary: AppColors.textOnAccent,
            primaryContainer: AppColors.saffron100,
            onPrimaryContainer: AppColors.saffron700,
            secondary: AppColors.leaf500,
            onSecondary: AppColors.textOnAccent,
            secondaryContainer: AppColors.leaf100,
            onSecondaryContainer: AppColors.leaf700,
            tertiary: AppColors.indigo500,
            onTertiary: AppColors.textOnAccent,
            tertiaryContainer: AppColors.indigo100,
            onTertiaryContainer: AppColors.indigo500,
            error: AppColors.red500,
            onError: AppColors.textOnAccent,
            errorContainer: AppColors.redRow,
            onErrorContainer: AppColors.red700,
            surface: AppColors.surfaceCard,
            onSurface: AppColors.textStrong,
            surfaceContainerLowest: AppColors.lBackground,
            surfaceContainerLow: AppColors.surfaceInset,
            surfaceContainer: AppColors.milk400,
            surfaceContainerHigh: AppColors.stone100,
            surfaceContainerHighest: AppColors.borderControl,
            onSurfaceVariant: AppColors.textBody,
            outline: AppColors.borderRow,
            outlineVariant: AppColors.borderHairline,
            surfaceTint: AppColors.saffron500,
            inverseSurface: AppColors.ink800,
            onInverseSurface: AppColors.milk100,
            shadow: AppColors.ink900,
            scrim: AppColors.scrim,
          );

    final textTheme = AppText.build(scheme, isIndic: isIndic);
    final textExtras = AppText.buildExtras(scheme, isIndic: isIndic);
    final typeTokens = AppText.buildTokens(scheme, isIndic: isIndic);

    // The quiet pill buttons (secondary / outline / quiet) set their label in
    // the UI face at 13px (type-button). Its v2 line height is 1; chrome holds
    // the 1.25 Indic-safety floor (see AppText).
    final quietLabel = typeTokens.button.copyWith(
      height: isIndic ? typeTokens.button.height : 1.25,
    );

    const pill = StadiumBorder();

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      // Light: transparent, so the route's ScreenWash shows (see class doc).
      // Dark: the solid pre-v2 ground.
      scaffoldBackgroundColor: isDark
          ? scheme.surfaceContainerLowest
          : Colors.transparent,
      canvasColor: isDark ? null : AppColors.surfaceCard,
      shadowColor: AppColors.shadowBase,
      textTheme: textTheme,
      // Both extensions derive from the same scheme/isIndic path, so
      // AppTheme.withIndic() rebuilds them in lockstep with the TextTheme.
      extensions: [textExtras, typeTokens],
      splashFactory: InkRipple.splashFactory,
      focusColor: isDark ? null : AppColors.accentTint,
      appBarTheme: AppBarTheme(
        backgroundColor: isDark
            ? scheme.surfaceContainerLowest
            : AppColors.surfaceChrome,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: isDark ? 2 : 0,
        shadowColor: AppColors.shadowBase,
        centerTitle: false,
        // type-page-title — derived rather than re-declared, so the Indic
        // line-height follows the locale.
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      // v2 Button `primary` md: saffron-500 pill, white label (3.77:1,
      // flagged), 50px (`button-height`), 18px side padding.
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 50)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18),
          ),
          shape: const WidgetStatePropertyAll(pill),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          elevation: const WidgetStatePropertyAll(0),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 50)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18),
          ),
          shape: const WidgetStatePropertyAll(pill),
          elevation: const WidgetStatePropertyAll(1),
          shadowColor: WidgetStatePropertyAll(
            isDark ? AppColors.shadowBase : AppColors.saffron500,
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      // v2 Button `outline`: transparent, `border-control` edge, body ink,
      // the UI face at 13px.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(
            isDark ? scheme.onSurface : AppColors.textBody,
          ),
          minimumSize: const WidgetStatePropertyAll(Size(0, 46)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18),
          ),
          side: WidgetStatePropertyAll(
            BorderSide(
              color: isDark ? scheme.outlineVariant : AppColors.borderControl,
              width: 1,
            ),
          ),
          shape: const WidgetStatePropertyAll(pill),
          textStyle: WidgetStatePropertyAll(quietLabel),
        ),
      ),
      // Text actions: saffron as TEXT is saffron-600 (5.28:1), never 500.
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(
            isDark ? scheme.primary : AppColors.textLink,
          ),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          shape: const WidgetStatePropertyAll(pill),
          textStyle: WidgetStatePropertyAll(quietLabel),
        ),
      ),
      // v2 GlassCard: `surface-glass` with a 1px `border-glass` edge, flat.
      cardTheme: CardThemeData(
        color: isDark ? scheme.surface : AppColors.surfaceGlass,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: AppColors.shadowBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rCard,
          side: BorderSide(
            color: isDark ? scheme.outline : AppColors.borderGlass,
            width: 1,
          ),
        ),
      ),
      // v2 Field, for a bare TextField: the field card's strong glass and 1px
      // glass edge; focus = 2px saffron-500; error = 2px red-500. Inside a
      // LabeledField the card is drawn by the LabeledField and the input is
      // borderless (see labeled_field.dart).
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? scheme.surfaceContainerLow
            : AppColors.surfaceGlassStrong,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        hintStyle: isDark
            ? textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)
            : typeTokens.reading.copyWith(color: AppColors.textMuted),
        enabledBorder: OutlineInputBorder(
          borderRadius: isDark ? AppRadius.rControl : AppRadius.rCard,
          borderSide: BorderSide(
            color: isDark ? scheme.outlineVariant : AppColors.borderGlass,
            width: 1,
          ),
        ),
        border: OutlineInputBorder(
          borderRadius: isDark ? AppRadius.rControl : AppRadius.rCard,
          borderSide: BorderSide(
            color: isDark ? scheme.outlineVariant : AppColors.borderGlass,
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: isDark ? AppRadius.rControl : AppRadius.rCard,
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: isDark ? AppRadius.rControl : AppRadius.rCard,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: isDark ? AppRadius.rControl : AppRadius.rCard,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        errorStyle: isDark
            ? null
            : typeTokens.status.copyWith(color: AppColors.red700),
      ),
      // v2 Chip (choice, md): glass pill with a 1px glass edge, 12/600 UI
      // label; selected = a saffron-500 fill with a white label (3.77:1,
      // flagged with the primary button).
      chipTheme: ChipThemeData(
        backgroundColor: isDark
            ? scheme.surfaceContainerHigh
            : AppColors.surfaceGlass,
        selectedColor: isDark ? scheme.primaryContainer : AppColors.saffron500,
        checkmarkColor: isDark
            ? scheme.onPrimaryContainer
            : AppColors.textOnAccent,
        labelStyle: isDark
            ? textTheme.labelMedium?.copyWith(color: scheme.onSurface)
            : typeTokens.chip,
        secondaryLabelStyle: isDark
            ? textTheme.labelMedium?.copyWith(
                color: scheme.onPrimaryContainer,
                fontWeight: FontWeight.w600,
              )
            : typeTokens.chip.copyWith(color: AppColors.textOnAccent),
        // Light: v2 md padding (9px 14px) less the 1px edge Flutter paints
        // inside the shape, with no extra label inset.
        padding: isDark
            ? const EdgeInsets.symmetric(horizontal: 12, vertical: 4)
            : const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        labelPadding: isDark ? null : EdgeInsets.zero,
        shape: const StadiumBorder(),
        side: BorderSide(
          color: isDark ? scheme.outline : AppColors.borderGlass,
        ),
      ),
      // The app's own navigation is the v2 TabBar (`app_tab_bar.dart`); this
      // theme only serves any stray M3 NavigationBar.
      navigationBarTheme: NavigationBarThemeData(
        height: 56,
        backgroundColor: isDark
            ? scheme.surfaceContainerLowest
            : AppColors.surfaceChrome,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: AppIconSize.inline,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : (isDark ? scheme.onSurfaceVariant : AppColors.textMuted),
          ),
        ),
        // DESIGN_RUBRIC §0 floors label text at 12sp / height 1.4; derived from
        // `labelMedium` (type-label 12/500/1.4) so one rule governs.
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => textTheme.labelMedium?.copyWith(
            fontWeight: s.contains(WidgetState.selected)
                ? FontWeight.w600
                : FontWeight.w500,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          ),
        ),
      ),
      // v2 Sheet: solid `surface-card`, `radius-sheet` top corners. Dialogs
      // share the card surface at `radius-sheet`. Dark keeps its pre-v2 flat
      // glass.
      dialogTheme: DialogThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppColors.surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: AppGlass.shape(isDark ? AppRadius.card : AppRadius.sheet),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppColors.surfaceCard,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: isDark ? null : AppColors.scrim,
        dragHandleColor: isDark ? null : AppColors.borderControl,
        dragHandleSize: isDark ? null : const Size(44, 4),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheet),
          ),
        ),
      ),
      // v2 Toast: a `surface-capsule` pill with a `border-row` edge and ink
      // text. v2 sets it at 11px; the snack bar is `??`-resolved chrome, so it
      // holds the 12sp floor (type-label).
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? scheme.inverseSurface : AppColors.surfaceCapsule,
        contentTextStyle: isDark
            ? textTheme.bodyMedium?.copyWith(color: scheme.onInverseSurface)
            : textTheme.labelMedium?.copyWith(color: AppColors.textStrong),
        actionTextColor: isDark ? null : AppColors.textLink,
        shape: isDark
            ? const RoundedRectangleBorder(borderRadius: AppRadius.rMd)
            : const StadiumBorder(side: BorderSide(color: AppColors.borderRow)),
        elevation: isDark ? null : 0,
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: DividerThemeData(
        color: isDark ? scheme.outline.withValues(alpha: 0.6) : AppColors.borderRow,
        thickness: 1,
        space: 1,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: isDark ? scheme.surface : AppColors.surfaceCapsule,
          borderRadius: isDark ? AppRadius.rSm : AppRadius.rPill,
          border: Border.all(
            color: isDark ? scheme.outline : AppColors.borderRow,
          ),
        ),
        // type-label (12): the tooltip is `??`-resolved chrome (12sp floor).
        textStyle: textTheme.labelMedium?.copyWith(color: scheme.onSurface),
      ),
      // Lift-&-Settle push on both platforms (§4), which also paints each
      // page's v2 wash. Android's OS-driven predictive-back gesture is still
      // served natively (manifest enableOnBackInvokedCallback).
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: LiftSettleTransitionsBuilder(),
          TargetPlatform.iOS: LiftSettleTransitionsBuilder(),
        },
      ),
    );
  }
}
