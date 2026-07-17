import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/i18n/app_locale.dart';
import 'core/i18n/gen/app_localizations.dart';
import 'core/i18n/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';

/// Root widget: MaterialApp.router wired to the theme (light + dark),
/// localization delegates, and the active locale. When an Indic locale is
/// active, line-heights are raised via [AppTheme.withIndic].
///
/// Both switchable app-wide preferences are watched here, so Settings (P0.7)
/// re-themes and re-localizes the running app live: [localeControllerProvider]
/// drives `locale`, [themeModeControllerProvider] drives `themeMode`.
class SahayakApp extends ConsumerWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final locale = ref.watch(localeControllerProvider);
    final themeMode = ref.watch(themeModeControllerProvider);

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
      themeMode: themeMode,
      routerConfig: router,
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
