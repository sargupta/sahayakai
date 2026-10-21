import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography — SahayakAI Design System v3 (canonical).
/// Two families, one Indic-safe fallback strategy.
///   • Bricolage Grotesque (500–700) — display; titles, card titles, CTAs, quoted speech.
///     Display tracking −.012 to −.03em. Matches the web `headline` family.
///   • Instrument Sans (400–700) — all functional UI, body, labels, chips, data.
///     Matches the web `body` family.
///
/// The 15 M3 `TextTheme` slot names are preserved, so every current widget and
/// all behavior tests inherit the new look for free; editorial extras are
/// additive opt-ins exposed via a `ThemeExtension<AppTextExtras>` built on the
/// same `scheme`/`isIndic` path as `AppTheme`.
///
/// FALLBACK: the web pairs BOTH Latin families with the Noto **Sans** Indic
/// block (`headline: [Bricolage Grotesque, "Noto Sans Devanagari", …]`,
/// `body: [Instrument Sans, "Noto Sans Devanagari", …]`).
///
/// BUNDLED, NOT FETCHED. Every family ships inside the APK via
/// `pubspec.yaml`'s `flutter.fonts` block (variable TTFs).
///
/// `kIndicSerifFallback` removed — never consumed as a `fontFamilyFallback`,
/// so bundling 9 more families would double Indic payload for nothing.

/// Sans fallback per Indic script — Bricolage Grotesque (display) and
/// Instrument Sans (body) both degrade to Noto Sans, matching the web.
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

