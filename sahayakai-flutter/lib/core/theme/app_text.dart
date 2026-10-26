import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography — design system v2 (`type` family in `tokens.json`).
///
///   • **Bricolage Grotesque** (display) — titles, field values, card titles,
///     CTAs. Its optical size follows the font size, as CSS
///     `font-optical-sizing: auto` does: every display style carries an
///     `opsz` axis value equal to its size ([_opsz]).
///   • **Instrument Sans** (ui) — everything else.
///
/// Both fall back through the Noto Sans family of each Indian script, in the
/// order `tokens.json` lists them, so a mixed line ("Script in हिन्दी") shapes
/// with no per-string work. All 11 families are bundled (pubspec
/// `flutter.fonts`); nothing is fetched at runtime.
///
/// The v2 app scale is exposed exactly, under its token names, as
/// [AppTypeTokens] (`AppTypeTokens.of(context).eyebrow`). The 15 M3
/// [TextTheme] slots map onto those tokens, so every existing widget inherits
/// v2 without call-site churn:
///
///   displayLarge  type-hero-app 28     titleMedium   type-card-title 15
///   displayMedium type-screen-title 26 titleSmall    type-value 14
///   headlineLarge type-screen-title 26 bodyLarge     (14/400 ui, web-body)
///   displaySmall  type-page-title 22   bodyMedium    type-body 12
///   titleLarge    type-page-title 22   bodySmall     type-body-sm 11
///   headlineMedium type-output-title 20 labelLarge   type-cta 15
///   headlineSmall type-stat 18         labelMedium   type-label 12
///                                      labelSmall    type-pill 10
///
/// TWO DELIBERATE HOLDS, both flagged in the PR:
///   • Small type. 10–11px Latin (pills, eyebrows, sublines) is v2-exact and
///     an OPEN founder decision ("the small-type floor"). Kept exact here.
///     Chrome that `ThemeData` resolves with `??` (app bar, buttons, snack
///     bar, tooltip) stays at 12sp or more — the repo's DESIGN_RUBRIC §0
///     gate (`app_theme_test.dart`) — so the tooltip uses type-label (12).
///   • Chrome line height. v2 draws the CTA at line-height 1 and the page
///     title at 1.2; the repo's Indic-clipping class gate (DESIGN_RUBRIC §12,
///     founder-reported) floors every `??`-resolved chrome style at 1.25. Size,
///     weight, tracking and face are exact; only those two line heights hold
///     at 1.25.
///
/// INDIC ([isIndic]): v2's script rules — 10px roles (eyebrows, pills, field
/// labels) render at 12px, never tracked or uppercased; reading text gets a
/// 1.7 line height; everything else rises so matras never collide.

/// The display face (`--font-display`).
const String kDisplayFamily = 'Bricolage Grotesque';

/// The UI face (`--font-ui`).
const String kUiFamily = 'Instrument Sans';

/// The Noto Sans fallback chain, in `tokens.json` order.
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

/// The v2 app type tokens, by name.
enum AppTypeToken {
  heroApp,
  screenTitle,
  pageTitle,
  outputTitle,
  cardTitle,
  quote,
  value,
  tileTitle,
  stat,
  cta,
  ctaSm,
  reading,
  body,
  label,
  labelStrong,
  chip,
  button,
  bodySm,
  chipSm,
  action,
  status,
  pill,
  eyebrow,
  caption,
}

class AppText {
  AppText._();

  static const List<FontFeature> _tabular = [
    FontFeature.tabularFigures(),
    FontFeature.liningFigures(),
  ];

  /// Bricolage's `opsz` axis spans 12–96; CSS sets it to the font size.
  static List<FontVariation> _opsz(double size) => [
    FontVariation('opsz', size.clamp(12, 96).toDouble()),
  ];

  /// A display (Bricolage) style. [em] is CSS letter-spacing in em.
  static TextStyle _display(
    double size,
    FontWeight weight,
    double height, {
    double em = 0,
    Color? color,
    List<FontFeature>? features,
  }) => TextStyle(
    fontFamily: kDisplayFamily,
    fontFamilyFallback: kIndicSansFallback,
    fontSize: size,
    fontWeight: weight,
    height: height,
    letterSpacing: em * size,
    color: color,
    fontFeatures: features,
    fontVariations: _opsz(size),
  );

  /// A UI (Instrument Sans) style.
  static TextStyle _ui(
    double size,
    FontWeight weight,
    double height, {
    double em = 0,
    Color? color,
    List<FontFeature>? features,
  }) => TextStyle(
    fontFamily: kUiFamily,
    fontFamilyFallback: kIndicSansFallback,
    fontSize: size,
    fontWeight: weight,
    height: height,
    letterSpacing: em * size,
    color: color,
    fontFeatures: features,
  );

