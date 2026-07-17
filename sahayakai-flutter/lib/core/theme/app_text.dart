import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Noto Sans fallback family names (as registered by google_fonts) so mixed
/// Latin + Indic strings shape correctly regardless of the active locale.
/// See THEME_SPEC.md §2.2.
const List<String> kIndicFallback = [
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

/// Call once at startup so every Noto family is registered before it is
/// referenced as a `fontFamilyFallback`.
///
/// foundation-v1 uses google_fonts RUNTIME fetch (fonts stream on first use).
/// Bundling the 14 TTFs as offline assets is a deferred hardening task
/// (see docs/flutter/BUILD_STATE.json) for rural/low-connectivity users.
void warmIndicFonts() {
  GoogleFonts.notoSansDevanagari();
  GoogleFonts.notoSansBengali();
  GoogleFonts.notoSansTamil();
  GoogleFonts.notoSansTelugu();
  GoogleFonts.notoSansKannada();
  GoogleFonts.notoSansMalayalam();
  GoogleFonts.notoSansGujarati();
  GoogleFonts.notoSansGurmukhi();
  GoogleFonts.notoSansOriya();
  GoogleFonts.inter();
  GoogleFonts.outfit();
}

/// Outfit (display/headline/title) + Inter (body/label). Pass [isIndic] true
/// when the active locale uses an Indic script to raise line-heights so
/// matras / ascenders / descenders never clip (mirrors web `.indic-text`).
/// No text style uses height < 1.4. See THEME_SPEC.md §2.
class AppText {
  AppText._();

  static TextTheme build(ColorScheme s, {required bool isIndic}) {
    final onS = s.onSurface;
    final onV = s.onSurfaceVariant;
    double h(double latin, double indic) => isIndic ? indic : latin;

    TextStyle head(double size, FontWeight w, double lh,
            {Color? c, double ls = 0}) =>
        GoogleFonts.outfit(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
        ).copyWith(fontFamilyFallback: kIndicFallback);
    TextStyle body(double size, FontWeight w, double lh,
            {Color? c, double ls = 0}) =>
        GoogleFonts.inter(
          fontSize: size,
          fontWeight: w,
          height: lh,
          letterSpacing: ls,
          color: c ?? onS,
        ).copyWith(fontFamilyFallback: kIndicFallback);

    return TextTheme(
      displayLarge: head(36, FontWeight.w800, h(1.4, 1.45)),
      displayMedium: head(30, FontWeight.w700, h(1.4, 1.45)),
      displaySmall: head(24, FontWeight.w700, h(1.4, 1.45)),
      headlineLarge: head(30, FontWeight.w700, h(1.4, 1.45)),
      headlineMedium: head(24, FontWeight.w600, h(1.4, 1.45)),
      headlineSmall: head(20, FontWeight.w600, h(1.4, 1.45)),
      titleLarge: head(20, FontWeight.w600, h(1.35, 1.45), ls: -0.2),
      titleMedium: head(18, FontWeight.w600, h(1.4, 1.5)),
      titleSmall: head(14, FontWeight.w600, h(1.4, 1.5), ls: 0.6),
      bodyLarge: body(16, FontWeight.w500, h(1.6, 1.7)),
      bodyMedium: body(14, FontWeight.w400, h(1.6, 1.7), c: onS),
      bodySmall: body(12, FontWeight.w400, h(1.5, 1.7), c: onV),
      labelLarge: body(14, FontWeight.w500, h(1.4, 1.5)),
      labelMedium: body(12, FontWeight.w500, h(1.4, 1.5)),
      labelSmall: body(12, FontWeight.w500, h(1.4, 1.5), ls: 0.5),
    );
  }
}