/// Bricolage Grotesque (display) + Instrument Sans (structure/body).
/// Pass [isIndic] true when the active locale uses an Indic script to raise
/// line-heights so matras / conjuncts never clip.
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

    // Display family — Bricolage Grotesque, Noto Sans Indic fallback.
    TextStyle display(
      double size,
      FontWeight w,
      double lh, {
      Color? c,
      double ls = 0,
      List<FontFeature>? feats,
    }) => TextStyle(
      fontFamily: 'Bricolage Grotesque',
      fontSize: size,
      fontWeight: w,
      height: lh,
      letterSpacing: ls,
      color: c ?? onS,
      fontFeatures: feats,
    ).copyWith(fontFamilyFallback: kIndicSansFallback);

    // UI family — Instrument Sans, Noto Sans Indic fallback.
    TextStyle ui(
      double size,
      FontWeight w,
      double lh, {
      Color? c,
      double ls = 0,
      List<FontFeature>? feats,
    }) => TextStyle(
      fontFamily: 'Instrument Sans',
      fontSize: size,
      fontWeight: w,
      height: lh,
      letterSpacing: ls,
      color: c ?? onS,
      fontFeatures: feats,
    ).copyWith(fontFamilyFallback: kIndicSansFallback);

    return TextTheme(
      // --- Bricolage Grotesque (display / masthead) ---
      // Hero (onboarding): 700 28px/1.14
      displayLarge: display(28, FontWeight.w700, h(1.14, 1.25), ls: -0.8),
      // Screen title (home): 700 26px/1.16
      displayMedium: display(26, FontWeight.w700, h(1.16, 1.25), ls: -0.6),
      // Page title: 700 22px/1.2
      displaySmall: display(22, FontWeight.w700, h(1.20, 1.30), ls: -0.3),
      headlineLarge: display(22, FontWeight.w700, h(1.20, 1.30), ls: -0.3),
      // Card title: 600 15px/1.3
      titleLarge: display(15, FontWeight.w600, h(1.30, 1.40)),
      // Tile title: 600 13px/1.3
      titleMedium: display(13, FontWeight.w600, h(1.30, 1.40)),
      // Quote / speech: 600 15px/1.45
      titleSmall: display(15, FontWeight.w600, h(1.45, 1.55)),

      // --- Instrument Sans (UI / body) ---
      // Body: 400 12px/1.55
      bodyLarge: ui(14, FontWeight.w400, h(1.55, 1.70)),
      bodyMedium: ui(12, FontWeight.w400, h(1.55, 1.70), c: onS),
      bodySmall: ui(11, FontWeight.w400, h(1.45, 1.60), c: onV),
      // Label: 500 12px/1.4
      labelLarge: ui(15, FontWeight.w600, h(1.30, 1.40)),
      labelMedium: ui(12, FontWeight.w500, h(1.40, 1.50)),
      labelSmall: ui(10, FontWeight.w500, h(1.40, 1.50)),
      // Headline / title for UI contexts
      headlineMedium: ui(18, FontWeight.w600, h(1.35, 1.50), ls: -0.1),
      headlineSmall: ui(16, FontWeight.w600, h(1.35, 1.50), ls: -0.1),
    );
  }

  /// The additive editorial slots. Built on the SAME scheme/isIndic path
  /// so `AppTheme.withIndic` keeps them in sync with the TextTheme.
  static AppTextExtras buildExtras(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    final saffronText = s.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;
    double h(double latin, double indic) => isIndic ? indic : latin;

    TextStyle display(
      double size,
      FontWeight w,
      double lh, {
      Color? c,
      double ls = 0,
      List<FontFeature>? feats,
    }) => TextStyle(
      fontFamily: 'Bricolage Grotesque',
      fontSize: size,
      fontWeight: w,
      height: lh,
      letterSpacing: ls,
      color: c ?? onS,
      fontFeatures: feats,
    ).copyWith(fontFamilyFallback: kIndicSansFallback);

    TextStyle ui(
      double size,
      FontWeight w,
      double lh, {
      Color? c,
      double ls = 0,
      List<FontFeature>? feats,
    }) => TextStyle(
      fontFamily: 'Instrument Sans',
      fontSize: size,
      fontWeight: w,
      height: lh,
      letterSpacing: ls,
      color: c ?? onS,
      fontFeatures: feats,
    ).copyWith(fontFamilyFallback: kIndicSansFallback);

    return AppTextExtras(
      // Hero (onboarding): 700 28px/1.14, tracking -0.8
      displayHero: display(28, FontWeight.w700, h(1.14, 1.25), ls: -0.8),
      // Lead: 400 14px/1.6 (scaled from web 18px for mobile)
      lead: ui(14, FontWeight.w400, h(1.60, 1.75)),
      // Eyebrow / overline: 600 10px, UPPERCASE Latin, tracking +0.16em, saffron-600
      eyebrow: ui(
        10,
        FontWeight.w600,
        h(1.60, 1.70),
        ls: 1.6, // 0.16em at 10px = 1.6px
        c: saffronText,
      ),
      overline: ui(
        10,
        FontWeight.w600,
        h(1.60, 1.70),
        ls: 1.6,
        c: saffronText,
      ),
      // Data large: 700 26px/1.05 tabular (Outfit 28 → Bricolage 26 for mobile)
      dataLarge: display(26, FontWeight.w700, 1.05, ls: -0.3, feats: _tabular),
      // Data medium: 500 12px tabular
      dataMedium: ui(12, FontWeight.w500, h(1.40, 1.40), feats: _tabular),
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

  /// login / onboarding hero (Bricolage Grotesque 28/700).
  final TextStyle displayHero;

  /// deck / standfirst under a hero (Instrument Sans 14/400).
  final TextStyle lead;

  /// section label — saffron-600, tracked +0.16em, UPPERCASE Latin only.
  final TextStyle eyebrow;

  /// micro-meta — saffron-600, tracked +0.16em, UPPERCASE Latin only.
  final TextStyle overline;

  /// big number moment (score, count) — Bricolage Grotesque 26/700 tabular.
  final TextStyle dataLarge;

  /// inline data — Instrument Sans 12/500 tabular.
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
  }) => AppTextExtras(
    displayHero: displayHero ?? this.displayHero,
    lead: lead ?? this.lead,
    eyebrow: eyebrow ?? this.eyebrow,
    overline: overline ?? this.overline,
    dataLarge: dataLarge ?? this.dataLarge,
    dataMedium: dataMedium ?? this.dataMedium,
  );

  @override
  AppTextExtras lerp(ThemeExtension<AppTextExtras>? other, double t) {
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