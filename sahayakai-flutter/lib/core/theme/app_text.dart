import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Typography — PREMIUM_DESIGN_SPEC.md §3 (LOCKED). Two families, one
/// Indic-safe DUAL fallback strategy. **Outfit is retired.**
///   • Fraunces (400/500/600) — editorial serif; every brand/human/masthead
///     moment: display slots + titleLarge + the `displayHero`/`dataLarge` extras.
///   • Inter (400–700) — all functional UI, body, labels, data (+ tabular).
///
/// The 15 M3 `TextTheme` slot names are preserved, so every current widget and
/// all 747 tests inherit the new look for free; editorial extras are additive
/// opt-ins exposed via a `ThemeExtension<AppTextExtras>` built on the same
/// `scheme`/`isIndic` path as `AppTheme`.

/// Serif fallback per Indic script — Fraunces styles degrade to Noto Serif.
const List<String> kIndicSerifFallback = [
  'Noto Serif Devanagari',
  'Noto Serif Bengali',
  'Noto Serif Tamil',
  'Noto Serif Telugu',
  'Noto Serif Kannada',
  'Noto Serif Malayalam',
  'Noto Serif Gujarati',
  'Noto Serif Gurmukhi',
  'Noto Serif Oriya',
];

/// Sans fallback per Indic script — Inter styles degrade to Noto Sans.
const List<String> kIndicSansFallback = [
  'Noto Sans Devanagari',
  'Noto Sans Bengali',
  'Noto Sans Tamil',
  'Noto Sans Telugu',
  'Noto Sans Kannada',
  'Noto Sans Malayalam',
  'Noto Sans Gujarati',
  'Noto Sans Gurmukhi',
  'Noto Sans Oriya',
];

/// Back-compat alias (the app referenced a single `kIndicFallback`).
const List<String> kIndicFallback = kIndicSansFallback;

/// Call once at startup so every family is registered before it is referenced
/// as a `fontFamilyFallback`. Warms all 20 families (Inter, Fraunces, 9 Noto
/// Sans, 9 Noto Serif). If a serif fails to resolve for a script the chain
/// degrades to Noto Sans / Inter — never a tofu box.
///
/// foundation-v1 uses google_fonts RUNTIME fetch (fonts stream on first use);
/// bundling the TTFs as offline assets is a deferred hardening task.
void warmIndicFonts() {
  // Latin primaries
  GoogleFonts.inter();
  GoogleFonts.fraunces();
  // Sans Indic
  GoogleFonts.notoSansDevanagari();
  GoogleFonts.notoSansBengali();
  GoogleFonts.notoSansTamil();
  GoogleFonts.notoSansTelugu();
  GoogleFonts.notoSansKannada();
  GoogleFonts.notoSansMalayalam();
  GoogleFonts.notoSansGujarati();
  GoogleFonts.notoSansGurmukhi();
  GoogleFonts.notoSansOriya();
  // Serif Indic
  GoogleFonts.notoSerifDevanagari();
  GoogleFonts.notoSerifBengali();
  GoogleFonts.notoSerifTamil();
  GoogleFonts.notoSerifTelugu();
  GoogleFonts.notoSerifKannada();
  GoogleFonts.notoSerifMalayalam();
  GoogleFonts.notoSerifGujarati();
  GoogleFonts.notoSerifGurmukhi();
  GoogleFonts.notoSerifOriya();
}

/// Fraunces (serif) display + Inter (sans) structure/body. Pass [isIndic] true
/// when the active locale uses an Indic script to raise line-heights so matras
/// / conjuncts never clip (§3.2 floors). See PREMIUM_DESIGN_SPEC.md §3.3 for
/// the exact per-slot scale.
class AppText {
  AppText._();

  static const List<FontFeature> _tabular = [
    FontFeature.tabularFigures(),
    FontFeature.liningFigures(),
  ];

  static TextTheme build(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    final onV = s.onSurfaceVariant;
    double h(double latin, double indic) => isIndic ? indic : latin;

    TextStyle serif(double size, FontWeight w, double lh,
            {Color? c, double ls = 0, List<FontFeature>? feats}) =>
        GoogleFonts.fraunces(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
          fontFeatures: feats,
        ).copyWith(fontFamilyFallback: kIndicSerifFallback);
    TextStyle sans(double size, FontWeight w, double lh,
            {Color? c, double ls = 0, List<FontFeature>? feats}) =>
        GoogleFonts.inter(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
          fontFeatures: feats,
        ).copyWith(fontFamilyFallback: kIndicSansFallback);

    return TextTheme(
      // --- Fraunces (editorial serif) ---
      displayLarge: serif(32, FontWeight.w600, h(1.15, 1.32), ls: -0.5),
      displayMedium: serif(26, FontWeight.w600, h(1.20, 1.35), ls: -0.4),
      displaySmall: serif(22, FontWeight.w500, h(1.25, 1.40), ls: -0.3),
      headlineLarge: serif(26, FontWeight.w600, h(1.20, 1.35), ls: -0.4),
      titleLarge: serif(21, FontWeight.w600, h(1.25, 1.42), ls: -0.2),
      // --- Inter (grotesque structure & body) ---
      headlineMedium: sans(20, FontWeight.w600, h(1.30, 1.45), ls: -0.2),
      headlineSmall: sans(18, FontWeight.w600, h(1.35, 1.50), ls: -0.1),
      titleMedium: sans(16, FontWeight.w600, h(1.40, 1.50)),
      titleSmall: sans(14, FontWeight.w600, h(1.40, 1.50), ls: 0.2),
      bodyLarge: sans(16, FontWeight.w400, h(1.60, 1.75)),
      bodyMedium: sans(14, FontWeight.w400, h(1.55, 1.70), c: onS),
      bodySmall: sans(13, FontWeight.w400, h(1.50, 1.70), c: onV),
      labelLarge: sans(15, FontWeight.w600, h(1.30, 1.45), ls: 0.1),
      labelMedium: sans(13, FontWeight.w500, h(1.40, 1.50), ls: 0.1),
      labelSmall: sans(12, FontWeight.w500, h(1.40, 1.50), ls: 0.2),
    );
  }

