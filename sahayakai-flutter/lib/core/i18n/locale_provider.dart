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
    // Start at English, then hydrate the persisted choice asynchronously.
    _hydrate();
    return AppLocale.en;
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
