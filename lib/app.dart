import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/app_locale.dart';
import 'core/i18n/gen/app_localizations.dart';
import 'core/i18n/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/scanner_dark_provider.dart';
import 'core/theme/theme_mode_provider.dart';
import 'features/vidya/presentation/vidya_overlay.dart';

/// Root widget: MaterialApp.router wired to the theme (light + dark),
/// localization delegates, and the active locale.
class SahayakApp extends ConsumerWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final locale = ref.watch(localeControllerProvider);
    final themeMode = ref.watch(themeModeControllerProvider);
    // v3 Screen 11: the scanner's capture phase is the one surface the design
    // ships dark; its results (Screen 12) flip back to the teacher's theme.
    final scannerDark = ref.watch(scannerDarkProvider);

    final light = locale.isIndic
        ? AppTheme.withIndic(AppTheme.light())
        : AppTheme.light();
    final dark = locale.isIndic
        ? AppTheme.withIndic(AppTheme.dark())
        : AppTheme.dark();

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: light,
      darkTheme: dark,
      themeMode: scannerDark ? ThemeMode.dark : themeMode,
      routerConfig: router,
      builder: (context, child) => Stack(
        children: [
          ?child,
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
