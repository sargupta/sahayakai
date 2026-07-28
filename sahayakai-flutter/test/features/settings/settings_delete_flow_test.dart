import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/settings/domain/account_deletion.dart';
import 'package:sahayakai/features/settings/presentation/settings_controller.dart';
import 'package:sahayakai/features/settings/presentation/settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'settings_fixtures.dart';

/// Money/data-integrity gate: what happens right AFTER `POST
/// /api/user/delete-account` succeeds.
///
/// The old code just showed a SnackBar and left the teaching-profile form and
/// its Save button fully live — `authStateChanges()` can take up to an hour to
/// notice a server-side deletion, so waiting on it left a real window where a
/// scheduled-for-deletion account could still save profile edits. It also
/// never rendered the server's `exportUrl`, so the "30 days to export your
/// work" promise in the deletion copy had no way to be acted on.
///
/// These pin the fixed contract: the teacher sees a one-time confirmation with
/// a real export action (when the server sent one), and dismissing it signs
/// them out immediately and leaves Settings for Login — not a wait on the
/// auth stream.
void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  GoRouter testRouter() => GoRouter(
        initialLocation: Routes.settings,
        routes: [
          GoRoute(
            path: Routes.settings,
            builder: (_, _) => const SettingsScreen(),
          ),
          GoRoute(
            path: Routes.login,
            builder: (_, _) =>
                const Scaffold(body: Center(child: Text('LOGIN SCREEN'))),
          ),
        ],
      );

  Widget host({required List<Override> overrides}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: testRouter(),
      ),
    );
  }

  /// Opens the interlock dialog, types the confirm word and taps the
  /// destructive confirm button — the same path a teacher follows.
  ///
  /// The Danger group is the 5th (last) top-level group. `ListView(children:
  /// ...)` still builds its Slivers lazily against the viewport + cache
  /// extent — a pre-built `List<Widget>` does not mean every child already
  /// has a live Element — so at the test surface's default height the
  /// button's Element genuinely does not exist yet. `ensureVisible` cannot
  /// scroll to a widget that has no Element to find; `scrollUntilVisible`
  /// drags the list itself (which does not need the target to exist yet)
  /// between each check.
  Future<void> confirmDeleteDialog(WidgetTester tester) async {
    await tester.pumpAndSettle();
    final trigger = find.widgetWithText(OutlinedButton, 'Delete account');
    await tester.scrollUntilVisible(
      trigger,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(trigger);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'success WITH an exportPath: shows a real export action, and Done '
      'signs out + leaves Settings for Login', (tester) async {
    final opener = _FakeLinkOpener();
    await tester.pumpWidget(host(overrides: [
      signedInOverride(),
      profileDocOverride(doc: const <String, dynamic>{}),
      deleteAccountControllerProvider.overrideWith(_FakeDeleteSuccess.new),
      linkOpenerProvider.overrideWithValue(opener),
    ]));
    await tester.pumpAndSettle();

    await confirmDeleteDialog(tester);

    // The one-time confirmation, with a real, working export action.
    expect(find.text('Account scheduled for deletion'), findsOneWidget);
    // Two legitimate renders of the same copy, not a duplication bug: the
    // danger section's own body text switches to this exact copy the instant
    // `scheduled` flips true (correct, reactive UI), and the modal
    // confirmation shows the identical sentence on top of it.
    expect(
      find.text(
        'Your account is scheduled for deletion. You have 30 days to export your work.',
      ),
      findsAtLeastNWidgets(1),
    );
    final exportButton =
        find.widgetWithText(OutlinedButton, 'Export my data');
    expect(exportButton, findsOneWidget);

    await tester.tap(exportButton);
    await tester.pumpAndSettle();
    expect(opener.opened.single.toString(), 'https://sahayakai.com/api/export');

    // Settings is still open until the teacher dismisses the dialog — the
    // profile form and Save button underneath must not be reachable through
    // the dialog's modal barrier.
    expect(find.byType(SettingsScreen), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Done'));
    await tester.pumpAndSettle();

    // Immediate local sign-out + navigation, not a wait on authStateChanges.
    expect(find.byType(SettingsScreen), findsNothing);
    expect(find.text('LOGIN SCREEN'), findsOneWidget);
  });

  testWidgets(
      'success with NO exportPath: confirmation shows without an export '
      'button, Done still signs out and leaves Settings', (tester) async {
    await tester.pumpWidget(host(overrides: [
      signedInOverride(),
      profileDocOverride(doc: const <String, dynamic>{}),
      deleteAccountControllerProvider
          .overrideWith(_FakeDeleteSuccessNoExport.new),
      linkOpenerProvider.overrideWithValue(_FakeLinkOpener()),
    ]));
    await tester.pumpAndSettle();

    await confirmDeleteDialog(tester);

    expect(find.text('Account scheduled for deletion'), findsOneWidget);
    expect(
      find.widgetWithText(OutlinedButton, 'Export my data'),
      findsNothing,
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Done'));
    await tester.pumpAndSettle();

    expect(find.byType(SettingsScreen), findsNothing);
    expect(find.text('LOGIN SCREEN'), findsOneWidget);
  });

  testWidgets(
      'a failed delete (reauth required) shows the error, no dialog, no '
      'sign-out, Settings stays put', (tester) async {
    // No override on deleteAccountControllerProvider: the REAL controller
    // runs, and FirebaseInit.isConfigured is always false in a widget test,
    // so this exercises the honest early-exit every device hits if Firebase
    // itself is unavailable — the same path settings_controller_test.dart
    // pins at the provider layer.
    await tester.pumpWidget(host(overrides: [
      signedInOverride(),
      profileDocOverride(doc: const <String, dynamic>{}),
      linkOpenerProvider.overrideWithValue(_FakeLinkOpener()),
    ]));
    await tester.pumpAndSettle();

    await confirmDeleteDialog(tester);

    expect(find.text('Please sign in again'), findsOneWidget);
    expect(find.text('Account scheduled for deletion'), findsNothing);
    expect(find.byType(SettingsScreen), findsOneWidget);
    expect(find.text('LOGIN SCREEN'), findsNothing);
  });
}

class _FakeDeleteSuccess extends DeleteAccountController {
  @override
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.data(
      AccountDeletion(exportPath: '/api/export'),
    );
  }
}

class _FakeDeleteSuccessNoExport extends DeleteAccountController {
  @override
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.data(AccountDeletion());
  }
}

/// Records what the app tried to open instead of hitting a platform channel.
class _FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}
