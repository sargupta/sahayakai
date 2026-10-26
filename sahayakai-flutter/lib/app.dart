import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/app_locale.dart';
import 'core/i18n/gen/app_localizations.dart';
import 'core/i18n/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/vidya/presentation/vidya_overlay.dart';

/// Root widget: MaterialApp.router wired to the one light theme, localization
/// delegates, and the active locale. When an Indic locale is active,
/// line-heights are raised via [AppTheme.withIndic].
///
/// The app is light only (design system, decided 26 Oct 2026): no dark theme
/// and no theme switch, whatever the phone's own setting. The locale is the
/// one switchable app-wide preference, watched here so Settings (P0.7)
/// re-localizes the running app live.
///
/// The `builder` mounts [VidyaOverlay] once, above the Navigator, so VIDYA's
/// draggable orb floats over every route (the tool screens push on top of the
/// shell, so an orb inside the shell could not ride over them). The overlay
/// self-gates: it paints nothing on the pre-auth screens or the voice home.
class SahayakApp extends ConsumerWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final locale = ref.watch(localeControllerProvider);

    final light = locale.isIndic
        ? AppTheme.withIndic(AppTheme.light())
        : AppTheme.light();

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: light,
      themeMode: ThemeMode.light,
      routerConfig: router,
      builder: (context, child) => Stack(
        children: [
          ?child,
          // Fills the same rect as the routed content so the overlay's own
          // Stack has full-screen bounds — a zero-size overlay would clip the
          // orb and drop its hit-testing.
          Positioned.fill(child: VidyaOverlay(router: router)),
        ],
      ),
      locale: locale.flutterLocale,
      supportedLocales:
          AppLocale.values.map((l) => l.flutterLocale).toList(),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
