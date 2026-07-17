import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/locale_provider.dart';
import 'package:sahayakai/core/theme/theme_mode_provider.dart';
import 'package:sahayakai/features/settings/data/notification_prefs_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistence gates: every Settings preference must survive a restart, and a
/// corrupted pref must never stop the app booting.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  ProviderContainer makeContainer() {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    return container;
  }

  group('ThemeModeController', () {
    test('defaults to following the device', () {
      expect(makeContainer().read(themeModeControllerProvider), ThemeMode.system);
    });

    test('set persists, and a fresh container hydrates it (round-trip)', () async {
      final first = makeContainer();
      await first.read(themeModeControllerProvider.notifier).set(ThemeMode.dark);
      expect(first.read(themeModeControllerProvider), ThemeMode.dark);

      // A new container is a new app launch reading the same store.
      final second = makeContainer();
      expect(second.read(themeModeControllerProvider), ThemeMode.system); // pre-hydration
      await hydrate(second);
      expect(second.read(themeModeControllerProvider), ThemeMode.dark);
    });

    test('round-trips every mode', () async {
      for (final mode in ThemeMode.values) {
        SharedPreferences.setMockInitialValues(<String, Object>{});
        final container = ProviderContainer();
        addTearDown(container.dispose);
        await container.read(themeModeControllerProvider.notifier).set(mode);

        final next = ProviderContainer();
        addTearDown(next.dispose);
        await hydrate(next);
        expect(next.read(themeModeControllerProvider), mode);
      }
    });

    test('a corrupted stored value falls back to system, never throws', () async {
      SharedPreferences.setMockInitialValues(
        <String, Object>{'app_theme_mode': 'ultraviolet'},
      );
      final container = makeContainer();
      await hydrate(container);
      expect(container.read(themeModeControllerProvider), ThemeMode.system);
      expect(themeModeFromName(null), ThemeMode.system);
    });
  });

  group('NotificationPrefsController', () {
    test('defaults to OFF (we cannot deliver notifications yet)', () {
      expect(makeContainer().read(notificationPrefsControllerProvider), isFalse);
    });

    test('set persists and hydrates (round-trip)', () async {
      final first = makeContainer();
      await first
          .read(notificationPrefsControllerProvider.notifier)
          .set(enabled: true);
      expect(first.read(notificationPrefsControllerProvider), isTrue);

      final second = makeContainer();
      await hydrate(second);
      expect(second.read(notificationPrefsControllerProvider), isTrue);
    });

    test('switching back off persists too', () async {
      SharedPreferences.setMockInitialValues(
        <String, Object>{'notifications_enabled': true},
      );
      final container = makeContainer();
      await hydrate(container);
      expect(container.read(notificationPrefsControllerProvider), isTrue);

      await container
          .read(notificationPrefsControllerProvider.notifier)
          .set(enabled: false);

      final next = makeContainer();
      await hydrate(next);
      expect(next.read(notificationPrefsControllerProvider), isFalse);
    });
  });

  group('LocaleController', () {
    test('set persists and hydrates (round-trip)', () async {
      final first = makeContainer();
      await first.read(localeControllerProvider.notifier).set(AppLocale.bn);
      expect(first.read(localeControllerProvider), AppLocale.bn);

      final second = makeContainer();
      await hydrate(second);
      expect(second.read(localeControllerProvider), AppLocale.bn);
    });

    test('round-trips all 11 languages', () async {
      expect(AppLocale.values, hasLength(11));
      for (final locale in AppLocale.values) {
        SharedPreferences.setMockInitialValues(<String, Object>{});
        final container = ProviderContainer();
        addTearDown(container.dispose);
        await container.read(localeControllerProvider.notifier).set(locale);

        final next = ProviderContainer();
        addTearDown(next.dispose);
        await hydrate(next);
        expect(next.read(localeControllerProvider), locale);
      }
    });

    test('a corrupted stored code falls back to English', () async {
      SharedPreferences.setMockInitialValues(
        <String, Object>{'app_locale_code': 'xx'},
      );
      final container = makeContainer();
      await hydrate(container);
      expect(container.read(localeControllerProvider), AppLocale.en);
    });
  });
}

/// Lets the keepAlive notifiers' fire-and-forget `_hydrate()` land before we
/// assert.
///
/// NOT named `pump`, and deliberately not an extension: `ProviderContainer`
/// already ships its own `pump()`, and an extension method loses to a real
/// instance method — so an extension named `pump` would be silently shadowed
/// and these tests would assert against un-built providers.
Future<void> hydrate(ProviderContainer container) async {
  // Touch the providers so they build (and start hydrating) ...
  container
    ..read(themeModeControllerProvider)
    ..read(notificationPrefsControllerProvider)
    ..read(localeControllerProvider);
  // ... then drain the event queue. `SharedPreferences.getInstance()` is a
  // platform-channel round trip, so it needs more than a single microtask turn
  // to settle.
  await pumpEventQueue();
}
