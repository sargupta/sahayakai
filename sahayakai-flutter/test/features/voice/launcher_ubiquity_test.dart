import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/presentation/inbox_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/network_hub_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/staffroom_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// P1.2 launcher ubiquity. The VIDYA co-teacher action must be reachable from
/// the shell surfaces that DON'T use ToolScaffold (which injects it on every
/// tool screen), matching the web's globally-mounted Omni-Orb. Each of these
/// renders its GlassAppBar regardless of body/auth state, so the launcher is
/// asserted on the real app bar in the screen's default (deferred / sign-in)
/// state. Library and ConversationThread also carry it, but Library's items
/// provider actively fetches (and ConversationThread needs constructor args), so
/// both are covered by explicit assertions in their own screen suites instead.
Widget _host(Widget screen) => ProviderScope(
  child: MaterialApp(
    theme: AppTheme.light(),
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: screen,
  ),
);

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  final surfaces = <String, Widget>{
    'Pro Inbox': const InboxScreen(),
    'Staffroom': const StaffroomScreen(),
    'Network hub': const NetworkHubScreen(),
  };

  surfaces.forEach((name, screen) {
    testWidgets('$name carries the VIDYA co-teacher launcher in its app bar', (
      tester,
    ) async {
      await tester.pumpWidget(_host(screen));
      // pump (not pumpAndSettle): the deferred transports/streams never settle,
      // but the app bar and its action render on the first frame.
      await tester.pump();
      expect(
        find.byType(VidyaAppBarAction),
        findsOneWidget,
        reason: '$name must expose the voice launcher like the tool screens do',
      );
    });
  });
}
