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
/// One light theme. The design system retired dark mode on 26 Oct 2026
/// (guide 10, "Theme: light only"), so the app has no dark theme and no theme
/// switch; only the camera surface stays dark, and it paints its own ground.
///
/// The v2 tokens map onto the M3 `ColorScheme` roles (`primary` =
/// `saffron-500`, `onSurface` = `ink-900`, `secondary` = `leaf-500`,
/// `tertiary` = `indigo-500`, `error` = `red-500`) and the theme draws the v2
/// component language: pills for everything pressable, glass cards on the
/// wash, solid `surface-card` sheets.
///
/// `primary` is the brand ACCENT, `saffron-500`: the orb, mic discs, the
/// active tab disc, dots, bars and focus edges. A saffron fill that carries a
/// white label (buttons, selected chips) uses [AppColors.accentFill]
/// (`saffron-600`, 5.28:1) instead, because white on `saffron-500` is 3.77:1
/// (decided 26 Oct 2026).
///
/// The scaffold is TRANSPARENT: every page route paints the v2 screen wash
/// (`wash-screen` + `glow-saffron`) under its own page, from the page
/// transition (`LiftSettleTransitionsBuilder` → `ScreenWash`), so glass reads
/// as glass on every screen and a pushed page still covers the one beneath.
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build();

  /// Rebuild the theme for an Indic locale (v2 script rules: reading text at
  /// 1.7, no tracking).
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
  static ThemeData withIndic(ThemeData base) => _build(isIndic: true);

  static ThemeData _build({bool isIndic = false}) {
    const scheme = ColorScheme(
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
      brightness: Brightness.light,
      colorScheme: scheme,
      // Transparent, so the route's ScreenWash shows (see class doc).
      scaffoldBackgroundColor: Colors.transparent,
      canvasColor: AppColors.surfaceCard,
      shadowColor: AppColors.shadowBase,
      textTheme: textTheme,
      // Both extensions derive from the same scheme/isIndic path, so
      // AppTheme.withIndic() rebuilds them in lockstep with the TextTheme.
      extensions: [textExtras, typeTokens],
      splashFactory: InkRipple.splashFactory,
      focusColor: AppColors.accentTint,
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surfaceChrome,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: AppColors.shadowBase,
        centerTitle: false,
        // type-page-title — derived rather than re-declared, so the Indic
        // line-height follows the locale.
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      // v2 Button `primary` md: an `accent-fill` pill with a white label
      // (5.28:1), 50px (`button-height`), 18px side padding.
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: const WidgetStatePropertyAll(AppColors.accentFill),
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
          backgroundColor: const WidgetStatePropertyAll(AppColors.accentFill),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 50)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18),
          ),
          shape: const WidgetStatePropertyAll(pill),
          elevation: const WidgetStatePropertyAll(1),
          shadowColor: const WidgetStatePropertyAll(AppColors.saffron500),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      // v2 Button `outline`: transparent, `border-control` edge, body ink,
      // the UI face at 13px.
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: const WidgetStatePropertyAll(AppColors.textBody),
          minimumSize: const WidgetStatePropertyAll(Size(0, 46)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 18),
          ),
          side: const WidgetStatePropertyAll(
            BorderSide(color: AppColors.borderControl, width: 1),
          ),
          shape: const WidgetStatePropertyAll(pill),
          textStyle: WidgetStatePropertyAll(quietLabel),
        ),
      ),
      // Text actions: saffron as TEXT is saffron-600 (5.28:1), never 500.
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: const WidgetStatePropertyAll(AppColors.textLink),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          shape: const WidgetStatePropertyAll(pill),
          textStyle: WidgetStatePropertyAll(quietLabel),
        ),
      ),
      // v2 GlassCard: `surface-glass` with a 1px `border-glass` edge, flat.
      cardTheme: const CardThemeData(
        color: AppColors.surfaceGlass,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: AppColors.shadowBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rCard,
          side: BorderSide(color: AppColors.borderGlass, width: 1),
        ),
      ),
      // v2 Field, for a bare TextField: the field card's strong glass and 1px
      // glass edge; focus = 2px saffron-500; error = 2px red-500. Inside a
      // LabeledField the card is drawn by the LabeledField and the input is
      // borderless (see labeled_field.dart).
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceGlassStrong,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        hintStyle: typeTokens.reading.copyWith(color: AppColors.textMuted),
        enabledBorder: const OutlineInputBorder(
          borderRadius: AppRadius.rCard,
          borderSide: BorderSide(color: AppColors.borderGlass, width: 1),
        ),
        border: const OutlineInputBorder(
          borderRadius: AppRadius.rCard,
          borderSide: BorderSide(color: AppColors.borderGlass, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.rCard,
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rCard,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rCard,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        errorStyle: typeTokens.status.copyWith(color: AppColors.red700),
      ),
      // v2 Chip (choice, md): glass pill with a 1px glass edge, 12/600 UI
      // label; selected = an `accent-fill` pill with a white label (5.28:1).
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceGlass,
        selectedColor: AppColors.accentFill,
        checkmarkColor: AppColors.textOnAccent,
        labelStyle: typeTokens.chip,
        secondaryLabelStyle: typeTokens.chip.copyWith(
          color: AppColors.textOnAccent,
        ),
        // v2 md padding (9px 14px) less the 1px edge Flutter paints inside
        // the shape, with no extra label inset.
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        labelPadding: EdgeInsets.zero,
        shape: const StadiumBorder(),
        side: const BorderSide(color: AppColors.borderGlass),
      ),
      // The app's own navigation is the v2 TabBar (`app_tab_bar.dart`); this
      // theme only serves any stray M3 NavigationBar.
      navigationBarTheme: NavigationBarThemeData(
        height: 56,
        backgroundColor: AppColors.surfaceChrome,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        elevation: 0,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(
            size: AppIconSize.inline,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : AppColors.textMuted,
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
                ? AppColors.textLink
                : scheme.onSurfaceVariant,
          ),
        ),
      ),
      // v2 Sheet: solid `surface-card`, `radius-sheet` top corners. Dialogs
      // share the card surface at `radius-sheet`.
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceCard,
        surfaceTintColor: Colors.transparent,
        shape: AppGlass.shape(AppRadius.sheet),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceCard,
        surfaceTintColor: Colors.transparent,
        modalBarrierColor: AppColors.scrim,
        dragHandleColor: AppColors.borderControl,
        dragHandleSize: Size(44, 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.sheet),
          ),
        ),
      ),
      // v2 Toast: a `surface-capsule` pill with a `border-row` edge and ink
      // text. v2 sets it at 11px; the snack bar is `??`-resolved chrome, so it
      // holds the 12sp floor (type-label).
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surfaceCapsule,
        contentTextStyle: textTheme.labelMedium?.copyWith(
          color: AppColors.textStrong,
        ),
        actionTextColor: AppColors.textLink,
        shape: const StadiumBorder(side: BorderSide(color: AppColors.borderRow)),
        elevation: 0,
        behavior: SnackBarBehavior.floating,
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderRow,
        thickness: 1,
        space: 1,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: AppColors.surfaceCapsule,
          borderRadius: AppRadius.rPill,
          border: Border.all(color: AppColors.borderRow),
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
