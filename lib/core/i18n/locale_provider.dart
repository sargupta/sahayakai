import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_locale.dart';

part 'locale_provider.g.dart';

const String _kLocaleKey = 'app_locale_code';

/// The active UI locale. Also the source for the AI `language` param via
/// [AppLocale.aiName]. Persisted across launches with shared_preferences.
@Riverpod(keepAlive: true)
class LocaleController extends _$LocaleController {
  @override
  AppLocale build() {
    // First run seeds from the DEVICE locale, so a teacher whose phone is set to
    // Bengali / Tamil / Odia sees SahayakAI in their language from the very first
    // screen (login) instead of an English one they must hunt to change — the
    // parity move with web, which defaults from `navigator.language`.
    // [AppLocale.fromCode] falls back to English for any device locale SahayakAI
    // does not (yet) support. A persisted choice, when one exists, overrides this
    // in [_hydrate] — the teacher's explicit pick always wins.
    _hydrate();
    return AppLocale.fromCode(_deviceLanguageCode());
  }

  /// The device's primary language subtag. Prefers the WidgetsBinding dispatcher
  /// so a widget test can drive it with `platformDispatcher.localeTestValue`;
  /// falls back to the raw engine singleton (always present, no binding needed)
  /// when this provider is built by a plain `ProviderContainer` unit test with
  /// no widgets binding — so seeding the locale never throws. In the app both are
  /// the same dispatcher.
  String _deviceLanguageCode() {
    try {
      return WidgetsBinding.instance.platformDispatcher.locale.languageCode;
    } catch (_) {
      return ui.PlatformDispatcher.instance.locale.languageCode;
    }
  }

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_kLocaleKey);
    if (code != null) {
      state = AppLocale.fromCode(code);
    }
  }

  /// Set and persist the user's language choice.
  Future<void> set(AppLocale locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLocaleKey, locale.code);
  }
}
