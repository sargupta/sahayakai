import 'package:flutter/widgets.dart';

/// Single source of truth for the 11 supported languages.
///
/// One enum drives BOTH:
///   1. the UI locale ([flutterLocale] -> MaterialApp.locale), and
///   2. the AI `language` request param ([aiName], the full English name the
///      backend AI endpoints expect, e.g. "Kannada").
/// One switcher, two consumers, zero drift. See ARCHITECTURE.md §6.4.
enum AppLocale {
  en('en', 'English', 'English'),
  hi('hi', 'Hindi', 'हिन्दी'),
  kn('kn', 'Kannada', 'ಕನ್ನಡ'),
  ta('ta', 'Tamil', 'தமிழ்'),
  te('te', 'Telugu', 'తెలుగు'),
  mr('mr', 'Marathi', 'मराठी'),
  bn('bn', 'Bengali', 'বাংলা'),
  gu('gu', 'Gujarati', 'ગુજરાતી'),
  pa('pa', 'Punjabi', 'ਪੰਜਾਬੀ'),
  ml('ml', 'Malayalam', 'മലയാളം'),
  or('or', 'Odia', 'ଓଡ଼ିଆ');

  const AppLocale(this.code, this.aiName, this.nativeLabel);

  /// BCP-47 language subtag -> Flutter [Locale].
  final String code;

  /// Exact `language` param the AI endpoints expect (full English name).
  final String aiName;

  /// Label shown in the language switcher (endonym).
  final String nativeLabel;

  Locale get flutterLocale => Locale(code);

  /// TTS/target-language tag, matches web (`kn-IN`).
  String get bcp47In => '$code-IN';

  /// True when this locale uses an Indic script (raise line-heights).
  bool get isIndic => this != AppLocale.en;

  static AppLocale fromCode(String? code) {
    for (final l in AppLocale.values) {
      if (l.code == code) return l;
    }
    return AppLocale.en;
  }
}
