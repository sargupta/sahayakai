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
    show kIndicFallback, kIndicSansFallback, AppText, AppTextExtras;

/// SahayakAI Material 3 theme — pixel-faithful port of the web design system.
/// See docs/flutter/THEME_SPEC.md for the full derivation.
///
/// NOTE ON `primary`: the brand saffron is the muted amber #E0924D (light) /
/// #EB9447 (dark) — sampled directly from the live production site
/// (getComputedStyle on sahayakai.com), which RENDERS the HSL `28 70% 59%`.
/// The `/* #FF9933 */` comment in the web globals.css is inaccurate; the app
/// matches what production actually displays, not the stale comment (see
/// [AppColors]). Everything else here is
/// ported verbatim from THEME_SPEC §7 (surfaceTint transparent on cards/menus,
/// scaffoldBackground = surfaceContainerLowest, buttons >=48dp radius 10, cards
/// radius 12, all TextStyle.height >= 1.4, Indic fallbacks).
class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  /// Rebuild the theme for an Indic locale (raised line-heights).
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
            // Warm error TINT container (not M3's default cool pink) so error
            // surfaces stay on-brand; onErrorContainer is 10.6:1 on it.
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
            // Warm error TINT container (not M3's default cool pink) so error
            // surfaces stay on-brand; onErrorContainer is 8.08:1 on it.
            errorContainer: AppColors.lErrorContainer,
            onErrorContainer: AppColors.lOnErrorContainer,
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

    final textTheme = AppText.build(scheme, isIndic: isIndic);
    final textExtras = AppText.buildExtras(scheme, isIndic: isIndic);

    return ThemeData(
      useMaterial3: true,
      brightness: b,
      colorScheme: scheme,
      // Solid paper ground; the barely-there warm wash (AppGradients.lightPaper
      // / darkVignette) is painted as a DecoratedBox by the scaffold wrapper,
      // never as scaffoldBackgroundColor (which must stay a solid Color).
      scaffoldBackgroundColor: scheme.surfaceContainerLowest,
      shadowColor: AppColors.shadowBase,
      textTheme: textTheme,
      // AppTextExtras is derived from the same scheme/isIndic path, so
      // AppTheme.withIndic() rebuilds it in lockstep with the TextTheme.
      extensions: [textExtras],
      splashFactory: InkRipple.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surfaceContainerLowest,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 2,
        shadowColor: AppColors.shadowBase,
        centerTitle: false,
        // Masthead: the display titleLarge (Outfit 21/600) — derived rather than
        // re-declared, so the Indic line-height follows the locale.
        titleTextStyle: textTheme.titleLarge,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 16),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.rMd),
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          elevation: const WidgetStatePropertyAll(0),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStatePropertyAll(scheme.primary),
          foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 16),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.rMd),
          ),
          elevation: const WidgetStatePropertyAll(1),
          shadowColor: WidgetStatePropertyAll(AppColors.shadowBase),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.onSurface),
          minimumSize: const WidgetStatePropertyAll(Size(0, 48)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 16),
          ),
          side: WidgetStatePropertyAll(
            BorderSide(color: scheme.outlineVariant, width: 1),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.rMd),
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          foregroundColor: WidgetStatePropertyAll(scheme.primary),
          minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.rMd),
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
        ),
      ),
      // §2.3: elevation 0 + surfaceTint transparent; depth is drawn as the
      // two-layer warm AppShadows on each widget's own DecoratedBox (AppCard),
      // because Material tonal elevation cannot express a two-layer shadow.
      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: AppColors.shadowBase,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rCard,
          side: BorderSide(color: scheme.outline, width: 1),
        ),
      ),
      // §5 LabeledField v2: filled with the grouped surface, control radius,
      // 16/16 content padding (~56dp), 2px saffron focus ring. The soft focus
      // GLOW (primary@0.14, spread 3) is drawn by LabeledField's own wrapper —
      // an InputDecoration cannot cast a shadow.
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        hintStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.rControl,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.rControl,
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.rControl,
          borderSide: BorderSide(
            color: scheme.primary,
            width: 2,
          ), // saffron ring
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rControl,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.rControl,
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
      ),
      // §5 chip: rest = surfaceContainerHigh fill + 1px outline + labelMedium
      // onSurface; selected = primaryContainer fill + onPrimaryContainer label
      // (border+fill suffice, so call sites pass showCheckmark:false). The 1.5px
      // selected saffron border is applied per-chip where choice chips render.
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        selectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.onPrimaryContainer,
        labelStyle: textTheme.labelMedium?.copyWith(color: scheme.onSurface),
        secondaryLabelStyle: textTheme.labelMedium?.copyWith(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
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
            size: AppIconSize.inline,
            color: s.contains(WidgetState.selected)
                ? scheme.primary
                : scheme.onSurfaceVariant,
          ),
        ),
        // DEVIATION FROM THEME_SPEC §5.5, which asks for a 10px label to match
        // the web's `text-[10px]`. DESIGN_RUBRIC §0 floors label text at 12sp /
        // height 1.4, and §12 (the merge gate) outranks web parity: a 10px label
        // with no height falls back to Inter's ~1.21 and clips Indic matras on
        // every screen. Derived from `labelMedium` (12/500, height 1.4 Latin /
        // 1.5 Indic) so one rule governs; only weight and colour vary by state.
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
      // App-wide Glassmorphism Reskin, GL-2: flat-glass fallback for anything
      // still relying on these theme defaults for its surface — the
      // delete-account `AlertDialog` (`delete_account_dialog.dart`, which
      // deliberately keeps its own `AlertDialog(...)` construction untouched
      // and relies on this theme default rather than hand-wrapping
      // `AlertDialog`'s own built-in chrome in a `GlassSurface`) and
      // `language_switcher.dart`'s `showDragHandle: true` sheet.
      //
      // DOCUMENTED TRADEOFF, not an oversight: `Dialog`/`BottomSheet`'s
      // `ThemeData` surface has no blur hook — there is no `BackdropFilter`
      // equivalent exposed on `DialogTheme`/`BottomSheetThemeData` — so the
      // most a theme-only edit can achieve is the FLAT half of the glass
      // system (a tuned translucent `AppGlass.l/dFlatFill` background +
      // `ContinuousRectangleBorder` squircle shape), not real blur. Any
      // surface that needs REAL blur draws itself with `GlassSurface`
      // directly instead of relying on this default (see `vidya_sheet.dart`,
      // `app_shell.dart`'s `_CreatePalette`, `GlassAppBar`,
      // `FloatingBottomNav`).
      dialogTheme: DialogThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        surfaceTintColor: Colors.transparent,
        shape: AppGlass.squircle(AppRadius.card),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        surfaceTintColor: Colors.transparent,
        // Top-corners-only squircle (`ContinuousRectangleBorder` takes any
        // `BorderRadiusGeometry`, not just a uniform one) — a bottom sheet
        // sits flush against the screen's bottom edge, same reasoning as the
        // `vidya_sheet.dart`/`_CreatePalette` corner-rounding decision.
        shape: const ContinuousRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.hero),
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.inverseSurface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: scheme.onInverseSurface,
        ),
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
        textStyle: textTheme.bodySmall?.copyWith(color: scheme.onSurface),
      ),
      // Lift-&-Settle push on both platforms (§4). Android's OS-driven
      // predictive-back gesture is still served natively (manifest
      // enableOnBackInvokedCallback); this builder governs the in-app push/pop.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: LiftSettleTransitionsBuilder(),
          TargetPlatform.iOS: LiftSettleTransitionsBuilder(),
        },
      ),
    );
  }
}