  /// The v2 app scale for [s]. Latin values are `tokens.json` exactly; Indic
  /// applies the script rules from the class doc.
  static Map<AppTypeToken, TextStyle> tokens(
    ColorScheme s, {
    required bool isIndic,
  }) {
    final strong = s.onSurface;
    final body = s.onSurfaceVariant;
    final eyebrowInk = s.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.textEyebrow;

    // Latin line height, or the Indic one.
    double h(double latin, double indic) => isIndic ? indic : latin;
    // 10px roles render at 12px in Indic scripts.
    double small(double latin) => isIndic && latin < 12 ? 12 : latin;
    // Indic is never tracked.
    double track(double em) => isIndic ? 0 : em;

    return {
      AppTypeToken.heroApp: _display(28, FontWeight.w700, h(1.14, 1.4), em: track(-0.012), color: strong),
      AppTypeToken.screenTitle: _display(26, FontWeight.w700, h(1.16, 1.4), em: track(-0.012), color: strong),
      AppTypeToken.pageTitle: _display(22, FontWeight.w700, h(1.2, 1.42), color: strong),
      AppTypeToken.outputTitle: _display(20, FontWeight.w700, h(1.22, 1.45), em: track(-0.01), color: strong),
      AppTypeToken.cardTitle: _display(15, FontWeight.w600, h(1.3, 1.5), color: strong),
      AppTypeToken.quote: _display(15, FontWeight.w600, h(1.45, 1.7), color: strong),
      AppTypeToken.value: _display(14, FontWeight.w600, h(1.3, 1.7), color: strong),
      AppTypeToken.tileTitle: _display(13, FontWeight.w600, h(1.3, 1.5), color: strong),
      AppTypeToken.stat: _display(18, FontWeight.w700, h(1.2, 1.4), color: strong, features: _tabular),
      AppTypeToken.cta: _display(15, FontWeight.w600, h(1, 1.4), color: strong),
      AppTypeToken.ctaSm: _display(14, FontWeight.w600, h(1, 1.4), color: strong),
      AppTypeToken.reading: _ui(12, FontWeight.w400, h(1.6, 1.7), color: strong),
      AppTypeToken.body: _ui(12, FontWeight.w400, h(1.55, 1.7), color: body),
      AppTypeToken.label: _ui(12, FontWeight.w500, h(1.4, 1.5), color: strong),
      AppTypeToken.labelStrong: _ui(12, FontWeight.w600, h(1.4, 1.5), color: strong),
      AppTypeToken.chip: _ui(12, FontWeight.w600, h(1.3, 1.5), color: strong),
      AppTypeToken.button: _ui(13, FontWeight.w600, h(1, 1.4), color: strong),
      AppTypeToken.bodySm: _ui(small(11), FontWeight.w400, h(1.45, 1.7), color: body),
      AppTypeToken.chipSm: _ui(small(11), FontWeight.w600, h(1.3, 1.5), color: strong),
      AppTypeToken.action: _ui(small(11), FontWeight.w600, h(1.4, 1.5), color: eyebrowInk),
      AppTypeToken.status: _ui(small(11), FontWeight.w500, h(1.4, 1.5), color: body),
      AppTypeToken.pill: _ui(small(10), FontWeight.w600, h(1.22, 1.5), color: strong),
      AppTypeToken.eyebrow: _ui(small(10), FontWeight.w600, h(1.22, 1.5), em: track(0.16), color: eyebrowInk),
      AppTypeToken.caption: _ui(small(10), FontWeight.w400, h(1.4, 1.5), color: body),
    };
  }

  static TextTheme build(ColorScheme s, {required bool isIndic}) {
    final t = tokens(s, isIndic: isIndic);
    // Chrome slots `??`-resolved by ThemeData hold the 1.25 Indic-safety
    // floor (see the class doc); the Indic value is already above it.
    TextStyle chrome(TextStyle style) => (style.height ?? 0) < 1.25
        ? style.copyWith(height: 1.25)
        : style;

    return TextTheme(
      displayLarge: t[AppTypeToken.heroApp],
      displayMedium: t[AppTypeToken.screenTitle],
      displaySmall: t[AppTypeToken.pageTitle],
      headlineLarge: t[AppTypeToken.screenTitle],
      headlineMedium: t[AppTypeToken.outputTitle],
      headlineSmall: t[AppTypeToken.stat]!.copyWith(fontFeatures: const []),
      titleLarge: chrome(t[AppTypeToken.pageTitle]!),
      titleMedium: t[AppTypeToken.cardTitle],
      titleSmall: t[AppTypeToken.value],
      // No 14px body on the v2 app scale; this is the website body
      // (type-web-body 14/400/1.6), the nearest v2 token.
      bodyLarge: _ui(14, FontWeight.w400, isIndic ? 1.7 : 1.6, color: s.onSurface),
      bodyMedium: t[AppTypeToken.body]!.copyWith(color: s.onSurface),
      bodySmall: t[AppTypeToken.bodySm],
      labelLarge: chrome(t[AppTypeToken.cta]!),
      labelMedium: t[AppTypeToken.label],
      labelSmall: t[AppTypeToken.pill],
    );
  }