  /// The additive editorial slots (§3.3). Built on the SAME scheme/isIndic path
  /// so `AppTheme.withIndic` keeps them in sync with the TextTheme.
  static AppTextExtras buildExtras(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    final saffronText =
        s.brightness == Brightness.dark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    double h(double latin, double indic) => isIndic ? indic : latin;

    TextStyle serif(double size, FontWeight w, double lh,
            {Color? c, double ls = 0, List<FontFeature>? feats}) =>
        GoogleFonts.fraunces(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
          fontFeatures: feats,
        ).copyWith(fontFamilyFallback: kIndicSerifFallback);
    TextStyle sans(double size, FontWeight w, double lh,
            {Color? c, double ls = 0, List<FontFeature>? feats}) =>
        GoogleFonts.inter(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
          fontFeatures: feats,
        ).copyWith(fontFamilyFallback: kIndicSansFallback);

    return AppTextExtras(
      displayHero: serif(40, FontWeight.w600, h(1.12, 1.32), ls: -0.8),
      lead: sans(17, FontWeight.w400, h(1.50, 1.65)),
      // Eyebrow / overline colour = saffron TEXT token; the widget applies
      // UPPERCASE for Latin only (unicameral Indic leans on tracking + saffron).
      eyebrow: sans(12, FontWeight.w700, h(1.40, 1.50), ls: 1.2, c: saffronText),
      overline: sans(12, FontWeight.w600, h(1.40, 1.50), ls: 0.8, c: saffronText),
      // A serif numeral reads like a diploma; tabular so counters never reflow.
      dataLarge: serif(28, FontWeight.w600, 1.10, ls: -0.3, feats: _tabular),
      dataMedium: sans(15, FontWeight.w500, h(1.40, 1.40), feats: _tabular),
    );
  }
}

/// Additive editorial text slots that sit alongside the 15 M3 slots. Reached
/// via `AppTextExtras.of(context)` or `Theme.of(context).extension<...>()`.
@immutable
class AppTextExtras extends ThemeExtension<AppTextExtras> {
  const AppTextExtras({
    required this.displayHero,
    required this.lead,
    required this.eyebrow,
    required this.overline,
    required this.dataLarge,
    required this.dataMedium,
  });

  /// login / onboarding hero (Fraunces 40/600).
  final TextStyle displayHero;

  /// deck / standfirst under a hero (Inter 17/400).
  final TextStyle lead;

  /// section label ("YOUR TEACHING TOOLS") — saffron, tracked, UPPERCASE Latin.
  final TextStyle eyebrow;

  /// micro-meta ("OPTIONAL", category) — saffron, tracked, UPPERCASE Latin.
  final TextStyle overline;

  /// big number moment (score, count) — Fraunces 28/600 tabular.
  final TextStyle dataLarge;

  /// inline data ("0 / 1000", "Class 12") — Inter 15/500 tabular.
  final TextStyle dataMedium;

  /// Reads the extension off the ambient theme; falls back to a scheme-derived
  /// default if (unexpectedly) unregistered, so call sites are never null.
  static AppTextExtras of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<AppTextExtras>() ??
        AppText.buildExtras(theme.colorScheme, isIndic: false);
  }

  @override
  AppTextExtras copyWith({
    TextStyle? displayHero,
    TextStyle? lead,
    TextStyle? eyebrow,
    TextStyle? overline,
    TextStyle? dataLarge,
    TextStyle? dataMedium,
  }) =>
      AppTextExtras(
        displayHero: displayHero ?? this.displayHero,
        lead: lead ?? this.lead,
        eyebrow: eyebrow ?? this.eyebrow,
        overline: overline ?? this.overline,
        dataLarge: dataLarge ?? this.dataLarge,
        dataMedium: dataMedium ?? this.dataMedium,
      );

  @override
  AppTextExtras lerp(covariant ThemeExtension<AppTextExtras>? other, double t) {
    if (other is! AppTextExtras) return this;
    return AppTextExtras(
      displayHero: TextStyle.lerp(displayHero, other.displayHero, t)!,
      lead: TextStyle.lerp(lead, other.lead, t)!,
      eyebrow: TextStyle.lerp(eyebrow, other.eyebrow, t)!,
      overline: TextStyle.lerp(overline, other.overline, t)!,
      dataLarge: TextStyle.lerp(dataLarge, other.dataLarge, t)!,
      dataMedium: TextStyle.lerp(dataMedium, other.dataMedium, t)!,
    );
  }
}
