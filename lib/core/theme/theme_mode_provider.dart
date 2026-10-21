import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'theme_mode_provider.g.dart';

const String _kThemeModeKey = 'app_theme_mode';

/// The active [ThemeMode], persisted across launches with shared_preferences
/// and read by `SahayakApp` (MaterialApp.router `themeMode`), so flipping it
/// re-themes the whole app live.
///
/// Deliberately mirrors [LocaleController] in `core/i18n/locale_provider.dart`:
/// same keepAlive notifier shape, same "start at the default, hydrate the
/// persisted choice asynchronously" contract. One pattern, two prefs.
///
/// [ThemeMode.system] is kept as a first-class option (and the default) rather
/// than a bare light/dark switch: it is what the app shipped with, and it is
/// what the web app's `next-themes` does.
@Riverpod(keepAlive: true)
class ThemeModeController extends _$ThemeModeController {
  @override
  ThemeMode build() {
    // Follow the device, then hydrate the persisted choice asynchronously.
    _hydrate();
    return ThemeMode.system;
  }

  Future<void> _hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_kThemeModeKey);
    if (stored != null) {
      state = themeModeFromName(stored);
    }
  }

  /// Set and persist the user's theme choice.
  Future<void> set(ThemeMode mode) async {
    state = mode;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kThemeModeKey, mode.name);
  }
}

/// Parses a persisted [ThemeMode.name]. Unknown/legacy values fall back to
/// [ThemeMode.system] rather than throwing — a corrupted pref must never
/// prevent the app from booting.
ThemeMode themeModeFromName(String? name) {
  for (final mode in ThemeMode.values) {
    if (mode.name == name) return mode;
  }
  return ThemeMode.system;
}