  /// The additive editorial slots, on the same scheme/isIndic path.
  static AppTextExtras buildExtras(ColorScheme s, {required bool isIndic}) {
    final t = tokens(s, isIndic: isIndic);
    return AppTextExtras(
      displayHero: t[AppTypeToken.heroApp]!,
      lead: _ui(14, FontWeight.w400, isIndic ? 1.7 : 1.6, color: s.onSurfaceVariant),
      eyebrow: t[AppTypeToken.eyebrow]!,
      // The field label: an eyebrow tracked .14em instead of .16em.
      overline: t[AppTypeToken.eyebrow]!.copyWith(
        letterSpacing: isIndic ? 0 : 0.14 * 10,
      ),
      // type-metric (26/700/1.05, −.02em), tabular so counters never reflow.
      dataLarge: _display(26, FontWeight.w700, isIndic ? 1.32 : 1.05,
          em: isIndic ? 0 : -0.02, color: s.onSurface, features: _tabular),
      dataMedium: t[AppTypeToken.value]!.copyWith(fontFeatures: _tabular),
    );
  }

  static AppTypeTokens buildTokens(ColorScheme s, {required bool isIndic}) =>
      AppTypeTokens(tokens(s, isIndic: isIndic));
}

/// The v2 app type scale under its token names, as a theme extension:
/// `AppTypeTokens.of(context).cardTitle`.
@immutable
class AppTypeTokens extends ThemeExtension<AppTypeTokens> {
  const AppTypeTokens(this._styles);

  final Map<AppTypeToken, TextStyle> _styles;

  TextStyle operator [](AppTypeToken token) => _styles[token]!;

  TextStyle get heroApp => this[AppTypeToken.heroApp];
  TextStyle get screenTitle => this[AppTypeToken.screenTitle];
  TextStyle get pageTitle => this[AppTypeToken.pageTitle];
  TextStyle get outputTitle => this[AppTypeToken.outputTitle];
  TextStyle get cardTitle => this[AppTypeToken.cardTitle];
  TextStyle get quote => this[AppTypeToken.quote];
  TextStyle get value => this[AppTypeToken.value];
  TextStyle get tileTitle => this[AppTypeToken.tileTitle];
  TextStyle get stat => this[AppTypeToken.stat];
  TextStyle get cta => this[AppTypeToken.cta];
  TextStyle get ctaSm => this[AppTypeToken.ctaSm];
  TextStyle get reading => this[AppTypeToken.reading];
  TextStyle get body => this[AppTypeToken.body];
  TextStyle get label => this[AppTypeToken.label];
  TextStyle get labelStrong => this[AppTypeToken.labelStrong];
  TextStyle get chip => this[AppTypeToken.chip];
  TextStyle get button => this[AppTypeToken.button];
  TextStyle get bodySm => this[AppTypeToken.bodySm];
  TextStyle get chipSm => this[AppTypeToken.chipSm];
  TextStyle get action => this[AppTypeToken.action];
  TextStyle get status => this[AppTypeToken.status];
  TextStyle get pill => this[AppTypeToken.pill];
  TextStyle get eyebrow => this[AppTypeToken.eyebrow];
  TextStyle get caption => this[AppTypeToken.caption];

  /// Reads the extension off the ambient theme; falls back to the Latin
  /// scale if (unexpectedly) unregistered, so call sites are never null.
  static AppTypeTokens of(BuildContext context) {
    final theme = Theme.of(context);
    return theme.extension<AppTypeTokens>() ??
        AppText.buildTokens(theme.colorScheme, isIndic: false);
  }

  @override
  AppTypeTokens copyWith({Map<AppTypeToken, TextStyle>? styles}) =>
      AppTypeTokens(styles ?? _styles);

  @override
  AppTypeTokens lerp(covariant ThemeExtension<AppTypeTokens>? other, double t) {
    if (other is! AppTypeTokens) return this;
    return AppTypeTokens({
      for (final token in AppTypeToken.values)
        token: TextStyle.lerp(this[token], other[token], t)!,
    });
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

  /// Login / onboarding hero (type-hero-app 28/700).
  final TextStyle displayHero;

  /// Standfirst under a hero (14/400 ui, body ink).
  final TextStyle lead;

  /// Section label ("YOUR TEACHING TOOLS") — type-eyebrow, saffron-600,
  /// tracked, UPPERCASE Latin only.
  final TextStyle eyebrow;

  /// Field label / micro-meta — the eyebrow tracked .14em.
  final TextStyle overline;

  /// Big number moment (score, count) — type-metric, tabular.
  final TextStyle dataLarge;

  /// Inline data ("0 / 1000", "Class 12") — type-value, tabular.
  final TextStyle dataMedium;

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
